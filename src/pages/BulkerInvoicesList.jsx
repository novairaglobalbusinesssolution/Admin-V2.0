import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TablePagination,
  TextField, InputAdornment, Button, IconButton, Chip, Avatar,
  Stack, MenuItem, CircularProgress, Tooltip, useTheme, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { supabase } from '../supabaseClient';

export default function BulkerInvoicesList() {
  const theme = useTheme();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [bulkers, setBulkers] = useState([]);
  const [invoices, setInvoices] = useState([]);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Create Invoice Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedBulkerId, setSelectedBulkerId] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceDescription, setInvoiceDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [creating, setCreating] = useState(false);

  // Top-center Toast state
  const [toast, setToast] = useState({ open: false, type: 'success', title: '', message: '' });

  const showToast = (type, title, message = '') => {
    setToast({ open: true, type, title, message });
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch bulkers
      const { data: bData, error: bErr } = await supabase
        .from('bulker_desks')
        .select('*')
        .order('full_name', { ascending: true });

      if (bErr) throw bErr;
      setBulkers(bData || []);

      // 2. Fetch invoices from invoices table if available
      try {
        const { data: invData, error: invErr } = await supabase
          .from('invoices')
          .select('*')
          .order('created_at', { ascending: false });

        if (!invErr && invData) {
          setInvoices(invData);
        }
      } catch (e) {
        console.error('Error fetching invoices:', e);
      }
    } catch (err) {
      console.error('Error fetching bulker invoices data:', err);
      showToast('error', 'Failed to Load', err.message || 'Could not fetch bulker invoice records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast('success', 'Copied!', text);
  };

  const handleOpenCreateModal = (bulkerId = '') => {
    setSelectedBulkerId(bulkerId);
    setInvoiceAmount('');
    setInvoiceDescription('');
    setDueDate('');
    setCreateModalOpen(true);
  };

  const handleCreateInvoice = async () => {
    const numAmt = parseFloat(invoiceAmount);
    if (!selectedBulkerId) {
      showToast('warning', 'Missing Bulker', 'Please select a bulker desk.');
      return;
    }
    if (!invoiceAmount || isNaN(numAmt) || numAmt <= 0) {
      showToast('warning', 'Invalid Amount', 'Please enter a valid invoice amount.');
      return;
    }

    setCreating(true);
    try {
      const targetBulker = bulkers.find(b => b.bulker_id === selectedBulkerId || b.id === selectedBulkerId);
      const generatedInvNo = `INV-BLK-${Date.now().toString().slice(-6)}`;

      const payload = {
        invoice_number: generatedInvNo,
        party_type: 'bulker',
        party_id: targetBulker?.bulker_id || selectedBulkerId,
        client_id: null,
        total_amount: numAmt,
        due_date: dueDate || null,
        status: 'Pending',
        notes: invoiceDescription || 'Bulker Settlement Invoice',
        metadata: {
          bulker_id: targetBulker?.bulker_id,
          bulker_name: targetBulker?.full_name,
          bulker_uuid: targetBulker?.id
        }
      };

      const { error: insErr } = await supabase.from('invoices').insert([payload]);
      if (insErr) {
        console.warn('Invoices table insert error:', insErr);
      }

      setCreateModalOpen(false);
      showToast('success', 'Invoice Created!', `Invoice ${generatedInvNo} for ₹${numAmt.toFixed(2)} generated successfully.`);
      await fetchData();
    } catch (err) {
      console.error('Error generating invoice:', err);
      showToast('error', 'Error', err.message || 'Failed to generate invoice.');
    } finally {
      setCreating(false);
    }
  };

  // Filtered bulkers
  const filteredBulkers = bulkers.filter((b) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      (b.full_name || '').toLowerCase().includes(q) ||
      (b.bulker_id || '').toLowerCase().includes(q) ||
      (b.phone || '').toLowerCase().includes(q) ||
      (b.email || '').toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && (b.status === 'Active' || b.status === 'Verified')) ||
      (statusFilter === 'INACTIVE' && b.status !== 'Active' && b.status !== 'Verified');

    return matchesSearch && matchesStatus;
  });

  const paginatedBulkers = filteredBulkers.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', py: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 44, height: 44, borderRadius: '14px' }}>
              <ReceiptLongIcon />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                Bulker Invoices & Billing
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage billing invoices, settlement statements & payout accounts for Bulker Desks
              </Typography>
            </Box>
          </Box>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchData}
            disabled={loading}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
          >
            Refresh
          </Button>

          <Button
            variant="contained"
            color="primary"
            startIcon={<AddCircleIcon />}
            onClick={() => handleOpenCreateModal()}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 750, px: 2.2 }}
          >
            Create Invoice
          </Button>
        </Stack>
      </Box>

      {/* Top 4 Stat Cards */}
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
                  Total Bulkers
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                  {bulkers.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Registered desks
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'rgba(37,99,235,0.1)', color: '#2563eb', borderRadius: '14px' }}>
                <ReceiptLongIcon />
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
                  Active Invoices
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#16a34a' }}>
                  {invoices.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Billing records
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'rgba(22,163,74,0.1)', color: '#16a34a', borderRadius: '14px' }}>
                <MonetizationOnIcon />
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
                  Settled Invoices
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#2563eb' }}>
                  {invoices.filter(i => (i.status || '').toLowerCase() === 'paid').length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Payment confirmed
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'rgba(37,99,235,0.1)', color: '#2563eb', borderRadius: '14px' }}>
                <CheckCircleIcon />
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
                  Pending Invoices
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#f59e0b' }}>
                  {invoices.filter(i => (i.status || '').toLowerCase() === 'pending').length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Awaiting settlement
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderRadius: '14px' }}>
                <CalendarMonthIcon />
              </Avatar>
            </Stack>
          </Card>
        </Grid>
      </Grid>

      {/* Main Table Paper */}
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
        {/* Search & Filters */}
        <Box sx={{ p: 2.5, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search bulkers by name, ID, phone..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
            sx={{ flex: 1, minWidth: { xs: '100%', sm: 260 }, '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
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
            label="Status"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            sx={{ minWidth: 140, '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
          >
            <MenuItem value="ALL">All Status</MenuItem>
            <MenuItem value="ACTIVE">Active</MenuItem>
            <MenuItem value="INACTIVE">Inactive</MenuItem>
          </TextField>
        </Box>

        {/* Data Table */}
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.02)' : 'rgba(255,255,255,0.02)' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem', py: 1.8, whiteSpace: 'nowrap' }}>BULKER NAME</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>BULKER ID</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>CONTACT DETAILS</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>STATUS</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>WALLET</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>ACTIONS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <CircularProgress size={36} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                      Loading bulker invoice records...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : paginatedBulkers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      No Bulkers Found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Try adjusting your search criteria.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedBulkers.map((b) => (
                  <TableRow
                    key={b.id || b.bulker_id}
                    hover
                    sx={{ '&:last-child td': { border: 0 }, transition: 'background-color 0.2s ease' }}
                  >
                    {/* Bulker Name */}
                    <TableCell sx={{ py: 1.5, whiteSpace: 'nowrap' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                        <Avatar
                          sx={{
                            width: 36,
                            height: 36,
                            bgcolor: 'primary.main',
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            color: '#fff',
                            flexShrink: 0
                          }}
                        >
                          {b.full_name ? b.full_name.charAt(0).toUpperCase() : 'B'}
                        </Avatar>
                        <Typography variant="body2" sx={{ fontWeight: 750, color: 'text.primary', whiteSpace: 'nowrap' }}>
                          {b.full_name}
                        </Typography>
                      </Box>
                    </TableCell>

                    {/* Bulker ID */}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                        <Chip
                          label={b.bulker_id}
                          size="small"
                          sx={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            borderRadius: '8px'
                          }}
                        />
                        <IconButton size="small" onClick={() => copyToClipboard(b.bulker_id)} sx={{ p: 0.3 }}>
                          <ContentCopyIcon sx={{ fontSize: 13 }} />
                        </IconButton>
                      </Box>
                    </TableCell>

                    {/* Contact Details */}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2 }}>
                        {b.phone && <Typography variant="caption" sx={{ fontWeight: 600 }}>{b.phone}</Typography>}
                        {b.email && <Typography variant="caption" color="text.secondary">{b.email}</Typography>}
                      </Box>
                    </TableCell>

                    {/* Status */}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Chip
                        label={b.status || 'Active'}
                        size="small"
                        color={b.status === 'Active' || b.status === 'Verified' ? 'success' : 'default'}
                        sx={{ fontWeight: 700, fontSize: '0.72rem', borderRadius: '8px' }}
                      />
                    </TableCell>

                    {/* Wallet Link */}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => navigate(`/payments/bulkers/wallet/${b.id || b.bulker_id}`)}
                        sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, fontSize: '0.75rem' }}
                      >
                        View Wallet
                      </Button>
                    </TableCell>

                    {/* Action */}
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      <Button
                        variant="contained"
                        size="small"
                        color="primary"
                        startIcon={<AddCircleIcon fontSize="small" />}
                        onClick={() => handleOpenCreateModal(b.bulker_id)}
                        sx={{
                          borderRadius: '100px',
                          textTransform: 'none',
                          fontWeight: 750,
                          fontSize: '0.78rem',
                          px: 2
                        }}
                      >
                        New Invoice
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
          onPageChange={(e, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Paper>

      {/* Quick Create Invoice Dialog */}
      <Dialog
        open={createModalOpen}
        onClose={() => !creating && setCreateModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '24px', p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.25rem' }}>
          Create Bulker Invoice
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            {/* Bulker select */}
            <TextField
              select
              label="Select Bulker Desk"
              fullWidth
              value={selectedBulkerId}
              onChange={(e) => setSelectedBulkerId(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
            >
              {bulkers.map((b) => (
                <MenuItem key={b.id || b.bulker_id} value={b.bulker_id}>
                  {b.full_name} ({b.bulker_id})
                </MenuItem>
              ))}
            </TextField>

            {/* Amount */}
            <TextField
              label="Invoice Amount (₹)"
              type="number"
              fullWidth
              value={invoiceAmount}
              onChange={(e) => setInvoiceAmount(e.target.value)}
              placeholder="e.g. 1500.00"
              InputProps={{
                startAdornment: <InputAdornment position="start">₹</InputAdornment>
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
            />

            {/* Due Date */}
            <TextField
              label="Due Date"
              type="date"
              fullWidth
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
            />

            {/* Description / Notes */}
            <TextField
              label="Notes / Items Summary"
              multiline
              rows={3}
              fullWidth
              value={invoiceDescription}
              onChange={(e) => setInvoiceDescription(e.target.value)}
              placeholder="Enter service details, task settlements or payout description..."
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setCreateModalOpen(false)}
            color="inherit"
            disabled={creating}
            sx={{ fontWeight: 700, borderRadius: '12px' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateInvoice}
            variant="contained"
            color="primary"
            disabled={creating}
            sx={{ fontWeight: 800, borderRadius: '12px', px: 3 }}
          >
            {creating ? 'Creating...' : 'Generate Invoice'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Top Center Compact Premium Toast Notification */}
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
