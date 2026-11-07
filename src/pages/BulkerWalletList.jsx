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
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import GroupIcon from '@mui/icons-material/Group';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DoneIcon from '@mui/icons-material/Done';
import FlashOnIcon from '@mui/icons-material/FlashOn';

import {
  getBulkerFinances,
  invalidateBulkerFinancesCache,
} from '../utils/bulkerFinancesCache';
import { formatINR } from '../utils/bulkerPaymentCalculations';

export default function BulkerWalletList() {
  const theme = useTheme();
  const navigate = useNavigate();
  const isDark = theme.palette.mode === 'dark';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bulkers, setBulkers] = useState([]);
  const [isCached, setIsCached] = useState(false);
  const [cacheAge, setCacheAge] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination state
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
      console.error('Error fetching bulker wallets:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false);
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
    page * rowsPerPage + rowsPerPage,
  );

  const handleViewBulker = (bulker) => {
    const targetId = bulker?.id || bulker?.bulker_id;
    navigate(`/payments/bulkers/wallet/${encodeURIComponent(targetId)}`);
  };

  return (
    <Box sx={{ maxWidth: 1440, mx: 'auto', p: { xs: 1.5, md: 3 }, pb: 12 }}>
      {/* HEADER POD */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, mb: 3.5, flexWrap: 'wrap', gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5, flexWrap: 'wrap' }}>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.03em' }}>
              Bulker Wallet System
            </Typography>
            <Chip
              size="small"
              icon={isCached ? <FlashOnIcon sx={{ fontSize: '13px !important' }} /> : <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#10b981', boxShadow: '0 0 8px #10b981' }} />}
              label={isCached ? `INSTANT CACHE • 0 KB EGRESS (${cacheAge})` : 'LIVE WALLETS AUDITED'}
              sx={{
                height: 24,
                fontSize: '0.66rem',
                fontWeight: 800,
                letterSpacing: '0.04em',
                bgcolor: isCached ? (isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.10)') : (isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.10)'),
                color: isCached ? '#8b5cf6' : '#10b981',
                border: `1px solid ${isCached ? 'rgba(139, 92, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
              }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
            Formula: (Assigned Rate - Member Rate) × Verified Live Apps during Wallet System periods
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant="outlined"
            startIcon={<ReceiptLongIcon />}
            onClick={() => navigate('/payments/bulkers/invoices')}
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
            Bulker Invoices
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
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              boxShadow: '0 4px 16px rgba(37, 99, 235, 0.35)',
            }}
          >
            {refreshing ? 'Syncing...' : 'Refresh'}
          </Button>
        </Stack>
      </Box>

      {/* 4 PRO-PREMIUM STAT PODS */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        {/* Total Bulkers */}
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
              <GroupIcon />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#3b82f6', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.68rem', display: 'block' }}>
                Total Bulkers
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, color: isDark ? '#f8fafc' : '#0f172a', mt: 0.3 }}>
                {bulkers.length} Desks
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                Active partner organizations
              </Typography>
            </Box>
          </Box>
        </Grid>

        {/* Total Bulker Balance */}
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
              <AccountBalanceWalletIcon />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.68rem', display: 'block' }}>
                Bulker Balance Pool
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, color: '#10b981', mt: 0.3 }}>
                {formatINR(totalBalance)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                Cumulative wallet holdings
              </Typography>
            </Box>
          </Box>
        </Grid>

        {/* Total Credited */}
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
              <ArrowUpwardIcon />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#8b5cf6', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.68rem', display: 'block' }}>
                Total Credited
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, color: isDark ? '#f8fafc' : '#0f172a', mt: 0.3 }}>
                {formatINR(totalCredits)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                Earnings and adjustments
              </Typography>
            </Box>
          </Box>
        </Grid>

        {/* Total Debited */}
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
              <ArrowDownwardIcon />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.68rem', display: 'block' }}>
                Total Debited
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, color: isDark ? '#f8fafc' : '#0f172a', mt: 0.3 }}>
                {formatINR(totalDebits)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                Settled payouts to bulkers
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
        {/* Table Filters Bar */}
        <Box sx={{ p: 2.2, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search bulker by name, ID, phone, email..."
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
            label="Account Type"
            value={accountTypeFilter}
            onChange={(e) => { setAccountTypeFilter(e.target.value); setPage(0); }}
            sx={{ minWidth: 160, '& .MuiOutlinedInput-root': { borderRadius: '12px', fontSize: '0.84rem' } }}
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
            sx={{ minWidth: 140, '& .MuiOutlinedInput-root': { borderRadius: '12px', fontSize: '0.84rem' } }}
          >
            <MenuItem value="ALL">All Status</MenuItem>
            <MenuItem value="ACTIVE">Active</MenuItem>
            <MenuItem value="INACTIVE">Inactive</MenuItem>
          </TextField>
        </Box>

        {/* Table */}
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(15, 23, 42, 0.02)' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', py: 1.5, px: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>BULKER NAME</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', py: 1.5, px: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>BULKER ID</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', py: 1.5, px: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ACCOUNT TYPE</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', py: 1.5, px: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CONTACT</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.72rem', py: 1.5, px: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>WALLET BALANCE</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.72rem', py: 1.5, px: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>LIVE REVIEWS</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.72rem', py: 1.5, px: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>STATUS</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.72rem', py: 1.5, px: 2, textTransform: 'uppercase', letterSpacing: '0.05em', width: 110 }}>ACTION</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <CircularProgress size={36} thickness={4} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, fontWeight: 600 }}>
                      Loading Bulker Financial Ledger...
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
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    {/* Bulker Name */}
                    <TableCell sx={{ py: 1.4, px: 2, whiteSpace: 'nowrap' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                        <Avatar
                          sx={{
                            width: 36,
                            height: 36,
                            background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                            fontWeight: 800,
                            fontSize: '0.84rem',
                            color: '#fff',
                            flexShrink: 0,
                            boxShadow: '0 4px 10px rgba(139, 92, 246, 0.3)',
                          }}
                        >
                          {b.full_name ? b.full_name.charAt(0).toUpperCase() : 'B'}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 750, color: 'text.primary', lineHeight: 1.2 }}>
                            {b.full_name}
                          </Typography>
                          <Chip
                            label={`${b.txCount || 0} transactions`}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.62rem',
                              fontWeight: 750,
                              borderRadius: '6px',
                              mt: 0.3,
                              bgcolor: isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)',
                              color: '#3b82f6',
                            }}
                          />
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
                        <Tooltip title={copiedKey === `bid_${b.id}` ? 'Copied!' : 'Copy Bulker ID'}>
                          <IconButton size="small" onClick={(e) => copyToClipboard(b.bulker_id, `bid_${b.id}`, e)} sx={{ p: 0.3 }}>
                            {copiedKey === `bid_${b.id}` ? <DoneIcon sx={{ fontSize: 12, color: '#10b981' }} /> : <ContentCopyIcon sx={{ fontSize: 12 }} />}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>

                    {/* Account Type */}
                    <TableCell sx={{ py: 1.4, px: 2, whiteSpace: 'nowrap' }}>
                      <Chip
                        icon={<AccountBalanceWalletIcon sx={{ fontSize: '0.85rem !important' }} />}
                        label={b.account_type || 'Wallet System'}
                        size="small"
                        sx={{
                          fontWeight: 800,
                          fontSize: '0.7rem',
                          borderRadius: '6px',
                          bgcolor: b.account_type === 'Manual'
                            ? (isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)')
                            : (isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.10)'),
                          color: b.account_type === 'Manual' ? 'text.secondary' : '#10b981',
                          border: `1px solid ${b.account_type === 'Manual' ? 'transparent' : 'rgba(16, 185, 129, 0.3)'}`,
                        }}
                      />
                    </TableCell>

                    {/* Contact Details */}
                    <TableCell sx={{ py: 1.4, px: 2, whiteSpace: 'nowrap' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                        {b.phone && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, fontSize: '0.74rem', color: 'text.secondary' }}>
                            <PhoneIcon sx={{ fontSize: 12 }} />
                            <span>{b.phone}</span>
                          </Box>
                        )}
                        {b.email && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, fontSize: '0.74rem', color: 'text.secondary' }}>
                            <EmailIcon sx={{ fontSize: 12 }} />
                            <span>{b.email}</span>
                          </Box>
                        )}
                      </Box>
                    </TableCell>

                    {/* Wallet Balance */}
                    <TableCell align="right" sx={{ py: 1.4, px: 2, whiteSpace: 'nowrap' }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 900,
                          fontSize: '0.94rem',
                          color: (b.balance || 0) >= 0 ? '#10b981' : 'error.main',
                        }}
                      >
                        {formatINR(b.balance)}
                      </Typography>
                    </TableCell>

                    {/* Live Reviews */}
                    <TableCell align="center" sx={{ py: 1.4, px: 2, whiteSpace: 'nowrap' }}>
                      <Stack direction="row" spacing={0.6} justifyContent="center" alignItems="center">
                        <Chip
                          label={`${b.walletLiveReviews || 0} Live`}
                          size="small"
                          sx={{
                            fontWeight: 800,
                            fontSize: '0.68rem',
                            height: 20,
                            borderRadius: '5px',
                            bgcolor: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.10)',
                            color: '#10b981',
                          }}
                        />
                        {b.manualLiveReviews > 0 && (
                          <Chip
                            label={`${b.manualLiveReviews} Manual`}
                            size="small"
                            variant="outlined"
                            sx={{ fontWeight: 700, fontSize: '0.66rem', height: 20, borderRadius: '5px' }}
                          />
                        )}
                      </Stack>
                    </TableCell>

                    {/* Status */}
                    <TableCell align="center" sx={{ py: 1.4, px: 2, whiteSpace: 'nowrap' }}>
                      <Chip
                        label={b.status || 'Active'}
                        size="small"
                        sx={{
                          fontWeight: 800,
                          fontSize: '0.68rem',
                          borderRadius: '6px',
                          bgcolor: b.status === 'Active' || b.status === 'Verified'
                            ? (isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.10)')
                            : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
                          color: b.status === 'Active' || b.status === 'Verified' ? '#10b981' : 'text.secondary',
                        }}
                      />
                    </TableCell>

                    {/* Action */}
                    <TableCell align="center" sx={{ py: 1.4, px: 2, whiteSpace: 'nowrap' }}>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<VisibilityIcon fontSize="small" />}
                        onClick={() => handleViewBulker(b)}
                        sx={{
                          borderRadius: '10px',
                          textTransform: 'none',
                          fontWeight: 750,
                          fontSize: '0.78rem',
                          px: 1.8,
                          py: 0.5,
                          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                          boxShadow: 'none',
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
