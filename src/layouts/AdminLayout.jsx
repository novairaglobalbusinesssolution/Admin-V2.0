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
        <Skeleton variant="circular" width={24} height={24} sx={{ mr: 1.5, bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }} />
        <Skeleton variant="text" width="60%" height={18} sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }} />
      </Box>
    </ListItem>
  );

  const renderMenuItem = (item) => {
    const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
    const textColor = isActive ? (theme.palette.mode === 'light' ? 'primary.main' : '#e2e8f0') : (theme.palette.mode === 'light' ? 'text.secondary' : '#cbd5e1');
    const iconColor = isActive ? (theme.palette.mode === 'light' ? 'primary.main' : '#e2e8f0') : (theme.palette.mode === 'light' ? 'text.secondary' : '#94a3b8');

    return (
      <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
        <ListItemButton
          onClick={() => {
            navigate(item.path);
            if (isMobile) setMobileOpen(false);
          }}
          sx={{
            borderRadius: '18px',
            mx: 1.25,
            minHeight: '42px',
            py: 0.75,
            px: 1.5,
            backgroundImage: isActive
              ? (theme.palette.mode === 'light'
                ? 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(147,197,253,0.06))'
                : 'linear-gradient(135deg, rgba(138,180,255,0.18), rgba(15,23,42,0.04))')
              : 'none',
            boxShadow: isActive ? 'inset 0 0 0 1px rgba(96,165,250,0.25)' : 'none',
            color: textColor,
            transition: 'all 0.2s ease',
            '&:hover': {
              backgroundColor: isActive ? 'transparent' : (theme.palette.mode === 'light' ? 'rgba(15,23,42,0.03)' : 'rgba(148,163,184,0.08)'),
              transform: 'translateX(2px)',
            },
          }}
        >
          <ListItemIcon sx={{ color: iconColor, minWidth: '30px' }}>
            {item.icon}
          </ListItemIcon>
          <ListItemText primary={item.text} primaryTypographyProps={{ fontWeight: isActive ? 700 : 600, fontSize: '0.78rem' }} />
        </ListItemButton>
      </ListItem>
    );
  };

  const renderNavigationGroup = (title, items, addDivider = true) => {
    if (sidebarLoading) {
      return (
        <Box key={title}>
          <Typography variant="overline" sx={{ px: 3, mb: 0.8, mt: 1.5, fontWeight: 700, color: 'text.disabled', fontSize: '0.6rem', display: 'block', letterSpacing: 0.6 }}>
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
      <Box key={title}>
        <Typography variant="overline" sx={{ px: 3, mb: 0.8, mt: 1.5, fontWeight: 700, color: 'text.disabled', fontSize: '0.6rem', display: 'block', letterSpacing: 0.7 }}>
          {title}
        </Typography>
        <List sx={{ pt: 0 }}>
          {items.map(renderMenuItem)}
        </List>
        {addDivider && <Divider sx={{ my: 1, mx: 2, opacity: 0.5 }} />}
      </Box>
    );
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
      <Box sx={{ px: 2.2, pt: 2.2, pb: 1.2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 1.25,
            py: 1.1,
            borderRadius: '18px',
            border: theme.palette.mode === 'light' ? '1px solid rgba(148,163,184,0.22)' : '1px solid rgba(148,163,184,0.12)',
            background: theme.palette.mode === 'light'
              ? 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(255,255,255,0.86))'
              : 'linear-gradient(135deg, rgba(96,165,250,0.10), rgba(17,24,39,0.8))',
            boxShadow: theme.palette.mode === 'light' ? '0 10px 16px rgba(37,99,235,0.05)' : '0 10px 18px rgba(15,23,42,0.16)',
          }}
        >
          <Avatar
            sx={{
              width: 36,
              height: 36,
              color: '#fff',
              fontSize: '0.95rem',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #2563eb, #60a5fa)',
              boxShadow: '0 10px 20px rgba(37,99,235,0.28)',
            }}
          >
            {adminSession.name ? adminSession.name.charAt(0).toUpperCase() : 'N'}
          </Avatar>
          <Box>
            <Typography variant="body1" sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 700, fontSize: '0.93rem', lineHeight: 1.2 }}>
              Novaira Global
            </Typography>
            <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, fontSize: '0.62rem', letterSpacing: 0.8 }}>
              ADMIN PANEL
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ overflowY: 'auto', overflowX: 'hidden', flexGrow: 1, px: 0, pt: 0, pb: 2 }}>
        {renderNavigationGroup('MAIN MENU', mainMenuItems, true)}
        {renderNavigationGroup('APP MANAGEMENT', appManagementItems, true)}
        {renderNavigationGroup('COMMENT MANAGEMENT', commentManagementItems, true)}
        {renderNavigationGroup('LIVE LIST MANAGEMENT', liveListItems, true)}
        {renderNavigationGroup('FILE MANAGER', fileManagerItems, false)}
        {renderNavigationGroup('OTHERS', othersItems, false)}
      </Box>

      <Box sx={{ p: 2, pt: 1.5, borderTop: `1px solid ${theme.palette.divider}`, background: theme.palette.mode === 'light' ? 'rgba(255,255,255,0.7)' : 'rgba(15,17,23,0.5)' }}>
        <List sx={{ p: 0, mb: 1, mx: -0.5 }}>
          {renderMenuItem({ text: 'Settings', icon: <SettingsIcon fontSize="small" />, path: '/settings' })}
        </List>

        <ListItem disablePadding sx={{ mx: 1 }}>
          <ListItemButton
            onClick={handleLogout}
            sx={{
              borderRadius: '18px',
              minHeight: '42px',
              color: 'error.main',
              backgroundImage: theme.palette.mode === 'light'
                ? 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.03))'
                : 'linear-gradient(135deg, rgba(248,113,113,0.15), rgba(127,29,29,0.04))',
              '&:hover': {
                backgroundColor: theme.palette.mode === 'light' ? 'rgba(239,68,68,0.05)' : 'rgba(239,68,68,0.1)',
              },
              py: 0.7,
              px: 1.5,
            }}
          >
            <ListItemIcon sx={{ color: 'error.main', minWidth: '30px' }}>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Logout" primaryTypographyProps={{ fontWeight: 700, fontSize: '0.75rem' }} />
          </ListItemButton>
        </ListItem>
        <Typography variant="caption" color="text.secondary" align="center" display="block" sx={{ mt: 1.4, fontSize: '0.6rem', fontWeight: 600, opacity: 0.7 }}>
          v2.1.0
        </Typography>
      </Box>
    </Box>
  );

  const renderExpandableMenu = (title, items) => {
    const isExpanded = expandedPaymentMenu === title.toLowerCase();
    const isChildActive = items.some((item) => location.pathname === item.path);

    return (
      <Box key={title}>
        <ListItem disablePadding sx={{ mb: 0.3 }}>
          <ListItemButton
            onClick={() => handleTogglePaymentMenu(title.toLowerCase())}
            sx={{
              borderRadius: '18px',
              mx: 1.25,
              minHeight: '42px',
              py: 0.7,
              px: 1.5,
              backgroundImage: isChildActive
                ? (theme.palette.mode === 'light'
                  ? 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(147,197,253,0.05))'
                  : 'linear-gradient(135deg, rgba(138,180,255,0.18), rgba(15,23,42,0.04))')
                : 'none',
              color: isChildActive ? 'primary.main' : 'inherit',
              boxShadow: isChildActive ? 'inset 0 0 0 1px rgba(96,165,250,0.25)' : 'none',
              '&:hover': { backgroundColor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.03)' : 'rgba(148,163,184,0.08)' },
            }}
          >
            <ListItemText primary={title} primaryTypographyProps={{ fontWeight: isChildActive ? 700 : 600, fontSize: '0.76rem' }} />
            {isExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </ListItemButton>
        </ListItem>
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <List component="div" disablePadding sx={{ pl: 1 }}>
            {items.map((item) => {
              const isActive = location.pathname === item.path;
              const textColor = isActive ? (theme.palette.mode === 'light' ? 'primary.main' : '#e2e8f0') : (theme.palette.mode === 'light' ? 'text.secondary' : '#cbd5e1');

              return (
                <ListItem key={item.text} disablePadding sx={{ mb: 0.3 }}>
                  <ListItemButton
                    onClick={() => {
                      navigate(item.path);
                      if (isMobile) setMobileOpen(false);
                    }}
                    sx={{
                      borderRadius: '16px',
                      mx: 1.5,
                      minHeight: '36px',
                      py: 0.5,
                      px: 1.5,
                      backgroundImage: isActive
                        ? (theme.palette.mode === 'light'
                          ? 'linear-gradient(135deg, rgba(37,99,235,0.10), rgba(147,197,253,0.05))'
                          : 'linear-gradient(135deg, rgba(138,180,255,0.15), rgba(15,23,42,0.04))')
                        : 'none',
                      color: textColor,
                      '&:hover': { backgroundColor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.03)' : 'rgba(148,163,184,0.08)' },
                    }}
                  >
                    <ListItemText primary={item.text} primaryTypographyProps={{ fontWeight: isActive ? 700 : 500, fontSize: '0.7rem' }} />
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
          {renderExpandableMenu('BULKERS', paymentSubMenuItems.map((m) => ({ ...m, path: `/payments/bulkers${m.path.replace('/payments', '')}` })))}
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
              borderTopRightRadius: '22px',
              borderBottomRightRadius: '22px',
              borderRight: 'none',
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
              borderRight: 'none',
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


