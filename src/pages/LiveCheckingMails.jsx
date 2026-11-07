import { useState, useEffect, useMemo } from 'react';
import { 
  Box, Typography, Paper, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  useTheme, Snackbar, Alert, CircularProgress, Tooltip, IconButton, Switch, FormControlLabel,
  Chip, InputAdornment, Card, CardContent
} from '@mui/material';
import Swal from 'sweetalert2';

// Icons
import EmailIcon from '@mui/icons-material/Email';
import SendIcon from '@mui/icons-material/Send';
import ScheduleIcon from '@mui/icons-material/Schedule';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import StorageIcon from '@mui/icons-material/Storage';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import BusinessIcon from '@mui/icons-material/Business';
import ClearIcon from '@mui/icons-material/Clear';
import TodayIcon from '@mui/icons-material/Today';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import FlashOnIcon from '@mui/icons-material/FlashOn';

import { supabase } from '../supabaseClient';
import { getApiBaseUrl, getMailApiBaseUrl, getApiHeaders } from '../utils/apiConfig';

const getISTDateString = () => {
  const d = new Date();
  const istTime = new Date(d.getTime() + (330 * 60000));
  return istTime.toISOString().split('T')[0];
};

export default function LiveCheckingMails() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const todayIST = getISTDateString();

  // Data States
  const [apps, setApps] = useState([]);
  const [sponsorMap, setSponsorMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayIST);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // SMTP & Receivers
  const [smtps, setSmtps] = useState([]);
  const [selectedSmtp, setSelectedSmtp] = useState('');
  const [receivers, setReceivers] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  
  // Automated Cron Schedule
  const [cronTime, setCronTime] = useState('');
  const [cronActive, setCronActive] = useState(false);
  const [savingCron, setSavingCron] = useState(false);
  
  // Action Loading States
  const [sendingId, setSendingId] = useState(null);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [settingDefault, setSettingDefault] = useState(false);
  
  // Snackbar Feedback
  const [snack, setSnack] = useState({ open: false, message: '', type: 'success' });

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Apps matching selected live checking date
      const { data: appsData, error: appsErr } = await supabase
        .from('apps')
        .select('*')
        .eq('live_checking_date', selectedDate)
        .order('created_at', { ascending: false });

      if (appsErr) throw appsErr;
      
      // 2. Fetch clients and providers for sponsor mapping
      const [{ data: clients }, { data: providers }] = await Promise.all([
        supabase.from('clients').select('client_id, name'),
        supabase.from('providers').select('provider_id, name')
      ]);

      const map = {};
      if (clients) clients.forEach(c => { map[c.client_id] = c.name; });
      if (providers) providers.forEach(p => { map[p.provider_id] = p.name; });
      setSponsorMap(map);

      // 3. Fetch SMTP settings
      const { data: smtpData } = await supabase
        .from('smtp_settings')
        .select('id, sender_name, sender_email, purpose, is_default, host, port');
      
      if (smtpData) {
        setSmtps(smtpData);
        const def = smtpData.find(s => s.is_default);
        if (def) setSelectedSmtp(def.id);
        else if (smtpData.length > 0) setSelectedSmtp(smtpData[0].id);
      }

      // 4. Fetch Receivers
      const { data: recData } = await supabase
        .from('live_list_settings')
        .select('*')
        .order('created_at', { ascending: false });
      if (recData) setReceivers(recData);
      
      // 5. Fetch Cron schedule settings
      const { data: cronData } = await supabase
        .from('cron_settings')
        .select('*')
        .eq('id', 1)
        .single();
        
      if (cronData) {
        setCronTime(cronData.schedule_time ? cronData.schedule_time.substring(0, 5) : '');
        setCronActive(!!cronData.is_active);
      }
      
      setApps(appsData || []);
    } catch (error) {
      console.error(error);
      setSnack({ open: true, message: error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Filtered Apps based on search query
  const filteredApps = useMemo(() => {
    if (!searchQuery.trim()) return apps;
    const q = searchQuery.toLowerCase().trim();
    return apps.filter(app => {
      const matchName = (app.app_name || '').toLowerCase().includes(q);
      const matchTask = String(app.task_id || '').includes(q);
      const matchPkg = (app.app_package || '').toLowerCase().includes(q);
      const matchSponsor = (sponsorMap[app.sponsor_id] || '').toLowerCase().includes(q) ||
                           (app.sponsor_id || '').toLowerCase().includes(q);
      return matchName || matchTask || matchPkg || matchSponsor;
    });
  }, [apps, searchQuery, sponsorMap]);

  const paginatedApps = useMemo(() => {
    return filteredApps.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredApps, page, rowsPerPage]);

  // Set Default SMTP
  const handleSetDefaultSmtp = async () => {
    if (!selectedSmtp) return;
    setSettingDefault(true);
    try {
      await supabase.from('smtp_settings').update({ is_default: false }).neq('id', '00000000-0000-0000-0000-000000000000');
      const { error } = await supabase.from('smtp_settings').update({ is_default: true }).eq('id', selectedSmtp);
      if (error) throw error;
      
      setSnack({ open: true, message: 'SMTP Gateway successfully set as primary default!', type: 'success' });
      setSmtps(prev => prev.map(s => ({ ...s, is_default: s.id === selectedSmtp })));
    } catch(e) {
      setSnack({ open: true, message: e.message, type: 'error' });
    } finally {
      setSettingDefault(false);
    }
  };

  // Save Cron Schedule
  const handleSaveCron = async () => {
    if (!cronTime) return setSnack({ open: true, message: 'Please specify a valid daily execution time (HH:MM)', type: 'warning' });
    setSavingCron(true);
    try {
      const { error } = await supabase.from('cron_settings').upsert({ 
        id: 1, 
        schedule_time: cronTime, 
        is_active: cronActive 
      });
      if (error) throw error;
      setSnack({ open: true, message: 'Automated live checking schedule updated successfully!', type: 'success' });
    } catch(e) {
      setSnack({ open: true, message: e.message, type: 'error' });
    } finally { 
      setSavingCron(false); 
    }
  };

  // Add Receiver
  const handleAddReceiver = async () => {
    const email = newEmail.trim();
    if (!email || !email.includes('@') || !email.includes('.')) {
      return setSnack({ open: true, message: 'Please enter a valid email address', type: 'warning' });
    }
    if (receivers.some(r => r.receiver_email.toLowerCase() === email.toLowerCase())) {
      return setSnack({ open: true, message: 'This email is already in the recipient list', type: 'warning' });
    }
    try {
      const { data, error } = await supabase.from('live_list_settings').insert([{ receiver_email: email }]).select().single();
      if (error) throw error;
      setReceivers([data, ...receivers]);
      setNewEmail('');
      setSnack({ open: true, message: `Added ${email} to live checking alert list`, type: 'success' });
    } catch(e) {
      setSnack({ open: true, message: e.message, type: 'error' });
    }
  };

  // Delete Receiver
  const handleDeleteReceiver = async (id, email) => {
    const result = await Swal.fire({
      title: 'Remove Recipient?',
      text: `Are you sure you want to remove "${email}" from the live checking mailing list?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, Remove',
      background: isDark ? '#1e293b' : '#ffffff',
      color: isDark ? '#ffffff' : '#000000'
    });

    if (!result.isConfirmed) return;

    try {
      const { error } = await supabase.from('live_list_settings').delete().eq('id', id);
      if (error) throw error;
      setReceivers(receivers.filter(r => r.id !== id));
      setSnack({ open: true, message: 'Recipient deleted from live checking list', type: 'success' });
    } catch(e) {
      setSnack({ open: true, message: e.message, type: 'error' });
    }
  };

  // Send Single App Alert Email
  const handleSendSingle = async (app) => {
    if (!selectedSmtp) {
      return setSnack({ open: true, message: 'Please select an active SMTP sender gateway first!', type: 'warning' });
    }
    if (receivers.length === 0) {
      return setSnack({ open: true, message: 'Add at least one recipient email address first!', type: 'warning' });
    }

    setSendingId(app.id);
    try {
      const recEmails = receivers.map(r => r.receiver_email).join(',');
      const mailBase = getMailApiBaseUrl();
      const res = await fetch(`${mailBase}/api/send-live-checking-email`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({ smtp_id: selectedSmtp, receiver_email: recEmails, app_data: app })
      });

      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (err) {
        throw new Error(`Server returned HTTP ${res.status}: ${text.substring(0, 100) || 'Empty response'}`);
      }

      if (res.ok && data.status === 'success') {
        setSnack({ open: true, message: `Live check notification dispatched for "${app.app_name}"!`, type: 'success' });
      } else {
        throw new Error(data.error || `HTTP ${res.status}: Failed to dispatch email`);
      }
    } catch (e) {
      setSnack({ open: true, message: `Dispatch Error: ${e.message}`, type: 'error' });
    } finally {
      setSendingId(null);
    }
  };

  // Send Bulk Email
  const handleSendBulk = async () => {
    if (!selectedSmtp) {
      return setSnack({ open: true, message: 'Select an SMTP sender gateway first!', type: 'warning' });
    }
    if (receivers.length === 0) {
      return setSnack({ open: true, message: 'Add at least one recipient email in the distribution list!', type: 'warning' });
    }
    if (apps.length === 0) {
      return setSnack({ open: true, message: `No tasks scheduled for live checking on ${selectedDate}!`, type: 'warning' });
    }

    const confirmRes = await Swal.fire({
      title: 'Dispatch Bulk Live Summary?',
      html: `You are about to email <b>${apps.length} applications</b> to <b>${receivers.length} recipients</b> using the selected SMTP gateway.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Send Bulk Mail',
      background: isDark ? '#1e293b' : '#ffffff',
      color: isDark ? '#ffffff' : '#000000'
    });

    if (!confirmRes.isConfirmed) return;
    
    setSendingBulk(true);
    try {
      const mailBase = getMailApiBaseUrl();
      const res = await fetch(`${mailBase}/api/send-bulk-live-checking`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({ smtp_id: selectedSmtp, apps })
      });

      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (err) {
        throw new Error(`Server returned HTTP ${res.status}: ${text.substring(0, 100) || 'Empty response'}`);
      }

      if (res.ok && data.status === 'success') {
        Swal.fire({
          title: 'Summary Dispatched!',
          text: `Daily live checking digest successfully broadcast to ${receivers.length} recipients.`,
          icon: 'success',
          background: isDark ? '#1e293b' : '#ffffff',
          color: isDark ? '#ffffff' : '#000000'
        });
      } else {
        throw new Error(data.error || `HTTP ${res.status}: Bulk transmission failed`);
      }
    } catch (e) {
      setSnack({ open: true, message: `Transmission Failed: ${e.message}`, type: 'error' });
    } finally {
      setSendingBulk(false);
    }
  };

  // Copy link / package
  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    setSnack({ open: true, message: `${label} copied to clipboard!`, type: 'success' });
  };

  const activeSmtpObj = smtps.find(s => s.id === selectedSmtp);

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
              background: 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 8px 24px rgba(6,182,212,0.35)'
            }}
          >
            <EmailIcon sx={{ fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
              Live Checking Dispatcher & Mail Diagnostics
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Inspect automated daily email schedules, SMTP gateways, and instantly dispatch live checking notifications.
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Chip
            icon={<TodayIcon sx={{ fontSize: 16 }} />}
            label={`Target Date: ${selectedDate === todayIST ? `${selectedDate} (Today)` : selectedDate}`}
            sx={{
              fontWeight: 800,
              fontSize: '0.8rem',
              py: 2,
              px: 0.5,
              borderRadius: '12px',
              bgcolor: isDark ? 'rgba(6,182,212,0.12)' : 'rgba(6,182,212,0.08)',
              color: '#06b6d4',
              border: '1px solid rgba(6,182,212,0.25)'
            }}
          />
          <Button
            size="small"
            onClick={fetchData}
            startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
            sx={{
              borderRadius: '12px',
              fontWeight: 700,
              textTransform: 'none',
              px: 2,
              py: 0.9,
              color: 'text.primary',
              bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              '&:hover': {
                bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
              }
            }}
          >
            Refresh
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
        {/* KPI 1: Apps Due for Live Checking */}
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
            <NotificationsActiveIcon sx={{ fontSize: 26 }} />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Due Applications
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
              {apps.length}
            </Typography>
            <Typography variant="caption" sx={{ color: '#06b6d4', fontWeight: 600 }}>
              {selectedDate === todayIST ? 'Scheduled for today IST' : `Scheduled on ${selectedDate}`}
            </Typography>
          </Box>
        </Paper>

        {/* KPI 2: Distribution Receivers */}
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
            <MarkEmailReadIcon sx={{ fontSize: 26 }} />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Receivers Count
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
              {receivers.length}
            </Typography>
            <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 600 }}>
              Recipients configured for alerts
            </Typography>
          </Box>
        </Paper>

        {/* KPI 3: Active SMTP Gateway */}
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
            <StorageIcon sx={{ fontSize: 26 }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active SMTP Sender
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 900, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeSmtpObj?.sender_name || activeSmtpObj?.sender_email || 'None Selected'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#6366f1', fontWeight: 600, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeSmtpObj?.sender_email || 'Configure SMTP below'}
            </Typography>
          </Box>
        </Paper>

        {/* KPI 4: Automated Cron Schedule */}
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
            <ScheduleIcon sx={{ fontSize: 26 }} />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Automated Schedule
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.2, color: cronActive ? '#10b981' : 'text.secondary' }}>
              {cronActive ? `${cronTime || '09:00'} IST (Active)` : 'Inactive / Paused'}
            </Typography>
            <Typography variant="caption" sx={{ color: cronActive ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
              {cronActive ? 'Automatic daily dispatch ON' : 'Turn switch ON to automate'}
            </Typography>
          </Box>
        </Paper>
      </Box>

      {/* 3. Main Operational Layout (Grid: Table 68% + Controls 32%) */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 380px' },
          gap: 3,
          alignItems: 'flex-start',
          width: '100%'
        }}
      >
        
        {/* ============================================================== */}
        {/* LEFT / MAIN COLUMN: APPLICATIONS DISPATCH QUEUE TABLE          */}
        {/* ============================================================== */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, minWidth: 0 }}>
          
          {/* Query & Filter Bar */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '24px',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 2
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarMonthIcon sx={{ fontSize: 20, color: '#06b6d4' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Live Checking Target Schedule ({filteredApps.length} Apps)
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {selectedDate !== todayIST && (
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => setSelectedDate(todayIST)}
                    startIcon={<TodayIcon sx={{ fontSize: 15 }} />}
                    sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, color: '#06b6d4' }}
                  >
                    Reset to Today
                  </Button>
                )}
                {searchQuery && (
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => setSearchQuery('')}
                    startIcon={<ClearIcon sx={{ fontSize: 14 }} />}
                    sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, color: 'text.secondary' }}
                  >
                    Clear Search
                  </Button>
                )}
              </Box>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
                gap: 2,
                width: '100%'
              }}
            >
              <TextField
                fullWidth
                size="small"
                placeholder="Search by app name, task ID, package, or sponsor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 18 }} />
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
                type="date"
                label="Target Live Checking Date"
                InputLabelProps={{ shrink: true }}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '14px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                  }
                }}
              />
            </Box>
          </Paper>

          {/* Table Container */}
          <Paper
            elevation={0}
            sx={{
              borderRadius: '24px',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(16px)',
              overflow: 'hidden',
              width: '100%'
            }}
          >
            <TableContainer>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(248,250,252,0.95)', backdropFilter: 'blur(10px)', fontWeight: 800, fontSize: '0.75rem', py: 1.6, color: 'text.secondary', letterSpacing: '0.04em' } }}>
                    <TableCell width="100" sx={{ whiteSpace: 'nowrap' }}>TASK ID</TableCell>
                    <TableCell>APPLICATION & PACKAGE</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>CLIENT / SPONSOR</TableCell>
                    <TableCell width="170" sx={{ whiteSpace: 'nowrap' }}>SCHEDULE DATES</TableCell>
                    <TableCell align="right" width="160" sx={{ whiteSpace: 'nowrap' }}>ACTION</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                        <CircularProgress size={36} sx={{ color: '#06b6d4', mb: 1.5 }} />
                        <Typography variant="body2" color="text.secondary">Fetching live checking task queue...</Typography>
                      </TableCell>
                    </TableRow>
                  ) : filteredApps.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
                          <CheckCircleIcon sx={{ fontSize: 44, color: '#10b981', opacity: 0.5 }} />
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            No Applications Found
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
                            {searchQuery 
                              ? `No apps matched "${searchQuery}". Try clearing search.` 
                              : `There are no apps scheduled for live checking on ${selectedDate}.`}
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedApps.map((app) => {
                      const isRowSending = sendingId === app.id;
                      const formattedAppDate = app.app_date 
                        ? new Date(app.app_date).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }) 
                        : 'N/A';
                      const formattedCheckDate = app.live_checking_date 
                        ? new Date(app.live_checking_date).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }) 
                        : 'N/A';

                      return (
                        <TableRow 
                          key={app.id} 
                          hover
                          sx={{
                            transition: 'background-color 0.15s ease',
                            '&:hover': {
                              bgcolor: isDark ? 'rgba(255,255,255,0.03) !important' : 'rgba(0,0,0,0.02) !important'
                            }
                          }}
                        >
                          <TableCell sx={{ fontWeight: 800, color: '#06b6d4', fontSize: '0.82rem' }}>
                            #{app.task_id}
                          </TableCell>

                          <TableCell>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                                {app.app_name}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Tooltip title={app.app_package || 'No package URL'}>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontFamily: 'monospace',
                                      fontSize: '0.72rem',
                                      color: 'text.secondary',
                                      maxWidth: 240,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis'
                                    }}
                                  >
                                    {app.app_package || 'Package N/A'}
                                  </Typography>
                                </Tooltip>
                                {app.app_package && (
                                  <>
                                    <IconButton
                                      size="small"
                                      onClick={() => handleCopy(app.app_package, 'Package identifier')}
                                      sx={{ p: 0.2, color: 'text.secondary', '&:hover': { color: '#06b6d4' } }}
                                    >
                                      <ContentCopyIcon sx={{ fontSize: 13 }} />
                                    </IconButton>
                                    {app.app_package.startsWith('http') && (
                                      <IconButton
                                        size="small"
                                        component="a"
                                        href={app.app_package}
                                        target="_blank"
                                        rel="noreferrer"
                                        sx={{ p: 0.2, color: 'text.secondary', '&:hover': { color: '#06b6d4' } }}
                                      >
                                        <OpenInNewIcon sx={{ fontSize: 13 }} />
                                      </IconButton>
                                    )}
                                  </>
                                )}
                              </Box>
                            </Box>
                          </TableCell>

                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                              <BusinessIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8rem', lineHeight: 1.2 }}>
                                  {sponsorMap[app.sponsor_id] || 'Unknown Client'}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem', fontFamily: 'monospace' }}>
                                  {app.sponsor_id}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>

                          <TableCell>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                                Release: <strong>{formattedAppDate}</strong>
                              </Typography>
                              <Chip
                                size="small"
                                label={`Live: ${formattedCheckDate}`}
                                sx={{
                                  height: 20,
                                  fontSize: '0.68rem',
                                  fontWeight: 800,
                                  bgcolor: app.live_checking_date === todayIST ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                                  color: app.live_checking_date === todayIST ? '#10b981' : '#f59e0b',
                                  borderRadius: '6px',
                                  border: '1px solid',
                                  borderColor: app.live_checking_date === todayIST ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'
                                }}
                              />
                            </Box>
                          </TableCell>

                          <TableCell align="right" sx={{ whiteSpace: 'nowrap', width: 160 }}>
                            <Tooltip title="Send live checking alert for this specific app">
                              <span>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => handleSendSingle(app)}
                                  disabled={isRowSending || sendingBulk}
                                  startIcon={isRowSending ? <CircularProgress size={13} color="inherit" /> : <SendIcon sx={{ fontSize: 14 }} />}
                                  sx={{
                                    borderRadius: '10px',
                                    fontWeight: 800,
                                    fontSize: '0.74rem',
                                    textTransform: 'none',
                                    whiteSpace: 'nowrap',
                                    minWidth: 'max-content',
                                    px: 1.8,
                                    py: 0.6,
                                    borderColor: 'rgba(6,182,212,0.3)',
                                    color: '#06b6d4',
                                    bgcolor: isDark ? 'rgba(6,182,212,0.08)' : 'rgba(6,182,212,0.04)',
                                    '&:hover': {
                                      borderColor: '#06b6d4',
                                      bgcolor: isDark ? 'rgba(6,182,212,0.18)' : 'rgba(6,182,212,0.1)'
                                    }
                                  }}
                                >
                                  {isRowSending ? 'Dispatching...' : 'Send Alert'}
                                </Button>
                              </span>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={filteredApps.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(e, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              sx={{
                borderTop: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                  fontSize: '0.8rem',
                  fontWeight: 600
                }
              }}
            />
          </Paper>
        </Box>

        {/* ============================================================== */}
        {/* RIGHT / CONTROL CONSOLE COLUMN: DISPATCH & GATEWAY SETTINGS    */}
        {/* ============================================================== */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, width: '100%' }}>
          
          {/* Card 1: Action Dispatch Pod */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '24px',
              border: '1px solid',
              borderColor: isDark ? 'rgba(6,182,212,0.25)' : 'rgba(6,182,212,0.2)',
              background: isDark
                ? 'linear-gradient(135deg, rgba(6,182,212,0.12) 0%, rgba(15,23,42,0.8) 100%)'
                : 'linear-gradient(135deg, rgba(236,254,255,0.9) 0%, rgba(255,255,255,0.95) 100%)',
              backdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 2
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <FlashOnIcon sx={{ color: '#06b6d4', fontSize: 22 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                Instant Bulk Dispatch
              </Typography>
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
              Instantly broadcast an executive tabular summary of all <strong>{apps.length} applications</strong> scheduled for live checking to all <strong>{receivers.length} recipient emails</strong>.
            </Typography>

            <Button
              variant="contained"
              fullWidth
              onClick={handleSendBulk}
              disabled={sendingBulk || apps.length === 0 || receivers.length === 0}
              startIcon={sendingBulk ? <CircularProgress size={16} color="inherit" /> : <SendIcon sx={{ fontSize: 16 }} />}
              sx={{
                py: 1.2,
                borderRadius: '14px',
                fontWeight: 800,
                fontSize: '0.84rem',
                textTransform: 'none',
                background: 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)',
                boxShadow: '0 4px 16px rgba(6,182,212,0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #0891b2 0%, #0369a1 100%)'
                }
              }}
            >
              {sendingBulk ? 'Dispatching Summary...' : `Broadcast Bulk Live List (${apps.length})`}
            </Button>
          </Paper>

          {/* Card 2: Automated Schedule (Cron Engine) */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '24px',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 2
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScheduleIcon sx={{ fontSize: 20, color: '#f59e0b' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Automated Schedule
                </Typography>
              </Box>
              
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={cronActive}
                    onChange={(e) => setCronActive(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Typography variant="caption" sx={{ fontWeight: 800, color: cronActive ? '#10b981' : 'text.disabled' }}>
                    {cronActive ? 'ACTIVE' : 'OFF'}
                  </Typography>
                }
                sx={{ m: 0 }}
              />
            </Box>

            <Typography variant="caption" color="text.secondary">
              Set a daily execution time (Indian Standard Time) to automatically transmit the bulk summary mail.
            </Typography>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                type="time"
                variant="outlined"
                size="small"
                fullWidth
                value={cronTime}
                onChange={(e) => setCronTime(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                  }
                }}
              />
              <Button
                variant="contained"
                size="small"
                onClick={handleSaveCron}
                disabled={savingCron}
                sx={{
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  textTransform: 'none',
                  px: 2,
                  whiteSpace: 'nowrap',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  boxShadow: 'none'
                }}
              >
                {savingCron ? 'Saving...' : 'Save Time'}
              </Button>
            </Box>
          </Paper>

          {/* Card 3: SMTP Gateway Setup */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '24px',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 2
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StorageIcon sx={{ fontSize: 20, color: '#6366f1' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                SMTP Sender Gateway
              </Typography>
            </Box>

            <FormControl fullWidth size="small">
              <InputLabel>Active Sender Account</InputLabel>
              <Select
                label="Active Sender Account"
                value={selectedSmtp}
                onChange={(e) => setSelectedSmtp(e.target.value)}
                sx={{
                  borderRadius: '12px',
                  bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                }}
              >
                {smtps.map(s => (
                  <MenuItem key={s.id} value={s.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                        {s.sender_name ? `${s.sender_name} (${s.sender_email})` : s.sender_email}
                      </Typography>
                      {s.is_default && (
                        <Chip size="small" label="Primary Default" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800, bgcolor: 'rgba(99,102,241,0.15)', color: '#6366f1' }} />
                      )}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedSmtp && !activeSmtpObj?.is_default && (
              <Button
                variant="outlined"
                fullWidth
                size="small"
                onClick={handleSetDefaultSmtp}
                disabled={settingDefault}
                sx={{
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '0.76rem',
                  textTransform: 'none',
                  borderColor: 'rgba(99,102,241,0.3)',
                  color: '#6366f1',
                  bgcolor: isDark ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.03)'
                }}
              >
                {settingDefault ? 'Updating...' : 'Set as Primary Gateway'}
              </Button>
            )}
          </Paper>

          {/* Card 4: Recipient Distribution List */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '24px',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 2
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonAddIcon sx={{ fontSize: 20, color: '#10b981' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Recipients List
                </Typography>
              </Box>
              <Chip
                size="small"
                label={`${receivers.length} emails`}
                sx={{
                  height: 20,
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  borderRadius: '6px',
                  bgcolor: 'rgba(16,185,129,0.15)',
                  color: '#10b981'
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                placeholder="recipient@example.com"
                variant="outlined"
                size="small"
                fullWidth
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddReceiver();
                  }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                  }
                }}
              />
              <Button
                variant="contained"
                onClick={handleAddReceiver}
                sx={{
                  minWidth: 42,
                  px: 1.5,
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  boxShadow: 'none'
                }}
              >
                <PersonAddIcon sx={{ fontSize: 18 }} />
              </Button>
            </Box>

            {/* Recipients Scrollable Box */}
            <Box
              sx={{
                maxHeight: 220,
                overflowY: 'auto',
                borderRadius: '14px',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                bgcolor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)'
              }}
            >
              {receivers.length === 0 ? (
                <Box sx={{ py: 3, textAlign: 'center', color: 'text.secondary', fontSize: '0.78rem' }}>
                  No recipients added yet
                </Box>
              ) : (
                receivers.map((r) => (
                  <Box
                    key={r.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      px: 2,
                      py: 1,
                      borderBottom: '1px solid',
                      borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                      '&:last-child': { borderBottom: 'none' },
                      '&:hover': {
                        bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
                      }
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>
                      {r.receiver_email}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteReceiver(r.id, r.receiver_email)}
                      sx={{ color: '#ef4444', p: 0.5, '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}
                    >
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                ))
              )}
            </Box>
          </Paper>

        </Box>
      </Box>

      {/* Global Notification Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snack.type}
          variant="filled"
          sx={{
            borderRadius: '14px',
            fontWeight: 700,
            fontSize: '0.85rem',
            boxShadow: '0 8px 30px rgba(0,0,0,0.25)'
          }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
