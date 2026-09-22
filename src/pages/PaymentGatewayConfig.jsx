import { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, TextField, Button, Snackbar, useTheme, 
  Switch, FormControlLabel, Tabs, Tab, Divider, CircularProgress
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { supabase } from '../supabaseClient';

export default function PaymentGatewayConfig() {
  const theme = useTheme();
  
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'info' });

  const [gateways, setGateways] = useState({
    razorpay: { is_active: false, config: { key_id: '', key_secret: '' } },
    paypal: { is_active: false, config: { client_id: '', secret: '' } },
    bank: { is_active: false, config: { bank_name: '', account_no: '', ifsc: '', swift: '', details: '' } }
  });

  useEffect(() => {
    fetchGateways();
  }, []);

  const fetchGateways = async () => {
    try {
      const { data, error } = await supabase.from('payment_gateways').select('*');
      
      // If table doesn't exist, we will silently ignore and let the save handle it (or show error)
      if (error && error.code !== '42P01') throw error;
      
      if (data) {
        const newGateways = { ...gateways };
        data.forEach(g => {
          if (newGateways[g.id]) {
            newGateways[g.id] = { is_active: g.is_active, config: g.config };
          }
        });
        setGateways(newGateways);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (gatewayId) => {
    setSaving(true);
    try {
      const payload = {
        id: gatewayId,
        is_active: gateways[gatewayId].is_active,
        config: gateways[gatewayId].config,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from('payment_gateways').upsert([payload]);
      
      if (error) {
        if (error.code === '42P01') {
          throw new Error('Database table "payment_gateways" missing. Please run the SQL setup query.');
        }
        throw error;
      }
      
      setSnack({ open: true, message: `${gatewayId.toUpperCase()} configuration saved successfully!`, severity: 'success' });
    } catch (err) {
      setSnack({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (gatewayId, field, value) => {
    setGateways(prev => ({
      ...prev,
      [gatewayId]: {
        ...prev[gatewayId],
        config: {
          ...prev[gatewayId].config,
          [field]: value
        }
      }
    }));
  };

  const updateActive = (gatewayId, isActive) => {
    setGateways(prev => ({
      ...prev,
      [gatewayId]: { ...prev[gatewayId], is_active: isActive }
    }));
  };

  const surfaceContainer = theme.palette.mode === 'light' ? '#F7F2FA' : '#1D1B20';

  if (loading) return <Box sx={{ p: 5, textAlign: 'center' }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: { xs: 1, md: 3 }, pb: 10, maxWidth: 800, mx: 'auto' }}>
      
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>Payment Gateway Config</Typography>
        <Typography variant="body1" color="text.secondary">
          Configure your live API keys and bank details here. These will be dynamically used on client invoices when they click 'Pay Now'.
        </Typography>
      </Box>

      {/* Tabs */}
      <Paper elevation={0} sx={{ borderRadius: '24px', border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
        <Tabs 
          value={tab} 
          onChange={(e, v) => setTab(v)} 
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: `1px solid ${theme.palette.divider}`, bgcolor: surfaceContainer }}
        >
          <Tab label="Razorpay (INR)" sx={{ fontWeight: 700 }} />
          <Tab label="PayPal (USD)" sx={{ fontWeight: 700 }} />
          <Tab label="Bank Transfer" sx={{ fontWeight: 700 }} />
        </Tabs>

        {/* Razorpay Tab */}
        {tab === 0 && (
          <Box sx={{ p: { xs: 2, md: 4 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Razorpay Settings</Typography>
              <FormControlLabel 
                control={<Switch checked={gateways.razorpay.is_active} onChange={e => updateActive('razorpay', e.target.checked)} color="success" />} 
                label={<Typography sx={{ fontWeight: 700, color: gateways.razorpay.is_active ? 'success.main' : 'text.disabled' }}>{gateways.razorpay.is_active ? 'Active' : 'Inactive'}</Typography>} 
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              Used for processing Indian Rupee (INR) transactions.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField 
                label="Live Key ID" 
                fullWidth 
                value={gateways.razorpay.config.key_id} 
                onChange={e => updateConfig('razorpay', 'key_id', e.target.value)} 
              />
              <TextField 
                label="Live Key Secret" 
                type="password"
                fullWidth 
                value={gateways.razorpay.config.key_secret} 
                onChange={e => updateConfig('razorpay', 'key_secret', e.target.value)} 
              />
            </Box>

            <Divider sx={{ my: 4 }} />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button 
                variant="contained" 
                size="large"
                startIcon={<SaveIcon />}
                onClick={() => handleSave('razorpay')}
                disabled={saving}
                sx={{ borderRadius: '100px', fontWeight: 800, px: 4, py: 1.5, boxShadow: '0 4px 14px rgba(13,110,253,0.3)' }}
              >
                {saving ? 'Saving...' : 'Save Razorpay Configuration'}
              </Button>
            </Box>
          </Box>
        )}

        {/* PayPal Tab */}
        {tab === 1 && (
          <Box sx={{ p: { xs: 2, md: 4 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>PayPal Settings</Typography>
              <FormControlLabel 
                control={<Switch checked={gateways.paypal.is_active} onChange={e => updateActive('paypal', e.target.checked)} color="success" />} 
                label={<Typography sx={{ fontWeight: 700, color: gateways.paypal.is_active ? 'success.main' : 'text.disabled' }}>{gateways.paypal.is_active ? 'Active' : 'Inactive'}</Typography>} 
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              Used for processing US Dollar (USD) transactions.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField 
                label="Live Client ID" 
                fullWidth 
                value={gateways.paypal.config.client_id} 
                onChange={e => updateConfig('paypal', 'client_id', e.target.value)} 
              />
              <TextField 
                label="Live Secret Key" 
                type="password"
                fullWidth 
                value={gateways.paypal.config.secret} 
                onChange={e => updateConfig('paypal', 'secret', e.target.value)} 
              />
            </Box>

            <Divider sx={{ my: 4 }} />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button 
                variant="contained" 
                size="large"
                startIcon={<SaveIcon />}
                onClick={() => handleSave('paypal')}
                disabled={saving}
                sx={{ borderRadius: '100px', fontWeight: 800, px: 4, py: 1.5, boxShadow: '0 4px 14px rgba(13,110,253,0.3)' }}
              >
                {saving ? 'Saving...' : 'Save PayPal Configuration'}
              </Button>
            </Box>
          </Box>
        )}

        {/* Bank Transfer Tab */}
        {tab === 2 && (
          <Box sx={{ p: { xs: 2, md: 4 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Bank Transfer Settings</Typography>
              <FormControlLabel 
                control={<Switch checked={gateways.bank.is_active} onChange={e => updateActive('bank', e.target.checked)} color="success" />} 
                label={<Typography sx={{ fontWeight: 700, color: gateways.bank.is_active ? 'success.main' : 'text.disabled' }}>{gateways.bank.is_active ? 'Active' : 'Inactive'}</Typography>} 
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              Used for manual bank transfer or NEFT/RTGS payments.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField 
                label="Bank Name" 
                fullWidth 
                value={gateways.bank.config.bank_name} 
                onChange={e => updateConfig('bank', 'bank_name', e.target.value)} 
              />
              <TextField 
                label="Account Number" 
                fullWidth 
                value={gateways.bank.config.account_no} 
                onChange={e => updateConfig('bank', 'account_no', e.target.value)} 
              />
              <Box sx={{ display: 'flex', gap: 3 }}>
                <TextField 
                  label="IFSC Code" 
                  fullWidth 
                  value={gateways.bank.config.ifsc} 
                  onChange={e => updateConfig('bank', 'ifsc', e.target.value)} 
                />
                <TextField 
                  label="SWIFT Code (Optional)" 
                  fullWidth 
                  value={gateways.bank.config.swift} 
                  onChange={e => updateConfig('bank', 'swift', e.target.value)} 
                />
              </Box>
              <TextField 
                label="Additional Details (e.g. UPI ID or Account Name)" 
                multiline
                rows={2}
                fullWidth 
                value={gateways.bank.config.details} 
                onChange={e => updateConfig('bank', 'details', e.target.value)} 
              />
            </Box>

            <Divider sx={{ my: 4 }} />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button 
                variant="contained" 
                size="large"
                startIcon={<SaveIcon />}
                onClick={() => handleSave('bank')}
                disabled={saving}
                sx={{ borderRadius: '100px', fontWeight: 800, px: 4, py: 1.5, boxShadow: '0 4px 14px rgba(13,110,253,0.3)' }}
              >
                {saving ? 'Saving...' : 'Save Bank Configuration'}
              </Button>
            </Box>
          </Box>
        )}
      </Paper>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}>
        <Box sx={{ bgcolor: snack.severity === 'error' ? 'error.main' : snack.severity === 'warning' ? 'warning.main' : 'success.main', color: '#fff', px: 3, py: 1.5, borderRadius: '8px', fontWeight: 600 }}>
          {snack.message}
        </Box>
      </Snackbar>
    </Box>
  );
}
