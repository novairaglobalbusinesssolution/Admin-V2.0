import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TablePagination,
  TextField, InputAdornment, Button, IconButton, Chip, Avatar,
  Stack, MenuItem, CircularProgress, Tooltip, useTheme
} from '@mui/material';

// Material Icons
import SearchIcon from '@mui/icons-material/Search';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DoneIcon from '@mui/icons-material/Done';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';

import {
  getBulkerFinances,
  invalidateBulkerFinancesCache,
} from '../utils/bulkerFinancesCache';
import { formatINR } from '../utils/bulkerPaymentCalculations';

export default function BulkerInvoicesList() {
  const theme = useTheme();
  const navigate = useNavigate();
  const isDark = theme.palette.mode === 'dark';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bulkers, setBulkers] = useState([]);
  const [isCached, setIsCached] = useState(false);
  const [cacheAge, setCacheAge] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const copyToClipboard = (text, keyName, e) => {
    if (e) e.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(String(text).trim());
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const loadData = async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
      invalidateBulkerFinancesCache();
    } else {
      setLoading(true);
    }

    try {
      const result = await getBulkerFinances({ forceRefresh });
      setBulkers(result.bulkers || []);
      setIsCached(Boolean(result.isFromCache));

      if (result.cacheTimestamp) {
        const diffMins = Math.floor((Date.now() - result.cacheTimestamp) / 60000);
        setCacheAge(diffMins <= 0 ? 'Just now' : `${diffMins}m ago`);
      }
    } catch (err) {
      console.error('Error fetching bulker invoices data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  const filteredBulkers = useMemo(() => {
    return bulkers.filter((b) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        (b.full_name || '').toLowerCase().includes(q) ||
        (b.bulker_id || '').toLowerCase().includes(q) ||
        (b.id || '').toLowerCase().includes(q) ||
        (b.phone || '').toLowerCase().includes(q) ||
        (b.email || '').toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && (b.status === 'Active' || b.status === 'Verified')) ||
        (statusFilter === 'INACTIVE' && b.status !== 'Active' && b.status !== 'Verified') ||
        (statusFilter === 'PENDING_INVOICE' && (b.pendingBalance || 0) > 0.01) ||
        (statusFilter === 'CLEARED' && (b.pendingBalance || 0) <= 0.01 && (b.totalManualGross || 0) > 0);

      return matchesSearch && matchesStatus;
    });
  }, [bulkers, searchTerm, statusFilter]);

  const paginatedBulkers = filteredBulkers.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage,
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
    <Box sx={{ maxWidth: 1440, mx: 'auto', p: { xs: 1.5, md: 3 }, pb: 12 }}>
      {/* HEADER POD */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, mb: 3.5, flexWrap: 'wrap', gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5, flexWrap: 'wrap' }}>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.03em' }}>
              Bulker Monthly Invoices & Billing
            </Typography>
            <Chip
              size="small"
              icon={isCached ? <FlashOnIcon sx={{ fontSize: '13px !important' }} /> : <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#0f9d72', boxShadow: '0 0 8px #0f9d72' }} />}
              label={isCached ? `INSTANT CACHE • 0 KB EGRESS (${cacheAge})` : 'LIVE INVOICE AUDITED'}
              sx={{
                height: 24,
                fontSize: '0.66rem',
                fontWeight: 800,
                letterSpacing: '0.04em',
                bgcolor: isCached ? (isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.10)') : (isDark ? 'rgba(15, 157, 114, 0.15)' : 'rgba(15, 157, 114, 0.10)'),
                color: isCached ? '#8b5cf6' : '#0f9d72',
                border: `1px solid ${isCached ? 'rgba(139, 92, 246, 0.3)' : 'rgba(15, 157, 114, 0.3)'}`,
              }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
            Formula: Verified Live Reviews × Bulker Rate = Gross Monthly Invoice for Manual Billing periods
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant="outlined"
            startIcon={<AccountBalanceWalletIcon />}
            onClick={() => navigate('/payments/bulkers/wallet')}
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
            Bulker Wallets
          </Button>
          <Button
            variant="contained"
            startIcon={<RefreshIcon className={refreshing ? 'spin' : ''} />}
            onClick={() => loadData(true)}
            disabled={loading || refreshing}
            sx={{
              borderRadius: '14px',
              textTransform: 'none',
              fontWeight: 800,
              fontSize: '0.84rem',
              px: 2.2,
              py: 0.9,
              bgcolor: '#0f9d72',
              '&:hover': { bgcolor: '#0b7e5b' },
              boxShadow: '0 4px 16px rgba(15, 157, 114, 0.35)',
            }}
          >
            {refreshing ? 'Syncing...' : 'Refresh'}
          </Button>
        </Stack>
      </Box>

      {/* 4 PRO-PREMIUM STAT PODS */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        {/* Total Invoiced Gross */}
        <Grid item xs={12} sm={6} lg={3}>
          <Box
            sx={{
              p: 2.5,
              borderRadius: '22px',
              bgcolor: isDark ? 'rgba(15, 157, 114, 0.12)' : 'rgba(15, 157, 114, 0.08)',
              border: '1px solid rgba(15, 157, 114, 0.28)',
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
                bgcolor: '#0f9d72',
                color: '#fff',
                boxShadow: '0 6px 20px rgba(15, 157, 114, 0.4)',
              }}
            >
              <MonetizationOnIcon />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#0f9d72', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.68rem', display: 'block' }}>
                Total Invoiced Gross
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, color: '#0f9d72', mt: 0.3 }}>
                {formatINR(totalInvoicedGross)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                Cumulative billing cycles
              </Typography>
            </Box>
          </Box>
        </Grid>

        {/* Total Paid / Settled */}
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
              <CheckCircleIcon />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.68rem', display: 'block' }}>
                Total Paid / Settled
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, color: '#10b981', mt: 0.3 }}>
                {formatINR(totalPaidInvoices)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                Disbursed to partners
              </Typography>
            </Box>
          </Box>
        </Grid>

        {/* Total Pending Balance */}
        <Grid item xs={12} sm={6} lg={3}>
          <Box
            sx={{
              p: 2.5,
              borderRadius: '22px',
              bgcolor: totalPendingBalance > 0
                ? (isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)')
                : (isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)'),
              border: totalPendingBalance > 0
                ? '1px solid rgba(239, 68, 68, 0.35)'
                : '1px solid rgba(16, 185, 129, 0.28)',
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
                bgcolor: totalPendingBalance > 0 ? '#ef4444' : '#10b981',
                color: '#fff',
                boxShadow: totalPendingBalance > 0 ? '0 6px 20px rgba(239, 68, 68, 0.4)' : '0 6px 20px rgba(16, 185, 129, 0.4)',
              }}
            >
              <HourglassEmptyIcon />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: totalPendingBalance > 0 ? '#ef4444' : '#10b981', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.68rem', display: 'block' }}>
                Total Pending Balance
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, color: totalPendingBalance > 0 ? '#ef4444' : '#10b981', mt: 0.3 }}>
                {formatINR(totalPendingBalance)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                {totalPendingBalance > 0 ? 'Awaiting Payout Settlement' : 'All Invoices Cleared'}
              </Typography>
            </Box>
          </Box>
        </Grid>

        {/* Manual Live Reviews */}
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
              <ReceiptLongIcon />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#3b82f6', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.68rem', display: 'block' }}>
                Manual Live Reviews
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, color: isDark ? '#f8fafc' : '#0f172a', mt: 0.3 }}>
                {totalManualReviews} Reviews
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                Across {bulkers.length} Bulker Desks
              </Typography>
            </Box>
          </Box>
        </Grid>
      </Grid>

      {/* MAIN DATA TABLE CARD */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: '24px',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
          bgcolor: isDark ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(16px)',
          overflow: 'hidden',
          boxShadow: isDark ? '0 12px 40px -10px rgba(0, 0, 0, 0.4)' : '0 12px 40px -10px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Search & Filters */}
        <Box sx={{ p: 2.2, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search bulkers by name, ID, phone, email..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
            sx={{ flex: 1, minWidth: { xs: '100%', sm: 260 }, '& .MuiOutlinedInput-root': { borderRadius: '12px', fontSize: '0.84rem' } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            select
            size="small"
            label="Invoice Status Filter"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            sx={{ minWidth: 180, '& .MuiOutlinedInput-root': { borderRadius: '12px', fontSize: '0.84rem' } }}
          >
            <MenuItem value="ALL">All Bulkers</MenuItem>
            <MenuItem value="PENDING_INVOICE">With Pending Balance</MenuItem>
            <MenuItem value="CLEARED">Cleared / Fully Paid</MenuItem>
            <MenuItem value="ACTIVE">Active Status</MenuItem>
            <MenuItem value="INACTIVE">Inactive Status</MenuItem>
          </TextField>
        </Box>

        {/* Data Table */}
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(15, 23, 42, 0.02)' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', py: 1.5, px: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>BULKER NAME</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', py: 1.5, px: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>BULKER ID</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', py: 1.5, px: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ACCOUNT MODE</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', py: 1.5, px: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>MANUAL GROSS</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', py: 1.5, px: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>PAID SO FAR</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.72rem', py: 1.5, px: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>PENDING BALANCE</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.72rem', py: 1.5, px: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>INVOICE STATUS</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.72rem', py: 1.5, px: 2, textTransform: 'uppercase', letterSpacing: '0.05em', width: 140 }}>ACTIONS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <CircularProgress size={36} thickness={4} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, fontWeight: 600 }}>
                      Loading Bulker Invoice Statements...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : paginatedBulkers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
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
                    sx={{ '&:last-child td': { border: 0 }, transition: 'background-color 0.15s ease' }}
                  >
                    {/* Bulker Name */}
                    <TableCell sx={{ py: 1.4, px: 2, whiteSpace: 'nowrap' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                        <Avatar
                          sx={{
                            width: 36,
                            height: 36,
                            background: 'linear-gradient(135deg, #0f9d72, #059669)',
                            fontWeight: 800,
                            fontSize: '0.84rem',
                            color: '#fff',
                            flexShrink: 0,
                            boxShadow: '0 4px 10px rgba(15, 157, 114, 0.3)',
                          }}
                        >
                          {b.full_name ? b.full_name.charAt(0).toUpperCase() : 'B'}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 750, color: 'text.primary', lineHeight: 1.2 }}>
                            {b.full_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                            {b.phone || 'No phone'}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    {/* Bulker ID */}
                    <TableCell sx={{ py: 1.4, px: 2, whiteSpace: 'nowrap' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            fontFamily: 'monospace',
                            fontWeight: 750,
                            fontSize: '0.74rem',
                            px: 1,
                            py: 0.3,
                            borderRadius: '6px',
                            bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.05)',
                            color: isDark ? '#93c5fd' : '#1d4ed8',
                          }}
                        >
                          {b.bulker_id}
                        </Typography>
                        <Tooltip title={copiedKey === `inv_bid_${b.id}` ? 'Copied!' : 'Copy ID'}>
                          <IconButton size="small" onClick={(e) => copyToClipboard(b.bulker_id, `inv_bid_${b.id}`, e)} sx={{ p: 0.3 }}>
                            {copiedKey === `inv_bid_${b.id}` ? <DoneIcon sx={{ fontSize: 12, color: '#10b981' }} /> : <ContentCopyIcon sx={{ fontSize: 12 }} />}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>

                    {/* Account Mode */}
                    <TableCell sx={{ py: 1.4, px: 2, whiteSpace: 'nowrap' }}>
                      <Chip
                        label={b.account_type || 'Wallet System'}
                        size="small"
                        sx={{
                          fontWeight: 800,
                          fontSize: '0.7rem',
                          borderRadius: '6px',
                          bgcolor: b.account_type === 'Manual'
                            ? (isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.10)')
                            : (isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'),
                          color: b.account_type === 'Manual' ? '#f59e0b' : 'text.secondary',
                          border: `1px solid ${b.account_type === 'Manual' ? 'rgba(245, 158, 11, 0.3)' : 'transparent'}`,
                        }}
                      />
                    </TableCell>

                    {/* Manual Gross Total */}
                    <TableCell sx={{ py: 1.4, px: 2, whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" sx={{ fontWeight: 850, fontSize: '0.9rem', color: isDark ? '#f8fafc' : '#0f172a' }}>
                        {formatINR(b.totalManualGross)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem', display: 'block' }}>
                        {b.monthKeysCount} cycle(s) &bull; {b.manualLiveReviews || 0} reviews
                      </Typography>
                    </TableCell>

                    {/* Paid So Far */}
                    <TableCell sx={{ py: 1.4, px: 2, whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: b.totalPaid > 0 ? '#10b981' : 'text.secondary', fontSize: '0.9rem' }}>
                        {formatINR(b.totalPaid)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem', display: 'block' }}>
                        {b.totalPaid > 0 ? 'Disbursed' : 'No payout yet'}
                      </Typography>
                    </TableCell>

                    {/* Pending Balance */}
                    <TableCell align="right" sx={{ py: 1.4, px: 2, whiteSpace: 'nowrap' }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 900,
                          color: b.pendingBalance > 0.01 ? '#ef4444' : '#10b981',
                          fontSize: '0.95rem',
                        }}
                      >
                        {formatINR(b.pendingBalance)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: b.pendingBalance > 0.01 ? '#ef4444' : '#10b981', fontWeight: 700, fontSize: '0.68rem', display: 'block' }}>
                        {b.pendingBalance > 0.01 ? 'Outstanding' : 'Cleared'}
                      </Typography>
                    </TableCell>

                    {/* Invoice Status */}
                    <TableCell align="center" sx={{ py: 1.4, px: 2, whiteSpace: 'nowrap' }}>
                      {b.totalManualGross === 0 ? (
                        <Chip label="No Invoices" size="small" sx={{ fontWeight: 700, fontSize: '0.68rem', borderRadius: '6px' }} />
                      ) : b.pendingBalance <= 0.01 ? (
                        <Chip
                          label="FULLY PAID"
                          size="small"
                          sx={{
                            fontWeight: 850,
                            fontSize: '0.68rem',
                            borderRadius: '6px',
                            bgcolor: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.10)',
                            color: '#10b981',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                          }}
                        />
                      ) : b.totalPaid > 0 ? (
                        <Chip
                          label="PARTIAL"
                          size="small"
                          sx={{
                            fontWeight: 850,
                            fontSize: '0.68rem',
                            borderRadius: '6px',
                            bgcolor: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.10)',
                            color: '#f59e0b',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                          }}
                        />
                      ) : (
                        <Chip
                          label="PENDING"
                          size="small"
                          sx={{
                            fontWeight: 850,
                            fontSize: '0.68rem',
                            borderRadius: '6px',
                            bgcolor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.10)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                          }}
                        />
                      )}
                    </TableCell>

                    {/* Action */}
                    <TableCell align="center" sx={{ py: 1.4, px: 2, whiteSpace: 'nowrap' }}>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<VisibilityIcon fontSize="small" />}
                        onClick={() => navigate(`/payments/bulkers/invoices/${encodeURIComponent(b.id || b.bulker_id)}`)}
                        sx={{
                          borderRadius: '10px',
                          textTransform: 'none',
                          fontWeight: 750,
                          fontSize: '0.78rem',
                          px: 2,
                          py: 0.5,
                          bgcolor: '#0f9d72',
                          '&:hover': { bgcolor: '#0b7e5b' },
                          boxShadow: 'none',
                        }}
                      >
                        Invoices
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
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50]}
          sx={{
            borderTop: `1px solid ${theme.palette.divider}`,
            '& .MuiTablePagination-toolbar': { minHeight: 46, px: 2 },
          }}
        />
      </Paper>
    </Box>
  );
}
