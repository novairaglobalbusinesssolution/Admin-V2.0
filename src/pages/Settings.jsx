import { useState, useContext, useEffect } from 'react';
import { 
  Box,
  Autocomplete, Typography, Paper, Tabs, Tab, TextField, Button, 
  Grid, Divider, useTheme, FormControlLabel, Radio, RadioGroup,
  useMediaQuery, InputAdornment, IconButton, Snackbar, Alert, CircularProgress
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import LockResetIcon from '@mui/icons-material/LockReset';
import PaletteIcon from '@mui/icons-material/Palette';
import InfoIcon from '@mui/icons-material/Info';
import SaveIcon from '@mui/icons-material/Save';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import ComputerIcon from '@mui/icons-material/Computer';
import NotificationsIcon from '@mui/icons-material/Notifications';

import { ColorModeContext } from '../App';
import { supabase } from '../supabaseClient';
import SmtpSettings from './SmtpSettings';

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other} style={{ height: '100%' }}>
      {value === index && (
        <Box sx={{ p: { xs: 2, md: 4 }, height: '100%' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export default function Settings() {
  const theme = useTheme();
  const colorMode = useContext(ColorModeContext);
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [tabValue, setTabValue] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);

  // Snackbar
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  // States for forms
  const [profile, setProfile] = useState({ id: null, name: '', email: '' });
  const [smtp, setSmtp] = useState({ id: null, host: '', port: '', user: '', pass: '', encrypt: 'TLS', senderName: '', senderEmail: '' });
  const [password, setPassword] = useState({ current: '', new: '', confirm: '' });

  // Action states
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [notification, setNotification] = useState({ earnerId: '', title: '', body: '' });
  const [sendingPush, setSendingPush] = useState(false);
  const [earnersList, setEarnersList] = useState([]);

  useEffect(() => {
    fetchSettingsData();
  }, []);

  const fetchSettingsData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Profile Data
      const sessionString = localStorage.getItem('adminSession');
      if (sessionString) {
        const session = JSON.parse(sessionString);
        const { data: adminData, error: adminErr } = await supabase
          .from('admins')
          .select('id, name, email')
          .eq('id', session.id)
          .single();
          
        if (adminData && !adminErr) {
          setProfile({ id: adminData.id, name: adminData.name, email: adminData.email });
        }
      }

      // 2. Fetch SMTP Data (assuming the first/default record)
      const { data: smtpData, error: smtpErr } = await supabase
        .from('smtp_settings')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
        
      if (smtpData && !smtpErr) {
        setSmtp({ 
          id: smtpData.id,
          host: smtpData.host || '', 
          port: smtpData.port || '', 
          user: smtpData.username || '', 
          pass: smtpData.password || '', 
          encrypt: smtpData.encryption || 'TLS',
          senderName: smtpData.sender_name || '',
          senderEmail: smtpData.sender_email || ''
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
            // Fetch Earners List for Push Notifications
      const { data: earnersData } = await supabase
        .from('profiles')
        .select('earner_id, first_name, last_name, phone')
        .order('created_at', { ascending: false });
      if (earnersData) {
        setEarnersList(earnersData);
      }
    }
      setLoading(false);
    };

  const handleSaveProfile = async () => {
    if (!profile.id) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase.from('admins').update({
        name: profile.name,
        email: profile.email
      }).eq('id', profile.id);
      
      if (error) throw error;
      
      // Update local storage session
      const sessionString = localStorage.getItem('adminSession');
      if (sessionString) {
        const session = JSON.parse(sessionString);
        localStorage.setItem('adminSession', JSON.stringify({ ...session, name: profile.name, email: profile.email }));
      }
      
      setSnack({ open: true, message: 'Profile updated successfully!', severity: 'success' });
    } catch (e) {
      setSnack({ open: true, message: e.message, severity: 'error' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveSmtp = async () => {
    setSavingSmtp(true);
    try {
      const payload = {
        host: smtp.host,
        port: parseInt(smtp.port) || 465,
        username: smtp.user,
        password: smtp.pass,
        encryption: smtp.encrypt,
        sender_name: smtp.senderName,
        sender_email: smtp.senderEmail,
        is_default: true,
        purpose: 'default'
      };

      if (smtp.id) {
        payload.id = smtp.id; // Upsert will update if UUID exists
      }

      const { error } = await supabase.from('smtp_settings').upsert(payload);
      
      if (error) throw error;
      setSnack({ open: true, message: 'SMTP settings saved!', severity: 'success' });
    } catch (e) {
      setSnack({ open: true, message: e.message, severity: 'error' });
    } finally {
      setSavingSmtp(false);
    }
  };

  
  const handleSendPush = async () => {
    if (!notification.earnerId || !notification.title || !notification.body) {
      setSnack({ open: true, message: 'Please fill all fields', severity: 'warning' });
      return;
    }
    setSendingPush(true);
    try {
      // Call backend API
      const response = await fetch(`${import.meta.env.DEV ? 'http://localhost:5000' : 'https://admin-v2-backend.onrender.com'}/api/send-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          earner_id: notification.earnerId,
          title: notification.title,
          body: notification.body
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send notification');
      
      setSnack({ open: true, message: 'Push notification sent successfully!', severity: 'success' });
      setNotification({ earnerId: '', title: '', body: '' });
    } catch (e) {
      setSnack({ open: true, message: e.message, severity: 'error' });
    } finally {
      setSendingPush(false);
    }
  };

  if (loading) {
    return <Box sx={{ p: 10, textAlign: 'center' }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 1, pb: 10 }}>
      
      <Box sx={{ mb: 4, px: { xs: 1, md: 0 } }}>
        <Typography variant="h5" sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 600 }}>
          System Settings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage your profile, security, and global application preferences.
        </Typography>
      </Box>

      <Paper elevation={0} sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', md: 'row' },
        borderRadius: '24px', 
        overflow: 'hidden',
        border: theme.palette.mode === 'light' ? `1px solid ${theme.palette.divider}` : 'none',
        minHeight: '600px'
      }}>
        
        {/* TABS SIDEBAR */}
        <Box sx={{ 
          borderRight: { xs: 'none', md: `1px solid ${theme.palette.divider}` },
          borderBottom: { xs: `1px solid ${theme.palette.divider}`, md: 'none' },
          bgcolor: theme.palette.mode === 'light' ? '#fcfcfc' : 'background.paper',
          width: { xs: '100%', md: '280px' },
          flexShrink: 0
        }}>
          <Tabs 
            orientation={isMobile ? 'horizontal' : 'vertical'}
            variant={isMobile ? 'scrollable' : 'standard'}
            scrollButtons="auto"
            value={tabValue} 
            onChange={(e, v) => setTabValue(v)} 
            sx={{ 
              '& .MuiTabs-indicator': { 
                width: { md: '4px' }, 
                borderRadius: '10px' 
              },
              '& .MuiTab-root': {
                alignItems: { xs: 'center', md: 'flex-start' },
                textAlign: 'left',
                justifyContent: 'flex-start',
                py: { xs: 2, md: 2.5 },
                px: 3,
                minHeight: '64px',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.95rem',
                color: 'text.secondary'
              },
              '& .Mui-selected': {
                bgcolor: theme.palette.mode === 'light' ? 'primary.50' : 'rgba(13,110,253,0.1)',
              }
            }}
          >
            <Tab icon={<PersonIcon sx={{ mr: { md: 2 } }} />} iconPosition={isMobile ? "top" : "start"} label="Profile" />
            <Tab icon={<EmailIcon sx={{ mr: { md: 2 } }} />} iconPosition={isMobile ? "top" : "start"} label="SMTP Settings" />
            <Tab icon={<LockResetIcon sx={{ mr: { md: 2 } }} />} iconPosition={isMobile ? "top" : "start"} label="Security" />
            <Tab icon={<PaletteIcon sx={{ mr: { md: 2 } }} />} iconPosition={isMobile ? "top" : "start"} label="Theme" />
            <Tab icon={<InfoIcon sx={{ mr: { md: 2 } }} />} iconPosition={isMobile ? "top" : "start"} label="System Info" />
            <Tab icon={<NotificationsIcon sx={{ mr: { md: 2 } }} />} iconPosition={isMobile ? "top" : "start"} label="Push Notifications" />
          </Tabs>
        </Box>

        {/* TABS CONTENT */}
        <Box sx={{ flexGrow: 1, bgcolor: 'background.paper' }}>
          
          {/* 1. PROFILE */}
          <TabPanel value={tabValue} index={0}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>Administrator Profile</Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <TextField 
                  fullWidth label="Full Name" value={profile.name} 
                  onChange={e => setProfile({...profile, name: e.target.value})}
                  sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
                <TextField 
                  fullWidth label="Email Address" type="email" value={profile.email} 
                  onChange={e => setProfile({...profile, email: e.target.value})}
                  sx={{ mb: 4, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
                <Button 
                  variant="contained" startIcon={<SaveIcon />} disableElevation 
                  onClick={handleSaveProfile} disabled={savingProfile}
                  sx={{ borderRadius: '10px', px: 4, py: 1.5 }}
                >
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </Button>
              </Grid>
            </Grid>
          </TabPanel>

          {/* 2. SMTP SETTINGS */}
          <TabPanel value={tabValue} index={1}>
            <SmtpSettings />
          </TabPanel>

          {/* 3. PASSWORD RESET */}
          <TabPanel value={tabValue} index={2}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Change Password</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              Update your administrator account password.
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <TextField 
                  fullWidth label="Current Password" type="password" value={password.current} 
                  onChange={e => setPassword({...password, current: e.target.value})}
                  sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
                <Divider sx={{ mb: 3 }} />
                <TextField 
                  fullWidth label="New Password" type="password" value={password.new} 
                  onChange={e => setPassword({...password, new: e.target.value})}
                  sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
                <TextField 
                  fullWidth label="Confirm New Password" type="password" value={password.confirm} 
                  onChange={e => setPassword({...password, confirm: e.target.value})}
                  sx={{ mb: 4, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
                <Button variant="contained" color="error" disableElevation sx={{ borderRadius: '10px', px: 4, py: 1.5 }}>
                  Update Password
                </Button>
              </Grid>
            </Grid>
          </TabPanel>

          {/* 4. THEME MODE SET */}
          <TabPanel value={tabValue} index={3}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Appearance</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              Customize how the admin dashboard looks on your device.
            </Typography>

            <Box sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: '16px', maxWidth: '400px' }}>
              <RadioGroup 
                value={theme.palette.mode} 
                onChange={colorMode.toggleColorMode} 
              >
                <FormControlLabel 
                  value="light" 
                  control={<Radio />} 
                  label={<Typography sx={{ fontWeight: 500 }}>Light Mode</Typography>} 
                  sx={{ mb: 1 }}
                />
                <FormControlLabel 
                  value="dark" 
                  control={<Radio />} 
                  label={<Typography sx={{ fontWeight: 500 }}>Dark Mode</Typography>} 
                />
              </RadioGroup>
            </Box>
          </TabPanel>

          {/* 5. SYSTEM INFO */}
          <TabPanel value={tabValue} index={4}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 4, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <ComputerIcon color="primary" /> System Information
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Box sx={{ p: 3, bgcolor: theme.palette.mode === 'light' ? 'primary.50' : 'rgba(13,110,253,0.05)', borderRadius: '16px' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>Software Version</Typography>
                  <Typography variant="h6" color="primary" sx={{ fontWeight: 800 }}>Novaira Admin v2.0.0</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: '16px' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>Framework</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>React 18 / Vite</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: '16px' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>Database</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>Supabase (PostgreSQL)</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: '16px' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>Server Environment</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>Node.js Backend</Typography>
                </Box>
              </Grid>
            </Grid>

          </TabPanel>

        </Box>

        {/* PUSH NOTIFICATIONS */}
        <TabPanel value={tabValue} index={5}>
          <Typography variant="h6" fontWeight="600" mb={3}>Send Test Push Notification</Typography>
          <Grid container spacing={3} sx={{ maxWidth: 600 }}>
            <Grid item xs={12}>
              <Autocomplete
                options={earnersList}
                getOptionLabel={(option) => `${option.first_name || ''} ${option.last_name || ''} - ${option.earner_id} (${option.phone || 'No phone'})`}
                onChange={(event, newValue) => {
                  setNotification({ ...notification, earnerId: newValue ? newValue.earner_id : '' });
                }}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    label="Select Target Earner" 
                    placeholder="Search by Name, Phone or ID..."
                  />
                )}
                isOptionEqualToValue={(option, value) => option.earner_id === value.earner_id}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField 
                fullWidth 
                label="Notification Title" 
                placeholder="e.g. Congratulations! 🎉"
                value={notification.title}
                onChange={(e) => setNotification({...notification, title: e.target.value})}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField 
                fullWidth 
                label="Notification Body (Message)" 
                multiline
                rows={3}
                placeholder="e.g. Your payout has been processed successfully."
                value={notification.body}
                onChange={(e) => setNotification({...notification, body: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sx={{ mt: 2 }}>
              <Button 
                variant="contained" 
                size="large" 
                disableElevation
                startIcon={sendingPush ? <CircularProgress size={20} color="inherit" /> : <NotificationsIcon />}
                disabled={sendingPush}
                onClick={handleSendPush}
                sx={{ borderRadius: '12px', px: 4, py: 1.5, textTransform: 'none', fontWeight: 600 }}
              >
                {sendingPush ? 'Sending...' : 'Send Test Notification'}
              </Button>
            </Grid>
            <Grid item xs={12} sx={{ mt: 3 }}>
              <Alert severity="info" sx={{ borderRadius: '12px' }}>
                For this to work, ensure the target Earner has installed the app, granted notification permissions, and their <b>fcm_token</b> is saved in the Supabase <b>profiles</b> table.
              </Alert>
            </Grid>
          </Grid>
        </TabPanel>

      </Paper>

      {/* SNACKBAR */}
      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({...snack, open: false})} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnack({...snack, open: false})} severity={snack.severity} sx={{ width: '100%', borderRadius: '12px' }}>
          {snack.message}
        </Alert>
      </Snackbar>

    </Box>
  );
}
