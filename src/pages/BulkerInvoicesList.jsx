import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Card, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TablePagination,
  TextField, InputAdornment, Button, IconButton, Chip, Avatar,
  Stack, MenuItem, CircularProgress, useTheme
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { supabase } from '../supabaseClient';
import {
  getBulkerIdVariants,
  calculateBulkerFinances,
  formatINR
} from '../utils/bulkerPaymentCalculations';

export default function BulkerInvoicesList() {
  const theme = useTheme();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [bulkers, setBulkers] = useState([]);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch bulkers
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

      // 3. Fetch ALL individual_wallet_transactions without 1000 row truncation limit
      let allTransactions = [];
      let txFrom = 0;
      const txStep = 1000;
      while (true) {
        const { data: txPage, error: txErr } = await supabase
          .from('individual_wallet_transactions')
          .select('*')
          .range(txFrom, txFrom + txStep - 1);

        if (txErr) {
          console.error('Error fetching transactions page:', txErr);
          break;
        }

        allTransactions = allTransactions.concat(txPage || []);
        if (!txPage || txPage.length < txStep) break;
        txFrom += txStep;
      }

      // 3. Fetch ALL review_submit_data without 1000 row truncation limit
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

      // 3. Compute manual invoice gross totals per bulker
      const calculatedBulkers = bulkerList.map((b) => {
        const variants = getBulkerIdVariants(b.bulker_id || b.id);
        const lowerVariants = variants.map((v) => v.toLowerCase());

        const bulkerHistory = billingHistoryAll.filter((h) => {
          if (!h.bulker_id) return false;
          return lowerVariants.includes(String(h.bulker_id).toLowerCase());
        });

        const bulkerTx = transactionsAll.filter((t) => {
          if (!t.earner_id) return false;
          return lowerVariants.includes(String(t.earner_id).toLowerCase());
        });

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

        // Compute total disbursed across all invoice months for this bulker
        const cleanCode = (b.bulker_id || b.id || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        let totalPaid = 0;
        const monthKeys = finances.invoices.monthKeys;

        monthKeys.forEach((mk) => {
          const invNum = `nv-blk-inv-${mk.replace('-', '')}-${cleanCode}`;
          const monthLower = String(mk).toLowerCase();

          const paidForMonth = bulkerTx
            .filter((tx) => {
              if (tx.transaction_type !== 'Debit') return false;
              const st = (tx.status || 'Completed').toLowerCase();
              if (st === 'cancelled' || st === 'rejected' || st === 'failed') return false;

              const payout = tx.payout_details || tx.metadata || {};
              const desc = String(tx.description || '').toLowerCase();

              return (
                String(payout.invoice_number || '').toLowerCase() === invNum ||
                payout.billing_month === mk ||
                desc.includes(invNum) ||
                (desc.includes('invoice') && desc.includes(monthLower))
              );
            })
            .reduce((acc, tx) => acc + (parseFloat(tx.amount) || 0), 0);

          totalPaid += paidForMonth;
        });

        const totalManualGross = finances.invoices.totalManualGross || 0;
        const pendingBalance = Math.max(0, totalManualGross - totalPaid);

        return {
          ...b,
          manualLiveReviews: finances.invoices.manualLiveReviews,
          totalManualGross,
          totalPaid,
          pendingBalance,
          monthKeysCount: finances.invoices.monthKeys.length,
          walletBalance: finances.wallet.liveWalletBalance
        };
      });

      setBulkers(calculatedBulkers);
    } catch (err) {
      console.error('Error fetching bulker invoices data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredBulkers = useMemo(() => {
    return bulkers.filter((b) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        (b.full_name || '').toLowerCase().includes(q) ||
        (b.bulker_id || '').toLowerCase().includes(q) ||
        (b.phone || '').toLowerCase().includes(q) ||
        (b.email || '').toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && (b.status === 'Active' || b.status === 'Verified')) ||
        (statusFilter === 'INACTIVE' && b.status !== 'Active' && b.status !== 'Verified');

      return matchesSearch && matchesStatus;
    });
  }, [bulkers, searchTerm, statusFilter]);

  const paginatedBulkers = filteredBulkers.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const totalInvoicedGross = useMemo(() => {
    return bulkers.reduce((sum, b) => sum + (b.totalManualGross || 0), 0);
  }, [bulkers]);

  const totalPaidInvoices = useMemo(() => {
    return bulkers.reduce((sum, b) => sum + (b.totalPaid || 0), 0);
  }, [bulkers]);

  const totalPendingBalance = useMemo(() => {
    return bulkers.reduce((sum, b) => sum + (b.pendingBalance || 0), 0);
  }, [bulkers]);

  const totalManualReviews = useMemo(() => {
    return bulkers.reduce((sum, b) => sum + (b.manualLiveReviews || 0), 0);
  }, [bulkers]);

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', py: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: '#0f9d72', width: 44, height: 44, borderRadius: '14px', color: '#fff' }}>
              <ReceiptLongIcon />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                Bulker Monthly Invoices & Billing
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Formula: Live Reviews × Bulker Rate = Gross Invoice during Manual Billing periods
              </Typography>
            </Box>
          </Box>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<AccountBalanceWalletIcon />}
            onClick={() => navigate('/payments/bulkers/wallet')}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
          >
            Bulker Wallets
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchData}
            disabled={loading}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
          >
            Refresh
          </Button>
        </Stack>
      </Box>

      {/* Top 4 Stat Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        {/* Card 1: Total Gross Billed */}
        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '20px',
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(15,23,42,0.6)'
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                  Total Invoiced Gross
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#0f9d72' }}>
                  {formatINR(totalInvoicedGross)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Cumulative Gross Tally
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'rgba(15,157,114,0.1)', color: '#0f9d72', borderRadius: '14px' }}>
                <MonetizationOnIcon />
              </Avatar>
            </Stack>
          </Card>
        </Grid>

        {/* Card 2: Total Settled / Paid */}
        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '20px',
              border: '1.5px solid rgba(16,185,129,0.3)',
              bgcolor: 'rgba(16,185,129,0.04)'
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>
                  Total Paid / Settled
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#059669' }}>
                  {formatINR(totalPaidInvoices)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Disbursed via Database Payouts
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'rgba(16,185,129,0.15)', color: '#059669', borderRadius: '14px' }}>
                <ReceiptLongIcon />
              </Avatar>
            </Stack>
          </Card>
        </Grid>

        {/* Card 3: Total Pending Balance */}
        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '20px',
              border: totalPendingBalance > 0 ? '1.5px solid rgba(239,68,68,0.35)' : `1px solid ${theme.palette.divider}`,
              bgcolor: totalPendingBalance > 0 ? 'rgba(239,68,68,0.04)' : theme.palette.mode === 'light' ? '#fff' : 'rgba(15,23,42,0.6)'
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: totalPendingBalance > 0 ? '#dc2626' : 'text.secondary', textTransform: 'uppercase' }}>
                  Total Pending Balance
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: totalPendingBalance > 0 ? '#dc2626' : '#16a34a' }}>
                  {formatINR(totalPendingBalance)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {totalPendingBalance > 0 ? 'Awaiting Payout Settlement' : 'All Invoices Cleared'}
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: totalPendingBalance > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)', color: totalPendingBalance > 0 ? '#dc2626' : '#16a34a', borderRadius: '14px' }}>
                <CalendarMonthIcon />
              </Avatar>
            </Stack>
          </Card>
        </Grid>

        {/* Card 4: Total Live Reviews */}
        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '20px',
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(15,23,42,0.6)'
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                  Manual Live Reviews
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#2563eb' }}>
                  {totalManualReviews}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Across {bulkers.length} Bulker Desks
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'rgba(37,99,235,0.1)', color: '#2563eb', borderRadius: '14px' }}>
                <ReceiptLongIcon />
              </Avatar>
            </Stack>
          </Card>
        </Grid>
      </Grid>

      {/* Main Table Paper */}
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
        {/* Search & Filters */}
        <Box sx={{ p: 2.5, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search bulkers by name, ID, phone..."
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

        {/* Data Table */}
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.02)' : 'rgba(255,255,255,0.02)' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem', py: 1.8, whiteSpace: 'nowrap' }}>BULKER NAME</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>BULKER ID</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>ACCOUNT MODE</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>MANUAL GROSS</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>PAID SO FAR</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>PENDING BALANCE</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>INVOICE STATUS</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>ACTIONS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <CircularProgress size={36} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                      Loading bulker invoice statements...
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
                      Try adjusting your search criteria.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedBulkers.map((b) => (
                  <TableRow
                    key={b.id || b.bulker_id}
                    hover
                    sx={{ '&:last-child td': { border: 0 }, transition: 'background-color 0.2s ease' }}
                  >
                    {/* Bulker Name */}
                    <TableCell sx={{ py: 1.5, whiteSpace: 'nowrap' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                        <Avatar
                          sx={{
                            width: 36,
                            height: 36,
                            bgcolor: '#0f9d72',
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            color: '#fff',
                            flexShrink: 0
                          }}
                        >
                          {b.full_name ? b.full_name.charAt(0).toUpperCase() : 'B'}
                        </Avatar>
                        <Typography variant="body2" sx={{ fontWeight: 750, color: 'text.primary', whiteSpace: 'nowrap' }}>
                          {b.full_name}
                        </Typography>
                      </Box>
                    </TableCell>

                    {/* Bulker ID */}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
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
                    </TableCell>

                    {/* Account Mode */}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Chip
                        label={b.account_type || 'Wallet System'}
                        size="small"
                        color={b.account_type === 'Manual' ? 'warning' : 'primary'}
                        variant={b.account_type === 'Manual' ? 'filled' : 'outlined'}
                        sx={{ fontWeight: 700, fontSize: '0.72rem', borderRadius: '8px' }}
                      />
                    </TableCell>

                    {/* Manual Gross Total */}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.92rem' }}>
                        {formatINR(b.totalManualGross)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {b.monthKeysCount} cycle(s) &bull; {b.manualLiveReviews || 0} reviews
                      </Typography>
                    </TableCell>

                    {/* Paid So Far */}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: b.totalPaid > 0 ? '#16a34a' : 'text.secondary', fontSize: '0.92rem' }}>
                        {formatINR(b.totalPaid)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {b.totalPaid > 0 ? 'Disbursed' : 'No payout yet'}
                      </Typography>
                    </TableCell>

                    {/* Pending Balance */}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 900,
                          color: b.pendingBalance > 0.01 ? '#dc2626' : '#16a34a',
                          fontSize: '0.95rem'
                        }}
                      >
                        {formatINR(b.pendingBalance)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: b.pendingBalance > 0.01 ? '#dc2626' : 'text.secondary', fontWeight: 650 }}>
                        {b.pendingBalance > 0.01 ? 'Still Pending' : 'All Cleared'}
                      </Typography>
                    </TableCell>

                    {/* Invoice Status */}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {b.totalManualGross === 0 ? (
                        <Chip label="No Invoices" size="small" sx={{ fontWeight: 700, fontSize: '0.72rem' }} />
                      ) : b.pendingBalance <= 0.01 ? (
                        <Chip label="FULLY PAID" size="small" color="success" sx={{ fontWeight: 800, fontSize: '0.72rem' }} />
                      ) : b.totalPaid > 0 ? (
                        <Chip label="PARTIALLY PAID" size="small" color="warning" sx={{ fontWeight: 800, fontSize: '0.72rem' }} />
                      ) : (
                        <Chip label="PENDING" size="small" color="error" variant="outlined" sx={{ fontWeight: 800, fontSize: '0.72rem' }} />
                      )}
                    </TableCell>

                    {/* Action */}
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<VisibilityIcon fontSize="small" />}
                        onClick={() => navigate(`/payments/bulkers/invoices/${encodeURIComponent(b.id || b.bulker_id)}`)}
                        sx={{
                          borderRadius: '100px',
                          textTransform: 'none',
                          fontWeight: 750,
                          fontSize: '0.78rem',
                          px: 2.2,
                          bgcolor: '#0f9d72',
                          '&:hover': { bgcolor: '#0b7e5b' },
                          boxShadow: '0 4px 14px rgba(15,157,114,0.25)'
                        }}
                      >
                        View Invoices
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
