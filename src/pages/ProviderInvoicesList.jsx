import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, CircularProgress, Chip, Avatar, Stack,
  TextField, InputAdornment, useTheme, Grid, IconButton, Tooltip,
  Snackbar
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import BusinessIcon from '@mui/icons-material/Business';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import VerifiedIcon from '@mui/icons-material/Verified';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CloseIcon from '@mui/icons-material/Close';

import {
  getProviderFinances,
  invalidateProviderFinancesCache
} from '../utils/providerFinancesCache';
import { formatINR } from '../utils/providerPaymentCalculations';

export default function ProviderInvoicesList() {
  const theme = useTheme();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [providersData, setProvidersData] = useState([]);
  const [totals, setTotals] = useState({
    totalBilled: 0,
    totalPaid: 0,
    totalDue: 0,
    totalLiveReviews: 0,
    totalApps: 0,
    activeProvidersCount: 0
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'SETTLED'
  const [toast, setToast] = useState({ open: false, type: 'success', title: '', message: '' });

  const showToast = (type, title, message = '') => {
    setToast({ open: true, type, title, message });
  };

  const copyToClipboard = (text, label = 'Copied') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast('success', `${label} Copied!`, text);
  };

  const loadData = async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      if (forceRefresh) {
        invalidateProviderFinancesCache();
      }
      const res = await getProviderFinances({ forceRefresh });
      setProvidersData(res.providers || []);
      setTotals(res.totals || {});
    } catch (err) {
      console.error('Failed to load provider finances:', err);
      showToast('error', 'Load Failed', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered providers
  const filteredProviders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return providersData.filter((item) => {
      const p = item.provider;
      const matchesSearch =
        !q ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.provider_id && p.provider_id.toLowerCase().includes(q)) ||
        (p.phone && String(p.phone).includes(q)) ||
        (p.email && p.email.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (statusFilter === 'PENDING') {
        return item.remainingDue > 0.01;
      }
      if (statusFilter === 'SETTLED') {
        return item.totalBilledAmount > 0 && item.remainingDue <= 0.01;
      }
      return true;
    });
  }, [providersData, searchQuery, statusFilter]);

  if (loading) {
    return (
      <Box sx={{ p: 8, textAlign: 'center', maxWidth: 800, mx: 'auto' }}>
        <CircularProgress size={46} thickness={4} />
        <Typography variant="body1" sx={{ fontWeight: 750, mt: 3, color: 'text.primary' }}>
          Loading Provider Billing & Invoices Desk...
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Auditing agency campaigns, verified live deliverables, and settlement ledgers.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto', px: { xs: 1.5, sm: 3 }, py: 3 }}>
      {/* 1. TOP EXECUTIVE HEADER BANNER */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3 },
          mb: 3,
          borderRadius: '24px',
          border: `1px solid ${theme.palette.divider}`,
          background: theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.9) 100%)'
            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          boxShadow: theme.palette.mode === 'dark'
            ? '0 10px 30px rgba(0,0,0,0.35)'
            : '0 10px 25px rgba(15,23,42,0.04)'
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              sx={{
                width: 52,
                height: 52,
                bgcolor: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.25)'
              }}
            >
              <BusinessIcon sx={{ fontSize: 28 }} />
            </Avatar>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.02em', color: 'text.primary' }}>
                  Provider Billing & Invoices
                </Typography>
                <Chip
                  label="Agency Billing Desk"
                  size="small"
                  sx={{
                    fontWeight: 800,
                    fontSize: '0.72rem',
                    borderRadius: '8px',
                    bgcolor: 'rgba(245, 158, 11, 0.12)',
                    color: '#d97706',
                    border: '1px solid rgba(245, 158, 11, 0.25)'
                  }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
                Multi-agency sponsor billing, verified live review deliverables, and invoice disbursements
              </Typography>
            </Box>
          </Box>

          <Button
            variant="outlined"
            size="small"
            startIcon={refreshing ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            disabled={refreshing}
            onClick={() => loadData(true)}
            sx={{
              borderRadius: '12px',
              fontWeight: 750,
              textTransform: 'none',
              px: 2,
              borderWidth: '1.5px'
            }}
          >
            {refreshing ? 'Refreshing...' : 'Refresh Records'}
          </Button>
        </Box>
      </Paper>

      {/* 2. 4 EXECUTIVE FINTECH TELEMETRY KPI PODS */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        {/* Metric 1: Total Billed */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '20px',
              border: '1.5px solid rgba(37,99,235,0.25)',
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(37,99,235,0.06)' : 'rgba(37,99,235,0.03)',
              height: '100%'
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Total Invoiced / Billed
              </Typography>
              <Avatar sx={{ width: 34, height: 34, bgcolor: 'rgba(37,99,235,0.12)', color: 'primary.main' }}>
                <ReceiptLongIcon sx={{ fontSize: 18 }} />
              </Avatar>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 900, color: 'text.primary', letterSpacing: '-0.02em' }}>
              {formatINR(totals.totalBilled)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.6 }}>
              {totals.totalLiveReviews?.toLocaleString()} verified live deliverables
            </Typography>
          </Paper>
        </Grid>

        {/* Metric 2: Total Paid */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '20px',
              border: '1.5px solid rgba(16,185,129,0.25)',
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.03)',
              height: '100%'
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Total Paid / Disbursed
              </Typography>
              <Avatar sx={{ width: 34, height: 34, bgcolor: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                <CheckCircleIcon sx={{ fontSize: 18 }} />
              </Avatar>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 900, color: '#10b981', letterSpacing: '-0.02em' }}>
              {formatINR(totals.totalPaid)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.6 }}>
              Settled agency payouts recorded
            </Typography>
          </Paper>
        </Grid>

        {/* Metric 3: Pending Balance */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '20px',
              border: `1.5px solid ${totals.totalDue > 0.01 ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
              bgcolor: totals.totalDue > 0.01
                ? theme.palette.mode === 'dark' ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.03)'
                : theme.palette.mode === 'dark' ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.03)',
              height: '100%'
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 800,
                  color: totals.totalDue > 0.01 ? '#dc2626' : '#10b981',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em'
                }}
              >
                Pending Settlement Due
              </Typography>
              <Avatar
                sx={{
                  width: 34,
                  height: 34,
                  bgcolor: totals.totalDue > 0.01 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                  color: totals.totalDue > 0.01 ? '#dc2626' : '#10b981'
                }}
              >
                <AccountBalanceWalletIcon sx={{ fontSize: 18 }} />
              </Avatar>
            </Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 900,
                color: totals.totalDue > 0.01 ? '#dc2626' : '#10b981',
                letterSpacing: '-0.02em'
              }}
            >
              {formatINR(totals.totalDue)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.6 }}>
              Awaiting agency clearance
            </Typography>
          </Paper>
        </Grid>

        {/* Metric 4: Registered Agencies */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '20px',
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(15,23,42,0.6)' : '#ffffff',
              height: '100%'
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Registered Agencies
              </Typography>
              <Avatar sx={{ width: 34, height: 34, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f1f5f9', color: 'text.primary' }}>
                <BusinessIcon sx={{ fontSize: 18 }} />
              </Avatar>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 900, color: 'text.primary', letterSpacing: '-0.02em' }}>
              {providersData.length} Agencies
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.6 }}>
              {totals.totalApps} campaign apps managed
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* 3. SEARCH & STATUS FILTER STRIP */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: '20px',
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(15,23,42,0.6)' : '#ffffff'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          {/* Search Field */}
          <TextField
            size="small"
            placeholder="Search Agency Name, Provider ID, Phone, or Email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                </InputAdornment>
              )
            }}
            sx={{
              minWidth: { xs: '100%', sm: 340 },
              '& .MuiOutlinedInput-root': { borderRadius: '14px' }
            }}
          />

          {/* Fast Status Filter Pills */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={`All Agencies (${providersData.length})`}
              clickable
              onClick={() => setStatusFilter('ALL')}
              color={statusFilter === 'ALL' ? 'primary' : 'default'}
              variant={statusFilter === 'ALL' ? 'filled' : 'outlined'}
              sx={{ fontWeight: 750, borderRadius: '10px' }}
            />
            <Chip
              label="Pending Settlement"
              clickable
              onClick={() => setStatusFilter('PENDING')}
              color={statusFilter === 'PENDING' ? 'warning' : 'default'}
              variant={statusFilter === 'PENDING' ? 'filled' : 'outlined'}
              sx={{ fontWeight: 750, borderRadius: '10px' }}
            />
            <Chip
              label="Fully Settled"
              clickable
              onClick={() => setStatusFilter('SETTLED')}
              color={statusFilter === 'SETTLED' ? 'success' : 'default'}
              variant={statusFilter === 'SETTLED' ? 'filled' : 'outlined'}
              sx={{ fontWeight: 750, borderRadius: '10px' }}
            />
          </Box>
        </Box>
      </Paper>

      {/* 4. PROVIDER ROSTER TABLE */}
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          borderRadius: '24px',
          border: `1px solid ${theme.palette.divider}`,
          overflow: 'hidden',
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(15,23,42,0.6)' : '#ffffff'
        }}
      >
        <Table>
          <TableHead sx={{ bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#f8fafc' }}>
            <TableRow>
              <TableCell align="center" sx={{ fontWeight: 850, fontSize: '0.74rem', color: 'text.secondary', width: '50px' }}>
                NO.
              </TableCell>
              <TableCell sx={{ fontWeight: 850, fontSize: '0.74rem', color: 'text.secondary' }}>
                PROVIDER / AGENCY PARTNER
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 850, fontSize: '0.74rem', color: 'text.secondary' }}>
                CAMPAIGN APPS
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 850, fontSize: '0.74rem', color: 'text.secondary' }}>
                LIVE DELIVERABLES
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 850, fontSize: '0.74rem', color: 'text.secondary' }}>
                TOTAL BILLED AMOUNT
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 850, fontSize: '0.74rem', color: 'text.secondary' }}>
                TOTAL PAID
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 850, fontSize: '0.74rem', color: 'text.secondary' }}>
                PENDING DUE
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 850, fontSize: '0.74rem', color: 'text.secondary' }}>
                SETTLEMENT STATUS
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 850, fontSize: '0.74rem', color: 'text.secondary', width: '130px' }}>
                ACTIONS
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredProviders.length > 0 ? (
              filteredProviders.map((item, idx) => {
                const p = item.provider;
                const isFullyPaid = item.totalBilledAmount > 0 && item.remainingDue <= 0.01;
                const isPartiallyPaid = item.totalPaidAmount > 0 && item.remainingDue > 0.01;

                return (
                  <TableRow
                    key={p.id || p.provider_id}
                    hover
                    sx={{
                      '&:last-child td, &:last-child th': { border: 0 },
                      transition: 'background-color 0.15s'
                    }}
                  >
                    {/* Index */}
                    <TableCell align="center" sx={{ fontSize: '0.78rem', color: 'text.secondary', fontWeight: 750, fontFamily: 'monospace' }}>
                      {String(idx + 1).padStart(2, '0')}
                    </TableCell>

                    {/* Provider Profile Info */}
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar
                          sx={{
                            width: 40,
                            height: 40,
                            fontWeight: 900,
                            fontSize: '0.95rem',
                            bgcolor: 'rgba(245, 158, 11, 0.12)',
                            color: '#d97706',
                            border: '1px solid rgba(245, 158, 11, 0.25)'
                          }}
                        >
                          {(p.name || 'P').charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 850, color: 'text.primary', lineHeight: 1.3 }}>
                            {p.name}
                          </Typography>
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
                            <Chip
                              label={p.provider_id}
                              size="small"
                              onClick={() => copyToClipboard(p.provider_id, 'Provider ID')}
                              clickable
                              sx={{
                                height: 18,
                                fontSize: '0.66rem',
                                fontWeight: 800,
                                fontFamily: 'monospace',
                                borderRadius: '6px',
                                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                                color: 'text.primary'
                              }}
                            />
                            <Tooltip title="Copy Provider ID">
                              <IconButton
                                size="small"
                                onClick={() => copyToClipboard(p.provider_id, 'Provider ID')}
                                sx={{ p: 0.2 }}
                              >
                                <ContentCopyIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                          {(p.phone || p.email) && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.4 }}>
                              {p.phone && (
                                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, fontSize: '0.7rem', color: 'text.secondary' }}>
                                  <PhoneIcon sx={{ fontSize: 11 }} />
                                  {p.phone}
                                </Box>
                              )}
                              {p.email && (
                                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, fontSize: '0.7rem', color: 'text.secondary' }}>
                                  <EmailIcon sx={{ fontSize: 11 }} />
                                  {p.email}
                                </Box>
                              )}
                            </Box>
                          )}
                        </Box>
                      </Box>
                    </TableCell>

                    {/* Campaign Apps Count */}
                    <TableCell align="center">
                      <Chip
                        label={`${item.appsCount} Apps`}
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          borderRadius: '8px',
                          bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#f1f5f9'
                        }}
                      />
                    </TableCell>

                    {/* Live Reviews Count */}
                    <TableCell align="center">
                      <Chip
                        label={`${item.totalLiveReviews?.toLocaleString()} Live`}
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          borderRadius: '8px',
                          bgcolor: item.totalLiveReviews > 0 ? 'rgba(16,185,129,0.1)' : 'transparent',
                          color: item.totalLiveReviews > 0 ? '#10b981' : 'text.secondary',
                          border: `1px solid ${item.totalLiveReviews > 0 ? 'rgba(16,185,129,0.25)' : theme.palette.divider}`
                        }}
                      />
                    </TableCell>

                    {/* Total Billed Amount */}
                    <TableCell align="right" sx={{ fontWeight: 900, color: 'primary.main', fontSize: '0.92rem' }}>
                      {formatINR(item.totalBilledAmount)}
                    </TableCell>

                    {/* Total Paid Amount */}
                    <TableCell align="right" sx={{ fontWeight: 800, color: '#10b981', fontSize: '0.88rem' }}>
                      {formatINR(item.totalPaidAmount)}
                    </TableCell>

                    {/* Pending Due Amount */}
                    <TableCell align="right">
                      <Typography
                        sx={{
                          fontWeight: 900,
                          fontSize: '0.95rem',
                          color: item.remainingDue > 0.01 ? '#dc2626' : '#10b981'
                        }}
                      >
                        {formatINR(item.remainingDue)}
                      </Typography>
                    </TableCell>

                    {/* Payment Status Chip */}
                    <TableCell align="center">
                      <Chip
                        label={
                          isFullyPaid
                            ? 'SETTLED'
                            : isPartiallyPaid
                            ? 'PARTIAL'
                            : item.totalBilledAmount === 0
                            ? 'NO DUES'
                            : 'PENDING'
                        }
                        size="small"
                        color={isFullyPaid ? 'success' : isPartiallyPaid ? 'warning' : item.totalBilledAmount === 0 ? 'default' : 'error'}
                        sx={{
                          height: 22,
                          fontSize: '0.68rem',
                          fontWeight: 850,
                          borderRadius: '8px'
                        }}
                      />
                    </TableCell>

                    {/* Action Button: View Bills */}
                    <TableCell align="center">
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<ReceiptLongIcon sx={{ fontSize: 16 }} />}
                        onClick={() => navigate(`/payments/providers/invoices/${encodeURIComponent(p.id || p.provider_id)}`)}
                        sx={{
                          borderRadius: '12px',
                          textTransform: 'none',
                          fontWeight: 800,
                          fontSize: '0.75rem',
                          py: 0.6,
                          px: 1.8,
                          boxShadow: '0 3px 10px rgba(37,99,235,0.2)'
                        }}
                      >
                        View Bills
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  No provider agencies found matching your search or filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Floating Toast Notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3200}
        onClose={() => setToast(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ top: { xs: 20, sm: 28 }, zIndex: 99999 }}
      >
        <Paper
          elevation={12}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.4,
            py: 1,
            px: 2.2,
            borderRadius: '100px',
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.98)',
            border: '1px solid',
            borderColor:
              toast.type === 'success'
                ? 'rgba(16, 185, 129, 0.45)'
                : toast.type === 'warning'
                ? 'rgba(245, 158, 11, 0.45)'
                : 'rgba(239, 68, 68, 0.45)',
            boxShadow: '0 12px 36px rgba(0,0,0,0.2)',
            minWidth: { xs: 290, sm: 360 }
          }}
        >
          <Avatar
            sx={{
              width: 30,
              height: 30,
              bgcolor:
                toast.type === 'success'
                  ? 'rgba(16, 185, 129, 0.15)'
                  : toast.type === 'warning'
                  ? 'rgba(245, 158, 11, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)',
              color:
                toast.type === 'success'
                  ? '#10b981'
                  : toast.type === 'warning'
                  ? '#f59e0b'
                  : '#ef4444'
            }}
          >
            {toast.type === 'success' && <CheckCircleIcon sx={{ fontSize: 18 }} />}
            {toast.type === 'warning' && <WarningAmberIcon sx={{ fontSize: 18 }} />}
            {toast.type === 'error' && <CloseIcon sx={{ fontSize: 18 }} />}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: '0.86rem' }}>
              {toast.title}
            </Typography>
            {toast.message && (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem' }} noWrap>
                {toast.message}
              </Typography>
            )}
          </Box>
        </Paper>
      </Snackbar>
    </Box>
  );
}
