import { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Paper, TextField, IconButton, Button,
  Avatar, Chip, Tooltip, Stack, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Menu, MenuItem, useTheme, InputAdornment, Alert
} from '@mui/material';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import PushPinIcon from '@mui/icons-material/PushPin';
import BlockIcon from '@mui/icons-material/Block';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ShieldIcon from '@mui/icons-material/Shield';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import CampaignIcon from '@mui/icons-material/Campaign';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ForumIcon from '@mui/icons-material/Forum';

import {
  fetchMessages,
  subscribeToMessages,
  sendAdminMessage,
  deleteMessage,
  pinNotice,
  getChatSettings,
  saveChatSettings,
  blockUserInChat,
  unblockUserInChat
} from './communityChatService';

import {
  notifySuccess,
  notifyError,
  notifyConfirm
} from './chatNotification';

const BADGE_OPTIONS = [
  { label: 'Super Admin', badge: 'Super Admin', icon: <WorkspacePremiumIcon sx={{ fontSize: 15 }} /> },
  { label: 'Moderator', badge: 'Moderator', icon: <ShieldIcon sx={{ fontSize: 15 }} /> },
  { label: 'Official Notice', badge: 'Official Notice', icon: <CampaignIcon sx={{ fontSize: 15 }} /> }
];

export default function CommunityChatsView() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState(BADGE_OPTIONS[0]);
  const [badgeMenuAnchor, setBadgeMenuAnchor] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [showMediaInput, setShowMediaInput] = useState(false);

  // Chat Settings State (for mutedUsers)
  const [chatSettings, setChatSettings] = useState({ mutedUsers: [] });

  // Context Menu State
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedMsg, setSelectedMsg] = useState(null);

  // Moderation Dialog State
  const [modDialogOpen, setModDialogOpen] = useState(false);
  const [modTargetUser, setModTargetUser] = useState(null);
  const [modProcessing, setModProcessing] = useState(false);

  const messagesEndRef = useRef(null);
  const isUserScrolledUp = useRef(false);

  const scrollToBottom = (behavior = 'smooth') => {
    if (!isUserScrolledUp.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  };

  useEffect(() => {
    loadInitialData();

    // Setup Supabase Realtime WebSocket
    const channel = subscribeToMessages(
      (newMsg) => {
        if (newMsg.sender_id === 'SYS-CONFIG') {
          try {
            const parsed = JSON.parse(newMsg.message);
            setChatSettings((prev) => ({ ...prev, ...parsed }));
          } catch (_) {}
          return;
        }

        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(() => scrollToBottom('smooth'), 100);
      },
      (updatedMsg) => {
        if (updatedMsg.sender_id === 'SYS-CONFIG') {
          try {
            const parsed = JSON.parse(updatedMsg.message);
            setChatSettings((prev) => ({ ...prev, ...parsed }));
          } catch (_) {}
          return;
        }
        setMessages((prev) => prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)));
      },
      (deletedMsg) => {
        setMessages((prev) => prev.filter((m) => m.id !== deletedMsg.id));
      }
    );

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [data, settings] = await Promise.all([
        fetchMessages(150),
        getChatSettings()
      ]);
      setChatSettings(settings);
      setMessages(data.filter((m) => m.sender_id !== 'SYS-CONFIG'));
      setTimeout(() => scrollToBottom('auto'), 150);
    } catch (err) {
      console.error('Failed to load chat data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    isUserScrolledUp.current = scrollHeight - scrollTop - clientHeight > 100;
  };

  // Send message
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text && !mediaUrlInput.trim()) return;

    setSending(true);
    try {
      await sendAdminMessage({
        message: text,
        badge: selectedBadge.badge,
        mediaUrl: mediaUrlInput
      });
      setInputText('');
      setMediaUrlInput('');
      setShowMediaInput(false);
      isUserScrolledUp.current = false;
      setTimeout(() => scrollToBottom('smooth'), 100);
    } catch (err) {
      notifyError('Send Failed', err.message || 'Could not deliver message to community lounge', isDark);
    } finally {
      setSending(false);
    }
  };

  // Delete message for everyone
  const handleDeleteForEveryone = async (msg) => {
    handleMenuClose();
    const confirmed = await notifyConfirm({
      title: 'Delete Message?',
      text: `Permanently delete this message sent by "${msg.sender_name}" for all users?`,
      confirmButtonText: 'Yes, Delete',
      isDestructive: true,
      isDark
    });

    if (confirmed.isConfirmed) {
      try {
        await deleteMessage(msg.id);
        setMessages((prev) => prev.filter((m) => m.id !== msg.id));
        notifySuccess('Message Deleted', 'Removed from all devices.', 1500, isDark);
      } catch (err) {
        notifyError('Delete Failed', err.message || 'Failed to remove message', isDark);
      }
    }
  };

  // Pin message
  const handlePinMessage = async (msg) => {
    handleMenuClose();
    try {
      await pinNotice({
        title: `Notice from ${msg.sender_name}`,
        message: msg.message,
        level: 'info'
      });
      notifySuccess('Pinned!', 'This message has been pinned as an official announcement.', 1800, isDark);
    } catch (err) {
      notifyError('Pin Failed', err.message, isDark);
    }
  };

  // Open Chat Moderation Dialog
  const handleOpenModeration = (msg) => {
    handleMenuClose();
    if (!msg.sender_id || msg.sender_id.startsWith('SYS')) {
      notifyError('System Message', 'System notices cannot be moderated.', isDark);
      return;
    }
    setModTargetUser(msg);
    setModDialogOpen(true);
  };

  // Block user from chat (CHAT ONLY - DOES NOT AFFECT PROFILE/APP)
  const handleExecuteChatBlock = async () => {
    if (!modTargetUser?.sender_id) return;
    setModProcessing(true);
    try {
      await blockUserInChat(modTargetUser.sender_id);
      setChatSettings((prev) => ({
        ...prev,
        mutedUsers: [...(prev.mutedUsers || []).filter((id) => id !== modTargetUser.sender_id), modTargetUser.sender_id]
      }));
      setModDialogOpen(false);
      notifySuccess(
        'User Blocked in Chat',
        `${modTargetUser.sender_name} is now restricted from posting in community chat. Main app and earning account remain active.`,
        2200,
        isDark
      );
    } catch (err) {
      notifyError('Action Failed', err.message, isDark);
    } finally {
      setModProcessing(false);
    }
  };

  // Unblock user from chat
  const handleExecuteChatUnblock = async () => {
    if (!modTargetUser?.sender_id) return;
    setModProcessing(true);
    try {
      await unblockUserInChat(modTargetUser.sender_id);
      setChatSettings((prev) => ({
        ...prev,
        mutedUsers: (prev.mutedUsers || []).filter((id) => id !== modTargetUser.sender_id)
      }));
      setModDialogOpen(false);
      notifySuccess(
        'User Unblocked',
        `${modTargetUser.sender_name} can now participate in community chat again.`,
        1800,
        isDark
      );
    } catch (err) {
      notifyError('Action Failed', err.message, isDark);
    } finally {
      setModProcessing(false);
    }
  };

  const handleMenuOpen = (e, msg) => {
    setAnchorEl(e.currentTarget);
    setSelectedMsg(msg);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedMsg(null);
  };

  const handleCopyText = (msg) => {
    navigator.clipboard.writeText(msg.message);
    handleMenuClose();
    notifySuccess('Copied!', 'Message copied to clipboard', 1200, isDark);
  };

  const handleCopyEarnerId = (id) => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    notifySuccess('Copied!', `Earner ID ${id} copied`, 1200, isDark);
  };

  // Filter messages
  const filteredMessages = messages.filter((m) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.message?.toLowerCase().includes(q) ||
      m.sender_name?.toLowerCase().includes(q) ||
      m.sender_id?.toLowerCase().includes(q) ||
      m.sender_badge?.toLowerCase().includes(q)
    );
  });

  // Badge icon resolver helper (No emojis)
  const renderBadgeContent = (badgeText) => {
    if (!badgeText) return null;
    const cleanText = badgeText.replace(/[^\w\s-]/g, '').trim();

    if (cleanText.toLowerCase().includes('admin')) {
      return (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <WorkspacePremiumIcon sx={{ fontSize: 13, color: '#3b82f6' }} />
          <span>{cleanText || 'Super Admin'}</span>
        </Stack>
      );
    }

    if (cleanText.toLowerCase().includes('moderator')) {
      return (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <ShieldIcon sx={{ fontSize: 13, color: '#10b981' }} />
          <span>{cleanText || 'Moderator'}</span>
        </Stack>
      );
    }

    if (cleanText.toLowerCase().includes('notice') || cleanText.toLowerCase().includes('announcement')) {
      return (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <CampaignIcon sx={{ fontSize: 13, color: '#f59e0b' }} />
          <span>{cleanText || 'Official Notice'}</span>
        </Stack>
      );
    }

    return (
      <Stack direction="row" spacing={0.5} alignItems="center">
        <VerifiedUserIcon sx={{ fontSize: 13, color: '#06b6d4' }} />
        <span>{cleanText || 'Verified Earner'}</span>
      </Stack>
    );
  };

  const isTargetUserMuted = Boolean(modTargetUser?.sender_id && chatSettings.mutedUsers?.includes(modTargetUser.sender_id));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', gap: 1.5 }}>
      {/* Top Header Card */}
      <Paper
        elevation={0}
        sx={{
          p: 2.2,
          borderRadius: '22px',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
          bgcolor: isDark ? 'rgba(12, 17, 29, 0.7)' : 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(24px) saturate(160%)',
          WebkitBackdropFilter: 'blur(24px) saturate(160%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5,
          boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.3)' : '0 8px 24px rgba(6,182,212,0.06)'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 8px 18px rgba(6,182,212,0.35)'
            }}
          >
            <ForumIcon sx={{ fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.2 }}>
              Community Group Chat Lounge
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.4 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: '#22c55e',
                  boxShadow: '0 0 10px #22c55e'
                }}
              />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                Live Stream Connected • {messages.length} messages loaded
              </Typography>
              {chatSettings.mutedUsers?.length > 0 && (
                <Chip
                  icon={<VolumeOffIcon sx={{ fontSize: '12px !important', color: '#ef4444 !important' }} />}
                  label={`${chatSettings.mutedUsers.length} Muted`}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    bgcolor: 'rgba(239, 68, 68, 0.12)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.25)'
                  }}
                />
              )}
            </Box>
          </Box>
        </Box>

        {/* Search Input */}
        <TextField
          size="small"
          placeholder="Search by name, ID, or text..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{
            minWidth: 260,
            '& .MuiOutlinedInput-root': {
              borderRadius: '14px',
              bgcolor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.85)',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: 'primary.main'
              }
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
            endAdornment: searchQuery ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchQuery('')}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null
          }}
        />
      </Paper>

      {/* Main Chat Stream Container */}
      <Paper
        elevation={0}
        onScroll={handleScroll}
        sx={{
          flex: 1,
          borderRadius: '24px',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
          bgcolor: isDark ? 'rgba(7, 9, 14, 0.75)' : 'rgba(248, 250, 252, 0.85)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          backgroundImage: isDark
            ? 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 0)'
            : 'radial-gradient(rgba(15,23,42,0.04) 1px, transparent 0)',
          backgroundSize: '24px 24px',
          overflowY: 'auto',
          p: { xs: 1.5, sm: 2.5 },
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5
        }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1.5 }}>
            <CircularProgress size={36} />
            <Typography variant="body2" color="text.secondary">Connecting to live community feed...</Typography>
          </Box>
        ) : filteredMessages.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1 }}>
            <Typography variant="body1" sx={{ fontWeight: 700, color: 'text.secondary' }}>No messages found</Typography>
            <Typography variant="caption" color="text.disabled">Messages sent by app users or admin will appear here in real time.</Typography>
          </Box>
        ) : (
          filteredMessages.map((msg) => {
            const isAdmin = msg.sender_id === 'SYS-ADMIN';
            const isAd = msg.sender_id === 'SYS-AD';
            const isPinned = msg.sender_id === 'SYS-PINNED';
            const isSystem = msg.sender_id?.startsWith('SYS');
            const isSenderMuted = Boolean(msg.sender_id && chatSettings.mutedUsers?.includes(msg.sender_id));

            const timeStr = new Date(msg.created_at).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            });
            const dateStr = new Date(msg.created_at).toLocaleDateString('en-IN', {
              month: 'short',
              day: 'numeric'
            });

            // Parse ad or pinned JSON if applicable
            let parsedAd = null;
            if (isAd || isPinned) {
              try {
                parsedAd = JSON.parse(msg.message);
              } catch (_) {}
            }

            return (
              <Box
                key={msg.id}
                sx={{
                  display: 'flex',
                  justifyContent: isAdmin ? 'flex-end' : isSystem ? 'center' : 'flex-start',
                  width: '100%',
                  position: 'relative',
                  '&:hover .msg-actions': { opacity: 1 }
                }}
              >
                {/* System / Ad / Pinned Banner */}
                {isAd ? (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      maxWidth: 520,
                      width: '100%',
                      borderRadius: '18px',
                      border: '1px solid #f59e0b',
                      background: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(254,243,199,0.6)',
                      boxShadow: '0 8px 24px rgba(245,158,11,0.15)'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Chip
                        icon={<CampaignIcon sx={{ fontSize: 14 }} />}
                        label="Sponsored Promotion"
                        size="small"
                        sx={{ bgcolor: '#f59e0b', color: '#000', fontWeight: 800, fontSize: '0.72rem' }}
                      />
                      <Typography variant="caption" color="text.secondary">{dateStr} • {timeStr}</Typography>
                    </Box>
                    {parsedAd?.imageUrl && (
                      <Box component="img" src={parsedAd.imageUrl} alt="ad" sx={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: '12px', mb: 1.2 }} />
                    )}
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: isDark ? '#fbbf24' : '#b45309' }}>
                      {parsedAd?.title || 'Promotional Announcement'}
                    </Typography>
                    <Typography variant="body2" sx={{ my: 0.8, color: 'text.primary' }}>
                      {parsedAd?.description || msg.message}
                    </Typography>
                    {parsedAd?.ctaUrl && (
                      <Button
                        variant="contained"
                        size="small"
                        href={parsedAd.ctaUrl}
                        target="_blank"
                        sx={{ borderRadius: '10px', bgcolor: '#f59e0b', color: '#000', fontWeight: 800, textTransform: 'none', mt: 0.5 }}
                      >
                        {parsedAd.ctaText || 'Open Link'}
                      </Button>
                    )}
                  </Paper>
                ) : isPinned ? (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.8,
                      maxWidth: 520,
                      width: '100%',
                      borderRadius: '18px',
                      border: '1px solid #ec4899',
                      background: isDark ? 'rgba(236,72,153,0.08)' : 'rgba(253,242,248,0.7)'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
                      <PushPinIcon sx={{ color: '#ec4899', fontSize: 20 }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#ec4899' }}>
                        {parsedAd?.title || 'Pinned Announcement'}
                      </Typography>
                      <Box sx={{ flex: 1 }} />
                      <Typography variant="caption" color="text.secondary">{dateStr} • {timeStr}</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: 'text.primary' }}>
                      {parsedAd?.message || msg.message}
                    </Typography>
                  </Paper>
                ) : (
                  /* Standard Chat Bubble (Admin or User) */
                  <Box sx={{ display: 'flex', gap: 1.2, maxWidth: { xs: '88%', sm: '72%' }, flexDirection: isAdmin ? 'row-reverse' : 'row' }}>
                    {/* Avatar */}
                    <Avatar
                      sx={{
                        width: 38,
                        height: 38,
                        fontSize: '0.88rem',
                        fontWeight: 800,
                        background: isAdmin ? 'linear-gradient(135deg, #1d4ed8, #2563eb)' : 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        border: isAdmin ? '2px solid rgba(255,255,255,0.4)' : 'none'
                      }}
                    >
                      {isAdmin ? <WorkspacePremiumIcon sx={{ fontSize: 20 }} /> : (msg.sender_name?.charAt(0)?.toUpperCase() || 'U')}
                    </Avatar>

                    {/* Bubble Content */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-end' : 'flex-start' }}>
                      {/* Name & Badge Header */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.4, flexWrap: 'wrap' }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: isAdmin ? 'primary.main' : 'text.primary' }}>
                          {msg.sender_name}
                        </Typography>

                        {msg.sender_badge && (
                          <Chip
                            label={renderBadgeContent(msg.sender_badge)}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.66rem',
                              fontWeight: 700,
                              bgcolor: isAdmin
                                ? 'rgba(37,99,235,0.12)'
                                : 'rgba(14,165,233,0.12)',
                              color: isAdmin ? '#2563eb' : '#0284c7',
                              border: `1px solid ${isAdmin ? 'rgba(37,99,235,0.2)' : 'rgba(14,165,233,0.2)'}`
                            }}
                          />
                        )}

                        {isSenderMuted && !isAdmin && (
                          <Chip
                            icon={<VolumeOffIcon sx={{ fontSize: '11px !important', color: '#ef4444 !important' }} />}
                            label="Muted in Chat"
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              bgcolor: 'rgba(239, 68, 68, 0.1)',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.2)'
                            }}
                          />
                        )}

                        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem' }}>
                          {timeStr}
                        </Typography>
                      </Box>

                      {/* Bubble Surface */}
                      <Paper
                        elevation={0}
                        sx={{
                          p: 1.6,
                          px: 2,
                          borderRadius: '18px',
                          borderTopLeftRadius: !isAdmin ? '4px' : '18px',
                          borderTopRightRadius: isAdmin ? '4px' : '18px',
                          background: isAdmin
                            ? 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)'
                            : isDark
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'rgba(255, 255, 255, 0.95)',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          color: isAdmin ? '#ffffff' : 'text.primary',
                          boxShadow: isAdmin
                            ? '0 6px 24px rgba(37,99,235,0.35)'
                            : isDark
                            ? '0 6px 20px rgba(0,0,0,0.35)'
                            : '0 4px 14px rgba(0,0,0,0.04)',
                          border: !isAdmin
                            ? (isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(15, 23, 42, 0.08)')
                            : '1px solid rgba(255, 255, 255, 0.25)',
                          wordBreak: 'break-word',
                          position: 'relative'
                        }}
                      >
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                          {msg.message}
                        </Typography>
                      </Paper>

                      {/* Earner ID footer with instant copy */}
                      {!isAdmin && msg.sender_id && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3, px: 0.5 }}>
                          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem', fontFamily: 'monospace' }}>
                            {msg.sender_id}
                          </Typography>
                          <Tooltip title="Copy Earner ID">
                            <IconButton
                              size="small"
                              onClick={() => handleCopyEarnerId(msg.sender_id)}
                              sx={{ p: 0.2, color: 'text.disabled', '&:hover': { color: 'primary.main' } }}
                            >
                              <ContentCopyIcon sx={{ fontSize: 11 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )}
                    </Box>

                    {/* Action button trigger (visible on hover) */}
                    <Box
                      className="msg-actions"
                      sx={{
                        opacity: 0,
                        transition: 'opacity 0.2s ease',
                        alignSelf: 'center'
                      }}
                    >
                      <IconButton size="small" onClick={(e) => handleMenuOpen(e, msg)}>
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                )}
              </Box>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </Paper>

      {/* Floating Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            borderRadius: '16px',
            minWidth: 220,
            p: 0.5,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: '0 16px 36px rgba(0,0,0,0.2)'
          }
        }}
      >
        <MenuItem onClick={() => handleCopyText(selectedMsg)} sx={{ py: 1, gap: 1.5, fontSize: '0.85rem', borderRadius: '10px' }}>
          <ContentCopyIcon fontSize="small" color="action" /> Copy Message
        </MenuItem>
        <MenuItem onClick={() => handlePinMessage(selectedMsg)} sx={{ py: 1, gap: 1.5, fontSize: '0.85rem', borderRadius: '10px' }}>
          <PushPinIcon fontSize="small" sx={{ color: '#ec4899' }} /> Pin Announcement
        </MenuItem>
        {selectedMsg && !selectedMsg.sender_id?.startsWith('SYS') && (
          <MenuItem onClick={() => handleOpenModeration(selectedMsg)} sx={{ py: 1, gap: 1.5, fontSize: '0.85rem', borderRadius: '10px', color: '#f59e0b' }}>
            <BlockIcon fontSize="small" sx={{ color: '#f59e0b' }} /> Chat Access / Block
          </MenuItem>
        )}
        <MenuItem onClick={() => handleDeleteForEveryone(selectedMsg)} sx={{ py: 1, gap: 1.5, fontSize: '0.85rem', borderRadius: '10px', color: 'error.main' }}>
          <DeleteOutlineIcon fontSize="small" color="error" /> Delete for Everyone
        </MenuItem>
      </Menu>

      {/* Dedicated Chat-Only Moderation Dialog */}
      <Dialog
        open={modDialogOpen}
        onClose={() => !modProcessing && setModDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '24px',
            p: 1,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: '0 24px 48px rgba(0,0,0,0.3)'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <ShieldIcon sx={{ color: '#f59e0b', fontSize: 24 }} />
          Community Chat Access
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {modTargetUser && (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '16px',
                bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                border: `1px solid ${theme.palette.divider}`,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5
              }}
            >
              <Avatar sx={{ bgcolor: '#0284c7', fontWeight: 800 }}>
                {modTargetUser.sender_name?.charAt(0)?.toUpperCase() || 'U'}
              </Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>
                  {modTargetUser.sender_name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }} noWrap>
                  {modTargetUser.sender_id}
                </Typography>
              </Box>
              <Chip
                icon={isTargetUserMuted ? <VolumeOffIcon sx={{ fontSize: 13 }} /> : <CheckCircleIcon sx={{ fontSize: 13 }} />}
                label={isTargetUserMuted ? 'Blocked in Chat' : 'Active'}
                size="small"
                color={isTargetUserMuted ? 'error' : 'success'}
                sx={{ fontWeight: 700 }}
              />
            </Paper>
          )}

          <Alert severity="info" icon={<InfoOutlinedIcon fontSize="small" />} sx={{ borderRadius: '14px', fontSize: '0.82rem', lineHeight: 1.5 }}>
            <strong>Chat-Only Restriction:</strong> Blocking this user only prevents them from sending messages in the Community Group Chat. Their main account, earning tasks, and wallet remain 100% active.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0, gap: 1, flexDirection: 'column' }}>
          {isTargetUserMuted ? (
            <Button
              fullWidth
              variant="contained"
              color="success"
              disabled={modProcessing}
              startIcon={modProcessing ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
              onClick={handleExecuteChatUnblock}
              sx={{ borderRadius: '12px', py: 1.2, fontWeight: 700, textTransform: 'none' }}
            >
              Unblock & Restore Chat Access
            </Button>
          ) : (
            <Button
              fullWidth
              variant="contained"
              color="error"
              disabled={modProcessing}
              startIcon={modProcessing ? <CircularProgress size={16} color="inherit" /> : <BlockIcon />}
              onClick={handleExecuteChatBlock}
              sx={{
                borderRadius: '12px',
                py: 1.2,
                fontWeight: 700,
                textTransform: 'none',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)'
              }}
            >
              Block from Community Chat
            </Button>
          )}

          <Button
            fullWidth
            variant="text"
            onClick={() => setModDialogOpen(false)}
            disabled={modProcessing}
            sx={{ borderRadius: '12px', color: 'text.secondary', fontWeight: 600, textTransform: 'none' }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Admin Message Sender Dock */}
      <Paper
        elevation={0}
        component="form"
        onSubmit={handleSendMessage}
        sx={{
          p: 1.8,
          borderRadius: '22px',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
          bgcolor: isDark ? 'rgba(12, 17, 29, 0.8)' : 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.2,
          boxShadow: isDark ? '0 12px 35px rgba(0,0,0,0.5)' : '0 10px 28px rgba(37,99,235,0.06)'
        }}
      >
        {/* Media URL Input Drawer (Toggleable) */}
        {showMediaInput && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Paste media link (.png, .jpg, YouTube, Facebook, Instagram)..."
              value={mediaUrlInput}
              onChange={(e) => setMediaUrlInput(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            />
            <IconButton size="small" onClick={() => setShowMediaInput(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          {/* Badge Selector Pill */}
          <Chip
            icon={selectedBadge.icon}
            label={selectedBadge.label}
            onClick={(e) => setBadgeMenuAnchor(e.currentTarget)}
            size="small"
            color="primary"
            variant="outlined"
            sx={{
              fontWeight: 800,
              cursor: 'pointer',
              borderRadius: '12px',
              px: 0.5,
              py: 1.8,
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(37,99,235,0.25)'
              }
            }}
          />

          <Menu
            anchorEl={badgeMenuAnchor}
            open={Boolean(badgeMenuAnchor)}
            onClose={() => setBadgeMenuAnchor(null)}
            PaperProps={{
              sx: {
                borderRadius: '16px',
                minWidth: 180,
                p: 0.5,
                border: `1px solid ${theme.palette.divider}`,
                boxShadow: '0 12px 30px rgba(0,0,0,0.2)'
              }
            }}
          >
            {BADGE_OPTIONS.map((opt) => (
              <MenuItem
                key={opt.badge}
                selected={selectedBadge.badge === opt.badge}
                onClick={() => {
                  setSelectedBadge(opt);
                  setBadgeMenuAnchor(null);
                }}
                sx={{ py: 1, gap: 1.2, fontSize: '0.85rem', borderRadius: '10px' }}
              >
                {opt.icon}
                <span>{opt.label}</span>
              </MenuItem>
            ))}
          </Menu>

          {/* Media Attach Button */}
          <Tooltip title="Attach image or social media link">
            <IconButton
              size="small"
              onClick={() => setShowMediaInput(!showMediaInput)}
              color={showMediaInput || mediaUrlInput ? 'primary' : 'default'}
              sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderRadius: '12px', p: 0.9 }}
            >
              <AttachFileIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Main Text Input */}
          <TextField
            fullWidth
            size="small"
            placeholder="Broadcast message as Admin (Press Enter to send)..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '14px',
                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: 'primary.main'
                }
              }
            }}
          />

          {/* Send Button */}
          <Button
            type="submit"
            variant="contained"
            disabled={sending || (!inputText.trim() && !mediaUrlInput.trim())}
            endIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendRoundedIcon />}
            sx={{
              borderRadius: '14px',
              px: 3,
              fontWeight: 800,
              textTransform: 'none',
              minWidth: 105,
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: '0 6px 18px rgba(37,99,235,0.45)'
              }
            }}
          >
            Send
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
