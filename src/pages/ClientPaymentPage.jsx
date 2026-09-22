import { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Grid, Button, CircularProgress, Chip, 
  Divider, useTheme, Card, Snackbar, TextField
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PaymentIcon from '@mui/icons-material/Payment';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function ClientPaymentPage() {
  const { invoiceId } = useParams();
  const theme = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState(null);
  const [client, setClient] = useState(null);
  const [gateways, setGateways] = useState({});
  const [processing, setProcessing] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    fetchData();
  }, [invoiceId]);

  const fetchData = async () => {
    try {
      // Fetch Invoice
      const { data: invData, error: invErr } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();
      
      if (invErr) throw invErr;
      setInvoice(invData);

      // Fetch Client
      if (invData.client_id) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('*')
          .eq('client_id', invData.client_id)
          .single();
        setClient(clientData);
      }

      // Fetch Gateways
      const { data: gatewayData } = await supabase.from('payment_gateways').select('*').eq('is_active', true);
      if (gatewayData) {
        const gw = {};
        gatewayData.forEach(g => { gw[g.id] = g.config; });
        setGateways(gw);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f8fafc' }}><CircularProgress /></Box>;
  if (!invoice) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f8fafc' }}><Typography variant="h5">Invoice not found.</Typography></Box>;

  const cSym = invoice.currency === 'USD' ? '$' : '₹';
  const isPaid = (invoice.status || 'Pending').toLowerCase() === 'paid';
  const netPayable = Number(invoice.net_payable);

  // Load Razorpay Script Dynamically
  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleRazorpay = async () => {
    if (!gateways.razorpay?.key_id) {
      setSnack({ open: true, message: 'Razorpay is not configured by the merchant.', severity: 'error' });
      return;
    }
    
    setProcessing(true);
    const res = await loadRazorpay();
    if (!res) {
      setSnack({ open: true, message: 'Razorpay SDK failed to load. Check your connection.', severity: 'error' });
      setProcessing(false);
      return;
    }

    const options = {
      key: gateways.razorpay.key_id,
      amount: Math.round(netPayable * 100), // amount in paise
      currency: invoice.currency,
      name: 'Novaira Global Solutions',
      description: `Payment for Invoice #${invoice.invoice_id}`,
      handler: async function (response) {
        try {
          // Mark as Paid
          const { error } = await supabase
            .from('invoices')
            .update({ status: 'Paid' })
            .eq('id', invoice.id);
          
          if (error) throw error;
          
          setInvoice(prev => ({ ...prev, status: 'Paid' }));
          setSnack({ open: true, message: 'Payment Successful! Invoice marked as paid.', severity: 'success' });
        } catch (err) {
          setSnack({ open: true, message: 'Payment recorded, but failed to update status.', severity: 'error' });
        }
      },
      prefill: {
        name: client?.name || '',
        email: client?.email || '',
        contact: client?.phone || ''
      },
      theme: { color: '#0b57d0' }
    };

    const paymentObject = new window.Razorpay(options);
    paymentObject.open();
    setProcessing(false);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', py: { xs: 4, md: 8 }, px: 2 }}>
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 5 }}>
          <Typography variant="h4" sx={{ fontWeight: 900, color: '#1e293b', mb: 1 }}>Novaira Global Solutions</Typography>
          <Typography variant="body1" color="text.secondary">Secure Payment Portal</Typography>
        </Box>

        {isPaid ? (
          <Paper elevation={0} sx={{ p: 5, borderRadius: '24px', textAlign: 'center', border: '1px solid #e2e8f0', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.05)' }}>
            <CheckCircleIcon sx={{ fontSize: 80, color: '#10b981', mb: 2 }} />
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>Payment Successful</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>This invoice has been fully paid. Thank you!</Typography>
            <Button variant="outlined" sx={{ borderRadius: '100px', px: 4 }} onClick={() => window.print()}>Print Receipt</Button>
          </Paper>
        ) : (
          <Grid container spacing={4}>
            {/* Invoice Summary */}
            <Grid item xs={12} md={5}>
              <Paper elevation={0} sx={{ p: 4, borderRadius: '24px', border: '1px solid #e2e8f0', bgcolor: '#fff', position: 'sticky', top: 20 }}>
                <Typography variant="overline" sx={{ fontWeight: 800, color: '#94a3b8' }}>Invoice Summary</Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mt: 1, mb: 3 }}>#{invoice.invoice_id}</Typography>
                
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary">Billed To</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600, color: '#334155' }}>{client?.name || 'Unknown Client'}</Typography>
                  {client?.email && <Typography variant="body2" sx={{ color: '#64748b' }}>{client.email}</Typography>}
                </Box>

                <Divider sx={{ my: 3 }} />
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography color="text.secondary">Total Amount</Typography>
                  <Typography sx={{ fontWeight: 600 }}>{cSym}{Number(invoice.grand_total).toFixed(2)}</Typography>
                </Box>
                {Number(invoice.tds_amount) > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography color="text.secondary">TDS Deduction</Typography>
                    <Typography sx={{ fontWeight: 600, color: '#ef4444' }}>-{cSym}{Number(invoice.tds_amount).toFixed(2)}</Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3, pt: 3, borderTop: '2px dashed #cbd5e1' }}>
                  <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', color: '#0f172a' }}>Net Payable</Typography>
                  <Typography sx={{ fontWeight: 900, fontSize: '1.5rem', color: '#0b57d0' }}>{cSym}{netPayable.toFixed(2)}</Typography>
                </Box>
              </Paper>
            </Grid>

            {/* Payment Options */}
            <Grid item xs={12} md={7}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>Select Payment Method</Typography>
                
                {/* Razorpay */}
                {gateways.razorpay && (
                  <Paper elevation={0} sx={{ p: 4, borderRadius: '24px', border: '2px solid #0b57d0', bgcolor: '#f0f4f8', cursor: 'pointer', transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)' } }} onClick={handleRazorpay}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ p: 1.5, bgcolor: '#0b57d0', borderRadius: '12px', color: '#fff', display: 'flex' }}>
                        <PaymentIcon />
                      </Box>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>Pay via UPI / Cards / Netbanking</Typography>
                        <Typography variant="body2" sx={{ color: '#475569' }}>Instant secure payment via Razorpay</Typography>
                      </Box>
                    </Box>
                  </Paper>
                )}

                {/* PayPal (Only if USD) */}
                {gateways.paypal && invoice.currency === 'USD' && (
                  <Paper elevation={0} sx={{ p: 4, borderRadius: '24px', border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                      <Box sx={{ p: 1.5, bgcolor: '#003087', borderRadius: '12px', color: '#fff', display: 'flex' }}>
                        <PaymentIcon />
                      </Box>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>Pay via PayPal</Typography>
                        <Typography variant="body2" sx={{ color: '#475569' }}>For international clients</Typography>
                      </Box>
                    </Box>
                    <Button variant="contained" fullWidth sx={{ bgcolor: '#003087', '&:hover': { bgcolor: '#00205b' }, borderRadius: '100px', py: 1.5 }}>
                      Proceed to PayPal
                    </Button>
                  </Paper>
                )}

                {/* Bank Transfer */}
                {gateways.bank && (
                  <Paper elevation={0} sx={{ p: 4, borderRadius: '24px', border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                      <Box sx={{ p: 1.5, bgcolor: '#475569', borderRadius: '12px', color: '#fff', display: 'flex' }}>
                        <AccountBalanceIcon />
                      </Box>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>Manual Bank Transfer</Typography>
                        <Typography variant="body2" sx={{ color: '#475569' }}>Transfer funds directly to our account</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ bgcolor: '#f8fafc', p: 3, borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary">Bank Name</Typography>
                          <Typography sx={{ fontWeight: 700 }}>{gateways.bank.bank_name || 'N/A'}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary">Account Number</Typography>
                          <Typography sx={{ fontWeight: 700 }}>{gateways.bank.account_no || 'N/A'}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary">IFSC Code</Typography>
                          <Typography sx={{ fontWeight: 700 }}>{gateways.bank.ifsc || 'N/A'}</Typography>
                        </Grid>
                        {gateways.bank.swift && (
                          <Grid item xs={12} sm={6}>
                            <Typography variant="caption" color="text.secondary">SWIFT Code</Typography>
                            <Typography sx={{ fontWeight: 700 }}>{gateways.bank.swift}</Typography>
                          </Grid>
                        )}
                        {gateways.bank.details && (
                          <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary">Additional Details</Typography>
                            <Typography sx={{ fontWeight: 600 }}>{gateways.bank.details}</Typography>
                          </Grid>
                        )}
                      </Grid>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
                      Please contact support after completing the transfer to update your invoice status.
                    </Typography>
                  </Paper>
                )}

              </Box>
            </Grid>
          </Grid>
        )}
      </Box>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}>
        <Box sx={{ bgcolor: snack.severity === 'error' ? 'error.main' : snack.severity === 'warning' ? 'warning.main' : 'success.main', color: '#fff', px: 3, py: 1.5, borderRadius: '8px', fontWeight: 600 }}>
          {snack.message}
        </Box>
      </Snackbar>
    </Box>
  );
}
