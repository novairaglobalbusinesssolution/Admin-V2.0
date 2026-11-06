import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, TextField, Button,
  IconButton, Chip, Autocomplete, useTheme,
  CircularProgress, InputAdornment, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  Tooltip, Divider
} from '@mui/material';
import { supabase } from '../supabaseClient';
import Swal from 'sweetalert2';

// MUI Icons
import DeleteIcon from '@mui/icons-material/Delete';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SearchIcon from '@mui/icons-material/Search';
import CommentIcon from '@mui/icons-material/Comment';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import RefreshIcon from '@mui/icons-material/Refresh';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import AddIcon from '@mui/icons-material/Add';
import StarIcon from '@mui/icons-material/Star';
import LayersIcon from '@mui/icons-material/Layers';
import ShieldIcon from '@mui/icons-material/Shield';

const getISTDate = () => {
  const d = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + istOffset);
  return istDate.toISOString().slice(0, 10);
};

export default function ManageComment() {
  const theme = useTheme();
  const navigate = useNavigate();
  const isDark = theme.palette.mode === 'dark';

  const [apps, setApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [publishDate, setPublishDate] = useState(getISTDate());

  const [manageComments, setManageComments] = useState([]);
  const [loadingManage, setLoadingManage] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  // Lookup maps
  const [profileMap, setProfileMap] = useState({});
  const [bulkerMap, setBulkerMap] = useState({});

  useEffect(() => {
    fetchApps(publishDate);
  }, [publishDate]);

  useEffect(() => {
    if (selectedApp) {
      fetchManageComments(selectedApp.id);
    } else {
      setManageComments([]);
    }
  }, [selectedApp]);

  // Load profiles & bulkers once
  useEffect(() => {
    (async () => {
      const [{ data: profiles }, { data: bulkers }] = await Promise.all([
        supabase.from('profiles').select('earner_id, first_name, last_name, phone, bulker_id'),
        supabase.from('bulker_desks').select('bulker_id, full_name')
      ]);
      if (profiles) {
        const pm = {};
        profiles.forEach(p => { pm[p.earner_id] = p; });
        setProfileMap(pm);
      }
      if (bulkers) {
        const bm = {};
        bulkers.forEach(b => {
          bm[b.bulker_id] = b.full_name;
          if (b.bulker_id?.startsWith('NOVAIRA/BULKER/')) {
            bm[b.bulker_id.replace('NOVAIRA/BULKER/', '')] = b.full_name;
          }
        });
        setBulkerMap(bm);
      }
    })();
  }, []);

  const fetchApps = async (selectedDate = publishDate) => {
    let query = supabase.from('apps').select('id, app_name, task_id, task_type, app_package, app_date');
    if (selectedDate) query = query.eq('app_date', selectedDate);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (!error && data) {
      setApps(data);
      setSelectedApp((prev) => (prev && data.some(app => app.id === prev.id) ? prev : null));
    }
  };

  const fetchManageComments = async (appId) => {
    setLoadingManage(true);
    try {
      const { data, error } = await supabase.from('app_comments')
        .select('*')
        .eq('app_id', appId)
        .order('created_at', { ascending: false });
      if (!error && data) setManageComments(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingManage(false);
      setPage(0);
    }
  };

  const formatKolkata = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return String(dateStr);
    }
  };

  const getUserInfo = (earnerIdRaw) => {
    if (!earnerIdRaw) return { name: '-', bulkerName: '-', bulkerId: '-' };
    const profile = profileMap[earnerIdRaw];
    if (!profile) return { name: earnerIdRaw, bulkerName: '-', bulkerId: '-' };

    const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.phone || earnerIdRaw;
    const rawBulker = profile.bulker_id || '';
    const bulkerName = bulkerMap[rawBulker]
      || bulkerMap[`NOVAIRA/BULKER/${rawBulker}`]
      || '-';

    return { name, bulkerName, bulkerId: rawBulker };
  };

  // ——— Actions ———

  const handleMarkActive = async (item) => {
    const userInfo = getUserInfo(item.assigned_user_id);
    const result = await Swal.fire({
      title: 'Make Comment Active?',
      html: `
        <div style="text-align:left;font-size:0.92rem;line-height:1.6">
          <p>This comment is currently <strong>${(item.status || 'taken').toUpperCase()}</strong>${item.assigned_user_id ? ` by <strong>${userInfo.name}</strong> (${item.assigned_user_id})` : ''}.</p>
          <p style="color:${isDark ? '#94a3b8' : '#64748b'}">Releasing will clear earner assignment and return it to the <strong>Public Workstation Pool</strong> so any active worker can claim it.</p>
          <p style="font-weight:700;color:${isDark ? '#4ade80' : '#16a34a'};margin-top:12px;font-size:1rem">Process release?</p>
        </div>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Release to Pool',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#10b981',
      background: isDark ? '#0f172a' : '#ffffff',
      color: isDark ? '#f8fafc' : '#0f172a'
    });
    if (!result.isConfirmed) return;

    try {
      const { error } = await supabase.from('app_comments')
        .update({
          status: 'active', assigned_user_id: null,
          taken_at: null, submitted_at: null,
          user_device_ip: null, user_fingerprint: null,
          screenshot_url: null, extracted_username: null
        })
        .eq('id', item.id);
      if (error) throw error;

      setManageComments(prev => prev.map(c => c.id === item.id
        ? { ...c, status: 'active', assigned_user_id: null, taken_at: null, submitted_at: null, user_device_ip: null, user_fingerprint: null, screenshot_url: null, extracted_username: null }
        : c
      ));
      Swal.fire({
        title: 'Released Successfully!',
        text: 'Comment returned to public workstation pool.',
        icon: 'success',
        confirmButtonColor: '#10b981',
        background: isDark ? '#0f172a' : '#fff',
        color: isDark ? '#f8fafc' : '#0f172a'
      });
    } catch (e) {
      Swal.fire({ title: 'Update failed', text: e.message, icon: 'error' });
    }
  };

  const handleMarkAllTakenActive = async () => {
    if (!selectedApp || takenCount === 0) return;
    const result = await Swal.fire({
      title: 'Release All Claimed Comments?',
      html: `
        <div style="text-align:left;font-size:0.92rem;line-height:1.6">
          <p>Found <strong>${takenCount} locked/taken comments</strong> for "${selectedApp.app_name}".</p>
          <p style="color:${isDark ? '#94a3b8' : '#64748b'}">This will strip all active earner reservations and return them to the available pool.</p>
          <p style="font-weight:700;color:${isDark ? '#4ade80' : '#16a34a'};margin-top:12px">Release all ${takenCount} comments?</p>
        </div>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: `Release All ${takenCount}`,
      confirmButtonColor: '#10b981',
      background: isDark ? '#0f172a' : '#fff',
      color: isDark ? '#f8fafc' : '#0f172a'
    });
    if (!result.isConfirmed) return;

    try {
      const { error } = await supabase.from('app_comments')
        .update({ status: 'active', assigned_user_id: null, taken_at: null, submitted_at: null, user_device_ip: null, user_fingerprint: null, screenshot_url: null, extracted_username: null })
        .eq('app_id', selectedApp.id).eq('status', 'taken');
      if (error) throw error;
      fetchManageComments(selectedApp.id);
      Swal.fire({
        title: 'All Released!',
        text: `${takenCount} comments returned to public pool.`,
        icon: 'success',
        confirmButtonColor: '#10b981',
        background: isDark ? '#0f172a' : '#fff',
        color: isDark ? '#f8fafc' : '#0f172a'
      });
    } catch (e) {
      Swal.fire({ title: 'Update failed', text: e.message, icon: 'error' });
    }
  };

  const handleDeleteComment = async (id) => {
    const result = await Swal.fire({
      title: 'Delete Comment?',
      text: 'This slot will be permanently removed from the database.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      confirmButtonColor: '#ef4444',
      background: isDark ? '#0f172a' : '#fff',
      color: isDark ? '#f8fafc' : '#0f172a'
    });
    if (result.isConfirmed) {
      const { error } = await supabase.from('app_comments').delete().eq('id', id);
      if (!error) {
        setManageComments(prev => prev.filter(c => c.id !== id));
        Swal.fire({
          title: 'Deleted!',
          icon: 'success',
          confirmButtonColor: '#10b981',
          background: isDark ? '#0f172a' : '#fff',
          color: isDark ? '#f8fafc' : '#0f172a'
        });
      }
    }
  };

  const handleDeleteAllComments = async () => {
    if (!selectedApp) return;
    const result = await Swal.fire({
      title: 'Delete All Comments?',
      text: `Permanently delete all ${manageComments.length} comments/slots for "${selectedApp.app_name}". This cannot be undone!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete All',
      confirmButtonColor: '#ef4444',
      background: isDark ? '#0f172a' : '#fff',
      color: isDark ? '#f8fafc' : '#0f172a'
    });
    if (!result.isConfirmed) return;
    const { error } = await supabase.from('app_comments').delete().eq('app_id', selectedApp.id);
    if (error) {
      Swal.fire({ title: 'Delete failed', text: error.message, icon: 'error' });
      return;
    }
    setManageComments([]);
    Swal.fire({
      title: 'All Deleted',
      text: 'Inventory cleared.',
      icon: 'success',
      confirmButtonColor: '#10b981',
      background: isDark ? '#0f172a' : '#fff',
      color: isDark ? '#f8fafc' : '#0f172a'
    });
  };

  // ——— Derived Counts ———
  const activeCount = manageComments.filter(c => c.status === 'active').length;
  const takenCount = manageComments.filter(c => c.status === 'taken').length;
  const completedCount = manageComments.filter(c => c.status === 'completed').length;

  const filteredComments = useMemo(() => {
    return manageComments.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (searchText.trim()) {
        const q = searchText.toLowerCase();
        const ui = getUserInfo(c.assigned_user_id);
        return (
          c.content?.toLowerCase().includes(q) ||
          c.assigned_user_id?.toLowerCase().includes(q) ||
          c.extracted_username?.toLowerCase().includes(q) ||
          ui.name?.toLowerCase().includes(q) ||
          ui.bulkerName?.toLowerCase().includes(q) ||
          ui.bulkerId?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [manageComments, statusFilter, searchText, profileMap, bulkerMap]);

  const paginatedComments = filteredComments.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const kpis = [
    {
      title: 'TOTAL INVENTORY',
      value: manageComments.length,
      hint: 'Total provisioned slots',
      color: '#6366f1',
      icon: <LayersIcon sx={{ fontSize: 22, color: '#6366f1' }} />,
      bg: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)'
    },
    {
      title: 'ACTIVE / AVAILABLE',
      value: activeCount,
      hint: 'Ready in public pool',
      color: '#10b981',
      icon: <CheckCircleIcon sx={{ fontSize: 22, color: '#10b981' }} />,
      bg: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.06)'
    },
    {
      title: 'CLAIMED / IN-PROGRESS',
      value: takenCount,
      hint: 'Locked by active earners',
      color: '#f59e0b',
      icon: <HourglassEmptyIcon sx={{ fontSize: 22, color: '#f59e0b' }} />,
      bg: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.06)'
    },
    {
      title: 'COMPLETED / VERIFIED',
      value: completedCount,
      hint: 'Submitted tasks',
      color: '#06b6d4',
      icon: <DoneAllIcon sx={{ fontSize: 22, color: '#06b6d4' }} />,
      bg: isDark ? 'rgba(6,182,212,0.1)' : 'rgba(6,182,212,0.06)'
    }
  ];

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
            : 'linear-gradient(135deg, rgba(238,242,255,0.8) 0%, rgba(255,255,255,0.95) 100%)',
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
            <CommentIcon sx={{ fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
              Comment Inventory & Workstation Queue Control
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Inspect live comment allocations, monitor worker locks, reclaim idle reservations, and manage task quotas.
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate('/add-comment')}
            startIcon={<AddIcon />}
            sx={{
              borderRadius: '12px',
              fontWeight: 700,
              textTransform: 'none',
              borderColor: 'rgba(99,102,241,0.3)',
              color: '#6366f1',
              bgcolor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.05)',
              '&:hover': {
                borderColor: '#6366f1',
                bgcolor: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)'
              }
            }}
          >
            Deploy New Comments
          </Button>
          <Chip
            icon={<CalendarMonthIcon sx={{ fontSize: '1rem !important' }} />}
            label={`IST Target: ${publishDate}`}
            sx={{
              bgcolor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)',
              color: '#6366f1',
              fontWeight: 700,
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: '12px'
            }}
          />
        </Box>
      </Paper>

      {/* 2. Target Application & Date Selector Card (Full Width 50/50 Grid) */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, md: 3 },
          borderRadius: '24px',
          border: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(16px)',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '2.5fr 1fr' },
            gap: 2.5,
            width: '100%',
            alignItems: 'start'
          }}
        >
          {/* App Selector */}
          <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Autocomplete
              fullWidth
              options={apps}
              getOptionLabel={(o) => `[Task #${o.task_id || o.id.slice(0, 6)}] ${o.app_name} (${o.task_type || 'Android App'})`}
              value={selectedApp}
              onChange={(e, v) => setSelectedApp(v)}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  label="Select Application / Task *"
                  placeholder="Search application by name or Task ID..." 
                  sx={{
                    width: '100%',
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '14px',
                      bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                    }
                  }}
                />
              )}
            />

            {/* Selected App Live Insight Pill */}
            {selectedApp && (
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: '12px',
                  bgcolor: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.05)',
                  border: '1px solid',
                  borderColor: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 1.5,
                  width: '100%'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Chip
                    size="small"
                    label={selectedApp.task_type || 'Task'}
                    sx={{
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      bgcolor: selectedApp.task_type === 'Android App' ? 'rgba(16,185,129,0.15)' :
                              selectedApp.task_type === 'iOS App' ? 'rgba(59,130,246,0.15)' :
                              selectedApp.task_type === 'Registration' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                      color: selectedApp.task_type === 'Android App' ? '#10b981' :
                             selectedApp.task_type === 'iOS App' ? '#3b82f6' :
                             selectedApp.task_type === 'Registration' ? '#f59e0b' : '#ef4444',
                      border: '1px solid',
                      borderColor: selectedApp.task_type === 'Android App' ? 'rgba(16,185,129,0.3)' :
                                   selectedApp.task_type === 'iOS App' ? 'rgba(59,130,246,0.3)' :
                                   selectedApp.task_type === 'Registration' ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'
                    }}
                  />
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                    Package: <span style={{ color: isDark ? '#fff' : '#000', fontFamily: 'monospace' }}>{selectedApp.app_package || 'N/A'}</span>
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                    Release Date:
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#6366f1' }}>
                    {selectedApp.app_date || publishDate}
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>

          {/* Date Picker */}
          <Box sx={{ width: '100%' }}>
            <TextField
              fullWidth
              label="Publish Date (IST Kolkata) *"
              type="date"
              value={publishDate}
              onChange={(e) => setPublishDate(e.target.value)}
              sx={{
                width: '100%',
                '& .MuiOutlinedInput-root': {
                  borderRadius: '14px',
                  bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                }
              }}
            />
          </Box>
        </Box>
      </Paper>

      {/* 3. KPI Telemetry Pods (When an app is selected) */}
      {selectedApp && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
            gap: 2,
            width: '100%'
          }}
        >
          {kpis.map((k, i) => (
            <Paper
              key={i}
              elevation={0}
              sx={{
                p: 2.2,
                borderRadius: '20px',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
                backdropFilter: 'blur(16px)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                width: '100%'
              }}
            >
              <Box
                sx={{
                  width: 46,
                  height: 46,
                  borderRadius: '14px',
                  bgcolor: k.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {k.icon}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.05em', display: 'block' }} noWrap>
                  {k.title}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: k.color, my: 0.2 }}>
                  {k.value}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }} noWrap>
                  {k.hint}
                </Typography>
              </Box>
            </Paper>
          ))}
        </Box>
      )}

      {/* 4. Main Inventory Table & Actions Card */}
      {selectedApp ? (
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
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5
          }}
        >
          {/* Toolbar: Filters, Search & Bulk Actions */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 2,
              width: '100%'
            }}
          >
            {/* Filter Pills */}
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {[
                { key: 'all', label: `All (${manageComments.length})`, color: '#6366f1' },
                { key: 'active', label: `Active (${activeCount})`, color: '#10b981' },
                { key: 'taken', label: `Claimed (${takenCount})`, color: '#f59e0b' },
                { key: 'completed', label: `Completed (${completedCount})`, color: '#06b6d4' }
              ].map(f => {
                const isSelected = statusFilter === f.key;
                return (
                  <Chip
                    key={f.key}
                    label={f.label}
                    clickable
                    onClick={() => { setStatusFilter(f.key); setPage(0); }}
                    sx={{
                      fontWeight: 700,
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      bgcolor: isSelected ? f.color : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                      color: isSelected ? '#fff' : 'text.primary',
                      border: '1px solid',
                      borderColor: isSelected ? f.color : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: isSelected ? f.color : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
                      }
                    }}
                  />
                );
              })}
            </Stack>

            {/* Actions: Refresh, Release All, Delete All */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
              <Button
                size="small"
                onClick={() => fetchManageComments(selectedApp.id)}
                startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                sx={{
                  borderRadius: '10px',
                  fontWeight: 700,
                  textTransform: 'none',
                  color: 'text.primary',
                  bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                  border: '1px solid',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
                }}
              >
                Refresh
              </Button>

              {takenCount > 0 && (
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleMarkAllTakenActive}
                  startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />}
                  sx={{
                    borderRadius: '10px',
                    fontWeight: 700,
                    textTransform: 'none',
                    bgcolor: '#10b981',
                    color: '#fff',
                    boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
                    '&:hover': { bgcolor: '#059669' }
                  }}
                >
                  Release All Claimed ({takenCount})
                </Button>
              )}

              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={handleDeleteAllComments}
                startIcon={<DeleteIcon sx={{ fontSize: 16 }} />}
                sx={{
                  borderRadius: '10px',
                  fontWeight: 700,
                  textTransform: 'none',
                  borderColor: 'rgba(239,68,68,0.3)',
                  color: '#ef4444',
                  '&:hover': {
                    borderColor: '#ef4444',
                    bgcolor: 'rgba(239,68,68,0.08)'
                  }
                }}
              >
                Delete All
              </Button>
            </Box>
          </Box>

          {/* Search Bar */}
          <Box sx={{ width: '100%' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by comment text, earner ID, worker name, bulker desk, or proof username..."
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); setPage(0); }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                )
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '14px',
                  bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                }
              }}
            />
          </Box>

          {/* Table Container */}
          {loadingManage ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, gap: 2 }}>
              <CircularProgress size={36} sx={{ color: '#6366f1' }} />
              <Typography variant="body2" color="text.secondary">Loading workstation comments...</Typography>
            </Box>
          ) : filteredComments.length === 0 ? (
            <Box
              sx={{
                py: 8,
                px: 3,
                textAlign: 'center',
                borderRadius: '16px',
                border: '1.5px dashed',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1.5
              }}
            >
              <CommentIcon sx={{ fontSize: 44, color: 'text.secondary', opacity: 0.5 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {manageComments.length === 0 ? 'No Comments Deployed Yet' : 'No Matching Comments'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 450 }}>
                {manageComments.length === 0
                  ? `There are currently 0 comments or slots provisioned for "${selectedApp.app_name}". You can deploy verified comments right away.`
                  : 'Try adjusting your search query or switching to another filter status.'}
              </Typography>
              {manageComments.length === 0 && (
                <Button
                  variant="contained"
                  onClick={() => navigate('/add-comment')}
                  startIcon={<AddIcon />}
                  sx={{
                    mt: 1,
                    borderRadius: '12px',
                    fontWeight: 700,
                    textTransform: 'none',
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                  }}
                >
                  Deploy Comments for this App
                </Button>
              )}
            </Box>
          ) : (
            <TableContainer
              component={Paper}
              elevation={0}
              sx={{
                borderRadius: '16px',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                overflow: 'hidden',
                bgcolor: isDark ? 'rgba(15,23,42,0.4)' : '#ffffff',
                width: '100%'
              }}
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: isDark ? 'rgba(15,23,42,0.9)' : 'rgba(248,250,252,0.95)', backdropFilter: 'blur(10px)', fontWeight: 800, fontSize: '0.75rem', py: 1.5, color: 'text.secondary', letterSpacing: '0.04em' } }}>
                    <TableCell width="50">#</TableCell>
                    <TableCell>COMMENT / TASK SPECIFICATION</TableCell>
                    <TableCell width="120">RATING</TableCell>
                    <TableCell width="110">STATUS</TableCell>
                    <TableCell>ASSIGNED WORKER</TableCell>
                    <TableCell>BULKER DESK</TableCell>
                    <TableCell>PROOF USERNAME</TableCell>
                    <TableCell width="150">TAKEN AT</TableCell>
                    <TableCell align="center" width="130">ACTIONS</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedComments.map((item, idx) => {
                    const isActive = item.status === 'active';
                    const isTaken = item.status === 'taken';
                    const isCompleted = item.status === 'completed';
                    const ui = getUserInfo(item.assigned_user_id);
                    const rowNum = page * rowsPerPage + idx + 1;

                    return (
                      <TableRow
                        key={item.id}
                        hover
                        sx={{
                          transition: 'background-color 0.15s ease',
                          bgcolor: isTaken
                            ? isDark ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.03)'
                            : isCompleted
                            ? isDark ? 'rgba(6,182,212,0.04)' : 'rgba(6,182,212,0.02)'
                            : 'transparent',
                          '&:hover': {
                            bgcolor: isDark ? 'rgba(255,255,255,0.03) !important' : 'rgba(0,0,0,0.02) !important'
                          }
                        }}
                      >
                        <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary', fontWeight: 700 }}>
                          {rowNum}
                        </TableCell>

                        {/* Comment Content */}
                        <TableCell sx={{ maxWidth: 360, py: 1.4 }}>
                          <Tooltip title={item.content || 'Task Slot'} arrow>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 600,
                                fontSize: '0.82rem',
                                lineHeight: 1.4,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                color: item.content ? 'text.primary' : 'text.secondary',
                                fontStyle: item.content ? 'normal' : 'italic'
                              }}
                            >
                              {item.content || '(Instruction Slot - No Text Comment)'}
                            </Typography>
                          </Tooltip>
                        </TableCell>

                        {/* Rating */}
                        <TableCell sx={{ py: 1.4 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 800, color: '#f59e0b', fontSize: '0.8rem' }}>
                              {'⭐'.repeat(item.rating || 5)}
                            </Typography>
                          </Box>
                        </TableCell>

                        {/* Status Chip */}
                        <TableCell sx={{ py: 1.4 }}>
                          <Chip
                            size="small"
                            label={isActive ? 'Active' : isTaken ? 'Claimed' : isCompleted ? 'Completed' : item.status?.toUpperCase()}
                            sx={{
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              borderRadius: '8px',
                              height: 24,
                              bgcolor: isActive ? 'rgba(16,185,129,0.15)' : isTaken ? 'rgba(245,158,11,0.15)' : 'rgba(6,182,212,0.15)',
                              color: isActive ? '#10b981' : isTaken ? '#f59e0b' : '#06b6d4',
                              border: '1px solid',
                              borderColor: isActive ? 'rgba(16,185,129,0.3)' : isTaken ? 'rgba(245,158,11,0.3)' : 'rgba(6,182,212,0.3)'
                            }}
                          />
                        </TableCell>

                        {/* Assigned Worker */}
                        <TableCell sx={{ py: 1.4 }}>
                          {item.assigned_user_id ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box
                                sx={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: '8px',
                                  bgcolor: 'rgba(99,102,241,0.15)',
                                  color: '#6366f1',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.72rem',
                                  fontWeight: 800
                                }}
                              >
                                <PersonIcon sx={{ fontSize: 16 }} />
                              </Box>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8rem', lineHeight: 1.2 }} noWrap>
                                  {ui.name}
                                </Typography>
                                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', fontSize: '0.68rem', display: 'block' }} noWrap>
                                  {item.assigned_user_id}
                                </Typography>
                              </Box>
                            </Box>
                          ) : (
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                              Unassigned (Public)
                            </Typography>
                          )}
                        </TableCell>

                        {/* Bulker Desk */}
                        <TableCell sx={{ py: 1.4 }}>
                          {ui.bulkerId !== '-' ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box
                                sx={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: '8px',
                                  bgcolor: 'rgba(16,185,129,0.15)',
                                  color: '#10b981',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.72rem',
                                  fontWeight: 800
                                }}
                              >
                                <BusinessIcon sx={{ fontSize: 16 }} />
                              </Box>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8rem', lineHeight: 1.2 }} noWrap>
                                  {ui.bulkerName}
                                </Typography>
                                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', fontSize: '0.68rem', display: 'block' }} noWrap>
                                  {ui.bulkerId}
                                </Typography>
                              </Box>
                            </Box>
                          ) : (
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>-</Typography>
                          )}
                        </TableCell>

                        {/* Proof Username */}
                        <TableCell sx={{ py: 1.4 }}>
                          {item.extracted_username ? (
                            <Chip
                              size="small"
                              label={item.extracted_username}
                              sx={{
                                fontWeight: 700,
                                fontSize: '0.72rem',
                                borderRadius: '6px',
                                bgcolor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)',
                                color: '#6366f1'
                              }}
                            />
                          ) : (
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>-</Typography>
                          )}
                        </TableCell>

                        {/* Taken Timestamp */}
                        <TableCell sx={{ py: 1.4, whiteSpace: 'nowrap' }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                            {item.taken_at ? formatKolkata(item.taken_at) : '-'}
                          </Typography>
                        </TableCell>

                        {/* Actions */}
                        <TableCell align="center" sx={{ py: 1.4, whiteSpace: 'nowrap' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, justifyContent: 'center' }}>
                            {!isActive && (
                              <Tooltip title="Release to Public Pool">
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => handleMarkActive(item)}
                                  startIcon={<RestartAltIcon sx={{ fontSize: 14 }} />}
                                  sx={{
                                    borderRadius: '8px',
                                    textTransform: 'none',
                                    fontWeight: 700,
                                    fontSize: '0.72rem',
                                    px: 1.2,
                                    py: 0.4,
                                    bgcolor: '#10b981',
                                    boxShadow: 'none',
                                    '&:hover': { bgcolor: '#059669', boxShadow: 'none' }
                                  }}
                                >
                                  Release
                                </Button>
                              </Tooltip>
                            )}

                            <Tooltip title="Delete Comment Slot">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteComment(item.id)}
                                sx={{
                                  borderRadius: '8px',
                                  bgcolor: 'rgba(239,68,68,0.1)',
                                  '&:hover': { bgcolor: 'rgba(239,68,68,0.2)' }
                                }}
                              >
                                <DeleteIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <TablePagination
                component="div"
                count={filteredComments.length}
                page={page}
                rowsPerPage={rowsPerPage}
                onPageChange={(e, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                rowsPerPageOptions={[25, 50, 100, 250]}
                labelRowsPerPage="Rows per page:"
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} of ${count}`}
                sx={{
                  borderTop: '1px solid',
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                  '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }
                }}
              />
            </TableContainer>
          )}
        </Paper>
      ) : (
        /* Welcome / Selection Invitation Empty State */
        <Paper
          elevation={0}
          sx={{
            py: 10,
            px: 4,
            borderRadius: '24px',
            border: '1.5px dashed',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            bgcolor: isDark ? 'rgba(15,23,42,0.3)' : 'rgba(255,255,255,0.5)',
            backdropFilter: 'blur(16px)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            width: '100%'
          }}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '20px',
              bgcolor: 'rgba(99,102,241,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6366f1'
            }}
          >
            <CommentIcon sx={{ fontSize: 36 }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Select an Application to Manage its Workstation Comments
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 500 }}>
            Choose an active task from the selector above to audit comment distributions, monitor worker reservations, or reclaim taken comments back into the public pool.
          </Typography>
        </Paper>
      )}

    </Box>
  );
}
