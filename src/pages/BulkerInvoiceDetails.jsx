import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField,
  MenuItem, Button, IconButton, Chip, Avatar, Stack, CircularProgress,
  Divider, useTheme, Snackbar, Tooltip
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CloseIcon from '@mui/icons-material/Close';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from '../supabaseClient';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function BulkerInvoiceDetails() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { bulkerId: rawBulkerId } = useParams();
  const identifier = decodeURIComponent(rawBulkerId || '');

  const invoicePrintRef = useRef(null);

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [bulker, setBulker] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [toast, setToast] = useState({ open: false, type: 'success', title: '', message: '' });

  const showToast = (type, title, message = '') => {
    setToast({ open: true, type, title, message });
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast('success', 'Copied!', text);
  };

  const fetchBulkerAndTransactions = async () => {
    if (!identifier) return;
    setLoading(true);
    try {
      // 1. Fetch Bulker Desk details
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

      // 2. Fetch Transactions for this bulker
      const searchKeys = Array.from(
        new Set([identifier, bData?.bulker_id, bData?.id].filter(Boolean))
      );

      let bwList = [];
      try {
        const { data: bwData } = await supabase
          .from('bulker_wallet_transactions')
          .select('*')
          .in('bulker_id', searchKeys)
          .order('created_at', { ascending: false });
        if (bwData) bwList = bwData;
      } catch (e) {
        console.error('Error fetching bulker_wallet_transactions:', e);
      }

      let cfList = [];
      try {
        const { data: cData } = await supabase
          .from('company_fund_transactions')
          .select('*')
          .in('party_id', searchKeys)
          .order('created_at', { ascending: false });
        if (cData) cfList = cData;
      } catch (e) {
        console.error('Error fetching company_fund_transactions:', e);
      }

      // Merge transactions uniquely
      const map = new Map();
      bwList.forEach(item => {
        const key = item.transaction_id || `bw_${item.id}`;
        map.set(key, item);
      });
      cfList.forEach(item => {
        const key = item.transaction_id || `cf_${item.id}`;
        if (!map.has(key)) {
          map.set(key, {
            ...item,
            bulker_id: item.party_id,
            transaction_type: item.type === 'Inflow' ? 'Debit' : 'Credit'
          });
        }
      });

      const combined = Array.from(map.values()).sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );

      setTransactions(combined);
    } catch (err) {
      console.error('Failed to load bulker details:', err);
      showToast('error', 'Failed to Load', err.message || 'Could not fetch bulker invoice details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBulkerAndTransactions();
  }, [identifier]);

  // Filter transactions for the chosen Month & Year
  const monthlyTransactions = transactions.filter(t => {
    if (!t.created_at) return false;
    const d = new Date(t.created_at);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  // Calculate Monthly Totals
  const totalCredits = monthlyTransactions
    .filter(t => t.transaction_type === 'Credit' && (t.status || 'Success').toLowerCase() !== 'failed')
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

  const totalDebits = monthlyTransactions
    .filter(t => t.transaction_type === 'Debit' && (t.status || 'Success').toLowerCase() !== 'failed')
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

  // If there are transactions in this month, use actual credit earnings;
  // otherwise provide a clean statement view
  const grossEarnings = totalCredits > 0 ? totalCredits : (monthlyTransactions.length > 0 ? totalDebits : 0);
  const tdsDeduction = grossEarnings > 0 ? Math.round(grossEarnings * 0.01) : 0; // 1% TDS under Sec 194C
  const netPayable = Math.max(0, grossEarnings - tdsDeduction);

  // Format dates for invoice header
  const daysInSelectedMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const periodStart = `01 ${MONTH_NAMES[selectedMonth].slice(0, 3)} ${selectedYear}`;
  const periodEnd = `${daysInSelectedMonth} ${MONTH_NAMES[selectedMonth].slice(0, 3)} ${selectedYear}`;
  const invoiceDate = `${daysInSelectedMonth} ${MONTH_NAMES[selectedMonth]} ${selectedYear}`;

  const cleanBulkerCode = (bulker?.bulker_id || 'AP723').replace(/[^a-zA-Z0-9]/g, '');
  const invoiceNumber = `NV-INV-${selectedYear}${String(selectedMonth + 1).padStart(2, '0')}-${cleanBulkerCode}`;

  // Direct Customized PDF Download using html2canvas and jsPDF (No Print Preview popup)
  const handleDownloadPdf = async () => {
    if (!invoicePrintRef.current) return;

    setDownloadingPdf(true);
    showToast('success', 'Preparing PDF...', 'Rendering customized light theme invoice.');

    try {
      const element = invoicePrintRef.current;

      // Render crisp canvas
      const canvas = await html2canvas(element, {
        scale: 2.2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1100
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      if (imgHeight <= pdfHeight) {
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      } else {
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
          position -= pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pdfHeight;
        }
      }

      const fileName = `Novaira_Invoice_${cleanBulkerCode}_${MONTH_NAMES[selectedMonth]}_${selectedYear}.pdf`;
      pdf.save(fileName);

      showToast('success', 'Download Complete!', `Saved ${fileName}`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      showToast('error', 'PDF Export Failed', err.message || 'Could not export PDF file.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 6, textAlign: 'center', maxWidth: 1200, mx: 'auto' }}>
        <CircularProgress size={44} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Loading bulker invoice details...
        </Typography>
      </Box>
    );
  }

  if (!bulker) {
    return (
      <Box sx={{ p: 5, textAlign: 'center', maxWidth: 800, mx: 'auto' }}>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>Bulker Not Found</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Could not find any bulker desk matching "{identifier}".
        </Typography>
        <Button variant="contained" onClick={() => navigate('/payments/bulkers/invoices')}>
          Back to Invoices
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1300, mx: 'auto', py: 2 }}>
      {/* Top Action Bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/payments/bulkers/invoices')}
            sx={{ borderRadius: '12px', fontWeight: 700 }}
            color="inherit"
          >
            Back
          </Button>

          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                {bulker.full_name}
              </Typography>
              <Chip
                label={bulker.bulker_id}
                size="small"
                sx={{ fontFamily: 'monospace', fontWeight: 800, borderRadius: '8px' }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              Bulker Desk Settlement & Official Monthly Invoicing
            </Typography>
          </Box>
        </Box>

        {/* Action Controls */}
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant="outlined"
            startIcon={<AccountBalanceWalletIcon />}
            onClick={() => navigate(`/payments/bulkers/wallet/${bulker.id || bulker.bulker_id}`)}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
          >
            View Wallet
          </Button>

          <Button
            variant="contained"
            color="primary"
            startIcon={downloadingPdf ? <CircularProgress size={18} color="inherit" /> : <DownloadIcon />}
            disabled={downloadingPdf}
            onClick={handleDownloadPdf}
            sx={{
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 800,
              px: 2.8,
              boxShadow: '0 4px 14px rgba(37,99,235,0.3)'
            }}
          >
            {downloadingPdf ? 'Exporting PDF...' : 'Download PDF'}
          </Button>
        </Stack>
      </Box>

      {/* Month & Year Filter Card */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 3.5,
          borderRadius: '20px',
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(15,23,42,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: 'rgba(37,99,235,0.1)', color: '#2563eb', borderRadius: '12px' }}>
            <CalendarMonthIcon />
          </Avatar>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Select Billing Period
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Generate statement & corporate invoice for specific month & year
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          {/* Month Selector */}
          <TextField
            select
            size="small"
            label="Month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            sx={{ minWidth: 160, '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
          >
            {MONTH_NAMES.map((name, index) => (
              <MenuItem key={name} value={index}>
                {name}
              </MenuItem>
            ))}
          </TextField>

          {/* Year Selector */}
          <TextField
            select
            size="small"
            label="Year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            sx={{ minWidth: 120, '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
          >
            {[2024, 2025, 2026, 2027, 2028].map((yr) => (
              <MenuItem key={yr} value={yr}>
                {yr}
              </MenuItem>
            ))}
          </TextField>

          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchBulkerAndTransactions}
            sx={{ borderRadius: '12px', fontWeight: 700 }}
          >
            Refresh
          </Button>
        </Stack>
      </Paper>

      {/* ------------------------------------------------------------- */}
      {/* GOOGLE / TOP TIER CORPORATE INVOICE TEMPLATE (LIGHT THEME)     */}
      {/* ------------------------------------------------------------- */}
      <Box
        ref={invoicePrintRef}
        sx={{
          bgcolor: '#ffffff',
          color: '#111827',
          p: { xs: 3, md: 6 },
          borderRadius: '24px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 12px 40px rgba(0,0,0,0.06)',
          maxWidth: 960,
          mx: 'auto',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Google Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        }}
      >
        {/* Top Header: Company Branding & Invoice Badge */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pb: 4, borderBottom: '2px solid #f1f5f9' }}>
          {/* Left: Company Details & Logo */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '1.5rem',
                  boxShadow: '0 4px 12px rgba(37,99,235,0.3)'
                }}
              >
                N
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 900, fontSize: '1.3rem', letterSpacing: '-0.02em', color: '#0f172a', lineHeight: 1.1 }}>
                  NOVAIRA
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: '0.68rem', letterSpacing: '0.12em', color: '#2563eb', textTransform: 'uppercase' }}>
                  GLOBAL BUSINESS SOLUTIONS
                </Typography>
              </Box>
            </Box>

            <Typography sx={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.45 }}>
              Novaira Global Business Solutions Pvt. Ltd.<br />
              12th Floor, Tower B, Cyber City, Sector 24<br />
              Gurugram, Haryana - 122002, India<br />
              <b>GSTIN:</b> 06AABCN1234F1ZQ &nbsp;|&nbsp; <b>CIN:</b> U72900HR2023PTC112345<br />
              <b>Email:</b> billing@novairasolution.com &nbsp;|&nbsp; <b>Web:</b> novairasolution.com
            </Typography>
          </Box>

          {/* Right: Invoice Title & Meta */}
          <Box sx={{ textAlign: 'right' }}>
            <Typography sx={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1 }}>
              INVOICE
            </Typography>
            <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.9rem', color: '#64748b', mt: 0.5 }}>
              #{invoiceNumber}
            </Typography>

            <Box sx={{ mt: 2, display: 'inline-flex', alignItems: 'center', gap: 0.8, bgcolor: '#ecfdf5', color: '#059669', px: 1.8, py: 0.5, borderRadius: '100px', border: '1px solid #a7f3d0' }}>
              <CheckCircleIcon sx={{ fontSize: 16 }} />
              <Typography sx={{ fontWeight: 800, fontSize: '0.74rem', letterSpacing: '0.04em' }}>
                SETTLED & PAID
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Invoice Metadata Grid */}
        <Grid container spacing={3} sx={{ py: 3.5, borderBottom: '1px solid #f1f5f9' }}>
          {/* Bulker / Vendor Recipient */}
          <Grid item xs={12} sm={6}>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.8 }}>
              Billed To / Bulker Partner
            </Typography>
            <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
              {bulker.full_name}
            </Typography>
            <Typography sx={{ fontSize: '0.82rem', color: '#334155', mt: 0.3 }}>
              <b>Bulker ID:</b> {bulker.bulker_id}
            </Typography>
            {bulker.phone && (
              <Typography sx={{ fontSize: '0.82rem', color: '#475569' }}>
                <b>Phone:</b> {bulker.phone}
              </Typography>
            )}
            {bulker.email && (
              <Typography sx={{ fontSize: '0.82rem', color: '#475569' }}>
                <b>Email:</b> {bulker.email}
              </Typography>
            )}
            <Typography sx={{ fontSize: '0.82rem', color: '#475569' }}>
              <b>Account Status:</b> {bulker.status || 'Active'}
            </Typography>
          </Grid>

          {/* Dates & Billing Cycle */}
          <Grid item xs={12} sm={6} sx={{ textAlign: { sm: 'right' } }}>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.8 }}>
              Billing Cycle Information
            </Typography>
            <Typography sx={{ fontSize: '0.82rem', color: '#334155', mb: 0.4 }}>
              <b>Invoice Date:</b> {invoiceDate}
            </Typography>
            <Typography sx={{ fontSize: '0.82rem', color: '#334155', mb: 0.4 }}>
              <b>Billing Period:</b> {periodStart} – {periodEnd}
            </Typography>
            <Typography sx={{ fontSize: '0.82rem', color: '#334155', mb: 0.4 }}>
              <b>Settlement Mode:</b> Direct Bank Transfer / Wallet
            </Typography>
            <Typography sx={{ fontSize: '0.82rem', color: '#334155' }}>
              <b>Currency:</b> INR (₹)
            </Typography>
          </Grid>
        </Grid>

        {/* Monthly Summary Cards (Google Cloud Style) */}
        <Grid container spacing={2} sx={{ my: 3 }}>
          <Grid item xs={12} sm={4}>
            <Box sx={{ p: 2, borderRadius: '16px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Gross Commission
              </Typography>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', mt: 0.4 }}>
                ₹{grossEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Box sx={{ p: 2, borderRadius: '16px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                TDS Deductions (1%)
              </Typography>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: '#ef4444', mt: 0.4 }}>
                -₹{tdsDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Box sx={{ p: 2, borderRadius: '16px', bgcolor: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase' }}>
                Net Settled Amount
              </Typography>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 900, color: '#1d4ed8', mt: 0.4 }}>
                ₹{netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Services / Line Items Table */}
        <Typography sx={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', mb: 1.5 }}>
          Itemized Services & Settlements
        </Typography>

        <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden', mb: 3 }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.74rem', color: '#475569', py: 1.4 }}>NO.</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.74rem', color: '#475569' }}>SERVICE / TRANSACTION DESCRIPTION</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.74rem', color: '#475569' }}>CATEGORY</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.74rem', color: '#475569' }}>DATE</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.74rem', color: '#475569' }}>AMOUNT (₹)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {monthlyTransactions.length > 0 ? (
                monthlyTransactions.map((trx, idx) => (
                  <TableRow key={trx.id || idx} sx={{ '&:last-child td': { border: 0 } }}>
                    <TableCell sx={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                      {String(idx + 1).padStart(2, '0')}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                      {trx.description || 'Bulker Task Commission Settlement'}
                      {trx.transaction_id && (
                        <Typography variant="caption" sx={{ display: 'block', color: '#64748b', fontFamily: 'monospace' }}>
                          Ref: {trx.transaction_id}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.78rem', color: '#475569' }}>
                      {trx.category || (trx.transaction_type === 'Credit' ? 'Commission' : 'Payout')}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.78rem', color: '#64748b' }}>
                      {new Date(trx.created_at).toLocaleDateString('en-GB')}
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.82rem', fontWeight: 800, color: trx.transaction_type === 'Debit' ? '#dc2626' : '#16a34a' }}>
                      {trx.transaction_type === 'Debit' ? '-' : '+'}₹{parseFloat(trx.amount || 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <>
                  <TableRow>
                    <TableCell sx={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>01</TableCell>
                    <TableCell sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                      Bulker Desk Task Operations & Commission Settlement
                      <Typography variant="caption" sx={{ display: 'block', color: '#64748b' }}>
                        Period: {periodStart} to {periodEnd}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.78rem', color: '#475569' }}>Monthly Retainer</TableCell>
                    <TableCell sx={{ fontSize: '0.78rem', color: '#64748b' }}>{invoiceDate}</TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.82rem', fontWeight: 800, color: '#16a34a' }}>
                      ₹{grossEarnings.toFixed(2)}
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ '&:last-child td': { border: 0 } }}>
                    <TableCell sx={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>02</TableCell>
                    <TableCell sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                      Platform Support, Verification & SLA Management
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.78rem', color: '#475569' }}>Service Operations</TableCell>
                    <TableCell sx={{ fontSize: '0.78rem', color: '#64748b' }}>{invoiceDate}</TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.82rem', fontWeight: 800, color: '#64748b' }}>
                      Included
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Calculation / Totals Block */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 4 }}>
          <Box sx={{ width: { xs: '100%', sm: 360 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.8 }}>
              <Typography sx={{ fontSize: '0.84rem', color: '#64748b' }}>Subtotal / Gross Earnings:</Typography>
              <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                ₹{grossEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.8 }}>
              <Typography sx={{ fontSize: '0.84rem', color: '#64748b' }}>TDS Deducted (Sec 194C @ 1%):</Typography>
              <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: '#ef4444' }}>
                -₹{tdsDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </Box>

            <Divider sx={{ my: 1.2, borderColor: '#e2e8f0' }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
              <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                Total Net Payable:
              </Typography>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 900, color: '#1d4ed8' }}>
                ₹{netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Settlement Notes & Terms (Google corporate style) */}
        <Box sx={{ p: 2.5, borderRadius: '16px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0', mb: 4 }}>
          <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', mb: 0.6 }}>
            Notes & Compliance Statement:
          </Typography>
          <Typography sx={{ fontSize: '0.74rem', color: '#475569', lineHeight: 1.55 }}>
            1. This invoice reflects all commission earnings and payout settlements disbursed to Bulker Desk Partner <b>{bulker.full_name} ({bulker.bulker_id})</b> for services rendered during <b>{MONTH_NAMES[selectedMonth]} {selectedYear}</b>.<br />
            2. Tax Deducted at Source (TDS), if applicable under Section 194C/194J of the Income Tax Act, 1961, has been deducted and will be credited to your PAN in Form 26AS / AIS.<br />
            3. All payments are processed through RBI-authorized banking channels (NEFT/IMPS/RTGS).
          </Typography>
        </Box>

        {/* Signatory & Footer */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', pt: 2, borderTop: '1px solid #f1f5f9' }}>
          <Box>
            <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>
              This is an authenticated computer-generated invoice.<br />
              Generated via Novaira Solution Admin Portal V2.1
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'center' }}>
            <Box
              sx={{
                width: 140,
                borderBottom: '1px dashed #cbd5e1',
                pb: 1,
                mb: 0.8
              }}
            >
              <Typography sx={{ fontFamily: 'cursive', fontSize: '1.1rem', color: '#1e40af', fontWeight: 700 }}>
                Novaira Global
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
              Authorized Signatory
            </Typography>
            <Typography sx={{ fontSize: '0.66rem', color: '#64748b' }}>
              Novaira Global Business Solutions
            </Typography>
          </Box>
        </Box>
      </Box>

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
            backdropFilter: 'blur(16px)',
            border: '1px solid',
            borderColor:
              toast.type === 'success'
                ? 'rgba(16, 185, 129, 0.45)'
                : toast.type === 'warning'
                ? 'rgba(245, 158, 11, 0.45)'
                : 'rgba(239, 68, 68, 0.45)',
            boxShadow:
              theme.palette.mode === 'dark'
                ? '0 16px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(16, 185, 129, 0.12)'
                : '0 16px 40px rgba(0, 0, 0, 0.12), 0 0 20px rgba(16, 185, 129, 0.12)',
            minWidth: { xs: 290, sm: 360 },
            maxWidth: '92vw'
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

          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 800,
                fontSize: '0.86rem',
                color:
                  toast.type === 'success'
                    ? '#10b981'
                    : toast.type === 'warning'
                    ? '#f59e0b'
                    : '#ef4444',
                whiteSpace: 'nowrap'
              }}
            >
              {toast.title}
            </Typography>
            {toast.message && (
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 550,
                  fontSize: '0.82rem',
                  color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {toast.message}
              </Typography>
            )}
          </Box>

          <IconButton
            size="small"
            onClick={() => setToast(prev => ({ ...prev, open: false }))}
            sx={{ p: 0.3, color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Paper>
      </Snackbar>
    </Box>
  );
}
