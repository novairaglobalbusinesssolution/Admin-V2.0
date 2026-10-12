import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Card, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField,
  MenuItem, Button, IconButton, Chip, Avatar, Stack, CircularProgress,
  Divider, useTheme, Snackbar, FormControl, Select, Dialog,
  DialogTitle, DialogContent, DialogActions, Checkbox, FormControlLabel,
  InputAdornment
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CloseIcon from '@mui/icons-material/Close';
import PrintIcon from '@mui/icons-material/Print';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PaymentIcon from '@mui/icons-material/Payment';
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

  // Pay Invoice Modal State (Wallet Transaction & Company Fund Sync Option)
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

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast('success', 'Copied!', text);
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

      // 2. Fetch billing history, reviews, apps, and transactions
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
          .select('id, app_name, task_id, members_reward, assigned_bulkers')
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

  // Calculate monthly invoice metrics using exact formula
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

  // Auto-select latest month if not chosen
  useEffect(() => {
    if (!selectedMonth && invoices.monthKeys.length > 0) {
      setSelectedMonth(invoices.monthKeys[0]);
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
  const isInvoicePaid = isFullyPaid; // For backward compatibility where needed

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
        .map((tx) => (tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-IN') : ''))
        .filter(Boolean)
        .join(', ')
    : 'Awaiting Payment';

  const handleOpenPayModal = () => {
    // Default payout amount to the remaining balance (if any) or full gross total
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
        processed_by: 'Admin Portal'
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

      // 2. If syncToCompanyFund is false, ensure any trigger insertion is cleaned up from company_fund_transactions
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

  // Direct Programmatic Vector A4 PDF Bill Generation (No screenshots or print preview)
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

      // 1. Try embedding the Mandala Logo
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

      // Left Box: Billed To (Bulker Details)
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

      // Right Box: Payment Status & Transaction Details (Dynamic from DB)
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

      // 5. Itemized Table of Applications (Using autoTable)
      const tableRows = currentMonthApps.map((item, idx) => [
        String(idx + 1).padStart(2, '0'),
        `${item.appName}\nTask ID: #${item.taskId}`,
        String(item.liveCount),
        `₹${parseFloat(item.assignedAmount || 0).toFixed(2)}`,
        `₹${parseFloat(item.appTotal || 0).toFixed(2)}`
      ]);

      if (tableRows.length === 0) {
        tableRows.push(['01', `Bulker Desk Operations (${formatMonthTitle(selectedMonth)})`, '1', `₹${currentMonthData.grossTotal.toFixed(2)}`, `₹${currentMonthData.grossTotal.toFixed(2)}`]);
      }

      autoTable(doc, {
        startY: 90,
        margin: { left: margin, right: margin },
        head: [['NO.', 'APPLICATION / CAMPAIGN', 'LIVE REVIEWS', 'ASSIGNED RATE (INR)', 'GROSS TOTAL (INR)']],
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
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 'auto', fontStyle: 'bold' },
          2: { cellWidth: 26, halign: 'center', fontStyle: 'bold', textColor: [5, 150, 105] },
          3: { cellWidth: 36, halign: 'right' },
          4: { cellWidth: 38, halign: 'right', fontStyle: 'bold', textColor: [15, 157, 114] }
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        }
      });

      // 6. Summary Totals Box
      const finalY = (doc).lastAutoTable.finalY + 6;
      const totalBoxWidth = 86;
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
      const notesY = Math.max(finalY + 40, (doc).lastAutoTable.finalY + 42);
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
      <Box sx={{ p: 6, textAlign: 'center', maxWidth: 1200, mx: 'auto' }}>
        <CircularProgress size={44} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Calculating bulker invoice records...
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
      {/* Top Header */}
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
              <Chip
                label={bulker.account_type || 'Wallet System'}
                size="small"
                color={bulker.account_type === 'Manual' ? 'warning' : 'primary'}
                sx={{ fontWeight: 800, fontSize: '0.72rem', borderRadius: '8px' }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              Bulker Desk Settlement & Official Monthly Bill Statement
            </Typography>
          </Box>
        </Box>

        {/* Action Controls */}
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant="outlined"
            startIcon={<AccountBalanceWalletIcon />}
            onClick={() => navigate(`/payments/bulkers/wallet/${encodeURIComponent(bulker.id || bulker.bulker_id)}`)}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
          >
            View Wallet
          </Button>

          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={() => window.print()}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
          >
            Print
          </Button>

          <Button
            variant="contained"
            color={isFullyPaid ? 'inherit' : isPartiallyPaid ? 'warning' : 'success'}
            startIcon={<PaymentIcon />}
            disabled={isFullyPaid}
            onClick={handleOpenPayModal}
            sx={{
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 800,
              px: 2.5,
              boxShadow: isFullyPaid ? 'none' : '0 4px 14px rgba(16,185,129,0.3)'
            }}
          >
            {isFullyPaid ? 'Invoice Settled' : isPartiallyPaid ? `Pay Remaining (${formatINR(remainingBalance)})` : 'Pay Invoice'}
          </Button>

          <Button
            variant="contained"
            color="primary"
            startIcon={downloadingPdf ? <CircularProgress size={18} color="inherit" /> : <DownloadIcon />}
            disabled={downloadingPdf}
            onClick={handleDownloadVectorPdf}
            sx={{
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 800,
              px: 2.8,
              boxShadow: '0 4px 14px rgba(37,99,235,0.3)'
            }}
          >
            {downloadingPdf ? 'Exporting PDF...' : 'Download Invoice PDF'}
          </Button>
        </Stack>
      </Box>

      {/* PAYMENT CONTROLS & MONTH SELECTOR TOOLBAR */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 3.5,
          borderRadius: '20px',
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(15,23,42,0.6)'
        }}
      >
        <Grid container spacing={2.5} alignItems="center">
          {/* Month Selector */}
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 0.6 }}>
              BILLING MONTH:
            </Typography>
            <FormControl size="small" fullWidth>
              <Select
                value={selectedMonth || ''}
                onChange={(e) => setSelectedMonth(e.target.value)}
                sx={{ borderRadius: '14px', fontWeight: 750 }}
              >
                {invoices.monthKeys.map((mk) => (
                  <MenuItem key={mk} value={mk}>
                    {formatMonthTitle(mk)}
                  </MenuItem>
                ))}
                {invoices.monthKeys.length === 0 && (
                  <MenuItem value="">No Manual Periods Recorded</MenuItem>
                )}
              </Select>
            </FormControl>
          </Grid>

          {/* Database-Backed Payment Status */}
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 0.6 }}>
              DATABASE PAYMENT STATUS:
            </Typography>
            <Box
              sx={{
                p: 1.1,
                px: 2,
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: 1.2,
                bgcolor: isFullyPaid
                  ? 'rgba(16,185,129,0.08)'
                  : isPartiallyPaid
                  ? 'rgba(234,88,12,0.08)'
                  : 'rgba(245,158,11,0.08)',
                border: '1px solid',
                borderColor: isFullyPaid
                  ? 'rgba(16,185,129,0.25)'
                  : isPartiallyPaid
                  ? 'rgba(234,88,12,0.25)'
                  : 'rgba(245,158,11,0.25)'
              }}
            >
              <Chip
                label={
                  isFullyPaid
                    ? 'SETTLED & FULLY PAID'
                    : isPartiallyPaid
                    ? `PARTIALLY PAID (${formatINR(totalPaidAmount)})`
                    : 'PENDING DISBURSEMENT'
                }
                size="small"
                color={isFullyPaid ? 'success' : isPartiallyPaid ? 'warning' : 'default'}
                sx={{ fontWeight: 800, fontSize: '0.72rem' }}
              />
            </Box>
          </Grid>

          {/* Outstanding Due / Pending */}
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 0.6 }}>
              OUTSTANDING BALANCE:
            </Typography>
            <Box
              sx={{
                p: 1.1,
                px: 2,
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                bgcolor: remainingBalance > 0.01 ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)',
                border: '1px solid',
                borderColor: remainingBalance > 0.01 ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'
              }}
            >
              <Typography sx={{ fontWeight: 900, fontSize: '0.92rem', color: remainingBalance > 0.01 ? '#dc2626' : '#16a34a' }}>
                {formatINR(remainingBalance)}
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                {remainingBalance > 0.01 ? 'Still Pending' : 'Cleared (₹0.00)'}
              </Typography>
            </Box>
          </Grid>

          {/* Settlement / Transaction Reference */}
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 0.6 }}>
              UTR / TRANSACTION REF ({matchedPaymentTransactions.length}):
            </Typography>
            <Box
              sx={{
                p: 1.1,
                px: 2,
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                bgcolor: theme.palette.mode === 'light' ? '#f8fafc' : 'rgba(30,41,59,0.5)',
                border: `1px solid ${theme.palette.divider}`
              }}
            >
              <Typography
                sx={{
                  fontFamily: 'monospace',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  color: totalPaidAmount > 0 ? 'primary.main' : 'text.secondary',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%'
                }}
                title={activePaymentUtr}
              >
                {activePaymentUtr}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* MONTHLY SUMMARY METRIC CARDS */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        <Grid item xs={12} sm={4}>
          <Card
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '20px',
              border: '1.5px solid rgba(15,157,114,0.3)',
              bgcolor: 'rgba(15,157,114,0.04)'
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase' }}>
              Month Gross Total
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 900, color: '#0f9d72', mt: 0.5 }}>
              {formatINR(currentMonthData.grossTotal)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatMonthTitle(selectedMonth)}
            </Typography>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '20px',
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(15,23,42,0.6)'
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase' }}>
              Manual Live Reviews
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 900, color: 'primary.main', mt: 0.5 }}>
              {currentMonthData.liveCount}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Submissions in {formatMonthTitle(selectedMonth)}
            </Typography>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '20px',
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(15,23,42,0.6)'
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase' }}>
              Active Campaign Apps
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.5 }}>
              {currentMonthApps.length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Applications with verified live reviews
            </Typography>
          </Card>
        </Grid>
      </Grid>

      {/* ON-SCREEN CORPORATE INVOICE TEMPLATE */}
      <Box
        sx={{
          bgcolor: '#ffffff',
          color: '#111827',
          p: { xs: 3, md: 5 },
          borderRadius: '24px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 12px 40px rgba(0,0,0,0.06)',
          maxWidth: 960,
          mx: 'auto',
          mb: 4,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Google Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        }}
      >
        {/* Top Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pb: 3, borderBottom: '2px solid #f1f5f9' }}>
          <Box>
            <Box sx={{ mb: 1.5 }}>
              <Box
                component="img"
                src="/novaira_logo.jpg"
                alt="Novaira Logo"
                sx={{
                  height: 58,
                  width: 'auto',
                  maxHeight: 64,
                  borderRadius: '12px',
                  objectFit: 'contain',
                  display: 'block',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </Box>
            <Typography sx={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.45 }}>
              Novaira Global Business Solutions Pvt. Ltd.<br />
              <b>Email:</b> support@payments.novairasolution.com | <b>Web:</b> novairasolution.com
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'right' }}>
            <Typography sx={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
              BULKER INVOICE
            </Typography>
            <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.85rem', color: '#64748b', mt: 0.5 }}>
              #{invoiceNumber}
            </Typography>
            <Box
              sx={{
                mt: 1.5,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.8,
                bgcolor: isFullyPaid ? '#ecfdf5' : isPartiallyPaid ? '#fff7ed' : '#fffbeb',
                color: isFullyPaid ? '#059669' : isPartiallyPaid ? '#ea580c' : '#d97706',
                px: 1.6,
                py: 0.4,
                borderRadius: '100px',
                border: '1px solid',
                borderColor: isFullyPaid ? '#a7f3d0' : isPartiallyPaid ? '#fed7aa' : '#fde68a'
              }}
            >
              <CheckCircleIcon sx={{ fontSize: 15 }} />
              <Typography sx={{ fontWeight: 800, fontSize: '0.72rem' }}>
                {isFullyPaid
                  ? 'SETTLED & FULLY PAID'
                  : isPartiallyPaid
                  ? `PARTIALLY PAID (${formatINR(totalPaidAmount)})`
                  : 'PENDING DISBURSEMENT'}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Invoice Meta Grid */}
        <Grid container spacing={3} sx={{ py: 3, borderBottom: '1px solid #f1f5f9' }}>
          {/* Bulker Details */}
          <Grid item xs={12} sm={6}>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
              Billed To / Bulker Partner
            </Typography>
            <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
              {bulker.full_name}
            </Typography>
            <Typography sx={{ fontSize: '0.82rem', color: '#334155', mt: 0.2 }}>
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
          </Grid>

          {/* Payment Details (Aligned to right-end) */}
          <Grid
            item
            xs={12}
            sm={6}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: { xs: 'flex-start', sm: 'flex-end' },
              textAlign: { xs: 'left', sm: 'right' }
            }}
          >
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
              Payment & Settlement Information
            </Typography>
            <Typography sx={{ fontSize: '0.82rem', color: '#334155', mb: 0.3 }}>
              <b>Billing Cycle:</b> {formatMonthTitle(selectedMonth)}
            </Typography>
            <Typography sx={{ fontSize: '0.82rem', color: '#334155', mb: 0.3 }}>
              <b>Payment Method:</b> {paymentMethodLabels[activePaymentMethod] || activePaymentMethod}
            </Typography>
            <Typography sx={{ fontSize: '0.82rem', color: '#334155', mb: 0.3 }}>
              <b>Status:</b>{' '}
              <span
                style={{
                  color: isFullyPaid ? '#16a34a' : isPartiallyPaid ? '#ea580c' : '#d97706',
                  fontWeight: 800
                }}
              >
                {isFullyPaid
                  ? 'FULLY PAID'
                  : isPartiallyPaid
                  ? `PARTIALLY PAID (${formatINR(totalPaidAmount)} of ${formatINR(grossTotal)})`
                  : 'PENDING'}
              </span>
            </Typography>
            <Typography sx={{ fontSize: '0.82rem', color: '#334155', mb: 0.3 }}>
              <b>Payment Date(s):</b> {activePaymentDate}
            </Typography>
            <Typography sx={{ fontSize: '0.82rem', color: '#334155', mb: 0.3, maxWidth: 360, wordBreak: 'break-all' }}>
              <b>UTR / Ref:</b>{' '}
              <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                {activePaymentUtr}
              </span>
            </Typography>
            <Typography sx={{ fontSize: '0.82rem', color: '#334155' }}>
              <b>Currency:</b> INR (₹)
            </Typography>
          </Grid>
        </Grid>

        {/* Itemized Apps Breakdown Table */}
        <Typography sx={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', mt: 3, mb: 1.5 }}>
          Itemized Apps Breakdown — {formatMonthTitle(selectedMonth)}
        </Typography>

        <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', mb: 3 }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.74rem', color: '#475569', py: 1.2 }}>NO.</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.74rem', color: '#475569' }}>APPLICATION NAME & TASK</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.74rem', color: '#475569' }}>LIVE REVIEWS</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.74rem', color: '#475569' }}>ASSIGNED RATE</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.74rem', color: '#475569' }}>GROSS TOTAL (₹)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentMonthApps.length > 0 ? (
                currentMonthApps.map((item, idx) => (
                  <TableRow key={item.appId} sx={{ '&:last-child td': { border: 0 } }}>
                    <TableCell sx={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                      {String(idx + 1).padStart(2, '0')}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.84rem', fontWeight: 700, color: '#1e293b' }}>
                      {item.appName}
                      <Typography variant="caption" sx={{ display: 'block', color: '#64748b', fontFamily: 'monospace' }}>
                        Task ID: #{item.taskId}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ fontSize: '0.84rem', fontWeight: 700, color: '#059669' }}>
                      {item.liveCount}
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
                      {formatINR(item.assignedAmount)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.86rem', fontWeight: 900, color: '#0f9d72' }}>
                      {formatINR(item.appTotal)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: '#64748b', fontSize: '0.84rem' }}>
                    No manual review submissions found for {formatMonthTitle(selectedMonth)}.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Calculation Summary Block */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
          <Box sx={{ width: { xs: '100%', sm: 340 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.6 }}>
              <Typography sx={{ fontSize: '0.84rem', color: '#64748b' }}>Total Live Reviews:</Typography>
              <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                {currentMonthData.liveCount}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.6 }}>
              <Typography sx={{ fontSize: '0.84rem', color: '#64748b' }}>Month Gross Total:</Typography>
              <Typography sx={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                {formatINR(grossTotal)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.6 }}>
              <Typography sx={{ fontSize: '0.84rem', color: '#16a34a' }}>Disbursed / Paid So Far:</Typography>
              <Typography sx={{ fontSize: '0.92rem', fontWeight: 800, color: '#16a34a' }}>
                - {formatINR(totalPaidAmount)}
              </Typography>
            </Box>
            <Divider sx={{ my: 1, borderColor: '#e2e8f0' }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.8 }}>
              <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: remainingBalance > 0.01 ? '#dc2626' : '#0f9d72' }}>
                {remainingBalance > 0.01 ? 'Outstanding Due:' : 'Net Balance Due:'}
              </Typography>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 900, color: remainingBalance > 0.01 ? '#dc2626' : '#0f9d72' }}>
                {formatINR(remainingBalance)}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Compliance Footer */}
        <Box sx={{ p: 2, borderRadius: '12px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0', mt: 2 }}>
          <Typography sx={{ fontSize: '0.72rem', color: '#64748b', lineHeight: 1.5 }}>
            This monthly invoice statement is computed dynamically based on verified live reviews submitted during <b>Manual Billing periods</b> recorded in <code>bulker_billing_history</code>. Settled via {paymentMethodLabels[activePaymentMethod] || activePaymentMethod}. Generated via Novaira Admin Portal V2.1.
          </Typography>
        </Box>
      </Box>

      {/* PAY INVOICE MODAL DIALOG */}
      <Dialog
        open={payModalOpen}
        onClose={() => !paying && setPayModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '24px', p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          Settle Bulker Invoice
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.2} sx={{ mt: 1 }}>
            {/* Invoice Info */}
            <Box sx={{ p: 1.8, borderRadius: '14px', bgcolor: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)' }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main', display: 'block' }}>
                INVOICE #{invoiceNumber}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
                Bulker: <strong>{bulker?.full_name} ({bulker?.bulker_id})</strong> &nbsp;|&nbsp; Cycle: <strong>{formatMonthTitle(selectedMonth)}</strong>
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, pt: 1, borderTop: '1px dashed rgba(37,99,235,0.2)' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Total Bill: <strong>{formatINR(grossTotal)}</strong>
                </Typography>
                <Typography variant="caption" sx={{ color: '#16a34a', fontWeight: 700 }}>
                  Paid: {formatINR(totalPaidAmount)}
                </Typography>
                <Typography variant="caption" sx={{ color: '#dc2626', fontWeight: 800 }}>
                  Remaining: {formatINR(remainingBalance)}
                </Typography>
              </Box>
            </Box>

            {/* Payout Amount */}
            <TextField
              label="Payout Amount (₹)"
              type="number"
              fullWidth
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              helperText={
                remainingBalance > 0
                  ? `Remaining unpaid balance: ${formatINR(remainingBalance)}`
                  : 'Invoice is already settled'
              }
              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
            />

            {/* Payment Method */}
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
              <MenuItem value="NEFT_RTGS">NEFT / RTGS Corporate</MenuItem>
              <MenuItem value="WALLET_TRANSFER">Novaira Pay Bulker Wallet</MenuItem>
            </TextField>

            {/* Bank UTR / Reference */}
            <TextField
              label="UTR / Reference Number"
              fullWidth
              value={payUtr}
              onChange={(e) => setPayUtr(e.target.value)}
              placeholder="e.g. UTR982348123"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
            />

            {/* Notes */}
            <TextField
              label="Payment Note / Description"
              multiline
              rows={2}
              fullWidth
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
            />

            {/* Sync to Company Fund Checkbox (Wallet-like control) */}
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                borderRadius: '14px',
                border: '1px solid',
                borderColor: syncToCompanyFund ? 'rgba(37,99,235,0.3)' : 'divider',
                bgcolor: syncToCompanyFund ? 'rgba(37,99,235,0.04)' : 'transparent'
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
                    <Typography variant="body2" sx={{ fontWeight: 750 }}>
                      Sync to Company Fund Transactions
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {syncToCompanyFund
                        ? '✅ Transaction will be recorded in Company Fund ledger as outgoing fund.'
                        : '❌ Transaction will ONLY be recorded in Bulker Wallet, company fund a uthbe na.'}
                    </Typography>
                  </Box>
                }
              />
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPayModalOpen(false)} disabled={paying} sx={{ borderRadius: '12px', fontWeight: 700 }}>
            Cancel
          </Button>
          <Button
            onClick={handleExecutePayment}
            variant="contained"
            color="success"
            disabled={paying}
            sx={{ borderRadius: '12px', fontWeight: 800, px: 3 }}
          >
            {paying ? 'Processing...' : 'Confirm & Disburse Payment'}
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
