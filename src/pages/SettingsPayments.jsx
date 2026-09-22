import { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, TextField, Button, Grid, 
  Snackbar, Alert, CircularProgress, useTheme, InputAdornment 
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import PaymentIcon from '@mui/icons-material/Payment';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import { supabase } from '../supabaseClient';

export default function SettingsPayments() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const [settings, setSettings] = useState({
    upi_min_regular: '',
    upi_first_time: '',
    bank_min_regular: '',
    bank_first_time: '',
    mobile_min_regular: '',
    mobile_first_time: ''
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('individual_payment_settings')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error; // Ignore if no row yet
      
      if (data) {
        setSettings(data);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
      setSnack({ open: true, message: 'Failed to load settings', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setSettings(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        id: 1,
        upi_min_regular: parseFloat(settings.upi_min_regular) || 0,
        upi_first_time: parseFloat(settings.upi_first_time) || 0,
        bank_min_regular: parseFloat(settings.bank_min_regular) || 0,
        bank_first_time: parseFloat(settings.bank_first_time) || 0,
        mobile_min_regular: parseFloat(settings.mobile_min_regular) || 0,
        mobile_first_time: parseFloat(settings.mobile_first_time) || 0,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('individual_payment_settings')
        .upsert(payload, { onConflict: 'id' });

      if (error) throw error;
      setSnack({ open: true, message: 'Individual Payment Settings updated successfully!', severity: 'success' });
    } catch (err) {
      console.error('Save error:', err);
      setSnack({ open: true, message: 'Failed to save settings: ' + err.message, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  const surfaceLow = theme.palette.mode === 'light' ? '#f5f5f5' : '#1e1e1e';

  return (
    <Box sx={{ p: { xs: 1, md: 3 }, pb: 10, maxWidth: 1000, mx: 'auto' }}>
      
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 800 }}>
          Individual Payment Settings
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Configure withdrawal limits and minimums for individuals.
        </Typography>
      </Box>

      {/* UPI Settings */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: '24px', border: `1px solid ${theme.palette.divider}`, bgcolor: 'background.paper' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Box sx={{ p: 1, borderRadius: '12px', bgcolor: surfaceLow }}>
            <PaymentIcon color="primary" />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>UPI Withdrawals</Typography>
        </Box>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="1st Time Withdrawal Limit"
              name="upi_first_time"
              type="number"
              value={settings.upi_first_time}
              onChange={handleChange}
              InputProps={{
                startAdornment: <InputAdornment position="start">₹</InputAdornment>,
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Minimum for Regular User"
              name="upi_min_regular"
              type="number"
              value={settings.upi_min_regular}
              onChange={handleChange}
              InputProps={{
                startAdornment: <InputAdornment position="start">₹</InputAdornment>,
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Bank Settings */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: '24px', border: `1px solid ${theme.palette.divider}`, bgcolor: 'background.paper' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Box sx={{ p: 1, borderRadius: '12px', bgcolor: surfaceLow }}>
            <AccountBalanceIcon color="secondary" />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Bank Transfers</Typography>
        </Box>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="1st Time Withdrawal Limit"
              name="bank_first_time"
              type="number"
              value={settings.bank_first_time}
              onChange={handleChange}
              InputProps={{
                startAdornment: <InputAdornment position="start">₹</InputAdornment>,
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Minimum for Regular User"
              name="bank_min_regular"
              type="number"
              value={settings.bank_min_regular}
              onChange={handleChange}
              InputProps={{
                startAdornment: <InputAdornment position="start">₹</InputAdornment>,
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Mobile Recharge Settings */}
      <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: '24px', border: `1px solid ${theme.palette.divider}`, bgcolor: 'background.paper' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Box sx={{ p: 1, borderRadius: '12px', bgcolor: surfaceLow }}>
            <PhoneAndroidIcon color="success" />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Mobile Prepaid Recharge</Typography>
        </Box>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="1st Time Recharge Limit"
              name="mobile_first_time"
              type="number"
              value={settings.mobile_first_time}
              onChange={handleChange}
              InputProps={{
                startAdornment: <InputAdornment position="start">₹</InputAdornment>,
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Minimum for Regular User"
              name="mobile_min_regular"
              type="number"
              value={settings.mobile_min_regular}
              onChange={handleChange}
              InputProps={{
                startAdornment: <InputAdornment position="start">₹</InputAdornment>,
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Save Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          size="large"
          startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving}
          sx={{ borderRadius: '100px', px: 5, py: 1.5, fontWeight: 800, fontSize: '0.9rem', boxShadow: '0 4px 14px rgba(13,110,253,0.4)' }}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Box>

      <Snackbar 
        open={snack.open} 
        autoHideDuration={4000} 
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} sx={{ width: '100%', borderRadius: '12px' }}>
          {snack.message}
        </Alert>
      </Snackbar>

    </Box>
  );
}
