import { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, TextField, Button, Grid, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Checkbox, Chip, IconButton, useTheme, Snackbar, Alert, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Autocomplete
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonIcon from '@mui/icons-material/Person';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import Swal from 'sweetalert2';
import { supabase } from '../supabaseClient';

export default function LiveListManagement() {
  const theme = useTheme();
  const [taskIdInput, setTaskIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [appDetails, setAppDetails] = useState(null);
  const [members, setMembers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  // Date formatter for Asia/Kolkata
  const formatKolkataDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' });
  };

  const fetchAppDetails = async (e) => {
    e.preventDefault();
    if (!taskIdInput.trim()) return;
    setLoading(true);
    try {
      // Clean task input to extract integer if they type something like #123 or TASK123
      const cleanedTaskId = taskIdInput.replace(/\D/g, '');
      if (!cleanedTaskId) throw new Error("Please enter a valid numeric Task ID");

      // 1. Fetch App details using task_id
      const { data: appData, error: appErr } = await supabase
        .from('apps')
        .select('*')
        .eq('task_id', parseInt(cleanedTaskId, 10))
        .single();

      if (appErr || !appData) throw new Error("App / Task ID not found in database.");

      // Format bulkers string
      const assignedBulkers = (appData.assigned_bulkers || []).map(b => b.bulker_id).join(', ') || 'None';

      setAppDetails({
        id: appData.id,
        taskId: appData.task_id,
        name: appData.app_name,
        provider: appData.sponsor_type === 'Providers' ? appData.sponsor_id : (appData.sponsor_type || 'Unknown'),
        memberReward: `Rs. ${appData.members_reward || 0}`,
        rawMemberReward: appData.members_reward || 0,
        sponsorReward: `Rs. ${appData.sponsor_amount || 0}`,
        taskType: appData.task_type || 'N/A',
        commentLimit: appData.comment_limit || 0,
        appDate: formatKolkataDate(appData.app_date),
        liveCheckingDate: formatKolkataDate(appData.live_checking_date),
        bulkers: assignedBulkers,
        assignedBulkersList: appData.assigned_bulkers || []
      });

      // 2. Fetch submitted reviews for this app
      const { data: revData, error: revErr } = await supabase
        .from('review_submit_data')
        .select('*')
        .eq('app_id', appData.id)
        .order('submitted_at', { ascending: true });

      if (revErr) throw revErr;
      
      let finalMembers = revData || [];

      // 3. Fetch Earner Names from profiles and Bulker Names from bulker_desks
      if (finalMembers.length > 0) {
        const earnerIds = [...new Set(finalMembers.map(m => m.earner_id))];

        const [profilesRes, bulkersRes] = await Promise.all([
          supabase.from('profiles').select('earner_id, first_name, last_name').in('earner_id', earnerIds),
          supabase.from('bulker_desks').select('bulker_id, full_name') // Fetch all to avoid prefix mismatch issues
        ]);
          
        const nameMap = {};
        if (!profilesRes.error && profilesRes.data) {
          profilesRes.data.forEach(p => {
            nameMap[p.earner_id] = `${p.first_name || ''} ${p.last_name || ''}`.trim();
          });
        }
        
        finalMembers = finalMembers.map(m => {
          const eName = nameMap[m.earner_id] || 'Unknown';
          const eShortId = m.earner_id ? m.earner_id.split('/').pop() : '';
          
          // Intelligent Bulker Matching (handles with or without NOVAIRA/BULKER/ prefix)
          const mShortBulker = m.bulker_id ? m.bulker_id.split('/').pop() : '';
          let bName = 'Unknown';
          if (!bulkersRes.error && bulkersRes.data) {
            const bMatch = bulkersRes.data.find(b => {
               const dbShort = b.bulker_id ? b.bulker_id.split('/').pop() : '';
               return dbShort === mShortBulker;
            });
            if (bMatch) bName = bMatch.full_name;
          }

          return {
            ...m,
            formatted_earner: `${eName} (${eShortId})`,
            formatted_bulker: `${bName} (${mShortBulker})`
          };
        });
      }

      setMembers(finalMembers);
      // Select only those who are already Live
      setSelectedIds(finalMembers.filter(r => r.status === 'Live').map(r => r.id));

      setSnack({ open: true, message: 'App and submissions loaded!', severity: 'success' });
    } catch (error) {
      setAppDetails(null);
      setMembers([]);
      setSnack({ open: true, message: error.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members.filter(m => 
    m.submitted_username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.formatted_earner.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.formatted_bulker.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.earner_id && m.earner_id.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const filteredIds = filteredMembers.map(m => m.id);
      setSelectedIds(prev => [...new Set([...prev, ...filteredIds])]);
    } else {
      const filteredIds = filteredMembers.map(m => m.id);
      setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
    }
  };

  const handleSelectOne = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(i => i !== id));
    } else {
      setSelectedIds(prev => [...prev, id]);
    }
  };

  const handleZeroLive = async () => {
    const result = await Swal.fire({
      title: 'Zero Live?',
      text: "Mark all pending submissions for this task as Not Live/Rejected?",
      icon: 'warning',
      showCancelButton: true,
      buttonsStyling: false,
      background: theme.palette.mode === 'dark' ? '#2b2930' : '#ece6f0',
      color: theme.palette.text.primary,
      confirmButtonText: 'Yes, Zero Live',
      cancelButtonText: 'Cancel',
      customClass: { 
        popup: 'm3-swal-popup my-swal-font',
        title: 'm3-swal-title',
        htmlContainer: 'm3-swal-content',
        actions: 'm3-swal-actions',
        confirmButton: 'm3-swal-btn m3-swal-confirm-danger',
        cancelButton: 'm3-swal-btn m3-swal-cancel'
      },
      showClass: { popup: 'animate__animated animate__fadeInUp animate__faster' },
      hideClass: { popup: 'animate__animated animate__fadeOutDown animate__faster' },
      backdrop: `rgba(0,0,0,0.5)`
    });

    if (!result.isConfirmed) return;
    
    try {
        setSaving(true);
        // 1. Mark all members as Not Live for this app
        const { error: updateErr } = await supabase
          .from('review_submit_data')
          .update({ status: 'Not Live' })
          .eq('app_id', appDetails.id);

        if (updateErr) throw updateErr;

        // 2. Delete ALL wallet transactions (earner, bulker, and referral rewards) for this app
        const { error: delErr } = await supabase
          .from('individual_wallet_transactions')
          .delete()
          .eq('app_id', appDetails.id);

        if (delErr) console.warn("Failed to delete wallet transactions on Zero Live", delErr);

        setSnack({ open: true, message: 'Zero Live applied. All members marked as Not Live and rewards reverted.', severity: 'success' });
        
        // Form Reset
        setAppDetails(null);
        setMembers([]);
        setSelectedIds([]);
        setTaskIdInput('');
      } catch (err) {
        setSnack({ open: true, message: 'Error applying Zero Live: ' + err.message, severity: 'error' });
      } finally {
        setSaving(false);
      }
  };

  const handleSaveLiveList = async () => {
    if (!appDetails) return;

    setSaving(true);
    try {
      const toMarkLive = members.filter(m => selectedIds.includes(m.id) && m.status !== 'Live');
      const toMarkNotLive = members.filter(m => !selectedIds.includes(m.id) && m.status === 'Live');

      console.log('selectedIds', selectedIds);
      console.log('members', members);
      console.log('toMarkLive', toMarkLive);
      console.log('toMarkNotLive', toMarkNotLive);

      if (toMarkLive.length === 0 && toMarkNotLive.length === 0) {
        setSnack({ open: true, message: 'No changes to save.', type: 'info' });
        setSaving(false);
        return;
      }

      // 1. Process members newly marked as Live
      if (toMarkLive.length > 0) {
        // Update review_submit_data
        const { error: updateErr } = await supabase
          .from('review_submit_data')
          .update({ status: 'Live' })
          .in('id', toMarkLive.map(m => m.id));

        if (updateErr) throw updateErr;

        // Generate transactions and insert to wallet
        const generateTrxId = () => {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let result = '';
          for (let i = 0; i < 16; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return result;
        };

        const normalizeId = (value) => String(value ?? '').trim();

        // We need to fetch profiles for ALL currently selected earners, not just the newly marked ones.
        // Because if the referred user was saved previously, and the referrer is saved now,
        // we need to check both!
        const allSelectedEarnersArr = members
          .filter(m => selectedIds.includes(m.id))
          .map(m => normalizeId(m.earner_id))
          .filter(Boolean);
          
        const allSelectedEarners = new Set(allSelectedEarnersArr);

        const { data: liveProfiles = [], error: profileErr } = await supabase
          .from('profiles')
          .select('earner_id, referral_code')
          .in('earner_id', allSelectedEarnersArr);

        if (profileErr) console.warn('Failed to fetch referral references.', profileErr);

        // Fetch Bulker profiles to check account_type
        const bulkerIdsForTxn = [...new Set(toMarkLive.map(m => m.bulker_id).filter(Boolean))];
        // Clean bulker IDs just in case they have NOVAIRA/BULKER/
        const fullBulkerIds = bulkerIdsForTxn.map(id => id.includes('NOVAIRA/BULKER/') ? id : `NOVAIRA/BULKER/${id}`);
        
        const { data: bulkerProfiles = [], error: bulkerErr } = await supabase
          .from('bulker_desks')
          .select('bulker_id')
          .in('bulker_id', fullBulkerIds);
        
        if (bulkerErr) console.warn('Failed to fetch bulker profiles.', bulkerErr);
        const profileByBulker = Object.fromEntries((bulkerProfiles || []).map(b => [b.bulker_id, b]));


        // SAFEGUARD: Fetch existing transactions for this app to avoid duplicate rewards and referral bonuses
        const { data: existingTxns } = await supabase
          .from('individual_wallet_transactions')
          .select('earner_id, description')
          .eq('app_id', appDetails.id);

        const existingDescriptions = new Set((existingTxns || []).map(t => t.description));
        const existingEarnersReward = new Set((existingTxns || [])
            .filter(t => t.description && t.description.startsWith('Reward for Task ID'))
            .map(t => t.earner_id)
        );

        const profileByEarner = Object.fromEntries((liveProfiles || []).map(profile => [normalizeId(profile.earner_id), profile]));
        const walletTransactions = [];
          const primaryNotifications = [];

        // 1. Give REWARDS to newly marked Live earners
        toMarkLive.forEach(m => {
          const normalizedEarnerId = normalizeId(m.earner_id);
          const earnerProfile = profileByEarner[normalizedEarnerId];
          const isWalletSystem = true; // Removed missing column check

          // Safeguard: Only add reward if it does not already exist AND earner is Wallet System
          if (isWalletSystem && !existingEarnersReward.has(normalizedEarnerId)) {
            walletTransactions.push({
              transaction_id: generateTrxId(),
              earner_id: normalizedEarnerId,
              app_id: appDetails.id,
              amount: appDetails.rawMemberReward,
              transaction_type: 'Credit',
              description: `Reward for Task ID ${appDetails.taskId}: ${appDetails.name}`,
              status: 'Completed'
            });

            primaryNotifications.push({
              earner_id: normalizedEarnerId,
              title: 'Wallet Credited',
              body: `You received Rs. ${appDetails.rawMemberReward} for completing ${appDetails.name}.`,
              type: 'wallet'
            });
          }

          // 1.5 Give REWARDS to Bulker if Wallet System
          const bulkerId = m.bulker_id;
          if (bulkerId) {
            const fullBulkerId = bulkerId.includes('NOVAIRA/BULKER/') ? bulkerId : `NOVAIRA/BULKER/${bulkerId}`;
            const bulkerProfile = profileByBulker[fullBulkerId];
            if (bulkerProfile) {
                const bulkerDesc = `Bulker Reward for Task ID ${appDetails.taskId}: ${appDetails.name} (${normalizedEarnerId})`;
                if (!existingDescriptions.has(bulkerDesc)) {
                    // Extract rate from app assigned_bulkers
                    const assignedList = appDetails.assignedBulkersList || [];
                    const bulkerRateObj = assignedList.find(b => b.bulker_id === fullBulkerId || b.bulker_id === bulkerId);
                    const bulkerRate = bulkerRateObj ? Number(bulkerRateObj.amount || 0) : 0;
                    
                    if (bulkerRate > 0) {
                        walletTransactions.push({
                          transaction_id: generateTrxId(),
                          earner_id: fullBulkerId,
                          app_id: appDetails.id,
                          amount: bulkerRate,
                          transaction_type: 'Credit',
                          description: bulkerDesc,
                          status: 'Completed'
                        });
                        existingDescriptions.add(bulkerDesc);
                    }
                }
            }
          }
        });

        // 2. Give REFERRAL BONUSES by checking ALL currently selected earners
        allSelectedEarners.forEach(normalizedEarnerId => {
          const profile = profileByEarner[normalizedEarnerId];
          const referrerId = normalizeId(profile?.referral_code);

          const isReferralEligible = (
            referrerId &&
            referrerId !== '' &&
            referrerId !== normalizedEarnerId &&
            allSelectedEarners.has(normalizedEarnerId) &&
            allSelectedEarners.has(referrerId)
          );

          if (isReferralEligible) {
            const referrerProfile = profileByEarner[referrerId];
            if (referrerProfile) {
                const refDesc = `Referral bonus for inviting ${normalizedEarnerId}`;
                // Safeguard: Only add referral bonus if it does not already exist
                if (!existingDescriptions.has(refDesc)) {
                  walletTransactions.push({
                    transaction_id: generateTrxId(),
                    earner_id: referrerId,
                    app_id: appDetails.id,
                    amount: 0.60,
                    transaction_type: 'Credit',
                    description: refDesc,
                    status: 'Completed'
                  });
                }
            }
          }
        });

        if (walletTransactions.length > 0) {
          const { error: walletErr } = await supabase.from('individual_wallet_transactions').insert(walletTransactions);
          console.log('walletTransactions being inserted:', walletTransactions);
          if (walletErr) {
              console.error("Failed to insert wallet transactions.", walletErr);
              throw walletErr; // throw it so it triggers the snackbar error in the UI
            }
            
            if (primaryNotifications && primaryNotifications.length > 0) {
              const baseUrl = import.meta.env.DEV ? 'http://localhost:5000' : 'https://admin-v2-backend.onrender.com';
              Promise.all(primaryNotifications.map(notif => 
                fetch(`${baseUrl}/api/send-notification`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(notif)
                }).catch(e => console.warn(e))
              )).catch(err => console.error('Push Notification Error:', err));
            }
        }
      }

      // 2. Process members marked as Not Live (unchecked)
      if (toMarkNotLive.length > 0) {
        // Update review_submit_data to 'Not Live'
        const { error: revertErr } = await supabase
          .from('review_submit_data')
          .update({ status: 'Not Live' })
          .in('id', toMarkNotLive.map(m => m.id));

        if (revertErr) throw revertErr;

        const revertEarnerIds = toMarkNotLive.map(m => m.earner_id);
        const revertDescriptions = revertEarnerIds.map(id => `Referral bonus for inviting ${id}`);

        // Delete their personal reward transactions for this app
        const { error: delWalletErr } = await supabase
          .from('individual_wallet_transactions')
          .delete()
          .eq('app_id', appDetails.id)
          .in('earner_id', revertEarnerIds);
          
        if (delWalletErr) console.warn("Failed to delete wallet transactions.", delWalletErr);

        // Delete the referral bonus given to their referrer for this app
          const { error: delRefErr } = await supabase
            .from('individual_wallet_transactions')
            .delete()
            .eq('app_id', appDetails.id)
            .in('description', revertDescriptions);
            
          if (delRefErr) console.warn("Failed to delete referral bonuses.", delRefErr);

          // Delete the bulker bonus for these earners
          const revertBulkerDescriptions = revertEarnerIds.map(id => `Bulker Reward for Task ID ${appDetails.taskId}: ${appDetails.name} (${id})`);
          const { error: delBulkerErr } = await supabase
            .from('individual_wallet_transactions')
            .delete()
            .eq('app_id', appDetails.id)
            .in('description', revertBulkerDescriptions);
          
          if (delBulkerErr) console.warn("Failed to delete bulker rewards.", delBulkerErr);

      }

      Swal.fire({
        title: 'Success',
        text: `Live List synced: ${toMarkLive.length} added, ${toMarkNotLive.length} marked Not Live.`,
        icon: 'success',
        confirmButtonText: 'Done',
        buttonsStyling: false,
        background: theme.palette.mode === 'dark' ? '#2b2930' : '#ece6f0',
        color: theme.palette.text.primary,
        customClass: {
          popup: 'm3-swal-popup my-swal-font',
          title: 'm3-swal-title',
          htmlContainer: 'm3-swal-content',
          actions: 'm3-swal-actions',
          confirmButton: 'm3-swal-btn m3-swal-confirm'
        },
        showClass: { popup: 'animate__animated animate__fadeInUp animate__faster' },
        hideClass: { popup: 'animate__animated animate__fadeOutDown animate__faster' },
        backdrop: `rgba(0,0,0,0.5)`
      });

      // Form Reset
      setAppDetails(null);
      setMembers([]);
      setSelectedIds([]);
      setTaskIdInput('');

    } catch (error) {
      console.error(error);
      setSnack({ open: true, message: 'Error syncing Live List: ' + error.message, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };
  const [addMissingOpen, setAddMissingOpen] = useState(false);
  const [missingData, setMissingData] = useState({ username: '', earnerId: '', bulkerId: '' });
  const [addingMissing, setAddingMissing] = useState(false);

  // States for Autocomplete options
  const [allEarners, setAllEarners] = useState([]);
  const [allBulkers, setAllBulkers] = useState([]);
  const [fetchingOptions, setFetchingOptions] = useState(false);

  useEffect(() => {
    if (addMissingOpen) {
      const fetchOptions = async () => {
        setFetchingOptions(true);
        try {
          const [profRes, bulkRes] = await Promise.all([
            supabase.from('profiles').select('earner_id, first_name, last_name'),
            supabase.from('bulker_desks').select('bulker_id, full_name')
          ]);
          if (!profRes.error) setAllEarners(profRes.data || []);
          if (!bulkRes.error) setAllBulkers(bulkRes.data || []);
        } catch (error) {
          console.error("Error fetching dropdown options", error);
        } finally {
          setFetchingOptions(false);
        }
      };
      fetchOptions();
    }
  }, [addMissingOpen]);

  const submitAddMissing = async () => {
    if (!missingData.username || !missingData.earnerId || !missingData.bulkerId) {
      setSnack({ open: true, message: 'Please fill all fields', severity: 'warning' });
      return;
    }
    setAddingMissing(true);
    try {
      // 1. Get an available comment for this app
      const { data: comments, error: comErr } = await supabase
        .from('app_comments')
        .select('id')
        .eq('app_id', appDetails.id)
        .eq('status', 'active')
        .limit(1);

      if (comErr) throw comErr;
      if (!comments || comments.length === 0) {
        throw new Error("No available active comments found for this app. Cannot assign a missing member.");
      }

      const commentId = comments[0].id;

      // 2. Insert into review_submit_data
      const { error: insertErr } = await supabase
        .from('review_submit_data')
        .insert({
          app_id: appDetails.id,
          comment_id: commentId,
          earner_id: missingData.earnerId,
          bulker_id: missingData.bulkerId,
          submitted_username: missingData.username,
          screenshot_url: 'MANUAL_ENTRY',
          status: 'Under Review'
        });

      if (insertErr) throw insertErr;

      // 3. Mark comment as completed
      await supabase.from('app_comments').update({ status: 'completed' }).eq('id', commentId);

      setSnack({ open: true, message: 'Missing member added successfully!', severity: 'success' });
      setAddMissingOpen(false);
      setMissingData({ username: '', earnerId: '', bulkerId: '' });
      
      // Refresh the list
      fetchAppDetails({ preventDefault: () => {} });
    } catch (error) {
      setSnack({ open: true, message: error.message, severity: 'error' });
    } finally {
      setAddingMissing(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', mt: 1, pb: 10 }}>
      
      <style>
        {`
          .m3-swal-popup {
            border-radius: 28px !important;
            padding: 24px !important;
            box-shadow: 0px 4px 10px rgba(0,0,0,0.2) !important;
          }
          .m3-swal-title {
            justify-content: flex-start !important;
            font-size: 24px !important;
            padding: 0 0 16px 0 !important;
          }
          .m3-swal-content {
            text-align: left !important;
            font-size: 14px !important;
            padding: 0 0 24px 0 !important;
          }
          .m3-swal-actions {
            justify-content: flex-end !important;
            padding: 0 !important;
            width: 100% !important;
            gap: 8px !important;
          }
          .m3-swal-btn {
            border-radius: 100px !important;
            padding: 10px 24px !important;
            font-weight: 600 !important;
            font-size: 14px !important;
            text-transform: none !important;
            border: none !important;
            cursor: pointer !important;
            transition: all 0.2s !important;
          }
          .m3-swal-confirm {
            background-color: ${theme.palette.primary.main} !important;
            color: white !important;
          }
          .m3-swal-confirm-danger {
            background-color: #d32f2f !important;
            color: white !important;
          }
          .m3-swal-cancel {
            background-color: transparent !important;
            color: ${theme.palette.primary.main} !important;
          }
          .m3-swal-cancel:hover, .m3-swal-confirm:hover, .m3-swal-confirm-danger:hover {
            opacity: 0.9 !important;
          }
        `}
      </style>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 600 }}>
          Live List Configuration
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Verify app details and lock in members for live status.
        </Typography>
      </Box>

      {/* Fetch App Details Card */}
      <Paper elevation={0} sx={{ p: 4, borderRadius: '24px', mb: 4, border: theme.palette.mode === 'light' ? `1px solid ${theme.palette.divider}` : 'none' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
          <SearchIcon color="primary" /> Fetch App Details
        </Typography>
        
        <form onSubmit={fetchAppDetails}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField 
                fullWidth size="small" label="Enter Task / App ID" 
                variant="outlined" value={taskIdInput} onChange={e => setTaskIdInput(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Button 
                type="submit" variant="contained" disableElevation
                disabled={loading || !taskIdInput.trim()}
                sx={{ borderRadius: '10px', py: 1, px: 3 }}
              >
                {loading ? 'Checking...' : 'Check'}
              </Button>
            </Grid>
          </Grid>
        </form>

        {appDetails && (
          <Box sx={{ mt: 4, pt: 4, borderTop: `1px solid ${theme.palette.divider}` }}>
            <Grid container spacing={4}>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>Task Name</Typography>
                <Typography variant="h6" color="primary" sx={{ fontWeight: 700 }}>{appDetails.name}</Typography>
                
                <Box sx={{ mt: 1.5, display: 'flex', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>Task Type</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{appDetails.taskType}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>App Date</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{appDetails.appDate}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>Live Check Date</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{appDetails.liveCheckingDate}</Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={6} md={2}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>Provider</Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>{appDetails.provider}</Typography>
              </Grid>
              <Grid item xs={6} md={2}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>Rewards</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Member: <Box component="span" sx={{ color: 'success.main', fontWeight: 700 }}>{appDetails.memberReward}</Box>
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Sponsor: <Box component="span" sx={{ color: 'primary.main', fontWeight: 700 }}>{appDetails.sponsorReward}</Box>
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} md={2}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>Comment Limit</Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>{appDetails.commentLimit}</Typography>
              </Grid>
              <Grid item xs={12} md={2}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>Assigned Bulkers</Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>{appDetails.bulkers}</Typography>
              </Grid>
            </Grid>
          </Box>
        )}
      </Paper>

      {/* Members Card */}
      {appDetails && (
        <Paper elevation={0} sx={{ overflow: 'hidden', borderRadius: '24px', border: theme.palette.mode === 'light' ? `1px solid ${theme.palette.divider}` : 'none' }}>
          <Box sx={{ p: 3, bgcolor: theme.palette.mode === 'light' ? '#fcfcfc' : 'background.paper', borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Submitted Members ({filteredMembers.length})</Typography>
              {filteredMembers.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Checkbox 
                    checked={filteredMembers.length > 0 && filteredMembers.every(m => selectedIds.includes(m.id))}
                    indeterminate={filteredMembers.some(m => selectedIds.includes(m.id)) && !filteredMembers.every(m => selectedIds.includes(m.id))}
                    onChange={handleSelectAll}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Select All Filtered</Typography>
                </Box>
              )}
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <TextField 
                size="small" 
                placeholder="Search earner, bulker..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '100px', bgcolor: 'background.default', minWidth: 250 } }}
              />
              <Button variant="outlined" startIcon={<PersonAddIcon />} sx={{ borderRadius: '100px' }} onClick={() => setAddMissingOpen(true)}>
                Add Missing
              </Button>
            </Box>
          </Box>
          
          <Box sx={{ p: 3, maxHeight: 600, overflowY: 'auto', bgcolor: theme.palette.mode === 'light' ? '#f8f9fc' : 'background.default' }}>
            {filteredMembers.length === 0 ? (
              <Typography sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No submissions match your search.</Typography>
            ) : (
              <Grid container spacing={2}>
                {filteredMembers.map(u => {
                  const isSelected = selectedIds.includes(u.id);
                  return (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={u.id}>
                      <Paper 
                        elevation={isSelected ? 1 : 0} 
                        onClick={() => handleSelectOne(u.id)}
                        sx={{ 
                          p: 1.5, 
                          borderRadius: '12px', 
                          cursor: 'pointer',
                          position: 'relative',
                          border: `1.5px solid ${isSelected ? theme.palette.primary.main : theme.palette.divider}`,
                          bgcolor: isSelected ? (theme.palette.mode === 'light' ? 'primary.50' : 'rgba(26?15,232,0.05)') : 'background.paper',
                          transition: 'all 0.15s ease-in-out',
                          '&:hover': {
                            borderColor: 'primary.main',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.04)'
                          },
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1
                        }}
                      >
                        {/* Top Row: Checkbox, Name, Status Chip */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Checkbox 
                              checked={isSelected} 
                              onChange={(e) => { e.stopPropagation(); handleSelectOne(u.id); }} 
                              sx={{ p: 0, '& .MuiSvgIcon-root': { fontSize: 20, color: isSelected ? 'primary.main' : 'text.disabled' } }}
                            />
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.1, color: 'text.primary', ml: 0.5 }}>
                              {u.submitted_username.toUpperCase()}
                            </Typography>
                          </Box>
                          <Chip 
                            size="small" 
                            label={u.status} 
                            color={u.status === 'Live' ? 'success' : u.status === 'Under Review' ? 'warning' : 'default'} 
                            sx={{ borderRadius: '6px', fontWeight: 700, height: 18, fontSize: '0.6rem', textTransform: 'uppercase' }} 
                          />
                        </Box>
                        
                        {/* Details Area with Icons */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pl: 3.5 }}>
                          
                          {/* Earner Info */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                            <PersonIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary', lineHeight: 1 }}>
                              {u.formatted_earner}
                            </Typography>
                          </Box>

                          {/* Bulker Info */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                            <AssignmentIndIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main', lineHeight: 1 }}>
                              {u.formatted_bulker}
                            </Typography>
                          </Box>

                        </Box>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </Box>

          <Box sx={{ p: 3, borderTop: `1px solid ${theme.palette.divider}`, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button variant="outlined" color="error" onClick={handleZeroLive} sx={{ borderRadius: '10px' }}>Zero Live</Button>
            <Button 
              variant="contained" startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />} 
              disableElevation onClick={handleSaveLiveList} disabled={saving}
              sx={{ borderRadius: '10px' }}
            >
              {saving ? 'Saving...' : 'Save Live List'}
            </Button>
          </Box>
        </Paper>
      )}

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({...snack, open: false})} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnack({...snack, open: false})} severity={snack.severity} sx={{ width: '100%', borderRadius: '12px' }}>
          {snack.message}
        </Alert>
      </Snackbar>

      <Dialog open={addMissingOpen} onClose={() => setAddMissingOpen(false)} PaperProps={{ sx: { borderRadius: '16px', minWidth: 400 } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Add Missing Member</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Manually add a submission to this task. Requires 1 available active comment.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField 
              fullWidth label="Submitted Username" size="small"
              value={missingData.username} onChange={e => setMissingData({...missingData, username: e.target.value})}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
            />
            <Autocomplete
              options={allEarners}
              getOptionLabel={(option) => {
                const name = `${option.first_name || ''} ${option.last_name || ''}`.trim();
                const shortId = option.earner_id ? option.earner_id.split('/').pop() : '';
                return `${name} (${shortId}) - ${option.earner_id}`;
              }}
              loading={fetchingOptions}
              onChange={(e, val) => setMissingData({...missingData, earnerId: val ? val.earner_id : ''})}
              renderInput={(params) => (
                <TextField 
                  {...params} label="Select Earner" size="small" 
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
              )}
            />
            
            <Autocomplete
              options={allBulkers}
              getOptionLabel={(option) => {
                const shortId = option.bulker_id ? option.bulker_id.split('/').pop() : '';
                return `${option.full_name} (${shortId}) - ${option.bulker_id}`;
              }}
              loading={fetchingOptions}
              onChange={(e, val) => setMissingData({...missingData, bulkerId: val ? val.bulker_id : ''})}
              renderInput={(params) => (
                <TextField 
                  {...params} label="Select Bulker" size="small" 
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setAddMissingOpen(false)} sx={{ borderRadius: '10px' }} color="inherit">Cancel</Button>
          <Button 
            onClick={submitAddMissing} variant="contained" disableElevation
            disabled={addingMissing} sx={{ borderRadius: '10px' }}
          >
            {addingMissing ? 'Adding...' : 'Add Member'}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
