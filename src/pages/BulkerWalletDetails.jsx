import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TablePagination,
  TextField, InputAdornment, Button, IconButton, Chip, Avatar,
  Stack, MenuItem, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, Divider, Tooltip, useTheme, Alert,
  Checkbox, FormControlLabel
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import Swal from 'sweetalert2';
import { supabase } from '../supabaseClient';

export default function BulkerWalletDetails() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { bulkerId: rawBulkerId, id: rawId } = useParams();
  const identifier = decodeURIComponent(rawBulkerId || rawId || '');
  const bulkerId = identifier;

  const [loading, setLoading] = useState(true);
  const [bulker, setBulker] = useState(null);
  const [transactions, setTransactions] = useState([]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);

  // Modals state
  const [trxModalOpen, setTrxModalOpen] = useState(false);
  const [trxType, setTrxType] = useState('Credit'); // 'Credit' or 'Debit'
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Task Settlement');
  const [referenceId, setReferenceId] = useState('');
  const [syncToFund, setSyncToFund] = useState(true);
  const [processing, setProcessing] = useState(false);

  const fetchBulkerData = async () => {
    if (!identifier) return;
    setLoading(true);
    try {
      // 1. Fetch Bulker Profile from bulker_desks: check 'id' column first or 'bulker_id'
      let bData = null;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

      if (isUuid) {
        const { data: byId } = await supabase
          .from('bulker_desks')
          .select('*')
          .eq('id', identifier)
          .maybeSingle();
        bData = byId;
      }

      if (!bData) {
        // Try bulker_id
        const { data: byBulkerId } = await supabase
          .from('bulker_desks')
          .select('*')
          .eq('bulker_id', identifier)
          .maybeSingle();
        bData = byBulkerId;
      }

      if (!bData && !isUuid) {
        // Fallback: in case id is numeric or other string format
        const { data: fallbackById } = await supabase
          .from('bulker_desks')
          .select('*')
          .eq('id', identifier)
          .maybeSingle();
        bData = fallbackById;
      }

      setBulker(bData);

      // If user landed here using bulker_id with slashes (%2F), replace URL with clean 'id' column
      if (bData && bData.id && identifier !== bData.id) {
        navigate(`/payments/bulkers/wallet/${bData.id}`, { replace: true });
      }

      // 2. Fetch all transactions for this bulker (checking both bulker_id and id)
      const searchKeys = Array.from(
        new Set([identifier, bData?.bulker_id, bData?.id].filter(Boolean))
      );

      const { data: cData, error: cErr } = await supabase
        .from('company_fund_transactions')
        .select('*')
        .in('party_id', searchKeys)
        .order('created_at', { ascending: false });

      let list = cData || [];

      // 3. Also check bulker_wallet_transactions table if exists
      try {
        const { data: bwData, error: bwErr } = await supabase
          .from('bulker_wallet_transactions')
          .select('*')
          .in('bulker_id', searchKeys)
          .order('created_at', { ascending: false });

        if (!bwErr && bwData && bwData.length > 0) {
          const ids = new Set(list.map(t => t.transaction_id));
          bwData.forEach(t => {
            if (!ids.has(t.transaction_id)) {
              list.push(t);
            }
          });
        }
      } catch (err) {
        // Table doesn't exist, ignore
      }

      // Sort by created_at desc
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setTransactions(list);
    } catch (err) {
      console.error('Error fetching bulker details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBulkerData();
  }, [identifier]);

  // Financial metrics calculations
  let currentBalance = 0;
  let totalCredits = 0;
  let totalDebits = 0;

  transactions.forEach((tx) => {
    const val = parseFloat(tx.amount || 0);
    const st = (tx.status || 'Completed').toLowerCase();
    if (st === 'cancelled' || st === 'rejected' || st === 'failed') return;

    if (tx.transaction_type === 'Credit') {
      currentBalance += val;
      totalCredits += val;
    } else if (tx.transaction_type === 'Debit') {
      currentBalance -= val;
      totalDebits += val;
    }
  });

  // Calculate Running Balance in chronological order
  const chronological = [...transactions].reverse();
  let running = 0;
  const runningBalances = {};
  chronological.forEach((tx) => {
    const val = parseFloat(tx.amount || 0);
    const st = (tx.status || 'Completed').toLowerCase();
    if (st !== 'cancelled' && st !== 'rejected' && st !== 'failed') {
      if (tx.transaction_type === 'Credit') running += val;
      else if (tx.transaction_type === 'Debit') running -= val;
    }
    runningBalances[tx.transaction_id] = running;
  });

  // Filtered transactions
  const filteredTransactions = transactions.filter((t) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (t.transaction_id || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q) ||
      (t.reference_id || '').toLowerCase().includes(q);

    const matchesType = typeFilter === 'ALL' || t.transaction_type === typeFilter;
    const matchesStatus =
      statusFilter === 'ALL' ||
      (t.status || 'Completed').toUpperCase() === statusFilter.toUpperCase();

    return matchesSearch && matchesType && matchesStatus;
  });

  const paginatedTransactions = filteredTransactions.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const formatIST = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateStr;
    }
  };

  const openTrxModal = (type) => {
    setTrxType(type);
    setAmount('');
    setDescription('');
    setCategory(type === 'Credit' ? 'Task Settlement' : 'Bulker Payout');
    setReferenceId('');
    setSyncToFund(true);
    setTrxModalOpen(true);
  };

  const handleProcessTransaction = async () => {
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      Swal.fire({ icon: 'warning', title: 'Invalid Amount', text: 'Please enter a valid amount greater than 0.' });
      return;
    }

    if (trxType === 'Debit' && numAmount > currentBalance) {
      const isConfirmed = await Swal.fire({
        title: 'Negative Balance Warning',
        text: `This debit of ₹${numAmount} exceeds the current wallet balance of ₹${currentBalance}. Do you still want to proceed?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, proceed',
        confirmButtonColor: '#f59e0b'
      });
      if (!isConfirmed.isConfirmed) return;
    }

    setProcessing(true);
    try {
      const sessionString = localStorage.getItem('adminSession');
      const adminSession = sessionString ? JSON.parse(sessionString) : { name: 'Admin' };
      const generatedTrxId = `BW-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const finalDescription = description.trim()
        ? `[${category}] ${description.trim()}`
        : `${category} processed by Admin (${adminSession.name || 'Admin'})`;

      const bulkerCode = bulker?.bulker_id || identifier;
      const bulkerUuid = bulker?.id;

      const payload = {
        transaction_id: generatedTrxId,
        transaction_type: trxType,
        amount: numAmount,
        reference_type: 'bulker_wallet',
        reference_id: bulkerUuid || bulkerCode,
        party_type: 'bulker',
        party_id: bulkerCode,
        description: finalDescription,
        status: 'Completed',
        metadata: {
          bulker_id: bulkerCode,
          bulker_uuid: bulkerUuid,
          bulker_name: bulker?.full_name,
          category,
          reference_no: referenceId.trim() || null,
          processed_by: adminSession.name || 'Admin'
        }
      };

      // 1. Insert into company_fund_transactions
      const { error: fundErr } = await supabase
        .from('company_fund_transactions')
        .insert(payload);

      if (fundErr) throw fundErr;

      // 2. Also attempt to insert into bulker_wallet_transactions if table exists
      try {
        await supabase.from('bulker_wallet_transactions').insert({
          transaction_id: generatedTrxId,
          bulker_id: bulkerCode,
          transaction_type: trxType,
          amount: numAmount,
          description: finalDescription,
          status: 'Completed',
          balance_after: trxType === 'Credit' ? currentBalance + numAmount : currentBalance - numAmount,
          sync_to_company_fund: syncToFund,
          metadata: payload.metadata
        });
      } catch (err) {
        // Table might not exist yet, ignored
      }

      setTrxModalOpen(false);
      Swal.fire({
        icon: 'success',
        title: `${trxType} Processed!`,
        text: `₹${numAmount.toFixed(2)} successfully ${trxType.toLowerCase()}ed to ${bulker?.full_name || bulkerCode}.`,
        timer: 2000,
        showConfirmButton: false
      });

      // Refresh data
      await fetchBulkerData();
    } catch (err) {
      console.error('Transaction error:', err);
      Swal.fire({ icon: 'error', title: 'Transaction Failed', text: err.message || 'Failed to process transaction.' });
    } finally {
      setProcessing(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Copied to clipboard!',
      showConfirmButton: false,
      timer: 1500
    });
  };

  const exportCSVStatement = () => {
    if (!transactions.length) {
      Swal.fire({ icon: 'info', title: 'No Transactions', text: 'No transaction data available to export.' });
      return;
    }

    const headers = ['Transaction ID', 'Date Time', 'Type', 'Amount (INR)', 'Description', 'Status'];
    const rows = transactions.map(t => [
      t.transaction_id,
      formatIST(t.created_at),
      t.transaction_type,
      t.amount,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.status || 'Completed'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const exportName = (bulker?.bulker_id || bulker?.id || bulkerId || 'bulker').replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute('download', `statement_${exportName}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', py: 2 }}>
      {/* Top Breadcrumb & Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton
            onClick={() => navigate('/payments/bulkers/wallet')}
            sx={{
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: '12px',
              bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(255,255,255,0.05)'
            }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
              PAYMENTS / BULKERS / WALLET MANAGEMENT
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              {bulker?.full_name || bulker?.bulker_id || bulkerId}
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchBulkerData}
            disabled={loading}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
          >
            Refresh
          </Button>

          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={exportCSVStatement}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
          >
            Export Statement
          </Button>

          <Button
            variant="contained"
            color="success"
            startIcon={<AddCircleIcon />}
            onClick={() => openTrxModal('Credit')}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700, px: 2.2 }}
          >
            Credit Wallet
          </Button>

          <Button
            variant="contained"
            color="error"
            startIcon={<RemoveCircleIcon />}
            onClick={() => openTrxModal('Debit')}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700, px: 2.2 }}
          >
            Debit Wallet
          </Button>
        </Stack>
      </Box>

      {/* Bulker Profile Banner Card */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: '24px',
          border: `1px solid ${theme.palette.divider}`,
          mb: 3.5,
          bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(15,23,42,0.6)',
          backdropFilter: 'blur(10px)'
        }}
      >
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={7}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
              <Avatar
                sx={{
                  width: 64,
                  height: 64,
                  bgcolor: 'primary.main',
                  fontSize: '1.5rem',
                  fontWeight: 900,
                  color: '#fff',
                  borderRadius: '20px',
                  boxShadow: '0 8px 20px rgba(37,99,235,0.25)'
                }}
              >
                {bulker?.full_name ? bulker.full_name.charAt(0).toUpperCase() : 'B'}
              </Avatar>

              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {bulker?.full_name || 'Bulker Desk'}
                  </Typography>
                  <Chip
                    label={bulker?.status || 'Active'}
                    color={bulker?.status === 'Active' || bulker?.status === 'Verified' ? 'success' : 'default'}
                    size="small"
                    sx={{ fontWeight: 800, fontSize: '0.72rem', borderRadius: '8px' }}
                  />
                  <Chip
                    icon={<AccountBalanceWalletIcon sx={{ fontSize: '0.85rem !important' }} />}
                    label={bulker?.account_type || 'Wallet System'}
                    color="primary"
                    size="small"
                    sx={{ fontWeight: 800, fontSize: '0.72rem', borderRadius: '8px' }}
                  />
                </Box>

                <Stack direction="row" spacing={2} sx={{ mt: 1, flexWrap: 'wrap' }}>
                  {bulker?.bulker_id && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, fontSize: '0.82rem', color: 'text.secondary' }}>
                      <span style={{ fontWeight: 750 }}>Bulker ID:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{bulker.bulker_id}</span>
                      <IconButton size="small" onClick={() => copyToClipboard(bulker.bulker_id)} sx={{ p: 0.3 }}>
                        <ContentCopyIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Box>
                  )}

                  {bulker?.id && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, fontSize: '0.82rem', color: 'text.secondary' }}>
                      <span style={{ fontWeight: 750 }}>UID:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'primary.main' }}>
                        {bulker.id}
                      </span>
                      <IconButton size="small" onClick={() => copyToClipboard(bulker.id)} sx={{ p: 0.3 }}>
                        <ContentCopyIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Box>
                  )}

                  {bulker?.phone && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.82rem', color: 'text.secondary' }}>
                      <PhoneIcon sx={{ fontSize: 14 }} />
                      <span>{bulker.phone}</span>
                    </Box>
                  )}

                  {bulker?.email && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.82rem', color: 'text.secondary' }}>
                      <EmailIcon sx={{ fontSize: 14 }} />
                      <span>{bulker.email}</span>
                    </Box>
                  )}
                </Stack>
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12} md={5}>
            <Box
              sx={{
                p: 2,
                borderRadius: '16px',
                bgcolor: theme.palette.mode === 'light' ? 'rgba(37,99,235,0.04)' : 'rgba(59,130,246,0.08)',
                border: `1px solid ${theme.palette.mode === 'light' ? 'rgba(37,99,235,0.12)' : 'rgba(59,130,246,0.18)'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                  Current Wallet Balance
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 900, color: currentBalance >= 0 ? '#16a34a' : 'error.main', mt: 0.3 }}>
                  ₹{currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
              </Box>
              <Chip
                label="LIVE BALANCE"
                color={currentBalance >= 0 ? 'success' : 'error'}
                size="small"
                sx={{ fontWeight: 800, fontSize: '0.7rem' }}
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* 4 Financial CRM Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
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
                  Available Balance
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#16a34a' }}>
                  ₹{currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Ready for settlement
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'rgba(22,163,74,0.1)', color: '#16a34a', borderRadius: '14px' }}>
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
              bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(15,23,42,0.6)'
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                  Total Credited
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#2563eb' }}>
                  ₹{totalCredits.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Commissions & Top-ups
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'rgba(37,99,235,0.1)', color: '#2563eb', borderRadius: '14px' }}>
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
              bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(15,23,42,0.6)'
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                  Total Debited
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#f59e0b' }}>
                  ₹{totalDebits.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Payouts & Deductions
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderRadius: '14px' }}>
                <ArrowDownwardIcon />
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
              bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(15,23,42,0.6)'
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                  Total Transactions
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                  {transactions.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Complete Ledger Entries
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'rgba(139,92,246,0.1)', color: '#8b5cf6', borderRadius: '14px' }}>
                <CalendarMonthIcon />
              </Avatar>
            </Stack>
          </Card>
        </Grid>
      </Grid>

      {/* Transaction History CRM Ledger Table */}
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
        {/* Table Filter Header */}
        <Box sx={{ p: 2.5, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mr: 1 }}>
            Wallet Transaction Ledger
          </Typography>

          <TextField
            size="small"
            placeholder="Search by Trx ID, description, UTR..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
            sx={{ flex: 1, minWidth: { xs: '100%', sm: 240 }, '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
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
            label="Type"
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
            sx={{ minWidth: 130, '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
          >
            <MenuItem value="ALL">All Types</MenuItem>
            <MenuItem value="Credit">Credit (+)</MenuItem>
            <MenuItem value="Debit">Debit (-)</MenuItem>
          </TextField>

          <TextField
            select
            size="small"
            label="Status"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            sx={{ minWidth: 130, '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
          >
            <MenuItem value="ALL">All Status</MenuItem>
            <MenuItem value="COMPLETED">Completed</MenuItem>
            <MenuItem value="PENDING">Pending</MenuItem>
            <MenuItem value="CANCELLED">Cancelled</MenuItem>
          </TextField>
        </Box>

        {/* Ledger Table */}
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.02)' : 'rgba(255,255,255,0.02)' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem', py: 1.8 }}>TRANSACTION ID</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem' }}>DATE & TIME (IST)</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem' }}>TYPE</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem' }}>AMOUNT</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem' }}>DESCRIPTION / REFERENCE</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem' }}>BALANCE AFTER</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem' }}>STATUS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                    <CircularProgress size={36} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                      Loading ledger transactions...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : paginatedTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      No Transactions Recorded
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Use the "Credit Wallet" or "Debit Wallet" button to create a new ledger entry.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTransactions.map((tx) => {
                  const isCredit = tx.transaction_type === 'Credit';
                  const balAfter = runningBalances[tx.transaction_id];

                  return (
                    <TableRow
                      key={tx.id || tx.transaction_id}
                      hover
                      sx={{
                        '&:last-child td': { border: 0 },
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      {/* Transaction ID */}
                      <TableCell sx={{ py: 1.8 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                          <Chip
                            label={tx.transaction_id}
                            size="small"
                            sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem', borderRadius: '8px' }}
                          />
                          <IconButton size="small" onClick={() => copyToClipboard(tx.transaction_id)} sx={{ p: 0.2 }}>
                            <ContentCopyIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Box>
                      </TableCell>

                      {/* Date & Time */}
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
                          {formatIST(tx.created_at)}
                        </Typography>
                      </TableCell>

                      {/* Type */}
                      <TableCell>
                        <Chip
                          icon={isCredit ? <ArrowUpwardIcon sx={{ fontSize: '0.85rem !important' }} /> : <ArrowDownwardIcon sx={{ fontSize: '0.85rem !important' }} />}
                          label={tx.transaction_type}
                          size="small"
                          color={isCredit ? 'success' : 'warning'}
                          sx={{ fontWeight: 800, fontSize: '0.72rem', borderRadius: '8px' }}
                        />
                      </TableCell>

                      {/* Amount */}
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 800,
                            fontSize: '0.92rem',
                            color: isCredit ? '#16a34a' : '#dc2626'
                          }}
                        >
                          {isCredit ? '+' : '-'}₹{parseFloat(tx.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Typography>
                      </TableCell>

                      {/* Description */}
                      <TableCell sx={{ maxWidth: 300 }}>
                        <Typography variant="body2" sx={{ fontSize: '0.84rem', fontWeight: 550, wordBreak: 'break-word' }}>
                          {tx.description || 'Bulker Wallet Transaction'}
                        </Typography>
                        {tx.metadata?.reference_no && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            Ref: {tx.metadata.reference_no}
                          </Typography>
                        )}
                      </TableCell>

                      {/* Balance After */}
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 750, color: 'text.secondary', fontSize: '0.88rem' }}>
                          ₹{(balAfter !== undefined ? balAfter : 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Typography>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <Chip
                          label={tx.status || 'Completed'}
                          size="small"
                          color={
                            (tx.status || 'Completed').toLowerCase() === 'completed' ? 'success' :
                            (tx.status || '').toLowerCase() === 'pending' ? 'warning' : 'error'
                          }
                          sx={{ fontWeight: 800, fontSize: '0.7rem', borderRadius: '8px' }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <TablePagination
          component="div"
          count={filteredTransactions.length}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(e, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[15, 30, 50, 100]}
        />
      </Paper>

      {/* Credit / Debit Transaction Dialog */}
      <Dialog
        open={trxModalOpen}
        onClose={() => !processing && setTrxModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '24px', p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.25rem', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: trxType === 'Credit' ? 'success.main' : 'error.main', color: '#fff', width: 40, height: 40, borderRadius: '12px' }}>
              {trxType === 'Credit' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {trxType === 'Credit' ? 'Credit Bulker Wallet' : 'Debit Bulker Wallet'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Bulker: {bulker?.full_name || bulker?.bulker_id || identifier}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent dividers sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            {/* Amount */}
            <TextField
              label="Amount (₹)"
              type="number"
              fullWidth
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 500.00"
              InputProps={{
                startAdornment: <InputAdornment position="start">₹</InputAdornment>,
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
              helperText={`Current Balance: ₹${currentBalance.toFixed(2)}`}
            />

            {/* Category */}
            <TextField
              select
              label="Transaction Category"
              fullWidth
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
            >
              {trxType === 'Credit' ? (
                <>
                  <MenuItem value="Task Settlement">Task Settlement / Rewards</MenuItem>
                  <MenuItem value="Bulker Commission">Bulker Commission</MenuItem>
                  <MenuItem value="Bonus & Incentive">Bonus & Incentive</MenuItem>
                  <MenuItem value="Manual Credit Adjustment">Manual Credit Adjustment</MenuItem>
                </>
              ) : (
                <>
                  <MenuItem value="Bulker Payout">Bulker Payout / Withdrawal</MenuItem>
                  <MenuItem value="Bank Transfer">Bank Transfer Settlement</MenuItem>
                  <MenuItem value="UPI Settlement">UPI Settlement</MenuItem>
                  <MenuItem value="Penalty / Deduction">Penalty / Deduction</MenuItem>
                  <MenuItem value="Manual Debit Adjustment">Manual Debit Adjustment</MenuItem>
                </>
              )}
            </TextField>

            {/* Reference No */}
            <TextField
              label="Reference ID / UTR / Order No (Optional)"
              fullWidth
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              placeholder="e.g. UTR123456789 or TASK#402"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
            />

            {/* Description */}
            <TextField
              label="Notes / Reason"
              multiline
              rows={3}
              fullWidth
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter remarks or settlement notes for the bulker ledger..."
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
            />

            {/* Sync to Company Fund Checkbox */}
            <FormControlLabel
              control={<Checkbox checked={syncToFund} onChange={(e) => setSyncToFund(e.target.checked)} color="primary" />}
              label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Sync to Company Fund Ledger</Typography>}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2.5 }}>
          <Button
            onClick={() => setTrxModalOpen(false)}
            color="inherit"
            disabled={processing}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            color={trxType === 'Credit' ? 'success' : 'error'}
            onClick={handleProcessTransaction}
            disabled={processing}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 800, px: 3 }}
          >
            {processing ? 'Processing...' : `Confirm & ${trxType}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
