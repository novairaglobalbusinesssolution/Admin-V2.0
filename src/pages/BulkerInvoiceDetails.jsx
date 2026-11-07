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
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../supabaseClient';
import {
  getBulkerIdVariants,
  calculateBulkerFinances,
  formatINR,
  formatMonthTitle
} from '../utils/bulkerPaymentCalculations';

export default function BulkerInvoiceDetails() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { bulkerId: rawBulkerId } = useParams();
  const identifier = decodeURIComponent(rawBulkerId || '');

  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [bulker, setBulker] = useState(null);
  const [billingHistory, setBillingHistory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [appsMap, setAppsMap] = useState({});

  // Active month for invoice display (YYYY-MM format)
  const [selectedMonth, setSelectedMonth] = useState('');

  // Pay Invoice Modal State
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

  const fetchBulkerAndInvoices = async () => {
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

      // 2. Fetch billing history, transactions, apps, and reviews
      const targetVariants = getBulkerIdVariants(bData?.bulker_id || identifier);

      const [histRes, txRes, appsRes] = await Promise.all([
        supabase
          .from('bulker_billing_history')
          .select('*')
          .in('bulker_id', targetVariants)
          .order('change_date_time', { ascending: true }),
        supabase
          .from('individual_wallet_transactions')
          .select('*')
          .in('earner_id', targetVariants)
          .order('created_at', { ascending: false }),
        supabase
          .from('apps')
          .select('id, app_name, task_id, members_reward, assigned_bulkers, app_date, created_at')
          .range(0, 4999)
      ]);

      // Fetch all reviews for this bulker without 1000 row truncation limit
      let allBulkerReviews = [];
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
          console.error('Error fetching bulker reviews:', revErr);
          break;
        }

        allBulkerReviews = allBulkerReviews.concat(revPage || []);
        if (!revPage || revPage.length < revStep) break;
        revFrom += revStep;
      }

      setBillingHistory(histRes.data || []);
      setTransactions(txRes.data || []);
      setReviews(allBulkerReviews);

      const aMap = {};
      (appsRes.data || []).forEach((app) => {
        aMap[app.id] = app;
      });
      setAppsMap(aMap);
    } catch (err) {
      console.error('Failed to load bulker details:', err);
      showToast('error', 'Failed to Load', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBulkerAndInvoices();
  }, [identifier]);

  // Calculate monthly invoice metrics
  const calculatedFinances = useMemo(() => {
    return calculateBulkerFinances({
      bulker,
      billingHistory,
      transactions,
      reviews,
      appsMap
    });
  }, [bulker, billingHistory, transactions, reviews, appsMap]);

  const { invoices } = calculatedFinances;

  // Auto-select latest month if not chosen or if previous selection is no longer valid
  useEffect(() => {
    if (invoices.monthKeys.length > 0) {
      if (!selectedMonth || !invoices.monthKeys.includes(selectedMonth)) {
        setSelectedMonth(invoices.monthKeys[0]);
      }
    }
  }, [invoices.monthKeys, selectedMonth]);

  const currentMonthData = invoices.byMonth[selectedMonth] || {
    monthKey: selectedMonth,
    grossTotal: 0,
    liveCount: 0,
    apps: {}
  };

  const currentMonthApps = Object.values(currentMonthData.apps);

  // Corporate invoice header details
  const cleanBulkerCode = (bulker?.bulker_id || identifier || 'AP723').replace(/[^a-zA-Z0-9]/g, '');
  const invoiceNumber = `NV-BLK-INV-${(selectedMonth || '2026-10').replace('-', '')}-${cleanBulkerCode}`;

  const paymentMethodLabels = {
    DIRECT_BANK_TRANSFER: 'Direct Bank Transfer (IMPS/NEFT)',
    UPI: 'UPI Auto-Settlement',
    NEFT_RTGS: 'Corporate RTGS Settlement',
    WALLET_TRANSFER: 'Novaira Pay Wallet Payout'
  };

  // Find all actual payments recorded in database for this specific invoice/month
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

  // Aggregate paid amount across all payments for this invoice
  const totalPaidAmount = useMemo(() => {
    return matchedPaymentTransactions.reduce((acc, tx) => acc + (parseFloat(tx.amount) || 0), 0);
  }, [matchedPaymentTransactions]);

  const grossTotal = currentMonthData.grossTotal || 0;
  const remainingBalance = Math.max(0, grossTotal - totalPaidAmount);
  const isFullyPaid = grossTotal > 0 && remainingBalance <= 0.01;
  const isPartiallyPaid = totalPaidAmount > 0 && remainingBalance > 0.01;
  const isUnpaid = totalPaidAmount === 0;

  // Active Payment Status string
  const activePaymentStatus = isFullyPaid ? 'PAID' : isPartiallyPaid ? 'PARTIAL' : 'PENDING';

  // Collect all UTR / transaction IDs
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
    : 'Awaiting Payment';

  const handleOpenPayModal = () => {
    const defaultPayAmount = remainingBalance > 0 ? remainingBalance : grossTotal;
    setPayAmount(defaultPayAmount > 0 ? String(defaultPayAmount) : '');
    setPayMethod('DIRECT_BANK_TRANSFER');
    setPayUtr(`UTR-${Date.now().toString().slice(-6)}`);
    setPayNote(
      isPartiallyPaid
        ? `Partial settlement for ${formatMonthTitle(selectedMonth)} bulker invoice (${invoiceNumber})`
        : `Settlement for ${formatMonthTitle(selectedMonth)} bulker invoice (${invoiceNumber})`
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
      const bulkerCode = bulker?.bulker_id || identifier;
      const bulkerUuid = bulker?.id;
      const generatedTrxId = `INV-PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // 1. Insert into individual_wallet_transactions as Bulker Payout (Debit)
      const payoutDetails = {
        bulker_id: bulkerCode,
        bulker_uuid: bulkerUuid,
        bulker_name: bulker?.full_name,
        invoice_number: invoiceNumber,
        billing_month: selectedMonth,
        payment_method: payMethod,
        utr_number: payUtr || null,
        synced_to_company_fund: Boolean(syncToCompanyFund),
        processed_by: 'Admin Treasury Desk'
      };

      const walletPayload = {
        transaction_id: generatedTrxId,
        earner_id: bulkerCode,
        amount: numAmt,
        transaction_type: 'Debit',
        description: payNote || `Invoice settlement for ${formatMonthTitle(selectedMonth)}`,
        status: 'Completed',
        utr_id: payUtr || null,
        payout_details: payoutDetails,
        sync_to_company_fund: Boolean(syncToCompanyFund)
      };

      const { error: wErr } = await supabase
        .from('individual_wallet_transactions')
        .insert(walletPayload);

      if (wErr) {
        console.error('Wallet transaction insert error:', wErr);
        throw wErr;
      }

      // 2. If syncToCompanyFund is false, ensure trigger insertion is cleaned up from company_fund_transactions
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
        `Invoice ${invoiceNumber} settled with ₹${numAmt.toFixed(2)}${syncToCompanyFund ? ' (Synced to Company Fund)' : ''}.`
      );

      // Refresh data
      await fetchBulkerAndInvoices();
    } catch (err) {
      console.error('Payment error:', err);
      showToast('error', 'Payment Failed', err.message);
    } finally {
      setPaying(false);
    }
  };

  // Helper: Load logo image as base64 for jsPDF
  const getLogoBase64 = () => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = '/novaira_logo.jpg';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg'));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
    });
  };

  // Direct Programmatic Vector A4 PDF Bill Generation
  const handleDownloadVectorPdf = async () => {
    setDownloadingPdf(true);
    showToast('success', 'Generating PDF...', 'Compiling vector A4 corporate bill.');

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
      const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
      const margin = 14;

      // 1. Try embedding the Logo
      const logoData = await getLogoBase64();
      if (logoData) {
        try {
          doc.addImage(logoData, 'JPEG', margin, 12, 22, 22);
        } catch (e) {
          console.warn('Logo embed error:', e);
        }
      }

      // 2. Company Header Text
      const textLeft = logoData ? margin + 26 : margin;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text('NOVAIRA', textLeft, 17);

      doc.setFontSize(8);
      doc.setTextColor(37, 99, 235);
      doc.text('GLOBAL BUSINESS SOLUTIONS', textLeft, 21);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('Novaira Global Business Solutions Pvt. Ltd.', textLeft, 26);
      doc.text('Email: support@payments.novairasolution.com  |  Web: novairasolution.com', textLeft, 30);

      // 3. Invoice Title & Meta (Right aligned)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);
      doc.text('BULKER INVOICE', pageWidth - margin, 18, { align: 'right' });

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

      // 4. Billed To & Payment Details Boxes (Two columns)
      const colWidth = (pageWidth - margin * 2 - 8) / 2;
      const boxY = 42;

      // Left Box: Billed To
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, boxY, colWidth, 42, 2, 2, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, boxY, colWidth, 42, 2, 2, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('BILLED TO / BULKER DESK PARTNER', margin + 4, boxY + 6);

      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(bulker?.full_name || 'Bulker Desk Partner', margin + 4, boxY + 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(`Bulker ID: ${bulker?.bulker_id || identifier}`, margin + 4, boxY + 17);
      if (bulker?.phone) doc.text(`Phone: ${bulker.phone}`, margin + 4, boxY + 22);
      if (bulker?.email) doc.text(`Email: ${bulker.email}`, margin + 4, boxY + 27);
      doc.text(`Account Mode: ${bulker?.account_type || 'Manual Mode'}`, margin + 4, boxY + 32);

      // Right Box: Payment Status & Settlement
      const rightBoxX = margin + colWidth + 8;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(rightBoxX, boxY, colWidth, 42, 2, 2, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(rightBoxX, boxY, colWidth, 42, 2, 2, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('DATABASE SETTLEMENT & UTR DETAILS', rightBoxX + 4, boxY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(`Billing Cycle: ${formatMonthTitle(selectedMonth)}`, rightBoxX + 4, boxY + 12);
      doc.text(`Disbursed / Paid: ₹${totalPaidAmount.toFixed(2)}  (Bal: ₹${remainingBalance.toFixed(2)})`, rightBoxX + 4, boxY + 17);
      doc.text(`Payment Status: ${isFullyPaid ? 'FULLY PAID' : isPartiallyPaid ? 'PARTIALLY PAID' : 'PENDING'}`, rightBoxX + 4, boxY + 22);
      doc.text(`Payment Method: ${paymentMethodLabels[activePaymentMethod] || activePaymentMethod}`, rightBoxX + 4, boxY + 27);
      doc.text(`Payment Date(s): ${activePaymentDate}`, rightBoxX + 4, boxY + 32);
      doc.text(`UTR / Ref: ${activePaymentUtr}`, rightBoxX + 4, boxY + 37);

      // 5. Itemized Table with APP DATE column
      const tableRows = currentMonthApps.map((item, idx) => [
        String(idx + 1).padStart(2, '0'),
        `${item.appName}\nTask ID: #${item.taskId}`,
        formatKolkataDate(item.appDate),
        String(item.liveCount),
        `₹${parseFloat(item.assignedAmount || 0).toFixed(2)}`,
        `₹${parseFloat(item.appTotal || 0).toFixed(2)}`
      ]);

      if (tableRows.length === 0) {
        tableRows.push(['01', `Bulker Desk Operations (${formatMonthTitle(selectedMonth)})`, '—', '1', `₹${currentMonthData.grossTotal.toFixed(2)}`, `₹${currentMonthData.grossTotal.toFixed(2)}`]);
      }

      autoTable(doc, {
        startY: 90,
        margin: { left: margin, right: margin },
        head: [['NO.', 'APPLICATION / CAMPAIGN', 'APP DATE', 'LIVE REVIEWS', 'ASSIGNED RATE (INR)', 'GROSS TOTAL (INR)']],
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

      // 6. Summary Totals Box
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
      doc.text('Total Verified Live Reviews:', totalBoxX + 4, finalY + 6);
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

      // 7. Terms & Compliance Note Box
      const notesY = Math.max(finalY + 40, doc.lastAutoTable.finalY + 42);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, notesY, pageWidth - margin * 2, 22, 2, 2, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, notesY, pageWidth - margin * 2, 22, 2, 2, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text('TERMS & SETTLEMENT COMPLIANCE STATEMENT:', margin + 4, notesY + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text(
        '1. This monthly bill is dynamically computed under Manual Billing mode based on live verified reviews.\n' +
        `2. Disbursed via ${paymentMethodLabels[activePaymentMethod] || activePaymentMethod} with reference/UTR: ${activePaymentUtr}.\n` +
        '3. This is an authenticated, tamper-proof corporate statement generated by Novaira Business Solutions V2.1.',
        margin + 4,
        notesY + 10
      );

      // 8. Signatory & Authenticity Seal (Bottom)
      const sigY = pageHeight - 26;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, sigY, pageWidth - margin, sigY);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text('Authenticated computer-generated invoice document. Valid without physical signature.', margin, sigY + 6);
      doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, margin, sigY + 10);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('AUTHORIZED SIGNATORY', pageWidth - margin, sigY + 6, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('Novaira Global Business Solutions Pvt. Ltd.', pageWidth - margin, sigY + 10, { align: 'right' });

      // Save PDF file
      const fileName = `Novaira_Invoice_${cleanBulkerCode}_${selectedMonth || 'Statement'}.pdf`;
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
          Compiling Bulker Invoice Records...
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Auditing multi-database verified deliverables and billing cycles.
        </Typography>
      </Box>
    );
  }

  if (!bulker) {
    return (
      <Box sx={{ p: 6, textAlign: 'center', maxWidth: 640, mx: 'auto' }}>
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>Bulker Partner Desk Not Found</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Could not locate any active bulker desk matching identifier "{identifier}".
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate('/payments/bulkers/invoices')}
          sx={{ borderRadius: '12px', fontWeight: 800, textTransform: 'none' }}
        >
          Return to Bulker Invoices
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
          {/* Bulker Identity Profile */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/payments/bulkers/invoices')}
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
              Invoices
            </Button>

            <Avatar
              sx={{
                width: 52,
                height: 52,
                fontSize: '1.25rem',
                fontWeight: 900,
                bgcolor: '#2563eb',
                boxShadow: '0 4px 14px rgba(37,99,235,0.3)'
              }}
            >
              {(bulker.full_name || 'B').charAt(0).toUpperCase()}
            </Avatar>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.02em', color: 'text.primary' }}>
                  {bulker.full_name}
                </Typography>
                <Chip
                  icon={<VerifiedIcon sx={{ fontSize: '14px !important', color: '#2563eb !important' }} />}
                  label={bulker.bulker_id}
                  size="small"
                  onClick={() => copyToClipboard(bulker.bulker_id, 'Bulker ID')}
                  clickable
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    borderRadius: '8px',
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(37,99,235,0.15)' : '#eff6ff',
                    color: '#2563eb',
                    border: '1px solid rgba(37,99,235,0.2)'
                  }}
                />
                <Chip
                  label={bulker.account_type === 'Manual' ? 'Manual Invoice Mode' : 'Wallet Mode'}
                  size="small"
                  color={bulker.account_type === 'Manual' ? 'warning' : 'primary'}
                  sx={{ fontWeight: 800, fontSize: '0.72rem', borderRadius: '8px', height: 24 }}
                />
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.6, flexWrap: 'wrap' }}>
                {bulker.phone && (
                  <Box
                    component="span"
                    onClick={() => copyToClipboard(bulker.phone, 'Phone')}
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
                    {bulker.phone}
                  </Box>
                )}
                {bulker.email && (
                  <Box
                    component="span"
                    onClick={() => copyToClipboard(bulker.email, 'Email')}
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
                    {bulker.email}
                  </Box>
                )}
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <BusinessIcon sx={{ fontSize: 13 }} />
                  Treasury Desk Partner
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Action Hub Buttons */}
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AccountBalanceWalletIcon />}
              onClick={() => navigate(`/payments/bulkers/wallet/${encodeURIComponent(bulker.id || bulker.bulker_id)}`)}
              sx={{
                borderRadius: '12px',
                textTransform: 'none',
                fontWeight: 750,
                fontSize: '0.82rem',
                borderWidth: '1.5px',
                px: 2
              }}
            >
              Wallet Ledger
            </Button>

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

      {/* 2. BILLING MONTH STRIP SELECTOR */}
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <CalendarMonthIcon sx={{ color: 'primary.main', fontSize: 22 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' }}>
              Billing Cycles:
            </Typography>
          </Box>

          {/* Quick Month Switcher Pills */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', flex: 1, justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
            {invoices.monthKeys.map((mk) => {
              const mData = invoices.byMonth[mk] || {};
              const isSelected = selectedMonth === mk;
              return (
                <Chip
                  key={mk}
                  clickable
                  onClick={() => setSelectedMonth(mk)}
                  variant={isSelected ? 'filled' : 'outlined'}
                  color={isSelected ? 'primary' : 'default'}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, py: 0.2 }}>
                      <span style={{ fontWeight: isSelected ? 800 : 700 }}>
                        {formatMonthTitle(mk)}
                      </span>
                      <span style={{ opacity: 0.75, fontSize: '0.72rem' }}>
                        • {mData.liveCount || 0} Live ({formatINR(mData.grossTotal || 0)})
                      </span>
                    </Box>
                  }
                  sx={{
                    borderRadius: '12px',
                    height: 32,
                    fontWeight: 750,
                    borderWidth: isSelected ? '1.5px' : '1px',
                    boxShadow: isSelected ? '0 3px 10px rgba(37,99,235,0.25)' : 'none'
                  }}
                />
              );
            })}
            {invoices.monthKeys.length === 0 && (
              <Typography variant="caption" color="text.secondary">
                No manual invoice billing cycles recorded yet.
              </Typography>
            )}
          </Box>
        </Box>
      </Paper>

      {/* 3. 4 EXECUTIVE FINTECH TELEMETRY KPI PODS */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        {/* Metric 1: Gross Total */}
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
                Gross Invoiced
              </Typography>
              <Avatar sx={{ width: 34, height: 34, bgcolor: 'rgba(37,99,235,0.12)', color: 'primary.main' }}>
                <ReceiptLongIcon sx={{ fontSize: 18 }} />
              </Avatar>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 900, color: 'text.primary', letterSpacing: '-0.02em' }}>
              {formatINR(grossTotal)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.6 }}>
              {currentMonthData.liveCount} live verified deliverables
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

        {/* Metric 4: Deliverables & Campaigns */}
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
                Active Campaigns
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

      {/* 4. THE OFFICIAL CORPORATE BULKER INVOICE (CENTERPIECE DOCUMENT) */}
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
        {/* Invoice Top Bar */}
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
              Corporate Treasury & Bulker Operations Desk<br />
              <b>Email:</b> support@payments.novairasolution.com | <b>Web:</b> novairasolution.com
            </Typography>
          </Box>

          {/* Invoice Document Meta & Status */}
          <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
            <Typography sx={{ fontSize: '1.9rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1 }}>
              BULKER INVOICE
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

        {/* Invoice Two-Column Information Cards */}
        <Grid container spacing={2.5} sx={{ py: 3, borderBottom: '1px solid #f1f5f9' }}>
          {/* Card 1: Billed To / Partner */}
          <Grid item xs={12} sm={6}>
            <Box sx={{ p: 2, borderRadius: '16px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0', height: '100%' }}>
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.8 }}>
                BILLED TO / DESK OPERATOR
              </Typography>
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>
                {bulker.full_name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.4 }}>
                <Typography sx={{ fontSize: '0.8rem', color: '#475569', fontFamily: 'monospace', fontWeight: 700 }}>
                  ID: {bulker.bulker_id}
                </Typography>
                <IconButton size="small" onClick={() => copyToClipboard(bulker.bulker_id, 'Bulker ID')} sx={{ p: 0.2 }}>
                  <ContentCopyIcon sx={{ fontSize: 12, color: '#94a3b8' }} />
                </IconButton>
              </Box>
              {bulker.phone && (
                <Typography sx={{ fontSize: '0.8rem', color: '#475569', mt: 0.3 }}>
                  <b>Phone:</b> {bulker.phone}
                </Typography>
              )}
              {bulker.email && (
                <Typography sx={{ fontSize: '0.8rem', color: '#475569', mt: 0.2 }}>
                  <b>Email:</b> {bulker.email}
                </Typography>
              )}
              <Typography sx={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 750, mt: 0.4 }}>
                <b>Billing Framework:</b> Manual Review Verification
              </Typography>
            </Box>
          </Grid>

          {/* Card 2: Settlement & Audit Details */}
          <Grid item xs={12} sm={6}>
            <Box sx={{ p: 2, borderRadius: '16px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0', height: '100%' }}>
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.8 }}>
                TREASURY SETTLEMENT & AUDIT
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', color: '#334155', mb: 0.4 }}>
                <b>Billing Cycle:</b> <span style={{ fontWeight: 800 }}>{formatMonthTitle(selectedMonth)}</span>
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', color: '#334155', mb: 0.4 }}>
                <b>Settlement Method:</b> {paymentMethodLabels[activePaymentMethod] || activePaymentMethod}
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

        {/* Itemized Applications Table Header */}
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

        {/* ITEMIZED TABLE WITH APP DATE COLUMN */}
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
                  ASSIGNED RATE
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

                    {/* APP DATE (Requested by User) */}
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
                          bgcolor: '#ecfdf5',
                          color: '#059669',
                          border: '1px solid #a7f3d0'
                        }}
                      />
                    </TableCell>

                    {/* Assigned Rate */}
                    <TableCell align="right" sx={{ fontSize: '0.84rem', fontWeight: 700, color: '#475569' }}>
                      {formatINR(item.assignedAmount)}
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
                    No verified manual review submissions recorded for {formatMonthTitle(selectedMonth)}.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Invoice Summary Calculation Panel */}
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

        {/* Corporate Authenticity & Compliance Statement */}
        <Box sx={{ p: 2, borderRadius: '14px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <Typography sx={{ fontSize: '0.72rem', color: '#64748b', lineHeight: 1.6 }}>
            <b>COMPLIANCE & LEGAL NOTICE:</b> This monthly bill statement is dynamically compiled from verified live reviews logged under <b>Manual Review Billing</b> in Novaira Database. Disbursed via {paymentMethodLabels[activePaymentMethod] || activePaymentMethod} under reference/UTR <code>{activePaymentUtr}</code>. Valid as an authorized digital statement.
          </Typography>
        </Box>
      </Box>

      {/* 5. DATABASE SETTLEMENT TRANSACTIONS TIMELINE (IF RECORDED) */}
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
                        label={tx.sync_to_company_fund ? 'Synced' : 'Bulker Only'}
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

      {/* 6. PAY / SETTLE INVOICE DIALOG MODAL */}
      <Dialog
        open={payModalOpen}
        onClose={() => !paying && setPayModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '24px',
            p: 1.5,
            border: `1px solid ${theme.palette.divider}`
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 900, fontSize: '1.2rem', pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PaymentIcon sx={{ color: 'primary.main' }} />
          Settle Bulker Invoice
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: theme.palette.divider }}>
          <Stack spacing={2.4} sx={{ mt: 1 }}>
            {/* Invoice Overview Pill */}
            <Box
              sx={{
                p: 2,
                borderRadius: '16px',
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(37,99,235,0.08)' : '#eff6ff',
                border: '1px solid rgba(37,99,235,0.2)'
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 900, color: 'primary.main', display: 'block', letterSpacing: '0.04em' }}>
                INVOICE #{invoiceNumber}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.3, color: 'text.primary' }}>
                {bulker.full_name} ({bulker.bulker_id}) &bull; Cycle: {formatMonthTitle(selectedMonth)}
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5, pt: 1.2, borderTop: '1px dashed rgba(37,99,235,0.25)' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Total Bill: <strong>{formatINR(grossTotal)}</strong>
                </Typography>
                <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 800 }}>
                  Paid: {formatINR(totalPaidAmount)}
                </Typography>
                <Typography variant="caption" sx={{ color: '#dc2626', fontWeight: 900 }}>
                  Remaining: {formatINR(remainingBalance)}
                </Typography>
              </Box>
            </Box>

            {/* Payout Amount */}
            <TextField
              label="Payout Amount (INR)"
              type="number"
              fullWidth
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              helperText={
                remainingBalance > 0
                  ? `Remaining unpaid balance: ${formatINR(remainingBalance)}`
                  : 'Invoice is already fully settled'
              }
              InputProps={{
                startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                endAdornment: (
                  <Button
                    size="small"
                    onClick={() => setPayAmount(String(remainingBalance))}
                    sx={{ textTransform: 'none', fontWeight: 800, fontSize: '0.72rem' }}
                  >
                    Full Due
                  </Button>
                )
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
            />

            {/* Disbursement Method */}
            <TextField
              select
              label="Disbursement Method"
              fullWidth
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
            >
              <MenuItem value="DIRECT_BANK_TRANSFER">Direct Bank Transfer (IMPS/NEFT)</MenuItem>
              <MenuItem value="UPI">UPI Auto-Settlement</MenuItem>
              <MenuItem value="NEFT_RTGS">Corporate RTGS Settlement</MenuItem>
              <MenuItem value="WALLET_TRANSFER">Novaira Pay Bulker Wallet</MenuItem>
            </TextField>

            {/* Bank UTR / Reference */}
            <TextField
              label="Bank UTR / Transaction Reference"
              fullWidth
              value={payUtr}
              onChange={(e) => setPayUtr(e.target.value)}
              placeholder="e.g. UTR982348123"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
            />

            {/* Payment Note */}
            <TextField
              label="Payment Description / Notes"
              multiline
              rows={2}
              fullWidth
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
            />

            {/* Sync to Company Fund Checkbox */}
            <Paper
              elevation={0}
              sx={{
                p: 1.8,
                borderRadius: '16px',
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
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 800 }}>
                      Sync to Company Fund Transactions
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2 }}>
                      {syncToCompanyFund
                        ? '✅ Transaction will be automatically logged in Company Fund ledger as an outgoing treasury payout.'
                        : '❌ Transaction will ONLY be recorded in Bulker Ledger without modifying company reserve fund.'}
                    </Typography>
                  </Box>
                }
              />
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button
            onClick={() => setPayModalOpen(false)}
            disabled={paying}
            sx={{ borderRadius: '12px', fontWeight: 750, textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExecutePayment}
            variant="contained"
            color="success"
            disabled={paying}
            sx={{
              borderRadius: '12px',
              fontWeight: 800,
              textTransform: 'none',
              px: 3.5,
              py: 1,
              boxShadow: '0 4px 14px rgba(16,185,129,0.3)'
            }}
          >
            {paying ? 'Recording...' : 'Confirm & Disburse Payment'}
          </Button>
        </DialogActions>
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
