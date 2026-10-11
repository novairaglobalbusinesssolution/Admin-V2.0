import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Tabs, Tab, Stack, Chip, Button, IconButton,
  List, ListItem, ListItemAvatar, ListItemText, Avatar, Divider,
  CircularProgress, Card, CardContent, useTheme, Tooltip
} from '@mui/material';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import RateReviewIcon from '@mui/icons-material/RateReview';
import GroupIcon from '@mui/icons-material/Group';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import RefreshIcon from '@mui/icons-material/Refresh';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { supabase } from '../supabaseClient';

export default function Notifications() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const categoryParam = searchParams.get('category') || 'all';

  const categoryMap = {
    all: 0,
    users: 1,
    withdrawals: 2,
    reviews: 3,
    bulkers: 4
  };

  const reverseCategoryMap = ['all', 'users', 'withdrawals', 'reviews', 'bulkers'];

  const [currentTab, setCurrentTab] = useState(categoryMap[categoryParam] ?? 0);
  const [loading, setLoading] = useState(true);

  // Notification datasets
  const [newUsers, setNewUsers] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [bulkers, setBulkers] = useState([]);

  // Last read timestamp from localStorage
  const [lastReadTime, setLastReadTime] = useState(
    () => localStorage.getItem('admin_last_read_notifications') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  );

  useEffect(() => {
    if (categoryMap[categoryParam] !== undefined) {
      setCurrentTab(categoryMap[categoryParam]);
    }
  }, [categoryParam]);

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
    const cat = reverseCategoryMap[newValue] || 'all';
    setSearchParams({ category: cat });
  };

  const fetchAllNotifications = async () => {
    setLoading(true);
    try {
      // 1. Fetch Latest Users (last 50)
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, earner_id, first_name, last_name, email, phone, created_at, bulker_id')
        .order('created_at', { ascending: false })
        .limit(50);

      // 2. Fetch Pending Individual Withdrawals
      const { data: withdrawalsData } = await supabase
        .from('individual_wallet_transactions')
        .select('*')
        .eq('status', 'Pending')
        .eq('transaction_type', 'Debit')
        .ilike('description', 'Withdrawal:%')
        .order('created_at', { ascending: false });

      // 3. Fetch Tasks Under Review
      const { data: reviewsData } = await supabase
        .from('review_submit_data')
        .select('id, app_id, earner_id, bulker_id, submitted_username, status, submitted_at')
        .eq('status', 'Under Review')
        .order('submitted_at', { ascending: false })
        .limit(50);

      // 4. Fetch Bulker Desks
      const { data: bulkersData } = await supabase
        .from('bulker_desks')
        .select('bulker_id, full_name, phone, status, created_at')
        .order('created_at', { ascending: false })
        .limit(30);

      setNewUsers(usersData || []);
      setWithdrawals(withdrawalsData || []);
      setReviews(reviewsData || []);
      setBulkers(bulkersData || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllNotifications();
  }, []);

  const markAllAsRead = () => {
    const now = new Date().toISOString();
    localStorage.setItem('admin_last_read_notifications', now);
    setLastReadTime(now);
    window.dispatchEvent(new Event('notifications_updated'));
  };

  const formatIST = (dateStr) => {
    if (!dateStr) return 'Just now';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateStr;
    }
  };

  const isUnread = (dateStr) => {
    if (!dateStr) return false;
    return new Date(dateStr) > new Date(lastReadTime);
  };

  // Compile unified items
  const compiledItems = [];

  // Add Users
  if (currentTab === 0 || currentTab === 1) {
    newUsers.forEach((u) => {
      const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.earner_id || 'New Earner';
      compiledItems.push({
        id: `user-${u.id || u.earner_id}`,
        type: 'users',
        title: `New User Registered: ${name}`,
        subtitle: `Earner ID: ${u.earner_id || 'N/A'} • Bulker: ${u.bulker_id || 'None'} • ${u.phone || u.email || ''}`,
        date: u.created_at,
        unread: isUnread(u.created_at),
        badgeText: 'New User',
        badgeColor: 'info',
        icon: <PersonAddAlt1Icon />,
        iconColor: '#3b82f6',
        actionLabel: 'View Users',
        actionRoute: '/users'
      });
    });
  }

  // Add Withdrawals
  if (currentTab === 0 || currentTab === 2) {
    withdrawals.forEach((w) => {
      compiledItems.push({
        id: `tx-${w.id}`,
        type: 'withdrawals',
        title: `Withdrawal Request: ₹${w.amount || 0}`,
        subtitle: `Earner: ${w.earner_id} • Status: ${w.status} • ${w.description || ''}`,
        date: w.created_at,
        unread: isUnread(w.created_at),
        badgeText: '₹' + (w.amount || 0),
        badgeColor: 'warning',
        icon: <AccountBalanceWalletIcon />,
        iconColor: '#f59e0b',
        actionLabel: 'Process Payout',
        actionRoute: '/payments/individuals/withdrawals'
      });
    });
  }

  // Add Reviews
  if (currentTab === 0 || currentTab === 3) {
    reviews.forEach((r) => {
      compiledItems.push({
        id: `review-${r.id}`,
        type: 'reviews',
        title: `Task Under Review: ${r.submitted_username || r.earner_id}`,
        subtitle: `Bulker: ${r.bulker_id || 'N/A'} • Earner: ${r.earner_id}`,
        date: r.submitted_at,
        unread: isUnread(r.submitted_at),
        badgeText: 'Under Review',
        badgeColor: 'primary',
        icon: <RateReviewIcon />,
        iconColor: '#8b5cf6',
        actionLabel: 'Check App Reviews',
        actionRoute: `/app-reviews/${r.app_id}`
      });
    });
  }

  // Add Bulkers
  if (currentTab === 0 || currentTab === 4) {
    bulkers.forEach((b) => {
      compiledItems.push({
        id: `bulker-${b.bulker_id}`,
        type: 'bulkers',
        title: `Bulker Desk: ${b.full_name}`,
        subtitle: `ID: ${b.bulker_id} • Phone: ${b.phone || 'N/A'} • Status: ${b.status}`,
        date: b.created_at,
        unread: isUnread(b.created_at),
        badgeText: b.status,
        badgeColor: b.status?.toLowerCase() === 'active' ? 'success' : 'default',
        icon: <GroupIcon />,
        iconColor: '#10b981',
        actionLabel: 'View Bulkers',
        actionRoute: '/users'
      });
    });
  }

  // Sort by date desc
  compiledItems.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  const totalUnreadCount = [
    ...newUsers.filter(u => isUnread(u.created_at)),
    ...withdrawals.filter(w => isUnread(w.created_at)),
    ...reviews.filter(r => isUnread(r.submitted_at)),
    ...bulkers.filter(b => isUnread(b.created_at))
  ].length;

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', py: 2 }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, md: 4 },
          borderRadius: '24px',
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(15,23,42,0.6)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.04)'
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ width: 48, height: 48, bgcolor: 'primary.main', color: '#fff', borderRadius: '16px' }}>
              <NotificationsActiveIcon />
            </Avatar>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>Notification Center</Typography>
                {totalUnreadCount > 0 && (
                  <Chip label={`${totalUnreadCount} New`} color="error" size="small" sx={{ fontWeight: 700, borderRadius: '8px' }} />
                )}
              </Box>
              <Typography variant="body2" color="text.secondary">
                Real-time updates for new users, withdrawal requests, and pending tasks
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Tooltip title="Refresh notifications">
              <IconButton onClick={fetchAllNotifications} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: '12px' }}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              color="primary"
              size="small"
              startIcon={<DoneAllIcon />}
              onClick={markAllAsRead}
              sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
            >
              Mark all as read
            </Button>
          </Box>
        </Box>

        {/* Category Tabs */}
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: `1px solid ${theme.palette.divider}`,
            mb: 3,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.9rem',
              minHeight: 48,
              mr: 2
            }
          }}
        >
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>All</span>
                <Chip label={compiledItems.length} size="small" sx={{ height: 20, fontSize: '0.75rem', fontWeight: 700 }} />
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonAddAlt1Icon fontSize="small" />
                <span>New Users</span>
                {newUsers.length > 0 && <Chip label={newUsers.length} color="info" size="small" sx={{ height: 20, fontSize: '0.75rem', fontWeight: 700 }} />}
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccountBalanceWalletIcon fontSize="small" />
                <span>Withdrawals</span>
                {withdrawals.length > 0 && <Chip label={withdrawals.length} color="warning" size="small" sx={{ height: 20, fontSize: '0.75rem', fontWeight: 700 }} />}
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <RateReviewIcon fontSize="small" />
                <span>Under Review</span>
                {reviews.length > 0 && <Chip label={reviews.length} color="primary" size="small" sx={{ height: 20, fontSize: '0.75rem', fontWeight: 700 }} />}
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <GroupIcon fontSize="small" />
                <span>Bulkers</span>
                {bulkers.length > 0 && <Chip label={bulkers.length} color="success" size="small" sx={{ height: 20, fontSize: '0.75rem', fontWeight: 700 }} />}
              </Box>
            }
          />
        </Tabs>

        {/* Content List */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
            <CircularProgress size={36} />
          </Box>
        ) : compiledItems.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8, border: `1px dashed ${theme.palette.divider}`, borderRadius: '20px' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>No Notifications</Typography>
            <Typography variant="body2" color="text.secondary">You are all caught up in this category.</Typography>
          </Box>
        ) : (
          <List disablePadding>
            {compiledItems.map((item, idx) => (
              <React.Fragment key={item.id}>
                <ListItem
                  sx={{
                    py: 2,
                    px: { xs: 1.5, sm: 2.5 },
                    borderRadius: '16px',
                    mb: 1.2,
                    bgcolor: item.unread
                      ? (theme.palette.mode === 'light' ? 'rgba(37,99,235,0.04)' : 'rgba(59,130,246,0.08)')
                      : (theme.palette.mode === 'light' ? 'rgba(248,250,252,0.7)' : 'rgba(30,41,59,0.3)'),
                    border: `1px solid ${item.unread ? 'rgba(59,130,246,0.2)' : theme.palette.divider}`,
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    gap: 2,
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 20px rgba(0,0,0,0.05)'
                    }
                  }}
                >
                  <ListItemAvatar sx={{ minWidth: 46 }}>
                    <Avatar sx={{ bgcolor: `${item.iconColor}18`, color: item.iconColor, width: 44, height: 44, borderRadius: '12px' }}>
                      {item.icon}
                    </Avatar>
                  </ListItemAvatar>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap', mb: 0.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: '0.95rem' }}>
                        {item.title}
                      </Typography>
                      {item.unread && (
                        <Chip label="UNREAD" size="small" color="error" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800 }} />
                      )}
                      <Chip label={item.badgeText} size="small" color={item.badgeColor} variant="outlined" sx={{ height: 20, fontSize: '0.72rem', fontWeight: 700 }} />
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, wordBreak: 'break-word', fontSize: '0.84rem' }}>
                      {item.subtitle}
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.disabled', fontSize: '0.75rem' }}>
                      <AccessTimeIcon sx={{ fontSize: 13 }} />
                      <span>{formatIST(item.date)}</span>
                    </Box>
                  </Box>

                  <Box sx={{ alignSelf: { xs: 'flex-end', sm: 'center' } }}>
                    <Button
                      variant="contained"
                      size="small"
                      color="primary"
                      endIcon={<ArrowForwardIcon fontSize="small" />}
                      onClick={() => navigate(item.actionRoute)}
                      sx={{
                        borderRadius: '100px',
                        textTransform: 'none',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        px: 2,
                        boxShadow: 'none'
                      }}
                    >
                      {item.actionLabel}
                    </Button>
                  </Box>
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>
    </Box>
  );
}
