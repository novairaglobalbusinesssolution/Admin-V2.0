import { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Paper, TextField, IconButton, Button,
  Avatar, Chip, Tooltip, Stack, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Menu, MenuItem, useTheme, InputAdornment
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import PushPinIcon from '@mui/icons-material/PushPin';
import BlockIcon from '@mui/icons-material/Block';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import LockIcon from '@mui/icons-material/Lock';
import ShieldIcon from '@mui/icons-material/Shield';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import Swal from 'sweetalert2';

import {
  fetchMessages,
  subscribeToMessages,
  sendAdminMessage,
  deleteMessage,
  pinNotice,
  verifyAdminMpin,
  updateUserAccountStatus
} from './communityChatService';

export default function CommunityChatsView() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [senderBadge, setSenderBadge] = useState('👑 Super Admin');
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [showMediaInput, setShowMediaInput] = useState(false);

  // M-PIN Dialog State
  const [mpinDialogOpen, setMpinDialogOpen] = useState(false);
  const [mpinInput, setMpinInput] = useState('');
  const [pendingAction, setPendingAction] = useState(null);

  // Context Menu State
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedMsg, setSelectedMsg] = useState(null);

  const messagesEndRef = useRef(null);
  const isUserScrolledUp = useRef(false);

  const scrollToBottom = (behavior = 'smooth') => {
    if (!isUserScrolledUp.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  };

  useEffect(() => {
    loadMessages();

    // Setup Supabase Realtime WebSocket
    const channel = subscribeToMessages(
      (newMsg) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(() => scrollToBottom('smooth'), 100);
      },
      (updatedMsg) => {
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

  const loadMessages = async () => {
    try {
      setLoading(true);
      const data = await fetchMessages(150);
      // Filter out internal system configs from general stream
      setMessages(data.filter((m) => m.sender_id !== 'SYS-CONFIG'));
      setTimeout(() => scrollToBottom('auto'), 150);
    } catch (err) {
      console.error('Failed to load chat messages:', err);
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
        badge: senderBadge,
        mediaUrl: mediaUrlInput
      });
      setInputText('');
      setMediaUrlInput('');
      setShowMediaInput(false);
      isUserScrolledUp.current = false;
      setTimeout(() => scrollToBottom('smooth'), 100);
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Send Failed',
        text: err.message || 'Could not deliver message to community lounge'
      });
    } finally {
      setSending(false);
    }
  };

  // Delete message for everyone
  const handleDeleteForEveryone = async (msg) => {
    handleMenuClose();
    const result = await Swal.fire({
      title: 'Delete Message?',
      text: `Are you sure you want to permanently delete this message sent by "${msg.sender_name}" for all users?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Delete for Everyone'
    });

    if (result.isConfirmed) {
      try {
        await deleteMessage(msg.id);
        setMessages((prev) => prev.filter((m) => m.id !== msg.id));
        Swal.fire({
          icon: 'success',
          title: 'Deleted',
          text: 'Message has been removed from all devices.',
          timer: 1500,
          showConfirmButton: false
        });
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Delete Failed',
          text: err.message || 'Failed to remove message'
        });
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
      Swal.fire({
        icon: 'success',
        title: 'Pinned!',
        text: 'This message has been pinned as an official announcement in the app.',
        timer: 1800,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Pin Failed', text: err.message });
    }
  };

  // Moderate user from chat
  const handleModerateSender = async (msg) => {
    handleMenuClose();
    if (!msg.sender_id || msg.sender_id.startsWith('SYS')) {
      Swal.fire({ icon: 'info', title: 'System Message', text: 'System messages cannot be suspended.' });
      return;
    }

    const { value: action } = await Swal.fire({
      title: `Moderate ${msg.sender_name}`,
      text: `Earner ID: ${msg.sender_id}`,
      input: 'select',
      inputOptions: {
        suspend1h: '⏱️ Suspend for 1 Hour',
        suspend24h: '⏱️ Suspend for 24 Hours',
        block: '🚫 Block / Ban Permanently',
        unblock: '🔓 Unblock & Activate Account'
      },
      inputPlaceholder: 'Select Moderation Action',
      showCancelButton: true,
      confirmButtonText: 'Apply Moderation',
      confirmButtonColor: '#ef4444'
    });

    if (action) {
      try {
        const newStatus = action === 'unblock' ? 'Active' : action === 'block' ? 'Blocked' : 'Suspended';
        await updateUserAccountStatus(msg.sender_id, newStatus);
        Swal.fire({
          icon: 'success',
          title: 'Status Updated',
          text: `User ${msg.sender_name} is now ${newStatus}.`
        });
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Action Failed', text: err.message });
      }
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
    Swal.fire({
      icon: 'success',
      title: 'Copied!',
      text: 'Message copied to clipboard',
      timer: 1000,
      showConfirmButton: false
    });
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', gap: 1.5 }}>
      {/* Top Header Card */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: '20px',
          border: `1px solid ${theme.palette.divider}`,
          background: isDark
            ? 'linear-gradient(135deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.85) 100%)'
            : 'linear-gradient(135deg, rgba(240,249,255,0.8) 0%, rgba(255,255,255,0.95) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5
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
            <VerifiedUserIcon />
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
                  boxShadow: '0 0 10px #22c55e',
                  animation: 'pulse 1.8s infinite'
                }}
              />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                Live Stream Connected • {messages.length} messages loaded
              </Typography>
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
              bgcolor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.8)'
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
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: isDark ? '#0c0f17' : '#f8fafc',
          backgroundImage: isDark
            ? 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 0)'
            : 'radial-gradient(rgba(0,0,0,0.04) 1px, transparent 0)',
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
                      <Chip label={msg.sender_badge || '📢 Sponsored Ad'} size="small" sx={{ bgcolor: '#f59e0b', color: '#000', fontWeight: 800, fontSize: '0.72rem' }} />
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
                        bgcolor: isAdmin ? '#2563eb' : '#0ea5e9',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                    >
                      {msg.sender_name?.charAt(0)?.toUpperCase() || 'U'}
                    </Avatar>

                    {/* Bubble Content */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-end' : 'flex-start' }}>
                      {/* Name & Badge Header */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.4 }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: isAdmin ? 'primary.main' : 'text.primary' }}>
                          {msg.sender_name}
                        </Typography>

                        {msg.sender_badge && (
                          <Chip
                            label={msg.sender_badge}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              bgcolor: isAdmin
                                ? 'rgba(37,99,235,0.15)'
                                : msg.sender_badge.includes('Supervisor')
                                ? 'rgba(16,185,129,0.15)'
                                : 'rgba(148,163,184,0.15)',
                              color: isAdmin
                                ? '#3b82f6'
                                : msg.sender_badge.includes('Supervisor')
                                ? '#10b981'
                                : 'text.secondary'
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
                          p: 1.5,
                          px: 2,
                          borderRadius: '18px',
                          borderTopLeftRadius: !isAdmin ? '4px' : '18px',
                          borderTopRightRadius: isAdmin ? '4px' : '18px',
                          bgcolor: isAdmin
                            ? '#2563eb'
                            : isDark
                            ? '#1e293b'
                            : '#ffffff',
                          color: isAdmin ? '#ffffff' : 'text.primary',
                          boxShadow: isAdmin
                            ? '0 6px 18px rgba(37,99,235,0.25)'
                            : isDark
                            ? '0 6px 18px rgba(0,0,0,0.3)'
                            : '0 4px 14px rgba(0,0,0,0.06)',
                          border: !isAdmin ? `1px solid ${theme.palette.divider}` : 'none',
                          wordBreak: 'break-word',
                          position: 'relative'
                        }}
                      >
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                          {msg.message}
                        </Typography>
                      </Paper>

                      {/* Earner ID footer for moderators */}
                      {!isAdmin && msg.sender_id && (
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.62rem', mt: 0.3, px: 0.5 }}>
                          ID: {msg.sender_id}
                        </Typography>
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
          sx: { borderRadius: '16px', minWidth: 200, boxShadow: '0 12px 32px rgba(0,0,0,0.18)' }
        }}
      >
        <MenuItem onClick={() => handleCopyText(selectedMsg)} sx={{ py: 1, gap: 1.5, fontSize: '0.85rem' }}>
          <ContentCopyIcon fontSize="small" color="action" /> Copy Text
        </MenuItem>
        <MenuItem onClick={() => handlePinMessage(selectedMsg)} sx={{ py: 1, gap: 1.5, fontSize: '0.85rem' }}>
          <PushPinIcon fontSize="small" sx={{ color: '#ec4899' }} /> Pin Announcement
        </MenuItem>
        <MenuItem onClick={() => handleModerateSender(selectedMsg)} sx={{ py: 1, gap: 1.5, fontSize: '0.85rem' }}>
          <ShieldIcon fontSize="small" sx={{ color: '#f59e0b' }} /> Moderate User
        </MenuItem>
        <MenuItem onClick={() => handleDeleteForEveryone(selectedMsg)} sx={{ py: 1, gap: 1.5, fontSize: '0.85rem', color: 'error.main' }}>
          <DeleteOutlineIcon fontSize="small" color="error" /> Delete for Everyone
        </MenuItem>
      </Menu>

      {/* Admin Message Sender Dock */}
      <Paper
        elevation={0}
        component="form"
        onSubmit={handleSendMessage}
        sx={{
          p: 1.5,
          borderRadius: '20px',
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.2,
          boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.4)' : '0 10px 24px rgba(37,99,235,0.06)'
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
            label={senderBadge}
            onClick={() => {
              const options = ['👑 Super Admin', '🛡️ Moderator', '📢 System Announcement'];
              const nextIndex = (options.indexOf(senderBadge) + 1) % options.length;
              setSenderBadge(options[nextIndex]);
            }}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ fontWeight: 800, cursor: 'pointer', borderRadius: '10px' }}
          />

          {/* Media Attach Button */}
          <Tooltip title="Attach image or social media link">
            <IconButton
              size="small"
              onClick={() => setShowMediaInput(!showMediaInput)}
              color={showMediaInput || mediaUrlInput ? 'primary' : 'default'}
              sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderRadius: '10px' }}
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
                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
              }
            }}
          />

          {/* Send Button */}
          <Button
            type="submit"
            variant="contained"
            disabled={sending || (!inputText.trim() && !mediaUrlInput.trim())}
            endIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
            sx={{
              borderRadius: '14px',
              px: 3,
              fontWeight: 800,
              textTransform: 'none',
              minWidth: 100,
              boxShadow: 'none'
            }}
          >
            Send
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
