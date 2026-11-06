import { useState, useContext, useEffect } from 'react';
import { 
  Box, Typography, Paper, TextField, Button, 
  Divider, useTheme, FormControlLabel, Radio, RadioGroup,
  useMediaQuery, IconButton, Snackbar, Alert, CircularProgress,
  Chip, Autocomplete, Tooltip
} from '@mui/material';

// Icons
import SettingsIcon from '@mui/icons-material/Settings';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import LockResetIcon from '@mui/icons-material/LockReset';
import PaletteIcon from '@mui/icons-material/Palette';
import InfoIcon from '@mui/icons-material/Info';
import SaveIcon from '@mui/icons-material/Save';
import ComputerIcon from '@mui/icons-material/Computer';
import NotificationsIcon from '@mui/icons-material/Notifications';
import StorageIcon from '@mui/icons-material/Storage';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import DnsIcon from '@mui/icons-material/Dns';
import SecurityIcon from '@mui/icons-material/Security';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import RefreshIcon from '@mui/icons-material/Refresh';

import { ColorModeContext } from '../App';
import { supabase } from '../supabaseClient';
import SmtpSettings from './SmtpSettings';
import { getApiBaseUrl, getApiHeaders } from '../utils/apiConfig';

const TEST_ACCOUNT_ID = 'NOVAIRA/INDIVIDUAL/CCFEE3D';

export default function Settings() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const colorMode = useContext(ColorModeContext);
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);

  // Feedback Snackbar
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  // Profile State
  const [profile, setProfile] = useState({ id: null, name: 'Admin', email: 'admin@novaira.com' });
  const [savingProfile, setSavingProfile] = useState(false);

  // Security / Password State
  const [password, setPassword] = useState({ current: '', new: '', confirm: '' });
  const [savingPassword, setSavingPassword] = useState(false);

  // Push Notification Test State
  const [notification, setNotification] = useState({ earnerId: TEST_ACCOUNT_ID, title: '⚡ Novaira Admin System Test', body: 'Push notification engine operating at light speed!' });
  const [sendingPush, setSendingPush] = useState(false);
  const [earnersList, setEarnersList] = useState([]);

  // Backend Health Ping
  const [backendHealth, setBackendHealth] = useState({ status: 'checking', ping: null });

  useEffect(() => {
    fetchSettingsData();
    checkBackendHealth();
  }, []);

  const checkBackendHealth = async () => {
    const start = Date.now();
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/health`);
      const data = await res.json();
      if (data.status === 'success') {
        setBackendHealth({ status: 'online', ping: Date.now() - start });
      } else {
        setBackendHealth({ status: 'degraded', ping: Date.now() - start });
      }
    } catch {
      setBackendHealth({ status: 'offline', ping: null });
    }
  };

  const fetchSettingsData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Profile Data
      const sessionString = localStorage.getItem('adminSession');
      if (sessionString) {
        const session = JSON.parse(sessionString);
        if (session.id) {
          const { data: adminData } = await supabase
            .from('admins')
            .select('id, name, email')
            .eq('id', session.id)
            .maybeSingle();
            
          if (adminData) {
            setProfile({ id: adminData.id, name: adminData.name, email: adminData.email });
          } else {
            setProfile({ id: session.id, name: session.name || 'Master Admin', email: session.email || 'admin@novaira.com' });
          }
        }
      }

      // 2. Fetch Earners for Quick Push Test
      const { data: earnersData } = await supabase
        .from('profiles')
        .select('earner_id, first_name, last_name, phone, fcm_token')
        .order('created_at', { ascending: false });
      if (earnersData) {
        setEarnersList(earnersData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile.name || !profile.email) {
      return setSnack({ open: true, message: 'Please enter both name and email', severity: 'warning' });
    }
    setSavingProfile(true);
    try {
      if (profile.id) {
        const { error } = await supabase.from('admins').update({
          name: profile.name,
          email: profile.email
        }).eq('id', profile.id);
        if (error) throw error;
      }
      
      const sessionString = localStorage.getItem('adminSession');
      if (sessionString) {
        const session = JSON.parse(sessionString);
        localStorage.setItem('adminSession', JSON.stringify({ ...session, name: profile.name, email: profile.email }));
      }
      
      setSnack({ open: true, message: 'Administrator profile saved successfully!', severity: 'success' });
    } catch (e) {
      setSnack({ open: true, message: e.message, severity: 'error' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!password.new || !password.confirm) {
      return setSnack({ open: true, message: 'Please fill in the new password fields', severity: 'warning' });
    }
    if (password.new !== password.confirm) {
      return setSnack({ open: true, message: 'New passwords do not match', severity: 'warning' });
    }
    if (password.new.length < 6) {
      return setSnack({ open: true, message: 'Password must be at least 6 characters long', severity: 'warning' });
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: password.new });
      if (error) throw error;
      setSnack({ open: true, message: 'Password updated successfully!', severity: 'success' });
      setPassword({ current: '', new: '', confirm: '' });
    } catch (e) {
      setSnack({ open: true, message: e.message, severity: 'error' });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSendPush = async () => {
    if (!notification.earnerId || !notification.title || !notification.body) {
      setSnack({ open: true, message: 'Please fill all fields: earner, title, and body', severity: 'warning' });
      return;
    }
    setSendingPush(true);
    const start = Date.now();
    try {
      const apiBase = getApiBaseUrl();
      const response = await fetch(`${apiBase}/api/send-notification`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          earner_id: notification.earnerId,
          title: notification.title,
          body: notification.body
        })
      });
      const data = await response.json();
      const elapsed = Date.now() - start;
      if (!response.ok || data.status !== 'success') throw new Error(data.error || 'Failed to dispatch notification');
      
      setSnack({ open: true, message: `Push notification delivered to ${notification.earnerId} in ${elapsed}ms!`, severity: 'success' });
    } catch (e) {
      setSnack({ open: true, message: `Notification Error: ${e.message}`, severity: 'error' });
    } finally {
      setSendingPush(false);
    }
  };

  const tabsConfig = [
    { label: 'Profile', icon: <PersonIcon sx={{ fontSize: 18 }} /> },
    { label: 'SMTP Gateways', icon: <EmailIcon sx={{ fontSize: 18 }} /> },
    { label: 'Security & Auth', icon: <LockResetIcon sx={{ fontSize: 18 }} /> },
    { label: 'Appearance', icon: <PaletteIcon sx={{ fontSize: 18 }} /> },
    { label: 'System Architecture', icon: <ComputerIcon sx={{ fontSize: 18 }} /> },
    { label: 'Push Diagnostics', icon: <NotificationsIcon sx={{ fontSize: 18 }} /> }
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 12, gap: 2 }}>
        <CircularProgress size={40} sx={{ color: '#6366f1' }} />
        <Typography variant="body2" color="text.secondary">Loading system preferences...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 3, pb: 8 }}>
      
      {/* 1. Header Pod: Glassmorphic Executive Bar */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: '24px',
          border: '1px solid',
          borderColor: isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.2)',
          background: isDark
            ? 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(15,23,42,0.85) 100%)'
            : 'linear-gradient(135deg, rgba(238,242,255,0.85) 0%, rgba(255,255,255,0.95) 100%)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
          width: '100%'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 8px 24px rgba(99,102,241,0.35)'
            }}
          >
            <SettingsIcon sx={{ fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
              System Command & Global Settings
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage administrator identity, SMTP gateways, visual theming, multi-database routing, and security.
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Chip
            icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
            label={`Backend: ${backendHealth.status === 'online' ? `Online (${backendHealth.ping}ms)` : backendHealth.status.toUpperCase()}`}
            sx={{
              fontWeight: 800,
              fontSize: '0.8rem',
              py: 2,
              px: 0.5,
              borderRadius: '12px',
              bgcolor: backendHealth.status === 'online' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              color: backendHealth.status === 'online' ? '#10b981' : '#ef4444',
              border: '1px solid',
              borderColor: backendHealth.status === 'online' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'
            }}
          />
          <IconButton
            size="small"
            onClick={checkBackendHealth}
            sx={{
              borderRadius: '12px',
              bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
            }}
          >
            <RefreshIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Paper>

      {/* 2. Top 4 Executive KPI Telemetry Pods */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
          gap: 2,
          width: '100%'
        }}
      >
        {/* KPI 1: Active Admin */}
        <Paper
          elevation={0}
          sx={{
            p: 2.2,
            borderRadius: '20px',
            border: '1px solid',
            borderColor: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)',
            background: isDark
              ? 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(15,23,42,0.6) 100%)'
              : 'linear-gradient(135deg, rgba(238,242,255,0.7) 0%, rgba(255,255,255,0.9) 100%)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '14px',
              bgcolor: 'rgba(99,102,241,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6366f1'
            }}
          >
            <PersonIcon sx={{ fontSize: 26 }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Administrator
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 900, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile.name}
            </Typography>
            <Typography variant="caption" sx={{ color: '#6366f1', fontWeight: 600, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile.email}
            </Typography>
          </Box>
        </Paper>

        {/* KPI 2: Theme & Appearance */}
        <Paper
          elevation={0}
          sx={{
            p: 2.2,
            borderRadius: '20px',
            border: '1px solid',
            borderColor: isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)',
            background: isDark
              ? 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(15,23,42,0.6) 100%)'
              : 'linear-gradient(135deg, rgba(236,253,245,0.7) 0%, rgba(255,255,255,0.9) 100%)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '14px',
              bgcolor: 'rgba(16,185,129,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981'
            }}
          >
            {isDark ? <DarkModeIcon sx={{ fontSize: 26 }} /> : <LightModeIcon sx={{ fontSize: 26 }} />}
          </Box>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Visual Theme
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.2, color: '#10b981' }}>
              {isDark ? 'Dark Glass' : 'Light Pro'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 600 }}>
              Hardware-accelerated rendering
            </Typography>
          </Box>
        </Paper>

        {/* KPI 3: Database Clusters */}
        <Paper
          elevation={0}
          sx={{
            p: 2.2,
            borderRadius: '20px',
            border: '1px solid',
            borderColor: isDark ? 'rgba(6,182,212,0.2)' : 'rgba(6,182,212,0.15)',
            background: isDark
              ? 'linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(15,23,42,0.6) 100%)'
              : 'linear-gradient(135deg, rgba(236,254,255,0.7) 0%, rgba(255,255,255,0.9) 100%)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '14px',
              bgcolor: 'rgba(6,182,212,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#06b6d4'
            }}
          >
            <StorageIcon sx={{ fontSize: 26 }} />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Database Clusters
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.2, color: '#06b6d4' }}>
              5 Dedicated DBs
            </Typography>
            <Typography variant="caption" sx={{ color: '#06b6d4', fontWeight: 600 }}>
              Auth, Work, Pay, Chat, System
            </Typography>
          </Box>
        </Paper>

        {/* KPI 4: Security & Health */}
        <Paper
          elevation={0}
          sx={{
            p: 2.2,
            borderRadius: '20px',
            border: '1px solid',
            borderColor: isDark ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.15)',
            background: isDark
              ? 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(15,23,42,0.6) 100%)'
              : 'linear-gradient(135deg, rgba(254,243,199,0.7) 0%, rgba(255,255,255,0.9) 100%)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '14px',
              bgcolor: 'rgba(245,158,11,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f59e0b'
            }}
          >
            <SecurityIcon sx={{ fontSize: 26 }} />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Security Guard
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.2, color: '#f59e0b' }}>
              M-PIN &amp; API Guard
            </Typography>
            <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 600 }}>
              End-to-end token validation
            </Typography>
          </Box>
        </Paper>
      </Box>

      {/* 3. Main Settings Container: Sidebar / Navigation Tabs (Left) + Content (Right) */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '300px 1fr' },
          gap: 3,
          alignItems: 'flex-start',
          width: '100%'
        }}
      >
        {/* Navigation Sidebar */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: '24px',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            width: '100%'
          }}
        >
          <Typography variant="caption" sx={{ px: 1.5, py: 0.5, fontWeight: 800, color: 'text.secondary', letterSpacing: '0.04em' }}>
            CONFIGURATION PANELS
          </Typography>

          {tabsConfig.map((t, index) => {
            const isSelected = tabValue === index;
            return (
              <Box
                key={t.label}
                onClick={() => setTabValue(index)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.6,
                  borderRadius: '14px',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: '0.86rem',
                  transition: 'all 0.2s ease',
                  bgcolor: isSelected 
                    ? (isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.12)')
                    : 'transparent',
                  color: isSelected ? '#6366f1' : 'text.secondary',
                  border: '1px solid',
                  borderColor: isSelected ? 'rgba(99,102,241,0.3)' : 'transparent',
                  '&:hover': {
                    bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                    color: 'text.primary'
                  }
                }}
              >
                <Box sx={{ color: isSelected ? '#6366f1' : 'text.secondary' }}>
                  {t.icon}
                </Box>
                <Typography variant="body2" sx={{ fontWeight: isSelected ? 800 : 600 }}>
                  {t.label}
                </Typography>
              </Box>
            );
          })}
        </Paper>

        {/* Content Workspace */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: '24px',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(16px)',
            width: '100%',
            minHeight: 520
          }}
        >
          {/* TAB 0: PROFILE */}
          {tabValue === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 640 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Administrator Identity &amp; Profile
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Configure your primary administrative account information and display credentials.
                </Typography>
              </Box>

              <TextField
                fullWidth
                size="small"
                label="Administrator Full Name"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '14px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                  }
                }}
              />

              <TextField
                fullWidth
                size="small"
                type="email"
                label="Primary Email Address"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '14px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                  }
                }}
              />

              <Box sx={{ pt: 1 }}>
                <Button
                  variant="contained"
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  startIcon={savingProfile ? <CircularProgress size={16} color="inherit" /> : <SaveIcon sx={{ fontSize: 18 }} />}
                  sx={{
                    borderRadius: '14px',
                    px: 4,
                    py: 1.3,
                    fontWeight: 800,
                    textTransform: 'none',
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    boxShadow: '0 4px 16px rgba(99,102,241,0.35)'
                  }}
                >
                  {savingProfile ? 'Saving...' : 'Save Profile Changes'}
                </Button>
              </Box>
            </Box>
          )}

          {/* TAB 1: SMTP GATEWAYS */}
          {tabValue === 1 && (
            <Box sx={{ width: '100%' }}>
              <SmtpSettings />
            </Box>
          )}

          {/* TAB 2: SECURITY & PASSWORD */}
          {tabValue === 2 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 640 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Security &amp; Password Management
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Update your authentication password to ensure maximum security for platform operations.
                </Typography>
              </Box>

              <TextField
                fullWidth
                size="small"
                type="password"
                label="Current Password"
                value={password.current}
                onChange={(e) => setPassword({ ...password, current: e.target.value })}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '14px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                  }
                }}
              />

              <Divider sx={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />

              <TextField
                fullWidth
                size="small"
                type="password"
                label="New Password"
                value={password.new}
                onChange={(e) => setPassword({ ...password, new: e.target.value })}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '14px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                  }
                }}
              />

              <TextField
                fullWidth
                size="small"
                type="password"
                label="Confirm New Password"
                value={password.confirm}
                onChange={(e) => setPassword({ ...password, confirm: e.target.value })}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '14px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                  }
                }}
              />

              <Box sx={{ pt: 1 }}>
                <Button
                  variant="contained"
                  color="error"
                  onClick={handleUpdatePassword}
                  disabled={savingPassword}
                  startIcon={savingPassword ? <CircularProgress size={16} color="inherit" /> : <LockResetIcon sx={{ fontSize: 18 }} />}
                  sx={{
                    borderRadius: '14px',
                    px: 4,
                    py: 1.3,
                    fontWeight: 800,
                    textTransform: 'none',
                    boxShadow: 'none'
                  }}
                >
                  {savingPassword ? 'Updating...' : 'Update Password'}
                </Button>
              </Box>
            </Box>
          )}

          {/* TAB 3: APPEARANCE */}
          {tabValue === 3 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 640 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Visual Appearance &amp; Dashboard Theme
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Toggle between high-contrast dark glassmorphism and clean executive light presentation.
                </Typography>
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 2,
                  width: '100%'
                }}
              >
                {/* Light Mode Card */}
                <Paper
                  elevation={0}
                  onClick={() => { if (isDark) colorMode.toggleColorMode(); }}
                  sx={{
                    p: 2.5,
                    borderRadius: '18px',
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: !isDark ? '#6366f1' : 'transparent',
                    bgcolor: !isDark ? 'rgba(99,102,241,0.08)' : (isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)'),
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                    transition: 'all 0.2s ease',
                    '&:hover': { transform: 'translateY(-2px)' }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <LightModeIcon sx={{ color: '#f59e0b', fontSize: 26 }} />
                    {!isDark && <Chip size="small" label="Active" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 800, bgcolor: '#6366f1', color: '#fff' }} />}
                  </Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    Executive Light Mode
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Crisp, professional high-readability daylight workspace.
                  </Typography>
                </Paper>

                {/* Dark Mode Card */}
                <Paper
                  elevation={0}
                  onClick={() => { if (!isDark) colorMode.toggleColorMode(); }}
                  sx={{
                    p: 2.5,
                    borderRadius: '18px',
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: isDark ? '#6366f1' : 'transparent',
                    bgcolor: isDark ? 'rgba(99,102,241,0.18)' : (isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)'),
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                    transition: 'all 0.2s ease',
                    '&:hover': { transform: 'translateY(-2px)' }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <DarkModeIcon sx={{ color: '#6366f1', fontSize: 26 }} />
                    {isDark && <Chip size="small" label="Active" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 800, bgcolor: '#6366f1', color: '#fff' }} />}
                  </Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    Ultra-Premium Dark Glass
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Deep executive glassmorphic aesthetics with neon telemetry pods.
                  </Typography>
                </Paper>
              </Box>
            </Box>
          )}

          {/* TAB 4: SYSTEM INFO & ARCHITECTURE */}
          {tabValue === 4 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  System Architecture &amp; Multi-Cluster Overview
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Complete technical specification of the Novaira V2 distributed infrastructure.
                </Typography>
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 2,
                  width: '100%'
                }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: '18px',
                    bgcolor: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.04)',
                    border: '1px solid',
                    borderColor: 'rgba(99,102,241,0.2)'
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase' }}>Software Version</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 900, color: '#6366f1' }}>Novaira Admin Enterprise v2.1.0</Typography>
                  <Typography variant="caption" color="text.secondary">High-speed React 19 + Vite bundler</Typography>
                </Paper>

                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: '18px',
                    bgcolor: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.04)',
                    border: '1px solid',
                    borderColor: 'rgba(16,185,129,0.2)'
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase' }}>Database Multi-Cluster</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 900, color: '#10b981' }}>5 Independent Supabase Projects</Typography>
                  <Typography variant="caption" color="text.secondary">Zero quota bottlenecks, 100% free-tier compliance</Typography>
                </Paper>

                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: '18px',
                    bgcolor: isDark ? 'rgba(6,182,212,0.08)' : 'rgba(6,182,212,0.04)',
                    border: '1px solid',
                    borderColor: 'rgba(6,182,212,0.2)'
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase' }}>Backend API Gateway</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 900, color: '#06b6d4' }}>Node.js / Express Daemon</Typography>
                  <Typography variant="caption" color="text.secondary">Port 5000 (Local) + Render Cloud Gateway</Typography>
                </Paper>

                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: '18px',
                    bgcolor: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.04)',
                    border: '1px solid',
                    borderColor: 'rgba(245,158,11,0.2)'
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase' }}>Push &amp; Messaging</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 900, color: '#f59e0b' }}>Firebase Cloud Messaging</Typography>
                  <Typography variant="caption" color="text.secondary">Parallel multicast with &lt;300ms SLA</Typography>
                </Paper>
              </Box>
            </Box>
          )}

          {/* TAB 5: PUSH DIAGNOSTICS & TEST */}
          {tabValue === 5 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 680 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1.5 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    Push Notification Test Console
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Transmit a test payload to any specific earner device to verify delivery speed.
                  </Typography>
                </Box>

                <Button
                  size="small"
                  onClick={() => setNotification({
                    earnerId: TEST_ACCOUNT_ID,
                    title: '⚡ Novaira Admin Quick Test',
                    body: 'Verification alert for Subhadeep Jana.'
                  })}
                  startIcon={<FlashOnIcon sx={{ fontSize: 15 }} />}
                  sx={{
                    borderRadius: '10px',
                    textTransform: 'none',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    bgcolor: 'rgba(99,102,241,0.15)',
                    color: '#6366f1'
                  }}
                >
                  Target Subhadeep Jana
                </Button>
              </Box>

              <Autocomplete
                options={earnersList}
                getOptionLabel={(option) => `${option.first_name || ''} ${option.last_name || ''} (${option.earner_id}) - ${option.fcm_token ? '🟢 Active' : '⚪ Offline'}`}
                value={earnersList.find(e => e.earner_id === notification.earnerId) || null}
                onChange={(event, newValue) => {
                  setNotification({ ...notification, earnerId: newValue ? newValue.earner_id : '' });
                }}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    size="small"
                    label="Select Target Earner *" 
                    placeholder="Search by Name, Earner ID (CCFEE3D), or Phone..."
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '14px',
                        bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                      }
                    }}
                  />
                )}
                isOptionEqualToValue={(option, value) => option.earner_id === value.earner_id}
              />

              <TextField
                fullWidth
                size="small"
                label="Notification Title *"
                value={notification.title}
                onChange={(e) => setNotification({ ...notification, title: e.target.value })}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '14px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                  }
                }}
              />

              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notification Message Body *"
                value={notification.body}
                onChange={(e) => setNotification({ ...notification, body: e.target.value })}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '14px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                  }
                }}
              />

              <Box sx={{ pt: 1 }}>
                <Button
                  variant="contained"
                  onClick={handleSendPush}
                  disabled={sendingPush || !notification.earnerId || !notification.title}
                  startIcon={sendingPush ? <CircularProgress size={16} color="inherit" /> : <NotificationsIcon sx={{ fontSize: 18 }} />}
                  sx={{
                    borderRadius: '14px',
                    px: 4,
                    py: 1.3,
                    fontWeight: 800,
                    textTransform: 'none',
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    boxShadow: '0 4px 16px rgba(99,102,241,0.35)'
                  }}
                >
                  {sendingPush ? 'Dispatching Test...' : `Send Test Alert to ${notification.earnerId}`}
                </Button>
              </Box>
            </Box>
          )}
        </Paper>
      </Box>

      {/* Global Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snack.severity}
          variant="filled"
          sx={{ borderRadius: '14px', fontWeight: 700, fontSize: '0.85rem' }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
