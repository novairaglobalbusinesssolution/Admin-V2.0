import { useState, useMemo } from 'react';
import { 
  Box, Typography, Paper, TextField, Button, Snackbar, useTheme, 
  Grid, IconButton, Divider, Switch, FormControlLabel, MenuItem, Select, FormControl, InputLabel, Card
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function CreateInvoice() {
  const { clientId } = useParams();
  const theme = useTheme();
  const navigate = useNavigate();
  
  // Basic Invoice Meta
  
  const [clientRecord, setClientRecord] = useState(null);
  useEffect(() => {
    supabase.from('clients').select('client_id').eq('id', clientId).single().then(({data}) => {
      if (data) setClientRecord(data);
    });
  }, [clientId]);
const [currency, setCurrency] = useState('INR');
  const [dueDate, setDueDate] = useState('');
  
  // Items
  const [items, setItems] = useState([{ name: '', rate: 0, qty: 1 }]);
  
  // Totals Modifiers
  const [discount, setDiscount] = useState(0);
  
  // GST Settings
  const [hasGst, setHasGst] = useState(false);
  const [companyGstin, setCompanyGstin] = useState('');
  const [clientGstin, setClientGstin] = useState('');
  const [gstRate, setGstRate] = useState(18); // default 18%
  
  // TDS Settings
  const [tdsPercentage, setTdsPercentage] = useState(0);
  const [companyPan, setCompanyPan] = useState('');
  
  // Other
  const [notes, setNotes] = useState('Thank you for your business!');
  const [allowPartial, setAllowPartial] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'info' });

  // Calculations
  const subtotal = useMemo(() => {
    return items.reduce((acc, item) => acc + (Number(item.rate) * Number(item.qty)), 0);
  }, [items]);

  const discountAmount = Number(discount) || 0;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  
  const taxAmount = useMemo(() => {
    if (!hasGst) return 0;
    return (taxableAmount * Number(gstRate)) / 100;
  }, [hasGst, taxableAmount, gstRate]);
  
  const grandTotal = taxableAmount + taxAmount;
  
  const tdsAmount = useMemo(() => {
    if (Number(tdsPercentage) <= 0) return 0;
    // TDS is calculated on the taxable amount (Subtotal - Discount), not including GST.
    return (taxableAmount * Number(tdsPercentage)) / 100;
  }, [tdsPercentage, taxableAmount]);

  const netPayable = grandTotal - tdsAmount;

  // Item Handlers
  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };
  
  const addItem = () => setItems([...items, { name: '', rate: 0, qty: 1 }]);
  const removeItem = (index) => setItems(items.filter((_, i) => i !== index));

  const handleCreate = async () => {
    if (items.some(i => !i.name || Number(i.qty) <= 0)) {
      setSnack({ open: true, message: 'Please provide valid item details.', severity: 'warning' });
      return;
    }
    if (tdsPercentage > 0 && !companyPan.trim()) {
      setSnack({ open: true, message: 'Company PAN is required for TDS deduction.', severity: 'warning' });
      return;
    }
    
    setSubmitting(true);
    try {
      // 1. Alter Table if not altered yet (Supabase raw SQL equivalent check/auto-handled, but we assume columns exist. The user will run the SQL)
      const generateInvoiceId = () => 'NOVAIRA/' + Math.random().toString(36).substring(2, 8).toUpperCase() + '/' + Math.floor(100000 + Math.random() * 900000);

      const payload = {
        invoice_id: generateInvoiceId(),
        client_id: clientRecord?.client_id || clientId,
        amount: grandTotal, // The grand total as main amount
        due_date: dueDate || null,
        description: `Invoice for ${items.map(i => i.name).join(', ')}`,
        status: 'Pending',
        items_json: items,
        has_gst: hasGst,
        gst_details_json: hasGst ? { company_gstin: companyGstin, client_gstin: clientGstin, rate: gstRate } : null,
        subtotal: subtotal,
        discount: discountAmount,
        tax_amount: taxAmount,
        tds_percentage: tdsPercentage,
        tds_amount: tdsAmount,
        company_pan: companyPan,
        grand_total: grandTotal,
        net_payable: netPayable,
        notes: notes,
        currency: currency,
        allow_partial: allowPartial
      };

      const { error } = await supabase.from('invoices').insert([payload]);
      if (error) {
        if (error.code === '42703') { // column does not exist
          throw new Error('Database columns missing. Please run the provided SQL script to update the invoices table.');
        }
        throw error;
      }
      
      setSnack({ open: true, message: 'Invoice generated successfully!', severity: 'success' });
      setTimeout(() => navigate(`/payments/clients/invoices/${clientId}`), 1500);
      
    } catch (err) {
      setSnack({ open: true, message: 'Error: ' + err.message, severity: 'error' });
      setSubmitting(false);
    }
  };

  const surfaceContainer = theme.palette.mode === 'light' ? '#F3EDF7' : '#211F26';
  const surfaceContainerLow = theme.palette.mode === 'light' ? '#F7F2FA' : '#1D1B20';
  const cSym = currency === 'INR' ? '₹' : '$';

  return (
    <Box sx={{ p: { xs: 1, md: 3 }, pb: 10, maxWidth: 1400, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate(`/payments/clients/invoices/${clientId}`)}
          sx={{ borderRadius: '100px', mr: 2 }}
          color="inherit"
        >
          Back
        </Button>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Create Professional Invoice</Typography>
      </Box>
      
      <Grid container spacing={3}>
        
        {/* Left Column - Form Details */}
        <Grid item xs={12} lg={8}>
          
          <Paper elevation={0} sx={{ p: 3, borderRadius: '24px', bgcolor: surfaceContainerLow, border: `1px solid ${theme.palette.divider}`, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Service / Items Details</Typography>
              <Box sx={{ width: 150 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Currency</InputLabel>
                  <Select value={currency} label="Currency" onChange={e => setCurrency(e.target.value)}>
                    <MenuItem value="INR">INR (₹)</MenuItem>
                    <MenuItem value="USD">USD ($)</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Box>
            
            {/* Header Row */}
            <Grid container spacing={2} sx={{ mb: 1, px: 1, display: { xs: 'none', md: 'flex' } }}>
              <Grid item xs={6}><Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>Service Name / Description</Typography></Grid>
              <Grid item xs={2}><Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>Rate</Typography></Grid>
              <Grid item xs={1}><Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>Qty</Typography></Grid>
              <Grid item xs={2}><Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary', textAlign: 'right' }}>Amount</Typography></Grid>
              <Grid item xs={1}></Grid>
            </Grid>

            {items.map((item, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'flex-start', flexDirection: { xs: 'column', md: 'row' } }}>
                <TextField 
                  fullWidth sx={{ flex: { md: 6 } }} 
                  size="small" 
                  placeholder="e.g. Web Development" 
                  value={item.name} 
                  onChange={e => handleItemChange(index, 'name', e.target.value)} 
                />
                <TextField 
                  fullWidth sx={{ flex: { md: 2 } }} 
                  size="small" type="number" 
                  label="Rate" 
                  value={item.rate} 
                  onChange={e => handleItemChange(index, 'rate', e.target.value)} 
                />
                <TextField 
                  fullWidth sx={{ flex: { md: 1 } }} 
                  size="small" type="number" 
                  label="Qty" 
                  value={item.qty} 
                  onChange={e => handleItemChange(index, 'qty', e.target.value)} 
                />
                <Box sx={{ flex: { md: 2 }, display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', md: 'flex-end' }, height: '40px' }}>
                  <Typography sx={{ fontWeight: 700 }}>{cSym}{(Number(item.rate) * Number(item.qty)).toFixed(2)}</Typography>
                </Box>
                <Box sx={{ flex: { md: 1 }, display: 'flex', justifyContent: 'flex-end' }}>
                  <IconButton color="error" onClick={() => removeItem(index)} disabled={items.length === 1}>
                    <DeleteOutlineIcon />
                  </IconButton>
                </Box>
              </Box>
            ))}
            
            <Button startIcon={<AddCircleOutlineIcon />} onClick={addItem} sx={{ mt: 1, borderRadius: '100px', fontWeight: 600 }}>
              Add Another Item
            </Button>
          </Paper>

          {/* Tax & Discount Details */}
          <Paper elevation={0} sx={{ p: 3, borderRadius: '24px', bgcolor: surfaceContainerLow, border: `1px solid ${theme.palette.divider}`, mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Taxes, Discounts & TDS</Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <TextField fullWidth size="small" label="Discount Amount" type="number" value={discount} onChange={e => setDiscount(e.target.value)} />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>TDS Percentage</InputLabel>
                  <Select value={tdsPercentage} label="TDS Percentage" onChange={e => setTdsPercentage(e.target.value)}>
                    <MenuItem value={0}>0% (No TDS)</MenuItem>
                    <MenuItem value={2}>2% (194J - Call Center)</MenuItem>
                    <MenuItem value={10}>10% (194J - Professional)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {tdsPercentage > 0 && (
                <Grid item xs={12} md={4}>
                  <TextField fullWidth size="small" label="Company PAN (Required) *" value={companyPan} onChange={e => setCompanyPan(e.target.value)} />
                </Grid>
              )}
            </Grid>

            <Divider sx={{ my: 3 }} />

            <FormControlLabel 
              control={<Switch checked={hasGst} onChange={e => setHasGst(e.target.checked)} />} 
              label={<Typography sx={{ fontWeight: 600 }}>Enable GST Details</Typography>} 
            />
            
            {hasGst && (
              <Grid container spacing={3} sx={{ mt: 1 }}>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth size="small" label="Your GSTIN (Optional)" value={companyGstin} onChange={e => setCompanyGstin(e.target.value)} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth size="small" label="Client GSTIN (Optional)" value={clientGstin} onChange={e => setClientGstin(e.target.value)} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>GST Rate (%)</InputLabel>
                    <Select value={gstRate} label="GST Rate (%)" onChange={e => setGstRate(e.target.value)}>
                      <MenuItem value={5}>5%</MenuItem>
                      <MenuItem value={12}>12%</MenuItem>
                      <MenuItem value={18}>18%</MenuItem>
                      <MenuItem value={28}>28%</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            )}
          </Paper>

          {/* Additional Settings */}
          <Paper elevation={0} sx={{ p: 3, borderRadius: '24px', bgcolor: surfaceContainerLow, border: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Terms & Payment Settings</Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField 
                  label="Due Date" 
                  type="date" 
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={dueDate} 
                  onChange={e => setDueDate(e.target.value)} 
                  fullWidth 
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel 
                  control={<Switch checked={allowPartial} onChange={e => setAllowPartial(e.target.checked)} />} 
                  label={<Typography sx={{ fontWeight: 600 }}>Allow Split / Partial Payments (User pays in parts)</Typography>} 
                />
              </Grid>
              <Grid item xs={12}>
                <TextField 
                  label="Additional Notes / Terms" 
                  multiline 
                  rows={2}
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  fullWidth 
                />
              </Grid>
            </Grid>
          </Paper>

        </Grid>

        {/* Right Column - Summary */}
        <Grid item xs={12} lg={4}>
          <Card elevation={0} sx={{ p: 3, borderRadius: '24px', border: `1px solid ${theme.palette.divider}`, bgcolor: theme.palette.mode === 'light' ? '#fff' : 'background.paper', position: 'sticky', top: 20 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <ReceiptLongIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Invoice Summary</Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography color="text.secondary">Subtotal</Typography>
              <Typography sx={{ fontWeight: 600 }}>{cSym}{subtotal.toFixed(2)}</Typography>
            </Box>
            
            {discountAmount > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography color="text.secondary">Discount</Typography>
                <Typography sx={{ fontWeight: 600, color: 'success.main' }}>-{cSym}{discountAmount.toFixed(2)}</Typography>
              </Box>
            )}

            {hasGst && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography color="text.secondary">GST ({gstRate}%)</Typography>
                <Typography sx={{ fontWeight: 600 }}>+{cSym}{taxAmount.toFixed(2)}</Typography>
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>Invoice Total</Typography>
              <Typography sx={{ fontWeight: 900, fontSize: '1.2rem', color: 'primary.main' }}>{cSym}{grandTotal.toFixed(2)}</Typography>
            </Box>

            {tdsPercentage > 0 && (
              <Box sx={{ p: 2, bgcolor: theme.palette.mode === 'light' ? 'error.50' : 'rgba(211,47,47,0.1)', borderRadius: '12px', mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'error.main', mb: 1 }}>TDS Deduction (Client Will Deduct)</Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" color="error.main">TDS Rate</Typography>
                  <Typography variant="body2" color="error.main">{tdsPercentage}%</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="error.main">Estimated TDS</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }} color="error.main">-{cSym}{tdsAmount.toFixed(2)}</Typography>
                </Box>
              </Box>
            )}

            {tdsPercentage > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, pt: 2, borderTop: `1px dashed ${theme.palette.divider}` }}>
                <Typography sx={{ fontWeight: 800, color: 'success.main', fontSize: '1.1rem' }}>Net Payable</Typography>
                <Typography sx={{ fontWeight: 900, color: 'success.main', fontSize: '1.2rem' }}>{cSym}{netPayable.toFixed(2)}</Typography>
              </Box>
            )}

            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={handleCreate}
              disabled={submitting}
              sx={{ borderRadius: '100px', py: 1.5, fontWeight: 800, mt: 4, boxShadow: '0 8px 20px rgba(13,110,253,0.3)' }}
            >
              {submitting ? 'Creating...' : 'Create & View Invoice'}
            </Button>
          </Card>
        </Grid>
      </Grid>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}>
        <Box sx={{ bgcolor: snack.severity === 'error' ? 'error.main' : snack.severity === 'warning' ? 'warning.main' : 'success.main', color: '#fff', px: 3, py: 1.5, borderRadius: '8px', fontWeight: 600 }}>
          {snack.message}
        </Box>
      </Snackbar>
    </Box>
  );
}
