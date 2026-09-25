import { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, CircularProgress, 
  Avatar, IconButton, Chip, Grid, Divider, useTheme,
  Tabs, Tab, TextField, Button, MenuItem, Select, FormControl, InputLabel, Snackbar, Alert, TablePagination, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import StorefrontIcon from '@mui/icons-material/Storefront';
import GroupIcon from '@mui/icons-material/Group';
import LockResetIcon from '@mui/icons-material/LockReset';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function UserView() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Tabs State
  const [tabValue, setTabValue] = useState(0);

  // Settings State
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', phone: '' });
  const [targetBulker, setTargetBulker] = useState('');
  const [activeBulkers, setActiveBulkers] = useState([]);
  const [accountStatus, setAccountStatus] = useState('');
  
  // Action states
  const [savingProfile, setSavingProfile] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  // Reviews and Wallet Data
  const [reviews, setReviews] = useState([]);
  const [bulkerApps, setBulkerApps] = useState([]);
  const [billingHistory, setBillingHistory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // Filters State
  const [revSearch, setRevSearch] = useState('');
  const [revStatus, setRevStatus] = useState('');
  
  const [txnSearch, setTxnSearch] = useState('');
  const [txnType, setTxnType] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalUsers, setModalUsers] = useState([]);
  const [modalApp, setModalApp] = useState(null);
  
  const handleOpenModal = (app, usersList) => {
    setModalApp(app);
    setModalUsers(usersList);
    setModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setModalOpen(false);
    setModalApp(null);
    setModalUsers([]);
  };
  
  const [txnPage, setTxnPage] = useState(0);
  const [txnRowsPerPage, setTxnRowsPerPage] = useState(10);
  const [referrals, setReferrals] = useState([]);
  const [loadingReferrals, setLoadingReferrals] = useState(false);
  const [refPage, setRefPage] = useState(0);
  const [refRowsPerPage, setRefRowsPerPage] = useState(10);
  
  const handleRefChangePage = (event, newPage) => setRefPage(newPage);
  const handleRefChangeRowsPerPage = (event) => { setRefRowsPerPage(parseInt(event.target.value, 10)); setRefPage(0); };
  const [revPage, setRevPage] = useState(0);
  const [revRowsPerPage, setRevRowsPerPage] = useState(10);
  const [appSearch, setAppSearch] = useState('');
  const [appPage, setAppPage] = useState(0);
  const [appRowsPerPage, setAppRowsPerPage] = useState(10);

  // Helper for Kolkata (Asia/Kolkata +5:30) date formatting
  const formatKolkataDate = (dateString, options = { day: '2-digit', month: 'short', year: 'numeric' }) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        timeZone: 'Asia/Kolkata',
        ...options
      });
    } catch {
      return String(dateString);
    }
  };

  const handleTxnChangePage = (event, newPage) => setTxnPage(newPage);
  const handleTxnChangeRowsPerPage = (event) => { setTxnRowsPerPage(parseInt(event.target.value, 10)); setTxnPage(0); };
  const handleRevChangePage = (event, newPage) => setRevPage(newPage);
  const handleRevChangeRowsPerPage = (event) => { setRevRowsPerPage(parseInt(event.target.value, 10)); setRevPage(0); };
  const handleAppChangePage = (event, newPage) => setAppPage(newPage);
  const handleAppChangeRowsPerPage = (event) => { setAppRowsPerPage(parseInt(event.target.value, 10)); setAppPage(0); };

  const filteredBulkerApps = bulkerApps
    .filter(app => {
      const q = appSearch.trim().toLowerCase();
      if (!q) return true;
      const formattedDate = formatKolkataDate(app.app_date).toLowerCase();
      return (
        app.task_id?.toString().toLowerCase().includes(q) ||
        app.app_name?.toLowerCase().includes(q) ||
        app.app_date?.toLowerCase().includes(q) ||
        formattedDate.includes(q)
      );
    })
    .sort((a, b) => {
      const timeA = a.app_date ? new Date(a.app_date).getTime() : 0;
      const timeB = b.app_date ? new Date(b.app_date).getTime() : 0;
      if (timeB !== timeA) {
        return timeB - timeA; // Latest date first (newest to oldest)
      }
      return (Number(b.task_id) || 0) - (Number(a.task_id) || 0);
    });

  const filteredReviews = reviews.filter(r => {
    const s = revSearch.toLowerCase();
    const matchSearch = !s || 
      r.apps?.app_name?.toLowerCase().includes(s) || 
      r.apps?.task_id?.toString().includes(s) ||
      r.submitted_username?.toLowerCase().includes(s);
    const matchStatus = revStatus ? r.status === revStatus : true;
    return matchSearch && matchStatus;
  });

  const filteredTransactions = transactions.filter(t => {
    const s = txnSearch.toLowerCase();
    const matchSearch = !s || 
      t.transaction_id.toLowerCase().includes(s) ||
      t.description?.toLowerCase().includes(s);
    const matchType = txnType ? t.transaction_type === txnType : true;
    return matchSearch && matchType;
  });

  useEffect(() => {
    fetchUserDetails();
  }, [type, id]);

  const fetchUserDetails = async () => {
    setLoading(true);
    let table = '';
    
    if (type === 'individual') table = 'profiles';
    else if (type === 'bulker') table = 'bulker_desks';
    else if (type === 'provider') table = 'providers';
    else if (type === 'client') table = 'clients';

    if (!table) {
      setLoading(false);
      return;
    }

    try {
      const { data: result, error } = await supabase.from(table).select('*').eq('id', id).single();
      if (error) throw error;
      
      let finalData = result;

      if (type === 'individual' || type === 'bulker') {
        // Fetch specific bulker name
        if (type === 'individual' && result.bulker_id) {
          const bid = result.bulker_id.includes('NOVAIRA/BULKER/') ? result.bulker_id : `NOVAIRA/BULKER/${result.bulker_id}`;
          const { data: b } = await supabase.from('bulker_desks').select('full_name').eq('bulker_id', bid).single();
          if (b) finalData.bulker_name = b.full_name;
        }

        // Fetch active bulkers for transfer dropdown
        const { data: allB } = await supabase.from('bulker_desks').select('bulker_id, full_name').eq('status', 'Active');
        if (allB) setActiveBulkers(allB);

        if (type === 'individual') {
          setEditForm({ 
            first_name: result.first_name || '', 
            last_name: result.last_name || '', 
            phone: result.phone || '' 
          });
        } else if (type === 'bulker') {
          setEditForm({ 
            full_name: result.full_name || '', 
            email: result.email || '', 
            phone: result.phone || '',
            password: result.password || '',
            account_type: result.account_type || 'Manual'
          });
        }
        setTargetBulker(result.bulker_id || '');
        setAccountStatus(result.status || 'Active');
      }

      setData(finalData);
    } catch (e) {
      console.error(e);
      setSnack({ open: true, message: 'Failed to load user data', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if ((type === 'individual' && data?.earner_id) || (type === 'bulker' && data?.bulker_id)) {
      fetchUserRecords();
    }
  }, [type, data?.earner_id, data?.bulker_id]);

  const fetchUserRecords = async () => {
    setLoadingRecords(true);
    try {
      // 1. Fetch Reviews
      let revsData = [];
      if (type === 'individual') {
          const { data: revs, error: revErr } = await supabase
            .from('review_submit_data')
            .select('id, submitted_username, status, submitted_at, apps(task_id, app_name)')
            .eq('earner_id', data.earner_id)
            .order('submitted_at', { ascending: false });
          if (revErr) throw revErr;
          if (revs) revsData = revs;
      } else if (type === 'bulker') {
          // Handle bulker_id variations (e.g. PRATIK1 vs NOVAIRA/BULKER/PRATIK1)
          let shortBulkerId = data.bulker_id;
          if (shortBulkerId && shortBulkerId.includes('/')) {
              const parts = shortBulkerId.split('/');
              shortBulkerId = parts[parts.length - 1];
          }
          const longBulkerId = `NOVAIRA/BULKER/${shortBulkerId}`;
          
          // Fetch apps assigned to this bulker
          const { data: allApps } = await supabase.from('apps').select('*').order('app_date', { ascending: false });
            const appsAssigned = allApps?.filter(app => {
                let assigned = app.assigned_bulkers || [];
                while (typeof assigned === 'string') {
                    try { assigned = JSON.parse(assigned); } catch (e) { break; }
                }
                if (!Array.isArray(assigned)) assigned = [];
                
                return assigned.some(b => {
                    const bId = typeof b === 'string' ? b : b.bulker_id;
                    return [data.bulker_id, shortBulkerId, longBulkerId].includes(bId);
                });
            });
          if (appsAssigned) {
            const sortedAssigned = [...appsAssigned].sort((a, b) => {
              const timeA = a.app_date ? new Date(a.app_date).getTime() : 0;
              const timeB = b.app_date ? new Date(b.app_date).getTime() : 0;
              if (timeB !== timeA) return timeB - timeA;
              return (Number(b.task_id) || 0) - (Number(a.task_id) || 0);
            });
            setBulkerApps(sortedAssigned);
          }

          const { data: profiles } = await supabase.from('profiles').select('*').in('bulker_id', [data.bulker_id, shortBulkerId, longBulkerId]).order('created_at', { ascending: false });
          if (profiles) setReferrals(profiles);

          
          // Fetch billing history for bulker
          const { data: hist } = await supabase
            .from('bulker_billing_history')
            .select('*')
            .in('bulker_id', [data.bulker_id, shortBulkerId, longBulkerId])
            .order('change_date_time', { ascending: true });
          if (hist) setBillingHistory(hist);

          // Fetch wallet transactions for bulker
          const { data: txns, error: txnErr } = await supabase
            .from('individual_wallet_transactions')
            .select('*')
            .in('earner_id', [data.bulker_id, shortBulkerId, longBulkerId])
            .order('created_at', { ascending: false });
          if (txns) setTransactions(txns);
          
          const { data: revs, error: revErr } = await supabase
            .from('review_submit_data')
            .select('id, submitted_username, status, submitted_at, earner_id, bulker_id, apps(task_id, app_name)')
            .in('bulker_id', [data.bulker_id, shortBulkerId, longBulkerId])
            .order('submitted_at', { ascending: false });
          if (revErr) throw revErr;
          
          if (revs) {
              revsData = revs.map(r => {
                  const prof = profiles?.find(p => p.earner_id === r.earner_id);
                  return {
                      ...r,
                      earner_name: prof ? `${prof.first_name || ''} ${prof.last_name || ''}`.trim() || prof.phone : 'Unknown'
                  };
              });
          }
      }
      setReviews(revsData);

      // 2. Fetch Wallet Transactions
      if (type === 'individual') {
        const { data: txns, error: txnErr } = await supabase
          .from('individual_wallet_transactions')
          .select('*')
          .eq('earner_id', data.earner_id)
          .order('created_at', { ascending: false });

        if (txnErr) throw txnErr;
        if (txns) setTransactions(txns);
          
          const { data: refData, error: refErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('referral_code', data.earner_id)
            .order('created_at', { ascending: false });
          if (!refErr && refData) {
            setReferrals(refData);
          }
      }
    } catch (e) {
      console.error(e);
      setSnack({ open: true, message: 'Failed to load user records', severity: 'warning' });
    } finally {
      setLoadingRecords(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (type !== 'individual' && type !== 'bulker') return;
    setSavingProfile(true);
    try {
      if (type === 'individual') {
        const updates = {
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          phone: editForm.phone,
          account_type: editForm.account_type
        };
        const { error } = await supabase.from('profiles').update(updates).eq('id', id);
        if (error) throw error;
      } else if (type === 'bulker') {
        const updates = {
          full_name: editForm.full_name,
          email: editForm.email,
          phone: editForm.phone,
          password: editForm.password,
          account_type: editForm.account_type
        };
        const { error } = await supabase.from('bulker_desks').update(updates).eq('id', id);
        if (error) throw error;

        // Check if account_type was changed and log to history for bulker
        if (data.account_type !== editForm.account_type) {
            const bulkerIdToLog = data.bulker_id;
            if (bulkerIdToLog) {
                await supabase.from('bulker_billing_history').insert([{
                    bulker_id: bulkerIdToLog,
                    change_mode: editForm.account_type,
                    status: 'Active'
                }]);
            }
        }
      }

      setData({ ...data, ...editForm });
      setSnack({ open: true, message: 'Profile updated successfully!', severity: 'success' });
    } catch (e) {
      console.error(e);
      setSnack({ open: true, message: e.message, severity: 'error' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleTransferBulker = async () => {
    if (!targetBulker || targetBulker === data.bulker_id) return;
    setTransferring(true);
    try {
      const { error } = await supabase.from('profiles').update({ bulker_id: targetBulker }).eq('id', id);
      if (error) throw error;
      
      const newBulker = activeBulkers.find(b => b.bulker_id === targetBulker);
      setData({ ...data, bulker_id: targetBulker, bulker_name: newBulker ? newBulker.full_name : '' });
      setSnack({ open: true, message: 'Bulker transferred successfully!', severity: 'success' });
    } catch (e) {
      console.error(e);
      setSnack({ open: true, message: e.message, severity: 'error' });
    } finally {
      setTransferring(false);
    }
  };

  const handleResetPassword = async () => {
    if (!data.email) {
      setSnack({ open: true, message: 'No email found for this user.', severity: 'error' });
      return;
    }
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email);
      if (error) throw error;
      setSnack({ open: true, message: 'Password reset email sent!', severity: 'success' });
    } catch (e) {
      console.error(e);
      setSnack({ open: true, message: e.message, severity: 'error' });
    } finally {
      setSendingReset(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (type !== 'individual' && type !== 'bulker') return;
    setUpdatingStatus(true);
    try {
      const { error } = await supabase.from('profiles').update({ status: accountStatus }).eq('id', id);
      if (error) throw error;
      setData({ ...data, status: accountStatus });
      setSnack({ open: true, message: 'Account status updated!', severity: 'success' });
    } catch (e) {
      console.error(e);
      setSnack({ open: true, message: e.message, severity: 'error' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const renderIcon = () => {
    if (type === 'individual') return <PersonIcon />;
    if (type === 'bulker') return <GroupIcon />;
    if (type === 'provider') return <StorefrontIcon />;
    if (type === 'client') return <BusinessIcon />;
  };

  if (loading) return <Box sx={{ p: 5, textAlign: 'center' }}><CircularProgress /></Box>;
  if (!data) return <Box sx={{ p: 5, textAlign: 'center' }}><Typography>User not found or invalid type.</Typography></Box>;


    const handleCopyAppUsers = () => {
      if (!modalApp) return;
      const appDateStr = formatKolkataDate(modalApp.app_date);
      
      let text = `${modalApp.app_name}\n${appDateStr}\nAPP ID : ${modalApp.task_id}\n\n`;
      modalUsers.forEach(u => {
        text += `${(u.submitted_username || '').toUpperCase()}\n`;
      });
      text += `\nTOTAL - ${modalUsers.length}`;
      
      navigator.clipboard.writeText(text);
      setSnack({ open: true, message: 'Copied successfully!', severity: 'success' });
    };

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', mt: 1, pb: 10, px: { xs: 1, md: 2 } }}>
      
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <IconButton onClick={() => navigate(-1)} sx={{ bgcolor: 'action.hover', width: 42, height: 42 }}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ p: 1.5, borderRadius: '16px', bgcolor: 'primary.main', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {renderIcon()}
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 600, textTransform: 'capitalize' }}>
            {type} Details
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Full information and records
          </Typography>
        </Box>
      </Box>

      {/* Main Content Card */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: '24px', mb: 3, border: theme.palette.mode === 'light' ? `1px solid ${theme.palette.divider}` : 'none' }}>
        
        {/* Profile Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, mb: 3 }}>
          <Avatar sx={{ width: 64, height: 64, fontSize: '1.6rem', bgcolor: 'secondary.main', fontWeight: 600 }}>
            {((data.name || data.full_name || data.first_name || 'U')[0]).toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {data.name || data.full_name || `${data.first_name || ''} ${data.last_name || ''}`.trim()}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mt: 0.5 }}>
              ID: {data.earner_id || data.bulker_id || data.provider_id || data.client_id || data.id}
            </Typography>
            <Chip 
              size="small" 
              label={data.status || 'Active'} 
              color={data.status?.toLowerCase() === 'active' ? 'success' : 'default'} 
              sx={{ mt: 1, height: 22, fontSize: '0.7rem', fontWeight: 600 }} 
            />
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Dynamic Fields */}
        <Grid container spacing={3}>
          {type === 'individual' && (
            <>
              <Grid item xs={12} sm={4} md={3}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>Email Address</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>{data.email || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={12} sm={4} md={3}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>Phone Number</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>{data.phone || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={12} sm={4} md={3}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>Assigned Bulker</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5, color: 'primary.main' }}>
                  {data.bulker_name || 'Unknown'} {data.bulker_id && <span style={{ fontSize: '0.75rem', color: '#888' }}>({data.bulker_id})</span>}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4} md={3}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>Referral Code</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>{data.referral_code || 'N/A'}</Typography>
              </Grid>
            </>
          )}

          {type === 'bulker' && (
              <>
                <Grid item xs={12} sm={4} md={3}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>Email Address</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>{data.email || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={12} sm={4} md={3}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>Phone Number</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>{data.phone || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={12} sm={4} md={3}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>Password</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>{data.password || 'Hidden'}</Typography>
                </Grid>
                <Grid item xs={12} sm={4} md={3}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>Account Type</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>{data.account_type === 'Wallet System' ? 'Wallet System' : 'Manual'}</Typography>
                </Grid>
              </>
            )}

          {(type === 'provider' || type === 'client') && (
            <>
              <Grid item xs={12} sm={4} md={3}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>Entity Name</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>{data.name}</Typography>
              </Grid>
              <Grid item xs={12} sm={4} md={3}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>Entity Type</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5, textTransform: 'capitalize' }}>{type}</Typography>
              </Grid>
            </>
          )}

          <Grid item xs={12} sm={4} md={3}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>Join Date</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>{new Date(data.created_at).toLocaleString()}</Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* TABS & LOWER CARD */}
      <Paper elevation={0} sx={{ borderRadius: '24px', border: theme.palette.mode === 'light' ? `1px solid ${theme.palette.divider}` : 'none', overflow: 'hidden' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, pt: 2, bgcolor: theme.palette.mode === 'light' ? '#fcfcfc' : 'background.paper' }}>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} textColor="primary" indicatorColor="primary" variant="scrollable" scrollButtons="auto">
              <Tab label={type === 'bulker' ? 'Assigned Apps' : 'Reviews'} sx={{ fontWeight: 600, textTransform: 'none', fontSize: '1rem', py: 2 }} />
              <Tab label="Wallet" sx={{ fontWeight: 600, textTransform: 'none', fontSize: '1rem', py: 2, display: type === 'individual' || type === 'bulker' ? 'flex' : 'none' }} />
              <Tab label="Monthly Invoice" sx={{ fontWeight: 600, textTransform: 'none', fontSize: '1rem', py: 2, display: type === 'bulker' ? 'flex' : 'none' }} />
              <Tab label="Settings" sx={{ fontWeight: 600, textTransform: 'none', fontSize: '1rem', py: 2 }} />
              <Tab label={type === 'bulker' ? 'Users' : 'Referrals'} sx={{ fontWeight: 600, textTransform: 'none', fontSize: '1rem', py: 2 }} />
            </Tabs>
        </Box>

        <Box sx={{ p: { xs: 3, md: 5 }, minHeight: '300px' }}>
          
          <TabPanel value={tabValue} index={0}>
                {type !== 'individual' && type !== 'bulker' ? (
                  <Box sx={{ p: 5, textAlign: 'center', border: `1px dashed ${theme.palette.divider}`, borderRadius: '16px' }}>
                    <Typography color="text.secondary">Reviews only apply to Individual and Bulker Users.</Typography>
                  </Box>
                ) : loadingRecords ? (
                  <Box sx={{ p: 5, textAlign: 'center' }}><CircularProgress /></Box>
                ) : (
                  <Box>
                    {type === 'bulker' && (
                      <Box sx={{ mb: 2 }}>
                        {bulkerApps.length === 0 ? (
                          <Box sx={{ p: 5, textAlign: 'center', border: `1px dashed ${theme.palette.divider}`, borderRadius: '16px' }}>
                            <Typography color="text.secondary">No apps assigned to this bulker.</Typography>
                          </Box>
                        ) : (
                          <Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
                              <TextField
                                size="small"
                                placeholder="Search Task ID, App Name..."
                                value={appSearch}
                                onChange={(e) => { setAppSearch(e.target.value); setAppPage(0); }}
                                sx={{ minWidth: { xs: '100%', sm: 260 } }}
                              />
                              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                                Total Apps: {filteredBulkerApps.length}
                              </Typography>
                            </Box>

                            <TableContainer
                              component={Paper}
                              elevation={0}
                              sx={{
                                borderRadius: '18px',
                                border: `1px solid ${theme.palette.divider}`,
                                overflow: 'hidden',
                                bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(15, 23, 42, 0.5)',
                              }}
                            >
                              <Table size="small">
                                <TableHead sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(15, 23, 42, 0.02)' : 'rgba(148, 163, 184, 0.06)' }}>
                                  <TableRow>
                                    <TableCell sx={{ fontWeight: 700 }}>Task ID</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>App Name</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>App Date</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Bulker Rate</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 700 }}>Completed Reviews</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {filteredBulkerApps
                                    .slice(appPage * appRowsPerPage, appPage * appRowsPerPage + appRowsPerPage)
                                    .map(app => {
                                      const bId = data.bulker_id;
                                      const shortBulkerId = bId.replace('NOVAIRA/BULKER/', '');
                                      const longBulkerId = `NOVAIRA/BULKER/${shortBulkerId}`;
                                      let assigned = app.assigned_bulkers || [];
                                      while (typeof assigned === 'string') {
                                        try { assigned = JSON.parse(assigned); } catch (e) { break; }
                                      }
                                      if (!Array.isArray(assigned)) assigned = [];

                                      const rateObj = assigned.find(b => {
                                        const id = typeof b === 'string' ? b : b.bulker_id;
                                        return [bId, shortBulkerId, longBulkerId].includes(id);
                                      });
                                      const rate = rateObj && typeof rateObj === 'object' ? rateObj.amount : 'N/A';
                                      const appReviews = reviews.filter(r => r.apps?.task_id === app.task_id);

                                      return (
                                        <TableRow key={app.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                          <TableCell sx={{ color: 'primary.main', fontWeight: 700 }}>#{app.task_id}</TableCell>
                                          <TableCell sx={{ fontWeight: 600 }}>{app.app_name}</TableCell>
                                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatKolkataDate(app.app_date)}</TableCell>
                                          <TableCell sx={{ color: 'success.main', fontWeight: 700 }}>₹{rate}</TableCell>
                                          <TableCell align="center">
                                            <Button
                                              variant="contained"
                                              color="primary"
                                              size="small"
                                              sx={{ borderRadius: '20px', px: 2.5, fontWeight: 700, minWidth: 110 }}
                                              onClick={() => handleOpenModal(app, appReviews)}
                                            >
                                              {appReviews.length} Users
                                            </Button>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                </TableBody>
                              </Table>
                            </TableContainer>

                            <TablePagination
                              component="div"
                              count={filteredBulkerApps.length}
                              page={appPage}
                              rowsPerPage={appRowsPerPage}
                              onPageChange={handleAppChangePage}
                              onRowsPerPageChange={handleAppChangeRowsPerPage}
                              labelRowsPerPage="Rows per page"
                              labelDisplayedRows={({ from, to, count }) => `${from}-${to} of ${count}`}
                            />
                          </Box>
                        )}
                      </Box>
                    )}
                  
                  {type === 'individual' && (
                    <Box>
                      {reviews.length === 0 ? (
                        <Box sx={{ p: 5, textAlign: 'center', border: `1px dashed ${theme.palette.divider}`, borderRadius: '16px' }}>
                          <Typography color="text.secondary">No reviews submitted yet.</Typography>
                        </Box>
                      ) : (
                        <Box>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                            <TextField 
                              size="small" 
                              placeholder="Search Task ID, App, Username..." 
                              value={revSearch}
                              onChange={(e) => { setRevSearch(e.target.value); setRevPage(0); }}
                            />
                            <FormControl size="small" sx={{ minWidth: 150 }}>
                              <InputLabel>Status</InputLabel>
                              <Select label="Status" value={revStatus} onChange={(e) => setRevStatus(e.target.value)}>
                                <MenuItem value="">All</MenuItem>
                                <MenuItem value="Under Review">Under Review</MenuItem>
                                <MenuItem value="Approved">Approved</MenuItem>
                                <MenuItem value="Rejected">Rejected</MenuItem>
                              </Select>
                            </FormControl>
                          </Box>
          
                          {filteredReviews.length === 0 ? (
                            <Box sx={{ p: 5, textAlign: 'center', border: `1px dashed ${theme.palette.divider}`, borderRadius: '16px' }}>
                              <Typography color="text.secondary">No reviews match your filters.</Typography>
                            </Box>
                          ) : (
                            <Box sx={{ overflowX: 'auto', border: `1px solid ${theme.palette.divider}`, borderRadius: '16px' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                  <tr style={{ borderBottom: `1px solid ${theme.palette.divider}`, backgroundColor: theme.palette.mode === 'light' ? '#f8f9fa' : 'rgba(255,255,255,0.05)' }}>
                                    <th style={{ padding: '16px', fontWeight: 600 }}>Task ID</th>
                                    <th style={{ padding: '16px', fontWeight: 600 }}>App Name</th>
                                    <th style={{ padding: '16px', fontWeight: 600 }}>Submitted Username</th>
                                    <th style={{ padding: '16px', fontWeight: 600 }}>Date</th>
                                    <th style={{ padding: '16px', fontWeight: 600 }}>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredReviews.slice(revPage * revRowsPerPage, revPage * revRowsPerPage + revRowsPerPage).map(rev => (
                                    <tr key={rev.id} style={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                                      <td style={{ padding: '16px', color: theme.palette.primary.main, fontWeight: 600 }}>#{rev.apps?.task_id || 'N/A'}</td>
                                      <td style={{ padding: '16px', fontWeight: 600 }}>{rev.apps?.app_name || 'N/A'}</td>
                                      <td style={{ padding: '16px' }}>{rev.submitted_username}</td>
                                      <td style={{ padding: '16px' }}>{new Date(rev.submitted_at).toLocaleDateString()}</td>
                                      <td style={{ padding: '16px' }}>
                                        <Chip 
                                          label={rev.status} 
                                          size="small"
                                          color={rev.status === 'Approved' ? 'success' : rev.status === 'Rejected' ? 'error' : 'warning'}
                                          variant="outlined"
                                        />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                </table>
                                <TablePagination
                                  component="div"
                                  count={filteredReviews.length}
                                  page={revPage}
                                  onPageChange={handleRevChangePage}
                                  rowsPerPage={revRowsPerPage}
                                  onRowsPerPageChange={handleRevChangeRowsPerPage}
                                />
                              </Box>
                            )}
                        </Box>
                      )}
                    </Box>
                  )}
                </Box>
              )}
            </TabPanel>
<TabPanel value={tabValue} index={1}>
            {type !== 'individual' && type !== 'bulker' ? (
              <Box sx={{ p: 5, textAlign: 'center', border: `1px dashed ${theme.palette.divider}`, borderRadius: '16px' }}>
                <Typography color="text.secondary">Wallet only applies to Individual and Bulker Users.</Typography>
              </Box>
            ) : loadingRecords ? (
              <Box sx={{ p: 5, textAlign: 'center' }}><CircularProgress /></Box>
            ) : (
              <>
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ p: 3, borderRadius: '16px', bgcolor: 'primary.main' + '11', border: `1px solid ${theme.palette.primary.main}33` }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>Current Balance</Typography>
                        <Typography variant="h4" sx={{ fontWeight: 700, mt: 1, color: 'primary.main' }}>
                          ₹{ (
                            transactions.filter(t => t.transaction_type === 'Credit' && t.status === 'Completed').reduce((acc, curr) => acc + parseFloat(curr.amount), 0) -
                            transactions.filter(t => t.transaction_type === 'Debit' && t.status === 'Completed').reduce((acc, curr) => acc + parseFloat(curr.amount), 0) -
                            transactions.filter(t => t.transaction_type === 'Debit' && t.status === 'Pending').reduce((acc, curr) => acc + parseFloat(curr.amount), 0)
                          ).toFixed(2) }
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ p: 3, borderRadius: '16px', bgcolor: 'warning.main' + '11', border: `1px solid ${theme.palette.warning.main}33` }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>Pending Amount</Typography>
                        <Typography variant="h4" sx={{ fontWeight: 700, mt: 1, color: 'warning.main' }}>
                          ₹{transactions.filter(t => t.transaction_type === 'Debit' && t.status === 'Pending').reduce((acc, curr) => acc + parseFloat(curr.amount), 0).toFixed(2)}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ p: 3, borderRadius: '16px', bgcolor: 'success.main' + '11', border: `1px solid ${theme.palette.success.main}33` }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>Total Earned</Typography>
                        <Typography variant="h4" sx={{ fontWeight: 700, mt: 1, color: 'success.main' }}>
                          ₹{transactions.filter(t => t.transaction_type === 'Credit' && t.status === 'Completed').reduce((acc, curr) => acc + parseFloat(curr.amount), 0).toFixed(2)}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ p: 3, borderRadius: '16px', bgcolor: 'error.main' + '11', border: `1px solid ${theme.palette.error.main}33` }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>Total Debited / Paid</Typography>
                        <Typography variant="h4" sx={{ fontWeight: 700, mt: 1, color: 'error.main' }}>
                          ₹{transactions.filter(t => t.transaction_type === 'Debit' && t.status === 'Completed').reduce((acc, curr) => acc + parseFloat(curr.amount), 0).toFixed(2)}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>

                {/* Wallet Filter */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                  <TextField 
                    size="small" 
                    placeholder="Search Trx ID, Description..." 
                    value={txnSearch}
                    onChange={(e) => { setTxnSearch(e.target.value); setTxnPage(0); }}
                    sx={{ flexGrow: 1, maxWidth: 400, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                  />
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <Select 
                      displayEmpty 
                      value={txnType} 
                      onChange={(e) => setTxnType(e.target.value)}
                      sx={{ borderRadius: '12px' }}
                    >
                      <MenuItem value="">All Types</MenuItem>
                      <MenuItem value="Credit">Credit</MenuItem>
                      <MenuItem value="Debit">Debit</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                {filteredTransactions.length === 0 ? (
                  <Box sx={{ p: 5, textAlign: 'center', border: `1px dashed ${theme.palette.divider}`, borderRadius: '16px' }}>
                    <Typography color="text.secondary">No wallet transactions match your filters.</Typography>
                  </Box>
                ) : (
                  <Box sx={{ overflowX: 'auto', border: `1px solid ${theme.palette.divider}`, borderRadius: '16px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${theme.palette.divider}`, backgroundColor: theme.palette.mode === 'light' ? '#f8f9fa' : 'rgba(255,255,255,0.05)' }}>
                          <th style={{ padding: '16px', fontWeight: 600 }}>Date</th>
                          <th style={{ padding: '16px', fontWeight: 600 }}>Trx ID</th>
                          <th style={{ padding: '16px', fontWeight: 600 }}>Description</th>
                          <th style={{ padding: '16px', fontWeight: 600 }}>Type</th>
                          <th style={{ padding: '16px', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                          <th style={{ padding: '16px', fontWeight: 600, textAlign: 'center' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTransactions.slice(txnPage * txnRowsPerPage, txnPage * txnRowsPerPage + txnRowsPerPage).map(txn => (
                          <tr key={txn.id} style={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                              <td style={{ padding: '16px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{new Date(txn.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}</td>
                              <td style={{ padding: '16px', fontFamily: 'monospace', color: 'text.secondary', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{txn.transaction_id}</td>
                              <td style={{ padding: '16px', fontWeight: 500, verticalAlign: 'middle' }}>{txn.description || 'N/A'}</td>
                              <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                              <Chip 
                                label={txn.transaction_type} 
                                size="small" 
                                color={txn.transaction_type === 'Credit' ? 'success' : 'error'}
                                variant="outlined"
                                sx={{ fontWeight: 600, height: 24 }}
                              />
                            </td>
                              <td style={{ padding: '16px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', verticalAlign: 'middle', color: txn.transaction_type === 'Credit' ? theme.palette.success.main : theme.palette.error.main }}>
                                {txn.transaction_type === 'Credit' ? '+' : '-'}₹{parseFloat(txn.amount).toFixed(2)}
                              </td>
                              <td style={{ padding: '16px', textAlign: 'center', verticalAlign: 'middle' }}>
                              <Chip 
                                label={txn.status || 'Completed'} 
                                size="small"
                                color={txn.status === 'Pending' ? 'warning' : txn.status === 'Failed' ? 'error' : 'success'}
                                variant="outlined"
                                sx={{ fontWeight: 600, height: 24 }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                      <TablePagination
                        component="div"
                        count={filteredTransactions.length}
                        page={txnPage}
                        onPageChange={handleTxnChangePage}
                        rowsPerPage={txnRowsPerPage}
                        onRowsPerPageChange={handleTxnChangeRowsPerPage}
                      />
                    </Box>
                  )}
              </>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
              {type !== 'bulker' ? (
                <Box sx={{ p: 5, textAlign: 'center', border: `1px dashed ${theme.palette.divider}`, borderRadius: '16px' }}>
                  <Typography color="text.secondary">Monthly Invoice only applies to Bulker Users.</Typography>
                </Box>
              ) : (
                <>
                {data?.account_type !== 'Manual' ? (
                  <Box sx={{ p: 5, textAlign: 'center', border: `1px dashed ${theme.palette.divider}`, borderRadius: '16px' }}>
                    <Typography color="text.secondary">Monthly Invoice is only available for users with a Monthly billing cycle. This user is on a {data?.account_type || 'Unknown'} cycle.</Typography>
                  </Box>
                ) : (
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>Monthly Invoice Data</Typography>
                    <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: '16px', maxHeight: 600 }}>
                      <Table stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>App Name</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>App ID</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>Total Live Count</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>App Rate</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(() => {
                            const bId = data.bulker_id;
                            const shortBulkerId = bId ? bId.replace('NOVAIRA/BULKER/', '') : '';
                            const longBulkerId = `NOVAIRA/BULKER/${shortBulkerId}`;
                            
                            const getModeAtDate = (dateStr) => {
                                let initialMode = data.account_type || 'Manual';
                                if (billingHistory.length > 0) {
                                    initialMode = billingHistory[0].change_mode === 'Manual' ? 'Wallet System' : 'Manual';
                                }
                                let currentMode = initialMode;
                                const targetTime = new Date(dateStr).getTime();
                                
                                for (const hist of billingHistory) {
                                    if (new Date(hist.change_date_time).getTime() <= targetTime) {
                                        currentMode = hist.change_mode;
                                    }
                                }
                                return currentMode;
                            };

                            let grandTotal = 0;
                            const rows = bulkerApps.filter(app => {
                                // Filter apps that belong to the 'Manual' billing period
                                const mode = getModeAtDate(app.app_date || app.created_at);
                                return mode === 'Manual';
                            }).map(app => {
                              let assigned = app.assigned_bulkers || [];
                              while (typeof assigned === 'string') {
                                try { assigned = JSON.parse(assigned); } catch (e) { break; }
                              }
                              if (!Array.isArray(assigned)) assigned = [];
                              
                              const rateObj = assigned.find(b => {
                                const id = typeof b === 'string' ? b : b.bulker_id;
                                return [bId, shortBulkerId, longBulkerId].includes(id);
                              });
                              const rate = rateObj && typeof rateObj === 'object' ? Number(rateObj.amount || 0) : 0;
                              
                              const appReviews = reviews.filter(r => r.apps?.task_id === app.task_id);
                              const liveCount = appReviews.filter(r => r.status === 'Live' || r.status === 'Approved').length;
                              const total = liveCount * rate;
                              grandTotal += total;

                              return {
                                ...app,
                                rate,
                                liveCount,
                                total
                              };
                            });

                            return (
                              <>
                                {rows.map(row => (
                                  <TableRow key={row.id} hover>
                                    <TableCell sx={{ fontWeight: 600 }}>{row.app_name}</TableCell>
                                    <TableCell sx={{ color: 'primary.main', fontWeight: 600 }}>#{row.task_id}</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 700 }}>{row.liveCount}</TableCell>
                                    <TableCell align="right" sx={{ color: 'success.main', fontWeight: 600 }}>₹{row.rate.toFixed(2)}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>₹{row.total.toFixed(2)}</TableCell>
                                  </TableRow>
                                ))}
                                {rows.length === 0 && (
                                  <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ p: 4, color: 'text.secondary' }}>No apps assigned yet.</TableCell>
                                  </TableRow>
                                )}
                                <TableRow sx={{ backgroundColor: theme.palette.mode === 'light' ? '#f8f9fa' : 'rgba(255,255,255,0.05)' }}>
                                  <TableCell colSpan={4} align="right" sx={{ fontWeight: 800, fontSize: '1.1rem' }}>Final Grand Total:</TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 900, fontSize: '1.2rem', color: 'primary.main' }}>₹{grandTotal.toFixed(2)}</TableCell>
                                </TableRow>
                              </>
                            );
                          })()}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}
                </>
              )}
            </TabPanel>

            <TabPanel value={tabValue} index={3}>
            {type === 'individual' ? (
              <Grid container spacing={4}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: '20px', height: '100%' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 3 }}>Update Profile Info</Typography>
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                      <TextField size="small" fullWidth label="First Name" value={editForm.first_name} onChange={e => setEditForm({...editForm, first_name: e.target.value})} />
                      <TextField size="small" fullWidth label="Last Name" value={editForm.last_name} onChange={e => setEditForm({...editForm, last_name: e.target.value})} />
                    </Box>
                    <TextField size="small" fullWidth label="Phone Number" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} sx={{ mb: 3 }} />
                    <Button variant="contained" disableElevation startIcon={<SaveIcon />} onClick={handleUpdateProfile} disabled={savingProfile} sx={{ borderRadius: '10px' }}>
                      {savingProfile ? 'Saving...' : 'Save Profile'}
                    </Button>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: '20px', height: '100%' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 3 }}>Transfer Bulker</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                      <FormControl size="small" fullWidth>
                        <InputLabel>Target Bulker</InputLabel>
                        <Select label="Target Bulker" value={targetBulker} onChange={(e) => setTargetBulker(e.target.value)}>
                          <MenuItem value="">None</MenuItem>
                          {activeBulkers.map(b => (
                            <MenuItem key={b.bulker_id} value={b.bulker_id}>{b.full_name} ({b.bulker_id})</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Button variant="outlined" color="primary" disableElevation onClick={handleTransferBulker} disabled={transferring || !targetBulker || targetBulker === data.bulker_id} sx={{ borderRadius: '10px' }}>
                        {transferring ? 'Transferring...' : 'Transfer to Bulker'}
                      </Button>
                    </Box>
                    <Divider sx={{ my: 3 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Security</Typography>
                    <Button variant="contained" color="error" disableElevation onClick={handleResetPassword} disabled={sendingReset} sx={{ borderRadius: '10px' }}>
                      {sendingReset ? 'Sending...' : 'Send Password Reset Link'}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            ) : type === 'bulker' ? (
              <Grid container spacing={4}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: '20px', height: '100%' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 3 }}>Update Bulker Details</Typography>
                    <TextField size="small" fullWidth label="Full Name" value={editForm.full_name} onChange={e => setEditForm({...editForm, full_name: e.target.value})} sx={{ mb: 2 }} />
                    <TextField size="small" fullWidth label="Email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} sx={{ mb: 2 }} />
                    <TextField size="small" fullWidth label="Phone Number" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} sx={{ mb: 2 }} />
                    <TextField size="small" fullWidth label="Password" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} sx={{ mb: 3 }} />
                    <Button variant="contained" disableElevation startIcon={<SaveIcon />} onClick={handleUpdateProfile} disabled={savingProfile} sx={{ borderRadius: '10px' }}>
                      {savingProfile ? 'Saving...' : 'Save Profile'}
                    </Button>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: '20px', height: '100%' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 3 }}>Account Style & Settings</Typography>
                    <FormControl fullWidth size="small" sx={{ mb: 3 }}>
                      <InputLabel>Account Type</InputLabel>
                      <Select label="Account Type" value={editForm.account_type} onChange={e => setEditForm({...editForm, account_type: e.target.value})}>
                        <MenuItem value="Wallet System">Wallet System</MenuItem>
                        <MenuItem value="Manual">Manual</MenuItem>
                      </Select>
                    </FormControl>
                    <Button variant="contained" color="secondary" disableElevation startIcon={<SaveIcon />} onClick={handleUpdateProfile} disabled={savingProfile} sx={{ borderRadius: '10px' }}>
                      {savingProfile ? 'Saving...' : 'Save Account Style'}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            ) : (
              <Box sx={{ p: 5, textAlign: 'center', border: `1px dashed ${theme.palette.divider}`, borderRadius: '16px' }}>
                <Typography color="text.secondary">Settings available for Individual and Bulker Users only.</Typography>
              </Box>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={4}>
            {type !== 'individual' && type !== 'bulker' ? (
              <Box sx={{ p: 5, textAlign: 'center', border: `1px dashed ${theme.palette.divider}`, borderRadius: '16px' }}>
                <Typography color="text.secondary">This tab only applies to Individual and Bulker Users.</Typography>
              </Box>
            ) : referrals.length === 0 ? (
              <Box sx={{ p: 5, textAlign: 'center', border: `1px dashed ${theme.palette.divider}`, borderRadius: '16px' }}>
                <Typography color="text.secondary">{type === 'bulker' ? 'No users found under this bulker.' : 'No referrals found for this user.'}</Typography>
              </Box>
            ) : (
              <Box sx={{ overflowX: 'auto', border: `1px solid ${theme.palette.divider}`, borderRadius: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${theme.palette.divider}`, backgroundColor: theme.palette.mode === 'light' ? '#f8f9fa' : 'rgba(255,255,255,0.05)' }}>
                      <th style={{ padding: '16px', fontWeight: 600 }}>Name</th>
                      <th style={{ padding: '16px', fontWeight: 600 }}>Earner ID</th>
                      <th style={{ padding: '16px', fontWeight: 600 }}>Phone</th>
                      <th style={{ padding: '16px', fontWeight: 600 }}>Email</th>
                      <th style={{ padding: '16px', fontWeight: 600, textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.slice(refPage * refRowsPerPage, refPage * refRowsPerPage + refRowsPerPage).map(ref => (
                      <tr key={ref.id} style={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                        <td style={{ padding: '16px', fontWeight: 500 }}>{ref.first_name || ''} {ref.last_name || ''}</td>
                        <td style={{ padding: '16px', color: theme.palette.text.secondary }}>{ref.earner_id}</td>
                        <td style={{ padding: '16px' }}>{ref.phone || 'N/A'}</td>
                        <td style={{ padding: '16px' }}>{ref.email || 'N/A'}</td>
                        <td style={{ padding: '16px', textAlign: 'center' }}>
                          <Button 
                            variant="outlined" 
                            size="small" 
                            onClick={() => window.open(`#/user-view/individual/${ref.id}`, '_blank')}
                            sx={{ borderRadius: '10px' }}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <TablePagination
                  component="div"
                  count={referrals.length}
                  page={refPage}
                  onPageChange={handleRefChangePage}
                  rowsPerPage={refRowsPerPage}
                  onRowsPerPageChange={handleRefChangeRowsPerPage}
                />
              </Box>
            )}
          </TabPanel>

        </Box>
      </Paper>

      <Dialog open={modalOpen} onClose={handleCloseModal} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: '20px' } }}>
          <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 3, pb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Completed Reviews - {modalApp?.app_name}</Typography>
            <Box>
              <Button onClick={handleCopyAppUsers} variant="outlined" size="small" sx={{ mr: 2, borderRadius: '10px' }}>
                Copy Users
              </Button>
              <IconButton onClick={handleCloseModal} size="small"><CloseIcon /></IconButton>
            </Box>
          </DialogTitle>
          <Divider />
          <DialogContent sx={{ p: 0 }}>
            {modalUsers.length === 0 ? (
              <Box sx={{ p: 5, textAlign: 'center' }}>
                <Typography color="text.secondary">No completed reviews for this app yet.</Typography>
              </Box>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${theme.palette.divider}`, backgroundColor: theme.palette.mode === 'light' ? '#f8f9fa' : 'rgba(255,255,255,0.05)' }}>
                      <th style={{ padding: '16px', fontWeight: 600 }}>Done By (User)</th>
                      <th style={{ padding: '16px', fontWeight: 600 }}>Submitted Username</th>
                      <th style={{ padding: '16px', fontWeight: 600 }}>Date</th>
                      <th style={{ padding: '16px', fontWeight: 600, textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalUsers.map(u => (
                      <tr key={u.id} style={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                        <td style={{ padding: '16px' }}>
                          <Typography sx={{ fontWeight: 600 }}>{u.earner_name}</Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{u.earner_id}</Typography>
                        </td>
                        <td style={{ padding: '16px' }}>{u.submitted_username}</td>
                        <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>{formatKolkataDate(u.submitted_at)}</td>
                        <td style={{ padding: '16px', textAlign: 'center' }}>
                          <Chip 
                            label={u.status} 
                            size="small"
                            color={u.status === 'Approved' ? 'success' : u.status === 'Rejected' ? 'error' : 'warning'}
                            variant="outlined"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            )}
          </DialogContent>
          <Divider />
          <DialogActions sx={{ p: 2, px: 3 }}>
            <Button onClick={handleCloseModal} variant="contained" disableElevation sx={{ borderRadius: '10px' }}>Close</Button>
          </DialogActions>
        </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({...snack, open: false})} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnack({...snack, open: false})} severity={snack.severity} sx={{ width: '100%', borderRadius: '12px' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
