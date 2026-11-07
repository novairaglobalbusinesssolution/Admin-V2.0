import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Card, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField,
  MenuItem, Button, IconButton, Chip, Avatar, Stack, CircularProgress,
  Divider, useTheme, Snackbar, FormControl, Select, Dialog,
  DialogTitle, DialogContent, DialogActions, Checkbox, FormControlLabel,
  InputAdornment, Tooltip
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CloseIcon from '@mui/icons-material/Close';
import PrintIcon from '@mui/icons-material/Print';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PaymentIcon from '@mui/icons-material/Payment';
import VerifiedIcon from '@mui/icons-material/Verified';
import BusinessIcon from '@mui/icons-material/Business';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../supabaseClient';
import {
  getProviderIdVariants,
  calculateProviderFinances,
  formatINR,
  formatMonthTitle,
  getAppMonthKey
} from '../utils/providerPaymentCalculations';

export default function ProviderInvoiceDetails() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { providerId: rawProviderId } = useParams();
  const identifier = decodeURIComponent(rawProviderId || '');

  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [provider, setProvider] = useState(null);
  const [apps, setApps] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // Active billing month (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState('');

  // Settle Payment Modal State
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('DIRECT_BANK_TRANSFER');
  const [payUtr, setPayUtr] = useState('');
  const [payNote, setPayNote] = useState('');
  const [syncToCompanyFund, setSyncToCompanyFund] = useState(true);
  const [paying, setPaying] = useState(false);

  const [toast, setToast] = useState({ open: false, type: 'success', title: '', message: '' });

  const showToast = (type, title, message = '') => {
    setToast({ open: true, type, title, message });
  };

  const copyToClipboard = (text, label = 'Copied') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast('success', `${label} Copied!`, text);
  };

  const formatKolkataDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const fetchProviderAndBilling = async () => {
    if (!identifier) return;
    setLoading(true);
    try {
      // 1. Fetch Provider Profile
      let pData = null;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

      if (isUuid) {
        const { data: byId } = await supabase
          .from('providers')
          .select('*')
          .eq('id', identifier)
          .maybeSingle();
        pData = byId;
      }

      if (!pData) {
        const { data: byProviderId } = await supabase
          .from('providers')
          .select('*')
          .eq('provider_id', identifier)
          .maybeSingle();
        pData = byProviderId;
      }

      if (!pData && !isUuid) {
        const { data: fallbackById } = await supabase
          .from('providers')
          .select('*')
          .eq('id', identifier)
          .maybeSingle();
        pData = fallbackById;
      }

      setProvider(pData);

      const targetVariants = getProviderIdVariants(pData?.provider_id || identifier);

      // 2. Fetch Apps sponsored by this provider
      const { data: appsData, error: aErr } = await supabase
        .from('apps')
        .select('id, app_name, app_package, task_id, sponsor_type, sponsor_id, sponsor_amount, members_reward, app_date, created_at')
        .eq('sponsor_type', 'Provider')
        .range(0, 4999);

      if (aErr) throw aErr;

      const providerApps = (appsData || []).filter((a) => {
        if (!a.sponsor_id) return false;
        const sId = String(a.sponsor_id).trim().toLowerCase();
        const sClean = sId.replace(/^novaira\/provider\//i, '');
        return targetVariants.some((v) => {
          const vClean = String(v).replace(/^NOVAIRA\/PROVIDER\//i, '').toLowerCase();
          return sClean === vClean || sId === String(v).toLowerCase();
        });
      });

      setApps(providerApps);

      const appIds = providerApps.map((a) => a.id);

      // 3. Concurrently fetch reviews and transactions
      let allReviews = [];
      if (appIds.length > 0) {
        // Chunk fetching reviews if many apps
        const chunkSize = 200;
        for (let i = 0; i < appIds.length; i += chunkSize) {
          const sliceIds = appIds.slice(i, i + chunkSize);
          let from = 0;
          const step = 1000;
          while (true) {
            const { data: revPage, error: revErr } = await supabase
              .from('review_submit_data')
              .select('id, app_id, status, submitted_at')
              .in('app_id', sliceIds)
              .in('status', ['Live', 'Approved'])
              .range(from, from + step - 1);

            if (revErr) {
              console.error('Reviews fetch error:', revErr);
              break;
            }
            allReviews = allReviews.concat(revPage || []);
            if (!revPage || revPage.length < step) break;
            from += step;
          }
        }
      }

      // Fetch payment transactions matching this provider
      const { data: txData } = await supabase
        .from('individual_wallet_transactions')
        .select('*')
        .in('earner_id', targetVariants)
        .order('created_at', { ascending: false });

      setReviews(allReviews);
      setTransactions(txData || []);
    } catch (err) {
      console.error('Failed to load provider bill details:', err);
      showToast('error', 'Failed to Load', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviderAndBilling();
  }, [identifier]);

  // Calculated Finances using APP DATE grouping
  const calculatedFinances = useMemo(() => {
    return calculateProviderFinances({
      provider,
      apps,
      reviews,
      transactions
    });
  }, [provider, apps, reviews, transactions]);

  const { byMonth, monthKeys } = calculatedFinances;

  // Auto-select latest month
  useEffect(() => {
    if (monthKeys.length > 0) {
      if (!selectedMonth || !monthKeys.includes(selectedMonth)) {
        setSelectedMonth(monthKeys[0]);
      }
    }
  }, [monthKeys, selectedMonth]);

  const currentMonthData = byMonth[selectedMonth] || {
    monthKey: selectedMonth,
    grossTotal: 0,
    liveCount: 0,
    apps: {}
  };

  const currentMonthApps = Object.values(currentMonthData.apps);

  // Corporate Invoice Number
  const cleanProviderCode = (provider?.provider_id || identifier || 'PRV1').replace(/[^a-zA-Z0-9]/g, '');
  const invoiceNumber = `NV-PRV-INV-${(selectedMonth || '2026-10').replace('-', '')}-${cleanProviderCode}`;

  const paymentMethodLabels = {
    DIRECT_BANK_TRANSFER: 'Direct Bank Transfer (IMPS/NEFT)',
    UPI: 'UPI Auto-Settlement',
    NEFT_RTGS: 'Corporate RTGS Settlement',
    WALLET_TRANSFER: 'Novaira Pay Partner Wallet'
  };

  // Matched payments for this specific month / invoice
  const matchedPaymentTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (tx.transaction_type !== 'Debit') return false;
      const st = (tx.status || 'Completed').toLowerCase();
      if (st === 'cancelled' || st === 'rejected' || st === 'failed') return false;

      const payout = tx.payout_details || tx.metadata || {};
      const desc = String(tx.description || '').toLowerCase();
      const invNumLower = invoiceNumber.toLowerCase();
      const monthLower = String(selectedMonth || '').toLowerCase();

      return (
        payout.invoice_number === invoiceNumber ||
        payout.billing_month === selectedMonth ||
        desc.includes(invNumLower) ||
        (desc.includes('invoice') && desc.includes(monthLower))
      );
    });
  }, [transactions, invoiceNumber, selectedMonth]);

  const totalPaidAmount = useMemo(() => {
    return matchedPaymentTransactions.reduce((acc, tx) => acc + (parseFloat(tx.amount) || 0), 0);
  }, [matchedPaymentTransactions]);

  const grossTotal = currentMonthData.grossTotal || 0;
  const remainingBalance = Math.max(0, grossTotal - totalPaidAmount);
  const isFullyPaid = grossTotal > 0 && remainingBalance <= 0.01;
  const isPartiallyPaid = totalPaidAmount > 0 && remainingBalance > 0.01;
  const isUnpaid = totalPaidAmount === 0;

  const activePaymentStatus = isFullyPaid ? 'PAID' : isPartiallyPaid ? 'PARTIAL' : 'PENDING';

  const allUtrList = matchedPaymentTransactions
    .map((tx) => tx.utr_id || tx.payout_details?.utr_number || tx.metadata?.utr_number || tx.transaction_id)
    .filter(Boolean);

  const activePaymentUtr = allUtrList.length > 0 ? allUtrList.join(', ') : 'Pending Settlement';

  const activePaymentMethod =
    matchedPaymentTransactions[0]?.payout_details?.payment_method ||
    matchedPaymentTransactions[0]?.metadata?.payment_method ||
    'DIRECT_BANK_TRANSFER';

  const activePaymentDate = matchedPaymentTransactions.length > 0
    ? matchedPaymentTransactions
        .map((tx) => (tx.created_at ? formatKolkataDate(tx.created_at) : ''))
        .filter(Boolean)
        .join(', ')
    : 'Awaiting Settlement';

  const handleOpenPayModal = () => {
    const defaultPayAmount = remainingBalance > 0 ? remainingBalance : grossTotal;
    setPayAmount(defaultPayAmount > 0 ? String(defaultPayAmount) : '');
    setPayMethod('DIRECT_BANK_TRANSFER');
    setPayUtr(`UTR-${Date.now().toString().slice(-6)}`);
    setPayNote(
      isPartiallyPaid
        ? `Partial settlement for ${formatMonthTitle(selectedMonth)} provider invoice (${invoiceNumber})`
        : `Settlement for ${formatMonthTitle(selectedMonth)} provider invoice (${invoiceNumber})`
    );
    setSyncToCompanyFund(true);
    setPayModalOpen(true);
  };

  const handleExecutePayment = async () => {
    const numAmt = parseFloat(payAmount);
    if (!payAmount || isNaN(numAmt) || numAmt <= 0) {
      showToast('warning', 'Invalid Amount', 'Please enter a valid payout amount.');
      return;
    }

    setPaying(true);
    try {
      const providerCode = provider?.provider_id || identifier;
      const providerUuid = provider?.id;
      const generatedTrxId = `PRV-PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const payoutDetails = {
        provider_id: providerCode,
        provider_uuid: providerUuid,
        provider_name: provider?.name,
        invoice_number: invoiceNumber,
        billing_month: selectedMonth,
        payment_method: payMethod,
        utr_number: payUtr || null,
        synced_to_company_fund: Boolean(syncToCompanyFund),
        processed_by: 'Admin Treasury Desk'
      };

      const walletPayload = {
        transaction_id: generatedTrxId,
        earner_id: providerCode,
        amount: numAmt,
        transaction_type: 'Debit',
        description: payNote || `Provider invoice settlement for ${formatMonthTitle(selectedMonth)}`,
        status: 'Completed',
        utr_id: payUtr || null,
        payout_details: payoutDetails,
        sync_to_company_fund: Boolean(syncToCompanyFund)
      };

      const { error: wErr } = await supabase
        .from('individual_wallet_transactions')
        .insert(walletPayload);

      if (wErr) {
        console.error('Transaction insert error:', wErr);
        throw wErr;
      }

      if (!syncToCompanyFund) {
        await supabase
          .from('company_fund_transactions')
          .delete()
          .eq('transaction_id', generatedTrxId);
      }

      setPayModalOpen(false);
      showToast(
        'success',
        'Payment Recorded!',
        `Provider invoice ${invoiceNumber} settled with ₹${numAmt.toFixed(2)}${syncToCompanyFund ? ' (Synced to Company Fund)' : ''}.`
      );

      await fetchProviderAndBilling();
    } catch (err) {
      console.error('Payment error:', err);
      showToast('error', 'Payment Failed', err.message);
    } finally {
      setPaying(false);
    }
  };

  // Programmatic Vector A4 PDF Bill Generation
  const handleDownloadVectorPdf = async () => {
    setDownloadingPdf(true);
    showToast('success', 'Generating PDF...', 'Compiling vector A4 corporate bill.');

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;

      // 1. Company Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text('NOVAIRA', margin, 17);

      doc.setFontSize(8);
      doc.setTextColor(37, 99, 235);
      doc.text('GLOBAL BUSINESS SOLUTIONS', margin, 21);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('Novaira Global Business Solutions Pvt. Ltd.', margin, 26);
      doc.text('Email: support@payments.novairasolution.com | Web: novairasolution.com', margin, 30);

      // 2. Invoice Title & Meta (Right aligned)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);
      doc.text('PROVIDER INVOICE', pageWidth - margin, 18, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`#${invoiceNumber}`, pageWidth - margin, 23, { align: 'right' });

      // Status Badge
      const statusText = isFullyPaid
        ? 'SETTLED & FULLY PAID'
        : isPartiallyPaid
        ? `PARTIAL (DUE: ₹${remainingBalance.toFixed(2)})`
        : 'PENDING DISBURSEMENT';
      const statusColor = isFullyPaid
        ? [16, 185, 129]
        : isPartiallyPaid
        ? [234, 88, 12]
        : [245, 158, 11];
      const badgeWidth = isPartiallyPaid ? 60 : 48;
      doc.setFillColor(...statusColor);
      doc.roundedRect(pageWidth - margin - badgeWidth, 26, badgeWidth, 6, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(statusText, pageWidth - margin - (badgeWidth / 2), 30.2, { align: 'center' });

      // Divider Line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(margin, 38, pageWidth - margin, 38);

      // 3. Billed To & Payment Details Boxes
      const colWidth = (pageWidth - margin * 2 - 8) / 2;
      const boxY = 42;

      // Left Box: Billed To (Agency)
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, boxY, colWidth, 42, 2, 2, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, boxY, colWidth, 42, 2, 2, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('BILLED TO / AGENCY PARTNER', margin + 4, boxY + 6);

      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(provider?.name || 'Provider Agency', margin + 4, boxY + 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(`Provider ID: ${provider?.provider_id || identifier}`, margin + 4, boxY + 17);
      if (provider?.phone) doc.text(`Phone: ${provider.phone}`, margin + 4, boxY + 22);
      if (provider?.email) doc.text(`Email: ${provider.email}`, margin + 4, boxY + 27);
      doc.text(`Account Type: Sponsor Provider / Agency`, margin + 4, boxY + 32);

      // Right Box: Payment Details
      const rightBoxX = margin + colWidth + 8;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(rightBoxX, boxY, colWidth, 42, 2, 2, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(rightBoxX, boxY, colWidth, 42, 2, 2, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('TREASURY SETTLEMENT & UTR DETAILS', rightBoxX + 4, boxY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(`Billing Cycle: ${formatMonthTitle(selectedMonth)}`, rightBoxX + 4, boxY + 12);
      doc.text(`Disbursed / Paid: ₹${totalPaidAmount.toFixed(2)}  (Bal: ₹${remainingBalance.toFixed(2)})`, rightBoxX + 4, boxY + 17);
      doc.text(`Payment Status: ${isFullyPaid ? 'FULLY PAID' : isPartiallyPaid ? 'PARTIALLY PAID' : 'PENDING'}`, rightBoxX + 4, boxY + 22);
      doc.text(`Payment Method: ${paymentMethodLabels[activePaymentMethod] || activePaymentMethod}`, rightBoxX + 4, boxY + 27);
      doc.text(`Payment Date(s): ${activePaymentDate}`, rightBoxX + 4, boxY + 32);
      doc.text(`UTR / Ref: ${activePaymentUtr}`, rightBoxX + 4, boxY + 37);

      // 4. Itemized Table with APP DATE column
      const tableRows = currentMonthApps.map((item, idx) => [
        String(idx + 1).padStart(2, '0'),
        `${item.appName}\nTask ID: #${item.taskId}`,
        formatKolkataDate(item.appDate),
        String(item.liveCount),
        `₹${parseFloat(item.rate || 0).toFixed(2)}`,
        `₹${parseFloat(item.appTotal || 0).toFixed(2)}`
      ]);

      if (tableRows.length === 0) {
        tableRows.push(['01', `Provider Operations (${formatMonthTitle(selectedMonth)})`, '—', '0', `₹0.00`, `₹0.00`]);
      }

      autoTable(doc, {
        startY: 90,
        margin: { left: margin, right: margin },
        head: [['NO.', 'APPLICATION / CAMPAIGN', 'APP DATE', 'LIVE REVIEWS', 'SPONSOR RATE (INR)', 'GROSS TOTAL (INR)']],
        body: tableRows,
        theme: 'grid',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'left'
        },
        styles: {
          font: 'helvetica',
          fontSize: 8,
          cellPadding: 3,
          valign: 'middle'
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 'auto', fontStyle: 'bold' },
          2: { cellWidth: 26, halign: 'center' },
          3: { cellWidth: 24, halign: 'center', fontStyle: 'bold', textColor: [5, 150, 105] },
          4: { cellWidth: 32, halign: 'right' },
          5: { cellWidth: 34, halign: 'right', fontStyle: 'bold', textColor: [15, 157, 114] }
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        }
      });

      // 5. Summary Totals Box
      const finalY = doc.lastAutoTable.finalY + 6;
      const totalBoxWidth = 88;
      const totalBoxX = pageWidth - margin - totalBoxWidth;

      doc.setFillColor(241, 245, 249);
      doc.roundedRect(totalBoxX, finalY, totalBoxWidth, 34, 2, 2, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(totalBoxX, finalY, totalBoxWidth, 34, 2, 2, 'S');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text('Total Verified Live Deliverables:', totalBoxX + 4, finalY + 6);
      doc.setFont('helvetica', 'bold');
      doc.text(String(currentMonthData.liveCount), totalBoxX + totalBoxWidth - 4, finalY + 6, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.text('Total Gross Billed:', totalBoxX + 4, finalY + 12);
      doc.setFont('helvetica', 'bold');
      doc.text(`₹${grossTotal.toFixed(2)}`, totalBoxX + totalBoxWidth - 4, finalY + 12, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(22, 163, 74);
      doc.text('Paid / Disbursed So Far:', totalBoxX + 4, finalY + 18);
      doc.setFont('helvetica', 'bold');
      doc.text(`- ₹${totalPaidAmount.toFixed(2)}`, totalBoxX + totalBoxWidth - 4, finalY + 18, { align: 'right' });

      doc.setDrawColor(203, 213, 225);
      doc.line(totalBoxX + 4, finalY + 22, totalBoxX + totalBoxWidth - 4, finalY + 22);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(remainingBalance > 0.01 ? 220 : 15, remainingBalance > 0.01 ? 38 : 157, remainingBalance > 0.01 ? 38 : 114);
      doc.text(remainingBalance > 0.01 ? 'OUTSTANDING DUE:' : 'NET BALANCE DUE:', totalBoxX + 4, finalY + 28);
      doc.setFontSize(10.5);
      doc.text(`₹${remainingBalance.toFixed(2)}`, totalBoxX + totalBoxWidth - 4, finalY + 28, { align: 'right' });

      // Save PDF file
      const fileName = `Novaira_Provider_Invoice_${cleanProviderCode}_${selectedMonth || 'Statement'}.pdf`;
      doc.save(fileName);
      showToast('success', 'PDF Ready!', `Downloaded ${fileName}`);
    } catch (err) {
      console.error('Error generating vector PDF:', err);
      showToast('error', 'PDF Export Failed', err.message);
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 8, textAlign: 'center', maxWidth: 800, mx: 'auto' }}>
        <CircularProgress size={46} thickness={4} />
        <Typography variant="body1" sx={{ fontWeight: 750, mt: 3, color: 'text.primary' }}>
          Compiling Provider Invoice Records...
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Auditing sponsored campaigns, verified live deliverables, and billing cycles.
        </Typography>
      </Box>
    );
  }

  if (!provider) {
    return (
      <Box sx={{ p: 6, textAlign: 'center', maxWidth: 640, mx: 'auto' }}>
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>Provider Agency Not Found</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Could not locate any active provider matching identifier "{identifier}".
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate('/payments/providers/invoices')}
          sx={{ borderRadius: '12px', fontWeight: 800, textTransform: 'none' }}
        >
          Return to Provider Invoices
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1240, mx: 'auto', px: { xs: 1.5, sm: 3 }, py: 3 }}>
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, flexWrap: 'wrap', gap: 2.5 }}>
          {/* Provider Profile */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/payments/providers/invoices')}
              sx={{
                borderRadius: '12px',
                fontWeight: 750,
                textTransform: 'none',
                minWidth: 'auto',
                px: 1.5,
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
                color: 'text.primary',
                '&:hover': {
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : '#e2e8f0'
                }
              }}
            >
              Providers
            </Button>

            <Avatar
              sx={{
                width: 52,
                height: 52,
                fontSize: '1.25rem',
                fontWeight: 900,
                bgcolor: '#f59e0b',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.3)'
              }}
            >
              {(provider.name || 'P').charAt(0).toUpperCase()}
            </Avatar>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.02em', color: 'text.primary' }}>
                  {provider.name}
                </Typography>
                <Chip
                  icon={<VerifiedIcon sx={{ fontSize: '14px !important', color: '#f59e0b !important' }} />}
                  label={provider.provider_id}
                  size="small"
                  onClick={() => copyToClipboard(provider.provider_id, 'Provider ID')}
                  clickable
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    borderRadius: '8px',
                    bgcolor: 'rgba(245, 158, 11, 0.12)',
                    color: '#d97706',
                    border: '1px solid rgba(245, 158, 11, 0.25)'
                  }}
                />
                <Chip
                  label="Provider Agency"
                  size="small"
                  color="warning"
                  sx={{ fontWeight: 800, fontSize: '0.72rem', borderRadius: '8px', height: 24 }}
                />
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.6, flexWrap: 'wrap' }}>
                {provider.phone && (
                  <Box
                    component="span"
                    onClick={() => copyToClipboard(provider.phone, 'Phone')}
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      fontSize: '0.78rem',
                      color: 'text.secondary',
                      cursor: 'pointer',
                      '&:hover': { color: 'primary.main' }
                    }}
                  >
                    <PhoneIcon sx={{ fontSize: 13 }} />
                    {provider.phone}
                  </Box>
                )}
                {provider.email && (
                  <Box
                    component="span"
                    onClick={() => copyToClipboard(provider.email, 'Email')}
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      fontSize: '0.78rem',
                      color: 'text.secondary',
                      cursor: 'pointer',
                      '&:hover': { color: 'primary.main' }
                    }}
                  >
                    <EmailIcon sx={{ fontSize: 13 }} />
                    {provider.email}
                  </Box>
                )}
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <BusinessIcon sx={{ fontSize: 13 }} />
                  {apps.length} Managed Campaigns
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Action Hub Buttons */}
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<PrintIcon />}
              onClick={() => window.print()}
              sx={{
                borderRadius: '12px',
                textTransform: 'none',
                fontWeight: 750,
                fontSize: '0.82rem',
                borderWidth: '1.5px',
                px: 2
              }}
            >
              Print
            </Button>

            <Button
              variant="contained"
              size="small"
              color="primary"
              startIcon={downloadingPdf ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
              disabled={downloadingPdf}
              onClick={handleDownloadVectorPdf}
              sx={{
                borderRadius: '12px',
                textTransform: 'none',
                fontWeight: 800,
                fontSize: '0.82rem',
                px: 2.2,
                boxShadow: '0 4px 14px rgba(37,99,235,0.3)'
              }}
            >
              {downloadingPdf ? 'Exporting...' : 'PDF Bill'}
            </Button>

            <Button
              variant="contained"
              size="small"
              color={isFullyPaid ? 'success' : isPartiallyPaid ? 'warning' : 'success'}
              startIcon={<PaymentIcon />}
              disabled={isFullyPaid}
              onClick={handleOpenPayModal}
              sx={{
                borderRadius: '12px',
                textTransform: 'none',
                fontWeight: 800,
                fontSize: '0.82rem',
                px: 2.4,
                boxShadow: isFullyPaid ? 'none' : '0 4px 14px rgba(16,185,129,0.3)'
              }}
            >
              {isFullyPaid ? 'Settled (Paid)' : isPartiallyPaid ? `Settle Bal (${formatINR(remainingBalance)})` : 'Settle Payment'}
            </Button>
          </Stack>
        </Box>
      </Paper>

      {/* 2. BILLING MONTH & YEAR DROPDOWN SELECTOR */}
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4 }}>
            <Avatar sx={{ width: 38, height: 38, bgcolor: 'rgba(245, 158, 11, 0.12)', color: '#d97706' }}>
              <CalendarMonthIcon sx={{ fontSize: 22 }} />
            </Avatar>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.secondary', fontSize: '0.74rem' }}>
                Billing Cycle (Month & Year):
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Select invoice statement period grouped by App Release Date
              </Typography>
            </Box>
          </Box>

          {/* Month & Year Select Dropdown */}
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 380 } }}>
            <Select
              value={selectedMonth || ''}
              onChange={(e) => setSelectedMonth(e.target.value)}
              displayEmpty
              renderValue={(selected) => {
                if (!selected) return <span style={{ color: '#94a3b8' }}>Select Month & Year</span>;
                const mData = byMonth[selected] || {};
                return (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarTodayIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                      <Typography sx={{ fontWeight: 800, fontSize: '0.88rem', color: 'text.primary' }}>
                        {formatMonthTitle(selected)}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={`${mData.liveCount || 0} Live (${formatINR(mData.grossTotal || 0)})`}
                      color="primary"
                      sx={{ fontWeight: 800, fontSize: '0.72rem', height: 22, borderRadius: '6px' }}
                    />
                  </Box>
                );
              }}
              sx={{
                borderRadius: '14px',
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(30,41,59,0.7)' : '#f8fafc',
                fontWeight: 800,
                border: `1px solid ${theme.palette.divider}`,
                '& .MuiSelect-select': {
                  py: 1,
                  px: 1.8,
                  display: 'flex',
                  alignItems: 'center'
                }
              }}
            >
              {monthKeys.map((mk) => {
                const mData = byMonth[mk] || {};
                return (
                  <MenuItem
                    key={mk}
                    value={mk}
                    sx={{
                      py: 1.3,
                      px: 2,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 2
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                      <CalendarTodayIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                      <Typography sx={{ fontWeight: 800, fontSize: '0.88rem' }}>
                        {formatMonthTitle(mk)}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={`${mData.liveCount || 0} Live • ${formatINR(mData.grossTotal || 0)}`}
                      sx={{
                        fontWeight: 750,
                        fontSize: '0.72rem',
                        bgcolor: selectedMonth === mk ? 'primary.main' : 'rgba(100,116,139,0.1)',
                        color: selectedMonth === mk ? '#fff' : 'text.secondary',
                        borderRadius: '8px'
                      }}
                    />
                  </MenuItem>
                );
              })}
              {monthKeys.length === 0 && (
                <MenuItem value="" disabled>No billing cycles recorded</MenuItem>
              )}
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* 3. 4 EXECUTIVE FINTECH TELEMETRY KPI PODS */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        {/* Metric 1: Month Gross */}
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
                Gross Billed
              </Typography>
              <Avatar sx={{ width: 34, height: 34, bgcolor: 'rgba(37,99,235,0.12)', color: 'primary.main' }}>
                <ReceiptLongIcon sx={{ fontSize: 18 }} />
              </Avatar>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 900, color: 'text.primary', letterSpacing: '-0.02em' }}>
              {formatINR(grossTotal)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.6 }}>
              {currentMonthData.liveCount} verified live deliverables
            </Typography>
          </Paper>
        </Grid>

        {/* Metric 2: Paid Disbursed */}
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
                Paid / Disbursed
              </Typography>
              <Avatar sx={{ width: 34, height: 34, bgcolor: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                <CheckCircleIcon sx={{ fontSize: 18 }} />
              </Avatar>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 900, color: '#10b981', letterSpacing: '-0.02em' }}>
              {formatINR(totalPaidAmount)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.6 }}>
              {matchedPaymentTransactions.length} settlement transaction(s) recorded
            </Typography>
          </Paper>
        </Grid>

        {/* Metric 3: Outstanding Due */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '20px',
              border: `1.5px solid ${remainingBalance > 0.01 ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
              bgcolor: remainingBalance > 0.01
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
                  color: remainingBalance > 0.01 ? '#dc2626' : '#10b981',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em'
                }}
              >
                Outstanding Due
              </Typography>
              <Avatar
                sx={{
                  width: 34,
                  height: 34,
                  bgcolor: remainingBalance > 0.01 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                  color: remainingBalance > 0.01 ? '#dc2626' : '#10b981'
                }}
              >
                <AccountBalanceIcon sx={{ fontSize: 18 }} />
              </Avatar>
            </Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 900,
                color: remainingBalance > 0.01 ? '#dc2626' : '#10b981',
                letterSpacing: '-0.02em'
              }}
            >
              {formatINR(remainingBalance)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.6 }}>
              {isFullyPaid
                ? 'Fully settled & cleared'
                : isPartiallyPaid
                ? `Partial balance of ${formatINR(grossTotal)}`
                : 'Awaiting settlement payout'}
            </Typography>
          </Paper>
        </Grid>

        {/* Metric 4: Campaign Apps */}
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
                Campaign Apps
              </Typography>
              <Avatar sx={{ width: 34, height: 34, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f1f5f9', color: 'text.primary' }}>
                <VerifiedIcon sx={{ fontSize: 18 }} />
              </Avatar>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 900, color: 'text.primary', letterSpacing: '-0.02em' }}>
              {currentMonthApps.length} Apps
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.6 }}>
              {formatMonthTitle(selectedMonth)} operational cycle
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* 4. THE OFFICIAL CORPORATE PROVIDER BILL (CENTERPIECE DOCUMENT) */}
      <Box
        sx={{
          bgcolor: '#ffffff',
          color: '#0f172a',
          p: { xs: 2.5, sm: 4, md: 5 },
          borderRadius: '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 16px 48px rgba(15,23,42,0.06)',
          maxWidth: 1040,
          mx: 'auto',
          mb: 4,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        }}
      >
        {/* Bill Top Bar */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            pb: 3,
            borderBottom: '2px solid #f1f5f9',
            flexWrap: 'wrap',
            gap: 2
          }}
        >
          {/* Novaira Corporate Logo & Registered Entity */}
          <Box>
            <Box sx={{ mb: 1.5 }}>
              <Box
                component="img"
                src="/novaira_logo.jpg"
                alt="Novaira Business Solutions"
                sx={{
                  height: 54,
                  width: 'auto',
                  borderRadius: '12px',
                  objectFit: 'contain',
                  display: 'block',
                  boxShadow: '0 3px 10px rgba(0,0,0,0.08)'
                }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </Box>
            <Typography sx={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>
              <strong style={{ color: '#0f172a' }}>Novaira Global Business Solutions Pvt. Ltd.</strong><br />
              Corporate Treasury & Provider Sponsorship Desk<br />
              <b>Email:</b> support@payments.novairasolution.com | <b>Web:</b> novairasolution.com
            </Typography>
          </Box>

          {/* Bill Meta & Status */}
          <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
            <Typography sx={{ fontSize: '1.9rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1 }}>
              PROVIDER INVOICE
            </Typography>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                mt: 0.8,
                px: 1.2,
                py: 0.4,
                borderRadius: '8px',
                bgcolor: '#f1f5f9',
                cursor: 'pointer',
                '&:hover': { bgcolor: '#e2e8f0' }
              }}
              onClick={() => copyToClipboard(invoiceNumber, 'Invoice Number')}
            >
              <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.84rem', color: '#334155' }}>
                #{invoiceNumber}
              </Typography>
              <ContentCopyIcon sx={{ fontSize: 13, color: '#64748b' }} />
            </Box>

            <Box sx={{ mt: 1.5 }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.8,
                  bgcolor: isFullyPaid ? '#ecfdf5' : isPartiallyPaid ? '#fff7ed' : '#fffbeb',
                  color: isFullyPaid ? '#059669' : isPartiallyPaid ? '#ea580c' : '#d97706',
                  px: 1.8,
                  py: 0.5,
                  borderRadius: '100px',
                  border: '1px solid',
                  borderColor: isFullyPaid ? '#a7f3d0' : isPartiallyPaid ? '#fed7aa' : '#fde68a'
                }}
              >
                <CheckCircleIcon sx={{ fontSize: 15 }} />
                <Typography sx={{ fontWeight: 800, fontSize: '0.74rem', letterSpacing: '0.04em' }}>
                  {isFullyPaid
                    ? 'SETTLED & FULLY PAID'
                    : isPartiallyPaid
                    ? `PARTIALLY PAID (${formatINR(totalPaidAmount)})`
                    : 'PENDING DISBURSEMENT'}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Two-Column Information Cards */}
        <Grid container spacing={2.5} sx={{ py: 3, borderBottom: '1px solid #f1f5f9' }}>
          {/* Card 1: Billed To / Agency */}
          <Grid item xs={12} sm={6}>
            <Box sx={{ p: 2, borderRadius: '16px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0', height: '100%' }}>
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.8 }}>
                BILLED TO / AGENCY PARTNER
              </Typography>
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>
                {provider.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.4 }}>
                <Typography sx={{ fontSize: '0.8rem', color: '#475569', fontFamily: 'monospace', fontWeight: 700 }}>
                  ID: {provider.provider_id}
                </Typography>
                <IconButton size="small" onClick={() => copyToClipboard(provider.provider_id, 'Provider ID')} sx={{ p: 0.2 }}>
                  <ContentCopyIcon sx={{ fontSize: 12, color: '#94a3b8' }} />
                </IconButton>
              </Box>
              {provider.phone && (
                <Typography sx={{ fontSize: '0.8rem', color: '#475569', mt: 0.3 }}>
                  <b>Phone:</b> {provider.phone}
                </Typography>
              )}
              {provider.email && (
                <Typography sx={{ fontSize: '0.8rem', color: '#475569', mt: 0.2 }}>
                  <b>Email:</b> {provider.email}
                </Typography>
              )}
              <Typography sx={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 750, mt: 0.4 }}>
                <b>Account Class:</b> Agency Sponsor Account
              </Typography>
            </Box>
          </Grid>

          {/* Card 2: Settlement & Audit */}
          <Grid item xs={12} sm={6}>
            <Box sx={{ p: 2, borderRadius: '16px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0', height: '100%' }}>
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.8 }}>
                TREASURY SETTLEMENT & AUDIT
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', color: '#334155', mb: 0.4 }}>
                <b>Billing Cycle:</b> <span style={{ fontWeight: 800 }}>{formatMonthTitle(selectedMonth)}</span>
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', color: '#334155', mb: 0.4 }}>
                <b>Disbursement Method:</b> {paymentMethodLabels[activePaymentMethod] || activePaymentMethod}
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', color: '#334155', mb: 0.4 }}>
                <b>Disbursed So Far:</b> <span style={{ color: '#059669', fontWeight: 800 }}>{formatINR(totalPaidAmount)}</span>
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', color: '#334155', mb: 0.4, wordBreak: 'break-all' }}>
                <b>Bank Reference / UTR:</b>{' '}
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: totalPaidAmount > 0 ? '#2563eb' : '#64748b' }}>
                  {activePaymentUtr}
                </span>
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', color: '#334155' }}>
                <b>Disbursement Date(s):</b> {activePaymentDate}
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Itemized Deliverables Table Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3, mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
          <Typography sx={{ fontSize: '0.92rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.01em' }}>
            Itemized Campaign Deliverables — {formatMonthTitle(selectedMonth)}
          </Typography>
          <Chip
            size="small"
            label={`${currentMonthApps.length} Applications • ${currentMonthData.liveCount} Total Live Reviews`}
            sx={{ fontWeight: 750, fontSize: '0.72rem', bgcolor: '#f1f5f9', color: '#475569' }}
          />
        </Box>

        {/* Itemized Table with APP DATE */}
        <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', mb: 3 }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell align="center" sx={{ fontWeight: 850, fontSize: '0.74rem', color: '#475569', py: 1.4, width: '60px' }}>
                  NO.
                </TableCell>
                <TableCell sx={{ fontWeight: 850, fontSize: '0.74rem', color: '#475569', minWidth: '220px' }}>
                  APPLICATION NAME & TASK
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 850, fontSize: '0.74rem', color: '#475569', width: '130px' }}>
                  APP DATE
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 850, fontSize: '0.74rem', color: '#475569', width: '120px' }}>
                  LIVE REVIEWS
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 850, fontSize: '0.74rem', color: '#475569', width: '130px' }}>
                  SPONSOR RATE
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 850, fontSize: '0.74rem', color: '#475569', width: '140px' }}>
                  GROSS TOTAL (₹)
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentMonthApps.length > 0 ? (
                currentMonthApps.map((item, idx) => (
                  <TableRow
                    key={item.appId}
                    sx={{
                      '&:nth-of-type(even)': { bgcolor: '#fafafa' },
                      '&:hover': { bgcolor: '#f1f5f9' },
                      transition: 'background-color 0.15s'
                    }}
                  >
                    {/* Index */}
                    <TableCell align="center" sx={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 750, fontFamily: 'monospace' }}>
                      {String(idx + 1).padStart(2, '0')}
                    </TableCell>

                    {/* App Name & Task ID */}
                    <TableCell sx={{ py: 1.2 }}>
                      <Typography sx={{ fontSize: '0.86rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.3 }}>
                        {item.appName}
                      </Typography>
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, mt: 0.3 }}>
                        <Chip
                          label={`Task ID: #${item.taskId}`}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            borderRadius: '6px',
                            bgcolor: '#f1f5f9',
                            color: '#475569'
                          }}
                        />
                      </Box>
                    </TableCell>

                    {/* APP DATE */}
                    <TableCell align="center">
                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.6,
                          px: 1,
                          py: 0.35,
                          borderRadius: '8px',
                          bgcolor: item.appDate ? '#f1f5f9' : 'transparent',
                          border: item.appDate ? '1px solid #e2e8f0' : 'none'
                        }}
                      >
                        <CalendarTodayIcon sx={{ fontSize: 12, color: '#64748b' }} />
                        <Typography sx={{ fontSize: '0.76rem', fontWeight: 700, color: '#334155' }}>
                          {formatKolkataDate(item.appDate)}
                        </Typography>
                      </Box>
                    </TableCell>

                    {/* Live Reviews Count */}
                    <TableCell align="center">
                      <Chip
                        label={`${item.liveCount} Live`}
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          borderRadius: '8px',
                          bgcolor: item.liveCount > 0 ? '#ecfdf5' : '#f8fafc',
                          color: item.liveCount > 0 ? '#059669' : '#64748b',
                          border: `1px solid ${item.liveCount > 0 ? '#a7f3d0' : '#e2e8f0'}`
                        }}
                      />
                    </TableCell>

                    {/* Sponsor Rate */}
                    <TableCell align="right" sx={{ fontSize: '0.84rem', fontWeight: 700, color: '#475569' }}>
                      {formatINR(item.rate)}
                    </TableCell>

                    {/* Gross Total */}
                    <TableCell align="right" sx={{ fontSize: '0.9rem', fontWeight: 900, color: '#0f9d72' }}>
                      {formatINR(item.appTotal)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5, color: '#64748b', fontSize: '0.86rem' }}>
                    No verified campaign review submissions recorded for {formatMonthTitle(selectedMonth)}.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Calculation Summary Box */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
          <Box
            sx={{
              width: { xs: '100%', sm: 360 },
              p: 2.2,
              borderRadius: '16px',
              bgcolor: '#f8fafc',
              border: '1px solid #e2e8f0'
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
              <Typography sx={{ fontSize: '0.82rem', color: '#64748b' }}>Verified Deliverables:</Typography>
              <Typography sx={{ fontSize: '0.86rem', fontWeight: 800, color: '#0f172a' }}>
                {currentMonthData.liveCount} Reviews
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
              <Typography sx={{ fontSize: '0.82rem', color: '#64748b' }}>Month Gross Invoiced:</Typography>
              <Typography sx={{ fontSize: '0.92rem', fontWeight: 850, color: '#0f172a' }}>
                {formatINR(grossTotal)}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
              <Typography sx={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 700 }}>
                Disbursed / Paid So Far:
              </Typography>
              <Typography sx={{ fontSize: '0.92rem', fontWeight: 850, color: '#16a34a' }}>
                - {formatINR(totalPaidAmount)}
              </Typography>
            </Box>

            <Divider sx={{ my: 1.2, borderColor: '#cbd5e1' }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
              <Typography
                sx={{
                  fontSize: '0.95rem',
                  fontWeight: 900,
                  color: remainingBalance > 0.01 ? '#dc2626' : '#0f9d72'
                }}
              >
                {remainingBalance > 0.01 ? 'Outstanding Balance Due:' : 'Net Balance Due:'}
              </Typography>
              <Typography
                sx={{
                  fontSize: '1.25rem',
                  fontWeight: 900,
                  color: remainingBalance > 0.01 ? '#dc2626' : '#0f9d72'
                }}
              >
                {formatINR(remainingBalance)}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Compliance Footer */}
        <Box sx={{ p: 2, borderRadius: '14px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <Typography sx={{ fontSize: '0.72rem', color: '#64748b', lineHeight: 1.6 }}>
            <b>COMPLIANCE & LEGAL NOTICE:</b> This monthly statement is dynamically compiled from verified live reviews for applications sponsored by <b>{provider.name}</b> in Novaira Database. Disbursed via {paymentMethodLabels[activePaymentMethod] || activePaymentMethod} under reference/UTR <code>{activePaymentUtr}</code>. Valid as an authorized digital statement.
          </Typography>
        </Box>
      </Box>

      {/* 5. SETTLEMENT PAYMENT LEDGER */}
      {matchedPaymentTransactions.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 4,
            borderRadius: '24px',
            border: `1px solid ${theme.palette.divider}`,
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(15,23,42,0.6)' : '#ffffff'
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 850, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountBalanceIcon sx={{ color: '#10b981' }} />
            Settlement Payment Ledger ({matchedPaymentTransactions.length} Recorded)
          </Typography>

          <TableContainer sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: '16px', overflow: 'hidden' }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, fontSize: '0.74rem' }}>TRANSACTION ID / UTR</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: '0.74rem' }}>DATE</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: '0.74rem' }}>METHOD</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: '0.74rem' }}>SYNCED TO FUND</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.74rem' }}>AMOUNT</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {matchedPaymentTransactions.map((tx) => (
                  <TableRow key={tx.id || tx.transaction_id}>
                    <TableCell>
                      <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.82rem', color: 'primary.main' }}>
                        {tx.transaction_id}
                      </Typography>
                      {tx.utr_id && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontFamily: 'monospace' }}>
                          UTR: {tx.utr_id}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                      {formatKolkataDate(tx.created_at)}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>
                      {paymentMethodLabels[tx.payout_details?.payment_method] || tx.payout_details?.payment_method || 'Bank Transfer'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={tx.sync_to_company_fund ? 'Synced' : 'Provider Only'}
                        size="small"
                        color={tx.sync_to_company_fund ? 'success' : 'default'}
                        sx={{ height: 20, fontSize: '0.68rem', fontWeight: 800 }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 900, color: '#10b981', fontSize: '0.88rem' }}>
                      {formatINR(tx.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* 6. PAY / SETTLE INVOICE DIALOG MODAL (1 ROW - 2 COLUMN COLLAPSED NO-SCROLL LAYOUT) */}
      <Dialog
        open={payModalOpen}
        onClose={() => !paying && setPayModalOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{
          backdrop: {
            sx: {
              backdropFilter: 'blur(8px)',
              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(2, 6, 23, 0.65)' : 'rgba(15, 23, 42, 0.35)'
            }
          }
        }}
        PaperProps={{
          sx: {
            borderRadius: '24px',
            border: `1px solid ${theme.palette.divider}`,
            bgcolor: 'background.paper',
            p: 1,
            maxHeight: '94vh',
            overflow: 'hidden'
          }
        }}
      >
        <DialogTitle
          sx={{
            pb: 1,
            pt: 1.5,
            px: 2.5,
            fontWeight: 900,
            fontSize: '1.15rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                bgcolor: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <PaymentIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 850, lineHeight: 1.2 }}>
                Settle Provider Invoice
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Verify invoice dues and record official disbursement transaction
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={`CYCLE: ${formatMonthTitle(selectedMonth).toUpperCase()}`}
              size="small"
              sx={{
                fontWeight: 800,
                fontSize: '0.66rem',
                bgcolor: 'rgba(37, 99, 235, 0.12)',
                color: '#2563eb',
                border: '1px solid rgba(37, 99, 235, 0.25)'
              }}
            />
            <IconButton size="small" onClick={() => !paying && setPayModalOpen(false)}>
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: '10px !important', px: 2.5, pb: 1.5, overflowY: 'auto' }}>
          <Grid container spacing={2.5} alignItems="stretch">
            {/* LEFT COLUMN: AUDIT DOSSIER */}
            <Grid item xs={12} md={5}>
              <Box
                sx={{
                  height: '100%',
                  p: 2.2,
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor: theme.palette.mode === 'dark' ? 'rgba(37,99,235,0.25)' : 'rgba(37,99,235,0.2)',
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(37,99,235,0.05)' : 'rgba(37,99,235,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 2
                }}
              >
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.2 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 850,
                        color: 'primary.main',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        fontSize: '0.7rem'
                      }}
                    >
                      INVOICE AUDIT DOSSIER
                    </Typography>
                    <Chip
                      label={isFullyPaid ? 'FULLY PAID' : isPartiallyPaid ? 'PARTIAL DUE' : 'AWAITING PAYMENT'}
                      size="small"
                      color={isFullyPaid ? 'success' : isPartiallyPaid ? 'warning' : 'default'}
                      sx={{ height: 20, fontSize: '0.64rem', fontWeight: 800 }}
                    />
                  </Box>

                  <Box
                    sx={{
                      p: 1.2,
                      borderRadius: '10px',
                      bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#ffffff',
                      border: `1px solid ${theme.palette.divider}`,
                      mb: 1.8,
                      cursor: 'pointer',
                      '&:hover': { borderColor: 'primary.main' }
                    }}
                    onClick={() => copyToClipboard(invoiceNumber, 'Invoice Number')}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.66rem' }}>
                      INVOICE NUMBER
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.82rem', color: 'primary.main' }}>
                        #{invoiceNumber}
                      </Typography>
                      <ContentCopyIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.66rem' }}>
                        BENEFICIARY AGENCY
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 850 }}>
                        {provider.name}
                      </Typography>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', fontWeight: 700 }}>
                        {provider.provider_id}
                      </Typography>
                    </Box>

                    {provider.phone && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                        <PhoneIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>
                          {provider.phone}
                        </Typography>
                      </Box>
                    )}

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                      <VerifiedIcon sx={{ fontSize: 13, color: '#10b981' }} />
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                        {currentMonthData.liveCount} Deliverables &bull; {currentMonthApps.length} Campaigns
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <Box
                  sx={{
                    p: 1.8,
                    borderRadius: '14px',
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(15,23,42,0.6)' : '#ffffff',
                    border: `1px solid ${theme.palette.divider}`
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">Total Invoiced:</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 800 }}>{formatINR(grossTotal)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.8 }}>
                    <Typography variant="caption" sx={{ color: '#10b981' }}>Disbursed So Far:</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#10b981' }}>- {formatINR(totalPaidAmount)}</Typography>
                  </Box>
                  <Divider sx={{ my: 0.8, borderColor: theme.palette.divider }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 900, color: remainingBalance > 0.01 ? '#dc2626' : '#10b981' }}>
                      Outstanding Due:
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 900, color: remainingBalance > 0.01 ? '#dc2626' : '#10b981' }}>
                      {formatINR(remainingBalance)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Grid>

            {/* RIGHT COLUMN: DISBURSEMENT CONTROLS */}
            <Grid item xs={12} md={7}>
              <Stack spacing={1.8} sx={{ height: '100%', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.6 }}>
                  {/* Payout Amount */}
                  <TextField
                    label="Disbursement / Payout Amount (INR)"
                    type="number"
                    fullWidth
                    size="small"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    helperText={
                      remainingBalance > 0
                        ? `Net pending balance: ${formatINR(remainingBalance)}`
                        : 'Invoice is already settled in full'
                    }
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                      endAdornment: (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setPayAmount(String(remainingBalance > 0 ? remainingBalance : grossTotal))}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 800,
                            fontSize: '0.72rem',
                            py: 0.2,
                            px: 1,
                            minWidth: 'auto',
                            borderRadius: '8px'
                          }}
                        >
                          Full Balance
                        </Button>
                      )
                    }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
                  />

                  {/* Disbursement Channel */}
                  <TextField
                    select
                    label="Disbursement Channel / Method"
                    fullWidth
                    size="small"
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
                  >
                    <MenuItem value="DIRECT_BANK_TRANSFER">Direct Bank Transfer (IMPS/NEFT)</MenuItem>
                    <MenuItem value="UPI">UPI Auto-Settlement</MenuItem>
                    <MenuItem value="NEFT_RTGS">Corporate RTGS Settlement</MenuItem>
                    <MenuItem value="WALLET_TRANSFER">Novaira Pay Partner Wallet</MenuItem>
                  </TextField>

                  {/* Bank UTR */}
                  <TextField
                    label="Bank UTR / Transaction Reference Number"
                    fullWidth
                    size="small"
                    value={payUtr}
                    onChange={(e) => setPayUtr(e.target.value)}
                    placeholder="e.g. UTR982348123"
                    InputProps={{
                      endAdornment: (
                        <Button
                          size="small"
                          onClick={() => setPayUtr(`UTR-${Date.now().toString().slice(-6)}`)}
                          sx={{ textTransform: 'none', fontWeight: 750, fontSize: '0.7rem', minWidth: 'auto' }}
                        >
                          Auto UTR
                        </Button>
                      )
                    }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
                  />

                  {/* Notes */}
                  <TextField
                    label="Settlement Description / Note"
                    multiline
                    rows={2}
                    fullWidth
                    size="small"
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                    placeholder="Enter audit remarks or transaction description..."
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
                  />

                  {/* Sync to Company Fund */}
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.2,
                      borderRadius: '14px',
                      border: '1.5px solid',
                      borderColor: syncToCompanyFund ? 'rgba(37,99,235,0.3)' : theme.palette.divider,
                      bgcolor: syncToCompanyFund
                        ? theme.palette.mode === 'dark' ? 'rgba(37,99,235,0.08)' : 'rgba(37,99,235,0.04)'
                        : 'transparent'
                    }}
                  >
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={syncToCompanyFund}
                          onChange={(e) => setSyncToCompanyFund(e.target.checked)}
                          color="primary"
                          size="small"
                          sx={{ p: 0.5, mr: 0.5 }}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '0.82rem' }}>
                            Sync to Company Fund Transactions
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                            {syncToCompanyFund
                              ? '✅ Automatically logs outgoing payout in Company Treasury reserve ledger.'
                              : '❌ Only records in Provider ledger without affecting company funds.'}
                          </Typography>
                        </Box>
                      }
                      sx={{ m: 0, width: '100%' }}
                    />
                  </Paper>
                </Box>

                {/* Modal Action Buttons */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, pt: 1, borderTop: `1px solid ${theme.palette.divider}` }}>
                  <Button
                    onClick={() => setPayModalOpen(false)}
                    disabled={paying}
                    sx={{ borderRadius: '12px', fontWeight: 750, textTransform: 'none', px: 2.5 }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleExecutePayment}
                    variant="contained"
                    color="success"
                    disabled={paying}
                    startIcon={paying ? <CircularProgress size={16} color="inherit" /> : <PaymentIcon />}
                    sx={{
                      borderRadius: '12px',
                      fontWeight: 800,
                      textTransform: 'none',
                      px: 3.5,
                      py: 0.9,
                      boxShadow: '0 4px 14px rgba(16,185,129,0.3)'
                    }}
                  >
                    {paying ? 'Recording...' : 'Confirm & Disburse'}
                  </Button>
                </Box>
              </Stack>
            </Grid>
          </Grid>
        </DialogContent>
      </Dialog>

      {/* 7. FLOATING TOAST NOTIFICATION */}
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
