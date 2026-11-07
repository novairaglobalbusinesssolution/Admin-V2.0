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
  InputAdornment,
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
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import DoneAllIcon from '@mui/icons-material/DoneAll';

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

  // Tabs State (Uses string keys for seamless multi-type compatibility)
  const [tabValue, setTabValue] = useState('tasks');

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

  // Filters State for Individual Earner Submissions
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

  // Bulker Assigned Tasks Filter State
  const [assignedSearch, setAssignedSearch] = useState('');
  const [assignedStatusFilter, setAssignedStatusFilter] = useState('all');
  const [assignedPage, setAssignedPage] = useState(0);
  const [assignedRowsPerPage, setAssignedRowsPerPage] = useState(10);

  // Bulker Live Delivery List State
  const [liveSearch, setLiveSearch] = useState('');
  const [livePage, setLivePage] = useState(0);
  const [liveRowsPerPage, setLiveRowsPerPage] = useState(10);

  // Modal for Bulker App Users & Live Deliveries
  const [modalOpen, setModalOpen] = useState(false);
  const [modalUsers, setModalUsers] = useState([]);
  const [modalApp, setModalApp] = useState(null);
  const [modalMode, setModalMode] = useState('all'); // 'all' | 'live'
  const [modalSearch, setModalSearch] = useState('');
  const [modalStatusFilter, setModalStatusFilter] = useState('all');

  const handleOpenModal = (app, usersList, mode = 'all') => {
    setModalApp(app);
    setModalUsers(usersList || []);
    setModalMode(mode);
    setModalSearch('');
    setModalStatusFilter('all');
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
        const bulkerKeys = Array.from(new Set([
          currentBulkerId,
          shortBulkerId,
          longBulkerId,
          `NOVAIRA/BULKER/${shortBulkerId}`,
          shortBulkerId?.toLowerCase(),
          shortBulkerId?.toUpperCase(),
          longBulkerId?.toLowerCase(),
          longBulkerId?.toUpperCase(),
          finalData.id,
        ].filter(Boolean)));

        const { data: allApps } = await supabase.from('apps').select('*').order('app_date', { ascending: false }).limit(1000);
        const appsAssigned = allApps?.filter((app) => {
          let assigned = app.assigned_bulkers || [];
          while (typeof assigned === 'string') {
            try { assigned = JSON.parse(assigned); } catch (e) { break; }
          }
          if (!Array.isArray(assigned)) assigned = [];
          return assigned.some((b) => {
            const bId = typeof b === 'string' ? b : b.bulker_id;
            return bulkerKeys.some((k) => String(k).toLowerCase() === String(bId).toLowerCase());
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
          .in('bulker_id', bulkerKeys)
          .order('created_at', { ascending: false })
          .limit(2000);
        if (profiles) setReferrals(profiles);

        const { data: hist } = await supabase
          .from('bulker_billing_history')
          .select('*')
          .in('bulker_id', bulkerKeys)
          .order('change_date_time', { ascending: true })
          .limit(500);
        if (hist) setBillingHistory(hist);

        const { data: txns } = await supabase
          .from('individual_wallet_transactions')
          .select('id, transaction_id, amount, transaction_type, description, status, created_at, utr_id')
          .in('earner_id', bulkerKeys)
          .order('created_at', { ascending: false })
          .limit(500);
        if (txns) setTransactions(txns);

        // Pre-indexed lookup maps for high-performance memory resolution
        const appsMap = new Map();
        (allApps || []).forEach((a) => {
          appsMap.set(String(a.id), a);
          if (a.task_id) appsMap.set(String(a.task_id), a);
        });

        const profileNameMap = new Map();
        (profiles || []).forEach((p) => {
          const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.phone || p.earner_id;
          profileNameMap.set(p.earner_id, name);
        });

        // 1. Get exact total count of reviews for this bulker
        const { count: totalReviewsCount } = await supabase
          .from('review_submit_data')
          .select('*', { count: 'exact', head: true })
          .in('bulker_id', bulkerKeys);

        // 2. Fetch ALL real reviews in parallel chunks (PostgREST 1000 limit bypass)
        const totalToFetch = totalReviewsCount || 0;
        const pageSize = 1000;
        const numPages = Math.min(Math.ceil(totalToFetch / pageSize), 25);
        const reviewPromises = [];

        for (let i = 0; i < numPages; i++) {
          const from = i * pageSize;
          const to = from + pageSize - 1;
          reviewPromises.push(
            supabase
              .from('review_submit_data')
              .select('id, app_id, submitted_username, status, submitted_at, earner_id, bulker_id')
              .in('bulker_id', bulkerKeys)
              .range(from, to)
              .order('submitted_at', { ascending: false })
          );
        }

        const reviewResults = await Promise.all(reviewPromises);
        let rawReviews = [];
        reviewResults.forEach((res) => {
          if (res.data) rawReviews.push(...res.data);
        });

        if (rawReviews.length > 0) {
          revsData = rawReviews.map((r) => {
            const matchedApp = appsMap.get(String(r.app_id));
            return {
              ...r,
              earner_name: profileNameMap.get(r.earner_id) || r.earner_id || 'Unknown',
              apps: matchedApp || {
                id: r.app_id,
                task_id: r.app_id,
                app_name: 'Application Task',
                app_date: r.submitted_at,
                app_package: '',
              },
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

  // Grouped Bulker Apps (Unique Application Row - No duplicates)
  const groupedBulkerApps = useMemo(() => {
    if (type !== 'bulker') return [];

    const reviewsByApp = {};
    reviews.forEach((r) => {
      const keys = [r.app_id, r.apps?.id, r.apps?.task_id].filter(Boolean);
      keys.forEach((k) => {
        if (!reviewsByApp[k]) reviewsByApp[k] = [];
        reviewsByApp[k].push(r);
      });
    });

    const seenAppIds = new Set();
    const list = [];

    (bulkerApps || []).forEach((app) => {
      seenAppIds.add(String(app.id));
      if (app.task_id) seenAppIds.add(String(app.task_id));

      const appRevs = [
        ...(reviewsByApp[app.id] || []),
        ...(app.task_id && reviewsByApp[app.task_id] ? reviewsByApp[app.task_id] : [])
      ];
      const uniqueRevsMap = new Map();
      appRevs.forEach((r) => uniqueRevsMap.set(r.id, r));
      const finalRevs = Array.from(uniqueRevsMap.values());

      const liveRevs = finalRevs.filter((r) => r.status === 'Approved' || r.status === 'Live');
      const underReviewRevs = finalRevs.filter((r) => r.status === 'Under Review' || !r.status);
      const rejectedRevs = finalRevs.filter((r) => r.status === 'Rejected' || r.status === 'Not Live');

      list.push({
        id: app.id,
        task_id: app.task_id,
        app_name: app.app_name,
        app_package: app.app_package,
        app_date: app.app_date,
        reviews: finalRevs,
        liveReviews: liveRevs,
        underReviewReviews: underReviewRevs,
        rejectedReviews: rejectedRevs,
        totalUsers: finalRevs.length,
        liveUsersCount: liveRevs.length,
        hasLiveSubmissions: liveRevs.length > 0,
        appRaw: app,
      });
    });

    // Also include any apps from reviews not explicitly in bulkerApps
    reviews.forEach((r) => {
      const appId = r.app_id || r.apps?.task_id;
      if (appId && !seenAppIds.has(String(appId))) {
        seenAppIds.add(String(appId));
        if (r.apps?.id) seenAppIds.add(String(r.apps.id));
        if (r.apps?.task_id) seenAppIds.add(String(r.apps.task_id));

        const appRevs = reviews.filter((x) =>
          x.app_id === r.app_id ||
          (r.apps?.task_id && x.apps?.task_id === r.apps.task_id) ||
          (r.apps?.id && x.apps?.id === r.apps.id)
        );
        const uniqueRevsMap = new Map();
        appRevs.forEach((x) => uniqueRevsMap.set(x.id, x));
        const finalRevs = Array.from(uniqueRevsMap.values());

        const liveRevs = finalRevs.filter((x) => x.status === 'Approved' || x.status === 'Live');
        const underReviewRevs = finalRevs.filter((x) => x.status === 'Under Review' || !x.status);
        const rejectedRevs = finalRevs.filter((x) => x.status === 'Rejected' || x.status === 'Not Live');

        list.push({
          id: r.app_id || r.id,
          task_id: r.apps?.task_id || r.app_id,
          app_name: r.apps?.app_name || 'Application Task',
          app_package: r.apps?.app_package || '',
          app_date: r.apps?.app_date || r.submitted_at,
          reviews: finalRevs,
          liveReviews: liveRevs,
          underReviewReviews: underReviewRevs,
          rejectedReviews: rejectedRevs,
          totalUsers: finalRevs.length,
          liveUsersCount: liveRevs.length,
          hasLiveSubmissions: liveRevs.length > 0,
          appRaw: r.apps || null,
        });
      }
    });

    return list.sort((a, b) => {
      const timeA = a.app_date ? new Date(a.app_date).getTime() : 0;
      const timeB = b.app_date ? new Date(b.app_date).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      return (Number(b.task_id) || 0) - (Number(a.task_id) || 0);
    });
  }, [type, bulkerApps, reviews]);

  const liveBulkerApps = useMemo(() => {
    return groupedBulkerApps.filter((app) => app.liveUsersCount > 0);
  }, [groupedBulkerApps]);

  const totalLiveReviewsCount = useMemo(() => {
    return groupedBulkerApps.reduce((acc, app) => acc + app.liveUsersCount, 0);
  }, [groupedBulkerApps]);

  // Filtered Grouped Bulker Apps (Tab 0: Assigned Tasks)
  const filteredGroupedBulkerApps = useMemo(() => {
    return groupedBulkerApps.filter((app) => {
      const q = assignedSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        String(app.task_id || '').toLowerCase().includes(q) ||
        String(app.app_name || '').toLowerCase().includes(q) ||
        String(app.app_package || '').toLowerCase().includes(q) ||
        app.reviews.some((r) =>
          String(r.submitted_username || '').toLowerCase().includes(q) ||
          String(r.earner_name || '').toLowerCase().includes(q) ||
          String(r.earner_id || '').toLowerCase().includes(q)
        );

      let matchStatus = true;
      if (assignedStatusFilter === 'has_submissions') {
        matchStatus = app.totalUsers > 0;
      } else if (assignedStatusFilter === 'has_live') {
        matchStatus = app.liveUsersCount > 0;
      } else if (assignedStatusFilter === 'under_review') {
        matchStatus = app.underReviewReviews.length > 0;
      } else if (assignedStatusFilter === 'no_submissions') {
        matchStatus = app.totalUsers === 0;
      }

      return matchSearch && matchStatus;
    });
  }, [groupedBulkerApps, assignedSearch, assignedStatusFilter]);

  // Filtered Live Delivery Bulker Apps (Tab 1: Live Delivery List)
  const filteredLiveBulkerApps = useMemo(() => {
    return liveBulkerApps.filter((app) => {
      const q = liveSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        String(app.task_id || '').toLowerCase().includes(q) ||
        String(app.app_name || '').toLowerCase().includes(q) ||
        String(app.app_package || '').toLowerCase().includes(q) ||
        app.liveReviews.some((r) =>
          String(r.submitted_username || '').toLowerCase().includes(q) ||
          String(r.earner_name || '').toLowerCase().includes(q) ||
          String(r.earner_id || '').toLowerCase().includes(q)
        );
      return matchSearch;
    });
  }, [liveBulkerApps, liveSearch]);

  // Filtered Users inside the Modal Popup
  const filteredModalUsers = useMemo(() => {
    return modalUsers.filter((u) => {
      const q = modalSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        (u.submitted_username || '').toLowerCase().includes(q) ||
        (u.earner_id || '').toLowerCase().includes(q) ||
        (u.earner_name || '').toLowerCase().includes(q);
      let matchStatus = true;
      if (modalStatusFilter === 'Approved') {
        matchStatus = u.status === 'Approved' || u.status === 'Live';
      } else if (modalStatusFilter === 'Under Review') {
        matchStatus = u.status === 'Under Review' || !u.status;
      } else if (modalStatusFilter === 'Rejected') {
        matchStatus = u.status === 'Rejected' || u.status === 'Not Live';
      }
      return matchSearch && matchStatus;
    });
  }, [modalUsers, modalSearch, modalStatusFilter]);

  // Copy app users handler (supports both All Handles and Live Delivery Format)
  const handleCopyAppUsers = (targetApp = null, userList = null, isLiveOnly = false) => {
    const currentApp = targetApp || modalApp;
    const list = userList || modalUsers;
    if (!currentApp) return;

    const appName = String(currentApp.app_name || 'APPLICATION TASK').toUpperCase();
    const appDateStr = formatKolkataDate(currentApp.app_date);
    const taskId = String(currentApp.task_id || '').toUpperCase();
    const totalCount = list.length;

    let text = '';
    if (isLiveOnly) {
      const memberLines = list.length > 0
        ? list.map((u) => (u.submitted_username || u.earner_id || 'UNKNOWN').trim().toUpperCase()).join('\n')
        : 'NO LIVE USERS YET';
      text = `${appName}\n${appDateStr}\n${taskId}\n\n${memberLines}\n\nTOTAL LIVE - ${totalCount}`;
    } else {
      let header = `${appName}\n${appDateStr}\nAPP ID : ${taskId}\n\n`;
      const memberLines = list.length > 0
        ? list.map((u) => (u.submitted_username || u.earner_id || 'UNKNOWN').trim().toUpperCase()).join('\n')
        : 'NO USERS SUBMITTED';
      text = `${header}${memberLines}\n\nTOTAL - ${totalCount}`;
    }

    copyToClipboard(text, isLiveOnly ? 'Live Delivery Report' : 'App Users List');
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
              {type === 'bulker' ? (
                <>
                  <Grid item xs={6} sm={3}>
                    <Box
                      sx={{
                        p: 1.8,
                        borderRadius: '16px',
                        bgcolor: 'rgba(99, 102, 241, 0.1)',
                        border: '1px solid rgba(99, 102, 241, 0.25)',
                      }}
                    >
                      <Typography variant="caption" sx={{ color: '#6366f1', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '0.65rem', display: 'block' }}>
                        Assigned Tasks
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 850, color: '#6366f1', mt: 0.3, fontSize: '1.25rem' }}>
                        {groupedBulkerApps.length} Apps
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                        Active campaigns
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={6} sm={3}>
                    <Box
                      sx={{
                        p: 1.8,
                        borderRadius: '16px',
                        bgcolor: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.25)',
                      }}
                    >
                      <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '0.65rem', display: 'block' }}>
                        Total Submissions
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 850, color: '#f59e0b', mt: 0.3, fontSize: '1.25rem' }}>
                        {reviews.length} Reviews
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                        Team submissions
                      </Typography>
                    </Box>
                  </Grid>

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
                        Live Deliveries
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 850, color: '#10b981', mt: 0.3, fontSize: '1.25rem' }}>
                        {totalLiveReviewsCount} Live
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                        Verified deliverables
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={6} sm={3}>
                    <Box
                      sx={{
                        p: 1.8,
                        borderRadius: '16px',
                        bgcolor: 'rgba(6, 182, 212, 0.1)',
                        border: '1px solid rgba(6, 182, 212, 0.25)',
                      }}
                    >
                      <Typography variant="caption" sx={{ color: '#06b6d4', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '0.65rem', display: 'block' }}>
                        Assigned Earners
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 850, color: '#06b6d4', mt: 0.3, fontSize: '1.25rem' }}>
                        {referrals.length} Members
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                        Fleet strength
                      </Typography>
                    </Box>
                  </Grid>
                </>
              ) : (
                <>
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
                </>
              )}
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
              value="tasks"
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>{type === 'bulker' ? 'Assigned Tasks' : 'Task Submissions'}</span>
                  <Chip
                    label={type === 'bulker' ? groupedBulkerApps.length : reviews.length}
                    size="small"
                    sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800 }}
                  />
                </Box>
              }
            />

            {type === 'bulker' && (
              <Tab
                value="livelist"
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>Live Delivery List</span>
                    <Chip
                      label={`${totalLiveReviewsCount} Live`}
                      size="small"
                      color={totalLiveReviewsCount > 0 ? 'success' : 'default'}
                      sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800 }}
                    />
                  </Box>
                }
              />
            )}

            {(type === 'individual' || type === 'bulker') && (
              <Tab
                value="ledger"
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>Wallet & Financial Ledger</span>
                    <Chip label={transactions.length} size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800 }} />
                  </Box>
                }
              />
            )}

            {type === 'bulker' && <Tab value="invoice" label="Monthly Invoice" />}

            <Tab value="settings" label="Settings & Security" />

            {(type === 'individual' || type === 'bulker') && (
              <Tab
                value="earners"
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>{type === 'bulker' ? 'Assigned Earners' : 'Referral Network'}</span>
                    <Chip label={referrals.length} size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800 }} />
                  </Box>
                }
              />
            )}
          </Tabs>
        </Box>

        <Box sx={{ p: { xs: 2.5, md: 3.5 } }}>
          {/* TAB 0: Reviews & Submissions */}
          <TabPanel value={tabValue} index="tasks">
            {loadingRecords ? (
              <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={28} /></Box>
            ) : type === 'bulker' ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Search & Filter Bar */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
                  <TextField
                    size="small"
                    placeholder="Search Task ID, Application Name, Package, or Earner..."
                    value={assignedSearch}
                    onChange={(e) => { setAssignedSearch(e.target.value); setAssignedPage(0); }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{ flexGrow: 1, minWidth: 260, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                  />
                  <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel>Filter Campaigns</InputLabel>
                    <Select
                      label="Filter Campaigns"
                      value={assignedStatusFilter}
                      onChange={(e) => { setAssignedStatusFilter(e.target.value); setAssignedPage(0); }}
                      sx={{ borderRadius: '12px' }}
                    >
                      <MenuItem value="all">All Campaigns ({groupedBulkerApps.length})</MenuItem>
                      <MenuItem value="has_submissions">With Submissions ({groupedBulkerApps.filter(a => a.totalUsers > 0).length})</MenuItem>
                      <MenuItem value="has_live">With Live Deliveries ({groupedBulkerApps.filter(a => a.liveUsersCount > 0).length})</MenuItem>
                      <MenuItem value="under_review">Has Under Review ({groupedBulkerApps.filter(a => a.underReviewReviews.length > 0).length})</MenuItem>
                      <MenuItem value="no_submissions">No Submissions Yet ({groupedBulkerApps.filter(a => a.totalUsers === 0).length})</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                {filteredGroupedBulkerApps.length === 0 ? (
                  <Box sx={{ p: 6, textAlign: 'center', border: `1px dashed ${theme.palette.divider}`, borderRadius: '18px' }}>
                    <RateReviewIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1, opacity: 0.5 }} />
                    <Typography variant="body2" color="text.secondary">No assigned applications match your search.</Typography>
                  </Box>
                ) : (
                  <TableContainer sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: '18px', overflow: 'hidden' }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.03)' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Task ID</TableCell>
                          <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Application Name & Package</TableCell>
                          <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Release Date</TableCell>
                          <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Submitted Handles & Audit Status</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredGroupedBulkerApps.slice(assignedPage * assignedRowsPerPage, assignedPage * assignedRowsPerPage + assignedRowsPerPage).map((app) => (
                          <TableRow key={app.id} hover>
                            <TableCell sx={{ color: 'primary.main', fontWeight: 800, fontFamily: 'monospace' }}>
                              #{app.task_id}
                            </TableCell>

                            <TableCell>
                              <Typography sx={{ fontWeight: 750, fontSize: '0.85rem' }}>{app.app_name}</Typography>
                              {app.app_package && (
                                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', fontSize: '0.7rem' }}>
                                  {app.app_package}
                                </Typography>
                              )}
                            </TableCell>

                            <TableCell sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                              {formatKolkataDate(app.app_date)}
                            </TableCell>

                            <TableCell>
                              {app.totalUsers === 0 ? (
                                <Chip label="0 Submissions" size="small" variant="outlined" sx={{ color: 'text.disabled', height: 22, fontSize: '0.68rem', borderRadius: '6px' }} />
                              ) : (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexWrap: 'wrap' }}>
                                  <Chip
                                    label={`${app.totalUsers} Total`}
                                    size="small"
                                    sx={{ height: 22, fontSize: '0.68rem', fontWeight: 800, borderRadius: '6px', bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }}
                                  />
                                  {app.underReviewReviews.length > 0 && (
                                    <Chip
                                      label={`${app.underReviewReviews.length} Reviewing`}
                                      size="small"
                                      color="warning"
                                      sx={{ height: 22, fontSize: '0.68rem', fontWeight: 800, borderRadius: '6px' }}
                                    />
                                  )}
                                  {app.liveReviews.length > 0 && (
                                    <Chip
                                      label={`${app.liveReviews.length} Approved/Live`}
                                      size="small"
                                      color="success"
                                      sx={{ height: 22, fontSize: '0.68rem', fontWeight: 800, borderRadius: '6px' }}
                                    />
                                  )}
                                  {app.rejectedReviews.length > 0 && (
                                    <Chip
                                      label={`${app.rejectedReviews.length} Rejected`}
                                      size="small"
                                      color="error"
                                      sx={{ height: 22, fontSize: '0.68rem', fontWeight: 800, borderRadius: '6px' }}
                                    />
                                  )}
                                </Box>
                              )}
                            </TableCell>

                            <TableCell align="right">
                              <Button
                                size="small"
                                variant="contained"
                                disabled={app.totalUsers === 0}
                                startIcon={<VisibilityIcon sx={{ fontSize: 14 }} />}
                                onClick={() => handleOpenModal(app, app.reviews, 'all')}
                                sx={{
                                  borderRadius: '10px',
                                  fontWeight: 800,
                                  fontSize: '0.74rem',
                                  textTransform: 'none',
                                  boxShadow: 'none',
                                  py: 0.6,
                                  px: 1.6,
                                  bgcolor: app.totalUsers > 0 ? 'primary.main' : undefined,
                                }}
                              >
                                View Users ({app.totalUsers})
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <TablePagination
                      component="div"
                      count={filteredGroupedBulkerApps.length}
                      page={assignedPage}
                      onPageChange={(e, p) => setAssignedPage(p)}
                      rowsPerPage={assignedRowsPerPage}
                      onRowsPerPageChange={(e) => { setAssignedRowsPerPage(parseInt(e.target.value, 10)); setAssignedPage(0); }}
                      rowsPerPageOptions={[10, 25, 50]}
                    />
                  </TableContainer>
                )}
              </Box>
            ) : (
              /* INDIVIDUAL EARNER REVIEW SUBMISSIONS */
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

          {/* TAB 1: Bulker Live Delivery List */}
          {type === 'bulker' && (
            <TabPanel value={tabValue} index="livelist">
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {/* Live Delivery Telemetry Cards */}
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ p: 2, borderRadius: '16px', bgcolor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                      <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.68rem', display: 'block' }}>
                        Verified Live Reviews
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: '#10b981', mt: 0.5 }}>
                        {totalLiveReviewsCount}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                        Ready for sponsor submission
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <Box sx={{ p: 2, borderRadius: '16px', bgcolor: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.25)' }}>
                      <Typography variant="caption" sx={{ color: '#06b6d4', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.68rem', display: 'block' }}>
                        Live Active Applications
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: '#06b6d4', mt: 0.5 }}>
                        {liveBulkerApps.length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                        Apps with approved deliverables
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <Box sx={{ p: 2, borderRadius: '16px', bgcolor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                      <Typography variant="caption" sx={{ color: '#6366f1', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.68rem', display: 'block' }}>
                        Report Format Desk
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: '#6366f1', mt: 0.5 }}>
                        1-CLICK
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                        Formatted sponsor live list
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                {/* Live Delivery Search Bar */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
                  <TextField
                    size="small"
                    placeholder="Search Live App, Task ID, or Live Earner Username..."
                    value={liveSearch}
                    onChange={(e) => { setLiveSearch(e.target.value); setLivePage(0); }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{ flexGrow: 1, minWidth: 260, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                  />
                </Box>

                {filteredLiveBulkerApps.length === 0 ? (
                  <Box sx={{ p: 6, textAlign: 'center', border: `1px dashed ${theme.palette.divider}`, borderRadius: '18px' }}>
                    <FormatListBulletedIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1, opacity: 0.5 }} />
                    <Typography variant="body2" color="text.secondary">No verified live delivery tasks found for this bulker.</Typography>
                  </Box>
                ) : (
                  <TableContainer sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: '18px', overflow: 'hidden' }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.03)' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Task ID</TableCell>
                          <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Application Name & Package</TableCell>
                          <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Release Date</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Verified Live Reviews</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Export Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredLiveBulkerApps.slice(livePage * liveRowsPerPage, livePage * liveRowsPerPage + liveRowsPerPage).map((app) => (
                          <TableRow key={app.id} hover>
                            <TableCell sx={{ color: 'primary.main', fontWeight: 800, fontFamily: 'monospace' }}>
                              #{app.task_id}
                            </TableCell>

                            <TableCell>
                              <Typography sx={{ fontWeight: 750, fontSize: '0.85rem' }}>{app.app_name}</Typography>
                              {app.app_package && (
                                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', fontSize: '0.7rem' }}>
                                  {app.app_package}
                                </Typography>
                              )}
                            </TableCell>

                            <TableCell sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                              {formatKolkataDate(app.app_date)}
                            </TableCell>

                            <TableCell align="center">
                              <Chip
                                label={`${app.liveUsersCount} Live Reviews`}
                                size="small"
                                color="success"
                                onClick={() => handleOpenModal(app, app.liveReviews, 'live')}
                                sx={{
                                  height: 24,
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  '&:hover': { transform: 'scale(1.04)' },
                                  transition: 'transform 0.15s ease',
                                }}
                              />
                            </TableCell>

                            <TableCell align="right">
                              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<VisibilityIcon sx={{ fontSize: 14 }} />}
                                  onClick={() => handleOpenModal(app, app.liveReviews, 'live')}
                                  sx={{
                                    borderRadius: '10px',
                                    fontWeight: 750,
                                    fontSize: '0.74rem',
                                    textTransform: 'none',
                                    py: 0.6,
                                  }}
                                >
                                  Live Users ({app.liveUsersCount})
                                </Button>

                                <Button
                                  size="small"
                                  variant="contained"
                                  startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
                                  onClick={() => handleCopyAppUsers(app, app.liveReviews, true)}
                                  sx={{
                                    borderRadius: '10px',
                                    fontWeight: 800,
                                    fontSize: '0.74rem',
                                    textTransform: 'none',
                                    boxShadow: 'none',
                                    bgcolor: '#10b981',
                                    '&:hover': { bgcolor: '#059669' },
                                    py: 0.6,
                                  }}
                                >
                                  Copy Report
                                </Button>
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <TablePagination
                      component="div"
                      count={filteredLiveBulkerApps.length}
                      page={livePage}
                      onPageChange={(e, p) => setLivePage(p)}
                      rowsPerPage={liveRowsPerPage}
                      onRowsPerPageChange={(e) => { setLiveRowsPerPage(parseInt(e.target.value, 10)); setLivePage(0); }}
                      rowsPerPageOptions={[10, 25, 50]}
                    />
                  </TableContainer>
                )}
              </Box>
            </TabPanel>
          )}

          {/* TAB 2: Wallet & Financial Ledger */}
          <TabPanel value={tabValue} index="ledger">
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

          {/* TAB 3: Bulker Monthly Invoice */}
          <TabPanel value={tabValue} index="invoice">
            {type !== 'bulker' ? (
              <Box sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">Only available for bulker partner accounts.</Typography></Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>Bulker Monthly Ledger Invoicing</Typography>
                    <Typography variant="caption" color="text.secondary">Detailed campaign deliverable breakdown and payable disbursements.</Typography>
                  </Box>
                  <Chip
                    label={`Payable Total: ₹${(totalLiveReviewsCount * 10).toFixed(2)}`}
                    color="success"
                    sx={{ fontWeight: 900, fontSize: '0.82rem', height: 32, borderRadius: '10px' }}
                  />
                </Box>

                <TableContainer sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: '18px', overflow: 'hidden' }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.03)' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Task ID</TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Application Name</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Total Submissions</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Approved / Live</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Unit Rate</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>Subtotal</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {groupedBulkerApps.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                            No assigned campaigns found for this bulker.
                          </TableCell>
                        </TableRow>
                      ) : (
                        groupedBulkerApps.map((app) => (
                          <TableRow key={app.id} hover>
                            <TableCell sx={{ color: 'primary.main', fontWeight: 800, fontFamily: 'monospace' }}>
                              #{app.task_id}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>
                              {app.app_name}
                              {app.app_package && (
                                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.68rem' }}>
                                  {app.app_package}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="center">
                              <Button
                                size="small"
                                variant="outlined"
                                disabled={app.totalUsers === 0}
                                onClick={() => handleOpenModal(app, app.reviews, 'all')}
                                sx={{ borderRadius: '8px', fontWeight: 750, fontSize: '0.7rem', py: 0.3 }}
                              >
                                {app.totalUsers} Users
                              </Button>
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={`${app.liveUsersCount} Live`}
                                size="small"
                                color={app.liveUsersCount > 0 ? 'success' : 'default'}
                                onClick={() => app.liveUsersCount > 0 && handleOpenModal(app, app.liveReviews, 'live')}
                                sx={{ height: 22, fontSize: '0.68rem', fontWeight: 800, borderRadius: '6px', cursor: app.liveUsersCount > 0 ? 'pointer' : 'default' }}
                              />
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>₹10.00</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 850 }}>₹{(app.liveUsersCount * 10).toFixed(2)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </TabPanel>

          {/* TAB 4: Settings & Security */}
          <TabPanel value={tabValue} index="settings">
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

          {/* TAB 5: Assigned Earners / Referral Network */}
          <TabPanel value={tabValue} index="earners">
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
        PaperProps={{
          sx: {
            borderRadius: '24px',
            backgroundImage: 'none',
            bgcolor: isDark ? '#0f172a' : '#ffffff',
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: isDark ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)' : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          },
        }}
      >
        <DialogTitle sx={{ p: 2.5, pb: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 850, letterSpacing: '-0.02em' }}>
                  {modalApp?.app_name || 'Campaign Submissions'}
                </Typography>
                <Chip
                  label={`#${modalApp?.task_id || 'TASK'}`}
                  size="small"
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    height: 22,
                    fontSize: '0.72rem',
                    bgcolor: 'rgba(59, 130, 246, 0.12)',
                    color: '#3b82f6',
                  }}
                />
                <Chip
                  label={modalMode === 'live' ? 'VERIFIED LIVE ONLY' : 'ALL AUDIT SUBMISSIONS'}
                  size="small"
                  sx={{
                    fontWeight: 800,
                    height: 22,
                    fontSize: '0.68rem',
                    bgcolor: modalMode === 'live' ? 'rgba(16, 185, 129, 0.15)' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
                    color: modalMode === 'live' ? '#10b981' : 'text.secondary',
                    border: modalMode === 'live' ? '1px solid rgba(16, 185, 129, 0.3)' : undefined,
                  }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.74rem' }}>
                Release Date: {formatKolkataDate(modalApp?.app_date)} • Package: {modalApp?.app_package || 'N/A'}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button
                size="small"
                variant="contained"
                startIcon={<ContentCopyIcon sx={{ fontSize: 15 }} />}
                onClick={() => handleCopyAppUsers(modalApp, filteredModalUsers.length > 0 ? filteredModalUsers : modalUsers, modalMode === 'live')}
                sx={{
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.74rem',
                  textTransform: 'none',
                  boxShadow: 'none',
                  bgcolor: modalMode === 'live' ? '#10b981' : 'primary.main',
                  '&:hover': { bgcolor: modalMode === 'live' ? '#059669' : undefined },
                  py: 0.6,
                  px: 1.5,
                }}
              >
                {modalMode === 'live' ? 'Copy Live Report' : 'Copy Handles'}
              </Button>
              <IconButton size="small" onClick={handleCloseModal} sx={{ borderRadius: '10px' }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Modal Filter Bar */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search earner username, name, or earner ID..."
              value={modalSearch}
              onChange={(e) => setModalSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ flexGrow: 1, minWidth: 240, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            />

            <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
              <Chip
                label={`All (${modalUsers.length})`}
                size="small"
                onClick={() => setModalStatusFilter('all')}
                variant={modalStatusFilter === 'all' ? 'filled' : 'outlined'}
                color={modalStatusFilter === 'all' ? 'primary' : 'default'}
                sx={{ fontWeight: 800, fontSize: '0.7rem', cursor: 'pointer', height: 26, borderRadius: '8px' }}
              />
              <Chip
                label={`Live/Approved (${modalUsers.filter((u) => u.status === 'Approved' || u.status === 'Live').length})`}
                size="small"
                onClick={() => setModalStatusFilter(modalStatusFilter === 'Approved' ? 'all' : 'Approved')}
                variant={modalStatusFilter === 'Approved' ? 'filled' : 'outlined'}
                color="success"
                sx={{ fontWeight: 800, fontSize: '0.7rem', cursor: 'pointer', height: 26, borderRadius: '8px' }}
              />
              <Chip
                label={`Under Review (${modalUsers.filter((u) => u.status === 'Under Review' || !u.status).length})`}
                size="small"
                onClick={() => setModalStatusFilter(modalStatusFilter === 'Under Review' ? 'all' : 'Under Review')}
                variant={modalStatusFilter === 'Under Review' ? 'filled' : 'outlined'}
                color="warning"
                sx={{ fontWeight: 800, fontSize: '0.7rem', cursor: 'pointer', height: 26, borderRadius: '8px' }}
              />
              <Chip
                label={`Rejected / Not Live (${modalUsers.filter((u) => u.status === 'Rejected' || u.status === 'Not Live').length})`}
                size="small"
                onClick={() => setModalStatusFilter(modalStatusFilter === 'Rejected' ? 'all' : 'Rejected')}
                variant={modalStatusFilter === 'Rejected' ? 'filled' : 'outlined'}
                color="error"
                sx={{ fontWeight: 800, fontSize: '0.7rem', cursor: 'pointer', height: 26, borderRadius: '8px' }}
              />
            </Box>
          </Box>

          {/* Submissions Table */}
          {filteredModalUsers.length === 0 ? (
            <Box sx={{ p: 5, textAlign: 'center', border: `1px dashed ${theme.palette.divider}`, borderRadius: '16px' }}>
              <PeopleAltIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 1, opacity: 0.5 }} />
              <Typography variant="body2" color="text.secondary">
                No submitted earner handles match your search/filter criteria.
              </Typography>
            </Box>
          ) : (
            <TableContainer sx={{ maxHeight: 420, border: `1px solid ${theme.palette.divider}`, borderRadius: '16px' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: isDark ? '#1e293b' : '#f8fafc', fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' } }}>
                    <TableCell sx={{ width: 48 }}>#</TableCell>
                    <TableCell>Submitted Handle</TableCell>
                    <TableCell>Earner Profile</TableCell>
                    <TableCell>Date & Time</TableCell>
                    <TableCell align="center">Audit Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredModalUsers.map((u, idx) => (
                    <TableRow key={u.id || idx} hover>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                        {idx + 1}
                      </TableCell>

                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography sx={{ fontWeight: 750, fontSize: '0.84rem' }}>
                            {u.submitted_username || 'N/A'}
                          </Typography>
                          {u.submitted_username && (
                            <Tooltip title="Copy username">
                              <IconButton
                                size="small"
                                onClick={() => copyToClipboard(u.submitted_username, 'Username')}
                                sx={{ p: 0.3, opacity: 0.6, '&:hover': { opacity: 1 } }}
                              >
                                <ContentCopyIcon sx={{ fontSize: 13 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>
                          {u.earner_name || 'Individual Earner'}
                        </Typography>
                        {u.earner_id && (
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'primary.main', fontSize: '0.68rem', display: 'block' }}>
                            {u.earner_id}
                          </Typography>
                        )}
                      </TableCell>

                      <TableCell sx={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                        {formatKolkataDate(u.submitted_at, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </TableCell>

                      <TableCell align="center">
                        <Chip
                          label={u.status || 'Under Review'}
                          size="small"
                          color={u.status === 'Approved' || u.status === 'Live' ? 'success' : u.status === 'Rejected' || u.status === 'Not Live' ? 'error' : 'warning'}
                          sx={{ height: 22, fontSize: '0.68rem', fontWeight: 800, borderRadius: '6px' }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2.5, pt: 1.5, borderTop: `1px solid ${theme.palette.divider}`, justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
            Showing {filteredModalUsers.length} of {modalUsers.length} handles
          </Typography>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={handleCloseModal} variant="outlined" sx={{ borderRadius: '12px', fontWeight: 750, textTransform: 'none' }}>
              Close
            </Button>
            <Button
              onClick={() => handleCopyAppUsers(modalApp, filteredModalUsers.length > 0 ? filteredModalUsers : modalUsers, modalMode === 'live')}
              variant="contained"
              startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
              sx={{
                borderRadius: '12px',
                fontWeight: 800,
                textTransform: 'none',
                bgcolor: modalMode === 'live' ? '#10b981' : 'primary.main',
                '&:hover': { bgcolor: modalMode === 'live' ? '#059669' : undefined },
              }}
            >
              {modalMode === 'live' ? 'Copy Live Report' : 'Copy All Filtered'}
            </Button>
          </Box>
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
