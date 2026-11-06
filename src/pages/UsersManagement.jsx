import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  Avatar,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
  IconButton,
  TextField,
  Button,
  TablePagination,
  Skeleton,
  Stack,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Drawer,
  Divider,
  Snackbar,
  Alert,
  Grid,
} from '@mui/material';
import { supabase } from '../supabaseClient';
import { useNavigate, useSearchParams } from 'react-router-dom';

// Icons
import GroupIcon from '@mui/icons-material/Group';
import StorefrontIcon from '@mui/icons-material/Storefront';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FilterListIcon from '@mui/icons-material/FilterList';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import RefreshIcon from '@mui/icons-material/Refresh';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CloseIcon from '@mui/icons-material/Close';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CampaignIcon from '@mui/icons-material/Campaign';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ClearIcon from '@mui/icons-material/Clear';

const tabs = [
  { id: 0, label: 'Individual Earners', subtitle: 'Platform mobile app users', icon: <PersonIcon />, table: 'profiles', typeParam: 'individual', color: '#06b6d4' },
  { id: 1, label: 'Bulker Desks', subtitle: 'Regional distributor desks', icon: <GroupIcon />, table: 'bulker_desks', typeParam: 'bulker', color: '#f59e0b' },
  { id: 2, label: 'Service Providers', subtitle: 'API & task suppliers', icon: <StorefrontIcon />, table: 'providers', typeParam: 'provider', color: '#10b981' },
  { id: 3, label: 'Enterprise Clients', subtitle: 'Brand campaign advertisers', icon: <BusinessIcon />, table: 'clients', typeParam: 'client', color: '#8b5cf6' },
];

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return `${Math.max(1, Math.floor(seconds))}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export default function UsersManagement() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isDark = theme.palette.mode === 'dark';

  const [activeTab, setActiveTab] = useState(0);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tab Counts for KPI Deck
  const [tabCounts, setTabCounts] = useState({
    individuals: 0,
    bulkers: 0,
    providers: 0,
    clients: 0,
  });

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  const initialSearch = searchParams.get('search') || '';
  const [filters, setFilters] = useState({
    search: initialSearch,
    status: 'ALL',
    fromDate: '',
    toDate: '',
  });

  // Action Menu State
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);

  // Quick Inspector Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inspectedUser, setInspectedUser] = useState(null);

  // Snackbar Toast
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  // Fetch KPI counts across all 4 tables
  const fetchKpiCounts = useCallback(async () => {
    try {
      const [indRes, bulkRes, provRes, clientRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('bulker_desks').select('*', { count: 'exact', head: true }),
        supabase.from('providers').select('*', { count: 'exact', head: true }),
        supabase.from('clients').select('*', { count: 'exact', head: true }),
      ]);

      setTabCounts({
        individuals: indRes.count || 0,
        bulkers: bulkRes.count || 0,
        providers: provRes.count || 0,
        clients: clientRes.count || 0,
      });
    } catch (err) {
      console.error('Error fetching tab KPI counts:', err);
    }
  }, []);

  useEffect(() => {
    fetchKpiCounts();
  }, [fetchKpiCounts]);

  // Reset pagination when active tab changes
  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  // Main Data Fetch
  const fetchData = useCallback(async () => {
    setLoading(true);
    setData([]);
    const currentTab = tabs[activeTab];
    const tableName = currentTab.table;

    try {
      let q = supabase.from(tableName).select('*', { count: 'exact' });

      // Apply Dates Filter
      if (filters.fromDate) q = q.gte('created_at', filters.fromDate);
      if (filters.toDate) q = q.lte('created_at', `${filters.toDate}T23:59:59.999Z`);

      // Apply Status Filter if column exists
      if (filters.status !== 'ALL') {
        q = q.ilike('status', filters.status);
      }

      // Apply Search Filter dynamically
      if (filters.search.trim()) {
        const s = `%${filters.search.trim()}%`;
        if (activeTab === 0) {
          q = q.or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s},phone.ilike.${s},earner_id.ilike.${s}`);
        } else if (activeTab === 1) {
          q = q.or(`full_name.ilike.${s},bulker_id.ilike.${s},phone.ilike.${s},email.ilike.${s}`);
        } else if (activeTab === 2) {
          q = q.or(`name.ilike.${s},provider_id.ilike.${s}`);
        } else if (activeTab === 3) {
          q = q.or(`name.ilike.${s},client_id.ilike.${s}`);
        }
      }

      // Pagination
      const from = (page - 1) * rowsPerPage;
      const to = from + rowsPerPage - 1;
      q = q.range(from, to).order('created_at', { ascending: false });

      const { data: result, count, error } = await q;
      if (error) throw error;

      let finalData = result || [];

      // Augment relational data for Individual Earners
      if (activeTab === 0 && finalData.length > 0) {
        // Fetch Bulkers
        const bulkerIds = [...new Set(finalData.map((r) => r.bulker_id).filter(Boolean))];
        const formattedBulkerIds = bulkerIds.map((id) => (id.includes('NOVAIRA/BULKER/') ? id : `NOVAIRA/BULKER/${id}`));

        let bulkersMap = {};
        if (formattedBulkerIds.length > 0) {
          const { data: bulkers } = await supabase
            .from('bulker_desks')
            .select('bulker_id, full_name')
            .in('bulker_id', formattedBulkerIds);
          if (bulkers) {
            bulkers.forEach((b) => {
              bulkersMap[b.bulker_id] = b.full_name;
            });
          }
        }

        // Fetch Referrers
        const refCodes = [...new Set(finalData.map((r) => r.referral_code).filter(Boolean))];
        let refsMap = {};
        if (refCodes.length > 0) {
          const { data: refs } = await supabase
            .from('profiles')
            .select('earner_id, first_name, last_name')
            .in('earner_id', refCodes);
          if (refs) {
            refs.forEach((r) => {
              refsMap[r.earner_id] = `${r.first_name || ''} ${r.last_name || ''}`.trim();
            });
          }
        }

        finalData = finalData.map((row) => {
          let bId = row.bulker_id;
          let fullBId = bId ? (bId.includes('NOVAIRA/BULKER/') ? bId : `NOVAIRA/BULKER/${bId}`) : null;

          return {
            ...row,
            bulkerName: fullBId ? bulkersMap[fullBId] || 'Unknown Bulker' : null,
            referrerName: row.referral_code ? refsMap[row.referral_code] || 'Unknown Referrer' : null,
          };
        });
      }

      setData(finalData);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching users data:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, rowsPerPage, filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Copy to clipboard helper
  const copyToClipboard = (text, label = 'ID') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setToast({ open: true, message: `${label} copied to clipboard!`, severity: 'success' });
  };

  // Export current table view as CSV
  const exportToCSV = () => {
    if (data.length === 0) {
      setToast({ open: true, message: 'No records to export!', severity: 'warning' });
      return;
    }

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map((row) =>
      Object.values(row)
        .map((val) => `"${String(val || '').replace(/"/g, '""')}"`)
        .join(',')
    );

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `novaira_${tabs[activeTab].typeParam}_records.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToast({ open: true, message: 'CSV export downloaded successfully!', severity: 'success' });
  };

  const handleOpenInspector = (row) => {
    setInspectedUser(row);
    setDrawerOpen(true);
  };

  const getStatusBadge = (status) => {
    const s = (status || 'Active').toLowerCase();
    if (s === 'active' || s === 'verified') {
      return (
        <Chip
          label="Active"
          size="small"
          icon={<Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10b981', ml: 0.8, boxShadow: '0 0 6px #10b981' }} />}
          sx={{
            height: 22,
            fontSize: '0.68rem',
            fontWeight: 800,
            bgcolor: 'rgba(16, 185, 129, 0.12)',
            color: '#10b981',
            border: '1px solid rgba(16, 185, 129, 0.3)',
          }}
        />
      );
    }
    if (s === 'suspended' || s === 'banned') {
      return (
        <Chip
          label="Suspended"
          size="small"
          icon={<Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#ef4444', ml: 0.8 }} />}
          sx={{
            height: 22,
            fontSize: '0.68rem',
            fontWeight: 800,
            bgcolor: 'rgba(239, 68, 68, 0.12)',
            color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}
        />
      );
    }
    return (
      <Chip
        label={status || 'Pending'}
        size="small"
        icon={<Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#f59e0b', ml: 0.8 }} />}
        sx={{
          height: 22,
          fontSize: '0.68rem',
          fontWeight: 800,
          bgcolor: 'rgba(245, 158, 11, 0.12)',
          color: '#f59e0b',
          border: '1px solid rgba(245, 158, 11, 0.3)',
        }}
      />
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.8, pb: 6 }}>
      {/* Top Executive Header */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2,
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4 }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                color: '#ffffff',
                boxShadow: '0 8px 20px rgba(6, 182, 212, 0.35)',
              }}
            >
              <PersonIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box>
              <Typography
                variant="h5"
                sx={{
                  fontFamily: '"Google Sans", sans-serif',
                  fontWeight: 800,
                  fontSize: { xs: '1.28rem', sm: '1.5rem' },
                  letterSpacing: '-0.02em',
                  background: isDark
                    ? 'linear-gradient(135deg, #f8fafc 0%, #cbd5e1 100%)'
                    : 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Users & Partners Directory
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.2 }}>
                Comprehensive control deck across individual earners, bulkers, providers, and advertisers
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Tooltip title="Refresh Table Data">
            <IconButton
              onClick={fetchData}
              disabled={loading}
              sx={{
                borderRadius: '12px',
                bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.04)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
                '&:hover': { bgcolor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.08)' },
              }}
            >
              <RefreshIcon sx={{ fontSize: 20, animation: loading ? 'spin 1s linear infinite' : 'none', '@keyframes spin': { '100%': { transform: 'rotate(360deg)' } } }} />
            </IconButton>
          </Tooltip>

          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon sx={{ fontSize: 18 }} />}
            onClick={exportToCSV}
            sx={{
              borderRadius: '13px',
              py: 0.8,
              px: 1.8,
              fontSize: '0.82rem',
              fontWeight: 700,
              bgcolor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(15, 23, 42, 0.03)',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(15, 23, 42, 0.1)',
              color: 'text.primary',
              '&:hover': {
                bgcolor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)',
                borderColor: 'primary.main',
              },
            }}
          >
            Export CSV
          </Button>
        </Box>
      </Box>

      {/* KPI Deck: 4 Interactive Category Cards with Seamless Tab Switching */}
      <Grid container spacing={2}>
        {tabs.map((t, idx) => {
          const isActive = activeTab === idx;
          const count =
            idx === 0
              ? tabCounts.individuals
              : idx === 1
              ? tabCounts.bulkers
              : idx === 2
              ? tabCounts.providers
              : tabCounts.clients;

          return (
            <Grid item xs={12} sm={6} md={3} key={t.id}>
              <Card
                elevation={0}
                onClick={() => setActiveTab(idx)}
                sx={{
                  p: 2.2,
                  cursor: 'pointer',
                  borderRadius: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '106px',
                  bgcolor: isActive
                    ? (isDark ? 'rgba(15, 23, 42, 0.82)' : 'rgba(255, 255, 255, 0.95)')
                    : (isDark ? 'rgba(12, 17, 29, 0.60)' : 'rgba(255, 255, 255, 0.75)'),
                  backdropFilter: 'blur(20px) saturate(160%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                  border: isActive
                    ? `1.5px solid ${t.color}`
                    : (isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(15, 23, 42, 0.08)'),
                  boxShadow: isActive
                    ? `0 12px 30px -8px ${t.color}35`
                    : 'none',
                  transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    borderColor: t.color,
                    boxShadow: `0 10px 24px -6px ${t.color}25`,
                  },
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 800,
                      fontSize: '0.72rem',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: isActive ? t.color : 'text.secondary',
                    }}
                  >
                    {t.label}
                  </Typography>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: isActive ? t.color : `${t.color}15`,
                      color: isActive ? '#ffffff' : t.color,
                      border: `1px solid ${t.color}30`,
                      transition: 'all 0.25s ease',
                    }}
                  >
                    {React.cloneElement(t.icon, { sx: { fontSize: 17 } })}
                  </Box>
                </Box>

                <Box sx={{ mt: 1 }}>
                  <Typography
                    variant="h4"
                    sx={{
                      fontFamily: '"Google Sans", sans-serif',
                      fontWeight: 800,
                      fontSize: '1.65rem',
                      lineHeight: 1.1,
                      color: 'text.primary',
                    }}
                  >
                    {count.toLocaleString()}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem', mt: 0.2, display: 'block' }}>
                    {t.subtitle}
                  </Typography>
                </Box>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Control & Filter Suite */}
      <Card
        elevation={0}
        sx={{
          p: 2,
          borderRadius: '20px',
          bgcolor: isDark ? 'rgba(12, 17, 29, 0.65)' : 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
        }}
      >
        <Grid container spacing={1.5} alignItems="center">
          {/* Main Search Input */}
          <Grid item xs={12} md={5}>
            <TextField
              fullWidth
              size="small"
              placeholder={`Search ${tabs[activeTab].label.toLowerCase()} by name, email, phone, or ID...`}
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              InputProps={{
                startAdornment: <FilterListIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} />,
                endAdornment: filters.search ? (
                  <IconButton size="small" onClick={() => setFilters({ ...filters, search: '' })}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                ) : null,
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '14px',
                  bgcolor: isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.6)',
                },
              }}
            />
          </Grid>

          {/* Status Filter */}
          <Grid item xs={6} sm={3} md={2.5}>
            <TextField
              select
              fullWidth
              size="small"
              label="Account Status"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              SelectProps={{ native: true }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '14px',
                  bgcolor: isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.6)',
                },
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Suspended">Suspended</option>
              <option value="Pending">Pending Verification</option>
            </TextField>
          </Grid>

          {/* From Date */}
          <Grid item xs={6} sm={3} md={2}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="Joined After"
              InputLabelProps={{ shrink: true }}
              value={filters.fromDate}
              onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '14px',
                  bgcolor: isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.6)',
                },
              }}
            />
          </Grid>

          {/* Clear All Filters Button */}
          <Grid item xs={12} sm={6} md={2.5} sx={{ display: 'flex', gap: 1 }}>
            <Button
              fullWidth
              variant="contained"
              onClick={fetchData}
              sx={{
                borderRadius: '13px',
                py: 0.9,
                fontWeight: 800,
                fontSize: '0.82rem',
                boxShadow: 'none',
              }}
            >
              Apply Filter
            </Button>
            {(filters.search || filters.status !== 'ALL' || filters.fromDate) && (
              <Button
                variant="outlined"
                onClick={() => setFilters({ search: '', status: 'ALL', fromDate: '', toDate: '' })}
                sx={{
                  borderRadius: '13px',
                  minWidth: '70px',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                }}
              >
                Reset
              </Button>
            )}
          </Grid>
        </Grid>
      </Card>

      {/* Main Glassmorphic Table Container */}
      <Card
        elevation={0}
        sx={{
          borderRadius: '24px',
          overflow: 'hidden',
          bgcolor: isDark ? 'rgba(12, 17, 29, 0.65)' : 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
        }}
      >
        <TableContainer sx={{ minHeight: '380px' }}>
          <Table size="medium">
            <TableHead
              sx={{
                bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.02)',
                borderBottom: `1px solid ${theme.palette.divider}`,
              }}
            >
              {activeTab === 0 && (
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary', py: 1.8 }}>
                    Earner Profile
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary', py: 1.8 }}>
                    Contact & Identification
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary', py: 1.8 }}>
                    Bulker & Referral Network
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary', py: 1.8 }}>
                    Account Status
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary', py: 1.8 }}>
                    Onboarding & Activity
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary', py: 1.8 }}>
                    Quick Actions
                  </TableCell>
                </TableRow>
              )}

              {activeTab === 1 && (
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary', py: 1.8 }}>
                    Bulker Organization
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary', py: 1.8 }}>
                    Contact Info
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary', py: 1.8 }}>
                    Status
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary', py: 1.8 }}>
                    Registered
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary', py: 1.8 }}>
                    Quick Actions
                  </TableCell>
                </TableRow>
              )}

              {(activeTab === 2 || activeTab === 3) && (
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary', py: 1.8 }}>
                    Identifier
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary', py: 1.8 }}>
                    Organization / Name
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary', py: 1.8 }}>
                    Created Date
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary', py: 1.8 }}>
                    Quick Actions
                  </TableCell>
                </TableRow>
              )}
            </TableHead>

            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton variant="text" width={180} height={24} /></TableCell>
                    <TableCell><Skeleton variant="text" width={160} height={24} /></TableCell>
                    <TableCell><Skeleton variant="text" width={140} height={24} /></TableCell>
                    <TableCell><Skeleton variant="rectangular" width={70} height={22} sx={{ borderRadius: '6px' }} /></TableCell>
                    <TableCell><Skeleton variant="text" width={110} height={24} /></TableCell>
                    <TableCell align="right"><Skeleton variant="circular" width={28} height={28} sx={{ ml: 'auto' }} /></TableCell>
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 8, textAlign: 'center' }}>
                    <AccountCircleIcon sx={{ fontSize: 44, color: 'text.disabled', mb: 1, opacity: 0.6 }} />
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      No {tabs[activeTab].label.toLowerCase()} found matching your criteria.
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Try clearing search terms or selecting another date window.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row) => {
                  if (activeTab === 0) {
                    // Individuals Row
                    const fullName = `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Unknown Earner';
                    const initial = (row.first_name?.[0] || row.earner_id?.[0] || 'U').toUpperCase();

                    return (
                      <TableRow
                        key={row.id}
                        hover
                        sx={{
                          transition: 'background-color 0.18s ease',
                          '&:hover': {
                            bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.02)',
                          },
                        }}
                      >
                        {/* Profile Info */}
                        <TableCell sx={{ py: 1.6 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ position: 'relative' }}>
                              <Avatar
                                sx={{
                                  width: 38,
                                  height: 38,
                                  background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                                  color: '#ffffff',
                                  fontSize: '0.9rem',
                                  fontWeight: 800,
                                  boxShadow: '0 4px 12px rgba(6, 182, 212, 0.25)',
                                }}
                              >
                                {initial}
                              </Avatar>
                              <Box
                                sx={{
                                  position: 'absolute',
                                  bottom: -1,
                                  right: -1,
                                  width: 9,
                                  height: 9,
                                  borderRadius: '50%',
                                  bgcolor: row.status === 'Active' || !row.status ? '#10b981' : '#94a3b8',
                                  border: `2px solid ${isDark ? '#0c0f17' : '#ffffff'}`,
                                }}
                              />
                            </Box>
                            <Box>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 750,
                                  color: 'text.primary',
                                  cursor: 'pointer',
                                  '&:hover': { color: 'primary.main' },
                                }}
                                onClick={() => handleOpenInspector(row)}
                              >
                                {fullName}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.2 }}>
                                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 700, color: 'text.secondary', fontSize: '0.72rem' }}>
                                  {row.earner_id}
                                </Typography>
                                <Tooltip title="Copy Earner ID">
                                  <IconButton
                                    size="small"
                                    onClick={() => copyToClipboard(row.earner_id, 'Earner ID')}
                                    sx={{ p: 0.2, color: 'text.disabled', '&:hover': { color: 'primary.main' } }}
                                  >
                                    <ContentCopyIcon sx={{ fontSize: 13 }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </Box>
                          </Box>
                        </TableCell>

                        {/* Contact */}
                        <TableCell sx={{ py: 1.6 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                            <EmailIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                            <Typography variant="body2" sx={{ fontSize: '0.82rem', color: 'text.primary' }}>
                              {row.email || 'No email attached'}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.3 }}>
                            <PhoneIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">
                              {row.phone || 'No phone registered'}
                            </Typography>
                          </Box>
                        </TableCell>

                        {/* Bulker & Referral */}
                        <TableCell sx={{ py: 1.6 }}>
                          {row.bulker_id ? (
                            <Box sx={{ mb: 0.4 }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.78rem', color: '#06b6d4' }}>
                                {row.bulkerName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                                Desk: {row.bulker_id}
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.4 }}>
                              No Bulker Attached
                            </Typography>
                          )}

                          {row.referral_code ? (
                            <Box>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: 'secondary.main', display: 'block' }}>
                                Ref: {row.referrerName || row.referral_code}
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="caption" color="text.disabled">
                              Direct Signup
                            </Typography>
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell sx={{ py: 1.6 }}>
                          {getStatusBadge(row.status)}
                        </TableCell>

                        {/* Registration & Activity */}
                        <TableCell sx={{ py: 1.6 }}>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 650 }}>
                            {new Date(row.created_at).toLocaleDateString()}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.2 }}>
                            {timeAgo(row.created_at)}
                          </Typography>
                        </TableCell>

                        {/* Actions */}
                        <TableCell align="right" sx={{ py: 1.6 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.8 }}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => navigate(`/user-view/individual/${row.id}`)}
                              sx={{
                                borderRadius: '10px',
                                py: 0.4,
                                px: 1.4,
                                fontSize: '0.75rem',
                                fontWeight: 750,
                              }}
                            >
                              Profile
                            </Button>

                            <IconButton
                              size="small"
                              onClick={(e) => {
                                setMenuAnchorEl(e.currentTarget);
                                setSelectedRow(row);
                              }}
                              sx={{ color: 'text.secondary' }}
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  if (activeTab === 1) {
                    // Bulkers Row
                    return (
                      <TableRow key={row.id} hover>
                        <TableCell sx={{ py: 1.6 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar sx={{ width: 36, height: 36, bgcolor: '#f59e0b', color: '#fff', fontWeight: 800 }}>
                              {(row.full_name || 'B')[0].toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 750 }}>
                                {row.full_name}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700 }}>
                                {row.bulker_id}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>

                        <TableCell sx={{ py: 1.6 }}>
                          <Typography variant="body2">{row.email || 'N/A'}</Typography>
                          <Typography variant="caption" color="text.secondary">{row.phone || 'N/A'}</Typography>
                        </TableCell>

                        <TableCell sx={{ py: 1.6 }}>
                          {getStatusBadge(row.status)}
                        </TableCell>

                        <TableCell sx={{ py: 1.6 }}>
                          <Typography variant="body2">{new Date(row.created_at).toLocaleDateString()}</Typography>
                          <Typography variant="caption" color="text.secondary">{timeAgo(row.created_at)}</Typography>
                        </TableCell>

                        <TableCell align="right" sx={{ py: 1.6 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => navigate(`/user-view/bulker/${row.id}`)}
                            sx={{ borderRadius: '10px', fontWeight: 750 }}
                          >
                            Desk View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  // Providers / Clients
                  const idCol = activeTab === 2 ? row.provider_id : row.client_id;
                  const typeParam = activeTab === 2 ? 'provider' : 'client';
                  return (
                    <TableRow key={row.id} hover>
                      <TableCell sx={{ py: 1.6 }}>
                        <Typography variant="body2" sx={{ fontWeight: 750, color: 'primary.main', fontFamily: 'monospace' }}>
                          {idCol}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 1.6 }}>
                        <Typography variant="body2" sx={{ fontWeight: 750 }}>
                          {row.name}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 1.6 }}>
                        <Typography variant="body2">{new Date(row.created_at).toLocaleDateString()}</Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ py: 1.6 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => navigate(`/user-view/${typeParam}/${row.id}`)}
                          sx={{ borderRadius: '10px', fontWeight: 750 }}
                        >
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Elegant Bottom Pagination Bar */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            px: 2.5,
            py: 1.5,
            borderTop: `1px solid ${theme.palette.divider}`,
            gap: 1.5,
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
            Showing {data.length > 0 ? (page - 1) * rowsPerPage + 1 : 0} -{' '}
            {Math.min(page * rowsPerPage, totalCount)} of {totalCount.toLocaleString()} {tabs[activeTab].label.toLowerCase()}
          </Typography>

          <TablePagination
            component="div"
            count={totalCount}
            page={page - 1}
            onPageChange={(e, newPage) => setPage(newPage + 1)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(1);
            }}
            rowsPerPageOptions={[10, 25, 50]}
            sx={{ borderBottom: 'none' }}
          />
        </Box>
      </Card>

      {/* Action Menu Popover */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={() => setMenuAnchorEl(null)}
        PaperProps={{
          sx: {
            borderRadius: '16px',
            minWidth: 190,
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          },
        }}
      >
        <MenuItem
          onClick={() => {
            const row = selectedRow;
            setMenuAnchorEl(null);
            if (row) navigate(`/user-view/individual/${row.id}`);
          }}
          sx={{ py: 1 }}
        >
          <ListItemIcon><OpenInNewIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Full Profile" primaryTypographyProps={{ fontSize: '0.82rem', fontWeight: 650 }} />
        </MenuItem>

        <MenuItem
          onClick={() => {
            const row = selectedRow;
            setMenuAnchorEl(null);
            if (row) copyToClipboard(row.earner_id, 'Earner ID');
          }}
          sx={{ py: 1 }}
        >
          <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Copy Earner ID" primaryTypographyProps={{ fontSize: '0.82rem', fontWeight: 650 }} />
        </MenuItem>

        <MenuItem
          onClick={() => {
            const row = selectedRow;
            setMenuAnchorEl(null);
            if (row) navigate(`/payments/individuals?search=${row.earner_id}`);
          }}
          sx={{ py: 1 }}
        >
          <ListItemIcon><AccountBalanceWalletIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="View Wallet Ledger" primaryTypographyProps={{ fontSize: '0.82rem', fontWeight: 650 }} />
        </MenuItem>

        <MenuItem
          onClick={() => {
            const row = selectedRow;
            setMenuAnchorEl(null);
            if (row) navigate(`/push-notifications?earnerId=${row.earner_id}`);
          }}
          sx={{ py: 1 }}
        >
          <ListItemIcon><CampaignIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Send Push Broadcast" primaryTypographyProps={{ fontSize: '0.82rem', fontWeight: 650 }} />
        </MenuItem>
      </Menu>

      {/* Quick Inspector Side Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 420 },
            bgcolor: isDark ? 'rgba(10, 14, 22, 0.95)' : 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(30px) saturate(180%)',
            borderLeft: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(15, 23, 42, 0.1)',
            p: 3,
          },
        }}
      >
        {inspectedUser && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Earner Quick Inspector</Typography>
              <IconButton size="small" onClick={() => setDrawerOpen(false)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>

            <Divider sx={{ mb: 2.5 }} />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Avatar
                sx={{
                  width: 54,
                  height: 54,
                  background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: '1.3rem',
                }}
              >
                {(inspectedUser.first_name?.[0] || 'U').toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
                  {inspectedUser.first_name || ''} {inspectedUser.last_name || ''}
                </Typography>
                <Chip
                  label={inspectedUser.earner_id}
                  size="small"
                  onClick={() => copyToClipboard(inspectedUser.earner_id, 'Earner ID')}
                  icon={<ContentCopyIcon sx={{ fontSize: 12 }} />}
                  sx={{ mt: 0.5, height: 22, fontSize: '0.72rem', fontWeight: 800 }}
                />
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
              <Box sx={{ p: 1.8, borderRadius: '14px', bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.03)' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>EMAIL ADDRESS</Typography>
                <Typography variant="body2" sx={{ fontWeight: 650, mt: 0.3 }}>{inspectedUser.email || 'N/A'}</Typography>
              </Box>

              <Box sx={{ p: 1.8, borderRadius: '14px', bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.03)' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>PHONE NUMBER</Typography>
                <Typography variant="body2" sx={{ fontWeight: 650, mt: 0.3 }}>{inspectedUser.phone || 'N/A'}</Typography>
              </Box>

              <Box sx={{ p: 1.8, borderRadius: '14px', bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.03)' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>BULKER DESK</Typography>
                <Typography variant="body2" sx={{ fontWeight: 650, mt: 0.3, color: '#06b6d4' }}>
                  {inspectedUser.bulkerName || 'No Bulker Attached'}
                </Typography>
              </Box>

              <Box sx={{ p: 1.8, borderRadius: '14px', bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.03)' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>REFERRAL CODE</Typography>
                <Typography variant="body2" sx={{ fontWeight: 650, mt: 0.3, color: 'secondary.main' }}>
                  {inspectedUser.referral_code ? `Ref: ${inspectedUser.referrerName || inspectedUser.referral_code}` : 'Direct Signup'}
                </Typography>
              </Box>

              <Box sx={{ p: 1.8, borderRadius: '14px', bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.03)' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>JOINED DATE</Typography>
                <Typography variant="body2" sx={{ fontWeight: 650, mt: 0.3 }}>
                  {new Date(inspectedUser.created_at).toLocaleString()}
                </Typography>
              </Box>
            </Box>

            <Button
              fullWidth
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              onClick={() => {
                setDrawerOpen(false);
                navigate(`/user-view/individual/${inspectedUser.id}`);
              }}
              sx={{
                borderRadius: '14px',
                py: 1.2,
                fontWeight: 800,
                boxShadow: 'none',
              }}
            >
              Open Comprehensive Profile
            </Button>
          </Box>
        )}
      </Drawer>

      {/* Toast Feedback */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast.severity} sx={{ borderRadius: '12px', fontWeight: 700 }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
