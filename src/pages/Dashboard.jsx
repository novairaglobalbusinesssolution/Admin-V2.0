import React, { useState, useEffect, useMemo } from 'react';
import {
  Typography,
  Card,
  CardContent,
  Box,
  useTheme,
  Avatar,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Skeleton,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  LinearProgress,
  Grid,
  Tooltip,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

// Material Icons
import GroupIcon from '@mui/icons-material/Group';
import AppsIcon from '@mui/icons-material/Apps';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import BusinessIcon from '@mui/icons-material/Business';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import RateReviewIcon from '@mui/icons-material/RateReview';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import TuneIcon from '@mui/icons-material/Tune';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditNoteIcon from '@mui/icons-material/EditNote';
import SaveIcon from '@mui/icons-material/Save';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import CampaignIcon from '@mui/icons-material/Campaign';
import ForumIcon from '@mui/icons-material/Forum';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import FlagIcon from '@mui/icons-material/Flag';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloseIcon from '@mui/icons-material/Close';
import LibraryAddIcon from '@mui/icons-material/LibraryAdd';

import { supabase } from '../supabaseClient';

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

// Default Custom Preferences for Admin
const DEFAULT_PREFS = {
  showStatsRow: true,
  showBriefing: true,
  showQuickActions: true,
  showRecentUsers: true,
  showRecentApps: true,
  targetGoalUsers: 5000,
  adminNotes: 'Daily Operations Focus: Monitor withdrawal queue at 3 PM. Verify newly uploaded app task packages and ensure community chat moderation is active.',
};

export default function Dashboard() {
  const theme = useTheme();
  const navigate = useNavigate();
  const isDark = theme.palette.mode === 'dark';

  // State
  const [stats, setStats] = useState({
    users: 0,
    apps: 0,
    bulkers: 0,
    clients: 0,
    pendingReviews: 0,
    pendingWithdrawals: 0,
  });
  const [recentUsers, setRecentUsers] = useState([]);
  const [recentApps, setRecentApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Preferences & Custom Data
  const [prefs, setPrefs] = useState(() => {
    try {
      const saved = localStorage.getItem('novaira_dashboard_prefs');
      return saved ? { ...DEFAULT_PREFS, ...JSON.parse(saved) } : DEFAULT_PREFS;
    } catch {
      return DEFAULT_PREFS;
    }
  });

  // Customize Modal State
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [tempPrefs, setTempPrefs] = useState(prefs);

  // Inline Note Edit State
  const [editingNotes, setEditingNotes] = useState(false);
  const [noteDraft, setNoteDraft] = useState(prefs.adminNotes);

  const savePrefs = (newPrefs) => {
    setPrefs(newPrefs);
    localStorage.setItem('novaira_dashboard_prefs', JSON.stringify(newPrefs));
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [
        usersRes,
        appsRes,
        bulkersRes,
        clientsRes,
        reviewsRes,
        withRes,
        latestUsersRes,
        latestAppsRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('apps').select('*', { count: 'exact', head: true }),
        supabase.from('bulker_desks').select('*', { count: 'exact', head: true }),
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('review_submit_data').select('*', { count: 'exact', head: true }).eq('status', 'Under Review'),
        supabase.from('individual_wallet_transactions').select('*', { count: 'exact', head: true }).eq('status', 'Pending').eq('transaction_type', 'Debit'),
        supabase.from('profiles').select('earner_id, first_name, last_name, email, created_at, status').order('created_at', { ascending: false }).limit(6),
        supabase.from('apps').select('task_id, app_name, app_package, created_at, status').order('created_at', { ascending: false }).limit(6),
      ]);

      setStats({
        users: usersRes.count || 0,
        apps: appsRes.count || 0,
        bulkers: bulkersRes.count || 0,
        clients: clientsRes.count || 0,
        pendingReviews: reviewsRes.count || 0,
        pendingWithdrawals: withRes.count || 0,
      });

      if (latestUsersRes.data) setRecentUsers(latestUsersRes.data);
      if (latestAppsRes.data) setRecentApps(latestAppsRes.data);
      setLastRefreshed(new Date());
    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Growth Progress towards Admin's custom target
  const userProgressPercent = useMemo(() => {
    if (!prefs.targetGoalUsers || prefs.targetGoalUsers <= 0) return 0;
    const pct = Math.min(100, Math.round((stats.users / prefs.targetGoalUsers) * 100));
    return isNaN(pct) ? 0 : pct;
  }, [stats.users, prefs.targetGoalUsers]);

  const statCardsData = [
    { title: 'Total Earner Users', value: stats.users.toLocaleString(), icon: <GroupIcon fontSize="small" />, color: '#06b6d4', path: '/users', subtitle: 'Registered platform earners' },
    { title: 'Apps Published', value: stats.apps.toLocaleString(), icon: <AppsIcon fontSize="small" />, color: '#10b981', path: '/app-list', subtitle: 'Live download tasks' },
    { title: 'Registered Bulkers', value: stats.bulkers.toLocaleString(), icon: <PersonAddIcon fontSize="small" />, color: '#f59e0b', path: '/payments/bulkers', subtitle: 'Corporate partner desks' },
    { title: 'Enterprise Clients', value: stats.clients.toLocaleString(), icon: <BusinessIcon fontSize="small" />, color: '#8b5cf6', path: '/payments/clients', subtitle: 'Advertiser accounts' },
    { title: 'Pending Reviews', value: stats.pendingReviews.toLocaleString(), icon: <RateReviewIcon fontSize="small" />, color: '#ec4899', path: '/manage-comment', subtitle: 'Proof screenshots to audit' },
    { title: 'Pending Withdrawals', value: stats.pendingWithdrawals.toLocaleString(), icon: <AccountBalanceWalletIcon fontSize="small" />, color: '#3b82f6', path: '/payments/individuals', subtitle: 'Awaiting disbursement' },
  ];

  const quickActions = [
    { title: 'Deploy App', desc: 'Add task & budget', icon: <LibraryAddIcon fontSize="small" />, color: '#3b82f6', path: '/add-app' },
    { title: 'Push Broadcast', desc: 'Instant device alert', icon: <CampaignIcon fontSize="small" />, color: '#ec4899', path: '/push-notifications' },
    { title: 'Review Tasks', desc: 'Approve screenshots', icon: <RateReviewIcon fontSize="small" />, color: '#8b5cf6', path: '/manage-comment' },
    { title: 'Community Lounge', desc: 'Chat & moderation', icon: <ForumIcon fontSize="small" />, color: '#06b6d4', path: '/community-chat' },
    { title: 'Financial Ledger', desc: 'Wallet settlements', icon: <AccountBalanceWalletIcon fontSize="small" />, color: '#10b981', path: '/payments' },
    { title: 'System Diagnostics', desc: 'Port 7700 probe', icon: <MonitorHeartIcon fontSize="small" />, color: '#f59e0b', path: 'http://localhost:7700', external: true },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pb: 4 }}>
      {/* Top Mission Control Header */}
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Typography
              variant="h5"
              sx={{
                fontFamily: '"Google Sans", sans-serif',
                fontWeight: 800,
                fontSize: { xs: '1.25rem', sm: '1.45rem' },
                letterSpacing: '-0.02em',
                background: isDark
                  ? 'linear-gradient(135deg, #f8fafc 0%, #cbd5e1 100%)'
                  : 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Executive Mission Control
            </Typography>
            <Chip
              label="REAL-TIME"
              size="small"
              sx={{
                height: 20,
                fontSize: '0.62rem',
                fontWeight: 800,
                bgcolor: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.28)',
              }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
            System pulse across users, app tasks, payouts, and operations
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Tooltip title="Refresh Dashboard Data">
            <IconButton
              onClick={fetchDashboardData}
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
            startIcon={<TuneIcon sx={{ fontSize: 18 }} />}
            onClick={() => {
              setTempPrefs(prefs);
              setCustomizerOpen(true);
            }}
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
            Customize View
          </Button>
        </Box>
      </Box>

      {/* Row 1: High-Density 6-Column Metric Grid with Perfect Alignment */}
      {prefs.showStatsRow && (
        <Grid container spacing={2.2} alignItems="stretch">
          {statCardsData.map((item) => (
            <Grid item xs={12} sm={6} md={4} lg={2} key={item.title} sx={{ display: 'flex' }}>
              <Card
                elevation={0}
                onClick={() => navigate(item.path)}
                sx={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  p: 2.2,
                  cursor: 'pointer',
                  borderRadius: '20px',
                  bgcolor: isDark ? 'rgba(12, 17, 29, 0.65)' : 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(20px) saturate(160%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
                  transition: 'all 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    borderColor: item.color,
                    boxShadow: `0 12px 30px -10px ${item.color}35`,
                    '& .card-icon-pod': {
                      transform: 'scale(1.1) rotate(5deg)',
                      bgcolor: item.color,
                      color: '#ffffff',
                    },
                  },
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 750,
                      fontSize: '0.68rem',
                      color: 'text.secondary',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      lineHeight: 1.3,
                    }}
                  >
                    {item.title}
                  </Typography>
                  <Box
                    className="card-icon-pod"
                    sx={{
                      width: 34,
                      height: 34,
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: `${item.color}15`,
                      color: item.color,
                      border: `1px solid ${item.color}30`,
                      transition: 'all 0.25s ease',
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </Box>
                </Box>

                <Box>
                  {loading ? (
                    <Skeleton variant="text" width="60%" height={36} />
                  ) : (
                    <Typography
                      variant="h4"
                      sx={{
                        fontFamily: '"Google Sans", sans-serif',
                        fontWeight: 800,
                        fontSize: '1.65rem',
                        lineHeight: 1.1,
                        color: 'text.primary',
                        mb: 0.4,
                      }}
                    >
                      {item.value}
                    </Typography>
                  )}
                  <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.subtitle}
                  </Typography>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Row 2: Custom Operations Briefing + Growth KPI Goal & Quick Action Launchpad */}
      {(prefs.showBriefing || prefs.showQuickActions) && (
        <Grid container spacing={2.5} alignItems="stretch">
          {/* Left Column: Admin Briefing & Custom Goal Tracker */}
          {prefs.showBriefing && (
            <Grid item xs={12} lg={prefs.showQuickActions ? 7 : 12} sx={{ display: 'flex' }}>
              <Card
                elevation={0}
                sx={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderRadius: '22px',
                  p: 2.8,
                  bgcolor: isDark ? 'rgba(12, 17, 29, 0.65)' : 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(20px) saturate(160%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
                }}
              >
                {/* Admin Custom Briefing Note Box */}
                <Box sx={{ mb: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: 'rgba(59, 130, 246, 0.15)',
                          color: '#3b82f6',
                        }}
                      >
                        <EditNoteIcon fontSize="small" />
                      </Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: '0.88rem' }}>
                        Admin Operational Notice & Notes
                      </Typography>
                    </Box>

                    {editingNotes ? (
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<SaveIcon sx={{ fontSize: 16 }} />}
                        onClick={() => {
                          savePrefs({ ...prefs, adminNotes: noteDraft });
                          setEditingNotes(false);
                        }}
                        sx={{ borderRadius: '10px', py: 0.4, px: 1.4, fontSize: '0.72rem', fontWeight: 800 }}
                      >
                        Save
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => {
                          setNoteDraft(prefs.adminNotes);
                          setEditingNotes(true);
                        }}
                        sx={{ fontSize: '0.75rem', fontWeight: 700 }}
                      >
                        Edit Note
                      </Button>
                    )}
                  </Box>

                  {editingNotes ? (
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="Type your administrative focus notes, reminders, or pinned instructions..."
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '14px',
                          fontSize: '0.85rem',
                          bgcolor: isDark ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.6)',
                        },
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        p: 1.8,
                        borderRadius: '14px',
                        bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.03)',
                        border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(15, 23, 42, 0.06)',
                      }}
                    >
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.84rem', lineHeight: 1.5 }}>
                        {prefs.adminNotes || 'No administrative notes set yet. Click "Edit Note" to add your custom instructions.'}
                      </Typography>
                    </Box>
                  )}
                </Box>

                <Divider sx={{ my: 1, opacity: 0.6 }} />

                {/* Growth Target KPI Tracker */}
                <Box sx={{ mt: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                        }}
                      >
                        <TrendingUpIcon fontSize="small" />
                      </Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: '0.88rem' }}>
                        Platform Earner Target Progress
                      </Typography>
                    </Box>
                    <Chip
                      label={`${userProgressPercent}% of ${prefs.targetGoalUsers.toLocaleString()} Goal`}
                      size="small"
                      sx={{
                        height: 22,
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        bgcolor: 'rgba(16, 185, 129, 0.12)',
                        color: '#10b981',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                      }}
                    />
                  </Box>

                  <LinearProgress
                    variant="determinate"
                    value={userProgressPercent}
                    sx={{
                      height: 10,
                      borderRadius: '5px',
                      bgcolor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: '5px',
                        background: 'linear-gradient(90deg, #10b981, #06b6d4)',
                      },
                    }}
                  />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.8 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                      Current: {stats.users.toLocaleString()} Earners
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                      Target: {prefs.targetGoalUsers.toLocaleString()} Earners
                    </Typography>
                  </Box>
                </Box>
              </Card>
            </Grid>
          )}

          {/* Right Column: Executive Quick Actions Launchpad */}
          {prefs.showQuickActions && (
            <Grid item xs={12} lg={prefs.showBriefing ? 5 : 12} sx={{ display: 'flex' }}>
              <Card
                elevation={0}
                sx={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: '22px',
                  p: 2.8,
                  bgcolor: isDark ? 'rgba(12, 17, 29, 0.65)' : 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(20px) saturate(160%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'rgba(245, 158, 11, 0.15)',
                      color: '#f59e0b',
                    }}
                  >
                    <RocketLaunchIcon fontSize="small" />
                  </Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: '0.88rem' }}>
                    Executive Quick Launchpad
                  </Typography>
                </Box>

                <Grid container spacing={1.5} sx={{ flex: 1 }}>
                  {quickActions.map((action) => (
                    <Grid item xs={6} key={action.title}>
                      <Box
                        onClick={() => {
                          if (action.external) {
                            window.open(action.path, '_blank');
                            return;
                          }
                          navigate(action.path);
                        }}
                        sx={{
                          height: '100%',
                          p: 1.6,
                          borderRadius: '16px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.4,
                          bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.03)',
                          border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(15, 23, 42, 0.06)',
                          transition: 'all 0.22s ease',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            bgcolor: `${action.color}12`,
                            borderColor: `${action.color}40`,
                            boxShadow: `0 6px 18px -4px ${action.color}25`,
                          },
                        }}
                      >
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: `${action.color}18`,
                            color: action.color,
                            flexShrink: 0,
                          }}
                        >
                          {action.icon}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 750, fontSize: '0.78rem', lineHeight: 1.2, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {action.title}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.66rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {action.desc}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      {/* Row 3: Live Real-Time Feeds (Perfect 50/50 Matching Heights) */}
      <Grid container spacing={2.5} alignItems="stretch">
        {/* Left Feed: Recent Earners */}
        {prefs.showRecentUsers && (
          <Grid item xs={12} md={prefs.showRecentApps ? 6 : 12} sx={{ display: 'flex' }}>
            <Card
              elevation={0}
              sx={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '22px',
                bgcolor: isDark ? 'rgba(12, 17, 29, 0.65)' : 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(20px) saturate(160%)',
                WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
              }}
            >
              <Box sx={{ p: 2.2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${theme.palette.divider}` }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: '0.92rem' }}>
                    Recently Registered Earners
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Latest onboarding activity
                  </Typography>
                </Box>
                <Button
                  size="small"
                  endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
                  onClick={() => navigate('/users')}
                  sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 700 }}
                >
                  View All
                </Button>
              </Box>

              <Box sx={{ flex: 1, p: 0 }}>
                {loading ? (
                  <Box sx={{ p: 2.2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Skeleton variant="circular" width={34} height={34} />
                        <Box sx={{ flex: 1 }}>
                          <Skeleton variant="text" width="60%" height={18} />
                          <Skeleton variant="text" width="80%" height={14} />
                        </Box>
                      </Box>
                    ))}
                  </Box>
                ) : recentUsers.length === 0 ? (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">No recent users found.</Typography>
                  </Box>
                ) : (
                  <List disablePadding>
                    {recentUsers.map((user, idx) => (
                      <React.Fragment key={user.earner_id || idx}>
                        <ListItem
                          onClick={() => navigate(`/users?search=${user.earner_id}`)}
                          sx={{
                            py: 1.1,
                            px: 2.2,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            '&:hover': { bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.03)' },
                          }}
                        >
                          <ListItemAvatar sx={{ minWidth: 42 }}>
                            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.78rem', fontWeight: 800 }}>
                              {(user.first_name?.[0] || user.earner_id?.[0] || 'U').toUpperCase()}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Typography variant="body2" sx={{ fontWeight: 750, fontSize: '0.82rem', color: 'text.primary' }}>
                                {user.first_name || ''} {user.last_name || ''}
                              </Typography>
                            }
                            secondary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2 }}>
                                <EmailOutlinedIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {user.earner_id} • {user.email || 'No email'}
                                </Typography>
                              </Box>
                            }
                          />
                          <Box sx={{ textAlign: 'right', minWidth: 70 }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', display: 'block' }}>
                              {timeAgo(user.created_at)}
                            </Typography>
                            <Chip
                              label={user.status || 'Active'}
                              size="small"
                              color={user.status === 'Active' || !user.status ? 'success' : 'default'}
                              sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800, borderRadius: '4px', mt: 0.2 }}
                            />
                          </Box>
                        </ListItem>
                        {idx < recentUsers.length - 1 && <Divider component="li" sx={{ opacity: 0.5 }} />}
                      </React.Fragment>
                    ))}
                  </List>
                )}
              </Box>
            </Card>
          </Grid>
        )}

        {/* Right Feed: Recently Published Apps */}
        {prefs.showRecentApps && (
          <Grid item xs={12} md={prefs.showRecentUsers ? 6 : 12} sx={{ display: 'flex' }}>
            <Card
              elevation={0}
              sx={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '22px',
                bgcolor: isDark ? 'rgba(12, 17, 29, 0.65)' : 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(20px) saturate(160%)',
                WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
              }}
            >
              <Box sx={{ p: 2.2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${theme.palette.divider}` }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: '0.92rem' }}>
                    Recently Published Applications
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Active task delivery queue
                  </Typography>
                </Box>
                <Button
                  size="small"
                  endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
                  onClick={() => navigate('/app-list')}
                  sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 700 }}
                >
                  View All
                </Button>
              </Box>

              <Box sx={{ flex: 1, p: 0 }}>
                {loading ? (
                  <Box sx={{ p: 2.2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Skeleton variant="circular" width={34} height={34} />
                        <Box sx={{ flex: 1 }}>
                          <Skeleton variant="text" width="60%" height={18} />
                          <Skeleton variant="text" width="80%" height={14} />
                        </Box>
                      </Box>
                    ))}
                  </Box>
                ) : recentApps.length === 0 ? (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">No apps published yet.</Typography>
                  </Box>
                ) : (
                  <List disablePadding>
                    {recentApps.map((app, idx) => (
                      <React.Fragment key={app.task_id || idx}>
                        <ListItem
                          onClick={() => navigate(`/app-list?search=${app.task_id}`)}
                          sx={{
                            py: 1.1,
                            px: 2.2,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            '&:hover': { bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.03)' },
                          }}
                        >
                          <ListItemAvatar sx={{ minWidth: 42 }}>
                            <Avatar sx={{ width: 32, height: 32, bgcolor: '#10b981', color: '#fff', fontSize: '0.78rem', fontWeight: 800 }}>
                              <AppsIcon sx={{ fontSize: 18 }} />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Typography variant="body2" sx={{ fontWeight: 750, fontSize: '0.82rem', color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {app.app_name}
                              </Typography>
                            }
                            secondary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2 }}>
                                <OpenInNewOutlinedIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  Task #{app.task_id} • {app.app_package}
                                </Typography>
                              </Box>
                            }
                          />
                          <Box sx={{ textAlign: 'right', minWidth: 70 }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', display: 'block' }}>
                              {timeAgo(app.created_at)}
                            </Typography>
                            <Chip
                              label={app.status || 'Active'}
                              size="small"
                              color={app.status === 'active' || !app.status ? 'success' : 'default'}
                              sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800, borderRadius: '4px', mt: 0.2, textTransform: 'capitalize' }}
                            />
                          </Box>
                        </ListItem>
                        {idx < recentApps.length - 1 && <Divider component="li" sx={{ opacity: 0.5 }} />}
                      </React.Fragment>
                    ))}
                  </List>
                )}
              </Box>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Customize Dashboard Modal */}
      <Dialog
        open={customizerOpen}
        onClose={() => setCustomizerOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '24px',
            bgcolor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(30px)',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(15, 23, 42, 0.1)',
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 3, pt: 2.8, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TuneIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Customize Executive Dashboard</Typography>
          </Box>
          <IconButton size="small" onClick={() => setCustomizerOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ px: 3, py: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Personalize your dashboard widgets, target earner milestones, and active feeds. Settings are saved permanently for your admin account.
          </Typography>

          <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.2 }}>
            Widget Visibility:
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={tempPrefs.showStatsRow}
                  onChange={(e) => setTempPrefs({ ...tempPrefs, showStatsRow: e.target.checked })}
                  color="primary"
                />
              }
              label={<Typography variant="body2" sx={{ fontWeight: 650 }}>Executive 6-Metric Stat Grid (Row 1)</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={tempPrefs.showBriefing}
                  onChange={(e) => setTempPrefs({ ...tempPrefs, showBriefing: e.target.checked })}
                  color="primary"
                />
              }
              label={<Typography variant="body2" sx={{ fontWeight: 650 }}>Admin Operational Briefing & Goal Tracker</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={tempPrefs.showQuickActions}
                  onChange={(e) => setTempPrefs({ ...tempPrefs, showQuickActions: e.target.checked })}
                  color="primary"
                />
              }
              label={<Typography variant="body2" sx={{ fontWeight: 650 }}>Quick Action Launchpad Grid</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={tempPrefs.showRecentUsers}
                  onChange={(e) => setTempPrefs({ ...tempPrefs, showRecentUsers: e.target.checked })}
                  color="primary"
                />
              }
              label={<Typography variant="body2" sx={{ fontWeight: 650 }}>Recently Registered Earners Feed</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={tempPrefs.showRecentApps}
                  onChange={(e) => setTempPrefs({ ...tempPrefs, showRecentApps: e.target.checked })}
                  color="primary"
                />
              }
              label={<Typography variant="body2" sx={{ fontWeight: 650 }}>Recently Published Applications Feed</Typography>}
            />
          </Box>

          <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.2 }}>
            Custom Platform Target:
          </Typography>
          <TextField
            fullWidth
            type="number"
            label="Target Earner Users Milestone"
            value={tempPrefs.targetGoalUsers}
            onChange={(e) => setTempPrefs({ ...tempPrefs, targetGoalUsers: Number(e.target.value) || 1000 })}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
            helperText="Sets the benchmark number for the live progress bar calculation on your dashboard."
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.8, pt: 1, justifyContent: 'space-between' }}>
          <Button
            color="inherit"
            onClick={() => {
              setTempPrefs(DEFAULT_PREFS);
              savePrefs(DEFAULT_PREFS);
              setCustomizerOpen(false);
            }}
            sx={{ fontWeight: 700, fontSize: '0.8rem', color: 'text.secondary' }}
          >
            Reset to Defaults
          </Button>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => setCustomizerOpen(false)} color="inherit" sx={{ fontWeight: 700 }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                savePrefs(tempPrefs);
                setCustomizerOpen(false);
              }}
              sx={{ fontWeight: 700, borderRadius: '12px', px: 2.5 }}
            >
              Apply Changes
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
