import { useState, useContext, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Box, CssBaseline, Drawer, IconButton, Button,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Typography, useTheme, useMediaQuery, Avatar, Menu, MenuItem, Divider, Skeleton,
  Badge, Popover, Chip, Stack
} from '@mui/material';

// Material Icons
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LibraryAddIcon from '@mui/icons-material/LibraryAdd';
import AppsIcon from '@mui/icons-material/Apps';
import FolderSharedIcon from '@mui/icons-material/FolderShared';
import EmailIcon from '@mui/icons-material/Email';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import ForumIcon from '@mui/icons-material/Forum';
import RateReviewIcon from '@mui/icons-material/RateReview';
import TimelineIcon from '@mui/icons-material/Timeline';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import ViewListIcon from '@mui/icons-material/ViewList';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import GroupIcon from '@mui/icons-material/Group';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Collapse from '@mui/material/Collapse';
import CampaignIcon from '@mui/icons-material/Campaign';
import PushPinIcon from '@mui/icons-material/PushPin';
import SecurityIcon from '@mui/icons-material/Security';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import SearchIcon from '@mui/icons-material/Search';
import BusinessIcon from '@mui/icons-material/Business';
import StorefrontIcon from '@mui/icons-material/Storefront';
import PersonIcon from '@mui/icons-material/Person';
import PaidIcon from '@mui/icons-material/Paid';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import TuneIcon from '@mui/icons-material/Tune';
import SettingsApplicationsIcon from '@mui/icons-material/SettingsApplications';
import PaymentsIcon from '@mui/icons-material/Payments';
import OmniSearchModal from '../components/OmniSearchModal';
import { supabase } from '../supabaseClient';

import { ColorModeContext } from '../App';

const drawerWidth = 260;

export default function AdminLayout() {
  const theme = useTheme();
  const colorMode = useContext(ColorModeContext);
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const [expandedPaymentMenu, setExpandedPaymentMenu] = useState('');
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const isPaymentsRoute = location.pathname.startsWith('/payments');
  const isCommunityChatRoute = location.pathname.startsWith('/community-chat');

  useEffect(() => {
    setSidebarLoading(true);
    const timer = setTimeout(() => setSidebarLoading(false), 220);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname.startsWith('/payments/clients')) {
      setExpandedPaymentMenu('clients');
    } else if (location.pathname.startsWith('/payments/individuals')) {
      setExpandedPaymentMenu('individuals');
    } else if (location.pathname.startsWith('/payments/bulkers')) {
      setExpandedPaymentMenu('bulkers');
    } else if (location.pathname.startsWith('/payments/providers')) {
      setExpandedPaymentMenu('providers');
    }
  }, [location.pathname]);

  const [anchorEl, setAnchorEl] = useState(null);
  const handleProfileMenuOpen = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  // Notification Popover state & counts
  const [notifAnchorEl, setNotifAnchorEl] = useState(null);
  const [notifCounts, setNotifCounts] = useState({
    newUsers: 0,
    withdrawals: 0,
    reviews: 0,
    bulkers: 0
  });

  const fetchNotificationCounts = async () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    try {
      const lastRead = localStorage.getItem('admin_last_read_notifications') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // 1. New users since last read
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gt('created_at', lastRead);

      // 2. Pending individual withdrawals
      const { count: withCount } = await supabase
        .from('individual_wallet_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'Pending')
        .eq('transaction_type', 'Debit')
        .ilike('description', 'Withdrawal:%');

      // 3. Pending task submissions under review
      const { count: revCount } = await supabase
        .from('review_submit_data')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'Under Review');

      // 4. Pending / latest bulkers
      const { count: bulkerCount } = await supabase
        .from('bulker_desks')
        .select('id', { count: 'exact', head: true })
        .gt('created_at', lastRead);

      setNotifCounts({
        newUsers: usersCount || 0,
        withdrawals: withCount || 0,
        reviews: revCount || 0,
        bulkers: bulkerCount || 0
      });
    } catch (err) {
      console.error('Error fetching notification counts:', err);
    }
  };

  useEffect(() => {
    fetchNotificationCounts();
    const interval = setInterval(fetchNotificationCounts, 180000);
    window.addEventListener('notifications_updated', fetchNotificationCounts);
    return () => {
      clearInterval(interval);
      window.removeEventListener('notifications_updated', fetchNotificationCounts);
    };
  }, []);

  const totalNotifications = notifCounts.newUsers + notifCounts.withdrawals + notifCounts.reviews + notifCounts.bulkers;

  const handleNotifOpen = (event) => setNotifAnchorEl(event.currentTarget);
  const handleNotifClose = () => setNotifAnchorEl(null);

  const handleCategoryClick = (category) => {
    handleNotifClose();
    navigate(`/notifications?category=${category}`);
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleTogglePaymentMenu = (menu) => {
    setExpandedPaymentMenu(expandedPaymentMenu === menu ? '' : menu);
  };

  const sessionString = localStorage.getItem('adminSession');
  const adminSession = sessionString ? JSON.parse(sessionString) : { name: 'Admin User' };

  const handleLogout = () => {
    localStorage.removeItem('adminSession');
    handleMenuClose();
    navigate('/login');
  };

  const mainMenuItems = [
    { text: 'Dashboard', icon: <DashboardIcon fontSize="small" />, color: '#3b82f6', path: '/' },
    { text: 'Users Directory', icon: <PeopleAltIcon fontSize="small" />, color: '#06b6d4', path: '/users' },
    { text: 'Festive Puja Feed', icon: <PhotoLibraryIcon fontSize="small" />, color: '#f59e0b', path: '/puja-feed-2026' },
    { text: 'Community Lounge', icon: <ForumIcon fontSize="small" />, color: '#8b5cf6', path: '/community-chat' },
    { text: 'Payment Ledger', icon: <AccountBalanceWalletIcon fontSize="small" />, color: '#10b981', path: '/payments' },
    { text: 'System Alerts', icon: <NotificationsActiveIcon fontSize="small" />, color: '#ec4899', path: '/notifications', badge: totalNotifications },
  ];

  const appManagementItems = [
    { text: 'Deploy New App', icon: <LibraryAddIcon fontSize="small" />, color: '#3b82f6', path: '/add-app' },
    { text: 'Published Apps', icon: <AppsIcon fontSize="small" />, color: '#06b6d4', path: '/app-list' },
  ];

  const commentManagementItems = [
    { text: 'Add Review Task', icon: <RateReviewIcon fontSize="small" />, color: '#f59e0b', path: '/add-comment' },
    { text: 'Review Submissions', icon: <ForumIcon fontSize="small" />, color: '#8b5cf6', path: '/manage-comment' },
  ];

  const liveListItems = [
    { text: 'Add Verification', icon: <PlaylistAddCheckIcon fontSize="small" />, color: '#10b981', path: '/add-live' },
    { text: 'Automatic Live List', icon: <AutoAwesomeIcon fontSize="small" />, color: '#8b5cf6', path: '/automatic-live-list' },
    { text: 'Verification List', icon: <ViewListIcon fontSize="small" />, color: '#3b82f6', path: '/live-list' },
  ];

  const othersItems = [
    { text: 'Mail Diagnostics', icon: <EmailIcon fontSize="small" />, color: '#06b6d4', path: '/live-checking-mails' },
    { text: 'Push Broadcasts', icon: <CampaignIcon fontSize="small" />, color: '#ec4899', path: '/push-notifications' },
    { text: 'OCR Scanner Zone', icon: <QrCodeScannerIcon fontSize="small" />, color: '#f59e0b', path: '/scan-zone' },
    { text: 'System Health Diagnostics', icon: <MonitorHeartIcon fontSize="small" />, color: '#10b981', path: 'http://localhost:7700', external: true },
  ];

  const fileManagerItems = [
    { text: 'Cloud File Vault', icon: <FolderSharedIcon fontSize="small" />, color: '#6366f1', path: '/file-manager' },
  ];

  const renderSkeletonItem = (key) => (
    <ListItem key={key} disablePadding sx={{ mb: 0.6 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', px: 2, py: 0.75 }}>
        <Skeleton variant="circular" width={26} height={26} sx={{ mr: 1.5, bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }} />
        <Skeleton variant="text" width="60%" height={18} sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }} />
      </Box>
    </ListItem>
  );

  const renderMenuItem = (item) => {
    const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
    const isDark = theme.palette.mode === 'dark';

    return (
      <ListItem key={item.text} disablePadding sx={{ mb: 0.55 }}>
        <ListItemButton
          onClick={() => {
            if (item.external) {
              window.open(item.path, '_blank');
              return;
            }
            navigate(item.path);
            if (isMobile) setMobileOpen(false);
          }}
          sx={{
            borderRadius: '16px',
            mx: 1.25,
            minHeight: '44px',
            py: 0.8,
            px: 1.6,
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)',
            // Active State
            ...(isActive ? {
              background: isDark
                ? 'linear-gradient(135deg, rgba(59,130,246,0.25) 0%, rgba(147,51,234,0.14) 100%)'
                : 'linear-gradient(135deg, rgba(37,99,235,0.14) 0%, rgba(96,165,250,0.08) 100%)',
              color: isDark ? '#93c5fd' : '#1d4ed8',
              backdropFilter: 'blur(12px)',
              border: isDark ? '1px solid rgba(96,165,250,0.32)' : '1px solid rgba(37,99,235,0.20)',
              boxShadow: isDark
                ? '0 6px 20px rgba(59,130,246,0.22), inset 0 0 10px rgba(96,165,250,0.10)'
                : '0 4px 16px rgba(37,99,235,0.10)',
              '&::before': {
                content: '""',
                position: 'absolute',
                left: 0,
                top: '20%',
                bottom: '20%',
                width: '4px',
                borderRadius: '0 4px 4px 0',
                background: 'linear-gradient(180deg, #38bdf8, #818cf8)',
                boxShadow: '0 0 12px #38bdf8',
              }
            } : {
              color: isDark ? '#94a3b8' : '#64748b',
              '&:hover': {
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)',
                color: isDark ? '#f8fafc' : '#0f172a',
                transform: 'translateX(5px)',
                '& .menu-icon-wrapper': {
                  transform: 'scale(1.2) rotate(-4deg)',
                  backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : 'rgba(37,99,235,0.12)',
                  color: isDark ? '#60a5fa' : '#2563eb',
                  boxShadow: '0 4px 12px rgba(37,99,235,0.2)',
                }
              }
            })
          }}
        >
          <Box
            className="menu-icon-wrapper"
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: '10px',
              mr: 1.5,
              transition: 'all 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)',
              backgroundColor: isActive
                ? (isDark ? 'rgba(59,130,246,0.22)' : 'rgba(37,99,235,0.14)')
                : 'transparent',
              color: isActive
                ? (isDark ? '#60a5fa' : '#2563eb')
                : 'inherit',
              '& svg': {
                fontSize: '1.2rem',
                transition: 'transform 0.25s ease',
              }
            }}
          >
            {item.icon}
          </Box>
          <ListItemText
            primary={item.text}
            primaryTypographyProps={{
              fontWeight: isActive ? 750 : 600,
              fontSize: '0.82rem',
              letterSpacing: '0.01em',
            }}
          />
          {item.badge > 0 && (
            <Chip
              label={item.badge}
              size="small"
              color="error"
              sx={{
                height: 20,
                fontSize: '0.68rem',
                fontWeight: 800,
                borderRadius: '8px',
                animation: 'pulseBadge 2s infinite',
                '@keyframes pulseBadge': {
                  '0%': { transform: 'scale(1)' },
                  '50%': { transform: 'scale(1.1)' },
                  '100%': { transform: 'scale(1)' },
                }
              }}
            />
          )}
        </ListItemButton>
      </ListItem>
    );
  };

  const renderNavigationGroup = (title, items, addDivider = true) => {
    if (sidebarLoading) {
      return (
        <Box key={title}>
          <Typography variant="overline" sx={{ px: 3, mb: 0.8, mt: 1.6, fontWeight: 800, color: 'text.disabled', fontSize: '0.62rem', display: 'block', letterSpacing: 1 }}>
            {title}
          </Typography>
          <List sx={{ pt: 0 }}>
            {Array.from({ length: 3 }).map((_, index) => renderSkeletonItem(`${title}-${index}`))}
          </List>
          {addDivider && <Divider sx={{ my: 1, mx: 2, opacity: 0.5 }} />}
        </Box>
      );
    }

    return (
      <Box key={title} sx={{ mb: 0.6 }}>
        <Typography
          variant="overline"
          sx={{
            px: 2.8,
            mb: 0.6,
            mt: 1.8,
            fontWeight: 800,
            color: theme.palette.mode === 'light' ? 'rgba(100,116,139,0.85)' : 'rgba(148,163,184,0.65)',
            fontSize: '0.62rem',
            display: 'flex',
            alignItems: 'center',
            letterSpacing: 1.2,
            gap: 1.2,
            '&::after': {
              content: '""',
              flex: 1,
              height: '1px',
              bgcolor: theme.palette.divider,
              opacity: 0.7,
              mr: 2.2
            }
          }}
        >
          {title}
        </Typography>
        <List sx={{ pt: 0, pb: 0.4 }}>
          {items.map(renderMenuItem)}
        </List>
      </Box>
    );
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
      <Box
        sx={{
          height: '68px',
          minHeight: '68px',
          px: 2.2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.mode === 'light' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.02)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4 }}>
          <Box sx={{ position: 'relative' }}>
            <Avatar
              sx={{
                width: 36,
                height: 36,
                color: '#fff',
                fontSize: '0.95rem',
                fontWeight: 900,
                background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
                boxShadow: '0 6px 14px rgba(37,99,235,0.3)',
              }}
            >
              {adminSession.name ? adminSession.name.charAt(0).toUpperCase() : 'N'}
            </Avatar>
            <Box
              sx={{
                position: 'absolute',
                bottom: -1,
                right: -1,
                width: 9,
                height: 9,
                borderRadius: '50%',
                bgcolor: '#22c55e',
                border: `2px solid ${theme.palette.mode === 'light' ? '#fff' : '#0c0f17'}`,
                boxShadow: '0 0 6px #22c55e',
              }}
            />
          </Box>
          <Box>
            <Typography variant="body1" sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 800, fontSize: '0.92rem', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
              Novaira Global
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.2 }}>
              <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 800, fontSize: '0.62rem', letterSpacing: 1.1 }}>
                ADMIN PRO
              </Typography>
              <Chip label="v2.1" size="small" sx={{ height: 16, fontSize: '0.58rem', fontWeight: 800, bgcolor: theme.palette.mode === 'light' ? 'rgba(37,99,235,0.08)' : 'rgba(59,130,246,0.15)', color: 'primary.main', px: 0.2 }} />
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              bgcolor: '#10b981',
              boxShadow: '0 0 8px #10b981',
              animation: 'dockPulse 2.5s infinite',
              '@keyframes dockPulse': {
                '0%, 100%': { opacity: 0.7, transform: 'scale(1)' },
                '50%': { opacity: 1, transform: 'scale(1.25)' },
              }
            }}
          />
        </Box>
      </Box>

      <Box sx={{ overflowY: 'auto', overflowX: 'hidden', flexGrow: 1, px: 0, pt: 0, pb: 2 }}>
        {renderNavigationGroup('MAIN MENU', mainMenuItems, false)}
        {renderNavigationGroup('APP MANAGEMENT', appManagementItems, false)}
        {renderNavigationGroup('COMMENT MANAGEMENT', commentManagementItems, false)}
        {renderNavigationGroup('LIVE LIST MANAGEMENT', liveListItems, false)}
        {renderNavigationGroup('FILE MANAGER', fileManagerItems, false)}
        {renderNavigationGroup('OTHERS', othersItems, false)}
      </Box>

      <Box
        sx={{
          p: 1.8,
          borderTop: `1px solid ${theme.palette.divider}`,
          background: theme.palette.mode === 'light' ? 'rgba(255,255,255,0.78)' : 'rgba(8,11,18,0.72)',
          backdropFilter: 'blur(24px) saturate(180%)',
          borderTop: theme.palette.mode === 'light' ? '1px solid rgba(15,23,42,0.08)' : '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <List sx={{ p: 0, mb: 1.2, mx: -0.5 }}>
          {renderMenuItem({ text: 'Settings', icon: <SettingsIcon fontSize="small" />, path: '/settings' })}
        </List>

        <ListItemButton
          onClick={handleLogout}
          sx={{
            borderRadius: '16px',
            minHeight: '42px',
            py: 0.8,
            px: 1.6,
            color: 'error.main',
            border: theme.palette.mode === 'light' ? '1px solid rgba(239,68,68,0.15)' : '1px solid rgba(239,68,68,0.2)',
            background: theme.palette.mode === 'light'
              ? 'linear-gradient(135deg, rgba(239,68,68,0.05), rgba(239,68,68,0.01))'
              : 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.02))',
            transition: 'all 0.25s ease',
            '&:hover': {
              background: theme.palette.mode === 'light'
                ? 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.06))'
                : 'linear-gradient(135deg, rgba(239,68,68,0.22), rgba(239,68,68,0.08))',
              transform: 'translateX(3px)',
              borderColor: 'error.main',
              '& .logout-icon': {
                transform: 'scale(1.15) rotate(-8deg)',
              }
            },
          }}
        >
          <ListItemIcon className="logout-icon" sx={{ color: 'error.main', minWidth: '32px', transition: 'transform 0.2s ease' }}>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Logout" primaryTypographyProps={{ fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.02em' }} />
        </ListItemButton>
      </Box>
    </Box>
  );

  const renderExpandableMenu = (title, items, categoryIcon, categoryColor = '#3b82f6') => {
    const isExpanded = expandedPaymentMenu === title.toLowerCase();
    const isChildActive = items.some((item) => location.pathname === item.path);
    const isDark = theme.palette.mode === 'dark';

    return (
      <Box key={title} sx={{ mb: 0.6 }}>
        <ListItem disablePadding sx={{ mb: 0.2 }}>
          <ListItemButton
            onClick={() => handleTogglePaymentMenu(title.toLowerCase())}
            sx={{
              borderRadius: '16px',
              mx: 1.25,
              minHeight: '44px',
              py: 0.8,
              px: 1.5,
              transition: 'all 0.25s ease',
              backgroundImage: isChildActive
                ? (isDark
                  ? `linear-gradient(135deg, ${categoryColor}25, ${categoryColor}08)`
                  : `linear-gradient(135deg, ${categoryColor}18, ${categoryColor}06)`)
                : 'none',
              color: isChildActive ? (isDark ? '#fff' : categoryColor) : (isDark ? '#e2e8f0' : '#334155'),
              boxShadow: isChildActive ? `inset 0 0 0 1px ${categoryColor}40` : 'none',
              '&:hover': {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
                transform: 'translateX(3px)',
              },
            }}
          >
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '9px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mr: 1.25,
                bgcolor: isChildActive
                  ? categoryColor
                  : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)'),
                color: isChildActive ? '#fff' : (isDark ? '#94a3b8' : '#64748b'),
                boxShadow: isChildActive ? `0 2px 10px ${categoryColor}50` : 'none',
                transition: 'all 0.25s ease',
              }}
            >
              {categoryIcon}
            </Box>
            <ListItemText
              primary={title}
              primaryTypographyProps={{
                fontWeight: isChildActive ? 800 : 700,
                fontSize: '0.78rem',
                letterSpacing: '0.04em',
              }}
            />
            <Chip
              label={items.length}
              size="small"
              sx={{
                height: 18,
                minWidth: 18,
                fontSize: '0.62rem',
                fontWeight: 800,
                mr: 0.8,
                bgcolor: isChildActive
                  ? (isDark ? 'rgba(255,255,255,0.15)' : `${categoryColor}20`)
                  : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
                color: isChildActive ? (isDark ? '#fff' : categoryColor) : 'text.secondary',
              }}
            />
            <Box
              sx={{
                transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ExpandMore fontSize="small" sx={{ opacity: 0.7 }} />
            </Box>
          </ListItemButton>
        </ListItem>
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <List component="div" disablePadding sx={{ pl: 1.5, pt: 0.4 }}>
            {items.map((item) => {
              const isActive = location.pathname === item.path;
              const textColor = isActive
                ? (isDark ? '#fff' : categoryColor)
                : (isDark ? '#94a3b8' : '#64748b');

              return (
                <ListItem key={item.text} disablePadding sx={{ mb: 0.35 }}>
                  <ListItemButton
                    onClick={() => {
                      navigate(item.path);
                      if (isMobile) setMobileOpen(false);
                    }}
                    sx={{
                      borderRadius: '12px',
                      mx: 1.2,
                      minHeight: '38px',
                      py: 0.55,
                      px: 1.4,
                      position: 'relative',
                      transition: 'all 0.25s ease',
                      backgroundImage: isActive
                        ? (isDark
                          ? `linear-gradient(135deg, ${categoryColor}30, ${categoryColor}10)`
                          : `linear-gradient(135deg, ${categoryColor}18, ${categoryColor}05)`)
                        : 'none',
                      color: textColor,
                      boxShadow: isActive ? `inset 0 0 0 1px ${categoryColor}35` : 'none',
                      '&:hover': {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
                        transform: 'translateX(4px)',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mr: 1.2,
                        color: isActive ? categoryColor : 'text.secondary',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {item.icon}
                    </Box>
                    <ListItemText
                      primary={item.text}
                      primaryTypographyProps={{
                        fontWeight: isActive ? 800 : 600,
                        fontSize: '0.75rem',
                      }}
                    />
                    {isActive && (
                      <Box
                        sx={{
                          width: 5,
                          height: 18,
                          borderRadius: '3px',
                          bgcolor: categoryColor,
                          boxShadow: `0 0 8px ${categoryColor}`,
                        }}
                      />
                    )}
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Collapse>
      </Box>
    );
  };

  const clientSubMenuItems = [
    { text: 'Invoices', path: '/payments/clients/invoices', icon: <ReceiptLongIcon sx={{ fontSize: 16 }} /> },
    { text: 'Payments', path: '/payments/clients/payments', icon: <PaymentsIcon sx={{ fontSize: 16 }} /> },
    { text: 'Settings', path: '/payments/clients/settings', icon: <SettingsApplicationsIcon sx={{ fontSize: 16 }} /> },
  ];

  const individualSubMenuItems = [
    { text: 'User Wallet', path: '/payments/individuals/wallet', icon: <AccountBalanceWalletIcon sx={{ fontSize: 16 }} /> },
    { text: 'Withdrawals Request', path: '/payments/individuals/withdrawals', icon: <PaidIcon sx={{ fontSize: 16 }} /> },
    { text: 'Gift Cards', path: '/payments/individuals/gift-cards', icon: <CardGiftcardIcon sx={{ fontSize: 16 }} /> },
    { text: 'Settings Payments', path: '/payments/individuals/settings-payments', icon: <TuneIcon sx={{ fontSize: 16 }} /> },
  ];

  const bulkerSubMenuItems = [
    { text: 'User Wallet', path: '/payments/bulkers/wallet', icon: <AccountBalanceWalletIcon sx={{ fontSize: 16 }} /> },
    { text: 'Invoices', path: '/payments/bulkers/invoices', icon: <ReceiptLongIcon sx={{ fontSize: 16 }} /> },
  ];

  const providerSubMenuItems = [
    { text: 'Invoice & Bills', path: '/payments/providers/invoices', icon: <ReceiptLongIcon sx={{ fontSize: 16 }} /> },
  ];

  const paymentsDrawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
      <Box sx={{ height: '68px', minHeight: '68px', px: 2, display: 'flex', alignItems: 'center', borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Button
          fullWidth
          variant="outlined"
          color="inherit"
          startIcon={<ArrowBackIosNewIcon fontSize="small" />}
          onClick={() => navigate('/')}
          sx={{
            borderRadius: '12px',
            minHeight: '38px',
            justifyContent: 'flex-start',
            color: 'text.secondary',
            borderColor: 'divider',
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.8rem',
            backgroundColor: theme.palette.mode === 'light' ? 'rgba(255,255,255,0.5)' : 'rgba(15,17,23,0.35)',
          }}
        >
          Back to Dashboard
        </Button>
      </Box>

      <Box sx={{ overflowY: 'auto', overflowX: 'hidden', flexGrow: 1, px: 0, pt: 0, pb: 2 }}>
        <Typography variant="overline" sx={{ px: 3, mb: 0.8, mt: 1.5, fontWeight: 700, color: 'text.disabled', fontSize: '0.6rem', display: 'block', letterSpacing: 0.7 }}>
          PAYMENT SYSTEM
        </Typography>

        <List sx={{ pt: 0 }}>
          {renderMenuItem({ text: 'Payment Dashboard', icon: <AccountBalanceIcon fontSize="small" />, path: '/payments' })}
        </List>

        <Divider sx={{ my: 1, mx: 2, opacity: 0.5 }} />

        <Typography variant="overline" sx={{ px: 3, mb: 0.8, mt: 1.5, fontWeight: 700, color: 'text.disabled', fontSize: '0.6rem', display: 'block', letterSpacing: 0.7 }}>
          TRANSACTIONS & ACCOUNTS
        </Typography>

        <List sx={{ pt: 0 }}>
          {renderExpandableMenu('CLIENTS', clientSubMenuItems, <BusinessIcon sx={{ fontSize: 16 }} />, '#3b82f6')}
          {renderExpandableMenu('INDIVIDUALS', individualSubMenuItems, <PersonIcon sx={{ fontSize: 16 }} />, '#10b981')}
          {renderExpandableMenu('BULKERS', bulkerSubMenuItems, <StorefrontIcon sx={{ fontSize: 16 }} />, '#8b5cf6')}
          {renderExpandableMenu('PROVIDERS', providerSubMenuItems, <AccountBalanceIcon sx={{ fontSize: 16 }} />, '#f59e0b')}
        </List>

        <Divider sx={{ my: 1, mx: 2, opacity: 0.5 }} />

        <List sx={{ pt: 0, mx: -0.5 }}>
          {renderMenuItem({ text: 'Settings', icon: <SettingsIcon fontSize="small" />, path: '/payments/settings' })}
        </List>
      </Box>

      <Box sx={{ p: 2, pt: 1.5, borderTop: `1px solid ${theme.palette.divider}`, background: theme.palette.mode === 'light' ? 'rgba(255,255,255,0.7)' : 'rgba(15,17,23,0.5)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ width: 34, height: 34, background: 'linear-gradient(135deg, #10b981, #06b6d4)', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)' }}>
          <AccountBalanceWalletIcon sx={{ fontSize: 18, color: '#fff' }} />
        </Avatar>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '0.82rem' }}>Financial Ledger</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10b981', boxShadow: '0 0 6px #10b981' }} />
            <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 800, fontSize: '0.68rem', letterSpacing: '0.03em' }}>LEDGER SECURED</Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  const communityChatSubMenuItems = [
    { text: 'Live Stream Lounge', icon: <ForumIcon fontSize="small" />, color: '#06b6d4', path: '/community-chat' },
    { text: 'Chatters & Moderation', icon: <PeopleAltIcon fontSize="small" />, color: '#3b82f6', path: '/community-chat/users' },
    { text: 'Broadcast Ads', icon: <CampaignIcon fontSize="small" />, color: '#f59e0b', path: '/community-chat/ads' },
    { text: 'Pinned Announcements', icon: <PushPinIcon fontSize="small" />, color: '#ec4899', path: '/community-chat/pinned' },
    { text: 'Security & Slow Mode', icon: <SecurityIcon fontSize="small" />, color: '#10b981', path: '/community-chat/settings' },
  ];

  const communityChatDrawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
      <Box
        sx={{
          height: '68px',
          minHeight: '68px',
          px: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.mode === 'light' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.02)',
        }}
      >
        <Button
          fullWidth
          variant="outlined"
          color="inherit"
          startIcon={<ArrowBackIosNewIcon fontSize="small" sx={{ fontSize: 13 }} />}
          onClick={() => navigate('/')}
          sx={{
            borderRadius: '12px',
            minHeight: '38px',
            justifyContent: 'flex-start',
            color: 'text.primary',
            borderColor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.1)',
            textTransform: 'none',
            fontWeight: 750,
            fontSize: '0.8rem',
            bgcolor: theme.palette.mode === 'light' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.04)',
            '&:hover': {
              bgcolor: theme.palette.mode === 'light' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.08)',
              borderColor: 'primary.main',
            }
          }}
        >
          Back to Dashboard
        </Button>
      </Box>

      {/* Brand & Channel Info */}
      <Box sx={{ px: 2.2, pt: 2, pb: 1 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.2,
            p: 1.4,
            borderRadius: '16px',
            bgcolor: 'rgba(6, 182, 212, 0.1)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
          }}
        >
          <Avatar sx={{ width: 32, height: 32, background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', boxShadow: '0 4px 10px rgba(6, 182, 212, 0.35)' }}>
            <ForumIcon sx={{ fontSize: 17, color: '#fff' }} />
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '0.82rem', lineHeight: 1.2 }}>
              Community Lounge
            </Typography>
            <Typography variant="caption" sx={{ color: '#06b6d4', fontWeight: 700, fontSize: '0.66rem', letterSpacing: '0.04em' }}>
              MODERATION OS
            </Typography>
          </Box>
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
        </Box>
      </Box>

      <Box sx={{ overflowY: 'auto', overflowX: 'hidden', flexGrow: 1, px: 0, pt: 0.5, pb: 2 }}>
        <Typography variant="overline" sx={{ px: 2.8, mb: 0.6, mt: 1.2, fontWeight: 800, color: 'text.secondary', fontSize: '0.62rem', display: 'flex', alignItems: 'center', letterSpacing: 1.2, gap: 1.2, '&::after': { content: '""', flex: 1, height: '1px', bgcolor: theme.palette.divider, opacity: 0.7, mr: 2.2 } }}>
          LOUNGE CHANNELS
        </Typography>

        <List sx={{ pt: 0, pb: 0.4 }}>
          {communityChatSubMenuItems.map(renderMenuItem)}
        </List>
      </Box>

      {/* Footer Live Telemetry */}
      <Box
        sx={{
          p: 1.8,
          borderTop: `1px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.mode === 'light' ? 'rgba(255,255,255,0.7)' : 'rgba(8,11,18,0.7)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Box sx={{ position: 'relative' }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.72rem', color: '#22c55e', letterSpacing: '0.04em', display: 'block' }}>
              REAL-TIME WEBSOCKET
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
              Connected to public lounge
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  const getHeaderInfo = () => {
    const allItems = [
      ...mainMenuItems,
      ...appManagementItems,
      ...commentManagementItems,
      ...liveListItems,
      ...othersItems,
      ...fileManagerItems,
      ...communityChatSubMenuItems,
    ];
    const match = allItems.find((m) => m.path === location.pathname);
    if (match) return { title: match.text, section: 'Novaira OS' };
    if (location.pathname.startsWith('/puja-feed')) return { title: 'Festive Puja Feed', section: 'Campaigns' };
    if (location.pathname.startsWith('/community-chat')) return { title: 'Community Lounge', section: 'Realtime' };
    if (location.pathname.startsWith('/payments')) return { title: 'Financial Ledger', section: 'Payments' };
    if (location.pathname.startsWith('/settings')) return { title: 'Platform Settings', section: 'System' };
    return { title: 'Novaira Admin Suite', section: 'Novaira OS' };
  };

  const activeDrawer = isPaymentsRoute ? paymentsDrawer : (isCommunityChatRoute ? communityChatDrawer : drawer);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <CssBaseline />

      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          backgroundColor: theme.palette.mode === 'light' ? 'rgba(255, 255, 255, 0.78)' : 'rgba(7, 9, 14, 0.75)',
          borderBottom: theme.palette.mode === 'light' ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: theme.palette.mode === 'light' ? '0 4px 20px rgba(0, 0, 0, 0.02)' : '0 10px 30px rgba(0, 0, 0, 0.35)',
          transition: 'all 0.3s ease',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, sm: 3 }, minHeight: '68px' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{
                display: { md: 'none' },
                borderRadius: '12px',
                border: theme.palette.mode === 'light' ? '1px solid rgba(15,23,42,0.1)' : '1px solid rgba(255,255,255,0.1)',
                bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.03)' : 'rgba(255,255,255,0.05)',
              }}
            >
              <MenuIcon />
            </IconButton>

            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {getHeaderInfo().section}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem' }}>/</Typography>
                <Typography variant="h6" noWrap sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.01em', background: theme.palette.mode === 'dark' ? 'linear-gradient(135deg, #f8fafc 0%, #cbd5e1 100%)' : 'linear-gradient(135deg, #0f172a 0%, #334155 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {getHeaderInfo().title}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                        {/* OmniSearch Global Search Pill */}
            <Box
              onClick={() => setSearchOpen(true)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.2,
                px: 1.8,
                py: 0.7,
                width: { xs: '150px', sm: '240px', md: '340px' },
                borderRadius: '12px',
                cursor: 'pointer',
                bgcolor: theme.palette.mode === 'light' ? 'rgba(15, 23, 42, 0.04)' : 'rgba(255, 255, 255, 0.05)',
                border: theme.palette.mode === 'light' ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(12px)',
                transition: 'all 0.22s ease',
                '&:hover': {
                  bgcolor: theme.palette.mode === 'light' ? 'rgba(15, 23, 42, 0.07)' : 'rgba(255, 255, 255, 0.08)',
                  borderColor: 'primary.main',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
                }
              }}
            >
              <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography sx={{ flex: 1, fontSize: '0.82rem', color: 'text.secondary', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Search pages, users, apps...
              </Typography>
              <Chip
                label="Ctrl K"
                size="small"
                sx={{
                  display: { xs: 'none', sm: 'inline-flex' },
                  height: 19,
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  borderRadius: '5px',
                  bgcolor: theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)',
                  color: 'text.secondary',
                  border: theme.palette.mode === 'light' ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.1)'
                }}
              />
            </Box>

            {/* Live Security Pill */}
            <Box
              sx={{
                display: { xs: 'none', md: 'flex' },
                alignItems: 'center',
                gap: 0.8,
                px: 1.5,
                py: 0.5,
                borderRadius: '24px',
                background: theme.palette.mode === 'light' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                boxShadow: '0 0 16px rgba(16, 185, 129, 0.15)',
              }}
            >
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  bgcolor: '#10b981',
                  boxShadow: '0 0 10px #10b981',
                  animation: 'pulseStatusDot 2s infinite',
                  '@keyframes pulseStatusDot': {
                    '0%': { transform: 'scale(1)', opacity: 0.8 },
                    '50%': { transform: 'scale(1.3)', opacity: 1 },
                    '100%': { transform: 'scale(1)', opacity: 0.8 },
                  }
                }}
              />
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: '#10b981', letterSpacing: '0.06em' }}>
                SYSTEM SECURE
              </Typography>
            </Box>

            {/* Dark / Light Mode Toggle */}
            <IconButton
              onClick={colorMode.toggleColorMode}
              size="small"
              sx={{
                width: 40,
                height: 40,
                borderRadius: '13px',
                background: theme.palette.mode === 'light' ? 'rgba(37,99,235,0.06)' : 'rgba(255,255,255,0.05)',
                border: theme.palette.mode === 'light' ? '1px solid rgba(37,99,235,0.12)' : '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                '&:hover': {
                  background: theme.palette.mode === 'light' ? 'rgba(37,99,235,0.12)' : 'rgba(255,255,255,0.1)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.12)'
                }
              }}
            >
              {theme.palette.mode === 'dark' ? <LightModeIcon sx={{ color: '#fbbf24', fontSize: '1.25rem' }} /> : <DarkModeOutlinedIcon sx={{ color: '#2563eb', fontSize: '1.25rem' }} />}
            </IconButton>

            {/* Notifications Toggle */}
            <IconButton
              onClick={handleNotifOpen}
              size="small"
              sx={{
                width: 40,
                height: 40,
                borderRadius: '13px',
                background: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)',
                border: theme.palette.mode === 'light' ? '1px solid rgba(15,23,42,0.08)' : '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                '&:hover': {
                  background: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.1)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.12)'
                }
              }}
            >
              <Badge badgeContent={totalNotifications} color="error" max={99}>
                <NotificationsNoneIcon sx={{ fontSize: '1.25rem' }} />
              </Badge>
            </IconButton>

            {/* Profile Pill */}
            <Box
              onClick={handleProfileMenuOpen}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.2,
                py: 0.5,
                px: 1.2,
                pl: 0.6,
                borderRadius: '16px',
                cursor: 'pointer',
                background: theme.palette.mode === 'light' ? 'rgba(37,99,235,0.05)' : 'rgba(255,255,255,0.05)',
                border: theme.palette.mode === 'light' ? '1px solid rgba(37,99,235,0.12)' : '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                '&:hover': {
                  background: theme.palette.mode === 'light' ? 'rgba(37,99,235,0.1)' : 'rgba(255,255,255,0.1)',
                  transform: 'translateY(-2px)',
                  borderColor: 'primary.main',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.15)'
                }
              }}
            >
              <Avatar
                alt="Admin"
                sx={{
                  width: 34,
                  height: 34,
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.35)',
                  fontSize: '0.88rem',
                  fontWeight: 900
                }}
              >
                {adminSession?.name ? adminSession.name.charAt(0).toUpperCase() : 'A'}
              </Avatar>
              <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'left', pr: 0.5 }}>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 750, lineHeight: 1.2, color: 'text.primary' }}>
                  {adminSession?.name || 'Administrator'}
                </Typography>
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: 'primary.main', letterSpacing: '0.04em' }}>
                  EXECUTIVE ADMIN
                </Typography>
              </Box>
            </Box>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Notification Popover Modal */}
      <Popover
        open={Boolean(notifAnchorEl)}
        anchorEl={notifAnchorEl}
        onClose={handleNotifClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          elevation: 6,
          sx: {
            mt: 1.5,
            width: { xs: 330, sm: 380 },
            borderRadius: '24px',
            overflow: 'hidden',
            border: `1px solid ${theme.palette.divider}`,
            bgcolor: theme.palette.mode === 'light' ? '#fff' : '#1e2430',
            boxShadow: '0 20px 40px rgba(0,0,0,0.12)'
          }
        }}
      >
        {/* Header */}
        <Box sx={{ p: 2.2, pb: 1.8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${theme.palette.divider}`, bgcolor: theme.palette.mode === 'light' ? 'rgba(37,99,235,0.03)' : 'rgba(255,255,255,0.02)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Notifications</Typography>
            {totalNotifications > 0 && (
              <Chip label={`${totalNotifications} New`} size="small" color="error" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 800 }} />
            )}
          </Box>
          <Button
            size="small"
            color="primary"
            onClick={() => {
              localStorage.setItem('admin_last_read_notifications', new Date().toISOString());
              fetchNotificationCounts();
            }}
            sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 700 }}
          >
            Mark all read
          </Button>
        </Box>

        {/* Categories List */}
        <List sx={{ p: 1.5, pb: 1 }}>
          {/* Category 1: New Users */}
          <ListItemButton
            onClick={() => handleCategoryClick('users')}
            sx={{
              borderRadius: '16px',
              py: 1.2,
              px: 1.5,
              mb: 0.8,
              transition: 'all 0.2s ease',
              '&:hover': { bgcolor: theme.palette.mode === 'light' ? 'rgba(37,99,235,0.06)' : 'rgba(148,163,184,0.1)' }
            }}
          >
            <ListItemIcon sx={{ minWidth: 42 }}>
              <Avatar sx={{ width: 34, height: 34, bgcolor: 'rgba(59,130,246,0.12)', color: '#3b82f6', borderRadius: '10px' }}>
                <PersonAddAlt1Icon sx={{ fontSize: 18 }} />
              </Avatar>
            </ListItemIcon>
            <ListItemText
              primary={<Typography variant="body2" sx={{ fontWeight: 700 }}>New Users</Typography>}
              secondary={<Typography variant="caption" color="text.secondary">Recently registered earners</Typography>}
            />
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={notifCounts.newUsers}
                size="small"
                color={notifCounts.newUsers > 0 ? 'info' : 'default'}
                sx={{ height: 22, fontWeight: 800, fontSize: '0.75rem' }}
              />
              <IconButton size="small" sx={{ p: 0.5, color: 'text.secondary' }}>
                <ArrowForwardIosIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Stack>
          </ListItemButton>

          {/* Category 2: Individual Withdrawals */}
          <ListItemButton
            onClick={() => handleCategoryClick('withdrawals')}
            sx={{
              borderRadius: '16px',
              py: 1.2,
              px: 1.5,
              mb: 0.8,
              transition: 'all 0.2s ease',
              '&:hover': { bgcolor: theme.palette.mode === 'light' ? 'rgba(245,158,11,0.06)' : 'rgba(148,163,184,0.1)' }
            }}
          >
            <ListItemIcon sx={{ minWidth: 42 }}>
              <Avatar sx={{ width: 34, height: 34, bgcolor: 'rgba(245,158,11,0.12)', color: '#f59e0b', borderRadius: '10px' }}>
                <AccountBalanceWalletIcon sx={{ fontSize: 18 }} />
              </Avatar>
            </ListItemIcon>
            <ListItemText
              primary={<Typography variant="body2" sx={{ fontWeight: 700 }}>Withdrawal Requests</Typography>}
              secondary={<Typography variant="caption" color="text.secondary">Pending payouts to verify</Typography>}
            />
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={notifCounts.withdrawals}
                size="small"
                color={notifCounts.withdrawals > 0 ? 'warning' : 'default'}
                sx={{ height: 22, fontWeight: 800, fontSize: '0.75rem' }}
              />
              <IconButton size="small" sx={{ p: 0.5, color: 'text.secondary' }}>
                <ArrowForwardIosIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Stack>
          </ListItemButton>

          {/* Category 3: Task Submissions Under Review */}
          <ListItemButton
            onClick={() => handleCategoryClick('reviews')}
            sx={{
              borderRadius: '16px',
              py: 1.2,
              px: 1.5,
              mb: 0.8,
              transition: 'all 0.2s ease',
              '&:hover': { bgcolor: theme.palette.mode === 'light' ? 'rgba(139,92,246,0.06)' : 'rgba(148,163,184,0.1)' }
            }}
          >
            <ListItemIcon sx={{ minWidth: 42 }}>
              <Avatar sx={{ width: 34, height: 34, bgcolor: 'rgba(139,92,246,0.12)', color: '#8b5cf6', borderRadius: '10px' }}>
                <RateReviewIcon sx={{ fontSize: 18 }} />
              </Avatar>
            </ListItemIcon>
            <ListItemText
              primary={<Typography variant="body2" sx={{ fontWeight: 700 }}>Tasks Under Review</Typography>}
              secondary={<Typography variant="caption" color="text.secondary">Screenshots awaiting check</Typography>}
            />
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={notifCounts.reviews}
                size="small"
                color={notifCounts.reviews > 0 ? 'primary' : 'default'}
                sx={{ height: 22, fontWeight: 800, fontSize: '0.75rem' }}
              />
              <IconButton size="small" sx={{ p: 0.5, color: 'text.secondary' }}>
                <ArrowForwardIosIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Stack>
          </ListItemButton>

          {/* Category 4: Bulkers */}
          <ListItemButton
            onClick={() => handleCategoryClick('bulkers')}
            sx={{
              borderRadius: '16px',
              py: 1.2,
              px: 1.5,
              mb: 0.5,
              transition: 'all 0.2s ease',
              '&:hover': { bgcolor: theme.palette.mode === 'light' ? 'rgba(16,185,129,0.06)' : 'rgba(148,163,184,0.1)' }
            }}
          >
            <ListItemIcon sx={{ minWidth: 42 }}>
              <Avatar sx={{ width: 34, height: 34, bgcolor: 'rgba(16,185,129,0.12)', color: '#10b981', borderRadius: '10px' }}>
                <GroupIcon sx={{ fontSize: 18 }} />
              </Avatar>
            </ListItemIcon>
            <ListItemText
              primary={<Typography variant="body2" sx={{ fontWeight: 700 }}>Bulker Desks</Typography>}
              secondary={<Typography variant="caption" color="text.secondary">Desk registrations</Typography>}
            />
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={notifCounts.bulkers}
                size="small"
                color={notifCounts.bulkers > 0 ? 'success' : 'default'}
                sx={{ height: 22, fontWeight: 800, fontSize: '0.75rem' }}
              />
              <IconButton size="small" sx={{ p: 0.5, color: 'text.secondary' }}>
                <ArrowForwardIosIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Stack>
          </ListItemButton>
        </List>

        <Divider />

        {/* Footer: View All */}
        <Box sx={{ p: 1.5, bgcolor: theme.palette.mode === 'light' ? 'rgba(0,0,0,0.01)' : 'rgba(255,255,255,0.02)' }}>
          <Button
            fullWidth
            variant="contained"
            color="primary"
            onClick={() => handleCategoryClick('all')}
            sx={{
              borderRadius: '14px',
              fontWeight: 700,
              textTransform: 'none',
              py: 1,
              boxShadow: 'none'
            }}
          >
            View All Notifications
          </Button>
        </Box>
      </Popover>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          elevation: 3,
          sx: { mt: 1.5, minWidth: 200, borderRadius: '18px' },
        }}
      >
        <MenuItem onClick={handleMenuClose} sx={{ py: 1.5 }}>
          <AccountCircleIcon sx={{ mr: 2, color: 'text.secondary' }} /> Profile
        </MenuItem>
        <MenuItem onClick={handleLogout} sx={{ py: 1.5, color: 'error.main' }}>
          <LogoutIcon sx={{ mr: 2 }} /> Logout
        </MenuItem>
      </Menu>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              borderTopRightRadius: '0px',
              borderBottomRightRadius: '0px',
              borderRadius: '0px !important',
              borderRight: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.mode === 'light' ? '#ffffff' : '#0c0f17',
              boxShadow: theme.palette.mode === 'light'
                ? '6px 0 32px rgba(0,0,0,0.06)'
                : '6px 0 32px rgba(0,0,0,0.5)',
              '&::-webkit-scrollbar': { width: '4px' },
              '&::-webkit-scrollbar-thumb': {
                background: theme.palette.mode === 'light' ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)',
                borderRadius: '10px',
              },
            },
          }}
        >
          {activeDrawer}
        </Drawer>

        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              borderRadius: '0px !important',
              borderRight: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.mode === 'light' ? '#ffffff' : '#0c0f17',
              backgroundImage: theme.palette.mode === 'light'
                ? 'radial-gradient(at 0% 0%, rgba(37,99,235,0.03) 0px, transparent 60%)'
                : 'radial-gradient(at 0% 0%, rgba(59,130,246,0.05) 0px, transparent 60%)',
              boxShadow: theme.palette.mode === 'light'
                ? '4px 0 24px rgba(0,0,0,0.02)'
                : '4px 0 24px rgba(0,0,0,0.3)',
              '&::-webkit-scrollbar': { width: '4px' },
              '&::-webkit-scrollbar-thumb': {
                background: theme.palette.mode === 'light' ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)',
                borderRadius: '10px',
              },
            },
          }}
          open
        >
          {activeDrawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          height: '100vh',
          overflow: 'auto',
          bgcolor: 'background.default',
        }}
      >
        <Toolbar sx={{ minHeight: '68px !important' }} />
        <Box sx={{ p: { xs: 2, sm: 3, md: 3.5 }, maxWidth: '1600px', mx: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
      <OmniSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} toggleColorMode={colorMode.toggleColorMode} />
    </Box>
  );
}


