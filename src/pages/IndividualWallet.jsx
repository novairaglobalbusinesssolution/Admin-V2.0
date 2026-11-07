import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Avatar,
  CircularProgress,
  Snackbar,
  Alert,
  useTheme,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Tabs,
  Tab,
  Divider,
  List,
  ListItem,
  Chip,
  Slide,
  Checkbox,
  FormControlLabel,
  InputAdornment,
  Tooltip,
  Stack,
  Grid,
} from '@mui/material';

// Material Icons
import SearchIcon from '@mui/icons-material/Search';
import AddCardIcon from '@mui/icons-material/AddCard';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import HistoryIcon from '@mui/icons-material/History';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DoneIcon from '@mui/icons-material/Done';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import PhoneIcon from '@mui/icons-material/Phone';

import { supabase } from '../supabaseClient';
import { getApiBaseUrl, getApiHeaders } from '../utils/apiConfig';

const fetchAllRows = async (createQuery) => {
  const pageSize = 1000;
  const rows = [];
  let offset = 0;

  while (true) {
    const { data, error } = await createQuery().range(offset, offset + pageSize - 1);
    if (error) throw error;

    const pageRows = data || [];
    rows.push(...pageRows);
    if (pageRows.length < pageSize) return rows;

    offset += pageSize;
  }
};

const formatINR = (val) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(val || 0));
};

export default function IndividualWallet() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [balanceFilter, setBalanceFilter] = useState('all'); // 'all' | 'positive' | 'zero' | 'negative'

  // Right Slide Drawer State
  const [selectedUser, setSelectedUser] = useState(null);
  const [panelMode, setPanelMode] = useState('manage'); // 'manage' or 'history'

  const [trxType, setTrxType] = useState('Credit');
  const [syncCompanyFund, setSyncCompanyFund] = useState(true);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [processing, setProcessing] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    fetchWallets();
  }, []);

  const fetchWallets = async () => {
    setLoading(true);
    try {
      const profiles = await fetchAllRows(() =>
        supabase
          .from('profiles')
          .select('id, earner_id, first_name, last_name, phone, status')
          .order('id', { ascending: true }),
      );

      const txns = await fetchAllRows(() =>
        supabase
          .from('individual_wallet_transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false }),
      );

      setAllTransactions(txns);

      // Group balances (Status Aware)
      const balances = {};
      txns.forEach((t) => {
        if (!balances[t.earner_id]) balances[t.earner_id] = 0;
        const val = parseFloat(t.amount);
        const st = (t.status || 'Completed').toLowerCase();

        if (st === 'cancelled' || st === 'rejected') return;

        if (t.transaction_type === 'Credit' && st === 'completed') {
          balances[t.earner_id] += val;
        } else if (t.transaction_type === 'Debit') {
          balances[t.earner_id] -= val;
        }
      });

      // Merge data
      const processedUsers = profiles
        .map((p) => ({
          ...p,
          fullName: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown User',
          balance: balances[p.earner_id] || 0,
        }))
        .sort((a, b) => b.balance - a.balance);

      setUsers(processedUsers);

      // Auto-select first user if none selected
      if (processedUsers.length > 0 && !selectedUser) {
        setSelectedUser(processedUsers[0]);
        setPanelMode('manage');
      }
    } catch (err) {
      console.error(err);
      setSnack({ open: true, message: 'Failed to load wallet data.', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPanel = (user, mode = 'manage') => {
    setSelectedUser(user);
    setPanelMode(mode);
    setTrxType('Credit');
    setSyncCompanyFund(true);
    setAmount('');
    setDescription('');
  };

  const handleClosePanel = () => {
    setSelectedUser(null);
  };

  const handleCopyEarnerId = (earnerId, e) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(earnerId);
    setCopiedId(earnerId);
    setTimeout(() => setCopiedId(null), 2000);
    setSnack({ open: true, message: `Copied Earner ID: ${earnerId}`, severity: 'info' });
  };

  const handleProcessTransaction = async () => {
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setSnack({ open: true, message: 'Please enter a valid amount greater than 0.', severity: 'warning' });
      return;
    }

    setProcessing(true);
    try {
      const generateTrxId = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 16; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };

      const payload = {
        transaction_id: generateTrxId(),
        earner_id: selectedUser.earner_id,
        amount: numAmount,
        transaction_type: trxType,
        sync_to_company_fund: trxType !== 'Debit' || syncCompanyFund,
        description: description || `Manual ${trxType} by Admin`,
        status: 'Completed',
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('individual_wallet_transactions').insert([payload]);
      if (error) throw error;

      // Send Push Notification
      try {
        const baseUrl = getApiBaseUrl();
        fetch(`${baseUrl}/api/send-notification`, {
          method: 'POST',
          headers: getApiHeaders(),
          body: JSON.stringify({
            earner_id: selectedUser.earner_id,
            title: trxType === 'Credit' ? 'Wallet Credited' : 'Wallet Debited',
            body:
              trxType === 'Credit'
                ? `Your wallet has been credited with ₹${payload.amount}. Reason: ${payload.description}`
                : `Your wallet has been debited by ₹${payload.amount}. Reason: ${payload.description}`,
            type: 'wallet',
          }),
        }).catch((e) => console.warn(e));
      } catch (notifErr) {
        console.warn('Failed to send push notification:', notifErr);
      }

      // Update local state instantly
      const updatedBalance = trxType === 'Credit' ? selectedUser.balance + numAmount : selectedUser.balance - numAmount;

      setUsers((prev) =>
        prev.map((u) => {
          if (u.earner_id === selectedUser.earner_id) {
            return { ...u, balance: updatedBalance };
          }
          return u;
        }),
      );

      setAllTransactions([payload, ...allTransactions]);
      setSelectedUser({
        ...selectedUser,
        balance: updatedBalance,
      });

      setSnack({ open: true, message: `Successfully ${trxType === 'Credit' ? 'credited' : 'debited'} ₹${numAmount} for ${selectedUser.fullName}!`, severity: 'success' });
      setAmount('');
      setDescription('');
      setPanelMode('history');
    } catch (err) {
      console.error(err);
      setSnack({ open: true, message: 'Transaction Failed: ' + err.message, severity: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return users.filter((u) => {
      const matchesSearch =
        !q ||
        u.fullName.toLowerCase().includes(q) ||
        u.earner_id.toLowerCase().includes(q) ||
        (u.phone && u.phone.includes(q));

      let matchesBalance = true;
      if (balanceFilter === 'positive') matchesBalance = u.balance > 0;
      if (balanceFilter === 'zero') matchesBalance = u.balance === 0;
      if (balanceFilter === 'negative') matchesBalance = u.balance < 0;

      return matchesSearch && matchesBalance;
    });
  }, [users, searchQuery, balanceFilter]);

  const paginatedUsers = filteredUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const totalPlatformLiability = users.reduce((acc, curr) => acc + (curr.balance > 0 ? curr.balance : 0), 0);
  const topEarner = users.length > 0 ? users[0] : null;

  // New Balance Calculation Preview
  const previewAmount = parseFloat(amount) || 0;
  const previewNewBalance = selectedUser
    ? trxType === 'Credit'
      ? selectedUser.balance + previewAmount
      : selectedUser.balance - previewAmount
    : 0;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 2 }}>
        <CircularProgress size={36} thickness={4} />
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
          Synchronizing Individual Wallets...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1440, mx: 'auto', p: { xs: 1.5, md: 3 }, pb: 12 }}>
      {/* HEADER POD */}
      <Box sx={{ mb: 3.5, display: 'flex', alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5, flexWrap: 'wrap' }}>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.03em' }}>
              Individual Wallets
            </Typography>
            <Chip
              size="small"
              icon={<Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#10b981', boxShadow: '0 0 8px #10b981' }} />}
              label="EARNER ACCOUNTS ACTIVE"
              sx={{
                height: 24,
                fontSize: '0.66rem',
                fontWeight: 800,
                letterSpacing: '0.04em',
                bgcolor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.10)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.28)',
              }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
            Inspect wallet balances, credit performance bonuses, and review full transaction ledgers.
          </Typography>
        </Box>
      </Box>

      {/* 3 EXECUTIVE TELEMETRY PODS */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        <Grid item xs={12} sm={4}>
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
              <AccountBalanceWalletIcon />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.68rem', display: 'block' }}>
                Total Platform Liability
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, color: isDark ? '#f8fafc' : '#0f172a', mt: 0.3 }}>
                {formatINR(totalPlatformLiability)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                Active payout obligations to registered earners
              </Typography>
            </Box>
          </Box>
        </Grid>

        <Grid item xs={12} sm={4}>
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
              <PeopleAltIcon />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#3b82f6', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.68rem', display: 'block' }}>
                Active Wallet Holders
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, color: isDark ? '#f8fafc' : '#0f172a', mt: 0.3 }}>
                {users.length} Users
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                {users.filter((u) => u.balance > 0).length} hold a positive balance
              </Typography>
            </Box>
          </Box>
        </Grid>

        <Grid item xs={12} sm={4}>
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
              <TrendingUpIcon />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#8b5cf6', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.68rem', display: 'block' }}>
                Top Earner Balance
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, color: isDark ? '#f8fafc' : '#0f172a', mt: 0.3 }}>
                {topEarner ? formatINR(topEarner.balance) : '₹0.00'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                {topEarner?.fullName || 'N/A'} ({topEarner?.earner_id || ''})
              </Typography>
            </Box>
          </Box>
        </Grid>
      </Grid>

      {/* MAIN TWO-COLUMN LAYOUT: TABLE + RAZORPAYX ACTION DRAWER */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, position: 'relative' }}>
        {/* LEFT COLUMN: Search & Table */}
        <Box
          sx={{
            flexGrow: 1,
            transition: 'width 0.3s ease',
            overflow: 'hidden',
            width: selectedUser ? { xs: '100%', lg: 'calc(100% - 420px)' } : '100%',
          }}
        >
          {/* FILTER CONTROLS */}
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
              placeholder="Search by earner name, ID, or phone number..."
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

            {/* Balance Filter Pills */}
            <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              {[
                { id: 'all', label: 'All Users' },
                { id: 'positive', label: 'With Balance (> ₹0)' },
                { id: 'zero', label: 'Zero Balance' },
                { id: 'negative', label: 'Negative' },
              ].map((f) => {
                const active = balanceFilter === f.id;
                return (
                  <Chip
                    key={f.id}
                    label={f.label}
                    size="small"
                    onClick={() => {
                      setBalanceFilter(f.id);
                      setPage(0);
                    }}
                    sx={{
                      fontWeight: 750,
                      fontSize: '0.72rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      bgcolor: active
                        ? (isDark ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.15)')
                        : (isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'),
                      color: active ? '#10b981' : 'text.secondary',
                      border: active ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
                    }}
                  />
                );
              })}
            </Stack>
          </Paper>

          {/* TABLE */}
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
                      Earner Identity
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: 2, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Earner ID
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.5, px: 2, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Available Balance
                    </TableCell>
                    <TableCell align="center" sx={{ py: 1.5, px: 2, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', width: 140 }}>
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                        <AccountBalanceWalletIcon sx={{ fontSize: 44, opacity: 0.3, mb: 1.5 }} />
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          No earner wallets match criteria
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedUsers.map((user) => {
                      const isSelected = selectedUser?.earner_id === user.earner_id;
                      const hasBalance = user.balance > 0;
                      const isNegative = user.balance < 0;

                      return (
                        <TableRow
                          key={user.id}
                          hover
                          onClick={() => handleOpenPanel(user, 'manage')}
                          sx={{
                            cursor: 'pointer',
                            bgcolor: isSelected
                              ? (isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.06)')
                              : 'transparent',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {/* Earner Identity */}
                          <TableCell sx={{ py: 1.4, px: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Avatar
                                sx={{
                                  width: 36,
                                  height: 36,
                                  background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                                  color: '#fff',
                                  fontWeight: 800,
                                  fontSize: '0.84rem',
                                  boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)',
                                }}
                              >
                                {user.fullName.charAt(0).toUpperCase()}
                              </Avatar>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 750, fontSize: '0.84rem', lineHeight: 1.2 }}>
                                  {user.fullName}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
                                  <PhoneIcon sx={{ fontSize: 11, color: 'text.secondary' }} />
                                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                                    {user.phone || 'No phone registered'}
                                  </Typography>
                                </Box>
                              </Box>
                            </Box>
                          </TableCell>

                          {/* Earner ID */}
                          <TableCell sx={{ py: 1.4, px: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                              <Typography
                                variant="caption"
                                sx={{
                                  fontFamily: 'monospace',
                                  fontWeight: 750,
                                  fontSize: '0.76rem',
                                  px: 1,
                                  py: 0.3,
                                  borderRadius: '6px',
                                  bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.05)',
                                  color: isDark ? '#93c5fd' : '#1d4ed8',
                                }}
                              >
                                {user.earner_id}
                              </Typography>
                              <Tooltip title={copiedId === user.earner_id ? 'Copied!' : 'Copy Earner ID'}>
                                <IconButton
                                  size="small"
                                  onClick={(e) => handleCopyEarnerId(user.earner_id, e)}
                                  sx={{ p: 0.4, opacity: 0.7, '&:hover': { opacity: 1 } }}
                                >
                                  {copiedId === user.earner_id ? (
                                    <DoneIcon sx={{ fontSize: 13, color: '#10b981' }} />
                                  ) : (
                                    <ContentCopyIcon sx={{ fontSize: 13 }} />
                                  )}
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>

                          {/* Balance */}
                          <TableCell align="right" sx={{ py: 1.4, px: 2 }}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 900,
                                fontSize: '0.94rem',
                                color: hasBalance ? '#10b981' : isNegative ? '#ef4444' : 'text.secondary',
                              }}
                            >
                              {formatINR(user.balance)}
                            </Typography>
                          </TableCell>

                          {/* Actions */}
                          <TableCell align="center" sx={{ py: 1.4, px: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                              <Tooltip title="Manage / Adjust Funds">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenPanel(user, 'manage');
                                  }}
                                  sx={{
                                    bgcolor: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.10)',
                                    color: '#10b981',
                                    borderRadius: '10px',
                                    p: 0.7,
                                    '&:hover': { bgcolor: isDark ? 'rgba(16, 185, 129, 0.28)' : 'rgba(16, 185, 129, 0.18)' },
                                  }}
                                >
                                  <AddCardIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="View Transaction Ledger History">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenPanel(user, 'history');
                                  }}
                                  sx={{
                                    bgcolor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.10)',
                                    color: '#3b82f6',
                                    borderRadius: '10px',
                                    p: 0.7,
                                    '&:hover': { bgcolor: isDark ? 'rgba(59, 130, 246, 0.28)' : 'rgba(59, 130, 246, 0.18)' },
                                  }}
                                >
                                  <HistoryIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={filteredUsers.length}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
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
        </Box>

        {/* RIGHT COLUMN: RAZORPAYX STYLE SLIDE-OVER CONSOLE */}
        <Slide direction="left" in={!!selectedUser} mountOnEnter unmountOnExit timeout={300}>
          <Box
            sx={{
              width: { xs: '100%', lg: 400 },
              flexShrink: 0,
              position: 'sticky',
              top: 80,
            }}
          >
            {selectedUser && (
              <Paper
                elevation={0}
                sx={{
                  borderRadius: '26px',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'}`,
                  bgcolor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: isDark
                    ? '0 20px 50px -10px rgba(0, 0, 0, 0.6)'
                    : '0 20px 50px -10px rgba(0, 0, 0, 0.1)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: 'calc(100vh - 100px)',
                }}
              >
                {/* Console Header */}
                <Box
                  sx={{
                    p: 2.2,
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(15, 23, 42, 0.02)',
                  }}
                >
                  <Avatar
                    sx={{
                      width: 44,
                      height: 44,
                      background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                      color: '#fff',
                      fontWeight: 900,
                    }}
                  >
                    {selectedUser.fullName.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 850, lineHeight: 1.15 }}>
                      {selectedUser.fullName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.74rem' }}>
                      {selectedUser.earner_id}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={handleClosePanel}
                    sx={{
                      borderRadius: '10px',
                      bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>

                {/* Balance Pod Preview */}
                <Box
                  sx={{
                    p: 2.5,
                    mx: 2,
                    mt: 2,
                    borderRadius: '18px',
                    bgcolor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.28)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Box>
                    <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '0.66rem', display: 'block' }}>
                      Current Wallet Balance
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 900, color: '#10b981', mt: 0.3 }}>
                      {formatINR(selectedUser.balance)}
                    </Typography>
                  </Box>
                  {panelMode === 'manage' && previewAmount > 0 && (
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, fontSize: '0.66rem', display: 'block' }}>
                        After Transaction
                      </Typography>
                      <Typography variant="subtitle1" sx={{ fontWeight: 900, color: trxType === 'Credit' ? '#10b981' : '#ef4444' }}>
                        {formatINR(previewNewBalance)}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Submenu Tabs */}
                <Box sx={{ px: 2, pt: 1.5 }}>
                  <Tabs
                    value={panelMode}
                    onChange={(_, v) => setPanelMode(v)}
                    variant="fullWidth"
                    sx={{
                      minHeight: 40,
                      bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.03)',
                      p: 0.4,
                      borderRadius: '12px',
                      '& .MuiTabs-indicator': { display: 'none' },
                      '& .MuiTab-root': {
                        minHeight: 34,
                        py: 0.6,
                        borderRadius: '10px',
                        textTransform: 'none',
                        fontWeight: 750,
                        fontSize: '0.78rem',
                        transition: 'all 0.2s ease',
                        '&.Mui-selected': {
                          bgcolor: isDark ? '#2563eb' : '#2563eb',
                          color: '#fff',
                        },
                      },
                    }}
                  >
                    <Tab label="Manage Funds" value="manage" />
                    <Tab label="Transaction Ledger" value="history" />
                  </Tabs>
                </Box>

                {/* Drawer Content */}
                <Box sx={{ p: 2, overflowY: 'auto', flexGrow: 1 }}>
                  {panelMode === 'manage' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.2 }}>
                      {/* Credit vs Debit Toggle */}
                      <Grid container spacing={1.5}>
                        <Grid item xs={6}>
                          <Button
                            fullWidth
                            variant={trxType === 'Credit' ? 'contained' : 'outlined'}
                            startIcon={<ArrowUpwardIcon />}
                            onClick={() => setTrxType('Credit')}
                            sx={{
                              borderRadius: '14px',
                              py: 1.1,
                              fontWeight: 800,
                              fontSize: '0.82rem',
                              textTransform: 'none',
                              bgcolor: trxType === 'Credit' ? '#10b981' : 'transparent',
                              borderColor: '#10b981',
                              color: trxType === 'Credit' ? '#fff' : '#10b981',
                              '&:hover': {
                                bgcolor: trxType === 'Credit' ? '#059669' : 'rgba(16, 185, 129, 0.1)',
                                borderColor: '#10b981',
                              },
                            }}
                          >
                            + Credit Funds
                          </Button>
                        </Grid>
                        <Grid item xs={6}>
                          <Button
                            fullWidth
                            variant={trxType === 'Debit' ? 'contained' : 'outlined'}
                            startIcon={<ArrowDownwardIcon />}
                            onClick={() => {
                              setTrxType('Debit');
                              setSyncCompanyFund(true);
                            }}
                            sx={{
                              borderRadius: '14px',
                              py: 1.1,
                              fontWeight: 800,
                              fontSize: '0.82rem',
                              textTransform: 'none',
                              bgcolor: trxType === 'Debit' ? '#ef4444' : 'transparent',
                              borderColor: '#ef4444',
                              color: trxType === 'Debit' ? '#fff' : '#ef4444',
                              '&:hover': {
                                bgcolor: trxType === 'Debit' ? '#dc2626' : 'rgba(239, 68, 68, 0.1)',
                                borderColor: '#ef4444',
                              },
                            }}
                          >
                            - Debit Funds
                          </Button>
                        </Grid>
                      </Grid>

                      {/* Quick Amount Presets */}
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, fontSize: '0.7rem', display: 'block', mb: 0.8 }}>
                          QUICK AMOUNT PRESETS
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.8 }}>
                          {[100, 250, 500, 1000, 2000].map((preset) => (
                            <Chip
                              key={preset}
                              label={`+₹${preset}`}
                              size="small"
                              onClick={() => setAmount(String(preset))}
                              sx={{
                                fontWeight: 800,
                                fontSize: '0.72rem',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                                '&:hover': { bgcolor: 'primary.light', color: 'primary.main' },
                              }}
                            />
                          ))}
                        </Stack>
                      </Box>

                      {/* Amount Input */}
                      <TextField
                        fullWidth
                        size="small"
                        label="Adjustment Amount"
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '14px',
                            fontWeight: 800,
                            fontSize: '1rem',
                          },
                        }}
                      />

                      {/* Description / Reason */}
                      <Box>
                        <TextField
                          fullWidth
                          size="small"
                          label="Description / Audit Note"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="e.g. Campaign completion bonus, referral incentive..."
                          multiline
                          rows={2}
                          sx={{
                            '& .MuiOutlinedInput-root': { borderRadius: '14px', fontSize: '0.84rem' },
                          }}
                        />
                        <Stack direction="row" spacing={0.6} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.6 }}>
                          {['Campaign Bonus', 'Weekly Incentive', 'Manual Adjustment', 'Correction'].map((tag) => (
                            <Chip
                              key={tag}
                              label={tag}
                              size="small"
                              onClick={() => setDescription(tag)}
                              sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, borderRadius: '6px', cursor: 'pointer' }}
                            />
                          ))}
                        </Stack>
                      </Box>

                      {/* Sync to Company Fund (for Debit) */}
                      {trxType === 'Debit' && (
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={syncCompanyFund}
                              onChange={(e) => setSyncCompanyFund(e.target.checked)}
                              size="small"
                              sx={{ color: '#ef4444', '&.Mui-checked': { color: '#ef4444' } }}
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 750, fontSize: '0.8rem' }}>
                                Sync to Company Fund Ledger
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                Record this debit in the central company treasury transactions table.
                              </Typography>
                            </Box>
                          }
                          sx={{
                            alignItems: 'flex-start',
                            p: 1.2,
                            borderRadius: '14px',
                            border: `1px solid ${theme.palette.divider}`,
                            bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
                            m: 0,
                          }}
                        />
                      )}

                      {/* Notification Alert Banner */}
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: '14px',
                          bgcolor: isDark ? 'rgba(59, 130, 246, 0.10)' : 'rgba(59, 130, 246, 0.06)',
                          border: '1px solid rgba(59, 130, 246, 0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.2,
                        }}
                      >
                        <NotificationsActiveIcon sx={{ color: '#3b82f6', fontSize: 18 }} />
                        <Typography variant="caption" sx={{ color: isDark ? '#93c5fd' : '#1d4ed8', fontWeight: 650, fontSize: '0.72rem' }}>
                          Earner will receive an immediate push notification on their Android mobile app.
                        </Typography>
                      </Box>

                      {/* Confirm Action Button */}
                      <Button
                        fullWidth
                        variant="contained"
                        onClick={handleProcessTransaction}
                        disabled={processing || !amount || parseFloat(amount) <= 0}
                        startIcon={processing ? <CircularProgress size={16} color="inherit" /> : <SyncAltIcon />}
                        sx={{
                          borderRadius: '14px',
                          py: 1.3,
                          fontWeight: 850,
                          fontSize: '0.88rem',
                          textTransform: 'none',
                          background:
                            trxType === 'Credit'
                              ? 'linear-gradient(135deg, #10b981, #059669)'
                              : 'linear-gradient(135deg, #ef4444, #dc2626)',
                          boxShadow:
                            trxType === 'Credit'
                              ? '0 6px 20px rgba(16, 185, 129, 0.4)'
                              : '0 6px 20px rgba(239, 68, 68, 0.4)',
                        }}
                      >
                        {processing ? 'Posting Ledger Settlement...' : `Confirm ${trxType} ₹${amount || '0'}`}
                      </Button>
                    </Box>
                  )}

                  {panelMode === 'history' && (
                    <Box>
                      {allTransactions.filter((t) => t.earner_id === selectedUser.earner_id).length === 0 ? (
                        <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                          <HistoryIcon sx={{ fontSize: 36, opacity: 0.3, mb: 1 }} />
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            No wallet transactions recorded
                          </Typography>
                        </Box>
                      ) : (
                        <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                          {allTransactions
                            .filter((t) => t.earner_id === selectedUser.earner_id)
                            .map((txn) => {
                              const isCredit = txn.transaction_type === 'Credit';
                              return (
                                <Paper
                                  key={txn.id || txn.transaction_id}
                                  elevation={0}
                                  sx={{
                                    p: 1.6,
                                    borderRadius: '16px',
                                    border: `1px solid ${theme.palette.divider}`,
                                    bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(15, 23, 42, 0.02)',
                                  }}
                                >
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.6 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                      <Chip
                                        label={isCredit ? '+ CREDIT' : '- DEBIT'}
                                        size="small"
                                        sx={{
                                          height: 18,
                                          fontSize: '0.6rem',
                                          fontWeight: 800,
                                          bgcolor: isCredit ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                          color: isCredit ? '#10b981' : '#ef4444',
                                          borderRadius: '4px',
                                        }}
                                      />
                                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                                        {new Date(txn.created_at).toLocaleDateString('en-IN', {
                                          day: '2-digit',
                                          month: 'short',
                                          year: 'numeric',
                                        })}
                                      </Typography>
                                    </Box>
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        fontWeight: 900,
                                        fontSize: '0.88rem',
                                        color: isCredit ? '#10b981' : '#ef4444',
                                      }}
                                    >
                                      {isCredit ? '+' : '-'}₹{parseFloat(txn.amount).toFixed(2)}
                                    </Typography>
                                  </Box>
                                  <Typography variant="body2" sx={{ fontWeight: 650, fontSize: '0.8rem', mb: 0.4 }}>
                                    {txn.description || 'Wallet transaction'}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace', fontSize: '0.68rem', display: 'block' }}>
                                    ID: {txn.transaction_id}
                                  </Typography>
                                </Paper>
                              );
                            })}
                        </List>
                      )}
                    </Box>
                  )}
                </Box>
              </Paper>
            )}
          </Box>
        </Slide>
      </Box>

      {/* SNACKBAR FEEDBACK */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} sx={{ borderRadius: '12px', fontWeight: 650 }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
