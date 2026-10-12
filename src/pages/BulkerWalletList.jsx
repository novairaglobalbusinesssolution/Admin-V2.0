import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Card, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TablePagination,
  TextField, InputAdornment, Button, IconButton, Chip, Avatar,
  Stack, MenuItem, CircularProgress, Tooltip, useTheme
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import GroupIcon from '@mui/icons-material/Group';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { supabase } from '../supabaseClient';
import {
  getBulkerIdVariants,
  calculateBulkerFinances,
  formatINR
} from '../utils/bulkerPaymentCalculations';

export default function BulkerWalletList() {
  const theme = useTheme();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [bulkers, setBulkers] = useState([]);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch all bulkers
      const { data: bData, error: bErr } = await supabase
        .from('bulker_desks')
        .select('*')
        .order('full_name', { ascending: true });

      if (bErr) throw bErr;
      const bulkerList = bData || [];

      // 2. Fetch billing history and apps in parallel
      const [histRes, appsRes] = await Promise.all([
        supabase
          .from('bulker_billing_history')
          .select('*')
          .order('change_date_time', { ascending: true }),
        supabase
          .from('apps')
          .select('id, app_name, task_id, members_reward, assigned_bulkers')
      ]);

      // 3. Fetch all individual_wallet_transactions without 1000 limit truncation
      let allTransactions = [];
      let txFrom = 0;
      const txStep = 1000;
      while (true) {
        const { data: txPage, error: txErr } = await supabase
          .from('individual_wallet_transactions')
          .select('*')
          .range(txFrom, txFrom + txStep - 1);

        if (txErr) {
          console.error('Error fetching wallet transactions page:', txErr);
          break;
        }

        allTransactions = allTransactions.concat(txPage || []);
        if (!txPage || txPage.length < txStep) break;
        txFrom += txStep;
      }

      // 3. Fetch all review_submit_data without 1000 limit truncation
      let allReviews = [];
      let from = 0;
      const step = 1000;
      while (true) {
        const { data: revPage, error: revErr } = await supabase
          .from('review_submit_data')
          .select('id, app_id, bulker_id, status, submitted_at')
          .in('status', ['Live', 'Approved'])
          .range(from, from + step - 1);

        if (revErr) {
          console.error('Error fetching reviews page:', revErr);
          break;
        }

        allReviews = allReviews.concat(revPage || []);
        if (!revPage || revPage.length < step) break;
        from += step;
      }

      const billingHistoryAll = histRes.data || [];
      const transactionsAll = allTransactions;
      const reviewsAll = allReviews;

      const appsMap = {};
      (appsRes.data || []).forEach((app) => {
        appsMap[app.id] = app;
      });

      // 3. For each bulker, compute financial metrics using exact logic
      const calculatedBulkers = bulkerList.map((b) => {
        const variants = getBulkerIdVariants(b.bulker_id || b.id);
        const lowerVariants = variants.map((v) => v.toLowerCase());

        // Bulker's billing history
        const bulkerHistory = billingHistoryAll.filter((h) => {
          if (!h.bulker_id) return false;
          return lowerVariants.includes(String(h.bulker_id).toLowerCase());
        });

        // Bulker's transactions
        const bulkerTx = transactionsAll.filter((t) => {
          if (!t.earner_id) return false;
          return lowerVariants.includes(String(t.earner_id).toLowerCase());
        });

        // Bulker's live reviews
        const bulkerReviews = reviewsAll.filter((r) => {
          if (!r.bulker_id) return false;
          return lowerVariants.includes(String(r.bulker_id).toLowerCase());
        });

        const finances = calculateBulkerFinances({
          bulker: b,
          billingHistory: bulkerHistory,
          transactions: bulkerTx,
          reviews: bulkerReviews,
          appsMap
        });

        return {
          ...b,
          balance: finances.wallet.liveWalletBalance,
          computedProfit: finances.wallet.computedProfit,
          totalCredits: finances.wallet.creditSum,
          totalDebits: finances.wallet.debitSum,
          walletLiveReviews: finances.wallet.walletLiveReviews,
          manualLiveReviews: finances.invoices.manualLiveReviews,
          txCount: bulkerTx.length
        };
      });

      setBulkers(calculatedBulkers);
    } catch (err) {
      console.error('Error fetching bulker wallets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered bulkers
  const filteredBulkers = useMemo(() => {
    return bulkers.filter((b) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        (b.full_name || '').toLowerCase().includes(q) ||
        (b.bulker_id || '').toLowerCase().includes(q) ||
        (b.id || '').toLowerCase().includes(q) ||
        (b.phone || '').toLowerCase().includes(q) ||
        (b.email || '').toLowerCase().includes(q);

      const matchesAccountType =
        accountTypeFilter === 'ALL' ||
        (accountTypeFilter === 'WALLET' && (b.account_type === 'Wallet System' || !b.account_type)) ||
        (accountTypeFilter === 'MANUAL' && b.account_type === 'Manual');

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && (b.status === 'Active' || b.status === 'Verified')) ||
        (statusFilter === 'INACTIVE' && b.status !== 'Active' && b.status !== 'Verified');

      return matchesSearch && matchesAccountType && matchesStatus;
    });
  }, [bulkers, searchTerm, accountTypeFilter, statusFilter]);

  // Global calculations
  const totalBalance = useMemo(() => bulkers.reduce((acc, b) => acc + (b.balance || 0), 0), [bulkers]);
  const totalCredits = useMemo(() => bulkers.reduce((acc, b) => acc + (b.totalCredits || 0), 0), [bulkers]);
  const totalDebits = useMemo(() => bulkers.reduce((acc, b) => acc + (b.totalDebits || 0), 0), [bulkers]);

  const paginatedBulkers = filteredBulkers.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleViewBulker = (bulker) => {
    const targetId = bulker?.id || bulker?.bulker_id;
    navigate(`/payments/bulkers/wallet/${encodeURIComponent(targetId)}`);
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', py: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 44, height: 44, borderRadius: '14px' }}>
              <AccountBalanceWalletIcon />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                Bulker Wallet System
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Formula: (Assigned Rate - Member Rate) × Live Apps during Wallet periods
              </Typography>
            </Box>
          </Box>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant="outlined"
            startIcon={<ReceiptLongIcon />}
            onClick={() => navigate('/payments/bulkers/invoices')}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
          >
            Bulker Invoices
          </Button>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<RefreshIcon />}
            onClick={fetchData}
            disabled={loading}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
          >
            Refresh Data
          </Button>
        </Stack>
      </Box>

      {/* Top CRM Summary Stat Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '20px',
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(15,23,42,0.6)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                  Total Bulkers
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5 }}>
                  {bulkers.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Registered desks
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'rgba(37,99,235,0.1)', color: '#2563eb', width: 48, height: 48, borderRadius: '16px' }}>
                <GroupIcon />
              </Avatar>
            </Stack>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '20px',
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(15,23,42,0.6)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                  Total Bulker Balance
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, color: '#16a34a' }}>
                  {formatINR(totalBalance)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Live calculated balances
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'rgba(22,163,74,0.1)', color: '#16a34a', width: 48, height: 48, borderRadius: '16px' }}>
                <AccountBalanceWalletIcon />
              </Avatar>
            </Stack>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '20px',
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(15,23,42,0.6)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                  Total Credited
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, color: '#2563eb' }}>
                  {formatINR(totalCredits)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Member credits
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'rgba(37,99,235,0.1)', color: '#2563eb', width: 48, height: 48, borderRadius: '16px' }}>
                <ArrowUpwardIcon />
              </Avatar>
            </Stack>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '20px',
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(15,23,42,0.6)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                  Total Debited
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, color: '#f59e0b' }}>
                  {formatINR(totalDebits)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Payouts / debited
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: '#f59e0b', width: 48, height: 48, borderRadius: '16px' }}>
                <ArrowDownwardIcon />
              </Avatar>
            </Stack>
          </Card>
        </Grid>
      </Grid>

      {/* Main Table Card */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: '24px',
          border: `1px solid ${theme.palette.divider}`,
          overflow: 'hidden',
          bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(15,23,42,0.6)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.03)'
        }}
      >
        {/* Table Filters Bar */}
        <Box sx={{ p: 2.5, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search bulker by name, ID, phone, email..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
            sx={{ flex: 1, minWidth: { xs: '100%', sm: 260 }, '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              )
            }}
          />

          <TextField
            select
            size="small"
            label="Account Type"
            value={accountTypeFilter}
            onChange={(e) => { setAccountTypeFilter(e.target.value); setPage(0); }}
            sx={{ minWidth: 160, '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
          >
            <MenuItem value="ALL">All Account Types</MenuItem>
            <MenuItem value="WALLET">Wallet System</MenuItem>
            <MenuItem value="MANUAL">Manual</MenuItem>
          </TextField>

          <TextField
            select
            size="small"
            label="Status"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            sx={{ minWidth: 140, '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
          >
            <MenuItem value="ALL">All Status</MenuItem>
            <MenuItem value="ACTIVE">Active</MenuItem>
            <MenuItem value="INACTIVE">Inactive</MenuItem>
          </TextField>
        </Box>

        {/* Table */}
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.02)' : 'rgba(255,255,255,0.02)' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem', py: 1.8, whiteSpace: 'nowrap' }}>BULKER NAME</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>BULKER ID</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>ACCOUNT TYPE</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>CONTACT DETAILS</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>WALLET BALANCE</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>LIVE REVIEWS</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>STATUS</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>ACTION</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <CircularProgress size={36} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                      Calculating bulker wallet balances...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : paginatedBulkers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      No Bulkers Found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Try adjusting your search query or filter options.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedBulkers.map((b) => (
                  <TableRow
                    key={b.id || b.bulker_id}
                    hover
                    sx={{
                      '&:last-child td': { border: 0 },
                      transition: 'background-color 0.2s ease'
                    }}
                  >
                    {/* Bulker Name */}
                    <TableCell sx={{ py: 1.5, whiteSpace: 'nowrap' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, whiteSpace: 'nowrap' }}>
                        <Avatar
                          sx={{
                            width: 36,
                            height: 36,
                            bgcolor: 'primary.main',
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            color: '#fff',
                            flexShrink: 0
                          }}
                        >
                          {b.full_name ? b.full_name.charAt(0).toUpperCase() : 'B'}
                        </Avatar>
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, whiteSpace: 'nowrap' }}>
                          <Typography variant="body2" sx={{ fontWeight: 750, color: 'text.primary', whiteSpace: 'nowrap' }}>
                            {b.full_name}
                          </Typography>
                          <Chip
                            label={`${b.txCount || 0} tx`}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              borderRadius: '100px',
                              bgcolor: theme.palette.mode === 'light' ? 'rgba(37,99,235,0.08)' : 'rgba(59,130,246,0.14)',
                              color: 'primary.main'
                            }}
                          />
                        </Box>
                      </Box>
                    </TableCell>

                    {/* Bulker ID */}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                        <Chip
                          label={b.bulker_id}
                          size="small"
                          sx={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            borderRadius: '8px'
                          }}
                        />
                        {b.id && (
                          <Typography
                            variant="caption"
                            sx={{
                              fontFamily: 'monospace',
                              fontSize: '0.68rem',
                              color: 'text.secondary',
                              letterSpacing: 0.3,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            UID: {b.id.length > 13 ? `${b.id.substring(0, 8)}...` : b.id}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>

                    {/* Account Type */}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Chip
                        icon={<AccountBalanceWalletIcon sx={{ fontSize: '0.9rem !important' }} />}
                        label={b.account_type || 'Wallet System'}
                        size="small"
                        color={b.account_type === 'Manual' ? 'default' : 'primary'}
                        variant={b.account_type === 'Manual' ? 'outlined' : 'filled'}
                        sx={{ fontWeight: 700, fontSize: '0.75rem', borderRadius: '8px', whiteSpace: 'nowrap' }}
                      />
                    </TableCell>

                    {/* Contact Details */}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                        {b.phone && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, fontSize: '0.78rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                            <PhoneIcon sx={{ fontSize: 13 }} />
                            <span>{b.phone}</span>
                          </Box>
                        )}
                        {b.email && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, fontSize: '0.78rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                            <EmailIcon sx={{ fontSize: 13 }} />
                            <span>{b.email}</span>
                          </Box>
                        )}
                      </Box>
                    </TableCell>

                    {/* Wallet Balance */}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 800,
                          fontSize: '0.95rem',
                          color: (b.balance || 0) >= 0 ? '#16a34a' : 'error.main',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {formatINR(b.balance)}
                      </Typography>
                    </TableCell>

                    {/* Live Reviews */}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Stack direction="row" spacing={0.8} alignItems="center">
                        <Chip
                          label={`${b.walletLiveReviews || 0} Wallet`}
                          size="small"
                          color="primary"
                          sx={{ fontWeight: 700, fontSize: '0.7rem', height: 20 }}
                        />
                        {b.manualLiveReviews > 0 && (
                          <Chip
                            label={`${b.manualLiveReviews} Manual`}
                            size="small"
                            variant="outlined"
                            sx={{ fontWeight: 600, fontSize: '0.7rem', height: 20 }}
                          />
                        )}
                      </Stack>
                    </TableCell>

                    {/* Status */}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Chip
                        label={b.status || 'Active'}
                        size="small"
                        color={b.status === 'Active' || b.status === 'Verified' ? 'success' : 'default'}
                        sx={{ fontWeight: 700, fontSize: '0.72rem', borderRadius: '8px', whiteSpace: 'nowrap' }}
                      />
                    </TableCell>

                    {/* Action */}
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      <Button
                        variant="contained"
                        size="small"
                        color="primary"
                        startIcon={<VisibilityIcon fontSize="small" />}
                        onClick={() => handleViewBulker(b)}
                        sx={{
                          borderRadius: '100px',
                          textTransform: 'none',
                          fontWeight: 750,
                          fontSize: '0.8rem',
                          px: 2,
                          boxShadow: 'none'
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <TablePagination
          component="div"
          count={filteredBulkers.length}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(e, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Paper>
    </Box>
  );
}
