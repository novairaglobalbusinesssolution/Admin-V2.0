import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import AddIcon from '@mui/icons-material/Add';
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

function StatCard({ title, value, helper, icon, loading = false }) {
  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: '24px', border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 700 }}>
          {title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: '14px', bgcolor: 'primary.light', color: 'primary.main' }}>
          {icon}
        </Box>
      </Box>
      {loading ? (
        <Skeleton variant="text" animation="wave" width="68%" height={44} />
      ) : (
        <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          {value}
        </Typography>
      )}
      {helper && (
        loading ? (
          <Skeleton variant="text" animation="wave" width="52%" sx={{ mt: 1 }} />
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {helper}
          </Typography>
        )
      )}
    </Paper>
  );
}

export default function PaymentDashboard() {
  const theme = useTheme();
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

  const getStatusBadgeStyle = (status, type) => {
    const isDark = theme.palette.mode === 'dark';
    const normalizedStatus = String(status || '').toLowerCase();

    if (normalizedStatus === 'completed') {
      return {
        backgroundColor: isDark ? 'rgba(52, 211, 153, 0.18)' : 'rgba(34, 197, 94, 0.14)',
        color: isDark ? '#7ef0c1' : '#15803d',
      };
    }

    if (normalizedStatus === 'pending') {
      return {
        backgroundColor: isDark ? 'rgba(251, 191, 36, 0.15)' : 'rgba(245, 158, 11, 0.12)',
        color: isDark ? '#facc15' : '#b45309',
      };
    }

    if (type === 'Debit') {
      return {
        backgroundColor: isDark ? 'rgba(248, 113, 113, 0.16)' : 'rgba(239, 68, 68, 0.10)',
        color: isDark ? '#fca5a5' : '#b91c1c',
      };
    }

    return {
      backgroundColor: isDark ? 'rgba(96, 165, 250, 0.18)' : 'rgba(59, 130, 246, 0.10)',
      color: isDark ? '#bfdbfe' : '#1d4ed8',
    };
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
        const isPendingWithdrawal = transactionType === 'debit' && ['pending', 'processing'].includes(status);

        return {
          ...prev,
          currentCompanyBalance: prev.currentCompanyBalance + (isSuccessful ? (transactionType === 'debit' ? amount : -amount) : 0),
          totalWithdrawalRequests: Math.max(0, prev.totalWithdrawalRequests - (isPendingWithdrawal ? 1 : 0)),
          pendingWithdrawalAmount: Math.max(0, prev.pendingWithdrawalAmount - (isPendingWithdrawal ? amount : 0)),
          totalProcessed: Math.max(0, prev.totalProcessed - (isSuccessful ? amount : 0)),
          transactions: prev.transactions.filter((item) => item.id !== row.id),
        };
      });

      setError('');
      setDeleteTarget(null);
    } catch (err) {
      setError(err?.message || 'Failed to delete transaction.');
    } finally {
      setDeletingId(null);
      setSummaryUpdating(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 260 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', mt: 1, pb: 10 }}>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h5" sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 600 }}>
            Company Fund & Payments
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Overview of company balance, withdrawal requests, and wallet debit transactions.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openManualDialog}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
        >
          Manual Transaction
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Current Company Balance"
            value={formatMoney(summary.currentCompanyBalance)}
            helper="Available main company fund"
            icon={<AccountBalanceWalletIcon fontSize="small" />}
            loading={summaryUpdating}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Withdrawal Requests"
            value={summary.totalWithdrawalRequests}
            helper={`${formatMoney(summary.pendingWithdrawalAmount)} pending amount`}
            icon={<RequestQuoteIcon fontSize="small" />}
            loading={summaryUpdating}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Processed"
            value={formatMoney(summary.totalProcessed)}
            helper="All company fund transactions"
            icon={<TrendingUpIcon fontSize="small" />}
            loading={summaryUpdating}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Company Entries"
            value={summary.transactions.filter((transaction) => ['completed', 'success', 'successful'].includes(String(transaction.status || '').toLowerCase())).length}
            helper="Completed company fund records"
            icon={<TrendingUpIcon fontSize="small" />}
            loading={summaryUpdating}
          />
        </Grid>
      </Grid>

      <Paper elevation={0} sx={{ mt: 4, borderRadius: '18px', border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <Box sx={{ p: 2.25, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.02rem' }}>
            Company Fund Transactions
          </Typography>
        </Box>

        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}>
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Search transaction / party / description"
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              />
            </Grid>

            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Transaction Type</InputLabel>
                <Select
                  value={filters.status}
                  label="Transaction Type"
                  onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
                  sx={{ '& .MuiSelect-select': { fontSize: '0.82rem' } }}
                >
                  <MenuItem value="All">All</MenuItem>
                  <MenuItem value="Credit">Credit</MenuItem>
                  <MenuItem value="Debit">Debit</MenuItem>
                  <MenuItem value="Completed">Completed</MenuItem>
                  <MenuItem value="Pending">Pending</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                size="small"
                label="Min Amount"
                type="number"
                value={filters.minAmount}
                onChange={(event) => setFilters((prev) => ({ ...prev, minAmount: event.target.value }))}
              />
            </Grid>

            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                size="small"
                label="Max Amount"
                type="number"
                value={filters.maxAmount}
                onChange={(event) => setFilters((prev) => ({ ...prev, maxAmount: event.target.value }))}
              />
            </Grid>

            <Grid item xs={12} md={2}>
              <Button fullWidth variant="outlined" onClick={handleResetFilters}>
                Reset
              </Button>
            </Grid>
          </Grid>
        </Box>

        {filteredTransactions.length === 0 ? (
          <Box sx={{ p: 5, textAlign: 'center', color: 'text.secondary' }}>
            No matching company fund transactions found.
          </Box>
        ) : (
          <>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ py: 1.2, px: 1.4, fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.palette.text.primary }}>Transaction ID</TableCell>
                    <TableCell sx={{ py: 1.2, px: 1.4, fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: theme.palette.text.primary, width: 90 }}>Type</TableCell>
                    <TableCell sx={{ py: 1.2, px: 1.4, fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.palette.text.primary }}>Party</TableCell>
                    <TableCell sx={{ py: 1.2, px: 1.4, fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.palette.text.primary }}>Reference</TableCell>
                    <TableCell sx={{ py: 1.2, px: 1.4, fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.palette.text.primary }}>Description</TableCell>
                    <TableCell sx={{ py: 1.2, px: 1.4, fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.palette.text.primary, width: 130, textAlign: 'right' }}>Amount</TableCell>
                    <TableCell sx={{ py: 1.2, px: 1.4, fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.palette.text.primary, width: 120 }}>Status</TableCell>
                    <TableCell sx={{ py: 1.2, px: 1.4, fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.palette.text.primary, width: 140 }}>Date</TableCell>
                    <TableCell sx={{ py: 1.2, px: 1.4, fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.palette.text.primary, width: 120, textAlign: 'center' }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedTransactions.map((row) => (
                    <TableRow key={row.id} hover sx={{ '& td': { py: 0.9, px: 1.4, fontSize: '0.8rem', verticalAlign: 'middle', borderBottom: '1px solid', borderColor: theme.palette.divider }, backgroundColor: theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.12)' : 'transparent' }}>
                      <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary, wordBreak: 'break-word' }}>{row.transaction_id}</TableCell>
                      <TableCell sx={{ color: theme.palette.text.primary }}>
                        <Typography variant="caption" sx={{
                          px: 1,
                          py: 0.35,
                          borderRadius: '999px',
                          bgcolor: row.transaction_type === 'Credit' ? (theme.palette.mode === 'dark' ? 'rgba(34, 197, 94, 0.18)' : 'rgba(34, 197, 94, 0.12)') : (theme.palette.mode === 'dark' ? 'rgba(248, 113, 113, 0.18)' : 'rgba(239, 68, 68, 0.12)'),
                          color: row.transaction_type === 'Credit' ? (theme.palette.mode === 'dark' ? '#86efac' : '#15803d') : (theme.palette.mode === 'dark' ? '#fca5a5' : '#b91c1c'),
                          fontWeight: 800,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: 58,
                          lineHeight: 1.5,
                        }}>
                          {row.transaction_type}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ color: theme.palette.text.primary, wordBreak: 'break-word' }}>{row.party_type || 'N/A'} / {row.party_id || 'N/A'}</TableCell>
                      <TableCell sx={{ color: theme.palette.text.primary, wordBreak: 'break-word' }}>{row.reference_type || 'N/A'} / {row.reference_id || 'N/A'}</TableCell>
                      <TableCell sx={{ color: theme.palette.text.primary, wordBreak: 'break-word' }}>{row.description}</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: row.transaction_type === 'Credit' ? (theme.palette.mode === 'dark' ? '#86efac' : '#15803d') : (theme.palette.mode === 'dark' ? '#fca5a5' : '#b91c1c'), textAlign: 'right' }}>
                        {row.transaction_type === 'Credit' ? '+' : '-'} {formatMoney(row.amount)}
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="caption"
                          sx={{
                            px: 1,
                            py: 0.35,
                            borderRadius: '999px',
                            ...getStatusBadgeStyle(row.status, row.transaction_type),
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: 86,
                            lineHeight: 1.5,
                          }}
                        >
                          {row.status}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ color: theme.palette.text.primary, whiteSpace: 'normal', lineHeight: 1.5 }}>{row.created_at}</TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          startIcon={<DeleteOutlineIcon fontSize="small" />}
                          onClick={() => setDeleteTarget(row)}
                          disabled={deletingId === row.id}
                          sx={{
                            borderRadius: '999px',
                            minWidth: 0,
                            px: 1.25,
                            py: 0.5,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            borderColor: theme.palette.mode === 'dark' ? 'rgba(248, 113, 113, 0.5)' : 'rgba(239, 68, 68, 0.45)',
                            color: theme.palette.mode === 'dark' ? '#fca5a5' : '#b91c1c',
                            '&:hover': {
                              borderColor: theme.palette.mode === 'dark' ? '#fca5a5' : '#ef4444',
                              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(248, 113, 113, 0.08)' : 'rgba(239, 68, 68, 0.06)',
                            },
                          }}
                        >
                          {deletingId === row.id ? 'Deleting...' : 'Delete'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
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
                '& .MuiTablePagination-toolbar': {
                  minHeight: 42,
                  px: 2,
                },
                '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                  fontSize: '0.75rem',
                },
              }}
            />
          </>
        )}
      </Paper>

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
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>

      <Dialog
        open={manualDialogOpen}
        onClose={() => !manualSaving && setManualDialogOpen(false)}
        fullWidth
        maxWidth="sm"
        slotProps={{
          backdrop: {
            sx: {
              backdropFilter: 'blur(6px)',
              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(2, 6, 23, 0.58)' : 'rgba(15, 23, 42, 0.28)',
            },
          },
        }}
        PaperProps={{ sx: { borderRadius: 3, border: '1px solid', borderColor: 'divider' } }}
      >
        <DialogTitle sx={{ pb: 0.5, fontWeight: 800 }}>Add manual transaction</DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Record a credit or debit in the company fund ledger.
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2, minWidth: 0 }}>
            <Box sx={{ minWidth: 0 }}>
              <FormControl fullWidth size="small" sx={{ minWidth: 0 }}>
                <InputLabel id="manual-transaction-type-label">Transaction type</InputLabel>
                <Select
                  labelId="manual-transaction-type-label"
                  label="Transaction type"
                  value={manualForm.transactionType}
                  onChange={(event) => setManualForm((prev) => ({ ...prev, transactionType: event.target.value }))}
                >
                  <MenuItem value="Credit">Credit</MenuItem>
                  <MenuItem value="Debit">Debit</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <FormControl fullWidth size="small" sx={{ minWidth: 0 }}>
                <InputLabel id="manual-party-type-label">Party type</InputLabel>
                <Select
                  labelId="manual-party-type-label"
                  label="Party type"
                  value={manualForm.partyType}
                  onChange={(event) => {
                    setManualForm((prev) => ({ ...prev, partyType: event.target.value }));
                    setSelectedParty(null);
                    setManualError('');
                  }}
                >
                  <MenuItem value="individual">Individual</MenuItem>
                  <MenuItem value="bulker">Bulker</MenuItem>
                  <MenuItem value="provider">Provider</MenuItem>
                  <MenuItem value="client">Client</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="adjustment">Adjustment (Company fund)</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {manualForm.partyType !== 'adjustment' ? (
              <Box sx={{ gridColumn: '1 / -1', width: '100%', minWidth: 0 }}>
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
                      placeholder="Search by name or ID"
                    />
                  )}
                />
              </Box>
            ) : (
              <Box sx={{ gridColumn: '1 / -1', minWidth: 0 }}>
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  This adjustment posts directly to the main company fund without selecting a user.
                </Alert>
              </Box>
            )}

            <Box sx={{ minWidth: 0 }}>
              <TextField
                fullWidth
                size="small"
                label="Amount"
                type="number"
                value={manualForm.amount}
                onChange={(event) => setManualForm((prev) => ({ ...prev, amount: event.target.value }))}
                inputProps={{ min: 0.01, step: 0.01 }}
              />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <TextField
                fullWidth
                size="small"
                label="Description"
                value={manualForm.description}
                onChange={(event) => setManualForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Reason for this transaction"
              />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <TextField
                fullWidth
                size="small"
                label="UTR ID (Optional)"
                value={manualForm.utrId}
                onChange={(event) => setManualForm((prev) => ({ ...prev, utrId: event.target.value }))}
              />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <TextField
                fullWidth
                size="small"
                label="Transaction date"
                type="date"
                value={manualForm.date}
                onChange={(event) => setManualForm((prev) => ({ ...prev, date: event.target.value }))}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Box>
          </Box>

          {manualError && <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{manualError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => setManualDialogOpen(false)}
            disabled={manualSaving}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleManualTransaction}
            disabled={manualSaving || partyLoading}
            startIcon={manualSaving ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}
          >
            {manualSaving ? 'Saving...' : 'Add transaction'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => deletingId === null && setDeleteTarget(null)}
        slotProps={{
          backdrop: {
            sx: {
              backdropFilter: 'blur(6px)',
              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(2, 6, 23, 0.58)' : 'rgba(15, 23, 42, 0.28)',
            },
          },
        }}
        PaperProps={{
          sx: {
            width: '100%',
            maxWidth: 440,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: theme.palette.mode === 'dark' ? '0 24px 80px rgba(0, 0, 0, 0.55)' : '0 24px 80px rgba(15, 23, 42, 0.18)',
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 800 }}>Delete transaction?</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <Paper
            variant="outlined"
            sx={{
              display: 'flex',
              gap: 1.5,
              alignItems: 'flex-start',
              p: 2,
              borderRadius: 2,
              borderColor: theme.palette.mode === 'dark' ? 'rgba(248, 113, 113, 0.35)' : 'rgba(239, 68, 68, 0.25)',
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(127, 29, 29, 0.16)' : 'rgba(254, 242, 242, 0.8)',
            }}
          >
            <Box sx={{ color: 'error.main', lineHeight: 1, mt: 0.2 }}>
              <DeleteOutlineIcon />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                This action cannot be undone.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
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
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteTransaction}
            disabled={deletingId !== null}
            startIcon={deletingId !== null ? <CircularProgress size={16} color="inherit" /> : <DeleteOutlineIcon />}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}
          >
            {deletingId !== null ? 'Deleting...' : 'Delete transaction'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
