import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  Avatar,
  IconButton,
  Chip,
  Grid,
  Divider,
  useTheme,
  Tabs,
  Tab,
  TextField,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Snackbar,
  Alert,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Skeleton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { getApiBaseUrl, getApiHeaders } from '../utils/apiConfig';

// Material Icons
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import StorefrontIcon from '@mui/icons-material/Storefront';
import GroupIcon from '@mui/icons-material/Group';
import LockResetIcon from '@mui/icons-material/LockReset';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CampaignIcon from '@mui/icons-material/Campaign';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RateReviewIcon from '@mui/icons-material/RateReview';
import TuneIcon from '@mui/icons-material/Tune';
import ShareIcon from '@mui/icons-material/Share';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BadgeIcon from '@mui/icons-material/Badge';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';

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
  const isDark = theme.palette.mode === 'dark';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Tabs State
  const [tabValue, setTabValue] = useState(0);

  // Settings State
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', phone: '', full_name: '', email: '', password: '', account_type: 'Manual' });
  const [targetBulker, setTargetBulker] = useState('');
  const [activeBulkers, setActiveBulkers] = useState([]);
  const [accountStatus, setAccountStatus] = useState('');

  // Action states
  const [savingProfile, setSavingProfile] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
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
  const [revPage, setRevPage] = useState(0);
  const [revRowsPerPage, setRevRowsPerPage] = useState(10);

  const [txnSearch, setTxnSearch] = useState('');
  const [txnType, setTxnType] = useState('');
  const [txnPage, setTxnPage] = useState(0);
  const [txnRowsPerPage, setTxnRowsPerPage] = useState(10);

  const [referrals, setReferrals] = useState([]);
  const [refPage, setRefPage] = useState(0);
  const [refRowsPerPage, setRefRowsPerPage] = useState(10);

  const [appSearch, setAppSearch] = useState('');
  const [appPage, setAppPage] = useState(0);
  const [appRowsPerPage, setAppRowsPerPage] = useState(10);

  // Modal for Completed Bulker App reviews
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

  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return `${Math.max(1, Math.floor(seconds))}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Helper for Kolkata (Asia/Kolkata +5:30) date formatting
  const formatKolkataDate = (dateString, options = { day: '2-digit', month: 'short', year: 'numeric' }) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        timeZone: 'Asia/Kolkata',
        ...options,
      });
    } catch {
      return String(dateString);
    }
  };

  const copyToClipboard = (text, label = 'Information') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setSnack({ open: true, message: `${label} copied to clipboard!`, severity: 'success' });
  };

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
      const { data: result, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!result) throw new Error(`User record not found in ${table}`);

      let finalData = { ...result };
      setAccountStatus(result.status || 'Active');

      if (type === 'individual' || type === 'bulker') {
        if (type === 'individual' && result.bulker_id) {
          try {
            const rawBid = result.bulker_id;
            const fullBid = rawBid.includes('NOVAIRA/BULKER/') ? rawBid : `NOVAIRA/BULKER/${rawBid}`;
            const { data: b } = await supabase
              .from('bulker_desks')
              .select('full_name')
              .or(`bulker_id.eq.${rawBid},bulker_id.eq.${fullBid}`)
              .limit(1)
              .maybeSingle();
            if (b) finalData.bulker_name = b.full_name;
          } catch (_) {}
        }

        try {
          const { data: allB } = await supabase
            .from('bulker_desks')
            .select('bulker_id, full_name')
            .eq('status', 'Active')
            .limit(50);
          if (allB) setActiveBulkers(allB);
        } catch (_) {}

        if (type === 'individual') {
          setEditForm({
            first_name: result.first_name || '',
            last_name: result.last_name || '',
            phone: result.phone || '',
            account_type: result.account_type || 'Individual',
          });
        } else if (type === 'bulker') {
          setEditForm({
            full_name: result.full_name || '',
            email: result.email || '',
            phone: result.phone || '',
            password: result.password || '',
            account_type: result.account_type || 'Manual',
          });
        }
        setTargetBulker(result.bulker_id || '');
      }

      setData(finalData);
      fetchUserRecords(finalData);
    } catch (e) {
      console.error('Fetch user details error:', e);
      setSnack({ open: true, message: `Failed to load user: ${e.message || 'Unknown error'}`, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserDetails();
  }, [type, id]);

  const fetchUserRecords = async (passedData = null) => {
    const currentData = passedData || data;
    const currentEarnerId = currentData?.earner_id;
    const currentBulkerId = currentData?.bulker_id;

    setLoadingRecords(true);
    try {
      let revsData = [];
      if (type === 'individual' && currentEarnerId) {
        try {
          let { data: revs, error: revErr } = await supabase
            .from('review_submit_data')
            .select('id, app_id, submitted_username, status, submitted_at, apps(task_id, app_name)')
            .eq('earner_id', currentEarnerId)
            .order('submitted_at', { ascending: false })
            .limit(150);

          if (revErr) {
            const { data: fallbackRevs } = await supabase
              .from('review_submit_data')
              .select('id, app_id, submitted_username, status, submitted_at')
              .eq('earner_id', currentEarnerId)
              .order('submitted_at', { ascending: false })
              .limit(150);

            if (fallbackRevs && fallbackRevs.length > 0) {
              const appIds = [...new Set(fallbackRevs.map((r) => r.app_id).filter(Boolean))];
              let appsMap = {};
              if (appIds.length > 0) {
                const { data: appsList } = await supabase
                  .from('apps')
                  .select('id, task_id, app_name')
                  .in('id', appIds);
                if (appsList) appsList.forEach((a) => { appsMap[a.id] = a; });
              }
              revs = fallbackRevs.map((r) => ({
                ...r,
                apps: appsMap[r.app_id] || { task_id: 'N/A', app_name: 'Task App' },
              }));
            } else {
              revs = [];
            }
          }
          if (revs) revsData = revs;
        } catch (err) {
          console.warn('Reviews fetch fallback error:', err);
        }
      } else if (type === 'bulker' && currentBulkerId) {
        let shortBulkerId = currentBulkerId;
        if (shortBulkerId && shortBulkerId.includes('/')) {
          const parts = shortBulkerId.split('/');
          shortBulkerId = parts[parts.length - 1];
        }
        const longBulkerId = `NOVAIRA/BULKER/${shortBulkerId}`;

        const { data: allApps } = await supabase.from('apps').select('*').order('app_date', { ascending: false }).limit(200);
        const appsAssigned = allApps?.filter((app) => {
          let assigned = app.assigned_bulkers || [];
          while (typeof assigned === 'string') {
            try { assigned = JSON.parse(assigned); } catch (e) { break; }
          }
          if (!Array.isArray(assigned)) assigned = [];
          return assigned.some((b) => {
            const bId = typeof b === 'string' ? b : b.bulker_id;
            return [currentBulkerId, shortBulkerId, longBulkerId].includes(bId);
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

        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('bulker_id', [currentBulkerId, shortBulkerId, longBulkerId])
          .order('created_at', { ascending: false })
          .limit(200);
        if (profiles) setReferrals(profiles);

        const { data: hist } = await supabase
          .from('bulker_billing_history')
          .select('*')
          .in('bulker_id', [currentBulkerId, shortBulkerId, longBulkerId])
          .order('change_date_time', { ascending: true })
          .limit(100);
        if (hist) setBillingHistory(hist);

        const { data: txns } = await supabase
          .from('individual_wallet_transactions')
          .select('id, transaction_id, amount, transaction_type, description, status, created_at, utr_id')
          .in('earner_id', [currentBulkerId, shortBulkerId, longBulkerId])
          .order('created_at', { ascending: false })
          .limit(150);
        if (txns) setTransactions(txns);

        let { data: revs } = await supabase
          .from('review_submit_data')
          .select('id, app_id, submitted_username, status, submitted_at, earner_id, bulker_id, apps(task_id, app_name)')
          .in('bulker_id', [currentBulkerId, shortBulkerId, longBulkerId])
          .order('submitted_at', { ascending: false })
          .limit(200);

        if (revs) {
          revsData = revs.map((r) => {
            const prof = profiles?.find((p) => p.earner_id === r.earner_id);
            return {
              ...r,
              earner_name: prof ? `${prof.first_name || ''} ${prof.last_name || ''}`.trim() || prof.phone : 'Unknown',
            };
          });
        }
      }
      setReviews(revsData);

      // Wallet Transactions
      if (type === 'individual' && currentEarnerId) {
        try {
          const { data: txns } = await supabase
            .from('individual_wallet_transactions')
            .select('id, transaction_id, amount, transaction_type, description, status, created_at, utr_id')
            .eq('earner_id', currentEarnerId)
            .order('created_at', { ascending: false })
            .limit(150);
          if (txns) setTransactions(txns);
        } catch (txnEx) {
          console.error('Wallet fetch error:', txnEx);
        }

        try {
          const { data: refData } = await supabase
            .from('profiles')
            .select('id, earner_id, first_name, last_name, phone, status, created_at')
            .eq('referral_code', currentEarnerId)
            .order('created_at', { ascending: false })
            .limit(100);
          if (refData) setReferrals(refData);
        } catch (_) {}
      }
    } catch (e) {
      console.error('Record load error:', e);
    } finally {
      setLoadingRecords(false);
    }
  };

  const handleUpdateStatus = async () => {
    const statusTable = type === 'individual' ? 'profiles' : type === 'provider' ? 'providers' : type === 'client' ? 'clients' : null;
    if (!statusTable) return;
    setUpdatingStatus(true);
    try {
      const previousStatus = data.status || 'Active';
      const nextStatus = accountStatus;
      const { error } = await supabase.from(statusTable).update({ status: nextStatus }).eq('id', id);
      if (error) throw error;
      setData({ ...data, status: nextStatus });

      if (type === 'individual') {
        const backendUrl = getApiBaseUrl();
        const notificationBody = nextStatus === 'Active'
          ? 'Your Novaira account is active again.'
          : 'Your Novaira account has been suspended. Please contact support if you believe this is a mistake.';

        fetch(`${backendUrl}/api/send-notification`, {
          method: 'POST',
          headers: getApiHeaders(),
          body: JSON.stringify({
            earner_id: data.earner_id,
            fcm_token: data.fcm_token || null,
            title: 'Account status updated',
            body: notificationBody,
            type: 'account',
          }),
        }).catch(() => {});

        setSnack({ open: true, message: `Account status updated to ${nextStatus}!`, severity: 'success' });
      } else {
        setSnack({ open: true, message: `${type} status updated!`, severity: 'success' });
      }
    } catch (e) {
      console.error(e);
      setSnack({ open: true, message: e.message, severity: 'error' });
    } finally {
      setUpdatingStatus(false);
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
        };
        const { error } = await supabase.from('profiles').update(updates).eq('id', id);
        if (error) throw error;
      } else if (type === 'bulker') {
        const updates = {
          full_name: editForm.full_name,
          email: editForm.email,
          phone: editForm.phone,
          password: editForm.password,
          account_type: editForm.account_type,
        };
        const { error } = await supabase.from('bulker_desks').update(updates).eq('id', id);
        if (error) throw error;
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

      const newBulker = activeBulkers.find((b) => b.bulker_id === targetBulker);
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
      setSnack({ open: true, message: 'Password reset link sent to user email!', severity: 'success' });
    } catch (e) {
      console.error(e);
      setSnack({ open: true, message: e.message, severity: 'error' });
    } finally {
      setSendingReset(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (type !== 'provider' && type !== 'client') return;
    const table = type === 'provider' ? 'providers' : 'clients';
    setDeletingAccount(true);
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      setDeleteAccountOpen(false);
      navigate(-1);
    } catch (e) {
      console.error(e);
      setSnack({ open: true, message: e.message || `Failed to delete ${type}.`, severity: 'error' });
    } finally {
      setDeletingAccount(false);
    }
  };

  // Balance & Financial Metrics calculation
  const computedBalance = useMemo(() => {
    const credits = transactions
      .filter((t) => t.transaction_type?.toLowerCase() === 'credit' && t.status?.toLowerCase() === 'completed')
      .reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
    const completedDebits = transactions
      .filter((t) => t.transaction_type?.toLowerCase() === 'debit' && t.status?.toLowerCase() === 'completed')
      .reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
    const pendingDebits = transactions
      .filter((t) => t.transaction_type?.toLowerCase() === 'debit' && t.status?.toLowerCase() === 'pending')
      .reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
    return credits - completedDebits - pendingDebits;
  }, [transactions]);

  const totalEarned = useMemo(() => {
    return transactions
      .filter((t) => t.transaction_type?.toLowerCase() === 'credit' && t.status?.toLowerCase() === 'completed')
      .reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
  }, [transactions]);

  const totalDebited = useMemo(() => {
    return transactions
      .filter((t) => t.transaction_type?.toLowerCase() === 'debit' && t.status?.toLowerCase() === 'completed')
      .reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
  }, [transactions]);

  const pendingDebited = useMemo(() => {
    return transactions
      .filter((t) => t.transaction_type?.toLowerCase() === 'debit' && t.status?.toLowerCase() === 'pending')
      .reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
  }, [transactions]);

  // Filtered Reviews
  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      const s = revSearch.toLowerCase();
      const matchSearch =
        !s ||
        r.apps?.app_name?.toLowerCase().includes(s) ||
        r.apps?.task_id?.toString().includes(s) ||
        r.submitted_username?.toLowerCase().includes(s);
      const matchStatus = revStatus ? r.status === revStatus : true;
      return matchSearch && matchStatus;
    });
  }, [reviews, revSearch, revStatus]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const s = txnSearch.toLowerCase();
      const matchSearch =
        !s ||
        t.transaction_id?.toLowerCase().includes(s) ||
        t.description?.toLowerCase().includes(s) ||
        t.utr_id?.toLowerCase().includes(s);
      const matchType = txnType ? t.transaction_type === txnType : true;
      return matchSearch && matchType;
    });
  }, [transactions, txnSearch, txnType]);

  // Filtered Bulker Apps
  const filteredBulkerApps = useMemo(() => {
    return bulkerApps
      .filter((app) => {
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
        if (timeB !== timeA) return timeB - timeA;
        return (Number(b.task_id) || 0) - (Number(a.task_id) || 0);
      });
  }, [bulkerApps, appSearch]);

  const handleCopyAppUsers = () => {
    if (!modalApp) return;
    const appDateStr = formatKolkataDate(modalApp.app_date);
    let text = `${modalApp.app_name}\n${appDateStr}\nAPP ID : ${modalApp.task_id}\n\n`;
    modalUsers.forEach((u) => {
      text += `${(u.submitted_username || '').toUpperCase()}\n`;
    });
    text += `\nTOTAL - ${modalUsers.length}`;
    copyToClipboard(text, 'App Users List');
  };

  const getStatusBadge = (status) => {
    const s = (status || 'Active').toLowerCase();
    if (s === 'active' || s === 'verified') {
      return (
        <Chip
          label="Active Account"
          size="small"
          icon={<Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10b981', ml: 0.8, boxShadow: '0 0 6px #10b981' }} />}
          sx={{
            height: 24,
            fontSize: '0.72rem',
            fontWeight: 800,
            bgcolor: 'rgba(16, 185, 129, 0.12)',
            color: '#10b981',
            border: '1px solid rgba(16, 185, 129, 0.3)',
          }}
        />
      );
    }
    return (
      <Chip
        label={status || 'Suspended'}
        size="small"
        icon={<Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#ef4444', ml: 0.8 }} />}
        sx={{
          height: 24,
          fontSize: '0.72rem',
          fontWeight: 800,
          bgcolor: 'rgba(239, 68, 68, 0.12)',
          color: '#ef4444',
          border: '1px solid rgba(239, 68, 68, 0.3)',
        }}
      />
    );
  };

  if (loading) {
    return (
      <Box sx={{ p: 6, textAlign: 'center' }}>
        <CircularProgress size={36} sx={{ color: 'primary.main', mb: 2 }} />
        <Typography variant="body2" color="text.secondary">
          Loading user dossier & telemetry...
        </Typography>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{ p: 6, textAlign: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>User dossier not found</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>The requested entity ID does not exist or has been removed.</Typography>
        <Button variant="outlined" onClick={() => navigate('/users')}>Return to Directory</Button>
      </Box>
    );
  }

  const primaryName = data.name || data.full_name || `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Unknown Name';
  const primaryId = data.earner_id || data.bulker_id || data.provider_id || data.client_id || data.id;
  const avatarLetter = (primaryName[0] || 'U').toUpperCase();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pb: 8 }}>
      {/* Top Navigation & Status Bar */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton
            onClick={() => navigate('/users')}
            sx={{
              borderRadius: '12px',
              bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.04)',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
              '&:hover': { bgcolor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.08)' },
            }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>

          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'primary.main', fontSize: '0.68rem' }}>
                {type} Dossier
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>•</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                ID: {primaryId}
              </Typography>
            </Box>
            <Typography variant="h5" sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 800, fontSize: { xs: '1.25rem', sm: '1.45rem' }, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {primaryName}
            </Typography>
          </Box>
        </Box>

        {/* Quick Top Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
          <Tooltip title="Copy Identifier">
            <Button
              variant="outlined"
              size="small"
              startIcon={<ContentCopyIcon sx={{ fontSize: 16 }} />}
              onClick={() => copyToClipboard(primaryId, 'Identifier')}
              sx={{ borderRadius: '12px', py: 0.7, px: 1.6, fontWeight: 750, fontSize: '0.78rem' }}
            >
              Copy ID
            </Button>
          </Tooltip>

          {type === 'individual' && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<CampaignIcon sx={{ fontSize: 16 }} />}
              onClick={() => navigate(`/push-notifications?earnerId=${data.earner_id}`)}
              sx={{ borderRadius: '12px', py: 0.7, px: 1.6, fontWeight: 750, fontSize: '0.78rem' }}
            >
              Push Alert
            </Button>
          )}

          {(type === 'individual' || type === 'provider' || type === 'client') && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <Select
                  value={accountStatus}
                  onChange={(e) => setAccountStatus(e.target.value)}
                  disabled={updatingStatus}
                  sx={{ borderRadius: '12px', height: 38, fontSize: '0.82rem', fontWeight: 700 }}
                >
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Suspended">Suspended</MenuItem>
                </Select>
              </FormControl>

              <Button
                variant="contained"
                size="small"
                startIcon={updatingStatus ? <CircularProgress size={16} color="inherit" /> : <SaveIcon sx={{ fontSize: 16 }} />}
                onClick={handleUpdateStatus}
                disabled={updatingStatus || accountStatus === (data.status || 'Active')}
                sx={{ borderRadius: '12px', height: 38, px: 2, fontWeight: 800, fontSize: '0.78rem', boxShadow: 'none' }}
              >
                {updatingStatus ? 'Updating...' : 'Save'}
              </Button>
            </Box>
          )}

          {(type === 'provider' || type === 'client') && (
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<DeleteOutlinedIcon sx={{ fontSize: 16 }} />}
              onClick={() => setDeleteAccountOpen(true)}
              sx={{ borderRadius: '12px', height: 38, px: 1.8, fontWeight: 750, fontSize: '0.78rem' }}
            >
              Delete
            </Button>
          )}
        </Box>
      </Box>

      {/* Hero Dossier Card */}
      <Card
        elevation={0}
        sx={{
          borderRadius: '24px',
          p: 3,
          bgcolor: isDark ? 'rgba(12, 17, 29, 0.7)' : 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(24px) saturate(160%)',
          WebkitBackdropFilter: 'blur(24px) saturate(160%)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.09)' : '1px solid rgba(15, 23, 42, 0.08)',
          boxShadow: isDark ? '0 16px 40px rgba(0,0,0,0.45)' : '0 12px 30px rgba(15,23,42,0.04)',
        }}
      >
        <Grid container spacing={3} alignItems="center">
          {/* Avatar and Identity */}
          <Grid item xs={12} md={5}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.2 }}>
              <Box sx={{ position: 'relative' }}>
                <Avatar
                  sx={{
                    width: 64,
                    height: 64,
                    background: type === 'bulker'
                      ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
                      : type === 'provider'
                      ? 'linear-gradient(135deg, #10b981, #06b6d4)'
                      : type === 'client'
                      ? 'linear-gradient(135deg, #8b5cf6, #3b82f6)'
                      : 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                    color: '#ffffff',
                    fontSize: '1.6rem',
                    fontWeight: 900,
                    boxShadow: '0 8px 24px rgba(6, 182, 212, 0.35)',
                  }}
                >
                  {avatarLetter}
                </Avatar>
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: data.status === 'Active' || !data.status ? '#10b981' : '#ef4444',
                    border: `2.5px solid ${isDark ? '#0c111d' : '#ffffff'}`,
                    boxShadow: '0 0 8px #10b981',
                  }}
                />
              </Box>

              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.15rem', color: 'text.primary', lineHeight: 1.2 }}>
                    {primaryName}
                  </Typography>
                  {getStatusBadge(data.status)}
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.6, flexWrap: 'wrap' }}>
                  <Chip
                    label={primaryId}
                    size="small"
                    onClick={() => copyToClipboard(primaryId, 'Identifier')}
                    icon={<ContentCopyIcon sx={{ fontSize: 12 }} />}
                    sx={{
                      height: 22,
                      fontSize: '0.72rem',
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      bgcolor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.05)',
                    }}
                  />

                  {data.email && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <EmailIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                        {data.email}
                      </Typography>
                    </Box>
                  )}

                  {data.phone && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <PhoneIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                        {data.phone}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          </Grid>

          {/* Key Metrics Pods */}
          <Grid item xs={12} md={7}>
            <Grid container spacing={1.5}>
              {type === 'individual' && (
                <Grid item xs={6} sm={3}>
                  <Box
                    sx={{
                      p: 1.8,
                      borderRadius: '16px',
                      bgcolor: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                    }}
                  >
                    <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '0.65rem', display: 'block' }}>
                      Wallet Balance
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 850, color: '#10b981', mt: 0.3, fontSize: '1.25rem' }}>
                      ₹{computedBalance.toFixed(2)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                      Disbursable funds
                    </Typography>
                  </Box>
                </Grid>
              )}

              {type === 'individual' && (
                <Grid item xs={6} sm={3}>
                  <Box
                    sx={{
                      p: 1.8,
                      borderRadius: '16px',
                      bgcolor: isDark ? 'rgba(6, 182, 212, 0.08)' : 'rgba(6, 182, 212, 0.06)',
                      border: '1px solid rgba(6, 182, 212, 0.22)',
                    }}
                  >
                    <Typography variant="caption" sx={{ color: '#06b6d4', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '0.65rem', display: 'block' }}>
                      Bulker Desk
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary', mt: 0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {data.bulker_name || 'Direct / None'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {data.bulker_id || 'Independent'}
                    </Typography>
                  </Box>
                </Grid>
              )}

              {type === 'individual' && (
                <Grid item xs={6} sm={3}>
                  <Box
                    sx={{
                      p: 1.8,
                      borderRadius: '16px',
                      bgcolor: isDark ? 'rgba(139, 92, 246, 0.08)' : 'rgba(139, 92, 246, 0.06)',
                      border: '1px solid rgba(139, 92, 246, 0.22)',
                    }}
                  >
                    <Typography variant="caption" sx={{ color: '#8b5cf6', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '0.65rem', display: 'block' }}>
                      Referral Network
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary', mt: 0.3 }}>
                      {referrals.length} Referrals
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Code: {data.referral_code || 'None'}
                    </Typography>
                  </Box>
                </Grid>
              )}

              <Grid item xs={6} sm={type === 'individual' ? 3 : 6}>
                <Box
                  sx={{
                    p: 1.8,
                    borderRadius: '16px',
                    bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.03)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(15, 23, 42, 0.06)',
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '0.65rem', display: 'block' }}>
                    Activity Radar
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.3 }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: data.last_active_at ? '#10b981' : 'text.disabled' }} />
                    <Typography variant="body2" sx={{ fontWeight: 750, color: data.last_active_at ? '#10b981' : 'text.secondary', fontSize: '0.8rem' }}>
                      {data.last_active_at ? timeAgo(data.last_active_at) : 'Never'}
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', display: 'block' }}>
                    Joined {formatKolkataDate(data.created_at)}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Card>

      {/* Tabs Suite */}
      <Card
        elevation={0}
        sx={{
          borderRadius: '24px',
          overflow: 'hidden',
          bgcolor: isDark ? 'rgba(12, 17, 29, 0.65)' : 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
        }}
      >
        <Box
          sx={{
            px: 2.5,
            pt: 1.5,
            borderBottom: `1px solid ${theme.palette.divider}`,
            bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(15, 23, 42, 0.015)',
          }}
        >
          <Tabs
            value={tabValue}
            onChange={(e, v) => setTabValue(v)}
            textColor="primary"
            indicatorColor="primary"
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                fontWeight: 750,
                fontSize: '0.88rem',
                textTransform: 'none',
                minHeight: '48px',
                px: 2.5,
              },
            }}
          >
            <Tab
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>{type === 'bulker' ? 'Assigned Tasks' : 'Task Submissions'}</span>
                  <Chip label={reviews.length} size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800 }} />
                </Box>
              }
            />
            <Tab
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>Wallet & Financial Ledger</span>
                  <Chip label={transactions.length} size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800 }} />
                </Box>
              }
              sx={{ display: type === 'individual' || type === 'bulker' ? 'flex' : 'none' }}
            />
            <Tab label="Monthly Invoice" sx={{ display: type === 'bulker' ? 'flex' : 'none' }} />
            <Tab label="Settings & Security" />
            <Tab
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>{type === 'bulker' ? 'Assigned Earners' : 'Referral Network'}</span>
                  <Chip label={referrals.length} size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800 }} />
                </Box>
              }
              sx={{ display: type === 'individual' || type === 'bulker' ? 'flex' : 'none' }}
            />
          </Tabs>
        </Box>

        <Box sx={{ p: { xs: 2.5, md: 3.5 } }}>
          {/* TAB 0: Reviews & Submissions */}
          <TabPanel value={tabValue} index={0}>
            {loadingRecords ? (
              <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={28} /></Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Search & Filter Bar */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
                  <TextField
                    size="small"
                    placeholder="Search Task ID, App, or Username..."
                    value={revSearch}
                    onChange={(e) => { setRevSearch(e.target.value); setRevPage(0); }}
                    sx={{ flexGrow: 1, minWidth: 240, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                  />
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Status</InputLabel>
                    <Select label="Status" value={revStatus} onChange={(e) => setRevStatus(e.target.value)} sx={{ borderRadius: '12px' }}>
                      <MenuItem value="">All Statuses</MenuItem>
                      <MenuItem value="Under Review">Under Review</MenuItem>
                      <MenuItem value="Approved">Approved</MenuItem>
                      <MenuItem value="Rejected">Rejected</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                {filteredReviews.length === 0 ? (
                  <Box sx={{ p: 6, textAlign: 'center', border: `1px dashed ${theme.palette.divider}`, borderRadius: '18px' }}>
                    <RateReviewIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1, opacity: 0.5 }} />
                    <Typography variant="body2" color="text.secondary">No review submissions found.</Typography>
                  </Box>
                ) : (
                  <TableContainer sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: '18px', overflow: 'hidden' }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.03)' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Task ID</TableCell>
                          <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Application Name</TableCell>
                          <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Submitted Handle</TableCell>
                          <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Date & Time</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Audit Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredReviews.slice(revPage * revRowsPerPage, revPage * revRowsPerPage + revRowsPerPage).map((rev) => (
                          <TableRow key={rev.id} hover>
                            <TableCell sx={{ color: 'primary.main', fontWeight: 800, fontFamily: 'monospace' }}>
                              #{rev.apps?.task_id || rev.app_id}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>{rev.apps?.app_name || 'Application Task'}</TableCell>
                            <TableCell>{rev.submitted_username || 'N/A'}</TableCell>
                            <TableCell>{formatKolkataDate(rev.submitted_at)}</TableCell>
                            <TableCell align="center">
                              <Chip
                                label={rev.status || 'Under Review'}
                                size="small"
                                color={rev.status === 'Approved' ? 'success' : rev.status === 'Rejected' ? 'error' : 'warning'}
                                sx={{ height: 22, fontSize: '0.68rem', fontWeight: 800, borderRadius: '6px' }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <TablePagination
                      component="div"
                      count={filteredReviews.length}
                      page={revPage}
                      onPageChange={(e, p) => setRevPage(p)}
                      rowsPerPage={revRowsPerPage}
                      onRowsPerPageChange={(e) => { setRevRowsPerPage(parseInt(e.target.value, 10)); setRevPage(0); }}
                      rowsPerPageOptions={[10, 25, 50]}
                    />
                  </TableContainer>
                )}
              </Box>
            )}
          </TabPanel>

          {/* TAB 1: Wallet & Financial Ledger */}
          <TabPanel value={tabValue} index={1}>
            {loadingRecords ? (
              <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={28} /></Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* 4 Frosted Financial Summary Cards */}
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ p: 2.2, borderRadius: '18px', bgcolor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
                      <Typography variant="caption" sx={{ color: '#3b82f6', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '0.68rem', display: 'block' }}>
                        Current Balance
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: '#3b82f6', mt: 0.5 }}>
                        ₹{computedBalance.toFixed(2)}
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ p: 2.2, borderRadius: '18px', bgcolor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                      <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '0.68rem', display: 'block' }}>
                        Pending Withdrawal
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: '#f59e0b', mt: 0.5 }}>
                        ₹{pendingDebited.toFixed(2)}
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ p: 2.2, borderRadius: '18px', bgcolor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                      <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '0.68rem', display: 'block' }}>
                        Total Lifetime Earned
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: '#10b981', mt: 0.5 }}>
                        ₹{totalEarned.toFixed(2)}
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ p: 2.2, borderRadius: '18px', bgcolor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                      <Typography variant="caption" sx={{ color: '#ef4444', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '0.68rem', display: 'block' }}>
                        Total Paid Out
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: '#ef4444', mt: 0.5 }}>
                        ₹{totalDebited.toFixed(2)}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                {/* Filter & Search Bar */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
                  <TextField
                    size="small"
                    placeholder="Search Transaction ID, Description, UTR..."
                    value={txnSearch}
                    onChange={(e) => { setTxnSearch(e.target.value); setTxnPage(0); }}
                    sx={{ flexGrow: 1, minWidth: 260, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                  />
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <Select value={txnType} onChange={(e) => setTxnType(e.target.value)} displayEmpty sx={{ borderRadius: '12px' }}>
                      <MenuItem value="">All Transaction Types</MenuItem>
                      <MenuItem value="Credit">Credit (Income)</MenuItem>
                      <MenuItem value="Debit">Debit (Withdrawal)</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                {/* Glass Ledger Table */}
                {filteredTransactions.length === 0 ? (
                  <Box sx={{ p: 6, textAlign: 'center', border: `1px dashed ${theme.palette.divider}`, borderRadius: '18px' }}>
                    <AccountBalanceWalletIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1, opacity: 0.5 }} />
                    <Typography variant="body2" color="text.secondary">No wallet transactions match your criteria.</Typography>
                  </Box>
                ) : (
                  <TableContainer sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: '18px', overflow: 'hidden' }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.03)' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Date & Time</TableCell>
                          <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Transaction ID</TableCell>
                          <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Description / Reason</TableCell>
                          <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Type</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Amount</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredTransactions.slice(txnPage * txnRowsPerPage, txnPage * txnRowsPerPage + txnRowsPerPage).map((txn) => (
                          <TableRow key={txn.id} hover>
                            <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                              {formatKolkataDate(txn.created_at, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary' }}>
                              {txn.transaction_id}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 650, fontSize: '0.82rem' }}>
                              {txn.description || 'Wallet balance adjustment'}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={txn.transaction_type}
                                size="small"
                                color={txn.transaction_type === 'Credit' ? 'success' : 'error'}
                                sx={{ height: 22, fontSize: '0.68rem', fontWeight: 800, borderRadius: '6px' }}
                              />
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 850, fontSize: '0.9rem', color: txn.transaction_type === 'Credit' ? 'success.main' : 'error.main' }}>
                              {txn.transaction_type === 'Credit' ? '+' : '-'}₹{parseFloat(txn.amount).toFixed(2)}
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={txn.status || 'Completed'}
                                size="small"
                                color={txn.status === 'Completed' ? 'success' : txn.status === 'Pending' ? 'warning' : 'error'}
                                variant="outlined"
                                sx={{ height: 22, fontSize: '0.68rem', fontWeight: 800, borderRadius: '6px' }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <TablePagination
                      component="div"
                      count={filteredTransactions.length}
                      page={txnPage}
                      onPageChange={(e, p) => setTxnPage(p)}
                      rowsPerPage={txnRowsPerPage}
                      onRowsPerPageChange={(e) => { setTxnRowsPerPage(parseInt(e.target.value, 10)); setTxnPage(0); }}
                      rowsPerPageOptions={[10, 25, 50]}
                    />
                  </TableContainer>
                )}
              </Box>
            )}
          </TabPanel>

          {/* TAB 2: Bulker Monthly Invoice */}
          <TabPanel value={tabValue} index={2}>
            {type !== 'bulker' ? (
              <Box sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">Only available for bulker partner accounts.</Typography></Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>Bulker Monthly Ledger Invoicing</Typography>
                <TableContainer sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: '18px' }}>
                  <Table>
                    <TableHead sx={{ bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.03)' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 800 }}>App Name</TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>Task ID</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800 }}>Approved Users</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800 }}>Unit Rate</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800 }}>Subtotal</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredBulkerApps.map((app) => {
                        const appReviews = reviews.filter((r) => r.apps?.task_id === app.task_id);
                        const liveCount = appReviews.filter((r) => r.status === 'Approved' || r.status === 'Live').length;
                        return (
                          <TableRow key={app.id} hover>
                            <TableCell sx={{ fontWeight: 700 }}>{app.app_name}</TableCell>
                            <TableCell sx={{ color: 'primary.main', fontWeight: 800 }}>#{app.task_id}</TableCell>
                            <TableCell align="center">
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => handleOpenModal(app, appReviews)}
                                sx={{ borderRadius: '10px', fontWeight: 800, fontSize: '0.72rem' }}
                              >
                                {appReviews.length} Users
                              </Button>
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>₹10.00</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 850 }}>₹{(liveCount * 10).toFixed(2)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </TabPanel>

          {/* TAB 3: Settings & Security */}
          <TabPanel value={tabValue} index={3}>
            {type === 'individual' ? (
              <Grid container spacing={3} alignItems="stretch">
                {/* Left Panel: Profile Info */}
                <Grid item xs={12} md={6}>
                  <Card
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: '20px',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(15, 23, 42, 0.02)',
                      border: `1px solid ${theme.palette.divider}`,
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.5 }}>
                        Update Personal Details
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2.5 }}>
                        Modify user legal names and mobile contact details
                      </Typography>

                      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label="First Name"
                          value={editForm.first_name}
                          onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                        />
                        <TextField
                          fullWidth
                          size="small"
                          label="Last Name"
                          value={editForm.last_name}
                          onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                        />
                      </Box>

                      <TextField
                        fullWidth
                        size="small"
                        label="Registered Phone Number"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        sx={{ mb: 2.5, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                      />
                    </Box>

                    <Button
                      variant="contained"
                      startIcon={savingProfile ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                      onClick={handleUpdateProfile}
                      disabled={savingProfile}
                      sx={{ borderRadius: '12px', py: 1, fontWeight: 800, boxShadow: 'none' }}
                    >
                      {savingProfile ? 'Saving...' : 'Save Profile Changes'}
                    </Button>
                  </Card>
                </Grid>

                {/* Right Panel: Bulker Transfer & Security */}
                <Grid item xs={12} md={6}>
                  <Card
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: '20px',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(15, 23, 42, 0.02)',
                      border: `1px solid ${theme.palette.divider}`,
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.5 }}>
                        Desk Transfer & Security
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2.5 }}>
                        Re-assign to another partner desk or send authentication reset
                      </Typography>

                      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                        <InputLabel>Target Bulker Desk</InputLabel>
                        <Select
                          label="Target Bulker Desk"
                          value={targetBulker}
                          onChange={(e) => setTargetBulker(e.target.value)}
                          sx={{ borderRadius: '12px' }}
                        >
                          <MenuItem value="">Independent / No Bulker</MenuItem>
                          {activeBulkers.map((b) => (
                            <MenuItem key={b.bulker_id} value={b.bulker_id}>
                              {b.full_name} ({b.bulker_id})
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={transferring ? <CircularProgress size={16} /> : <SwapHorizIcon />}
                        onClick={handleTransferBulker}
                        disabled={transferring || targetBulker === data.bulker_id}
                        sx={{ borderRadius: '12px', mb: 3, py: 0.8, fontWeight: 750 }}
                      >
                        {transferring ? 'Transferring...' : 'Transfer to Selected Bulker'}
                      </Button>

                      <Divider sx={{ my: 2 }} />

                      <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                        Account Credentials
                      </Typography>
                      <Button
                        fullWidth
                        variant="outlined"
                        color="error"
                        startIcon={sendingReset ? <CircularProgress size={16} /> : <LockResetIcon />}
                        onClick={handleResetPassword}
                        disabled={sendingReset}
                        sx={{ borderRadius: '12px', py: 0.8, fontWeight: 750 }}
                      >
                        {sendingReset ? 'Sending...' : 'Send Password Reset Link'}
                      </Button>
                    </Box>
                  </Card>
                </Grid>
              </Grid>
            ) : type === 'bulker' ? (
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card elevation={0} sx={{ p: 3, borderRadius: '20px', border: `1px solid ${theme.palette.divider}` }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>Update Bulker Details</Typography>
                    <TextField fullWidth size="small" label="Full Name" value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} sx={{ mb: 2 }} />
                    <TextField fullWidth size="small" label="Email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} sx={{ mb: 2 }} />
                    <TextField fullWidth size="small" label="Phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} sx={{ mb: 2 }} />
                    <Button variant="contained" onClick={handleUpdateProfile} disabled={savingProfile} sx={{ borderRadius: '12px', fontWeight: 800 }}>Save Changes</Button>
                  </Card>
                </Grid>
              </Grid>
            ) : (
              <Box sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">Settings not available for this entity type.</Typography></Box>
            )}
          </TabPanel>

          {/* TAB 4: Referral Network */}
          <TabPanel value={tabValue} index={4}>
            {referrals.length === 0 ? (
              <Box sx={{ p: 6, textAlign: 'center', border: `1px dashed ${theme.palette.divider}`, borderRadius: '18px' }}>
                <ShareIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1, opacity: 0.5 }} />
                <Typography variant="body2" color="text.secondary">
                  {type === 'bulker' ? 'No users onboarded under this bulker yet.' : 'No users have registered with this referral code yet.'}
                </Typography>
              </Box>
            ) : (
              <TableContainer sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: '18px', overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.03)' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Earner Name</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Earner ID</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Phone Contact</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Registration Date</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Account Status</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Inspect</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {referrals.slice(refPage * refRowsPerPage, refPage * refRowsPerPage + refRowsPerPage).map((ref) => (
                      <TableRow key={ref.id} hover>
                        <TableCell sx={{ fontWeight: 750 }}>{ref.first_name || ''} {ref.last_name || ''}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: 'primary.main' }}>{ref.earner_id}</TableCell>
                        <TableCell>{ref.phone || 'N/A'}</TableCell>
                        <TableCell>{formatKolkataDate(ref.created_at)}</TableCell>
                        <TableCell align="center">{getStatusBadge(ref.status)}</TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => window.open(`#/user-view/individual/${ref.id}`, '_blank')}
                            sx={{ borderRadius: '10px', fontSize: '0.72rem', fontWeight: 800 }}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination
                  component="div"
                  count={referrals.length}
                  page={refPage}
                  onPageChange={(e, p) => setRefPage(p)}
                  rowsPerPage={refRowsPerPage}
                  onRowsPerPageChange={(e) => { setRefRowsPerPage(parseInt(e.target.value, 10)); setRefPage(0); }}
                  rowsPerPageOptions={[10, 25, 50]}
                />
              </TableContainer>
            )}
          </TabPanel>
        </Box>
      </Card>

      {/* Bulker App Completed Reviews Modal */}
      <Dialog
        open={modalOpen}
        onClose={handleCloseModal}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: '24px', p: 1 } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2.5 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Audit List: {modalApp?.app_name}</Typography>
            <Typography variant="caption" color="text.secondary">Task #{modalApp?.task_id} • Total completed: {modalUsers.length}</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" variant="outlined" startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />} onClick={handleCopyAppUsers} sx={{ borderRadius: '10px' }}>
              Copy User Handles
            </Button>
            <IconButton size="small" onClick={handleCloseModal}><CloseIcon fontSize="small" /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <TableContainer sx={{ maxHeight: 420 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>Earner Profile</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Submitted Handle</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Date</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {modalUsers.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{u.earner_name}</Typography>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>{u.earner_id}</Typography>
                    </TableCell>
                    <TableCell>{u.submitted_username}</TableCell>
                    <TableCell>{formatKolkataDate(u.submitted_at)}</TableCell>
                    <TableCell align="center">
                      <Chip label={u.status} size="small" color={u.status === 'Approved' ? 'success' : 'default'} sx={{ height: 20, fontSize: '0.68rem', fontWeight: 800 }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseModal} variant="contained" sx={{ borderRadius: '12px', fontWeight: 750 }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Modal for Provider/Client */}
      <Dialog
        open={deleteAccountOpen}
        onClose={() => !deletingAccount && setDeleteAccountOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '20px' } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Delete {type} permanently?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This permanently removes <strong>{primaryName}</strong> from the database. This action is irreversible.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, gap: 1 }}>
          <Button variant="outlined" onClick={() => setDeleteAccountOpen(false)} disabled={deletingAccount}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteAccount} disabled={deletingAccount}>
            {deletingAccount ? 'Deleting...' : 'Confirm Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast Feedback */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} sx={{ borderRadius: '12px', fontWeight: 700 }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
