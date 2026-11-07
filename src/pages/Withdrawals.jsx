import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  CircularProgress,
  Grid,
  Divider,
  useTheme,
  useMediaQuery,
  Avatar,
  Chip,
  Tooltip,
  Snackbar,
  Alert,
  InputAdornment,
} from '@mui/material';

// Material Icons
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import PersonIcon from '@mui/icons-material/Person';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DoneIcon from '@mui/icons-material/Done';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import StorefrontIcon from '@mui/icons-material/Storefront';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PaymentsIcon from '@mui/icons-material/Payments';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import { supabase } from '../supabaseClient';
import { getApiBaseUrl, getApiHeaders } from '../utils/apiConfig';

const formatINR = (val) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(val || 0));
};

export default function Withdrawals() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState([]);

  // Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'upi' | 'bank' | 'high_value'
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'amount_desc'

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Modals
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);

  // Inputs
  const [utrInput, setUtrInput] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  const showToast = (message, severity = 'success') => {
    setToast({ open: true, message, severity });
  };
  const handleCloseToast = (event, reason) => {
    if (reason === 'clickaway') return;
    setToast((prev) => ({ ...prev, open: false }));
  };

  const copyToClipboard = (text, keyName, label = 'Copied') => {
    if (!text) return;
    navigator.clipboard.writeText(String(text).trim());
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
    showToast(`${label}: ${text}`, 'info');
  };

  const formatDateTime = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return {
        date: d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }),
        time: d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }),
      };
    } catch (e) {
      return { date: 'N/A', time: 'N/A' };
    }
  };

  const fetchData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data: withdrawals, error: wErr } = await supabase
        .from('individual_wallet_transactions')
        .select('*')
        .eq('status', 'Pending')
        .eq('transaction_type', 'Debit')
        .ilike('description', 'Withdrawal:%')
        .order('created_at', { ascending: false });

      if (wErr) throw wErr;

      // Manually fetch earner profiles
      const earnerIds = [...new Set((withdrawals || []).map((w) => w.earner_id))].filter(Boolean);
      let profilesMap = {};
      if (earnerIds.length > 0) {
        const { data: profiles, error: pErr } = await supabase
          .from('profiles')
          .select('earner_id, first_name, last_name, email, phone, bulker_id, fcm_token')
          .in('earner_id', earnerIds);

        if (!pErr && profiles) {
          profiles.forEach((p) => {
            profilesMap[p.earner_id] = p;
          });
        }
      }

      const { data: bulkers } = await supabase.from('bulker_desks').select('bulker_id, full_name');

      const combined = (withdrawals || []).map((w) => {
        const profile = profilesMap[w.earner_id] || {};

        let bulkerMatch = null;
        if (profile.bulker_id) {
          const searchId = profile.bulker_id.startsWith('NOVAIRA/BULKER/')
            ? profile.bulker_id
            : 'NOVAIRA/BULKER/' + profile.bulker_id;
          bulkerMatch = (bulkers || []).find((b) => b.bulker_id === searchId);
        }
        const bulker = bulkerMatch || {};

        let parsedDetails = {};
        if (w.payout_details) {
          try {
            parsedDetails = typeof w.payout_details === 'string' ? JSON.parse(w.payout_details) : w.payout_details;
          } catch (e) {
            console.error('Failed to parse payout_details', e);
          }
        }

        return {
          ...w,
          user_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Novaira Earner',
          email: profile.email || 'N/A',
          phone: profile.phone || 'N/A',
          bulker_name: bulker.full_name || 'Direct / Platform',
          payoutData: parsedDetails,
          profile,
        };
      });

      setTransactions(combined);
      if (isManualRefresh) {
        showToast(`Queue refreshed: ${combined.length} pending withdrawals`, 'success');
      }
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openPayModal = (tx) => {
    setSelectedTx(tx);
    setUtrInput('');
    setPayModalOpen(true);
  };

  const openCancelModal = (tx) => {
    setSelectedTx(tx);
    setCancelReason('');
    setCancelModalOpen(true);
  };

  const handlePaySubmit = async () => {
    if (!utrInput.trim()) {
      return showToast('Please enter a valid UTR / Transaction ID', 'warning');
    }
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('individual_wallet_transactions')
        .update({
          status: 'Completed',
          utr_id: utrInput.trim(),
          created_at: new Date().toISOString(),
        })
        .eq('id', selectedTx.id);

      if (error) throw error;

      // Sync to company fund transactions ledger
      try {
        const { data: existingFundTx } = await supabase
          .from('company_fund_transactions')
          .select('id')
          .or(`transaction_id.eq.${selectedTx.transaction_id},related_transaction_id.eq.${selectedTx.id}`)
          .limit(1)
          .maybeSingle();

        const fundPayload = {
          transaction_id: selectedTx.transaction_id,
          transaction_type: 'Debit',
          amount: Number(selectedTx.amount || 0),
          reference_type: 'individual_wallet',
          reference_id: selectedTx.earner_id,
          party_type: 'individual',
          party_id: selectedTx.earner_id,
          description: selectedTx.description || 'Individual withdrawal payout',
          status: 'Completed',
          created_at: new Date().toISOString(),
          related_transaction_id: selectedTx.id,
          metadata: {
            earner_id: selectedTx.earner_id,
            utr_id: utrInput.trim(),
            payout_details: selectedTx.payoutData || selectedTx.payout_details || null,
            source_table: 'individual_wallet_transactions',
          },
        };

        if (existingFundTx?.id) {
          await supabase.from('company_fund_transactions').update(fundPayload).eq('id', existingFundTx.id);
        } else {
          await supabase.from('company_fund_transactions').insert(fundPayload);
        }
      } catch (fundErr) {
        console.error('Failed to sync to company_fund_transactions:', fundErr);
      }

      // Send push notification
      fetch(`${getApiBaseUrl()}/api/send-notification`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          earner_id: selectedTx.earner_id,
          fcm_token: selectedTx.profile?.fcm_token || null,
          title: 'Withdrawal Processed',
          type: 'wallet',
          body: `Your withdrawal of ₹${selectedTx.amount} has been successfully paid via ${
            selectedTx.payoutData?.account_type || 'Bank'
          }. UTR: ${utrInput.trim()}`,
        }),
      }).catch((err) => console.error('Push notification failed:', err));

      showToast(`Payment marked as Completed! UTR: ${utrInput.trim()}`, 'success');
      setPayModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSubmit = async () => {
    if (!cancelReason.trim()) {
      return showToast('Please provide a reason for cancellation', 'warning');
    }
    setActionLoading(true);
    try {
      const newDesc = `${selectedTx.description} | Cancelled Reason: ${cancelReason.trim()}`;
      const { error } = await supabase
        .from('individual_wallet_transactions')
        .update({
          status: 'Cancelled',
          description: newDesc,
        })
        .eq('id', selectedTx.id);

      if (error) throw error;

      // Update company fund ledger to cancelled
      try {
        await supabase
          .from('company_fund_transactions')
          .update({
            status: 'Cancelled',
            description: newDesc,
          })
          .or(`transaction_id.eq.${selectedTx.transaction_id},related_transaction_id.eq.${selectedTx.id}`);
      } catch (fundErr) {
        console.error('Failed to update company_fund_transactions on cancel:', fundErr);
      }

      // Send push notification
      fetch(`${getApiBaseUrl()}/api/send-notification`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          earner_id: selectedTx.earner_id,
          fcm_token: selectedTx.profile?.fcm_token || null,
          title: 'Withdrawal Cancelled',
          type: 'wallet',
          body: `Your withdrawal of ₹${selectedTx.amount} was cancelled. Reason: ${cancelReason.trim()}`,
        }),
      }).catch((err) => console.error('Push notification failed:', err));

      showToast('Withdrawal request cancelled & notification dispatched.', 'info');
      setCancelModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const generateUPIQR = (details, amount) => {
    if (details?.account_type !== 'UPI' || !details?.account_number) return null;
    const upiUri = `upi://pay?pa=${details.account_number.trim()}&pn=${encodeURIComponent(
      details.account_name || 'Novaira Earner',
    )}&am=${amount}&cu=INR`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUri)}`;
  };

  // Filtered & Sorted Transactions
  const filteredTransactions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return transactions
      .filter((row) => {
        const payout = row.payoutData || {};
        const matchesSearch =
          !q ||
          row.user_name.toLowerCase().includes(q) ||
          row.earner_id.toLowerCase().includes(q) ||
          (row.phone && row.phone.includes(q)) ||
          row.bulker_name.toLowerCase().includes(q) ||
          (payout.account_name && payout.account_name.toLowerCase().includes(q)) ||
          (payout.account_number && payout.account_number.toLowerCase().includes(q)) ||
          (payout.bank_name && payout.bank_name.toLowerCase().includes(q));

        let matchesFilter = true;
        if (filterType === 'upi') matchesFilter = payout.account_type === 'UPI';
        if (filterType === 'bank') matchesFilter = payout.account_type !== 'UPI';
        if (filterType === 'high_value') matchesFilter = Number(row.amount) >= 500;

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (sortBy === 'amount_desc') return Number(b.amount) - Number(a.amount);
        return 0;
      });
  }, [transactions, searchQuery, filterType, sortBy]);

  const paginatedTransactions = filteredTransactions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  // Financial Telemetry Metrics
  const totalPendingLiability = transactions.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const upiCount = transactions.filter((t) => t.payoutData?.account_type === 'UPI').length;
  const bankCount = transactions.length - upiCount;
  const avgTicket = transactions.length > 0 ? totalPendingLiability / transactions.length : 0;

  return (
    <Box sx={{ maxWidth: 1440, mx: 'auto', p: { xs: 1.5, md: 3 }, pb: 12 }}>
      {/* EXECUTIVE HEADER */}
      <Box
        sx={{
          mb: 3.5,
          display: 'flex',
          alignItems: { xs: 'flex-start', md: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          flexDirection: { xs: 'column', md: 'row' },
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5, flexWrap: 'wrap' }}>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.03em' }}>
              Withdrawal Settlements
            </Typography>
            <Chip
              size="small"
              icon={<Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#f59e0b', boxShadow: '0 0 8px #f59e0b' }} />}
              label="ACTIVE PAYOUT PIPELINE"
              sx={{
                height: 24,
                fontSize: '0.66rem',
                fontWeight: 800,
                letterSpacing: '0.04em',
                bgcolor: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.10)',
                color: '#f59e0b',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
            Audit, verify beneficiary bank/UPI details, and record manual UTR disbursement.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon className={refreshing ? 'spin' : ''} />}
            onClick={() => fetchData(true)}
            disabled={loading || refreshing}
            sx={{
              borderRadius: '14px',
              textTransform: 'none',
              fontWeight: 750,
              fontSize: '0.84rem',
              px: 2,
              py: 0.9,
              borderColor: 'divider',
            }}
          >
            {refreshing ? 'Syncing...' : 'Refresh Queue'}
          </Button>
        </Stack>
      </Box>

      {/* 4 FINTECH KPI TELEMETRY PODS */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <Box
            sx={{
              p: 2.5,
              borderRadius: '22px',
              bgcolor: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.28)',
              backdropFilter: 'blur(16px)',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Box
              sx={{
                width: 46,
                height: 46,
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#f59e0b',
                color: '#fff',
                boxShadow: '0 6px 20px rgba(245, 158, 11, 0.4)',
              }}
            >
              <AccountBalanceWalletIcon />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.68rem', display: 'block' }}>
                Pending Liability
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, color: isDark ? '#f8fafc' : '#0f172a', mt: 0.3 }}>
                {formatINR(totalPendingLiability)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                Total pending payout volume
              </Typography>
            </Box>
          </Box>
        </Grid>

        <Grid item xs={12} sm={6} lg={3}>
          <Box
            sx={{
              p: 2.5,
              borderRadius: '22px',
              bgcolor: isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.28)',
              backdropFilter: 'blur(16px)',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Box
              sx={{
                width: 46,
                height: 46,
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#3b82f6',
                color: '#fff',
                boxShadow: '0 6px 20px rgba(59, 130, 246, 0.4)',
              }}
            >
              <PaymentsIcon />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#3b82f6', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.68rem', display: 'block' }}>
                Queue Length
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, color: isDark ? '#f8fafc' : '#0f172a', mt: 0.3 }}>
                {transactions.length} Requests
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                Awaiting manual disbursement
              </Typography>
            </Box>
          </Box>
        </Grid>

        <Grid item xs={12} sm={6} lg={3}>
          <Box
            sx={{
              p: 2.5,
              borderRadius: '22px',
              bgcolor: isDark ? 'rgba(139, 92, 246, 0.12)' : 'rgba(139, 92, 246, 0.08)',
              border: '1px solid rgba(139, 92, 246, 0.28)',
              backdropFilter: 'blur(16px)',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Box
              sx={{
                width: 46,
                height: 46,
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#8b5cf6',
                color: '#fff',
                boxShadow: '0 6px 20px rgba(139, 92, 246, 0.4)',
              }}
            >
              <PhoneAndroidIcon />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#8b5cf6', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.68rem', display: 'block' }}>
                Channel Breakdown
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, color: isDark ? '#f8fafc' : '#0f172a', mt: 0.3 }}>
                {upiCount} UPI • {bankCount} Bank
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                {Math.round((upiCount / (transactions.length || 1)) * 100)}% UPI digital payouts
              </Typography>
            </Box>
          </Box>
        </Grid>

        <Grid item xs={12} sm={6} lg={3}>
          <Box
            sx={{
              p: 2.5,
              borderRadius: '22px',
              bgcolor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.28)',
              backdropFilter: 'blur(16px)',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Box
              sx={{
                width: 46,
                height: 46,
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#10b981',
                color: '#fff',
                boxShadow: '0 6px 20px rgba(16, 185, 129, 0.4)',
              }}
            >
              <AccessTimeIcon />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.68rem', display: 'block' }}>
                Average Ticket
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, color: isDark ? '#f8fafc' : '#0f172a', mt: 0.3 }}>
                {formatINR(avgTicket)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                Per settlement transaction
              </Typography>
            </Box>
          </Box>
        </Grid>
      </Grid>

      {/* FILTER & SEARCH CONTROL BAR */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2.5,
          borderRadius: '20px',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
          bgcolor: isDark ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <TextField
          size="small"
          placeholder="Search earner name, ID, phone, UPI address, bank account..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(0);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary', fontSize: '1.15rem' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            flexGrow: 1,
            minWidth: 260,
            '& .MuiOutlinedInput-root': {
              borderRadius: '12px',
              fontSize: '0.84rem',
            },
          }}
        />

        {/* Filter Pills */}
        <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
          {[
            { id: 'all', label: 'All Requests' },
            { id: 'upi', label: 'UPI Payouts' },
            { id: 'bank', label: 'Bank / IMPS' },
            { id: 'high_value', label: '≥ ₹500' },
          ].map((f) => {
            const active = filterType === f.id;
            return (
              <Chip
                key={f.id}
                label={f.label}
                size="small"
                onClick={() => {
                  setFilterType(f.id);
                  setPage(0);
                }}
                sx={{
                  fontWeight: 750,
                  fontSize: '0.72rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  bgcolor: active
                    ? isDark
                      ? 'rgba(245, 158, 11, 0.25)'
                      : 'rgba(245, 158, 11, 0.15)'
                    : isDark
                    ? 'rgba(255, 255, 255, 0.04)'
                    : 'rgba(0, 0, 0, 0.04)',
                  color: active ? '#f59e0b' : 'text.secondary',
                  border: active ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid transparent',
                }}
              />
            );
          })}

          <Button
            size="small"
            variant="outlined"
            startIcon={<SwapVertIcon fontSize="small" />}
            onClick={() => {
              if (sortBy === 'newest') setSortBy('amount_desc');
              else if (sortBy === 'amount_desc') setSortBy('oldest');
              else setSortBy('newest');
            }}
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.72rem',
              py: 0.4,
              px: 1.2,
            }}
          >
            {sortBy === 'newest' ? 'Newest' : sortBy === 'amount_desc' ? 'Amount High' : 'Oldest'}
          </Button>
        </Stack>
      </Paper>

      {/* MAIN DATA SECTION */}
      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 12, gap: 2 }}>
          <CircularProgress size={36} thickness={4} />
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
            Loading pending withdrawals pipeline...
          </Typography>
        </Box>
      ) : filteredTransactions.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 8,
            textAlign: 'center',
            borderRadius: '24px',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
            bgcolor: isDark ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.85)',
          }}
        >
          <AccountBalanceWalletIcon sx={{ fontSize: 52, opacity: 0.25, mb: 2, color: 'text.secondary' }} />
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
            No pending withdrawal requests
          </Typography>
          <Typography variant="body2" color="text.secondary">
            All earner payout requests have been settled or match your current filter parameters.
          </Typography>
        </Paper>
      ) : isMobile ? (
        /* MOBILE VIEW: FROSTED GLASS CARDS */
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {paginatedTransactions.map((row) => {
            const isUPI = row.payoutData?.account_type === 'UPI';

            return (
              <Paper
                key={row.id}
                elevation={0}
                sx={{
                  p: 2.2,
                  borderRadius: '20px',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
                  bgcolor: isDark ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(16px)',
                }}
              >
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                    <Avatar
                      sx={{
                        width: 36,
                        height: 36,
                        background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                        fontWeight: 800,
                        fontSize: '0.84rem',
                      }}
                    >
                      {row.user_name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        {row.user_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                        {row.earner_id}
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 900, color: '#10b981' }}>
                    ₹{row.amount}
                  </Typography>
                </Box>

                <Divider sx={{ my: 1.5, opacity: 0.5 }} />

                {/* Beneficiary Details */}
                <Box sx={{ mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.5 }}>
                    <Chip
                      icon={isUPI ? <PhoneAndroidIcon sx={{ fontSize: '12px !important' }} /> : <AccountBalanceIcon sx={{ fontSize: '12px !important' }} />}
                      label={isUPI ? 'UPI PAYOUT' : 'BANK ACCOUNT'}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        bgcolor: isUPI ? 'rgba(139, 92, 246, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: isUPI ? '#8b5cf6' : '#3b82f6',
                        borderRadius: '6px',
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {formatDateTime(row.created_at).date} • {formatDateTime(row.created_at).time}
                    </Typography>
                  </Box>

                  <Typography variant="body2" sx={{ fontWeight: 750 }}>
                    {row.payoutData?.account_name || 'N/A'}
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mt: 0.3 }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, color: isDark ? '#93c5fd' : '#1d4ed8' }}>
                      {row.payoutData?.account_number || 'N/A'}
                    </Typography>
                    <IconButton size="small" onClick={() => copyToClipboard(row.payoutData?.account_number, `mob_${row.id}`, 'Account/UPI')}>
                      {copiedKey === `mob_${row.id}` ? <DoneIcon sx={{ fontSize: 13, color: '#10b981' }} /> : <ContentCopyIcon sx={{ fontSize: 13 }} />}
                    </IconButton>
                  </Box>

                  {!isUPI && row.payoutData?.bank_name && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
                      {row.payoutData.bank_name} • IFSC: {row.payoutData.ifsc_code}
                    </Typography>
                  )}
                </Box>

                {/* Actions */}
                <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<CheckCircleIcon />}
                    onClick={() => openPayModal(row)}
                    sx={{
                      borderRadius: '12px',
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      textTransform: 'none',
                    }}
                  >
                    Pay ₹{row.amount}
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<CancelIcon />}
                    onClick={() => openCancelModal(row)}
                    sx={{ borderRadius: '12px', fontWeight: 750, textTransform: 'none', px: 2 }}
                  >
                    Reject
                  </Button>
                </Stack>
              </Paper>
            );
          })}

          <TablePagination
            component="div"
            count={filteredTransactions.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </Box>
      ) : (
        /* DESKTOP VIEW: HIGH-DENSITY FINTECH SETTLEMENT TABLE */
        <Paper
          elevation={0}
          sx={{
            borderRadius: '24px',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
            bgcolor: isDark ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(16px)',
            overflow: 'hidden',
          }}
        >
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(15, 23, 42, 0.02)' }}>
                <TableRow>
                  <TableCell sx={{ py: 1.5, px: 2, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Request Date
                  </TableCell>
                  <TableCell sx={{ py: 1.5, px: 2, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Earner Identity
                  </TableCell>
                  <TableCell sx={{ py: 1.5, px: 2, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Bulker Desk
                  </TableCell>
                  <TableCell sx={{ py: 1.5, px: 2, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Beneficiary Account Details
                  </TableCell>
                  <TableCell align="right" sx={{ py: 1.5, px: 2, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', width: 140 }}>
                    Amount
                  </TableCell>
                  <TableCell align="center" sx={{ py: 1.5, px: 2, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', width: 160 }}>
                    Settlement Action
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedTransactions.map((row) => {
                  const isUPI = row.payoutData?.account_type === 'UPI';
                  const dt = formatDateTime(row.created_at);

                  return (
                    <TableRow
                      key={row.id}
                      hover
                      sx={{
                        transition: 'background-color 0.15s ease',
                        '&:hover': {
                          bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.02)',
                        },
                      }}
                    >
                      {/* Date & Time */}
                      <TableCell sx={{ py: 1.5, px: 2, whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>
                          {dt.date}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                          {dt.time}
                        </Typography>
                      </TableCell>

                      {/* Earner Identity */}
                      <TableCell sx={{ py: 1.5, px: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                          <Avatar
                            sx={{
                              width: 34,
                              height: 34,
                              background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                              fontWeight: 800,
                              fontSize: '0.8rem',
                            }}
                          >
                            {row.user_name.charAt(0).toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '0.82rem', lineHeight: 1.2 }}>
                              {row.user_name}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2 }}>
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', color: isDark ? '#93c5fd' : '#1d4ed8', fontSize: '0.72rem' }}>
                                {row.earner_id}
                              </Typography>
                              <Tooltip title={copiedKey === `eid_${row.id}` ? 'Copied!' : 'Copy Earner ID'}>
                                <IconButton size="small" onClick={() => copyToClipboard(row.earner_id, `eid_${row.id}`, 'Earner ID')} sx={{ p: 0.3 }}>
                                  {copiedKey === `eid_${row.id}` ? <DoneIcon sx={{ fontSize: 11, color: '#10b981' }} /> : <ContentCopyIcon sx={{ fontSize: 11 }} />}
                                </IconButton>
                              </Tooltip>
                            </Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem', display: 'block' }}>
                              {row.phone}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>

                      {/* Bulker */}
                      <TableCell sx={{ py: 1.5, px: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                          <StorefrontIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                          <Typography variant="body2" sx={{ fontWeight: 650, fontSize: '0.78rem' }}>
                            {row.bulker_name}
                          </Typography>
                        </Box>
                      </TableCell>

                      {/* Beneficiary Details */}
                      <TableCell sx={{ py: 1.5, px: 2 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                            <Chip
                              icon={isUPI ? <PhoneAndroidIcon sx={{ fontSize: '11px !important' }} /> : <AccountBalanceIcon sx={{ fontSize: '11px !important' }} />}
                              label={isUPI ? 'UPI' : 'BANK'}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.6rem',
                                fontWeight: 800,
                                bgcolor: isUPI ? 'rgba(139, 92, 246, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                color: isUPI ? '#8b5cf6' : '#3b82f6',
                                borderRadius: '4px',
                              }}
                            />
                            <Typography variant="body2" sx={{ fontWeight: 750, fontSize: '0.8rem' }}>
                              {row.payoutData?.account_name || 'N/A'}
                            </Typography>
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.82rem', color: isDark ? '#93c5fd' : '#1d4ed8' }}>
                              {row.payoutData?.account_number || 'N/A'}
                            </Typography>
                            <Tooltip title={copiedKey === `acc_${row.id}` ? 'Copied!' : 'Copy Account / UPI'}>
                              <IconButton size="small" onClick={() => copyToClipboard(row.payoutData?.account_number, `acc_${row.id}`, 'Account/UPI')} sx={{ p: 0.3 }}>
                                {copiedKey === `acc_${row.id}` ? <DoneIcon sx={{ fontSize: 12, color: '#10b981' }} /> : <ContentCopyIcon sx={{ fontSize: 12 }} />}
                              </IconButton>
                            </Tooltip>
                          </Box>

                          {!isUPI && (row.payoutData?.bank_name || row.payoutData?.ifsc_code) && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.72rem', color: 'text.secondary' }}>
                              <span>{row.payoutData?.bank_name}</span>
                              {row.payoutData?.ifsc_code && (
                                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.3 }}>
                                  <strong>IFSC:</strong>
                                  <span style={{ fontFamily: 'monospace' }}>{row.payoutData.ifsc_code}</span>
                                  <IconButton size="small" onClick={() => copyToClipboard(row.payoutData.ifsc_code, `ifsc_${row.id}`, 'IFSC')} sx={{ p: 0.2 }}>
                                    {copiedKey === `ifsc_${row.id}` ? <DoneIcon sx={{ fontSize: 11, color: '#10b981' }} /> : <ContentCopyIcon sx={{ fontSize: 11 }} />}
                                  </IconButton>
                                </Box>
                              )}
                            </Box>
                          )}
                        </Box>
                      </TableCell>

                      {/* Amount */}
                      <TableCell align="right" sx={{ py: 1.5, px: 2 }}>
                        <Typography variant="body1" sx={{ fontWeight: 900, fontSize: '1.05rem', color: '#10b981' }}>
                          ₹{parseFloat(row.amount).toFixed(2)}
                        </Typography>
                      </TableCell>

                      {/* Settlement Action */}
                      <TableCell align="center" sx={{ py: 1.5, px: 2 }}>
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
                            onClick={() => openPayModal(row)}
                            sx={{
                              borderRadius: '10px',
                              px: 1.8,
                              py: 0.6,
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              textTransform: 'none',
                              background: 'linear-gradient(135deg, #10b981, #059669)',
                              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                              '&:hover': {
                                background: 'linear-gradient(135deg, #059669, #047857)',
                              },
                            }}
                          >
                            Pay
                          </Button>
                          <Tooltip title="Reject / Cancel request">
                            <IconButton
                              size="small"
                              onClick={() => openCancelModal(row)}
                              sx={{
                                color: 'error.main',
                                bgcolor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.08)',
                                borderRadius: '10px',
                                p: 0.7,
                                '&:hover': {
                                  bgcolor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.15)',
                                },
                              }}
                            >
                              <CancelIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={filteredTransactions.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50]}
            sx={{
              borderTop: `1px solid ${theme.palette.divider}`,
              '& .MuiTablePagination-toolbar': { minHeight: 46, px: 2 },
            }}
          />
        </Paper>
      )}

      {/* PAY & SETTLE MODAL (2-COLUMN COMPACT LAYOUT - NO SCROLL) */}
      <Dialog
        open={payModalOpen}
        onClose={() => !actionLoading && setPayModalOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{
          backdrop: {
            sx: {
              backdropFilter: 'blur(8px)',
              backgroundColor: isDark ? 'rgba(2, 6, 23, 0.65)' : 'rgba(15, 23, 42, 0.35)',
            },
          },
        }}
        PaperProps={{
          sx: {
            borderRadius: '24px',
            border: `1px solid ${theme.palette.divider}`,
            bgcolor: 'background.paper',
            p: 1,
            maxHeight: '92vh',
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, pt: 1.5, px: 2.5, fontWeight: 900, fontSize: '1.15rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                bgcolor: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PaymentsIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 850, lineHeight: 1.2 }}>
                Process Payout Settlement
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Verify beneficiary credentials and record UTR transaction
              </Typography>
            </Box>
          </Box>
          {selectedTx && (
            <Chip
              label={selectedTx.payoutData?.account_type === 'UPI' ? 'UPI INSTANT QR' : 'BANK IMPS / NEFT'}
              size="small"
              sx={{
                fontWeight: 800,
                fontSize: '0.66rem',
                bgcolor: selectedTx.payoutData?.account_type === 'UPI' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                color: selectedTx.payoutData?.account_type === 'UPI' ? '#8b5cf6' : '#3b82f6',
                border: `1px solid ${selectedTx.payoutData?.account_type === 'UPI' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
              }}
            />
          )}
        </DialogTitle>

        <DialogContent sx={{ pt: '10px !important', px: 2.5, pb: 1.5, overflowY: 'auto' }}>
          {selectedTx && (
            <Grid container spacing={2.5} alignItems="stretch">
              {/* LEFT COLUMN: QR CODE (UPI) OR BANK BADGE */}
              <Grid item xs={12} md={5}>
                {selectedTx.payoutData?.account_type === 'UPI' ? (
                  <Box
                    sx={{
                      height: '100%',
                      p: 2,
                      borderRadius: '20px',
                      border: '1px solid rgba(139, 92, 246, 0.25)',
                      bgcolor: isDark ? 'rgba(139, 92, 246, 0.06)' : 'rgba(139, 92, 246, 0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.3 }}>
                      Scan & Pay via Any UPI App
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem', mb: 1.5, display: 'block' }}>
                      GPay • PhonePe • Paytm • BHIM
                    </Typography>

                    {/* QR Code Container */}
                    <Box
                      sx={{
                        p: 1.2,
                        bgcolor: '#fff',
                        borderRadius: '16px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                        border: '2px solid rgba(139, 92, 246, 0.2)',
                        lineHeight: 0,
                      }}
                    >
                      <img
                        src={generateUPIQR(selectedTx.payoutData, selectedTx.amount)}
                        alt="UPI QR Code"
                        style={{ width: '160px', height: '160px', display: 'block', borderRadius: '8px' }}
                      />
                    </Box>

                    <Chip
                      label={`Amount: ₹${selectedTx.amount}`}
                      size="small"
                      sx={{
                        mt: 1.5,
                        fontWeight: 900,
                        fontSize: '0.75rem',
                        bgcolor: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                      }}
                    />

                    {/* UPI String Quick Action */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 1 }}>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.72rem', color: isDark ? '#c4b5fd' : '#7c3aed' }}>
                        {selectedTx.payoutData?.account_number}
                      </Typography>
                      <Tooltip title="Copy UPI VPA">
                        <IconButton
                          size="small"
                          onClick={() => copyToClipboard(selectedTx.payoutData?.account_number, 'modal_qr_vpa', 'UPI ID')}
                          sx={{ p: 0.3 }}
                        >
                          {copiedKey === 'modal_qr_vpa' ? <DoneIcon sx={{ fontSize: 13, color: '#10b981' }} /> : <ContentCopyIcon sx={{ fontSize: 13 }} />}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      height: '100%',
                      p: 2.5,
                      borderRadius: '20px',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      bgcolor: isDark ? 'rgba(59, 130, 246, 0.06)' : 'rgba(59, 130, 246, 0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: '12px',
                            bgcolor: 'rgba(59, 130, 246, 0.15)',
                            color: '#3b82f6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <AccountBalanceIcon fontSize="small" />
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#3b82f6', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.68rem', display: 'block' }}>
                            Bank IMPS / NEFT
                          </Typography>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                            {selectedTx.payoutData?.bank_name || 'Commercial Bank'}
                          </Typography>
                        </Box>
                      </Box>

                      <Divider sx={{ my: 1.5, opacity: 0.5 }} />

                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.68rem' }}>
                            A/C NUMBER
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 850, fontSize: '0.9rem', color: isDark ? '#93c5fd' : '#1d4ed8' }}>
                              {selectedTx.payoutData?.account_number || 'N/A'}
                            </Typography>
                            <IconButton size="small" onClick={() => copyToClipboard(selectedTx.payoutData?.account_number, 'bank_acc_left', 'A/C Number')}>
                              {copiedKey === 'bank_acc_left' ? <DoneIcon sx={{ fontSize: 13, color: '#10b981' }} /> : <ContentCopyIcon sx={{ fontSize: 13 }} />}
                            </IconButton>
                          </Box>
                        </Box>

                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.68rem' }}>
                            IFSC CODE
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 850, fontSize: '0.9rem' }}>
                              {selectedTx.payoutData?.ifsc_code || 'N/A'}
                            </Typography>
                            <IconButton size="small" onClick={() => copyToClipboard(selectedTx.payoutData?.ifsc_code, 'bank_ifsc_left', 'IFSC Code')}>
                              {copiedKey === 'bank_ifsc_left' ? <DoneIcon sx={{ fontSize: 13, color: '#10b981' }} /> : <ContentCopyIcon sx={{ fontSize: 13 }} />}
                            </IconButton>
                          </Box>
                        </Box>
                      </Box>
                    </Box>

                    <Alert severity="info" sx={{ mt: 2, borderRadius: '12px', fontSize: '0.72rem', py: 0.5 }}>
                      Disburse via corporate netbanking portal, then enter UTR on the right.
                    </Alert>
                  </Box>
                )}
              </Grid>

              {/* RIGHT COLUMN: BENEFICIARY DETAILS & UTR SUBMIT FORM */}
              <Grid item xs={12} md={7}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.8, height: '100%', justifyContent: 'space-between' }}>
                  {/* Amount Pod */}
                  <Box
                    sx={{
                      p: 1.8,
                      borderRadius: '16px',
                      bgcolor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Box>
                      <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.66rem', display: 'block' }}>
                        Disbursement Amount
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 900, color: '#10b981', mt: 0.2 }}>
                        ₹{selectedTx.amount}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.68rem' }}>
                        Earner ID
                      </Typography>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 750, color: isDark ? '#93c5fd' : '#1d4ed8' }}>
                        {selectedTx.earner_id}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Beneficiary Details Pod */}
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.8,
                      borderRadius: '16px',
                      bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(15, 23, 42, 0.02)',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, textTransform: 'uppercase', color: 'text.secondary', letterSpacing: '0.04em', fontSize: '0.68rem' }}>
                        Beneficiary Info
                      </Typography>
                      <Button
                        size="small"
                        startIcon={<ContentCopyIcon sx={{ fontSize: '11px !important' }} />}
                        onClick={() => {
                          const txt = `${selectedTx.payoutData?.account_name} | ${selectedTx.payoutData?.account_number} | ${selectedTx.payoutData?.ifsc_code || ''}`;
                          copyToClipboard(txt, 'all_details', 'All Beneficiary Info');
                        }}
                        sx={{ textTransform: 'none', fontSize: '0.68rem', py: 0.1, px: 1, minHeight: 22 }}
                      >
                        Copy All
                      </Button>
                    </Box>

                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
                          Account Holder Name
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 750, fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selectedTx.payoutData?.account_name || selectedTx.user_name}
                        </Typography>
                      </Grid>

                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
                          Account / UPI VPA
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.82rem', color: isDark ? '#93c5fd' : '#1d4ed8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selectedTx.payoutData?.account_number || 'N/A'}
                          </Typography>
                          <IconButton size="small" onClick={() => copyToClipboard(selectedTx.payoutData?.account_number, 'modal_acc_right', 'Account')} sx={{ p: 0.2 }}>
                            {copiedKey === 'modal_acc_right' ? <DoneIcon sx={{ fontSize: 11, color: '#10b981' }} /> : <ContentCopyIcon sx={{ fontSize: 11 }} />}
                          </IconButton>
                        </Box>
                      </Grid>

                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
                          Phone Number
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 650, fontSize: '0.78rem' }}>
                          {selectedTx.phone || 'N/A'}
                        </Typography>
                      </Grid>

                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
                          Assigned Bulker
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 650, fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selectedTx.bulker_name || 'Direct'}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Paper>

                  {/* UTR Input Section */}
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 0.6, fontSize: '0.72rem' }}>
                      BANK SETTLEMENT REFERENCE (UTR ID) *
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Paste 12-digit UTR ID (e.g. 402918274619)"
                      value={utrInput}
                      onChange={(e) => setUtrInput(e.target.value)}
                      required
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '14px',
                          fontWeight: 800,
                          fontSize: '0.88rem',
                        },
                      }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.66rem', mt: 0.5, display: 'block' }}>
                      An automated push notification with this UTR will be dispatched to the earner app immediately.
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 2.5, pb: 2, pt: 1, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => setPayModalOpen(false)}
            disabled={actionLoading}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handlePaySubmit}
            disabled={actionLoading || !utrInput.trim()}
            startIcon={actionLoading ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
            sx={{
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 850,
              px: 2.5,
              py: 1,
              background: 'linear-gradient(135deg, #10b981, #059669)',
              boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
            }}
          >
            {actionLoading ? 'Recording Settlement...' : 'Confirm Payment Completed'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* CANCEL / REJECT MODAL */}
      <Dialog
        open={cancelModalOpen}
        onClose={() => !actionLoading && setCancelModalOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          backdrop: {
            sx: {
              backdropFilter: 'blur(8px)',
              backgroundColor: isDark ? 'rgba(2, 6, 23, 0.65)' : 'rgba(15, 23, 42, 0.35)',
            },
          },
        }}
        PaperProps={{
          sx: {
            borderRadius: '24px',
            border: `1px solid ${theme.palette.divider}`,
            p: 1,
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 900, color: 'error.main' }}>
          Reject Withdrawal Request
        </DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Are you sure you want to cancel the withdrawal of <strong>₹{selectedTx?.amount}</strong> for{' '}
            <strong>{selectedTx?.user_name}</strong>?
          </Typography>

          {/* Quick preset reason chips */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 0.8 }}>
              QUICK REASON PRESETS
            </Typography>
            <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap', gap: 0.6 }}>
              {['Invalid UPI ID', 'Bank Account / IFSC Mismatch', 'Account Inactive', 'Suspicious Activity'].map((preset) => (
                <Chip
                  key={preset}
                  label={preset}
                  size="small"
                  onClick={() => setCancelReason(preset)}
                  sx={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'error.light', color: 'error.main' },
                  }}
                />
              ))}
            </Stack>
          </Box>

          <TextField
            fullWidth
            size="small"
            label="Cancellation Reason"
            variant="outlined"
            multiline
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Detailed explanation sent to the earner..."
            required
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '14px',
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => setCancelModalOpen(false)}
            disabled={actionLoading}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
          >
            Keep Pending
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleCancelSubmit}
            disabled={actionLoading || !cancelReason.trim()}
            startIcon={actionLoading ? <CircularProgress size={16} color="inherit" /> : <CancelIcon />}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 800 }}
          >
            {actionLoading ? 'Cancelling...' : 'Confirm Rejection'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* SNACKBAR NOTIFICATION */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseToast} severity={toast.severity} variant="filled" sx={{ borderRadius: '12px', fontWeight: 650 }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
