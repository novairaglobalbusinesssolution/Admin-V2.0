import { useState, useEffect, useMemo } from 'react';
import { 
  Box, Typography, Paper, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Card, CardContent, CircularProgress, Snackbar, Alert, RadioGroup, FormControlLabel, Radio, Switch,
  Autocomplete, Chip, useTheme, Tooltip, IconButton, Divider
} from '@mui/material';
import Swal from 'sweetalert2';

// MUI Icons
import SendIcon from '@mui/icons-material/Send';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import DevicesIcon from '@mui/icons-material/Devices';
import PhonelinkRingIcon from '@mui/icons-material/PhonelinkRing';
import SpeedIcon from '@mui/icons-material/Speed';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import LinkIcon from '@mui/icons-material/Link';
import ImageIcon from '@mui/icons-material/Image';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonIcon from '@mui/icons-material/Person';
import RefreshIcon from '@mui/icons-material/Refresh';
import ClearIcon from '@mui/icons-material/Clear';

import { supabase } from '../supabaseClient';
import { getApiBaseUrl, getApiHeaders } from '../utils/apiConfig';

const TEST_ACCOUNT_ID = 'NOVAIRA/INDIVIDUAL/CCFEE3D';

export default function PushNotifications() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  
  // Form State
  const [targetType, setTargetType] = useState('all'); // 'all' or 'selected'
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [image, setImage] = useState('');
  const [notiType, setNotiType] = useState('system'); // system, tasks, wallet
  
  const [onlyActiveDevices, setOnlyActiveDevices] = useState(true);
  const [sending, setSending] = useState(false);
  const [lastSpeed, setLastSpeed] = useState('~300ms');
  const [snack, setSnack] = useState({ open: false, message: '', type: 'success' });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      // Fetch up to 5000 users and specifically ensure TEST_ACCOUNT_ID is included
      const [{ data, error }, { data: testUserData }] = await Promise.all([
        supabase
          .from('profiles')
          .select('earner_id, first_name, last_name, email, phone, fcm_token')
          .order('created_at', { ascending: false })
          .limit(5000),
        supabase
          .from('profiles')
          .select('earner_id, first_name, last_name, email, phone, fcm_token')
          .eq('earner_id', TEST_ACCOUNT_ID)
          .maybeSingle()
      ]);

      let allUsers = data || [];
      if (allUsers.length === 0) {
        const apiBase = getApiBaseUrl();
        const res = await fetch(`${apiBase}/api/users`, { headers: getApiHeaders() });
        const json = await res.json();
        if (json.status === 'success') {
          allUsers = json.data || [];
        }
      }

      // Prepend or guarantee test account is in the users array
      if (testUserData && !allUsers.some(u => u.earner_id === testUserData.earner_id)) {
        allUsers = [testUserData, ...allUsers];
      }

      setUsers(allUsers);
    } catch (e) {
      console.error('fetchUsers error:', e);
      setSnack({ open: true, message: `Failed to load users: ${e.message}`, type: 'error' });
    } finally {
      setLoadingUsers(false);
    }
  };

  const activeDeviceCount = useMemo(() => {
    return users.filter(u => !!u.fcm_token).length;
  }, [users]);

  // Quick 1-click test selector for user's test account (always resilient)
  const handleSelectTestAccount = async () => {
    let testUser = users.find(u => u.earner_id === TEST_ACCOUNT_ID);
    if (!testUser) {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('earner_id, first_name, last_name, email, phone, fcm_token')
          .eq('earner_id', TEST_ACCOUNT_ID)
          .maybeSingle();
        if (data) {
          testUser = data;
          setUsers(prev => [data, ...prev]);
        }
      } catch (err) {
        console.error(err);
      }
    }

    if (testUser) {
      setTargetType('selected');
      setSelectedUsers([testUser]);
      setTitle('⚡ Novaira Admin Quick Test');
      setDescription(`Test verification sent to ${testUser.first_name || 'Subhadeep'} at light speed!`);
      setNotiType('system');
      setSnack({ open: true, message: `Selected test account: ${testUser.earner_id} (${testUser.first_name || 'Subhadeep'})`, type: 'info' });
    } else {
      setSnack({ open: true, message: `Test earner ${TEST_ACCOUNT_ID} could not be loaded`, type: 'warning' });
    }
  };

  const handleSend = async () => {
    if (!title.trim() || !description.trim()) {
      return setSnack({ open: true, message: 'Title and Description body are required', type: 'warning' });
    }

    if (targetType === 'selected') {
      if (selectedUsers.length === 0) {
        return setSnack({ open: true, message: 'Please select at least one earner to receive this alert', type: 'warning' });
      }
      const withTokens = selectedUsers.filter(u => !!u.fcm_token);
      if (withTokens.length === 0) {
        return setSnack({ 
          open: true, 
          message: 'The selected earner(s) have no active device token registered. Please select an active device.', 
          type: 'warning' 
        });
      }
    }

    const recipientCount = targetType === 'selected' 
      ? selectedUsers.filter(u => !!u.fcm_token).length 
      : activeDeviceCount;

    const confirmRes = await Swal.fire({
      title: 'Dispatch Push Broadcast?',
      html: `You are about to transmit this notification to <b>${recipientCount} active devices</b>.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Send Push',
      background: isDark ? '#1e293b' : '#ffffff',
      color: isDark ? '#ffffff' : '#000000'
    });

    if (!confirmRes.isConfirmed) return;

    setSending(true);
    const startTime = Date.now();
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/send-custom-notification`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          target: targetType,
          user_ids: selectedUsers.map(u => u.earner_id),
          tokens: targetType === 'selected' 
            ? selectedUsers.map(u => u.fcm_token).filter(Boolean)
            : users.map(u => u.fcm_token).filter(Boolean),
          title: title.trim(),
          body: description.trim(),
          link: link.trim(),
          image: image.trim(),
          type: notiType
        })
      });

      const elapsed = Date.now() - startTime;
      setLastSpeed(`${elapsed}ms`);

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        Swal.fire({
          title: 'Push Notification Sent! 🚀',
          text: `Successfully dispatched to ${data.successCount ?? recipientCount} devices in ${elapsed}ms.`,
          icon: 'success',
          background: isDark ? '#1e293b' : '#ffffff',
          color: isDark ? '#ffffff' : '#000000'
        });

        setTitle('');
        setDescription('');
        setLink('');
        setImage('');
        if (targetType === 'selected') setSelectedUsers([]);
      } else {
        throw new Error(data.error || 'Failed to dispatch notification');
      }
    } catch(e) {
      console.error(e);
      setSnack({ open: true, message: `Transmission Error: ${e.message}`, type: 'error' });
    } finally {
      setSending(false);
    }
  };

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
            <NotificationsActiveIcon sx={{ fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
              Push Notifications Broadcast Center
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Broadcast ultra-fast Firebase Cloud Messaging (FCM) alerts to mobile app earners in &lt;300ms light speed.
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            size="small"
            onClick={handleSelectTestAccount}
            startIcon={<FlashOnIcon sx={{ fontSize: 16 }} />}
            sx={{
              borderRadius: '12px',
              fontWeight: 800,
              fontSize: '0.8rem',
              textTransform: 'none',
              px: 2,
              py: 0.8,
              bgcolor: 'rgba(99,102,241,0.15)',
              color: '#6366f1',
              border: '1px solid rgba(99,102,241,0.3)',
              '&:hover': {
                bgcolor: 'rgba(99,102,241,0.25)'
              }
            }}
          >
            Quick Test: Subhadeep Jana
          </Button>

          <Button
            size="small"
            onClick={fetchUsers}
            startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
            sx={{
              borderRadius: '12px',
              fontWeight: 700,
              textTransform: 'none',
              px: 2,
              py: 0.8,
              color: 'text.primary',
              bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
            }}
          >
            Refresh Earners
          </Button>
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
        {/* KPI 1: Total Registered Earners */}
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
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Registered Earners
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
              {users.length}
            </Typography>
            <Typography variant="caption" sx={{ color: '#6366f1', fontWeight: 600 }}>
              Profiles in authentication DB
            </Typography>
          </Box>
        </Paper>

        {/* KPI 2: Active FCM Devices */}
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
            <DevicesIcon sx={{ fontSize: 26 }} />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active Devices
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1.2, color: '#10b981' }}>
              {activeDeviceCount}
            </Typography>
            <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 600 }}>
              Live FCM push tokens ready
            </Typography>
          </Box>
        </Paper>

        {/* KPI 3: Gateway Health */}
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
            <PhonelinkRingIcon sx={{ fontSize: 26 }} />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Backend Gateway
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 900, lineHeight: 1.2, color: '#06b6d4' }}>
              High-Speed Daemon
            </Typography>
            <Typography variant="caption" sx={{ color: '#06b6d4', fontWeight: 600 }}>
              Port 5000 / Dedicated Proxy
            </Typography>
          </Box>
        </Paper>

        {/* KPI 4: Transmission Velocity */}
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
            <SpeedIcon sx={{ fontSize: 26 }} />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Dispatch Velocity
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1.2, color: '#f59e0b' }}>
              {lastSpeed}
            </Typography>
            <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 600 }}>
              Non-blocking parallel multicast
            </Typography>
          </Box>
        </Paper>
      </Box>

      {/* 3. Main Composition Grid: Form Editor (65%) + Live Phone Mockup (35%) */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 390px' },
          gap: 3,
          alignItems: 'flex-start',
          width: '100%'
        }}
      >
        
        {/* ============================================================== */}
        {/* LEFT COLUMN: NOTIFICATION COMPOSER FORM                        */}
        {/* ============================================================== */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: '24px',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            width: '100%'
          }}
        >
          {/* Section 1: Target Audience */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                1. Target Audience & Distribution Scope
              </Typography>
              <Chip
                size="small"
                label={targetType === 'all' ? `All Active (${activeDeviceCount} devices)` : `${selectedUsers.length} earners selected`}
                sx={{
                  fontWeight: 800,
                  fontSize: '0.74rem',
                  bgcolor: targetType === 'all' ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)',
                  color: targetType === 'all' ? '#6366f1' : '#10b981',
                  borderRadius: '8px'
                }}
              />
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.5,
                p: 0.8,
                borderRadius: '16px',
                bgcolor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
              }}
            >
              <Paper
                elevation={0}
                onClick={() => setTargetType('all')}
                sx={{
                  p: 1.8,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  border: '1.5px solid',
                  borderColor: targetType === 'all' ? '#6366f1' : 'transparent',
                  bgcolor: targetType === 'all' ? (isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.1)') : 'transparent',
                  transition: 'all 0.2s ease',
                  '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 800, color: targetType === 'all' ? '#6366f1' : 'text.primary' }}>
                  📢 Broadcast to All Earners
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Delivers to all {activeDeviceCount} registered users with active device tokens.
                </Typography>
              </Paper>

              <Paper
                elevation={0}
                onClick={() => setTargetType('selected')}
                sx={{
                  p: 1.8,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  border: '1.5px solid',
                  borderColor: targetType === 'selected' ? '#10b981' : 'transparent',
                  bgcolor: targetType === 'selected' ? (isDark ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.1)') : 'transparent',
                  transition: 'all 0.2s ease',
                  '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 800, color: targetType === 'selected' ? '#10b981' : 'text.primary' }}>
                  🎯 Targeted Specific Earners
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Choose specific earners, search by name, earner ID, or phone number.
                </Typography>
              </Paper>
            </Box>

            {/* Targeted Selector (When selected) */}
            {targetType === 'selected' && (
              <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                    Search & Multi-Select Earners:
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={onlyActiveDevices}
                        onChange={(e) => setOnlyActiveDevices(e.target.checked)}
                        color="success"
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ fontWeight: 700, color: onlyActiveDevices ? '#10b981' : 'text.secondary' }}>
                        Active Devices Only ({activeDeviceCount})
                      </Typography>
                    }
                  />
                </Box>

                <Autocomplete
                  multiple
                  options={onlyActiveDevices ? users.filter(u => !!u.fcm_token) : users}
                  getOptionLabel={(option) => {
                    const name = option.first_name ? `${option.first_name} ${option.last_name || ''}`.trim() : (option.email || 'Unknown User');
                    const status = option.fcm_token ? '🟢 Active Device' : '⚪ No Device';
                    return `${name} (${option.earner_id}) - ${status}`;
                  }}
                  value={selectedUsers}
                  onChange={(e, newValue) => setSelectedUsers(newValue)}
                  loading={loadingUsers}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      placeholder="Search earner name, ID (e.g. CCFEE3D), or phone..."
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '14px',
                          bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                        }
                      }}
                    />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        key={option.earner_id || index}
                        size="small"
                        color={option.fcm_token ? "success" : "default"}
                        label={`${option.first_name || option.earner_id} (${option.fcm_token ? 'Active' : 'Offline'})`}
                        {...getTagProps({ index })}
                        sx={{ borderRadius: '8px', fontWeight: 700, fontSize: '0.72rem' }}
                      />
                    ))
                  }
                />
              </Box>
            )}
          </Box>

          <Divider sx={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />

          {/* Section 2: Notification Content */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              2. Notification Content & Visuals
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '2.5fr 1fr' },
                gap: 2,
                width: '100%'
              }}
            >
              <TextField
                fullWidth
                size="small"
                label="Notification Headline (Title) *"
                placeholder="e.g. 5 New High Payout Tasks Available! 🚀"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '14px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                  }
                }}
              />

              <FormControl fullWidth size="small">
                <InputLabel>Category Type</InputLabel>
                <Select
                  value={notiType}
                  onChange={(e) => setNotiType(e.target.value)}
                  label="Category Type"
                  sx={{
                    borderRadius: '14px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                  }}
                >
                  <MenuItem value="system">🔔 System Announcement</MenuItem>
                  <MenuItem value="tasks">💼 Task Deliverables</MenuItem>
                  <MenuItem value="wallet">💰 Wallet & Payout</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Notification Message Body *"
              placeholder="e.g. Complete reviews today to get instant wallet credits. Click here to claim your tasks..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '14px',
                  bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                }
              }}
            />

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: 2,
                width: '100%'
              }}
            >
              <TextField
                fullWidth
                size="small"
                label="Action Link (Deep link or URL)"
                placeholder="https:// or /tasks"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                InputProps={{
                  startAdornment: <LinkIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 18 }} />
                }}
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
                label="Image Banner URL (Optional)"
                placeholder="https://example.com/banner.jpg"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                InputProps={{
                  startAdornment: <ImageIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 18 }} />
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '14px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                  }
                }}
              />
            </Box>
          </Box>

          {/* Action Button Row */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 1, flexWrap: 'wrap', gap: 2 }}>
            <Button
              variant="text"
              onClick={() => {
                setTitle('');
                setDescription('');
                setLink('');
                setImage('');
              }}
              startIcon={<ClearIcon sx={{ fontSize: 16 }} />}
              sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700, color: 'text.secondary' }}
            >
              Reset Inputs
            </Button>

            <Button
              variant="contained"
              size="large"
              onClick={handleSend}
              disabled={sending || (!title && !description)}
              startIcon={sending ? <CircularProgress size={18} color="inherit" /> : <SendIcon sx={{ fontSize: 18 }} />}
              sx={{
                borderRadius: '14px',
                px: 5,
                py: 1.4,
                fontWeight: 800,
                fontSize: '0.9rem',
                textTransform: 'none',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                boxShadow: '0 6px 20px rgba(99,102,241,0.35)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)'
                }
              }}
            >
              {sending ? 'Dispatching at Light Speed...' : (targetType === 'all' ? `Broadcast to All (${activeDeviceCount} Devices)` : `Dispatch to Selected (${selectedUsers.length})`)}
            </Button>
          </Box>
        </Paper>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: LIVE LOCKSCREEN MOCKUP PREVIEW                   */}
        {/* ============================================================== */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: '24px',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2.5,
            width: '100%'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SmartphoneIcon sx={{ color: '#6366f1', fontSize: 22 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              Device Screen Mockup
            </Typography>
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', px: 1 }}>
            Visual preview of how your push payload appears in Android &amp; iOS notification drawers.
          </Typography>

          {/* Smartphone Frame */}
          <Box
            sx={{
              width: '100%',
              maxWidth: 340,
              borderRadius: '28px',
              border: '2px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)',
              bgcolor: isDark ? '#0b0f19' : '#f1f5f9',
              p: 2,
              boxShadow: isDark ? '0 12px 40px rgba(0,0,0,0.5)' : '0 12px 30px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: 2
            }}
          >
            {/* Phone Top Speaker & Camera Notch */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}>
              <Box sx={{ width: 60, height: 4, borderRadius: '4px', bgcolor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }} />
            </Box>

            {/* Notification Card Component */}
            <Box
              sx={{
                borderRadius: '16px',
                p: 2,
                bgcolor: isDark ? 'rgba(30,41,59,0.9)' : '#ffffff',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: 1
              }}
            >
              {/* App Meta Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <Box
                    sx={{
                      width: 18,
                      height: 18,
                      borderRadius: '5px',
                      background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '10px',
                      fontWeight: 900
                    }}
                  >
                    N
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.72rem', color: '#6366f1' }}>
                    Novaira • {notiType.toUpperCase()}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                  now
                </Typography>
              </Box>

              {/* Title & Body */}
              <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '0.84rem', lineHeight: 1.3 }}>
                {title || 'High Payout Tasks Available! 🚀'}
              </Typography>
              
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.74rem', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {description || 'Complete Google Play Store review tasks today and claim your instant cash reward.'}
              </Typography>

              {/* Banner Image Preview */}
              {image && (
                <Box
                  sx={{
                    width: '100%',
                    height: 110,
                    borderRadius: '10px',
                    backgroundImage: `url(${image})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    mt: 0.5,
                    border: '1px solid',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
                  }}
                />
              )}
            </Box>

            {/* Simulated Phone Home Bar */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
              <Box sx={{ width: 100, height: 4, borderRadius: '4px', bgcolor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }} />
            </Box>
          </Box>
        </Paper>

      </Box>

      {/* Global Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snack.type}
          variant="filled"
          sx={{ borderRadius: '14px', fontWeight: 700, fontSize: '0.85rem' }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
