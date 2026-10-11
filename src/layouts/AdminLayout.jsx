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
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Collapse from '@mui/material/Collapse';
import { supabase } from '../supabaseClient';

import { ColorModeContext } from '../App';

const drawerWidth = 260;

export default function AdminLayout() {
  const theme = useTheme();
  const colorMode = useContext(ColorModeContext);
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedPaymentMenu, setExpandedPaymentMenu] = useState('');
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const isPaymentsRoute = location.pathname.startsWith('/payments');

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
    try {
      const lastRead = localStorage.getItem('admin_last_read_notifications') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // 1. New users since last read
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gt('created_at', lastRead);

      // 2. Pending individual withdrawals
      const { count: withCount } = await supabase
        .from('individual_wallet_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Pending')
        .eq('transaction_type', 'Debit')
        .ilike('description', 'Withdrawal:%');

      // 3. Pending task submissions under review
      const { count: revCount } = await supabase
        .from('review_submit_data')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Under Review');

      // 4. Pending / latest bulkers
      const { count: bulkerCount } = await supabase
        .from('bulker_desks')
        .select('*', { count: 'exact', head: true })
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
    const interval = setInterval(fetchNotificationCounts, 30000);
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
    { text: 'Dashboard', icon: <DashboardIcon fontSize="small" />, path: '/' },
    { text: 'Users', icon: <PeopleAltIcon fontSize="small" />, path: '/users' },
    { text: 'Payments', icon: <AccountBalanceWalletIcon fontSize="small" />, path: '/payments' },
    { text: 'Notifications', icon: <NotificationsActiveIcon fontSize="small" />, path: '/notifications', badge: totalNotifications },
  ];

  const appManagementItems = [
    { text: 'Add App', icon: <LibraryAddIcon fontSize="small" />, path: '/add-app' },
    { text: 'App List', icon: <AppsIcon fontSize="small" />, path: '/app-list' },
  ];

  const commentManagementItems = [
    { text: 'Add Comment', icon: <RateReviewIcon fontSize="small" />, path: '/add-comment' },
    { text: 'Manage Comment', icon: <ForumIcon fontSize="small" />, path: '/manage-comment' },
  ];

  const liveListItems = [
    { text: 'Add Live', icon: <PlaylistAddCheckIcon fontSize="small" />, path: '/add-live' },
    { text: 'Live List', icon: <ViewListIcon fontSize="small" />, path: '/live-list' },
  ];

  const othersItems = [
    { text: 'Live Checking Mails', icon: <EmailIcon fontSize="small" />, path: '/live-checking-mails' },
    { text: 'Push Notifications', icon: <NotificationsActiveIcon fontSize="small" />, path: '/push-notifications' },
    { text: 'Scan Zone', icon: <QrCodeScannerIcon fontSize="small" />, path: '/scan-zone' },
  ];

  const fileManagerItems = [
    { text: 'File Manager', icon: <FolderSharedIcon fontSize="small" />, path: '/file-manager' },
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
                ? 'linear-gradient(135deg, rgba(37,99,235,0.22) 0%, rgba(59,130,246,0.10) 100%)'
                : 'linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(96,165,250,0.06) 100%)',
              color: isDark ? '#93c5fd' : '#1d4ed8',
              boxShadow: isDark
                ? 'inset 0 0 0 1px rgba(96,165,250,0.3), 0 4px 16px rgba(0,0,0,0.25)'
                : 'inset 0 0 0 1px rgba(37,99,235,0.22), 0 4px 16px rgba(37,99,235,0.1)',
              '&::before': {
                content: '""',
                position: 'absolute',
                left: 0,
                top: '22%',
                bottom: '22%',
                width: '4px',
                borderRadius: '0 4px 4px 0',
                background: 'linear-gradient(180deg, #3b82f6, #60a5fa)',
                boxShadow: '0 0 10px #3b82f6',
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
      <Box sx={{ px: 2, pt: 2, pb: 1.4 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 1.5,
            py: 1.2,
            borderRadius: '20px',
            border: theme.palette.mode === 'light'
              ? '1px solid rgba(37,99,235,0.12)'
              : '1px solid rgba(148,163,184,0.12)',
            background: theme.palette.mode === 'light'
              ? 'linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(255,255,255,0.9) 100%)'
              : 'linear-gradient(135deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.85) 100%)',
            boxShadow: theme.palette.mode === 'light'
              ? '0 10px 24px -6px rgba(37,99,235,0.08)'
              : '0 10px 24px -6px rgba(0,0,0,0.3)',
            transition: 'all 0.3s ease',
            '&:hover': {
              borderColor: 'primary.main',
              transform: 'translateY(-1px)',
              boxShadow: '0 12px 28px -4px rgba(37,99,235,0.15)',
            }
          }}
        >
          <Box sx={{ position: 'relative' }}>
            <Avatar
              sx={{
                width: 38,
                height: 38,
                color: '#fff',
                fontSize: '1rem',
                fontWeight: 900,
                background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
                boxShadow: '0 8px 16px rgba(37,99,235,0.32)',
                transition: 'transform 0.3s ease',
                '&:hover': { transform: 'rotate(10deg) scale(1.05)' }
              }}
            >
              {adminSession.name ? adminSession.name.charAt(0).toUpperCase() : 'N'}
            </Avatar>
            <Box
              sx={{
                position: 'absolute',
                bottom: -1,
                right: -1,
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: '#22c55e',
                border: `2px solid ${theme.palette.mode === 'light' ? '#fff' : '#0f172a'}`,
                boxShadow: '0 0 8px #22c55e',
              }}
            />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body1" sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 800, fontSize: '0.94rem', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
              Novaira Global
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.3 }}>
              <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 800, fontSize: '0.62rem', letterSpacing: 1.2 }}>
                ADMIN PRO
              </Typography>
              <Chip label="v2.1" size="small" sx={{ height: 16, fontSize: '0.6rem', fontWeight: 800, bgcolor: theme.palette.mode === 'light' ? 'rgba(37,99,235,0.08)' : 'rgba(59,130,246,0.15)', color: 'primary.main' }} />
            </Box>
          </Box>
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
          background: theme.palette.mode === 'light' ? 'rgba(255,255,255,0.8)' : 'rgba(12,15,23,0.8)',
          backdropFilter: 'blur(10px)',
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

  const renderExpandableMenu = (title, items) => {
    const isExpanded = expandedPaymentMenu === title.toLowerCase();
    const isChildActive = items.some((item) => location.pathname === item.path);
    const isDark = theme.palette.mode === 'dark';

    return (
      <Box key={title} sx={{ mb: 0.5 }}>
        <ListItem disablePadding sx={{ mb: 0.2 }}>
          <ListItemButton
            onClick={() => handleTogglePaymentMenu(title.toLowerCase())}
            sx={{
              borderRadius: '16px',
              mx: 1.25,
              minHeight: '42px',
              py: 0.75,
              px: 1.6,
              transition: 'all 0.25s ease',
              backgroundImage: isChildActive
                ? (isDark
                  ? 'linear-gradient(135deg, rgba(37,99,235,0.18), rgba(147,197,253,0.06))'
                  : 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(147,197,253,0.05))')
                : 'none',
              color: isChildActive ? (isDark ? '#93c5fd' : '#1d4ed8') : 'inherit',
              boxShadow: isChildActive ? 'inset 0 0 0 1px rgba(96,165,250,0.25)' : 'none',
              '&:hover': {
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)',
                transform: 'translateX(3px)',
              },
            }}
          >
            <ListItemText primary={title} primaryTypographyProps={{ fontWeight: isChildActive ? 800 : 650, fontSize: '0.78rem', letterSpacing: '0.02em' }} />
            <Box sx={{
              transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              display: 'flex',
              alignItems: 'center'
            }}>
              <ExpandMore fontSize="small" sx={{ opacity: 0.7 }} />
            </Box>
          </ListItemButton>
        </ListItem>
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <List component="div" disablePadding sx={{ pl: 1.2, pt: 0.4 }}>
            {items.map((item) => {
              const isActive = location.pathname === item.path;
              const textColor = isActive ? (isDark ? '#93c5fd' : '#1d4ed8') : (isDark ? '#94a3b8' : '#64748b');

              return (
                <ListItem key={item.text} disablePadding sx={{ mb: 0.35 }}>
                  <ListItemButton
                    onClick={() => {
                      navigate(item.path);
                      if (isMobile) setMobileOpen(false);
                    }}
                    sx={{
                      borderRadius: '14px',
                      mx: 1.5,
                      minHeight: '36px',
                      py: 0.55,
                      px: 1.5,
                      position: 'relative',
                      transition: 'all 0.25s ease',
                      backgroundImage: isActive
                        ? (isDark
                          ? 'linear-gradient(135deg, rgba(37,99,235,0.18), rgba(147,197,253,0.05))'
                          : 'linear-gradient(135deg, rgba(37,99,235,0.10), rgba(147,197,253,0.05))')
                        : 'none',
                      color: textColor,
                      '&:hover': {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)',
                        transform: 'translateX(4px)'
                      },
                    }}
                  >
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: isActive ? 'primary.main' : 'text.disabled', mr: 1.2, transition: 'all 0.2s ease' }} />
                    <ListItemText primary={item.text} primaryTypographyProps={{ fontWeight: isActive ? 750 : 550, fontSize: '0.74rem' }} />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Collapse>
      </Box>
    );
  };

  const paymentSubMenuItems = [
    { text: 'User Wallet', path: '/payments/wallet' },
    { text: 'Withdrawals Request', path: '/payments/withdrawals' },
    { text: 'Gift Cards', path: '/payments/gift-cards' },
    { text: 'Settings Payments', path: '/payments/settings-payments' },
  ];

  const clientSubMenuItems = [
    { text: 'Invoices', path: '/payments/clients/invoices' },
    { text: 'Payments', path: '/payments/clients/payments' },
    { text: 'Settings', path: '/payments/clients/settings' },
  ];

  const bulkerSubMenuItems = [
    { text: 'User Wallet', path: '/payments/bulkers/wallet' },
    { text: 'Invoices', path: '/payments/bulkers/invoices' },
  ];

  const paymentsDrawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
      <Box sx={{ px: 2, pt: 2.4, pb: 1.5, display: 'flex', alignItems: 'center' }}>
        <Button
          fullWidth
          variant="outlined"
          color="inherit"
          startIcon={<ArrowBackIosNewIcon fontSize="small" />}
          onClick={() => navigate('/')}
          sx={{
            borderRadius: '18px',
            minHeight: '42px',
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
          TRANSACTIONS
        </Typography>

        <List sx={{ pt: 0 }}>
          {renderExpandableMenu('CLIENTS', clientSubMenuItems)}
          {renderExpandableMenu('INDIVIDUALS', paymentSubMenuItems.map((m) => ({ ...m, path: `/payments/individuals${m.path.replace('/payments', '')}` })))}
          {renderExpandableMenu('BULKERS', bulkerSubMenuItems)}
          {renderExpandableMenu('PROVIDERS', paymentSubMenuItems.map((m) => ({ ...m, path: `/payments/providers${m.path.replace('/payments', '')}` })))}
        </List>

        <Divider sx={{ my: 1, mx: 2, opacity: 0.5 }} />

        <List sx={{ pt: 0, mx: -0.5 }}>
          {renderMenuItem({ text: 'Settings', icon: <SettingsIcon fontSize="small" />, path: '/payments/settings' })}
        </List>
      </Box>

      <Box sx={{ p: 2, pt: 1.5, borderTop: `1px solid ${theme.palette.divider}`, background: theme.palette.mode === 'light' ? 'rgba(255,255,255,0.7)' : 'rgba(15,17,23,0.5)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.85rem', fontWeight: 700 }}>
          {adminSession.name ? adminSession.name.charAt(0).toUpperCase() : 'N'}
        </Avatar>
        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>{adminSession.name || 'Admin User'}</Typography>
      </Box>
    </Box>
  );

  const activeDrawer = isPaymentsRoute ? paymentsDrawer : drawer;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <CssBaseline />

      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, sm: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>

            <Typography variant="h6" noWrap component="div" sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 600, display: { xs: 'none', sm: 'block' } }}>
              {[...mainMenuItems, ...appManagementItems].find((m) => m.path === location.pathname)?.text || 'Novaira Admin'}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={colorMode.toggleColorMode} color="inherit" size="large" sx={{ backgroundColor: theme.palette.mode === 'light' ? 'rgba(37,99,235,0.06)' : 'rgba(148,163,184,0.08)', borderRadius: '12px', border: theme.palette.mode === 'light' ? '1px solid rgba(37,99,235,0.10)' : 'none' }}>
              {theme.palette.mode === 'dark' ? <LightModeIcon sx={{ color: '#fbbf24' }} /> : <DarkModeOutlinedIcon />}
            </IconButton>

            <IconButton
              onClick={handleNotifOpen}
              color="inherit"
              size="large"
              sx={{
                backgroundColor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.03)' : 'rgba(148,163,184,0.08)',
                borderRadius: '12px',
                border: theme.palette.mode === 'light' ? '1px solid rgba(15,23,42,0.04)' : 'none'
              }}
            >
              <Badge badgeContent={totalNotifications} color="error" max={99}>
                <NotificationsNoneIcon />
              </Badge>
            </IconButton>

            <IconButton onClick={handleProfileMenuOpen} sx={{ ml: 0.5, p: 0.5, backgroundColor: theme.palette.mode === 'light' ? 'rgba(37,99,235,0.06)' : 'rgba(148,163,184,0.08)', borderRadius: '14px', border: theme.palette.mode === 'light' ? '1px solid rgba(37,99,235,0.10)' : 'none' }}>
              <Avatar alt="Admin" sx={{ width: 36, height: 36, bgcolor: theme.palette.primary.main }}>
                <AccountCircleIcon />
              </Avatar>
            </IconButton>
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
              borderTopRightRadius: '24px',
              borderBottomRightRadius: '24px',
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
        <Toolbar />
        <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: '1400px', mx: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}


