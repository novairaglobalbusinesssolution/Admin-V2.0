import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';

// Material Icons
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DoneIcon from '@mui/icons-material/Done';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import PersonIcon from '@mui/icons-material/Person';
import StorefrontIcon from '@mui/icons-material/Storefront';
import BusinessIcon from '@mui/icons-material/Business';
import ShieldIcon from '@mui/icons-material/Shield';

import { supabase } from '../supabaseClient';
import { fetchPaymentDashboardData } from '../utils/paymentDashboardDao';

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const formatMoney = (value) => currencyFormatter.format(Number(value || 0));
const getTodayInputDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

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

function FinTechKpiCard({ title, value, helper, icon, color = '#10b981', loading = false, onClick, actionLabel }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      onClick={onClick}
      sx={{
        p: 2.5,
        borderRadius: '22px',
        position: 'relative',
        overflow: 'hidden',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        bgcolor: isDark ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(16px)',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
        boxShadow: isDark
          ? '0 10px 30px -10px rgba(0, 0, 0, 0.5)'
          : '0 10px 30px -10px rgba(0, 0, 0, 0.04)',
        '&:hover': onClick ? {
          transform: 'translateY(-3px)',
          borderColor: `${color}60`,
          boxShadow: `0 16px 36px -10px ${color}35`,
        } : {},
      }}
    >
      {/* Background Accent Glow */}
      <Box
        sx={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 120,
          height: 120,
          borderRadius: '50%',
          bgcolor: color,
          opacity: isDark ? 0.08 : 0.07,
          filter: 'blur(30px)',
          pointerEvents: 'none',
        }}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: `${color}18`,
              color: color,
              border: `1px solid ${color}35`,
            }}
          >
            {icon}
          </Box>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 800,
              fontSize: '0.72rem',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'text.secondary',
            }}
          >
            {title}
          </Typography>
        </Box>
        {actionLabel && (
          <Chip
            size="small"
            label={actionLabel}
            icon={<ArrowForwardIcon sx={{ fontSize: '12px !important' }} />}
            sx={{
              height: 22,
              fontSize: '0.65rem',
              fontWeight: 800,
              bgcolor: `${color}15`,
              color: color,
              border: `1px solid ${color}30`,
              cursor: 'pointer',
            }}
          />
        )}
      </Box>

      <Box sx={{ mt: 0.5 }}>
        {loading ? (
          <Skeleton variant="text" animation="wave" width="75%" height={48} />
        ) : (
          <Typography
            variant="h4"
            sx={{
              fontWeight: 900,
              letterSpacing: '-0.02em',
              color: isDark ? '#f8fafc' : '#0f172a',
              fontSize: { xs: '1.5rem', sm: '1.75rem' },
            }}
          >
            {value}
          </Typography>
        )}

        {helper && (
          loading ? (
            <Skeleton variant="text" animation="wave" width="50%" height={20} sx={{ mt: 0.5 }} />
          ) : (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mt: 0.6 }}>
              {helper}
            </Typography>
          )
        )}
      </Box>
    </Box>
  );
}

export default function PaymentDashboard() {
  const theme = useTheme();
  const navigate = useNavigate();
  const isDark = theme.palette.mode === 'dark';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [summaryUpdating, setSummaryUpdating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState('');
  const [partyLoading, setPartyLoading] = useState(false);
  const [partyOptions, setPartyOptions] = useState([]);
  const [selectedParty, setSelectedParty] = useState(null);
  const [copiedTxnId, setCopiedTxnId] = useState(null);

  const [manualForm, setManualForm] = useState({
    transactionType: 'Credit',
    partyType: 'individual',
    amount: '',
    description: '',
    utrId: '',
    date: getTodayInputDate(),
  });

  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [filters, setFilters] = useState({
    search: '',
    status: 'All',
    minAmount: '',
    maxAmount: '',
  });

  const [summary, setSummary] = useState({
    currentCompanyBalance: 0,
    totalWithdrawalRequests: 0,
    pendingWithdrawalAmount: 0,
    totalProcessed: 0,
    transactions: [],
  });

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await fetchPaymentDashboardData();
        if (!active) return;
        setSummary(data);
      } catch (err) {
        if (!active) return;
        setError(err?.message || 'Failed to load payment dashboard data.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!manualDialogOpen || manualForm.partyType === 'adjustment') {
      setPartyOptions([]);
      setPartyLoading(false);
      return undefined;
    }

    let active = true;
    const loadParties = async () => {
      setPartyLoading(true);
      setManualError('');

      try {
        const partyQueries = {
          individual: () => supabase.from('profiles').select('earner_id, first_name, last_name, email').order('earner_id', { ascending: true }),
          bulker: () => supabase.from('bulker_desks').select('bulker_id, full_name').order('full_name', { ascending: true }),
          provider: () => supabase.from('providers').select('provider_id, name').order('name', { ascending: true }),
          client: () => supabase.from('clients').select('client_id, name').order('name', { ascending: true }),
          admin: () => supabase.from('admins').select('id, name, email').order('name', { ascending: true }),
        };
        const idFields = { individual: 'earner_id', bulker: 'bulker_id', provider: 'provider_id', client: 'client_id', admin: 'id' };
        const rows = await fetchAllRows(partyQueries[manualForm.partyType]);
        const options = rows
          .map((row) => {
            const id = String(row[idFields[manualForm.partyType]] || '');
            const name = manualForm.partyType === 'individual'
              ? `${row.first_name || ''} ${row.last_name || ''}`.trim()
              : row.full_name || row.name || '';
            return { id, name: name || id, detail: row.email || '' };
          })
          .filter((option) => option.id);

        if (active) setPartyOptions(options);
      } catch (err) {
        if (active) setManualError(err?.message || 'Could not load party records.');
      } finally {
        if (active) setPartyLoading(false);
      }
    };

    loadParties();
    return () => {
      active = false;
    };
  }, [manualDialogOpen, manualForm.partyType]);

  const filteredTransactions = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const minAmount = filters.minAmount === '' ? -Infinity : Number(filters.minAmount);
    const maxAmount = filters.maxAmount === '' ? Infinity : Number(filters.maxAmount);

    return summary.transactions.filter((row) => {
      const matchesSearch =
        !search ||
        [row.transaction_id, row.party_type, row.party_id, row.reference_type, row.reference_id, row.description].some((value) =>
          String(value || '').toLowerCase().includes(search),
        );

      const matchesStatus =
        filters.status === 'All' ||
        row.transaction_type === filters.status ||
        row.status === filters.status;
      const matchesMin = Number(row.amount) >= minAmount;
      const matchesMax = Number(row.amount) <= maxAmount;

      return matchesSearch && matchesStatus && matchesMin && matchesMax;
    });
  }, [filters, summary.transactions]);

  const paginatedTransactions = filteredTransactions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  useEffect(() => {
    setPage(0);
  }, [filters.search, filters.status, filters.minAmount, filters.maxAmount]);

  const handleResetFilters = () => {
    setFilters({
      search: '',
      status: 'All',
      minAmount: '',
      maxAmount: '',
    });
    setPage(0);
  };

  const handleCopyTransactionId = (txnId) => {
    navigator.clipboard.writeText(txnId);
    setCopiedTxnId(txnId);
    setTimeout(() => setCopiedTxnId(null), 2000);
    setToast({ open: true, message: `Copied Transaction ID: ${txnId}`, severity: 'info' });
  };

  const openManualDialog = () => {
    setManualForm({
      transactionType: 'Credit',
      partyType: 'individual',
      amount: '',
      description: '',
      utrId: '',
      date: getTodayInputDate(),
    });
    setSelectedParty(null);
    setManualError('');
    setManualDialogOpen(true);
  };

  const handleManualTransaction = async () => {
    const amount = Number(manualForm.amount);
    const isAdjustment = manualForm.partyType === 'adjustment';

    if (!Number.isFinite(amount) || amount <= 0) {
      setManualError('Enter an amount greater than zero.');
      return;
    }
    if (!manualForm.description.trim()) {
      setManualError('Enter a description for this transaction.');
      return;
    }
    if (!manualForm.date) {
      setManualError('Select a transaction date.');
      return;
    }
    if (!isAdjustment && !selectedParty) {
      setManualError('Select a party for this transaction.');
      return;
    }

    const id = globalThis.crypto.randomUUID();
    const createdAt = new Date(`${manualForm.date}T00:00:00+05:30`).toISOString();
    const transactionId = `MAN-${id.toUpperCase()}`;
    const payload = {
      id,
      transaction_id: transactionId,
      transaction_type: manualForm.transactionType,
      amount,
      reference_type: isAdjustment ? 'company_adjustment' : manualForm.partyType,
      reference_id: isAdjustment ? null : selectedParty.id,
      party_type: isAdjustment ? 'company' : manualForm.partyType,
      party_id: isAdjustment ? 'main_company' : selectedParty.id,
      description: manualForm.description.trim(),
      status: 'Completed',
      created_at: createdAt,
      metadata: {
        source: 'admin_manual_entry',
        party_name: isAdjustment ? 'Main company fund' : selectedParty.name,
        utr_id: manualForm.utrId.trim() || null,
      },
    };

    setManualSaving(true);
    setSummaryUpdating(true);
    setManualError('');
    try {
      const { error } = await supabase.from('company_fund_transactions').insert([payload]);
      if (error) throw error;

      const createdTransaction = {
        ...payload,
        transaction_id: payload.transaction_id,
        created_at_value: createdAt,
        created_at: new Date(createdAt).toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Kolkata',
        }),
      };

      setSummary((prev) => ({
        ...prev,
        currentCompanyBalance: prev.currentCompanyBalance + (payload.transaction_type === 'Credit' ? amount : -amount),
        totalProcessed: prev.totalProcessed + amount,
        transactions: [...prev.transactions, createdTransaction].sort(
          (a, b) => new Date(b.created_at_value).getTime() - new Date(a.created_at_value).getTime(),
        ),
      }));
      setPage(0);
      setManualDialogOpen(false);
      setToast({ open: true, message: 'Manual transaction added to company fund.', severity: 'success' });
    } catch (err) {
      setManualError(err?.message || 'Failed to add the transaction.');
    } finally {
      setManualSaving(false);
      setSummaryUpdating(false);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!deleteTarget) return;
    const row = deleteTarget;
    setDeletingId(row.id);
    setSummaryUpdating(true);

    try {
      const { error } = await supabase
        .from('company_fund_transactions')
        .delete()
        .eq('id', row.id);

      if (error) throw error;

      setSummary((prev) => {
        const amount = Number(row.amount || 0);
        const transactionType = String(row.transaction_type || '').toLowerCase();
        const status = String(row.status || '').toLowerCase();
        const isSuccessful = ['completed', 'success', 'successful'].includes(status);
        return {
          ...prev,
          currentCompanyBalance: prev.currentCompanyBalance + (isSuccessful ? (transactionType === 'debit' ? amount : -amount) : 0),
          totalWithdrawalRequests: prev.totalWithdrawalRequests,
          pendingWithdrawalAmount: prev.pendingWithdrawalAmount,
          totalProcessed: Math.max(0, prev.totalProcessed - (isSuccessful ? amount : 0)),
          transactions: prev.transactions.filter((item) => item.id !== row.id),
        };
      });

      setError('');
      setDeleteTarget(null);
      setToast({ open: true, message: 'Transaction deleted successfully.', severity: 'info' });
    } catch (err) {
      setError(err?.message || 'Failed to delete transaction.');
    } finally {
      setDeletingId(null);
      setSummaryUpdating(false);
    }
  };

  const getPartyIcon = (partyType) => {
    switch (String(partyType || '').toLowerCase()) {
      case 'individual':
        return <PersonIcon sx={{ fontSize: 13 }} />;
      case 'bulker':
        return <StorefrontIcon sx={{ fontSize: 13 }} />;
      case 'client':
        return <BusinessIcon sx={{ fontSize: 13 }} />;
      case 'provider':
        return <AccountBalanceIcon sx={{ fontSize: 13 }} />;
      default:
        return <ShieldIcon sx={{ fontSize: 13 }} />;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 2 }}>
        <CircularProgress size={36} thickness={4} />
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
          Synchronizing Financial Ledger...
        </Typography>
      </Box>
    );
  }

  const completedEntriesCount = summary.transactions.filter((t) =>
    ['completed', 'success', 'successful'].includes(String(t.status || '').toLowerCase()),
  ).length;

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
              Company Fund & Treasury
            </Typography>
            <Chip
              size="small"
              icon={<Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#10b981', boxShadow: '0 0 8px #10b981' }} />}
              label="POSTGREST LEDGER ONLINE"
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
            Centralized liquidity pool, pending withdrawal liabilities, and real-time ledger settlement.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openManualDialog}
            sx={{
              borderRadius: '14px',
              textTransform: 'none',
              fontWeight: 800,
              fontSize: '0.84rem',
              px: 2.5,
              py: 1.1,
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35)',
              '&:hover': {
                background: 'linear-gradient(135deg, #1d4ed8, #1e40af)',
                boxShadow: '0 12px 28px rgba(37, 99, 235, 0.45)',
              },
            }}
          >
            Record Manual Entry
          </Button>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: '16px' }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* 4 FINTECH KPI CARDS */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <FinTechKpiCard
            title="Company Balance"
            value={formatMoney(summary.currentCompanyBalance)}
            helper="Primary treasury liquidity"
            icon={<AccountBalanceWalletIcon fontSize="small" />}
            color="#10b981"
            loading={summaryUpdating}
          />
        </Grid>

        <Grid item xs={12} sm={6} lg={3}>
          <FinTechKpiCard
            title="Withdrawal Requests"
            value={summary.totalWithdrawalRequests}
            helper={`${formatMoney(summary.pendingWithdrawalAmount)} pending liability`}
            icon={<RequestQuoteIcon fontSize="small" />}
            color="#f59e0b"
            loading={summaryUpdating}
            actionLabel="View Queue"
            onClick={() => navigate('/payments/individuals/withdrawals')}
          />
        </Grid>

        <Grid item xs={12} sm={6} lg={3}>
          <FinTechKpiCard
            title="Total Processed"
            value={formatMoney(summary.totalProcessed)}
            helper="Gross transaction volume"
            icon={<TrendingUpIcon fontSize="small" />}
            color="#3b82f6"
            loading={summaryUpdating}
          />
        </Grid>

        <Grid item xs={12} sm={6} lg={3}>
          <FinTechKpiCard
            title="Verified Entries"
            value={completedEntriesCount}
            helper="Settled ledger transactions"
            icon={<ReceiptLongIcon fontSize="small" />}
            color="#8b5cf6"
            loading={summaryUpdating}
          />
        </Grid>
      </Grid>

      {/* TRANSACTION LEDGER PANEL */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: '24px',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
          bgcolor: isDark ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(16px)',
          overflow: 'hidden',
          boxShadow: isDark ? '0 12px 40px -10px rgba(0, 0, 0, 0.4)' : '0 12px 40px -10px rgba(0, 0, 0, 0.05)',
        }}
      >
        {/* Panel Header */}
        <Box
          sx={{
            p: { xs: 2, sm: 2.5 },
            borderBottom: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.10)',
                color: '#3b82f6',
              }}
            >
              <AccountBalanceIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 850, fontSize: '1.05rem', lineHeight: 1.2 }}>
                Company Fund Ledger
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {filteredTransactions.length} of {summary.transactions.length} total entries match filter
              </Typography>
            </Box>
          </Box>

          {/* Quick Status Pills */}
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {['All', 'Credit', 'Debit', 'Completed', 'Pending'].map((st) => {
              const active = filters.status === st;
              return (
                <Chip
                  key={st}
                  label={st}
                  size="small"
                  onClick={() => setFilters((prev) => ({ ...prev, status: st }))}
                  sx={{
                    fontWeight: 750,
                    fontSize: '0.72rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    bgcolor: active
                      ? (isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(37, 99, 235, 0.15)')
                      : (isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'),
                    color: active ? '#3b82f6' : 'text.secondary',
                    border: active ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
                  }}
                />
              );
            })}
          </Stack>
        </Box>

        {/* Filter Input Bar */}
        <Box
          sx={{
            p: 2,
            borderBottom: `1px solid ${theme.palette.divider}`,
            bgcolor: isDark ? 'rgba(15, 23, 42, 0.35)' : 'rgba(248, 250, 252, 0.7)',
          }}
        >
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={12} md={5}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search transaction ID, party ID, description, UTR..."
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary', fontSize: '1.1rem' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    fontSize: '0.82rem',
                  },
                }}
              />
            </Grid>

            <Grid item xs={6} md={2.5}>
              <TextField
                fullWidth
                size="small"
                placeholder="Min Amount (₹)"
                type="number"
                value={filters.minAmount}
                onChange={(e) => setFilters((prev) => ({ ...prev, minAmount: e.target.value }))}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    fontSize: '0.82rem',
                  },
                }}
              />
            </Grid>

            <Grid item xs={6} md={2.5}>
              <TextField
                fullWidth
                size="small"
                placeholder="Max Amount (₹)"
                type="number"
                value={filters.maxAmount}
                onChange={(e) => setFilters((prev) => ({ ...prev, maxAmount: e.target.value }))}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    fontSize: '0.82rem',
                  },
                }}
              />
            </Grid>

            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<RestartAltIcon fontSize="small" />}
                onClick={handleResetFilters}
                sx={{
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  py: 0.85,
                }}
              >
                Reset
              </Button>
            </Grid>
          </Grid>
        </Box>

        {/* Data Table */}
        {filteredTransactions.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center', color: 'text.secondary' }}>
            <ReceiptLongIcon sx={{ fontSize: 44, opacity: 0.3, mb: 1.5 }} />
            <Typography variant="body1" sx={{ fontWeight: 700, mb: 0.5 }}>
              No matching ledger records
            </Typography>
            <Typography variant="caption">
              Adjust search keywords or reset filter thresholds to reveal transactions.
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(15, 23, 42, 0.02)' }}>
                  <TableRow>
                    <TableCell sx={{ py: 1.5, px: 2, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Transaction ID
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: 1.5, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', width: 100 }}>
                      Type
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: 1.5, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Counterparty
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: 1.5, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Description
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.5, px: 2, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', width: 140 }}>
                      Amount
                    </TableCell>
                    <TableCell align="center" sx={{ py: 1.5, px: 1.5, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', width: 110 }}>
                      Status
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: 2, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', width: 150 }}>
                      Date & Time
                    </TableCell>
                    <TableCell align="center" sx={{ py: 1.5, px: 1.5, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', width: 90 }}>
                      Action
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedTransactions.map((row) => {
                    const isCredit = row.transaction_type === 'Credit';
                    const isCompleted = ['completed', 'success', 'successful'].includes(String(row.status || '').toLowerCase());
                    const isPending = String(row.status || '').toLowerCase() === 'pending';

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
                        {/* Transaction ID */}
                        <TableCell sx={{ py: 1.4, px: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                fontSize: '0.76rem',
                                color: isDark ? '#93c5fd' : '#1d4ed8',
                              }}
                            >
                              {row.transaction_id}
                            </Typography>
                            <Tooltip title={copiedTxnId === row.transaction_id ? 'Copied!' : 'Copy ID'}>
                              <IconButton
                                size="small"
                                onClick={() => handleCopyTransactionId(row.transaction_id)}
                                sx={{ p: 0.4, opacity: 0.7, '&:hover': { opacity: 1 } }}
                              >
                                {copiedTxnId === row.transaction_id ? (
                                  <DoneIcon sx={{ fontSize: 13, color: '#10b981' }} />
                                ) : (
                                  <ContentCopyIcon sx={{ fontSize: 13 }} />
                                )}
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>

                        {/* Type Badge */}
                        <TableCell sx={{ py: 1.4, px: 1.5 }}>
                          <Chip
                            label={isCredit ? '+ CREDIT' : '- DEBIT'}
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: '0.65rem',
                              fontWeight: 900,
                              letterSpacing: '0.04em',
                              borderRadius: '6px',
                              bgcolor: isCredit
                                ? (isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.12)')
                                : (isDark ? 'rgba(239, 68, 68, 0.18)' : 'rgba(239, 68, 68, 0.12)'),
                              color: isCredit ? '#10b981' : '#ef4444',
                              border: `1px solid ${isCredit ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                            }}
                          />
                        </TableCell>

                        {/* Counterparty */}
                        <TableCell sx={{ py: 1.4, px: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box
                              sx={{
                                width: 24,
                                height: 24,
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.05)',
                                color: 'text.secondary',
                              }}
                            >
                              {getPartyIcon(row.party_type)}
                            </Box>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.78rem', textTransform: 'capitalize' }}>
                                {row.party_type || 'Main Fund'}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.68rem', display: 'block' }}>
                                {row.party_id || 'System'}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>

                        {/* Description */}
                        <TableCell sx={{ py: 1.4, px: 1.5, maxWidth: 260 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              fontSize: '0.8rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {row.description || 'Ledger settlement'}
                          </Typography>
                          {row.metadata?.utr_id && (
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem', display: 'block' }}>
                              UTR: {row.metadata.utr_id}
                            </Typography>
                          )}
                        </TableCell>

                        {/* Amount */}
                        <TableCell align="right" sx={{ py: 1.4, px: 2 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 900,
                              fontSize: '0.92rem',
                              color: isCredit ? '#10b981' : (isDark ? '#f87171' : '#dc2626'),
                            }}
                          >
                            {isCredit ? '+' : '-'} {formatMoney(row.amount)}
                          </Typography>
                        </TableCell>

                        {/* Status */}
                        <TableCell align="center" sx={{ py: 1.4, px: 1.5 }}>
                          <Chip
                            icon={
                              isCompleted ? (
                                <CheckCircleIcon sx={{ fontSize: '12px !important' }} />
                              ) : isPending ? (
                                <PendingIcon sx={{ fontSize: '12px !important' }} />
                              ) : undefined
                            }
                            label={row.status || 'Completed'}
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              borderRadius: '6px',
                              bgcolor: isCompleted
                                ? (isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.10)')
                                : isPending
                                ? (isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.10)')
                                : (isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.10)'),
                              color: isCompleted ? '#10b981' : isPending ? '#f59e0b' : '#ef4444',
                              border: `1px solid ${
                                isCompleted
                                  ? 'rgba(16, 185, 129, 0.3)'
                                  : isPending
                                  ? 'rgba(245, 158, 11, 0.3)'
                                  : 'rgba(239, 68, 68, 0.3)'
                              }`,
                            }}
                          />
                        </TableCell>

                        {/* Date */}
                        <TableCell sx={{ py: 1.4, px: 2, fontSize: '0.78rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                          {row.created_at}
                        </TableCell>

                        {/* Action */}
                        <TableCell align="center" sx={{ py: 1.4, px: 1.5 }}>
                          <Tooltip title="Delete transaction">
                            <IconButton
                              size="small"
                              onClick={() => setDeleteTarget(row)}
                              disabled={deletingId === row.id}
                              sx={{
                                color: 'error.main',
                                bgcolor: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.06)',
                                borderRadius: '8px',
                                p: 0.6,
                                '&:hover': {
                                  bgcolor: isDark ? 'rgba(239, 68, 68, 0.18)' : 'rgba(239, 68, 68, 0.12)',
                                },
                              }}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
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
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(event) => {
                setRowsPerPage(parseInt(event.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
              sx={{
                borderTop: `1px solid ${theme.palette.divider}`,
                '& .MuiTablePagination-toolbar': { minHeight: 46, px: 2 },
                '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                  fontSize: '0.75rem',
                  fontWeight: 600,
                },
              }}
            />
          </>
        )}
      </Paper>

      {/* SNACKBAR NOTIFICATION */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={(_, reason) => reason !== 'clickaway' && setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={toast.severity}
          variant="filled"
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          sx={{ width: '100%', borderRadius: '12px', fontWeight: 650 }}
        >
          {toast.message}
        </Alert>
      </Snackbar>

      {/* MANUAL TRANSACTION DIALOG */}
      <Dialog
        open={manualDialogOpen}
        onClose={() => !manualSaving && setManualDialogOpen(false)}
        fullWidth
        maxWidth="sm"
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
          },
        }}
      >
        <DialogTitle sx={{ pb: 0.5, fontWeight: 900, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: '10px',
              bgcolor: 'primary.light',
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AddIcon />
          </Box>
          Record Manual Transaction
        </DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, fontSize: '0.82rem' }}>
            Post a verified credit or debit settlement directly to the company fund ledger.
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <Box>
              <FormControl fullWidth size="small">
                <InputLabel id="manual-transaction-type-label">Transaction Type</InputLabel>
                <Select
                  labelId="manual-transaction-type-label"
                  label="Transaction Type"
                  value={manualForm.transactionType}
                  onChange={(e) => setManualForm((prev) => ({ ...prev, transactionType: e.target.value }))}
                  sx={{ borderRadius: '12px' }}
                >
                  <MenuItem value="Credit">Credit (+ Inward Liquidity)</MenuItem>
                  <MenuItem value="Debit">Debit (- Outward Payment)</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box>
              <FormControl fullWidth size="small">
                <InputLabel id="manual-party-type-label">Counterparty Entity</InputLabel>
                <Select
                  labelId="manual-party-type-label"
                  label="Counterparty Entity"
                  value={manualForm.partyType}
                  onChange={(e) => {
                    setManualForm((prev) => ({ ...prev, partyType: e.target.value }));
                    setSelectedParty(null);
                    setManualError('');
                  }}
                  sx={{ borderRadius: '12px' }}
                >
                  <MenuItem value="individual">Individual Earner</MenuItem>
                  <MenuItem value="bulker">Bulker Desk</MenuItem>
                  <MenuItem value="provider">Service Provider</MenuItem>
                  <MenuItem value="client">Client Entity</MenuItem>
                  <MenuItem value="admin">Executive Admin</MenuItem>
                  <MenuItem value="adjustment">Direct Treasury Adjustment</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {manualForm.partyType !== 'adjustment' ? (
              <Box sx={{ gridColumn: '1 / -1' }}>
                <Autocomplete
                  fullWidth
                  options={partyOptions}
                  value={selectedParty}
                  loading={partyLoading}
                  onChange={(_, value) => setSelectedParty(value)}
                  getOptionLabel={(option) => `${option.name} (${option.id})`}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  noOptionsText={partyLoading ? 'Loading records...' : 'No matching records'}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      fullWidth
                      size="small"
                      label={`Select ${manualForm.partyType}`}
                      placeholder="Search by name or identifier..."
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                    />
                  )}
                />
              </Box>
            ) : (
              <Box sx={{ gridColumn: '1 / -1' }}>
                <Alert severity="info" sx={{ borderRadius: '14px', fontSize: '0.8rem' }}>
                  This adjustment directly reconciles the main company treasury without binding to an external party.
                </Alert>
              </Box>
            )}

            <Box>
              <TextField
                fullWidth
                size="small"
                label="Amount (₹)"
                type="number"
                value={manualForm.amount}
                onChange={(e) => setManualForm((prev) => ({ ...prev, amount: e.target.value }))}
                inputProps={{ min: 0.01, step: 0.01 }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
              />
            </Box>

            <Box>
              <TextField
                fullWidth
                size="small"
                label="Transaction Date"
                type="date"
                value={manualForm.date}
                onChange={(e) => setManualForm((prev) => ({ ...prev, date: e.target.value }))}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
              />
            </Box>

            <Box sx={{ gridColumn: '1 / -1' }}>
              <TextField
                fullWidth
                size="small"
                label="Description / Reason"
                value={manualForm.description}
                onChange={(e) => setManualForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="e.g. Bulk settlement reconciliation or corporate advance"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
              />
            </Box>

            <Box sx={{ gridColumn: '1 / -1' }}>
              <TextField
                fullWidth
                size="small"
                label="Banking Reference / UTR ID (Optional)"
                value={manualForm.utrId}
                onChange={(e) => setManualForm((prev) => ({ ...prev, utrId: e.target.value }))}
                placeholder="e.g. UTR198273641029"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
              />
            </Box>
          </Box>

          {manualError && (
            <Alert severity="error" sx={{ mt: 2, borderRadius: '12px', fontSize: '0.8rem' }}>
              {manualError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => setManualDialogOpen(false)}
            disabled={manualSaving}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleManualTransaction}
            disabled={manualSaving || partyLoading}
            startIcon={manualSaving ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
            sx={{
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            }}
          >
            {manualSaving ? 'Saving...' : 'Post Transaction'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => deletingId === null && setDeleteTarget(null)}
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
            width: '100%',
            maxWidth: 440,
            borderRadius: '24px',
            border: `1px solid ${theme.palette.divider}`,
            p: 1,
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 900 }}>Delete transaction?</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <Paper
            variant="outlined"
            sx={{
              display: 'flex',
              gap: 1.5,
              alignItems: 'flex-start',
              p: 2,
              borderRadius: '16px',
              borderColor: isDark ? 'rgba(248, 113, 113, 0.35)' : 'rgba(239, 68, 68, 0.25)',
              bgcolor: isDark ? 'rgba(127, 29, 29, 0.16)' : 'rgba(254, 242, 242, 0.8)',
            }}
          >
            <Box sx={{ color: 'error.main', lineHeight: 1, mt: 0.2 }}>
              <DeleteOutlineIcon />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary' }}>
                This action cannot be undone.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, overflowWrap: 'anywhere', fontSize: '0.8rem' }}>
                Delete transaction {deleteTarget?.transaction_id || ''} from the company fund ledger?
              </Typography>
            </Box>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => setDeleteTarget(null)}
            disabled={deletingId !== null}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteTransaction}
            disabled={deletingId !== null}
            startIcon={deletingId !== null ? <CircularProgress size={16} color="inherit" /> : <DeleteOutlineIcon />}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 800 }}
          >
            {deletingId !== null ? 'Deleting...' : 'Delete transaction'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
