import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Card, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TablePagination,
  TextField, InputAdornment, Button, IconButton, Chip, Avatar,
  Stack, MenuItem, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, Divider, Tooltip, useTheme,
  Snackbar, FormControl, Select, Checkbox, FormControlLabel, InputLabel
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
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CloseIcon from '@mui/icons-material/Close';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import ContactlessRoundedIcon from '@mui/icons-material/ContactlessRounded';
import SimCardRoundedIcon from '@mui/icons-material/SimCardRounded';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { supabase } from '../supabaseClient';
import {
  getBulkerIdVariants,
  calculateBulkerFinances,
  formatINR,
  formatMonthTitle
} from '../utils/bulkerPaymentCalculations';

export default function BulkerWalletDetails() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { bulkerId: rawBulkerId, id: rawId } = useParams();
  const identifier = decodeURIComponent(rawBulkerId || rawId || '');

  const [loading, setLoading] = useState(true);
  const [bulker, setBulker] = useState(null);
  const [billingHistory, setBillingHistory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [appsMap, setAppsMap] = useState({});

  // History modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  // Filters & Search for Transactions
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Filters & Pagination for Live Apps Breakdown DataTable
  const [breakdownSearch, setBreakdownSearch] = useState('');
  const [breakdownPage, setBreakdownPage] = useState(0);
  const [breakdownRowsPerPage, setBreakdownRowsPerPage] = useState(10);

  // Manual Credit / Debit Dialog
  const [trxModalOpen, setTrxModalOpen] = useState(false);
  const [trxType, setTrxType] = useState('Credit'); // 'Credit' | 'Debit'
  const [amount, setAmount] = useState('');
  const [utrId, setUtrId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [syncToCompanyFund, setSyncToCompanyFund] = useState(true);
  const [description, setDescription] = useState('');
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState({ open: false, type: 'success', title: '', message: '' });

  const showToast = (type, title, message = '') => {
    setToast({ open: true, type, title, message });
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast('success', 'Copied!', text);
  };

  const fetchBulkerData = async () => {
    if (!identifier) return;
    setLoading(true);
    try {
      // 1. Fetch Bulker Profile
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
        const { data: byBulkerId } = await supabase
          .from('bulker_desks')
          .select('*')
          .eq('bulker_id', identifier)
          .maybeSingle();
        bData = byBulkerId;
      }

      if (!bData && !isUuid) {
        const { data: fallbackById } = await supabase
          .from('bulker_desks')
          .select('*')
          .eq('id', identifier)
          .maybeSingle();
        bData = fallbackById;
      }

      setBulker(bData);

      // 2. Fetch billing history and apps in parallel
      const targetVariants = getBulkerIdVariants(bData?.bulker_id || identifier);

      const [histRes, appsRes] = await Promise.all([
        supabase
          .from('bulker_billing_history')
          .select('*')
          .in('bulker_id', targetVariants)
          .order('change_date_time', { ascending: true }),
        supabase
          .from('apps')
          .select('id, app_name, task_id, members_reward, assigned_bulkers')
      ]);

      // 3. Fetch all individual_wallet_transactions for this bulker without 1000 row truncation
      let allTransactions = [];
      let txFrom = 0;
      const txStep = 1000;
      while (true) {
        const { data: txPage, error: txErr } = await supabase
          .from('individual_wallet_transactions')
          .select('*')
          .in('earner_id', targetVariants)
          .order('created_at', { ascending: false })
          .range(txFrom, txFrom + txStep - 1);

        if (txErr) {
          console.error('Error fetching wallet transactions page:', txErr);
          break;
        }
        allTransactions = allTransactions.concat(txPage || []);
        if (!txPage || txPage.length < txStep) break;
        txFrom += txStep;
      }

      // 4. Fetch all review_submit_data for this bulker without 1000 row truncation
      let allReviews = [];
      let revFrom = 0;
      const revStep = 1000;
      while (true) {
        const { data: revPage, error: revErr } = await supabase
          .from('review_submit_data')
          .select('id, app_id, bulker_id, status, submitted_at')
          .in('bulker_id', targetVariants)
          .in('status', ['Live', 'Approved'])
          .range(revFrom, revFrom + revStep - 1);

        if (revErr) {
          console.error('Error fetching reviews page:', revErr);
          break;
        }
        allReviews = allReviews.concat(revPage || []);
        if (!revPage || revPage.length < revStep) break;
        revFrom += revStep;
      }

      setBillingHistory(histRes.data || []);
      setTransactions(allTransactions);
      setReviews(allReviews);

      const aMap = {};
      (appsRes.data || []).forEach((app) => {
        aMap[app.id] = app;
      });
      setAppsMap(aMap);
    } catch (err) {
      console.error('Error fetching bulker details:', err);
      showToast('error', 'Failed to load bulker wallet data', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBulkerData();
  }, [identifier]);

  // Calculate wallet financial stats using identical bulker panel formula
  const calculatedFinances = useMemo(() => {
    return calculateBulkerFinances({
      bulker,
      billingHistory,
      transactions,
      reviews,
      appsMap
    });
  }, [bulker, billingHistory, transactions, reviews, appsMap]);

  const { wallet, invoices } = calculatedFinances;

  // Filtered transactions for the ledger table
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const q = searchQuery.toLowerCase();
      const utrStr = t.utr_id || t.payout_details?.utr_number || '';
      const matchesSearch =
        (t.transaction_id || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.id || '').toLowerCase().includes(q) ||
        String(utrStr).toLowerCase().includes(q);

      const matchesType = typeFilter === 'ALL' || t.transaction_type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [transactions, searchQuery, typeFilter]);

  const paginatedTransactions = filteredTransactions.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Filtered & Paginated Breakdown List
  const filteredBreakdown = useMemo(() => {
    return (wallet?.breakdownList || []).filter((item) => {
      const q = breakdownSearch.toLowerCase();
      return (
        item.appName.toLowerCase().includes(q) ||
        String(item.taskId).toLowerCase().includes(q)
      );
    });
  }, [wallet?.breakdownList, breakdownSearch]);

  const paginatedBreakdown = useMemo(() => {
    return filteredBreakdown.slice(
      breakdownPage * breakdownRowsPerPage,
      breakdownPage * breakdownRowsPerPage + breakdownRowsPerPage
    );
  }, [filteredBreakdown, breakdownPage, breakdownRowsPerPage]);

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
    setAmount(type === 'Debit' && wallet.liveWalletBalance > 0 ? String(wallet.liveWalletBalance) : '');
    setUtrId('');
    setPaymentMethod(type === 'Debit' ? 'UPI' : 'WALLET_ADJUSTMENT');
    setSyncToCompanyFund(true);
    setDescription('');
    setTrxModalOpen(true);
  };

  const handleProcessTransaction = async () => {
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      showToast('warning', 'Invalid Amount', 'Please enter a valid amount greater than 0.');
      return;
    }

    setProcessing(true);
    try {
      const bulkerCode = bulker?.bulker_id || identifier;
      const generatedTrxId = `BW-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const finalUtr = utrId.trim() || null;
      const finalDesc = description.trim() || `Admin manual ${trxType.toLowerCase()} payout`;
      const shouldSyncFund = trxType === 'Debit' ? Boolean(syncToCompanyFund) : false;

      const payload = {
        transaction_id: generatedTrxId,
        earner_id: bulkerCode,
        amount: numAmount,
        transaction_type: trxType,
        description: finalDesc,
        status: 'Completed',
        utr_id: finalUtr,
        sync_to_company_fund: shouldSyncFund,
        payout_details: {
          bulker_id: bulkerCode,
          bulker_uuid: bulker?.id,
          bulker_name: bulker?.full_name,
          utr_number: finalUtr,
          payment_method: paymentMethod,
          wallet_adjustment: true,
          synced_to_company_fund: shouldSyncFund,
          processed_by: 'Admin Portal'
        }
      };

      const { data: insertedRow, error: insErr } = await supabase
        .from('individual_wallet_transactions')
        .insert(payload)
        .select('*')
        .maybeSingle();

      if (insErr) throw insErr;

      // Ensure no row remains in company_fund_transactions if syncToCompanyFund was unchecked on Debit
      if (trxType === 'Debit' && !shouldSyncFund) {
        try {
          if (insertedRow?.id) {
            await supabase
              .from('company_fund_transactions')
              .delete()
              .or(`reference_id.eq.${generatedTrxId},reference_id.eq.${insertedRow.id},transaction_id.eq.${generatedTrxId}`);
          } else {
            await supabase
              .from('company_fund_transactions')
              .delete()
              .ilike('description', `%${generatedTrxId}%`);
          }
        } catch (cleanupErr) {
          console.warn('Company fund cleanup warning:', cleanupErr);
        }
      }

      setTrxModalOpen(false);
      showToast('success', `${trxType} Processed!`, `₹${numAmount.toFixed(2)} recorded in bulker wallet.`);
      await fetchBulkerData();
    } catch (err) {
      console.error('Transaction error:', err);
      showToast('error', 'Transaction Failed', err.message);
    } finally {
      setProcessing(false);
    }
  };

  const exportCSVStatement = () => {
    if (!transactions.length) {
      showToast('warning', 'No Transactions', 'No transaction data available to export.');
      return;
    }

    const headers = ['Transaction ID', 'Date Time', 'Type', 'Amount (INR)', 'UTR / Ref ID', 'Method', 'Description', 'Status'];
    const rows = transactions.map(t => [
      t.transaction_id || t.id,
      formatIST(t.created_at),
      t.transaction_type,
      t.amount,
      t.utr_id || t.payout_details?.utr_number || '-',
      t.payout_details?.payment_method || '-',
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.status || 'Success'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const exportName = (bulker?.bulker_id || identifier || 'bulker').replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute('download', `statement_${exportName}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <Box sx={{ p: 6, textAlign: 'center', maxWidth: 1200, mx: 'auto' }}>
        <CircularProgress size={44} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Calculating bulker wallet balance & transactions...
        </Typography>
      </Box>
    );
  }

  const bulkerCode = bulker?.bulker_id || identifier;
  const cleanId = bulkerCode.replace(/^NOVAIRA\/BULKER\//i, '');

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', py: 2 }}>
      {/* Top Header & Actions */}
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
              PAYMENTS / BULKERS / WALLET DETAILS
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              {bulker?.full_name || bulkerCode}
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<ReceiptLongIcon />}
            onClick={() => navigate(`/payments/bulkers/invoices/${encodeURIComponent(bulker?.id || bulkerCode)}`)}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
          >
            Monthly Invoices
          </Button>

          <Button
            variant="outlined"
            startIcon={<HistoryRoundedIcon />}
            onClick={() => setHistoryModalOpen(true)}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
          >
            Billing Mode History ({billingHistory.length})
          </Button>

          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={exportCSVStatement}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
          >
            Export CSV
          </Button>

          <Button
            variant="contained"
            color="success"
            startIcon={<AddCircleIcon />}
            onClick={() => openTrxModal('Credit')}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700, px: 2 }}
          >
            Credit Wallet
          </Button>

          <Button
            variant="contained"
            color="error"
            startIcon={<RemoveCircleIcon />}
            onClick={() => openTrxModal('Debit')}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700, px: 2 }}
          >
            Debit Wallet
          </Button>
        </Stack>
      </Box>

      {/* ATM DEBIT CARD UI & PROFILE HEADER */}
      <Grid container spacing={3} sx={{ mb: 3.5 }} alignItems="stretch">
        {/* Left: Bulker Profile Card */}
        <Grid item xs={12} md={7}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              height: '100%',
              borderRadius: '24px',
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(15,23,42,0.6)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Avatar
                  sx={{
                    width: 58,
                    height: 58,
                    bgcolor: 'primary.main',
                    fontSize: '1.4rem',
                    fontWeight: 900,
                    color: '#fff',
                    borderRadius: '18px',
                    boxShadow: '0 8px 20px rgba(37,99,235,0.25)'
                  }}
                >
                  {bulker?.full_name ? bulker.full_name.charAt(0).toUpperCase() : 'B'}
                </Avatar>

                <Box sx={{ flex: 1, minWidth: 0 }}>
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

                  <Stack direction="row" spacing={1.5} sx={{ mt: 1, flexWrap: 'wrap' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.82rem', color: 'text.secondary' }}>
                      <span style={{ fontWeight: 750 }}>Bulker ID:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{bulkerCode}</span>
                      <IconButton size="small" onClick={() => copyToClipboard(bulkerCode)} sx={{ p: 0.3 }}>
                        <ContentCopyIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Box>
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

              <Divider sx={{ my: 2 }} />

              {/* Quick Formula Banner */}
              <Box sx={{ p: 1.5, borderRadius: '14px', bgcolor: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.15)' }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main', display: 'block' }}>
                  ACTIVE WALLET FORMULA:
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  <strong>GetAmount = (Assigned Rate - Member Rate)</strong> &nbsp;|&nbsp; <strong>Total Profit = GetAmount × Live Reviews</strong>
                </Typography>
              </Box>
            </Box>

            {/* Quick Metrics in Profile */}
            <Stack direction="row" spacing={3} sx={{ mt: 2, pt: 1 }}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>WALLET LIVE REVIEWS</Typography>
                <Typography variant="h6" sx={{ fontWeight: 900, color: 'primary.main' }}>
                  {wallet.walletLiveReviews}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>FORMULA PROFIT</Typography>
                <Typography variant="h6" sx={{ fontWeight: 900, color: '#16a34a' }}>
                  {formatINR(wallet.computedProfit)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>TRANSACTIONS RECORDED</Typography>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  {transactions.length}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        {/* Right: Realistic Virtual ATM Debit Card */}
        <Grid item xs={12} md={5}>
          <Box
            sx={{
              width: '100%',
              minHeight: 240,
              height: '100%',
              borderRadius: '24px',
              p: 3,
              color: '#ffffff',
              background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%)',
              boxShadow: '0 16px 36px -10px rgba(67, 56, 202, 0.45)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              border: '1px solid rgba(255, 255, 255, 0.18)'
            }}
          >
            {/* Hologram Circle */}
            <Box
              sx={{
                position: 'absolute',
                top: -50,
                right: -50,
                width: 170,
                height: 170,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 70%)',
                pointerEvents: 'none'
              }}
            />

            {/* ATM Top: Brand & Contactless */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '8px',
                    bgcolor: 'rgba(255,255,255,0.2)',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 900,
                    fontSize: '14px'
                  }}
                >
                  N
                </Box>
                <Typography sx={{ fontWeight: 900, letterSpacing: '0.08em', fontSize: '14px' }}>
                  NOVAIRA PAY
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <ContactlessRoundedIcon sx={{ fontSize: 22, opacity: 0.85 }} />
                <Typography sx={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em', opacity: 0.85 }}>
                  DEBIT
                </Typography>
              </Stack>
            </Box>

            {/* ATM Center: Chip & Live Wallet Balance */}
            <Box sx={{ my: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box
                sx={{
                  width: 44,
                  height: 32,
                  borderRadius: '6px',
                  bgcolor: '#fbbf24',
                  background: 'linear-gradient(135deg, #fef08a 0%, #f59e0b 100%)',
                  boxShadow: 'inset 0 0 3px rgba(0,0,0,0.3)',
                  border: '1px solid rgba(0,0,0,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <SimCardRoundedIcon sx={{ color: 'rgba(0,0,0,0.4)', fontSize: 24, transform: 'rotate(90deg)' }} />
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.85 }}>
                  Live Wallet Balance
                </Typography>
                <Typography sx={{ fontSize: '26px', fontWeight: 900, letterSpacing: '0.02em', color: '#ffffff' }}>
                  {formatINR(wallet.liveWalletBalance)}
                </Typography>
              </Box>
            </Box>

            {/* Masked Card Number */}
            <Typography
              sx={{
                fontFamily: 'monospace',
                fontSize: '15px',
                letterSpacing: '0.18em',
                fontWeight: 600,
                opacity: 0.95
              }}
            >
              •••• •••• •••• {cleanId.slice(-4).toUpperCase() || '7721'}
            </Typography>

            {/* ATM Footer: Cardholder & Expiry */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mt: 1 }}>
              <Box sx={{ minWidth: 0, pr: 1 }}>
                <Typography sx={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.75 }}>
                  CARDHOLDER
                </Typography>
                <Typography noWrap sx={{ fontWeight: 800, fontSize: '13px', textTransform: 'uppercase' }}>
                  {bulker?.full_name || bulkerCode}
                </Typography>
                <Typography noWrap sx={{ fontSize: '9px', opacity: 0.75, fontFamily: 'monospace' }}>
                  {bulkerCode}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                <Typography sx={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.75 }}>
                  VALID THRU
                </Typography>
                <Typography sx={{ fontWeight: 700, fontSize: '12px', fontFamily: 'monospace' }}>
                  12/29
                </Typography>
              </Box>
            </Box>
          </Box>
        </Grid>
      </Grid>

      {/* 4 Financial Stat Cards */}
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
                  Live Wallet Balance
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#16a34a' }}>
                  {formatINR(wallet.liveWalletBalance)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Ready for payout
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
                  Total Credits
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#2563eb' }}>
                  {formatINR(wallet.creditSum)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Member credits
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
                  Total Debits
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#f59e0b' }}>
                  {formatINR(wallet.debitSum)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Payouts disbursed
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
                  Live Reviews
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                  {wallet.walletLiveReviews}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  In Wallet System period
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'rgba(139,92,246,0.1)', color: '#8b5cf6', borderRadius: '14px' }}>
                <CalendarMonthIcon />
              </Avatar>
            </Stack>
          </Card>
        </Grid>
      </Grid>

      {/* WALLET PERIOD APP-WISE FORMULA BREAKDOWN DATA TABLE */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: '24px',
          border: `1px solid ${theme.palette.divider}`,
          overflow: 'hidden',
          bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(15,23,42,0.6)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.03)',
          mb: 3.5
        }}
      >
        {/* Table Filter & Search Header */}
        <Box sx={{ p: 2.5, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              Live Apps Calculation Breakdown (Wallet System Periods)
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Formula: <code>(Assigned Rate - Member Rate) = GetAmount</code> × <code>Live Count = Total Earned</code>
            </Typography>
          </Box>

          <TextField
            size="small"
            placeholder="Search by app name or task ID..."
            value={breakdownSearch}
            onChange={(e) => { setBreakdownSearch(e.target.value); setBreakdownPage(0); }}
            sx={{ minWidth: { xs: '100%', sm: 260 }, '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              )
            }}
          />
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.02)' : 'rgba(255,255,255,0.02)' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem', py: 1.5, whiteSpace: 'nowrap' }}>APP NAME & TASK</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>LIVE REVIEWS</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>ASSIGNED RATE</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>MEMBER RATE</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>GET AMOUNT (PROFIT)</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>TOTAL EARNED</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedBreakdown.map((item) => (
                <TableRow key={item.appId} hover>
                  <TableCell sx={{ py: 1.2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 750 }}>
                      {item.appName}
                    </Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                      Task ID: #{item.taskId}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      size="small"
                      label={item.liveCount}
                      color="primary"
                      sx={{ fontWeight: 800, fontSize: '0.75rem', height: 22 }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>{formatINR(item.assignedAmount)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>{formatINR(item.memberAmount)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: item.getAmount > 0 ? '#16a34a' : 'inherit' }}>
                    {formatINR(item.getAmount)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 900, color: '#16a34a', fontSize: '0.9rem' }}>
                    {formatINR(item.totalEarned)}
                  </TableCell>
                </TableRow>
              ))}
              {filteredBreakdown.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {breakdownSearch ? 'No apps match your search filter.' : 'No live review submissions recorded for this bulker during Wallet System periods.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Table Pagination */}
        <TablePagination
          component="div"
          count={filteredBreakdown.length}
          page={breakdownPage}
          rowsPerPage={breakdownRowsPerPage}
          onPageChange={(e, p) => setBreakdownPage(p)}
          onRowsPerPageChange={(e) => { setBreakdownRowsPerPage(parseInt(e.target.value, 10)); setBreakdownPage(0); }}
          rowsPerPageOptions={[5, 10, 25]}
        />

        {wallet.breakdownList.length > 0 && (
          <Box sx={{ p: 2, bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.02)' : 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="body2" sx={{ fontWeight: 800 }}>
              Calculated Formula Profit:
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#16a34a' }}>
              {formatINR(wallet.computedProfit)}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* TRANSACTION LEDGER TABLE */}
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
        <Box sx={{ p: 2.5, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mr: 1 }}>
            Wallet Transactions Ledger ({transactions.length})
          </Typography>

          <TextField
            size="small"
            placeholder="Search by Trx ID, description..."
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
        </Box>

        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.02)' : 'rgba(255,255,255,0.02)' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem', py: 1.5, whiteSpace: 'nowrap' }}>TX ID</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>DATE & TIME</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>TYPE</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem' }}>DESCRIPTION</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>AMOUNT</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>STATUS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedTransactions.map((tx) => (
                <TableRow key={tx.id || tx.transaction_id} hover>
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                    #{tx.transaction_id ? tx.transaction_id.slice(-8) : String(tx.id).slice(0, 8)}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                    {formatIST(tx.created_at)}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Chip
                      label={tx.transaction_type}
                      size="small"
                      color={tx.transaction_type === 'Credit' ? 'success' : 'error'}
                      sx={{ fontWeight: 800, fontSize: '0.72rem', borderRadius: '8px' }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.84rem' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                      <Typography variant="body2" sx={{ fontSize: '0.84rem', fontWeight: 500 }}>
                        {tx.description || 'Bulker wallet transaction'}
                      </Typography>
                      {(tx.utr_id || tx.payout_details?.utr_number || tx.payout_details?.payment_method) && (
                        <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap">
                          {(tx.utr_id || tx.payout_details?.utr_number) && (
                            <Chip
                              label={`UTR: ${tx.utr_id || tx.payout_details?.utr_number}`}
                              size="small"
                              variant="outlined"
                              sx={{ height: 19, fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 700 }}
                            />
                          )}
                          {tx.payout_details?.payment_method && (
                            <Chip
                              label={String(tx.payout_details.payment_method).replace(/_/g, ' ')}
                              size="small"
                              sx={{ height: 19, fontSize: '0.66rem', fontWeight: 700 }}
                            />
                          )}
                        </Stack>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 900, fontSize: '0.9rem', color: tx.transaction_type === 'Credit' ? '#16a34a' : '#ef4444', whiteSpace: 'nowrap' }}>
                    {tx.transaction_type === 'Credit' ? '+' : '-'}{formatINR(tx.amount)}
                  </TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    <Chip
                      label={tx.status || 'Success'}
                      size="small"
                      variant="outlined"
                      sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {paginatedTransactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No wallet transactions found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={filteredTransactions.length}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(e, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Paper>

      {/* BILLING HISTORY TIMELINE DIALOG */}
      <Dialog
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '24px', p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <HistoryRoundedIcon color="primary" />
            <span>Billing Mode History</span>
          </Stack>
          <IconButton size="small" onClick={() => setHistoryModalOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ p: 2 }}>
          {billingHistory.length === 0 ? (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
              No billing mode transition records logged in <code>bulker_billing_history</code> for this bulker desk.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>Timestamp</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Account Mode</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {billingHistory.map((h) => (
                  <TableRow key={h.id} hover>
                    <TableCell sx={{ fontSize: '0.82rem' }}>{formatIST(h.change_date_time)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={h.change_mode}
                        color={h.change_mode === 'Wallet System' ? 'primary' : 'warning'}
                        sx={{ fontWeight: 700, fontSize: '0.72rem' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={h.status || 'Active'} variant="outlined" sx={{ fontWeight: 600, fontSize: '0.72rem' }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setHistoryModalOpen(false)} variant="outlined" sx={{ borderRadius: '12px' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* QUICK MANUAL TRANSACTION DIALOG */}
      <Dialog
        open={trxModalOpen}
        onClose={() => !processing && setTrxModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '24px', p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          {trxType} Bulker Wallet
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.2} sx={{ mt: 0.5 }}>
            <TextField
              label="Amount (₹)"
              type="number"
              fullWidth
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 500.00"
              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
            />

            <FormControl fullWidth size="small">
              <InputLabel>Payment / Transfer Method</InputLabel>
              <Select
                label="Payment / Transfer Method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                sx={{ borderRadius: '14px' }}
              >
                <MenuItem value="UPI">UPI Transfer</MenuItem>
                <MenuItem value="DIRECT_BANK_TRANSFER">Direct Bank Transfer (IMPS/NEFT)</MenuItem>
                <MenuItem value="WALLET_ADJUSTMENT">Wallet Adjustment</MenuItem>
                <MenuItem value="CASH">Cash / Manual Settlement</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="UTR / Reference ID (Optional)"
              size="small"
              fullWidth
              value={utrId}
              onChange={(e) => setUtrId(e.target.value)}
              placeholder="e.g. UTR4920184910"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
            />

            <TextField
              label="Description / Reason"
              multiline
              rows={2}
              fullWidth
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter note or reason for this transaction..."
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
            />

            {trxType === 'Debit' && (
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: '14px',
                  border: `1px solid ${theme.palette.divider}`,
                  bgcolor: theme.palette.mode === 'light' ? 'rgba(37,99,235,0.03)' : 'rgba(255,255,255,0.03)'
                }}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={syncToCompanyFund}
                      onChange={(e) => setSyncToCompanyFund(e.target.checked)}
                      color="primary"
                      size="small"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.82rem' }}>
                        Deduct from Main Company Fund
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                        Uncheck if you do not want this payout logged in company fund transactions.
                      </Typography>
                    </Box>
                  }
                />
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setTrxModalOpen(false)} disabled={processing} sx={{ borderRadius: '12px' }}>
            Cancel
          </Button>
          <Button
            onClick={handleProcessTransaction}
            variant="contained"
            color={trxType === 'Credit' ? 'success' : 'error'}
            disabled={processing}
            sx={{ borderRadius: '12px', fontWeight: 800, px: 3 }}
          >
            {processing ? 'Processing...' : `Confirm ${trxType}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Top Center Compact Toast Notification */}
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
            py: 0.9,
            px: 2,
            borderRadius: '100px',
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.98)',
            border: '1px solid',
            borderColor:
              toast.type === 'success'
                ? 'rgba(16, 185, 129, 0.45)'
                : toast.type === 'warning'
                ? 'rgba(245, 158, 11, 0.45)'
                : 'rgba(239, 68, 68, 0.45)',
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
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }} noWrap>
                {toast.message}
              </Typography>
            )}
          </Box>
        </Paper>
      </Snackbar>
    </Box>
  );
}
