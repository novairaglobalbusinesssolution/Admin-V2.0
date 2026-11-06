import { useState, useEffect, useMemo } from 'react';
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, TablePagination, 
  IconButton, Button, useTheme, CircularProgress, Snackbar, 
  Alert, Chip, TextField, InputAdornment, Tooltip, Stack, 
  Dialog, DialogTitle, DialogContent, DialogActions, Avatar,
  Menu, MenuItem, Divider
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

// Icons
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import GroupIcon from '@mui/icons-material/Group';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CancelIcon from '@mui/icons-material/Cancel';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import AndroidIcon from '@mui/icons-material/Android';
import AppleIcon from '@mui/icons-material/Apple';
import YouTubeIcon from '@mui/icons-material/YouTube';
import LanguageIcon from '@mui/icons-material/Language';
import ImageIcon from '@mui/icons-material/Image';
import CloseIcon from '@mui/icons-material/Close';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import MoreVertIcon from '@mui/icons-material/MoreVert';

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const now = new Date();
  const past = new Date(dateStr);
  const diffSec = Math.floor((now - past) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return past.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });
};

export default function AppReviewsView() {
  const { appId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [appDetails, setAppDetails] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  // Filtering & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Screenshot Lightbox Modal
  const [previewImage, setPreviewImage] = useState(null);

  // Status Action Menu
  const [statusMenuAnchor, setStatusMenuAnchor] = useState(null);
  const [selectedReview, setSelectedReview] = useState(null);

  useEffect(() => {
    fetchData();
  }, [appId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch App Details
      const { data: appData, error: appError } = await supabase
        .from('apps')
        .select('*')
        .eq('id', appId)
        .single();
        
      if (appError) throw appError;
      setAppDetails(appData);

      // 2. Fetch Reviews from review_submit_data
      const { data: revData, error: revError } = await supabase
        .from('review_submit_data')
        .select('*')
        .eq('app_id', appId)
        .order('submitted_at', { ascending: false });

      if (revError) throw revError;
      setReviews(revData || []);

    } catch (e) {
      console.error(e);
      setSnack({ open: true, message: 'Failed to load task submission details.', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Status Quick Update Handler
  const handleUpdateStatus = async (reviewId, newStatus) => {
    try {
      const { error } = await supabase
        .from('review_submit_data')
        .update({ status: newStatus })
        .eq('id', reviewId);

      if (error) throw error;

      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, status: newStatus } : r));
      setSnack({ open: true, message: `Review status updated to ${newStatus}`, severity: 'success' });
    } catch (err) {
      setSnack({ open: true, message: `Update failed: ${err.message}`, severity: 'error' });
    } finally {
      setStatusMenuAnchor(null);
      setSelectedReview(null);
    }
  };

  // Copy Full Client Report
  const handleCopyList = () => {
    if (!appDetails) return;
    let formattedDate = appDetails.app_date ? new Date(appDetails.app_date).toLocaleDateString('en-IN') : 'N/A';

    let textToCopy = `${appDetails.app_name}\n`;
    textToCopy += `APP ID : ${appDetails.task_id}\n`;
    textToCopy += `APP DATE: ${formattedDate}\n\n`;

    reviews.forEach(r => {
      if (r.submitted_username) {
        textToCopy += `${r.submitted_username.toUpperCase()}\n`;
      }
    });

    textToCopy += `\nTOTAL LIVE : ${reviews.length}`;

    navigator.clipboard.writeText(textToCopy);
    setSnack({ open: true, message: 'Formatted client review report copied!', severity: 'success' });
  };

  // Copy Usernames Only
  const handleCopyUsernamesOnly = () => {
    const list = reviews
      .map(r => (r.submitted_username || '').toUpperCase())
      .filter(Boolean);
    navigator.clipboard.writeText(list.join('\n'));
    setSnack({ open: true, message: `${list.length} usernames copied to clipboard!`, severity: 'success' });
  };

  // 1-Click CSV Export
  const exportToCSV = () => {
    if (!reviews || reviews.length === 0) return;
    const headers = ['Submitted Username', 'Earner ID', 'Bulker ID', 'Status', 'Submitted At', 'Screenshot URL'];
    const rows = filteredReviews.map(r => [
      `"${r.submitted_username || ''}"`,
      `"${r.earner_id || ''}"`,
      `"${r.bulker_id || ''}"`,
      `"${r.status || ''}"`,
      `"${new Date(r.submitted_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}"`,
      `"${r.screenshot_url || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `task_${appDetails?.task_id || 'app'}_reviews_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setSnack({ open: true, message: 'Submissions CSV downloaded successfully!', severity: 'success' });
  };

  // Copy generic text
  const copyText = (txt, label = 'Copied') => {
    navigator.clipboard.writeText(txt);
    setSnack({ open: true, message: `${label} copied to clipboard!`, severity: 'success' });
  };

  // Filtered reviews
  const filteredReviews = useMemo(() => {
    return reviews.filter(r => {
      // Status Filter
      if (statusFilter !== 'ALL') {
        const s = (r.status || '').toLowerCase();
        if (statusFilter === 'APPROVED' && !s.includes('approved') && !s.includes('live')) return false;
        if (statusFilter === 'UNDER_REVIEW' && !s.includes('review') && !s.includes('pending')) return false;
        if (statusFilter === 'NOT_LIVE' && !s.includes('not live') && !s.includes('rejected')) return false;
      }
      // Text Search
      if (search) {
        const q = search.toLowerCase();
        const userMatch = (r.submitted_username || '').toLowerCase().includes(q);
        const earnerMatch = (r.earner_id || '').toLowerCase().includes(q);
        const bulkerMatch = (r.bulker_id || '').toLowerCase().includes(q);
        if (!userMatch && !earnerMatch && !bulkerMatch) return false;
      }
      return true;
    });
  }, [reviews, search, statusFilter]);

  // Paginated reviews
  const paginatedReviews = useMemo(() => {
    const from = page * rowsPerPage;
    return filteredReviews.slice(from, from + rowsPerPage);
  }, [filteredReviews, page, rowsPerPage]);

  // Computations for KPI cards
  const totalSubmissions = reviews.length;
  const approvedCount = reviews.filter(r => {
    const s = (r.status || '').toLowerCase();
    return s.includes('approved') || s === 'live';
  }).length;
  const pendingCount = reviews.filter(r => {
    const s = (r.status || '').toLowerCase();
    return s.includes('under review') || s.includes('pending');
  }).length;
  const totalPayoutAllocated = totalSubmissions * (parseFloat(appDetails?.members_reward) || 0);

  const getPlatformIcon = (type) => {
    switch (type) {
      case 'iOS App': return <AppleIcon sx={{ color: '#3b82f6', fontSize: 24 }} />;
      case 'YT Video': return <YouTubeIcon sx={{ color: '#ef4444', fontSize: 24 }} />;
      case 'Registration': return <LanguageIcon sx={{ color: '#f59e0b', fontSize: 24 }} />;
      default: return <AndroidIcon sx={{ color: '#10b981', fontSize: 24 }} />;
    }
  };

  const getStatusChipProps = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('approved') || s === 'live') {
      return {
        color: '#10b981',
        bg: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)',
        border: 'rgba(16,185,129,0.3)',
        icon: <CheckCircleIcon sx={{ fontSize: 13, color: '#10b981 !important' }} />
      };
    }
    if (s.includes('review') || s.includes('pending')) {
      return {
        color: '#f59e0b',
        bg: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)',
        border: 'rgba(245,158,11,0.3)',
        icon: <HourglassEmptyIcon sx={{ fontSize: 13, color: '#f59e0b !important' }} />
      };
    }
    return {
      color: '#ef4444',
      bg: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)',
      border: 'rgba(239,68,68,0.3)',
      icon: <CancelIcon sx={{ fontSize: 13, color: '#ef4444 !important' }} />
    };
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress size={40} sx={{ color: '#6366f1' }} />
      </Box>
    );
  }

  if (!appDetails) {
    return (
      <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: '24px' }}>
        <Typography variant="h6" color="error">Application / Task Not Found</Typography>
        <Button onClick={() => navigate('/app-list')} sx={{ mt: 2 }} variant="outlined">
          Return to App Directory
        </Button>
      </Paper>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Top Header Card */}
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
          <IconButton 
            onClick={() => navigate('/app-list')} 
            sx={{ 
              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              borderRadius: '14px',
              width: 48,
              height: 48,
              border: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
            }}
          >
            <ArrowBackIcon />
          </IconButton>

          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: '16px',
              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
            }}
          >
            {getPlatformIcon(appDetails.task_type)}
          </Box>

          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                {appDetails.app_name}
              </Typography>
              <Chip
                label={`#${appDetails.task_id || appDetails.id.slice(0, 5)}`}
                size="small"
                sx={{
                  bgcolor: 'rgba(99,102,241,0.15)',
                  color: '#6366f1',
                  fontWeight: 800,
                  fontSize: '0.72rem',
                  borderRadius: '8px'
                }}
              />
              <Chip
                label={appDetails.task_type || 'Android App'}
                size="small"
                sx={{
                  bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                  fontWeight: 700,
                  fontSize: '0.7rem'
                }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary">
              Review Submissions Dossier • Deployed {new Date(appDetails.app_date || appDetails.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' })}
            </Typography>
          </Box>
        </Box>

        {/* Action Controls */}
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
          <Button 
            variant="contained" 
            startIcon={<ContentCopyIcon />} 
            onClick={handleCopyList}
            sx={{ 
              borderRadius: '12px', 
              px: 2.2, 
              py: 0.9, 
              fontWeight: 800,
              textTransform: 'none',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              boxShadow: '0 8px 20px rgba(99,102,241,0.25)',
              '&:hover': {
                background: 'linear-gradient(135deg, #818cf8 0%, #4338ca 100%)'
              }
            }}
          >
            Copy Client Report
          </Button>

          <Button 
            variant="outlined" 
            onClick={handleCopyUsernamesOnly}
            sx={{ 
              borderRadius: '12px', 
              px: 2, 
              py: 0.9, 
              fontWeight: 700,
              textTransform: 'none',
              borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'
            }}
          >
            Copy Usernames
          </Button>

          <Button 
            variant="outlined" 
            startIcon={<FileDownloadIcon />} 
            onClick={exportToCSV}
            sx={{ 
              borderRadius: '12px', 
              px: 2, 
              py: 0.9, 
              fontWeight: 700,
              textTransform: 'none',
              borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'
            }}
          >
            Export CSV
          </Button>

          <Tooltip title="Refresh Reviews">
            <IconButton
              onClick={fetchData}
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
        {/* KPI 1: Total Submitted Proofs */}
        <Paper
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
            gap: 2
          }}
        >
          <Box
            sx={{
              width: 46,
              height: 46,
              borderRadius: '14px',
              bgcolor: 'rgba(99,102,241,0.12)',
              color: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <GroupIcon />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block' }}>
              TOTAL SUBMISSIONS
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.02em' }}>
              {totalSubmissions}
            </Typography>
          </Box>
        </Paper>

        {/* KPI 2: Approved / Live Proofs */}
        <Paper
          elevation={0}
          sx={{
            p: 2.2,
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
              width: 46,
              height: 46,
              borderRadius: '14px',
              bgcolor: 'rgba(16,185,129,0.18)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <CheckCircleIcon />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block' }}>
              LIVE / APPROVED PROOFS
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, color: '#10b981', letterSpacing: '-0.02em' }}>
              {approvedCount}
            </Typography>
          </Box>
        </Paper>

        {/* KPI 3: Under Review / Pending */}
        <Paper
          elevation={0}
          sx={{
            p: 2.2,
            borderRadius: '20px',
            border: '1px solid',
            borderColor: isDark ? 'rgba(245,158,11,0.3)' : 'rgba(245,158,11,0.2)',
            bgcolor: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.05)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Box
            sx={{
              width: 46,
              height: 46,
              borderRadius: '14px',
              bgcolor: 'rgba(245,158,11,0.18)',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <HourglassEmptyIcon />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block' }}>
              UNDER REVIEW / PENDING
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, color: '#f59e0b', letterSpacing: '-0.02em' }}>
              {pendingCount}
            </Typography>
          </Box>
        </Paper>

        {/* KPI 4: Total Earner Payout Pool */}
        <Paper
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
            gap: 2
          }}
        >
          <Box
            sx={{
              width: 46,
              height: 46,
              borderRadius: '14px',
              bgcolor: 'rgba(59,130,246,0.12)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <TrendingUpIcon />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block' }}>
              MEMBER REWARD RATE
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, color: '#3b82f6', letterSpacing: '-0.02em' }}>
              ₹{parseFloat(appDetails.members_reward || 0).toFixed(2)} / Task
            </Typography>
          </Box>
        </Paper>
      </Box>

      {/* Filter & Search Bar Matrix */}
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
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2
        }}
      >
        {/* Status Filter Tabs */}
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {[
            { id: 'ALL', label: `All Proofs (${reviews.length})` },
            { id: 'APPROVED', label: `Approved / Live (${approvedCount})` },
            { id: 'UNDER_REVIEW', label: `Under Review (${pendingCount})` },
            { id: 'NOT_LIVE', label: `Not Live / Rejected (${totalSubmissions - approvedCount - pendingCount})` }
          ].map(tab => {
            const isSelected = statusFilter === tab.id;
            return (
              <Chip
                key={tab.id}
                label={tab.label}
                clickable
                onClick={() => { setStatusFilter(tab.id); setPage(0); }}
                sx={{
                  borderRadius: '12px',
                  fontWeight: 700,
                  bgcolor: isSelected
                    ? '#6366f1'
                    : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                  color: isSelected ? '#fff' : 'text.primary',
                  border: '1px solid',
                  borderColor: isSelected ? '#6366f1' : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                }}
              />
            );
          })}
        </Stack>

        {/* Search Input */}
        <TextField
          size="small"
          placeholder="Search by username, earner ID, or bulker..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
            endAdornment: search && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearch('')}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            )
          }}
          sx={{
            width: { xs: '100%', sm: 340 },
            '& .MuiOutlinedInput-root': { borderRadius: '14px' }
          }}
        />
      </Paper>

      {/* Main Glassmorphic Submissions Table */}
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
        <TableContainer sx={{ maxHeight: 680 }}>
          <Table stickyHeader sx={{ minWidth: 850 }}>
            <TableHead sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', color: 'text.secondary' }}>SUBMITTED USERNAME</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', color: 'text.secondary' }}>PROOF SCREENSHOT</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', color: 'text.secondary' }}>EARNER ID</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', color: 'text.secondary' }}>BULKER VENDOR</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', color: 'text.secondary' }}>REVIEW STATUS</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', color: 'text.secondary' }}>SUBMISSION TIME</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.75rem', color: 'text.secondary' }}>ACTIONS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredReviews.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                    <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 600 }}>
                      No reviews or proof submissions match the current filter.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedReviews.map((row) => {
                  const statusProps = getStatusChipProps(row.status);
                  const usernameFirstChar = (row.submitted_username || 'U')[0].toUpperCase();

                  return (
                    <TableRow
                      key={row.id}
                      hover
                      sx={{
                        transition: 'background-color 0.15s ease',
                        '&:hover': {
                          bgcolor: isDark ? 'rgba(255,255,255,0.03) !important' : 'rgba(0,0,0,0.02) !important'
                        }
                      }}
                    >
                      {/* 1. Submitted Username */}
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar
                            sx={{
                              width: 38,
                              height: 38,
                              borderRadius: '12px',
                              bgcolor: 'rgba(99,102,241,0.15)',
                              color: '#6366f1',
                              fontWeight: 800,
                              fontSize: '0.9rem',
                              border: '1px solid rgba(99,102,241,0.3)'
                            }}
                          >
                            {usernameFirstChar}
                          </Avatar>
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                {(row.submitted_username || 'ANONYMOUS').toUpperCase()}
                              </Typography>
                              <Tooltip title="Copy Username">
                                <IconButton
                                  size="small"
                                  onClick={() => copyText((row.submitted_username || '').toUpperCase(), 'Username')}
                                  sx={{ p: 0.3 }}
                                >
                                  <ContentCopyIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                              Review ID #{row.id.slice(0, 8)}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>

                      {/* 2. Proof Screenshot Thumbnail */}
                      <TableCell>
                        {row.screenshot_url ? (
                          <Box
                            onClick={() => setPreviewImage(row.screenshot_url)}
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 1,
                              p: 0.5,
                              borderRadius: '10px',
                              cursor: 'pointer',
                              border: '1px solid',
                              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                              bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                transform: 'scale(1.05)',
                                borderColor: '#6366f1'
                              }
                            }}
                          >
                            <Box
                              component="img"
                              src={row.screenshot_url}
                              alt="Proof Thumbnail"
                              sx={{
                                width: 34,
                                height: 34,
                                borderRadius: '8px',
                                objectFit: 'cover'
                              }}
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                            <Typography variant="caption" sx={{ fontWeight: 700, pr: 0.5 }}>
                              View Proof
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            No Screenshot
                          </Typography>
                        )}
                      </TableCell>

                      {/* 3. Earner ID */}
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Chip
                            label={row.earner_id}
                            size="small"
                            onClick={() => copyText(row.earner_id, 'Earner ID')}
                            sx={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              fontSize: '0.72rem',
                              borderRadius: '8px',
                              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                              cursor: 'pointer'
                            }}
                          />
                        </Box>
                      </TableCell>

                      {/* 4. Bulker ID */}
                      <TableCell>
                        <Chip
                          label={row.bulker_id || 'Direct'}
                          size="small"
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            borderRadius: '8px',
                            bgcolor: row.bulker_id
                              ? isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)'
                              : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                            color: row.bulker_id ? '#6366f1' : 'text.secondary'
                          }}
                        />
                      </TableCell>

                      {/* 5. Review Status with Status Picker Trigger */}
                      <TableCell>
                        <Chip 
                          size="small" 
                          icon={statusProps.icon}
                          label={row.status || 'Live'} 
                          onClick={(e) => {
                            setStatusMenuAnchor(e.currentTarget);
                            setSelectedReview(row);
                          }}
                          sx={{ 
                            fontWeight: 800,
                            fontSize: '0.72rem',
                            borderRadius: '8px',
                            bgcolor: statusProps.bg,
                            color: statusProps.color,
                            border: `1px solid ${statusProps.border}`,
                            cursor: 'pointer',
                            '&:hover': { opacity: 0.85 }
                          }}
                        />
                      </TableCell>

                      {/* 6. Submission Time */}
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {timeAgo(row.submitted_at)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(row.submitted_at).toLocaleTimeString('en-IN', {
                            timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit'
                          })}
                        </Typography>
                      </TableCell>

                      {/* 7. Row Actions */}
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                          {row.screenshot_url && (
                            <Tooltip title="View Full Screenshot Proof">
                              <IconButton
                                size="small"
                                onClick={() => setPreviewImage(row.screenshot_url)}
                                sx={{
                                  bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                                  borderRadius: '10px'
                                }}
                              >
                                <ZoomInIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}

                          <Tooltip title="Copy Earner Info">
                            <IconButton
                              size="small"
                              onClick={() => copyText(`${row.submitted_username} | ${row.earner_id}`, 'Earner Info')}
                              sx={{
                                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                                borderRadius: '10px'
                              }}
                            >
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination Bar */}
        <TablePagination
          component="div"
          count={filteredReviews.length}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
          sx={{
            borderTop: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
          }}
        />
      </Paper>

      {/* Status Modification Context Menu */}
      <Menu
        anchorEl={statusMenuAnchor}
        open={Boolean(statusMenuAnchor)}
        onClose={() => { setStatusMenuAnchor(null); setSelectedReview(null); }}
        PaperProps={{
          sx: {
            borderRadius: '16px',
            minWidth: 180,
            mt: 0.5,
            bgcolor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(16px)',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
          }
        }}
      >
        <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', fontWeight: 800, color: 'text.secondary' }}>
          CHANGE REVIEW STATUS
        </Typography>
        <MenuItem onClick={() => handleUpdateStatus(selectedReview?.id, 'Approved')}>
          <CheckCircleIcon sx={{ mr: 1.5, fontSize: 16, color: '#10b981' }} /> Mark as Approved / Live
        </MenuItem>
        <MenuItem onClick={() => handleUpdateStatus(selectedReview?.id, 'Under Review')}>
          <HourglassEmptyIcon sx={{ mr: 1.5, fontSize: 16, color: '#f59e0b' }} /> Mark Under Review
        </MenuItem>
        <MenuItem onClick={() => handleUpdateStatus(selectedReview?.id, 'Not Live')}>
          <CancelIcon sx={{ mr: 1.5, fontSize: 16, color: '#ef4444' }} /> Mark as Not Live / Reject
        </MenuItem>
      </Menu>

      {/* High-Res Screenshot Proof Lightbox Modal */}
      <Dialog
        open={Boolean(previewImage)}
        onClose={() => setPreviewImage(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '24px',
            bgcolor: isDark ? 'rgba(15,23,42,0.96)' : 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(20px)',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ImageIcon sx={{ color: '#6366f1' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              Proof Screenshot Inspection
            </Typography>
          </Box>
          <IconButton onClick={() => setPreviewImage(null)} sx={{ borderRadius: '10px' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: isDark ? '#000' : '#f8fafc' }}>
          {previewImage && (
            <Box
              component="img"
              src={previewImage}
              alt="Full Proof"
              sx={{
                maxHeight: '75vh',
                maxWidth: '100%',
                objectFit: 'contain',
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
              }}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
          <Button
            startIcon={<OpenInNewIcon />}
            onClick={() => window.open(previewImage, '_blank')}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Open Original Image
          </Button>
          <Button
            variant="contained"
            onClick={() => setPreviewImage(null)}
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 800, px: 3 }}
          >
            Close
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
