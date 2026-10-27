import { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Paper, TextField, Button,
  Avatar, Chip, IconButton, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TablePagination,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, Switch,
  FormControlLabel, Tooltip, Stack, CircularProgress,
  useTheme, InputAdornment, Grid
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TimerIcon from '@mui/icons-material/Timer';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import TuneIcon from '@mui/icons-material/Tune';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ForumIcon from '@mui/icons-material/Forum';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import Swal from 'sweetalert2';

import {
  fetchCommunityChatUsers,
  updateUserAccountStatus,
  getChatSettings,
  saveChatSettings
} from './communityChatService';

export default function CommunityUsersView() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Pagination State
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Settings State for Muted Users & Permissions
  const [chatSettings, setChatSettings] = useState({ mutedUsers: [], userPermissions: {} });

  // Dialog States
  const [timeoutModalOpen, setTimeoutModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [timeoutDuration, setTimeoutDuration] = useState('1h');
  const [timeoutReason, setTimeoutReason] = useState('Violation of community chat guidelines');

  // Permissions Modal State
  const [permModalOpen, setPermModalOpen] = useState(false);
  const [userPerms, setUserPerms] = useState({
    canSendLinks: true,
    canSendMedia: true,
    slowModeExempt: false,
    rateLimitPerMin: 10
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [chatters, settings] = await Promise.all([
        fetchCommunityChatUsers(),
        getChatSettings()
      ]);
      setUsers(chatters);
      setChatSettings(settings);
    } catch (err) {
      console.error('Failed to load community chatters:', err);
      Swal.fire({ icon: 'error', title: 'Load Failed', text: err.message || 'Could not load chat members' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Copy Earner ID helper
  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id);
    Swal.fire({
      icon: 'success',
      title: 'Copied!',
      text: `Earner ID ${id} copied to clipboard`,
      timer: 1000,
      showConfirmButton: false
    });
  };

  // Toggle Account Block / Unblock
  const handleToggleBlock = async (user) => {
    const isCurrentlyBlocked = user.status === 'Blocked';
    const newStatus = isCurrentlyBlocked ? 'Active' : 'Blocked';

    const result = await Swal.fire({
      title: `${isCurrentlyBlocked ? 'Unblock' : 'Block'} Earner?`,
      text: `Are you sure you want to ${isCurrentlyBlocked ? 'unblock and restore' : 'block and restrict'} ${user.first_name} (${user.earner_id})?`,
      icon: isCurrentlyBlocked ? 'question' : 'warning',
      showCancelButton: true,
      confirmButtonColor: isCurrentlyBlocked ? '#22c55e' : '#ef4444',
      confirmButtonText: isCurrentlyBlocked ? 'Yes, Unblock' : 'Yes, Block User'
    });

    if (result.isConfirmed) {
      try {
        await updateUserAccountStatus(user.id, newStatus);
        setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u)));
        Swal.fire({
          icon: 'success',
          title: `User ${newStatus}`,
          text: `${user.first_name} is now ${newStatus.toLowerCase()}.`,
          timer: 1500,
          showConfirmButton: false
        });
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Update Failed', text: err.message });
      }
    }
  };

  // Open Timeout Modal
  const openTimeoutModal = (user) => {
    setSelectedUser(user);
    setTimeoutDuration('1h');
    setTimeoutReason('Violation of community chat rules');
    setTimeoutModalOpen(true);
  };

  // Apply Timeout
  const handleApplyTimeout = async () => {
    if (!selectedUser) return;
    try {
      await updateUserAccountStatus(selectedUser.id, 'Suspended');
      setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? { ...u, status: 'Suspended' } : u)));
      setTimeoutModalOpen(false);
      Swal.fire({
        icon: 'success',
        title: 'User Suspended',
        text: `${selectedUser.first_name} has been suspended for ${timeoutDuration}. Reason: ${timeoutReason}`,
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Suspension Failed', text: err.message });
    }
  };

  // Toggle Mute in Community Chat (Without suspending main wallet)
  const handleToggleMute = async (user) => {
    const isMuted = chatSettings.mutedUsers?.includes(user.earner_id);
    let newMuted = [];
    if (isMuted) {
      newMuted = (chatSettings.mutedUsers || []).filter((id) => id !== user.earner_id);
    } else {
      newMuted = [...(chatSettings.mutedUsers || []), user.earner_id];
    }

    const updatedSettings = { ...chatSettings, mutedUsers: newMuted };
    setChatSettings(updatedSettings);

    try {
      await saveChatSettings(updatedSettings);
      Swal.fire({
        icon: isMuted ? 'success' : 'warning',
        title: isMuted ? 'User Unmuted' : 'User Muted',
        text: `${user.first_name} has been ${isMuted ? 'unmuted' : 'muted from posting'} in community chat.`,
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Mute Failed', text: err.message });
    }
  };

  // Open Permissions Modal
  const openPermissionsModal = (user) => {
    setSelectedUser(user);
    const existing = chatSettings.userPermissions?.[user.earner_id] || {
      canSendLinks: true,
      canSendMedia: true,
      slowModeExempt: false,
      rateLimitPerMin: 10
    };
    setUserPerms(existing);
    setPermModalOpen(true);
  };

  // Save Permissions
  const handleSavePermissions = async () => {
    if (!selectedUser) return;
    const updatedUserPermissions = {
      ...(chatSettings.userPermissions || {}),
      [selectedUser.earner_id]: userPerms
    };
    const updatedSettings = { ...chatSettings, userPermissions: updatedUserPermissions };
    setChatSettings(updatedSettings);

    try {
      await saveChatSettings(updatedSettings);
      setPermModalOpen(false);
      Swal.fire({
        icon: 'success',
        title: 'Permissions Saved',
        text: `Chat permissions updated for ${selectedUser.first_name}.`,
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Save Failed', text: err.message });
    }
  };

  // Filtering Logic
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // 1. Text Search (Name, Earner ID, Email, Phone, Last Message)
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
        const earnerId = (u.earner_id || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        const phone = (u.phone || '').toLowerCase();
        const lastMsg = (u.last_message || '').toLowerCase();

        const matches = fullName.includes(q) || earnerId.includes(q) || email.includes(q) || phone.includes(q) || lastMsg.includes(q);
        if (!matches) return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'MUTED') {
          if (!chatSettings.mutedUsers?.includes(u.earner_id)) return false;
        } else if (u.status !== statusFilter) {
          return false;
        }
      }

      // 3. Role Filter
      if (roleFilter !== 'ALL') {
        const isBulker = u.earner_id?.includes('BULKER') || u.chat_badge?.includes('Supervisor');
        if (roleFilter === 'BULKERS' && !isBulker) return false;
        if (roleFilter === 'INDIVIDUALS' && isBulker) return false;
      }

      return true;
    });
  }, [users, search, statusFilter, roleFilter, chatSettings.mutedUsers]);

  // Pagination Slice
  const paginatedUsers = useMemo(() => {
    const from = page * rowsPerPage;
    return filteredUsers.slice(from, from + rowsPerPage);
  }, [filteredUsers, page, rowsPerPage]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Computed Metric Counts
  const metrics = useMemo(() => {
    const totalChatters = users.length;
    const totalMessages = users.reduce((acc, curr) => acc + (curr.message_count || 0), 0);
    const activeCount = users.filter((u) => u.status === 'Active').length;
    const suspendedCount = users.filter((u) => u.status === 'Suspended' || u.status === 'Blocked').length;
    const mutedCount = users.filter((u) => chatSettings.mutedUsers?.includes(u.earner_id)).length;
    return { totalChatters, totalMessages, activeCount, suspendedCount, mutedCount };
  }, [users, chatSettings.mutedUsers]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Top Banner Header */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: '22px',
          border: `1px solid ${theme.palette.divider}`,
          background: isDark
            ? 'linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(15,23,42,0.9) 100%)'
            : 'linear-gradient(135deg, rgba(239,246,255,0.85) 0%, rgba(255,255,255,0.98) 100%)',
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
              width: 48,
              height: 48,
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 8px 20px rgba(59,130,246,0.3)'
            }}
          >
            <ForumIcon sx={{ fontSize: 26 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              Community Group Chat Members ({users.length})
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Showing exclusively earners who have sent at least <strong>1 message</strong> in the Community Group Chat.
            </Typography>
          </Box>
        </Box>

        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={loadData}
          sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
        >
          Refresh Chatters
        </Button>
      </Paper>

      {/* Quick Stats Metric Cards */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: '18px', border: `1px solid ${theme.palette.divider}`, bgcolor: 'background.paper' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>Active Chatters</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#3b82f6' }}>{metrics.totalChatters}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: '18px', border: `1px solid ${theme.palette.divider}`, bgcolor: 'background.paper' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>Total Messages</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#06b6d4' }}>{metrics.totalMessages}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: '18px', border: `1px solid ${theme.palette.divider}`, bgcolor: 'background.paper' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>Active Accounts</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#22c55e' }}>{metrics.activeCount}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: '18px', border: `1px solid ${theme.palette.divider}`, bgcolor: 'background.paper' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>Suspended / Blocked</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#ef4444' }}>{metrics.suspendedCount}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: '18px', border: `1px solid ${theme.palette.divider}`, bgcolor: 'background.paper' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>Muted in Chat</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: '#f59e0b' }}>{metrics.mutedCount}</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Enhanced Filter Box */}
      <Paper
        elevation={0}
        sx={{
          p: 2.2,
          borderRadius: '22px',
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
          {/* Search Box */}
          <TextField
            size="small"
            placeholder="Search by Earner Name, ID, Phone, Email, or Last Message..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            sx={{ flex: 1, minWidth: 260, '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearch('')}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null
            }}
          />

          {/* Role Filter Dropdown */}
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={roleFilter}
              label="Role"
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(0);
              }}
              sx={{ borderRadius: '14px' }}
            >
              <MenuItem value="ALL">All Roles</MenuItem>
              <MenuItem value="INDIVIDUALS">Individuals Only</MenuItem>
              <MenuItem value="BULKERS">Supervisors / Bulkers</MenuItem>
            </Select>
          </FormControl>

          {/* Clear Filters Button */}
          {(search || statusFilter !== 'ALL' || roleFilter !== 'ALL') && (
            <Button
              variant="text"
              color="inherit"
              size="small"
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
                setRoleFilter('ALL');
                setPage(0);
              }}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Reset Filters
            </Button>
          )}
        </Box>

        {/* Quick Status Filter Badges */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', py: 0.5 }}>
            {[
              { id: 'ALL', label: 'All Chatters', count: users.length },
              { id: 'Active', label: 'Active', count: metrics.activeCount },
              { id: 'Suspended', label: 'Suspended', count: users.filter((u) => u.status === 'Suspended').length },
              { id: 'Blocked', label: 'Blocked', count: users.filter((u) => u.status === 'Blocked').length },
              { id: 'MUTED', label: 'Chat Muted', count: metrics.mutedCount }
            ].map((f) => {
              const isSelected = statusFilter === f.id;
              return (
                <Chip
                  key={f.id}
                  label={`${f.label} (${f.count})`}
                  onClick={() => {
                    setStatusFilter(f.id);
                    setPage(0);
                  }}
                  color={isSelected ? 'primary' : 'default'}
                  variant={isSelected ? 'filled' : 'outlined'}
                  sx={{
                    fontWeight: 800,
                    borderRadius: '12px',
                    fontSize: '0.74rem',
                    cursor: 'pointer'
                  }}
                />
              );
            })}
          </Stack>

          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
            Showing {filteredUsers.length} of {users.length} chatters
          </Typography>
        </Box>
      </Paper>

      {/* Main Data Table */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: '24px',
          border: `1px solid ${theme.palette.divider}`,
          overflow: 'hidden',
          bgcolor: 'background.paper',
          boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.3)' : '0 10px 24px rgba(37,99,235,0.05)'
        }}
      >
        {loading ? (
          <Box sx={{ p: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={36} />
            <Typography variant="body2" color="text.secondary">Fetching community group chat participants...</Typography>
          </Box>
        ) : filteredUsers.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
            <ChatBubbleIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary' }}>No Chatters Found</Typography>
            <Typography variant="body2" color="text.secondary">
              {users.length === 0
                ? 'No users have posted in the community chat yet. As soon as a user messages in the lounge, they will appear here.'
                : 'No community chatters match your search filters.'}
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table size="medium">
                <TableHead sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, fontSize: '0.74rem', py: 1.6, width: 40 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: '0.74rem', py: 1.6 }}>EARNER / MEMBER</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: '0.74rem', py: 1.6 }}>CONTACT INFO</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: '0.74rem', py: 1.6 }}>GROUP CHAT ACTIVITY</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: '0.74rem', py: 1.6 }}>ACCOUNT STATUS</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: '0.74rem', py: 1.6 }}>PERMISSIONS</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.74rem', py: 1.6 }}>MODERATION ACTIONS</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedUsers.map((user, idx) => {
                    const isBlocked = user.status === 'Blocked';
                    const isSuspended = user.status === 'Suspended';
                    const isMuted = chatSettings.mutedUsers?.includes(user.earner_id);
                    const perms = chatSettings.userPermissions?.[user.earner_id] || { canSendLinks: true, canSendMedia: true };
                    const lastActiveDate = new Date(user.last_message_at).toLocaleDateString('en-IN', {
                      month: 'short',
                      day: 'numeric'
                    });
                    const lastActiveTime = new Date(user.last_message_at).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    });

                    return (
                      <TableRow key={user.earner_id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        {/* Index */}
                        <TableCell sx={{ py: 1.6, color: 'text.secondary', fontWeight: 700, fontSize: '0.8rem' }}>
                          {page * rowsPerPage + idx + 1}
                        </TableCell>

                        {/* Earner Info */}
                        <TableCell sx={{ py: 1.6 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar
                              sx={{
                                width: 42,
                                height: 42,
                                background: 'linear-gradient(135deg, #2563eb, #06b6d4)',
                                fontWeight: 800,
                                fontSize: '0.95rem',
                                boxShadow: '0 4px 12px rgba(37,99,235,0.2)'
                              }}
                            >
                              {user.first_name ? user.first_name.charAt(0).toUpperCase() : 'U'}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                                {user.first_name} {user.last_name || ''}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.3 }}>
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, fontFamily: 'monospace' }}>
                                  {user.earner_id}
                                </Typography>
                                <Tooltip title="Copy Earner ID">
                                  <IconButton size="small" onClick={() => handleCopyId(user.earner_id)} sx={{ p: 0.2 }}>
                                    <ContentCopyIcon sx={{ fontSize: 13 }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                              {user.chat_badge && (
                                <Chip
                                  label={user.chat_badge}
                                  size="small"
                                  sx={{
                                    height: 18,
                                    fontSize: '0.62rem',
                                    fontWeight: 800,
                                    mt: 0.4,
                                    bgcolor: user.chat_badge.includes('Supervisor') ? 'rgba(16,185,129,0.15)' : 'rgba(37,99,235,0.12)',
                                    color: user.chat_badge.includes('Supervisor') ? '#10b981' : '#2563eb'
                                  }}
                                />
                              )}
                            </Box>
                          </Box>
                        </TableCell>

                        {/* Contact Details */}
                        <TableCell sx={{ py: 1.6 }}>
                          <Typography variant="body2" sx={{ fontSize: '0.82rem', fontWeight: 650 }}>{user.email}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>📞 {user.phone}</Typography>
                          {user.bulker_id && user.bulker_id !== '—' && (
                            <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700 }}>
                              Bulker: {user.bulker_id}
                            </Typography>
                          )}
                        </TableCell>

                        {/* Group Chat Activity */}
                        <TableCell sx={{ py: 1.6 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
                            <Chip
                              label={`💬 ${user.message_count} ${user.message_count === 1 ? 'message' : 'messages'}`}
                              size="small"
                              sx={{
                                height: 22,
                                fontWeight: 800,
                                fontSize: '0.7rem',
                                bgcolor: 'rgba(6,182,212,0.12)',
                                color: '#06b6d4'
                              }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                              {lastActiveDate} • {lastActiveTime}
                            </Typography>
                          </Box>
                          {user.last_message && (
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'text.secondary',
                                display: '-webkit-box',
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                fontStyle: 'italic',
                                maxWidth: 220
                              }}
                            >
                              "{user.last_message}"
                            </Typography>
                          )}
                        </TableCell>

                        {/* Account & Chat Status */}
                        <TableCell sx={{ py: 1.6 }}>
                          <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap">
                            <Chip
                              label={user.status || 'Active'}
                              size="small"
                              color={isBlocked ? 'error' : isSuspended ? 'warning' : 'success'}
                              sx={{ fontWeight: 800, height: 22, fontSize: '0.7rem', borderRadius: '8px' }}
                            />
                            {isMuted && (
                              <Chip
                                label="🔇 Muted"
                                size="small"
                                sx={{
                                  fontWeight: 800,
                                  height: 22,
                                  fontSize: '0.7rem',
                                  borderRadius: '8px',
                                  bgcolor: 'rgba(239,68,68,0.12)',
                                  color: '#ef4444'
                                }}
                              />
                            )}
                          </Stack>
                        </TableCell>

                        {/* Safety Permissions */}
                        <TableCell sx={{ py: 1.6 }}>
                          <Stack direction="row" spacing={0.6}>
                            <Chip
                              label={perms.canSendLinks ? '🔗 Links' : '🔗 No Links'}
                              size="small"
                              variant="outlined"
                              color={perms.canSendLinks ? 'default' : 'error'}
                              sx={{ height: 20, fontSize: '0.64rem', fontWeight: 700 }}
                            />
                            <Chip
                              label={perms.canSendMedia ? '📷 Media' : '📷 No Media'}
                              size="small"
                              variant="outlined"
                              color={perms.canSendMedia ? 'default' : 'error'}
                              sx={{ height: 20, fontSize: '0.64rem', fontWeight: 700 }}
                            />
                          </Stack>
                        </TableCell>

                        {/* Moderation Actions */}
                        <TableCell align="right" sx={{ py: 1.6 }}>
                          <Stack direction="row" spacing={0.8} justifyContent="flex-end" alignItems="center">
                            {/* Timeout Button */}
                            <Tooltip title="Suspend / Set Timeout (1h, 24h, Custom)">
                              <IconButton
                                size="small"
                                onClick={() => openTimeoutModal(user)}
                                sx={{ bgcolor: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.12)', color: '#f59e0b', borderRadius: '10px' }}
                              >
                                <TimerIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            {/* Mute Button */}
                            <Tooltip title={isMuted ? 'Unmute in Community Chat' : 'Mute in Community Chat'}>
                              <IconButton
                                size="small"
                                onClick={() => handleToggleMute(user)}
                                sx={{
                                  bgcolor: isMuted ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)',
                                  color: isMuted ? '#22c55e' : '#ef4444',
                                  borderRadius: '10px'
                                }}
                              >
                                <VolumeOffIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            {/* Permissions Button */}
                            <Tooltip title="Configure Chat Permissions">
                              <IconButton
                                size="small"
                                onClick={() => openPermissionsModal(user)}
                                sx={{ bgcolor: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.12)', color: '#3b82f6', borderRadius: '10px' }}
                              >
                                <TuneIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            {/* Block / Unblock Toggle */}
                            <Tooltip title={isBlocked ? 'Unblock Earner' : 'Block / Ban Earner'}>
                              <IconButton
                                size="small"
                                onClick={() => handleToggleBlock(user)}
                                sx={{
                                  bgcolor: isBlocked ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                                  color: isBlocked ? '#22c55e' : '#ef4444',
                                  borderRadius: '10px'
                                }}
                              >
                                {isBlocked ? <CheckCircleIcon fontSize="small" /> : <BlockIcon fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination Controls */}
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={filteredUsers.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              sx={{ borderTop: `1px solid ${theme.palette.divider}` }}
            />
          </>
        )}
      </Paper>

      {/* Timeout / Suspend Dialog */}
      <Dialog
        open={timeoutModalOpen}
        onClose={() => setTimeoutModalOpen(false)}
        PaperProps={{ sx: { borderRadius: '22px', p: 1, minWidth: { xs: 320, sm: 460 } } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Suspend Community Chatter</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Suspending <strong>{selectedUser?.first_name}</strong> ({selectedUser?.earner_id}) will temporarily pause their community lounge access.
          </Typography>

          <FormControl size="small" fullWidth>
            <InputLabel>Timeout Duration</InputLabel>
            <Select
              value={timeoutDuration}
              label="Timeout Duration"
              onChange={(e) => setTimeoutDuration(e.target.value)}
              sx={{ borderRadius: '12px' }}
            >
              <MenuItem value="1h">1 Hour Timeout</MenuItem>
              <MenuItem value="24h">24 Hours Timeout</MenuItem>
              <MenuItem value="3d">3 Days Suspension</MenuItem>
              <MenuItem value="7d">7 Days Suspension</MenuItem>
              <MenuItem value="perm">Permanent Suspension</MenuItem>
            </Select>
          </FormControl>

          <TextField
            size="small"
            label="Reason for Suspension"
            fullWidth
            value={timeoutReason}
            onChange={(e) => setTimeoutReason(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setTimeoutModalOpen(false)} sx={{ borderRadius: '12px', textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleApplyTimeout}
            sx={{ borderRadius: '12px', fontWeight: 800, textTransform: 'none', px: 2.5 }}
          >
            Apply Suspension
          </Button>
        </DialogActions>
      </Dialog>

      {/* Permission Limits Dialog */}
      <Dialog
        open={permModalOpen}
        onClose={() => setPermModalOpen(false)}
        PaperProps={{ sx: { borderRadius: '22px', p: 1, minWidth: { xs: 320, sm: 440 } } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Chat Permission Limits</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Configure safety permission limits for <strong>{selectedUser?.first_name}</strong>.
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={userPerms.canSendLinks}
                onChange={(e) => setUserPerms({ ...userPerms, canSendLinks: e.target.checked })}
              />
            }
            label={<Typography variant="body2" sx={{ fontWeight: 700 }}>Allow Sharing Links (URLs)</Typography>}
          />

          <FormControlLabel
            control={
              <Switch
                checked={userPerms.canSendMedia}
                onChange={(e) => setUserPerms({ ...userPerms, canSendMedia: e.target.checked })}
              />
            }
            label={<Typography variant="body2" sx={{ fontWeight: 700 }}>Allow Sharing Media (Images, Videos)</Typography>}
          />

          <FormControlLabel
            control={
              <Switch
                checked={userPerms.slowModeExempt}
                onChange={(e) => setUserPerms({ ...userPerms, slowModeExempt: e.target.checked })}
              />
            }
            label={<Typography variant="body2" sx={{ fontWeight: 700 }}>Exempt from Slow Mode Cooldown</Typography>}
          />

          <TextField
            size="small"
            type="number"
            label="Max Messages Allowed per Minute"
            value={userPerms.rateLimitPerMin}
            onChange={(e) => setUserPerms({ ...userPerms, rateLimitPerMin: Number(e.target.value) || 10 })}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPermModalOpen(false)} sx={{ borderRadius: '12px', textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSavePermissions}
            sx={{ borderRadius: '12px', fontWeight: 800, textTransform: 'none', px: 2.5 }}
          >
            Save Permissions
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
