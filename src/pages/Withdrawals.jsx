import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, 
  Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stack, CircularProgress,
  Card, CardContent, Grid, Divider, useTheme, useMediaQuery, Avatar
} from '@mui/material';
import { 
  CheckCircleOutlined as CheckIcon, 
  CancelOutlined as CloseIcon, 
  AccountBalanceWalletOutlined as WalletIcon,
  PersonOutlined as PersonIcon
} from '@mui/icons-material';
import { supabase } from '../supabaseClient';
import { Snackbar, Alert } from '@mui/material';

export default function Withdrawals() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Modals
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);

  // Inputs
  const [utrInput, setUtrInput] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  const showToast = (message, severity = 'success') => {
    setToast({ open: true, message, severity });
  };
  const handleCloseToast = (event, reason) => {
    if (reason === 'clickaway') return;
    setToast(prev => ({ ...prev, open: false }));
  };


  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const formatDateTime = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return {
        date: d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }),
        time: d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
      };
    } catch (e) {
      return { date: 'N/A', time: 'N/A' };
    }
  };


  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: withdrawals, error: wErr } = await supabase
        .from('individual_wallet_transactions')
        .select(`*`)
        .eq('status', 'Pending')
        .eq('transaction_type', 'Debit')
        .ilike('description', 'Withdrawal:%')
        .order('created_at', { ascending: false });

      if (wErr) throw wErr;

      // Manually fetch profiles since foreign key might be missing
      const earnerIds = [...new Set((withdrawals || []).map(w => w.earner_id))].filter(Boolean);
      let profilesMap = {};
      if (earnerIds.length > 0) {
        const { data: profiles, error: pErr } = await supabase
          .from('profiles')
          .select('earner_id, first_name, last_name, email, phone, bulker_id')
          .in('earner_id', earnerIds);
        
        if (!pErr && profiles) {
          profiles.forEach(p => {
            profilesMap[p.earner_id] = p;
          });
        }
      }

      const { data: bulkers } = await supabase.from('bulker_desks').select('bulker_id, full_name');

      const combined = (withdrawals || []).map(w => {
        const profile = profilesMap[w.earner_id] || {};
        
        let bulkerMatch = null;
        if (profile.bulker_id) {
            const searchId = profile.bulker_id.startsWith('NOVAIRA/BULKER/') 
                ? profile.bulker_id 
                : 'NOVAIRA/BULKER/' + profile.bulker_id;
            bulkerMatch = (bulkers || []).find(b => b.bulker_id === searchId);
        }
        const bulker = bulkerMatch || {};
        
        let parsedDetails = {};
        if (w.payout_details) {
            try {
                parsedDetails = typeof w.payout_details === 'string' ? JSON.parse(w.payout_details) : w.payout_details;
            } catch (e) {
                console.error("Failed to parse payout_details", e);
            }
        }

        return {
          ...w,
          user_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
          email: profile.email || 'N/A',
          phone: profile.phone || 'N/A',
          bulker_name: bulker.full_name || 'N/A',
          payoutData: parsedDetails
        }
      });

      setTransactions(combined);
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const openPayModal = (tx) => {
    setSelectedTx(tx);
    setUtrInput('');
    setPayModalOpen(true);
  };

  const openCancelModal = (tx) => {
    setSelectedTx(tx);
    setCancelReason('');
    setCancelModalOpen(true);
  };

  const handlePaySubmit = async () => {
    if (!utrInput.trim()) {
      return showToast('Please enter a valid UTR / Transaction ID', 'warning');
    }
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('individual_wallet_transactions')
        .update({
          status: 'Completed',
          utr_id: utrInput.trim()
        })
        .eq('id', selectedTx.id);
        
      if (error) throw error;
      
      // Send push notification
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/send-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          earner_id: selectedTx.earner_id,
          title: 'Withdrawal Processed',
          type: 'wallet',
          body: `Your withdrawal of ₹${selectedTx.amount} has been successfully paid via ${selectedTx.payoutData?.account_type || 'Bank'}. UTR: ${utrInput.trim()}`
        })
      }).catch(err => console.error('Push notification failed:', err));

      showToast('Payment marked as Completed & Notification sent!', 'success');
      setPayModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSubmit = async () => {
    if (!cancelReason.trim()) {
      return showToast('Please provide a reason for cancellation', 'warning');
    }
    setActionLoading(true);
    try {
      const newDesc = `${selectedTx.description} | Cancelled Reason: ${cancelReason.trim()}`;
      const { error } = await supabase
        .from('individual_wallet_transactions')
        .update({
          status: 'Cancelled',
          description: newDesc
        })
        .eq('id', selectedTx.id);
        
      if (error) throw error;
      
      // Send push notification
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/send-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          earner_id: selectedTx.earner_id,
          title: 'Withdrawal Cancelled',
          type: 'wallet',
          body: `Your withdrawal of ₹${selectedTx.amount} was cancelled. Reason: ${cancelReason.trim()}`
        })
      }).catch(err => console.error('Push notification failed:', err));

      showToast('Withdrawal request cancelled & Notification sent!', 'success');
      setCancelModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const renderPayoutDetails = (details) => {
    if (!details || Object.keys(details).length === 0) return 'No details provided';
    return (
      <Box sx={{ fontSize: '0.875rem', color: 'text.secondary', mt: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
          {details.account_type} - {details.account_name}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 0.5 }}>
          <Box><strong>A/C:</strong> {details.account_number}</Box>
          {details.account_type !== 'UPI' && (
            <>
              <Box><strong>Bank:</strong> {details.bank_name}</Box>
              <Box><strong>IFSC:</strong> {details.ifsc_code}</Box>
            </>
          )}
        </Box>
      </Box>
    );
  };

  const generateUPIQR = (details, amount) => {
    if (details.account_type !== 'UPI') return null;
    const upiUri = `upi://pay?pa=${details.account_number}&pn=${encodeURIComponent(details.account_name || 'User')}&am=${amount}&cu=INR`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUri)}`;
  };

  const paginatedTransactions = transactions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
          <WalletIcon />
        </Avatar>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Pending Withdrawals
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage and process user withdrawal requests securely
          </Typography>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      ) : transactions.length === 0 ? (
        <Paper elevation={0} sx={{ p: 6, textAlign: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Typography variant="h6" color="text.secondary">No pending withdrawals right now.</Typography>
        </Paper>
      ) : isMobile ? (
        // Mobile View (Cards)
        <Box>
          {paginatedTransactions.map((row) => (
            <Card key={row.id} elevation={0} sx={{ mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {row.user_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {row.phone} • {formatDateTime(row.created_at).date}
                    </Typography>
                  </Box>
                  <Typography variant="h6" color="primary.main" sx={{ fontWeight: 700 }}>
                    ₹{row.amount}
                  </Typography>
                </Box>
                
                <Divider sx={{ my: 1.5 }} />
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                    Payout Details
                  </Typography>
                  {renderPayoutDetails(row.payoutData)}
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                    Assigned Bulker
                  </Typography>
                  <Typography variant="body2">{row.bulker_name}</Typography>
                </Box>

                <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                  <Button 
                    fullWidth
                    variant="outlined" 
                    color="error" 
                    onClick={() => openCancelModal(row)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    fullWidth
                    variant="contained" 
                    color="primary" 
                    onClick={() => openPayModal(row)}
                  >
                    Pay
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ))}
          <TablePagination
            component="div"
            count={transactions.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </Box>
      ) : (
        // Desktop View (Table)
        <Paper elevation={0} sx={{ width: '100%', mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
          <TableContainer>
            <Table>
              <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.02)' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Earner Details</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Bulker</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Payout Account</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Amount</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedTransactions.map((row) => (
                  <TableRow hover key={row.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatDateTime(row.created_at).date}<br/>
                      <Typography variant="caption" color="text.secondary">
                        {formatDateTime(row.created_at).time}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.light' }}>
                          <PersonIcon fontSize="small" />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.user_name}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{row.earner_id}</Typography>
                          <Typography variant="caption" color="text.secondary">{row.phone}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{row.bulker_name}</Typography>
                    </TableCell>
                    <TableCell>{renderPayoutDetails(row.payoutData)}</TableCell>
                    <TableCell align="right">
                      <Typography variant="subtitle1" color="primary.main" sx={{ fontWeight: 700 }}>
                        ₹{row.amount}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <Button 
                          variant="contained" 
                          color="primary" 
                          size="small" 
                          startIcon={<CheckIcon />}
                          onClick={() => openPayModal(row)}
                          sx={{ borderRadius: 8, px: 2 }}
                        >
                          Pay
                        </Button>
                        <Button 
                          variant="outlined" 
                          color="error" 
                          size="small" 
                          onClick={() => openCancelModal(row)}
                          sx={{ borderRadius: 8, minWidth: '40px', p: '6px 10px' }}
                        >
                          <CloseIcon fontSize="small" />
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[10, 25, 50]}
            component="div"
            count={transactions.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>
      )}

      {/* PAY MODAL */}
      <Dialog 
        open={payModalOpen} 
        onClose={() => !actionLoading && setPayModalOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 600, pb: 1 }}>Process Payment</DialogTitle>
        <DialogContent>
          {selectedTx && (
            <Box sx={{ mt: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, p: 2, bgcolor: 'primary.primaryContainer', borderRadius: 2 }}>
                <Typography variant="body1" color="text.secondary">Amount to Pay</Typography>
                <Typography variant="h5" color="primary.main" sx={{ fontWeight: 700 }}>₹{selectedTx.amount}</Typography>
              </Box>
              
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700 }}>
                  Beneficiary Details
                </Typography>
                <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  {renderPayoutDetails(selectedTx.payoutData)}
                </Paper>
              </Box>

              {selectedTx.payoutData?.account_type === 'UPI' && (
                <Box sx={{ textAlign: 'center', mb: 4 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Scan QR via GPay, PhonePe, or Paytm
                  </Typography>
                  <Box sx={{ p: 2, display: 'inline-block', bgcolor: 'white', border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                    <img 
                      src={generateUPIQR(selectedTx.payoutData, selectedTx.amount)} 
                      alt="UPI QR Code" 
                      style={{ width: '200px', height: '200px', display: 'block' }} 
                    />
                  </Box>
                </Box>
              )}

              <TextField
                fullWidth
                label="Enter UTR / Transaction ID"
                variant="outlined"
                value={utrInput}
                onChange={(e) => setUtrInput(e.target.value)}
                required
                placeholder="e.g. 31234567890"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setPayModalOpen(false)} color="inherit" disabled={actionLoading} sx={{ borderRadius: 8 }}>
            Close
          </Button>
          <Button onClick={handlePaySubmit} variant="contained" color="primary" disabled={actionLoading} sx={{ borderRadius: 8, px: 3 }}>
            {actionLoading ? <CircularProgress size={24} color="inherit" /> : 'Confirm Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* CANCEL MODAL */}
      <Dialog 
        open={cancelModalOpen} 
        onClose={() => !actionLoading && setCancelModalOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 600, color: 'error.main', pb: 1 }}>Cancel Withdrawal</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 3, mt: 1 }}>
            Are you sure you want to reject this withdrawal of <strong>₹{selectedTx?.amount}</strong>? This action cannot be undone.
          </Typography>
          <TextField
            fullWidth
            label="Cancellation Reason"
            variant="outlined"
            multiline
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            required
            placeholder="e.g. Invalid bank details provided."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setCancelModalOpen(false)} color="inherit" disabled={actionLoading} sx={{ borderRadius: 8 }}>
            Back
          </Button>
          <Button onClick={handleCancelSubmit} variant="contained" color="error" disabled={actionLoading} sx={{ borderRadius: 8, px: 3 }}>
            {actionLoading ? <CircularProgress size={24} color="inherit" /> : 'Confirm Cancellation'}
          </Button>
        </DialogActions>
      </Dialog>


      <Snackbar 
        open={toast.open} 
        autoHideDuration={4000} 
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseToast} severity={toast.severity} variant="filled" sx={{ width: '100%', borderRadius: 8 }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
