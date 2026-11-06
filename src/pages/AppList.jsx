import { useState, useEffect, useMemo } from 'react';
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, TablePagination, 
  IconButton, Drawer, Divider, Chip, useTheme, CircularProgress, 
  TextField, Button, InputAdornment, Menu, MenuItem, Snackbar, 
  Alert, Dialog, DialogTitle, DialogContent, DialogActions, 
  Grid, Stack, Tooltip, Avatar
} from '@mui/material';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

// Icons
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import VisibilityIcon from '@mui/icons-material/Visibility';
import GroupIcon from '@mui/icons-material/Group';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import NotificationsIcon from '@mui/icons-material/Notifications';
import DeleteIcon from '@mui/icons-material/Delete';
import FilterListIcon from '@mui/icons-material/FilterList';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CloseIcon from '@mui/icons-material/Close';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import AndroidIcon from '@mui/icons-material/Android';
import AppleIcon from '@mui/icons-material/Apple';
import YouTubeIcon from '@mui/icons-material/YouTube';
import LanguageIcon from '@mui/icons-material/Language';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import SearchIcon from '@mui/icons-material/Search';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LaunchIcon from '@mui/icons-material/Launch';
import RefreshIcon from '@mui/icons-material/Refresh';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export default function AppList() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  
  // Data State
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submissionCounts, setSubmissionCounts] = useState({});
  const [totalSubmissionsOverall, setTotalSubmissionsOverall] = useState(0);
  const [totalAppsCount, setTotalAppsCount] = useState(0);

  // Pagination & Filters
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filters, setFilters] = useState({ id: '', name: '', link: '', fromDate: '', toDate: '', category: 'ALL' });
  const [searchQuery, setSearchQuery] = useState('');

  // Drawer State
  const [selectedApp, setSelectedApp] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [extendedDetails, setExtendedDetails] = useState({ sponsorName: 'Loading...', bulkers: [] });

  // Options Menu & Delete Dialog State
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuApp, setMenuApp] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [appToDelete, setAppToDelete] = useState(null);

  // Unassign Bulker Dialog State
  const [unassignDialogOpen, setUnassignDialogOpen] = useState(false);
  const [bulkerToUnassign, setBulkerToUnassign] = useState(null);
  const [unassigning, setUnassigning] = useState(false);
  
  // Snack Alert
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    fetchApps();
  }, [page, rowsPerPage]);

  const fetchApps = async () => {
    setLoading(true);
    try {
      let q = supabase.from('apps').select('*', { count: 'exact' });
      
      if (filters.id) q = q.eq('task_id', filters.id);
      if (filters.name) q = q.ilike('app_name', `%${filters.name}%`);
      if (filters.link) q = q.ilike('app_package', `%${filters.link}%`);
      if (filters.fromDate) q = q.gte('app_date', filters.fromDate);
      if (filters.toDate) q = q.lte('app_date', filters.toDate);
      if (filters.category && filters.category !== 'ALL') q = q.eq('task_type', filters.category);
      
      const from = page * rowsPerPage;
      const to = from + rowsPerPage - 1;
      
      q = q.range(from, to).order('created_at', { ascending: false });
      
      const { data, count, error } = await q;

      if (error) throw error;
      setApps(data || []);
      setTotalAppsCount(count || 0);

      // Fetch Submissions count for current page of apps
      const appIds = (data || []).map(a => a.id).filter(Boolean);
      if (appIds.length > 0) {
        fetchSubmissionsForApps(appIds);
      }

      // Fetch overall submissions count once
      fetchOverallSubmissions();
    } catch (error) {
      console.error("Error fetching apps:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissionsForApps = async (appIds) => {
    try {
      const { data, error } = await supabase
        .from('review_submit_data')
        .select('app_id')
        .in('app_id', appIds);

      if (error) throw error;

      const counts = {};
      (data || []).forEach(r => {
        counts[r.app_id] = (counts[r.app_id] || 0) + 1;
      });
      setSubmissionCounts(prev => ({ ...prev, ...counts }));
    } catch (e) {
      console.warn("Could not fetch submission counts:", e);
    }
  };

  const fetchOverallSubmissions = async () => {
    try {
      const { count } = await supabase
        .from('review_submit_data')
        .select('*', { count: 'exact', head: true });
      if (count !== null) setTotalSubmissionsOverall(count);
    } catch (_) {}
  };

  const handleFilterApply = () => {
    setPage(0);
    fetchApps();
  };

  const handleResetFilters = () => {
    setFilters({ id: '', name: '', link: '', fromDate: '', toDate: '', category: 'ALL' });
    setSearchQuery('');
    setPage(0);
    setTimeout(fetchApps, 50);
  };

  const handleOpenDetails = async (app) => {
    setSelectedApp(app);
    setDrawerOpen(true);
    setExtendedDetails({ sponsorName: 'Loading...', bulkers: [] });

    // Ensure we have current submission count
    if (app.id && submissionCounts[app.id] === undefined) {
      fetchSubmissionsForApps([app.id]);
    }

    try {
      const isClient = app.sponsor_type === 'Clients';
      const sponsorTable = isClient ? 'clients' : 'providers';
      const sponsorIdCol = isClient ? 'client_id' : 'provider_id';

      const pSponsor = supabase.from(sponsorTable).select('name').eq(sponsorIdCol, app.sponsor_id).single();
      
      const bulkerIds = (app.assigned_bulkers || []).map(b => b.bulker_id);
      const pBulkers = bulkerIds.length > 0 
        ? supabase.from('bulker_desks').select('bulker_id, full_name').in('bulker_id', bulkerIds)
        : Promise.resolve({ data: [] });

      const [sponsorRes, bulkersRes] = await Promise.all([pSponsor, pBulkers]);

      const bulkersData = (app.assigned_bulkers || []).map(b => {
        const match = (bulkersRes.data || []).find(bd => bd.bulker_id === b.bulker_id);
        return { ...b, full_name: match ? match.full_name : 'Unknown' };
      });

      setExtendedDetails({
        sponsorName: sponsorRes.data ? sponsorRes.data.name : 'Unknown Sponsor',
        bulkers: bulkersData
      });
    } catch (error) {
      setExtendedDetails({ sponsorName: 'Error Loading', bulkers: app.assigned_bulkers || [] });
    }
  };

  const handleCloseDetails = () => {
    setDrawerOpen(false);
    setTimeout(() => setSelectedApp(null), 300);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSnack({ open: true, message: 'Link Copied to Clipboard!', severity: 'success' });
  };

  const initiateDelete = (app) => {
    setAppToDelete(app);
    setDeleteDialogOpen(true);
    setAnchorEl(null);
  };

  const initiateUnassignBulker = (bulker) => {
    setBulkerToUnassign(bulker);
    setUnassignDialogOpen(true);
  };

  const handleUnassignBulkerConfirm = async () => {
    if (!selectedApp || !bulkerToUnassign) return;
    setUnassigning(true);
    try {
      const bIdToUnassign = bulkerToUnassign.bulker_id;
      const shortId = (bIdToUnassign || '').replace(/^NOVAIRA\/BULKER\//i, '').trim();
      const fullId = (bIdToUnassign || '').startsWith('NOVAIRA/BULKER/') ? bIdToUnassign : `NOVAIRA/BULKER/${bIdToUnassign}`;

      const currentList = selectedApp.assigned_bulkers || [];
      const updatedList = currentList.filter(b => {
        const itemShort = (b.bulker_id || '').replace(/^NOVAIRA\/BULKER\//i, '').trim();
        return b.bulker_id !== bIdToUnassign && b.bulker_id !== fullId && itemShort.toUpperCase() !== shortId.toUpperCase();
      });

      const { error: appErr } = await supabase
        .from('apps')
        .update({ assigned_bulkers: updatedList })
        .eq('id', selectedApp.id);

      if (appErr) throw appErr;

      const idVariations = [bIdToUnassign, shortId, fullId].filter(Boolean);
      await supabase
        .from('bulker_app_acceptances')
        .delete()
        .eq('app_id', selectedApp.id)
        .in('bulker_id', idVariations);

      const updatedApp = { ...selectedApp, assigned_bulkers: updatedList };
      setSelectedApp(updatedApp);
      setExtendedDetails(prev => ({
        ...prev,
        bulkers: (prev.bulkers || []).filter(b => {
          const itemShort = (b.bulker_id || '').replace(/^NOVAIRA\/BULKER\//i, '').trim();
          return b.bulker_id !== bIdToUnassign && b.bulker_id !== fullId && itemShort.toUpperCase() !== shortId.toUpperCase();
        })
      }));

      setApps(prev => prev.map(a => a.id === selectedApp.id ? updatedApp : a));

      setSnack({ open: true, message: `Bulker ${bulkerToUnassign.full_name || bIdToUnassign} unassigned successfully!`, severity: 'success' });
      setUnassignDialogOpen(false);
      setBulkerToUnassign(null);
    } catch (e) {
      setSnack({ open: true, message: `Failed to unassign bulker: ${e.message}`, severity: 'error' });
    } finally {
      setUnassigning(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!appToDelete) return;
    try {
      const { error } = await supabase.from('apps').delete().eq('id', appToDelete.id);
      if(error) throw error;
      setSnack({ open: true, message: 'App deleted successfully!', severity: 'success' });
      setDeleteDialogOpen(false);
      setAppToDelete(null);
      handleCloseDetails();
      fetchApps();
    } catch (e) {
      setSnack({ open: true, message: e.message, severity: 'error' });
    }
  };

  const getTaskIcon = (type) => {
    switch(type) {
      case 'iOS App':
        return <AppleIcon sx={{ fontSize: 20, color: '#3b82f6' }} />;
      case 'YT Video':
        return <YouTubeIcon sx={{ fontSize: 20, color: '#ef4444' }} />;
      case 'Registration':
        return <LanguageIcon sx={{ fontSize: 20, color: '#f59e0b' }} />;
      default:
        return <AndroidIcon sx={{ fontSize: 20, color: '#10b981' }} />;
    }
  };

  const getTaskColor = (type) => {
    switch(type) {
      case 'iOS App': return '#3b82f6';
      case 'YT Video': return '#ef4444';
      case 'Registration': return '#f59e0b';
      default: return '#10b981';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  // Fast Category Filter Options
  const categoryFilters = [
    { id: 'ALL', label: 'All Tasks' },
    { id: 'Android App', label: 'Play Store', icon: <AndroidIcon sx={{ fontSize: 16 }} /> },
    { id: 'iOS App', label: 'App Store', icon: <AppleIcon sx={{ fontSize: 16 }} /> },
    { id: 'Registration', label: 'Web KYC', icon: <LanguageIcon sx={{ fontSize: 16 }} /> },
    { id: 'YT Video', label: 'YouTube', icon: <YouTubeIcon sx={{ fontSize: 16 }} /> }
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header Pod */}
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
          gap: 2
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
            <FormatListBulletedIcon sx={{ fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
              Applications & Task Directory
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Monitor active review campaigns, review submission counts, and bulker quota allocations.
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant="contained"
            onClick={() => navigate('/add-app')}
            startIcon={<AddCircleIcon />}
            sx={{
              borderRadius: '14px',
              px: 2.5,
              py: 1,
              fontWeight: 800,
              textTransform: 'none',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              boxShadow: '0 8px 20px rgba(99,102,241,0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #818cf8 0%, #4338ca 100%)'
              }
            }}
          >
            Deploy New Task
          </Button>

          <Tooltip title="Refresh Apps List">
            <IconButton
              onClick={() => { setPage(0); fetchApps(); }}
              sx={{
                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                borderRadius: '12px',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
              }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      {/* 4 Executive KPI Metric Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 2,
          width: '100%'
        }}
      >
        {/* KPI 1: Total Deployed Tasks */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: '20px',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '14px',
              bgcolor: 'rgba(99,102,241,0.12)',
              color: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <FormatListBulletedIcon />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block' }}>
              TOTAL DEPLOYED TASKS
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.02em' }}>
              {totalAppsCount}
            </Typography>
          </Box>
        </Paper>

        {/* KPI 2: Total User Submissions Proofs */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: '20px',
            border: '1px solid',
            borderColor: isDark ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.2)',
            bgcolor: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.05)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '14px',
              bgcolor: 'rgba(16,185,129,0.18)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <GroupIcon />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block' }}>
              TOTAL SUBMITTED USERS
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, color: '#10b981', letterSpacing: '-0.02em' }}>
              {totalSubmissionsOverall.toLocaleString()}
            </Typography>
          </Box>
        </Paper>

        {/* KPI 3: Current Page Active Results */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: '20px',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '14px',
              bgcolor: 'rgba(59,130,246,0.12)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <TaskAltIcon />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block' }}>
              ACTIVE IN CURRENT VIEW
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.02em' }}>
              {apps.length}
            </Typography>
          </Box>
        </Paper>

        {/* KPI 4: Security Status */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: '20px',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '14px',
              bgcolor: 'rgba(245,158,11,0.12)',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <TrendingUpIcon />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block' }}>
              DISTRIBUTION PIPELINE
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, color: '#f59e0b', letterSpacing: '-0.02em' }}>
              Active
            </Typography>
          </Box>
        </Paper>
      </Box>

      {/* Filter Matrix Card */}
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
        {/* Fast Category Filter Chips */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
            {categoryFilters.map((cat) => {
              const isSelected = filters.category === cat.id;
              return (
                <Chip
                  key={cat.id}
                  icon={cat.icon}
                  label={cat.label}
                  clickable
                  onClick={() => {
                    setFilters(prev => ({ ...prev, category: cat.id }));
                    setPage(0);
                    setTimeout(fetchApps, 50);
                  }}
                  sx={{
                    borderRadius: '12px',
                    fontWeight: 700,
                    px: 0.5,
                    bgcolor: isSelected
                      ? '#6366f1'
                      : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                    color: isSelected ? '#fff' : 'text.primary',
                    border: '1px solid',
                    borderColor: isSelected ? '#6366f1' : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    '& .MuiChip-icon': {
                      color: isSelected ? '#fff !important' : 'inherit'
                    }
                  }}
                />
              );
            })}
          </Stack>

          <Button
            size="small"
            color="inherit"
            onClick={handleResetFilters}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Reset Filters
          </Button>
        </Box>

        {/* Search Inputs (Full Width Grid) */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1.2fr 1.5fr 1fr 1fr auto' },
            gap: 1.5,
            width: '100%',
            alignItems: 'center'
          }}
        >
          <TextField 
            size="small" 
            placeholder="Search by App Name..." 
            value={filters.name} 
            onChange={e => setFilters({ ...filters, name: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && handleFilterApply()}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              )
            }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} 
          />

          <TextField 
            size="small" 
            placeholder="Package ID or Link..." 
            value={filters.link} 
            onChange={e => setFilters({ ...filters, link: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && handleFilterApply()}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} 
          />

          <TextField 
            size="small" 
            type="date" 
            label="From Date"
            InputLabelProps={{ shrink: true }} 
            value={filters.fromDate} 
            onChange={e => setFilters({ ...filters, fromDate: e.target.value })}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} 
          />

          <TextField 
            size="small" 
            type="date" 
            label="To Date"
            InputLabelProps={{ shrink: true }} 
            value={filters.toDate} 
            onChange={e => setFilters({ ...filters, toDate: e.target.value })}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} 
          />
          
          <Button 
            variant="contained" 
            onClick={handleFilterApply} 
            startIcon={<FilterListIcon />}
            sx={{ 
              borderRadius: '12px', 
              height: 40,
              px: 2.5,
              fontWeight: 800,
              textTransform: 'none',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              boxShadow: 'none'
            }}
          >
            Apply
          </Button>
        </Box>
      </Paper>

      {/* Main Glassmorphic Apps & Tasks Table */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: '24px',
          border: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(16px)',
          overflow: 'hidden'
        }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
            <CircularProgress size={36} />
          </Box>
        ) : apps.length === 0 ? (
          <Box sx={{ p: 8, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 600 }}>
              No applications or tasks found matching your filters.
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table sx={{ minWidth: 800 }}>
                <TableHead sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', color: 'text.secondary' }}>APPLICATION / TASK</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', color: 'text.secondary' }}>PLATFORM</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', color: 'text.secondary' }}>UNIT ECONOMICS</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', color: 'text.secondary' }}>BULKERS ASSIGNED</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', color: 'text.secondary' }}>DEPLOYMENT DATE</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.75rem', color: 'text.secondary' }}>ACTION & SUBMITTED USERS</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {apps.map((app) => {
                    const taskColor = getTaskColor(app.task_type);
                    const taskIcon = getTaskIcon(app.task_type);
                    const subCount = submissionCounts[app.id] ?? 0;
                    const assignedBulkersCount = (app.assigned_bulkers || []).length;

                    return (
                      <TableRow
                        key={app.id}
                        hover
                        sx={{
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease',
                          '&:hover': {
                            bgcolor: isDark ? 'rgba(255,255,255,0.03) !important' : 'rgba(0,0,0,0.02) !important'
                          }
                        }}
                        onClick={() => handleOpenDetails(app)}
                      >
                        {/* 1. App Identity */}
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box
                              sx={{
                                width: 44,
                                height: 44,
                                borderRadius: '14px',
                                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid',
                                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
                              }}
                            >
                              {taskIcon}
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.primary' }} noWrap>
                                  {app.app_name}
                                </Typography>
                                <Chip
                                  label={`#${app.task_id || app.id.slice(0, 5)}`}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    bgcolor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)',
                                    color: '#6366f1',
                                    borderRadius: '6px'
                                  }}
                                />
                              </Box>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  display: 'block',
                                  fontSize: '0.72rem',
                                  maxWidth: 240,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  mt: 0.3
                                }}
                              >
                                {app.app_package}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>

                        {/* 2. Platform */}
                        <TableCell>
                          <Chip
                            label={app.task_type || 'Android App'}
                            size="small"
                            sx={{
                              height: 24,
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                              color: taskColor,
                              border: '1px solid',
                              borderColor: `${taskColor}40`,
                              borderRadius: '8px'
                            }}
                          />
                        </TableCell>

                        {/* 3. Unit Economics */}
                        <TableCell>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 800, color: '#10b981' }}>
                              Reward: ₹{parseFloat(app.members_reward || 0).toFixed(2)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Bill: ₹{parseFloat(app.sponsor_amount || 0).toFixed(2)} ({app.sponsor_type || 'Client'})
                            </Typography>
                          </Box>
                        </TableCell>

                        {/* 4. Bulkers Assigned */}
                        <TableCell>
                          <Chip
                            label={`${assignedBulkersCount} Bulkers`}
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              bgcolor: assignedBulkersCount > 0
                                ? isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)'
                                : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                              color: assignedBulkersCount > 0 ? '#6366f1' : 'text.secondary',
                              borderRadius: '8px'
                            }}
                          />
                        </TableCell>

                        {/* 5. Deployment Date */}
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {formatDate(app.app_date)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Check: {formatDate(app.live_checking_date)}
                          </Typography>
                        </TableCell>

                        {/* 6. Action Button with TOTAL SUBMITTED USERS COUNT */}
                        <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                            {/* Primary Action Button: Shows Total Submitted Users Count */}
                            <Tooltip title="View all users who submitted proofs for this app">
                              <Button
                                variant="contained"
                                size="small"
                                onClick={() => navigate(`/app-reviews/${app.id}`)}
                                startIcon={<GroupIcon sx={{ fontSize: '1rem !important' }} />}
                                sx={{
                                  borderRadius: '12px',
                                  textTransform: 'none',
                                  fontWeight: 800,
                                  fontSize: '0.78rem',
                                  py: 0.7,
                                  px: 1.8,
                                  background: subCount > 0
                                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                    : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                                  color: subCount > 0 ? '#fff' : 'text.primary',
                                  boxShadow: subCount > 0 ? '0 4px 14px rgba(16,185,129,0.3)' : 'none',
                                  '&:hover': {
                                    background: subCount > 0
                                      ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                                      : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'
                                  }
                                }}
                              >
                                {subCount} Users Submitted
                              </Button>
                            </Tooltip>

                            {/* Details Inspector Button */}
                            <Tooltip title="View Task Details">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenDetails(app)}
                                sx={{
                                  bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                                  borderRadius: '10px',
                                  border: '1px solid',
                                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
                                }}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            {/* More Actions Menu */}
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                setAnchorEl(e.currentTarget);
                                setMenuApp(app);
                              }}
                              sx={{
                                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                                borderRadius: '10px',
                                border: '1px solid',
                                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
                              }}
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination Bar */}
            <TablePagination
              component="div"
              count={totalAppsCount}
              page={page}
              onPageChange={(e, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[5, 10, 25, 50]}
              sx={{
                borderTop: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
              }}
            />
          </>
        )}
      </Paper>

      {/* Row More Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => { setAnchorEl(null); setMenuApp(null); }}
        PaperProps={{
          sx: {
            borderRadius: '16px',
            minWidth: 200,
            mt: 1,
            bgcolor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(16px)',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
          }
        }}
      >
        <MenuItem
          onClick={() => {
            const id = menuApp?.id;
            setAnchorEl(null);
            if (id) navigate(`/edit-app/${id}`);
          }}
        >
          <EditIcon sx={{ mr: 1.5, fontSize: 18, color: 'text.secondary' }} /> Edit Task
        </MenuItem>

        <MenuItem
          onClick={() => {
            const id = menuApp?.id;
            setAnchorEl(null);
            if (id) navigate(`/app-reviews/${id}`);
          }}
        >
          <GroupIcon sx={{ mr: 1.5, fontSize: 18, color: '#10b981' }} /> View Submissions ({menuApp ? (submissionCounts[menuApp.id] || 0) : 0})
        </MenuItem>

        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            setSnack({ open: true, message: 'Notification broadcasted to earners!', severity: 'success' });
          }}
        >
          <NotificationsIcon sx={{ mr: 1.5, fontSize: 18, color: 'text.secondary' }} /> Notify Users
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />

        <MenuItem
          onClick={() => {
            if (menuApp) initiateDelete(menuApp);
          }}
          sx={{ color: '#ef4444' }}
        >
          <DeleteIcon sx={{ mr: 1.5, fontSize: 18, color: '#ef4444' }} /> Delete Task
        </MenuItem>
      </Menu>

      {/* Details Side Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={handleCloseDetails}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 440, md: 480 },
            bgcolor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(20px)',
            borderLeft: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            p: 0
          }
        }}
      >
        {selectedApp && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Drawer Header */}
            <Box
              sx={{
                p: 3,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'
              }}
            >
              <Box>
                <Chip
                  label={`TASK #${selectedApp.task_id || selectedApp.id.slice(0, 5)}`}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(99,102,241,0.15)',
                    color: '#6366f1',
                    fontWeight: 800,
                    fontSize: '0.68rem',
                    mb: 1
                  }}
                />
                <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                  {selectedApp.app_name}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  {getTaskIcon(selectedApp.task_type)}
                  <Chip size="small" label={selectedApp.task_type || 'Android App'} sx={{ fontWeight: 700 }} />
                </Box>
              </Box>

              <IconButton onClick={handleCloseDetails} sx={{ borderRadius: '10px' }}>
                <CloseIcon />
              </IconButton>
            </Box>

            {/* Drawer Body */}
            <Box sx={{ p: 3, flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {/* Submitted Users Action Pod */}
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: '18px',
                  border: '1.5px solid rgba(16,185,129,0.3)',
                  bgcolor: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: '12px',
                      bgcolor: '#10b981',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <GroupIcon />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      {submissionCounts[selectedApp.id] ?? 0} Users Submitted
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Live earner review submissions
                    </Typography>
                  </Box>
                </Box>

                <Button
                  variant="contained"
                  size="small"
                  endIcon={<LaunchIcon sx={{ fontSize: 16 }} />}
                  onClick={() => {
                    handleCloseDetails();
                    navigate(`/app-reviews/${selectedApp.id}`);
                  }}
                  sx={{
                    borderRadius: '10px',
                    textTransform: 'none',
                    fontWeight: 800,
                    bgcolor: '#10b981',
                    boxShadow: 'none',
                    '&:hover': { bgcolor: '#059669' }
                  }}
                >
                  View Users
                </Button>
              </Paper>

              {/* Task Details Card */}
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: '18px',
                  border: '1px solid',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.05em' }}>
                  TARGET IDENTIFIER & URL
                </Typography>

                <Box>
                  <TextField 
                    fullWidth 
                    size="small" 
                    value={selectedApp.app_package}
                    InputProps={{
                      readOnly: true,
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => copyToClipboard(selectedApp.app_package)} size="small">
                            <ContentCopyIcon fontSize="small"/>
                          </IconButton>
                        </InputAdornment>
                      ),
                      sx: { borderRadius: '12px', fontSize: '0.82rem' }
                    }}
                  />
                  <Button
                    size="small"
                    startIcon={<LaunchIcon sx={{ fontSize: 15 }} />}
                    onClick={() => {
                      if (selectedApp.app_package?.startsWith('http')) {
                        window.open(selectedApp.app_package, '_blank');
                      } else {
                        window.open(`https://play.google.com/store/apps/details?id=${selectedApp.app_package}`, '_blank');
                      }
                    }}
                    sx={{ mt: 1, textTransform: 'none', fontWeight: 700 }}
                  >
                    Open Live Link
                  </Button>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, pt: 1 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">Deployment Start</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatDate(selectedApp.app_date)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">Checking Date</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatDate(selectedApp.live_checking_date)}</Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Pricing & Commercial Sponsor Card */}
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: '18px',
                  border: '1px solid',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.05em' }}>
                  COMMERCIAL ECONOMICS
                </Typography>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>{extendedDetails.sponsorName}</Typography>
                  <Typography variant="caption" color="text.secondary">{selectedApp.sponsor_id} ({selectedApp.sponsor_type || 'Client'})</Typography>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, pt: 1 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">Sponsor Billing</Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#10b981' }}>
                      ₹{parseFloat(selectedApp.sponsor_amount || 0).toFixed(2)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">Member Reward</Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#f59e0b' }}>
                      ₹{parseFloat(selectedApp.members_reward || 0).toFixed(2)}
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Assigned Bulkers Card */}
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: '18px',
                  border: '1px solid',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.05em' }}>
                  ASSIGNED BULKER ACCOUNTS ({extendedDetails.bulkers.length})
                </Typography>

                {extendedDetails.bulkers.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No bulkers assigned to this task.</Typography>
                ) : (
                  <Stack spacing={1}>
                    {extendedDetails.bulkers.map((bulker, i) => (
                      <Paper
                        key={i}
                        elevation={0}
                        sx={{
                          p: 1.5,
                          borderRadius: '12px',
                          bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{bulker.full_name}</Typography>
                          <Typography variant="caption" color="text.secondary">{bulker.bulker_id}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip label={`₹${bulker.amount || 0}`} size="small" sx={{ fontWeight: 800, borderRadius: '6px' }} />
                          <Tooltip title="Unassign Bulker">
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={() => initiateUnassignBulker(bulker)}
                            >
                              <PersonRemoveIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Paper>

              {/* Instructions Card */}
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: '18px',
                  border: '1px solid',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.05em', display: 'block', mb: 1 }}>
                  TASK INSTRUCTIONS
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary', fontSize: '0.82rem', lineHeight: 1.5 }}>
                  {selectedApp.instructions || 'No special instructions provided.'}
                </Typography>
              </Paper>
            </Box>
          </Box>
        )}
      </Drawer>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteDialogOpen} 
        onClose={() => setDeleteDialogOpen(false)} 
        PaperProps={{ 
          sx: { 
            borderRadius: '24px', 
            p: 1, 
            minWidth: 340,
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
            bgcolor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(20px)'
          } 
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: 'error.main' }}>
          Delete Task Permanently?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to permanently delete <strong>{appToDelete?.app_name}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} color="inherit" sx={{ borderRadius: '10px', textTransform: 'none' }}>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error" sx={{ borderRadius: '10px', fontWeight: 800, textTransform: 'none' }}>
            Delete Permanently
          </Button>
        </DialogActions>
      </Dialog>

      {/* Unassign Bulker Dialog */}
      <Dialog 
        open={unassignDialogOpen} 
        onClose={() => !unassigning && setUnassignDialogOpen(false)} 
        PaperProps={{ 
          sx: { 
            borderRadius: '24px', 
            p: 1, 
            minWidth: 340,
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
            bgcolor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(20px)'
          } 
        }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Unassign Bulker Account</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to unassign <strong>{bulkerToUnassign?.full_name}</strong> from <strong>{selectedApp?.app_name}</strong>?
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            This will remove the bulker quota allocation and delete acceptance records.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setUnassignDialogOpen(false)} color="inherit" disabled={unassigning} sx={{ borderRadius: '10px', textTransform: 'none' }}>
            Cancel
          </Button>
          <Button onClick={handleUnassignBulkerConfirm} variant="contained" color="error" disabled={unassigning} sx={{ borderRadius: '10px', fontWeight: 800, textTransform: 'none' }}>
            {unassigning ? 'Unassigning...' : 'Unassign Bulker'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar Alert */}
      <Snackbar 
        open={snack.open} 
        autoHideDuration={3000} 
        onClose={() => setSnack(s => ({ ...s, open: false }))} 
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} variant="filled" sx={{ borderRadius: '14px', fontWeight: 700 }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
