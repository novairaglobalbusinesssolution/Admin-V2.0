import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog,
  Box,
  Typography,
  InputBase,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Chip,
  CircularProgress,
  Divider,
  useTheme,
  Fade,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

// Icons
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import AppsIcon from '@mui/icons-material/Apps';
import LibraryAddIcon from '@mui/icons-material/LibraryAdd';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ForumIcon from '@mui/icons-material/Forum';
import RateReviewIcon from '@mui/icons-material/RateReview';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import ViewListIcon from '@mui/icons-material/ViewList';
import EmailIcon from '@mui/icons-material/Email';
import CampaignIcon from '@mui/icons-material/Campaign';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import FolderSharedIcon from '@mui/icons-material/FolderShared';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AndroidIcon from '@mui/icons-material/Android';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LogoutIcon from '@mui/icons-material/Logout';
import ShieldIcon from '@mui/icons-material/Shield';
import BoltIcon from '@mui/icons-material/Bolt';

import { supabase } from '../supabaseClient';

const ALL_PAGES = [
  { title: 'Dashboard Overview', category: 'Pages', desc: 'KPI metrics, system radar & recent activity', path: '/', icon: <DashboardIcon />, color: '#3b82f6' },
  { title: 'Users Directory', category: 'Pages', desc: 'Manage earners, profile status & moderation', path: '/users', icon: <PeopleAltIcon />, color: '#06b6d4' },
  { title: 'Community Lounge', category: 'Pages', desc: 'Realtime community chat & moderation controls', path: '/community-chat', icon: <ForumIcon />, color: '#8b5cf6' },
  { title: 'Payment Ledger', category: 'Pages', desc: 'Ledger, invoices, bulkers & client funds', path: '/payments', icon: <AccountBalanceWalletIcon />, color: '#10b981' },
  { title: 'Individual Wallets', category: 'Pages', desc: 'Earner withdrawal requests & transactions', path: '/payments/individuals', icon: <AccountBalanceWalletIcon />, color: '#10b981' },
  { title: 'Bulker Desks & Wallets', category: 'Pages', desc: 'Corporate bulkers financial management', path: '/payments/bulkers', icon: <AccountBalanceWalletIcon />, color: '#10b981' },
  { title: 'Client Invoices', category: 'Pages', desc: 'Invoices & funding from external advertisers', path: '/payments/clients', icon: <AccountBalanceWalletIcon />, color: '#10b981' },
  { title: 'Festive Puja Feed 2026', category: 'Pages', desc: 'Sharodiya selfie contest & social shares', path: '/puja-feed-2026', icon: <PhotoLibraryIcon />, color: '#f59e0b' },
  { title: 'System Alerts', category: 'Pages', desc: 'Read notifications, warnings & alerts', path: '/notifications', icon: <NotificationsActiveIcon />, color: '#ec4899' },
  { title: 'Deploy New App', category: 'Pages', desc: 'Publish Android apps with custom tasks', path: '/add-app', icon: <LibraryAddIcon />, color: '#3b82f6' },
  { title: 'Published Apps', category: 'Pages', desc: 'Catalog of active and pending application tasks', path: '/app-list', icon: <AppsIcon />, color: '#06b6d4' },
  { title: 'Add Review Task', category: 'Pages', desc: 'Create review / rating task instructions', path: '/add-comment', icon: <RateReviewIcon />, color: '#f59e0b' },
  { title: 'Review Submissions', category: 'Pages', desc: 'Audit user screenshots and approve reward coins', path: '/manage-comment', icon: <RateReviewIcon />, color: '#8b5cf6' },
  { title: 'Add Verification Task', category: 'Pages', desc: 'Configure live checking criteria', path: '/add-live', icon: <PlaylistAddCheckIcon />, color: '#10b981' },
  { title: 'Verification List', category: 'Pages', desc: 'Manage existing live verification links', path: '/live-list', icon: <ViewListIcon />, color: '#3b82f6' },
  { title: 'Push Broadcasts', category: 'Pages', desc: 'Send instant FCM push notifications to devices', path: '/push-notifications', icon: <CampaignIcon />, color: '#ec4899' },
  { title: 'Mail Diagnostics', category: 'Pages', desc: 'Inspect live email deliveries and SMTP health', path: '/live-checking-mails', icon: <EmailIcon />, color: '#06b6d4' },
  { title: 'OCR Scanner Zone', category: 'Pages', desc: 'Automated OCR extraction and task verification', path: '/scan-zone', icon: <QrCodeScannerIcon />, color: '#f59e0b' },
  { title: 'Cloud File Vault', category: 'Pages', desc: 'Supabase storage assets & uploaded proofs', path: '/file-manager', icon: <FolderSharedIcon />, color: '#6366f1' },
  { title: 'Platform Settings', category: 'Pages', desc: 'Global configurations, fee rates & credentials', path: '/settings', icon: <SettingsIcon />, color: '#94a3b8' },
  { title: 'System Health Diagnostics', category: 'Pages', desc: 'External microservice health probe', path: 'http://localhost:7700', external: true, icon: <MonitorHeartIcon />, color: '#10b981' },
];

const QUICK_ACTIONS = [
  { title: 'Broadcast Push Notification', category: 'Actions', desc: 'Compose message to all or specific active devices', path: '/push-notifications', icon: <CampaignIcon />, color: '#ec4899' },
  { title: 'Deploy New Android App', category: 'Actions', desc: 'Add package name, coins per download, and budget', path: '/add-app', icon: <LibraryAddIcon />, color: '#3b82f6' },
  { title: 'Review Earner Proof Submissions', category: 'Actions', desc: 'Audit submitted screenshots waiting for payout', path: '/manage-comment', icon: <RateReviewIcon />, color: '#8b5cf6' },
  { title: 'Check Community Chat Lounge', category: 'Actions', desc: 'Monitor active conversations and mute spammers', path: '/community-chat', icon: <ForumIcon />, color: '#06b6d4' },
  { title: 'Export Financial Ledger Data', category: 'Actions', desc: 'Review individual and bulker settlement logs', path: '/payments', icon: <AccountBalanceWalletIcon />, color: '#10b981' },
];

export default function OmniSearchModal({ open, onClose, toggleColorMode }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const isDark = theme.palette.mode === 'dark';

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [dbUsers, setDbUsers] = useState([]);
  const [dbApps, setDbApps] = useState([]);
  const [searchingDb, setSearchingDb] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setDbUsers([]);
      setDbApps([]);
      setSelectedIndex(0);
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 50);
    }
  }, [open]);

  // Debounced search for live Supabase data (users & apps)
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setDbUsers([]);
      setDbApps([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingDb(true);
      try {
        // Query users
        const { data: users } = await supabase
          .from('profiles')
          .select('id, earner_id, first_name, last_name, email, status')
          .or(`earner_id.ilike.%${trimmed}%,first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%,email.ilike.%${trimmed}%`)
          .limit(4);

        if (users) {
          setDbUsers(
            users.map((u) => ({
              title: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.earner_id,
              desc: `${u.earner_id} • ${u.email || 'No email'} • [${u.status || 'Active'}]`,
              category: 'Users',
              path: `/users?search=${u.earner_id}`,
              icon: <AccountCircleIcon />,
              color: '#06b6d4',
            }))
          );
        }

        // Query apps
        const { data: apps } = await supabase
          .from('apps')
          .select('id, task_id, app_name, app_package, status')
          .or(`app_name.ilike.%${trimmed}%,app_package.ilike.%${trimmed}%`)
          .limit(4);

        if (apps) {
          setDbApps(
            apps.map((a) => ({
              title: a.app_name || a.app_package,
              desc: `Task #${a.task_id} • ${a.app_package} • [${a.status || 'Active'}]`,
              category: 'Apps',
              path: `/app-list?search=${a.task_id || a.app_name}`,
              icon: <AndroidIcon />,
              color: '#10b981',
            }))
          );
        }
      } catch (err) {
        console.error('OmniSearch Supabase error:', err);
      } finally {
        setSearchingDb(false);
      }
    }, 240);

    return () => clearTimeout(timer);
  }, [query]);

  // Filtered Results
  const filteredResults = useMemo(() => {
    const q = query.toLowerCase().trim();

    let combined = [];

    if (!q) {
      // Empty query shows curated quick start suggestions
      combined = [
        ...ALL_PAGES.slice(0, 6),
        ...QUICK_ACTIONS.slice(0, 3),
      ];
    } else {
      const pageMatches = ALL_PAGES.filter(
        (p) => p.title.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)
      );
      const actionMatches = QUICK_ACTIONS.filter(
        (a) => a.title.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q)
      );

      combined = [...pageMatches, ...actionMatches, ...dbUsers, ...dbApps];
    }

    if (selectedCategory !== 'All') {
      combined = combined.filter((item) => item.category === selectedCategory);
    }

    return combined;
  }, [query, selectedCategory, dbUsers, dbApps]);

  const handleSelect = (item) => {
    onClose();
    if (item.action) {
      item.action();
      return;
    }
    if (item.external) {
      window.open(item.path, '_blank');
      return;
    }
    navigate(item.path);
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredResults[selectedIndex]) {
        handleSelect(filteredResults[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const categories = ['All', 'Pages', 'Actions', 'Users', 'Apps'];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      TransitionComponent={Fade}
      transitionDuration={200}
      PaperProps={{
        sx: {
          borderRadius: '24px',
          overflow: 'hidden',
          bgcolor: isDark ? 'rgba(10, 14, 22, 0.88)' : 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(15, 23, 42, 0.12)',
          boxShadow: isDark
            ? '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 40px rgba(59, 130, 246, 0.12)'
            : '0 25px 50px -12px rgba(15, 23, 42, 0.15)',
          mt: { xs: 4, sm: 8 },
          verticalAlign: 'top',
        },
      }}
    >
      {/* Top Search Input Box */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2.5,
          py: 1.8,
          borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
          gap: 1.5,
        }}
      >
        <SearchIcon sx={{ color: isDark ? '#60a5fa' : '#2563eb', fontSize: 28 }} />
        <InputBase
          inputRef={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type to search pages, earners, published apps, quick actions..."
          fullWidth
          sx={{
            fontSize: '1.05rem',
            fontWeight: 600,
            color: 'text.primary',
            '& input::placeholder': {
              color: 'text.secondary',
              opacity: 0.8,
            },
          }}
        />
        {searchingDb && <CircularProgress size={20} sx={{ color: 'primary.main', mr: 1 }} />}
        {query && (
          <IconButton size="small" onClick={() => setQuery('')} sx={{ color: 'text.secondary' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
        <Chip
          label="ESC"
          size="small"
          onClick={onClose}
          sx={{
            height: 22,
            fontSize: '0.65rem',
            fontWeight: 800,
            cursor: 'pointer',
            borderRadius: '6px',
            bgcolor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)',
            color: 'text.secondary',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(15, 23, 42, 0.1)',
          }}
        />
      </Box>

      {/* Category Filter Chips */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2.5,
          py: 1.2,
          overflowX: 'auto',
          borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(15, 23, 42, 0.05)',
          bgcolor: isDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(15, 23, 42, 0.015)',
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.disabled', letterSpacing: '0.05em', mr: 0.5, fontSize: '0.65rem' }}>
          FILTER:
        </Typography>
        {categories.map((cat) => (
          <Chip
            key={cat}
            label={cat}
            size="small"
            clickable
            onClick={() => {
              setSelectedCategory(cat);
              setSelectedIndex(0);
            }}
            sx={{
              height: 24,
              fontSize: '0.72rem',
              fontWeight: selectedCategory === cat ? 800 : 600,
              borderRadius: '8px',
              bgcolor: selectedCategory === cat
                ? (isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(37, 99, 235, 0.14)')
                : 'transparent',
              color: selectedCategory === cat
                ? (isDark ? '#93c5fd' : '#1d4ed8')
                : 'text.secondary',
              border: selectedCategory === cat
                ? (isDark ? '1px solid rgba(96, 165, 250, 0.35)' : '1px solid rgba(37, 99, 235, 0.25)')
                : (isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(15, 23, 42, 0.06)'),
            }}
          />
        ))}
      </Box>

      {/* Results List */}
      <Box sx={{ maxHeight: '420px', overflowY: 'auto', p: 1.5 }} ref={listRef}>
        {filteredResults.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <SearchIcon sx={{ fontSize: 44, color: 'text.disabled', mb: 1.2, opacity: 0.5 }} />
            <Typography variant="body1" sx={{ fontWeight: 700, color: 'text.primary' }}>
              No matches found for &quot;{query}&quot;
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Try searching by earner ID, app title, route name, or task ID.
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {filteredResults.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <ListItemButton
                  key={`${item.category}-${item.title}-${index}`}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  sx={{
                    borderRadius: '16px',
                    mb: 0.6,
                    py: 1.1,
                    px: 1.8,
                    bgcolor: isSelected
                      ? (isDark ? 'rgba(59, 130, 246, 0.16)' : 'rgba(37, 99, 235, 0.08)')
                      : 'transparent',
                    border: isSelected
                      ? (isDark ? '1px solid rgba(96, 165, 250, 0.25)' : '1px solid rgba(37, 99, 235, 0.15)')
                      : '1px solid transparent',
                    transition: 'all 0.18s ease',
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 42 }}>
                    <Box
                      sx={{
                        width: 34,
                        height: 34,
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: `${item.color}18`,
                        color: item.color,
                        border: `1px solid ${item.color}35`,
                        boxShadow: isSelected ? `0 0 12px ${item.color}40` : 'none',
                      }}
                    >
                      {React.cloneElement(item.icon, { sx: { fontSize: 18 } })}
                    </Box>
                  </ListItemIcon>

                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: isSelected ? 800 : 700, color: 'text.primary' }}>
                          {item.title}
                        </Typography>
                        <Chip
                          label={item.category}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            borderRadius: '6px',
                            bgcolor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.05)',
                            color: 'text.secondary',
                          }}
                        />
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.74rem', display: 'block', mt: 0.2 }}>
                        {item.desc}
                      </Typography>
                    }
                  />

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: isSelected ? 'primary.main' : 'text.disabled' }}>
                    <ArrowForwardIosIcon sx={{ fontSize: 13, transform: isSelected ? 'translateX(2px)' : 'none', transition: 'transform 0.2s ease' }} />
                  </Box>
                </ListItemButton>
              );
            })}
          </List>
        )}
      </Box>

      {/* Footer Hotkey Guidance */}
      <Box
        sx={{
          px: 2.5,
          py: 1.2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
          bgcolor: isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.02)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <Chip label="↑↓" size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800, borderRadius: '4px' }} />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem', fontWeight: 600 }}>Navigate</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <Chip label="↵ ENTER" size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800, borderRadius: '4px' }} />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem', fontWeight: 600 }}>Select</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <Chip label="ESC" size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800, borderRadius: '4px' }} />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem', fontWeight: 600 }}>Close</Typography>
          </Box>
        </Box>

        <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, fontSize: '0.7rem', display: { xs: 'none', sm: 'block' } }}>
          Novaira OmniSearch Engine
        </Typography>
      </Box>
    </Dialog>
  );
}
