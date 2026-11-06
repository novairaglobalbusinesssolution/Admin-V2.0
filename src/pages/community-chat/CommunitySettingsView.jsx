import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, TextField, Button,
  Switch, FormControlLabel, Chip, Stack, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  useTheme, Grid, Tooltip, IconButton
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import SpeedIcon from '@mui/icons-material/Speed';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import KeyIcon from '@mui/icons-material/Key';
import BlockIcon from '@mui/icons-material/Block';
import AddIcon from '@mui/icons-material/Add';
import ShieldIcon from '@mui/icons-material/Shield';
import RefreshIcon from '@mui/icons-material/Refresh';
import Swal from 'sweetalert2';

import {
  getChatSettings,
  saveChatSettings,
  getAdminMpin,
  setAdminMpin,
  verifyAdminMpin,
  purgeOldMessages
} from './communityChatService';

export default function CommunitySettingsView() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [settings, setSettings] = useState({
    chatFrozen: false,
    slowModeSeconds: 0,
    bannedKeywords: [],
    mutedUsers: [],
    userPermissions: {}
  });

  const [loading, setLoading] = useState(true);
  const [newKeyword, setNewKeyword] = useState('');

  // M-PIN Management State
  const [currentMpin, setCurrentMpin] = useState(getAdminMpin());
  const [newMpinInput, setNewMpinInput] = useState('');
  const [mpinModalOpen, setMpinModalOpen] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getChatSettings();
      setSettings(data);
    } catch (err) {
      console.error('Failed to load chat settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFreeze = async (checked) => {
    const actionText = checked ? 'FREEZE / LOCK' : 'UNFREEZE';
    const confirm = await Swal.fire({
      title: `${actionText} Community Chat?`,
      text: checked
        ? 'When frozen, regular earners cannot post messages (read-only mode). Only Admins can chat.'
        : 'Earners will be able to chat normally again.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: `Yes, ${actionText}`,
      confirmButtonColor: checked ? '#ef4444' : '#10b981'
    });

    if (confirm.isConfirmed) {
      const updated = { ...settings, chatFrozen: checked };
      setSettings(updated);
      try {
        await saveChatSettings(updated);
        Swal.fire({
          icon: 'success',
          title: `Chat ${checked ? 'Locked' : 'Unlocked'}`,
          text: `Chat is now ${checked ? 'in read-only lockdown mode' : 'unlocked and active'}.`,
          timer: 1500,
          showConfirmButton: false
        });
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Save Failed', text: err.message });
      }
    }
  };

  const handleSlowModeChange = async (seconds) => {
    const updated = { ...settings, slowModeSeconds: Number(seconds) };
    setSettings(updated);
    try {
      await saveChatSettings(updated);
      Swal.fire({
        icon: 'success',
        title: 'Slow Mode Updated',
        text: seconds > 0 ? `Users must wait ${seconds}s between messages.` : 'Slow mode disabled.',
        timer: 1200,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Save Failed', text: err.message });
    }
  };

  const handleAddKeyword = async (e) => {
    if (e) e.preventDefault();
    const word = newKeyword.trim().toLowerCase();
    if (!word) return;

    if (settings.bannedKeywords?.includes(word)) {
      setNewKeyword('');
      return;
    }

    const updatedKeywords = [...(settings.bannedKeywords || []), word];
    const updated = { ...settings, bannedKeywords: updatedKeywords };
    setSettings(updated);
    setNewKeyword('');

    try {
      await saveChatSettings(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveKeyword = async (word) => {
    const updatedKeywords = (settings.bannedKeywords || []).filter((w) => w !== word);
    const updated = { ...settings, bannedKeywords: updatedKeywords };
    setSettings(updated);
    try {
      await saveChatSettings(updated);
    } catch (err) {
      console.error(err);
    }
  };

  // M-PIN Update
  const handleUpdateMpin = () => {
    if (!newMpinInput || newMpinInput.length < 4) {
      Swal.fire({ icon: 'warning', title: 'Invalid PIN', text: 'M-PIN must be at least 4 digits.' });
      return;
    }
    setAdminMpin(newMpinInput);
    setCurrentMpin(newMpinInput);
    setMpinModalOpen(false);
    setNewMpinInput('');
    Swal.fire({ icon: 'success', title: 'M-PIN Changed', text: 'Admin M-PIN updated successfully.' });
  };

  // Buffer Purge
  const handlePurgeBuffer = async (hours = 24) => {
    const { value: pin } = await Swal.fire({
      title: 'Enter Admin M-PIN',
      text: `Confirm purge of community messages older than ${hours} hours to optimize chat latency.`,
      input: 'password',
      inputPlaceholder: 'Enter 4-digit M-PIN',
      showCancelButton: true,
      confirmButtonText: 'Verify & Purge',
      confirmButtonColor: '#ef4444'
    });

    if (pin) {
      if (!verifyAdminMpin(pin)) {
        Swal.fire({ icon: 'error', title: 'Incorrect PIN', text: 'Admin M-PIN does not match.' });
        return;
      }

      try {
        await purgeOldMessages(hours);
        Swal.fire({
          icon: 'success',
          title: 'Buffer Cleaned',
          text: `Messages older than ${hours}h removed. Pinned announcements remain safe.`,
          timer: 2000,
          showConfirmButton: false
        });
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Purge Failed', text: err.message });
      }
    }
  };

  const slowModeOptions = [
    { sec: 0, label: 'Off', desc: 'No Delay' },
    { sec: 10, label: '10s', desc: 'Fast' },
    { sec: 30, label: '30s', desc: 'Standard' },
    { sec: 60, label: '60s', desc: 'Relaxed' },
    { sec: 120, label: '2m', desc: 'Strict' }
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: '24px',
          border: '1px solid',
          borderColor: isDark ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.2)',
          background: isDark
            ? 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(15,23,42,0.85) 100%)'
            : 'linear-gradient(135deg, rgba(236,253,245,0.8) 0%, rgba(255,255,255,0.95) 100%)',
          backdropFilter: 'blur(16px)',
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
              width: 52,
              height: 52,
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 8px 24px rgba(16,185,129,0.35)'
            }}
          >
            <SecurityIcon sx={{ fontSize: 30 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
              Chat Security & Protocol Center
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Emergency lockdowns, slow mode rate-limiting, M-PIN access guards, and storage maintenance.
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Chip
            icon={<ShieldIcon sx={{ fontSize: '1rem !important' }} />}
            label={settings.chatFrozen ? 'Chat Lockdown Active' : 'Chat Engine Active'}
            sx={{
              bgcolor: settings.chatFrozen
                ? isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)'
                : isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)',
              color: settings.chatFrozen ? '#ef4444' : '#10b981',
              fontWeight: 700,
              border: '1px solid',
              borderColor: settings.chatFrozen ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)',
              borderRadius: '12px'
            }}
          />
          <Tooltip title="Refresh Settings">
            <IconButton
              onClick={loadSettings}
              sx={{
                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                borderRadius: '12px',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
              }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      {/* Row 1: Emergency Freeze & Slow Mode */}
      <Grid container spacing={3}>
        {/* Emergency Lockdown Card */}
        <Grid item xs={12} md={6}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: '24px',
              border: '1px solid',
              borderColor: settings.chatFrozen
                ? 'rgba(239,68,68,0.4)'
                : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              bgcolor: settings.chatFrozen
                ? isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.04)'
                : isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
              gap: 2.5
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '14px',
                    bgcolor: settings.chatFrozen ? 'rgba(239,68,68,0.18)' : 'rgba(16,185,129,0.12)',
                    color: settings.chatFrozen ? '#ef4444' : '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {settings.chatFrozen ? <LockIcon /> : <LockOpenIcon />}
                </Box>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    Emergency Lockdown (Freeze Chat)
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    Instant read-only mode across all client devices
                  </Typography>
                </Box>
              </Box>

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.chatFrozen}
                    onChange={(e) => handleToggleFreeze(e.target.checked)}
                    color="error"
                  />
                }
                label=""
                sx={{ m: 0 }}
              />
            </Box>

            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '16px',
                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
              }}
            >
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem', lineHeight: 1.5 }}>
                {settings.chatFrozen
                  ? 'Chat is currently FROZEN. Normal earners are prevented from posting new messages. Only admins can broadcast.'
                  : 'Chat is currently ACTIVE. All verified earners can interact freely subject to moderation rules.'}
              </Typography>
            </Paper>
          </Paper>
        </Grid>

        {/* Slow Mode Rate Limiting */}
        <Grid item xs={12} md={6}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: '24px',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
              gap: 2
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '14px',
                  bgcolor: 'rgba(59,130,246,0.12)',
                  color: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <SpeedIcon />
              </Box>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Slow Mode Cooldown
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Prevent message spamming with delay intervals
                </Typography>
              </Box>
            </Box>

            {/* Pill Selector */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1 }}>
              {slowModeOptions.map((opt) => {
                const isSelected = Number(settings.slowModeSeconds || 0) === opt.sec;
                return (
                  <Button
                    key={opt.sec}
                    onClick={() => handleSlowModeChange(opt.sec)}
                    sx={{
                      py: 1,
                      px: 0.5,
                      borderRadius: '14px',
                      textTransform: 'none',
                      flexDirection: 'column',
                      border: '1.5px solid',
                      borderColor: isSelected ? '#3b82f6' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                      bgcolor: isSelected
                        ? isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.12)'
                        : isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                      color: isSelected ? '#3b82f6' : 'text.primary',
                      '&:hover': {
                        borderColor: '#3b82f6',
                        bgcolor: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)'
                      }
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: '0.82rem' }}>
                      {opt.label}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                      {opt.desc}
                    </Typography>
                  </Button>
                );
              })}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Row 2: Banned Keywords Blacklist */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: '24px',
          border: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '14px',
                bgcolor: 'rgba(239,68,68,0.12)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <BlockIcon />
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                Automated Safety Guard: Forbidden Keywords
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Messages containing any of these words or links are automatically blocked by the chat engine.
              </Typography>
            </Box>
          </Box>
          <Chip
            label={`${(settings.bannedKeywords || []).length} Banned Keywords`}
            size="small"
            sx={{
              bgcolor: 'rgba(239,68,68,0.1)',
              color: '#ef4444',
              fontWeight: 800,
              fontSize: '0.72rem',
              borderRadius: '8px'
            }}
          />
        </Box>

        {/* Add Keyword Box */}
        <Box component="form" onSubmit={handleAddKeyword} sx={{ display: 'flex', gap: 1.5, maxWidth: 500 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Add word or phrase (e.g. 'whatsapp', 't.me', 'payment')..."
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '14px',
                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
              }
            }}
          />
          <Button
            type="submit"
            variant="contained"
            startIcon={<AddIcon />}
            sx={{
              borderRadius: '14px',
              px: 3,
              fontWeight: 700,
              textTransform: 'none',
              bgcolor: 'primary.main',
              boxShadow: 'none'
            }}
          >
            Add
          </Button>
        </Box>

        {/* Keywords Chips */}
        <Box
          sx={{
            p: 2,
            borderRadius: '18px',
            bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
            border: '1px dashed',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            display: 'flex',
            gap: 1,
            flexWrap: 'wrap',
            minHeight: 64,
            alignItems: 'center'
          }}
        >
          {(settings.bannedKeywords || []).length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No forbidden keywords registered. Enter keywords above to auto-filter inappropriate content.
            </Typography>
          ) : (
            (settings.bannedKeywords || []).map((word) => (
              <Chip
                key={word}
                label={word}
                onDelete={() => handleRemoveKeyword(word)}
                sx={{
                  fontWeight: 700,
                  borderRadius: '10px',
                  bgcolor: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)',
                  color: '#ef4444',
                  border: '1px solid rgba(239,68,68,0.3)',
                  '& .MuiChip-deleteIcon': {
                    color: '#ef4444',
                    '&:hover': { color: '#dc2626' }
                  }
                }}
              />
            ))
          )}
        </Box>
      </Paper>

      {/* Row 3: Admin Security M-PIN & Ephemeral Buffer Maintenance */}
      <Grid container spacing={3}>
        {/* Admin M-PIN Authorization */}
        <Grid item xs={12} md={6}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: '24px',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
              gap: 2.5
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '14px',
                  bgcolor: 'rgba(37,99,235,0.12)',
                  color: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <KeyIcon />
              </Box>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Admin Security M-PIN
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  2-Factor guard for critical chat deletions and purges
                </Typography>
              </Box>
            </Box>

            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '16px',
                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontWeight: 700 }}>
                  STATUS
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#10b981' }}>
                  Active & Encrypted (••••)
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setMpinModalOpen(true)}
                sx={{
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 700,
                  borderWidth: '1.5px',
                  '&:hover': { borderWidth: '1.5px' }
                }}
              >
                Change PIN
              </Button>
            </Paper>
          </Paper>
        </Grid>

        {/* Database Maintenance & Buffer Purge */}
        <Grid item xs={12} md={6}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: '24px',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
              gap: 2.5
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '14px',
                  bgcolor: 'rgba(239,68,68,0.12)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <DeleteSweepIcon />
              </Box>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Ephemeral Buffer Maintenance
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Keep chat memory light and fast for mobile apps
                </Typography>
              </Box>
            </Box>

            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '16px',
                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontWeight: 700 }}>
                  AUTO RETENTION
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  Older than 24 Hours
                </Typography>
              </Box>
              <Button
                variant="contained"
                color="error"
                size="small"
                onClick={() => handlePurgeBuffer(24)}
                sx={{
                  borderRadius: '12px',
                  fontWeight: 800,
                  textTransform: 'none',
                  px: 2,
                  boxShadow: 'none'
                }}
              >
                Purge Buffer (24h+)
              </Button>
            </Paper>
          </Paper>
        </Grid>
      </Grid>

      {/* Change M-PIN Dialog */}
      <Dialog
        open={mpinModalOpen}
        onClose={() => setMpinModalOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '24px',
            p: 1.5,
            minWidth: 360,
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
            bgcolor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(20px)'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: '12px',
              bgcolor: 'rgba(37,99,235,0.12)',
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <KeyIcon fontSize="small" />
          </Box>
          Update Admin M-PIN
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Set a 4 to 6 digit numerical PIN to authorize sensitive moderator operations such as message purging.
          </Typography>
          <TextField
            size="small"
            type="password"
            label="New 4-6 Digit M-PIN"
            fullWidth
            inputProps={{ maxLength: 6 }}
            value={newMpinInput}
            onChange={(e) => setNewMpinInput(e.target.value.replace(/\D/g, ''))}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '14px',
                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setMpinModalOpen(false)} sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdateMpin}
            sx={{
              borderRadius: '12px',
              fontWeight: 800,
              textTransform: 'none',
              px: 3,
              boxShadow: 'none'
            }}
          >
            Save PIN
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
