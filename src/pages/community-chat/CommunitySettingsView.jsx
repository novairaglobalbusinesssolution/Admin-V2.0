import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, TextField, Button,
  Switch, FormControlLabel, RadioGroup, Radio,
  Chip, Stack, CircularProgress, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions,
  useTheme
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import LockIcon from '@mui/icons-material/Lock';
import SpeedIcon from '@mui/icons-material/Speed';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import KeyIcon from '@mui/icons-material/Key';
import BlockIcon from '@mui/icons-material/Block';
import AddIcon from '@mui/icons-material/Add';
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
  const [saving, setSaving] = useState(false);
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
        ? 'When frozen, regular earners cannot type messages (read-only mode). Only Admins can chat.'
        : 'Earners will be able to chat normally again.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: `Yes, ${actionText}`,
      confirmButtonColor: checked ? '#ef4444' : '#22c55e'
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
      text: `Confirm purge of community messages older than ${hours} hours to keep database fast.`,
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: '22px',
          border: `1px solid ${theme.palette.divider}`,
          background: isDark
            ? 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(15,23,42,0.9) 100%)'
            : 'linear-gradient(135deg, rgba(236,253,245,0.8) 0%, rgba(255,255,255,0.95) 100%)',
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '16px',
            bgcolor: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 8px 20px rgba(16,185,129,0.3)'
          }}
        >
          <SecurityIcon sx={{ fontSize: 28 }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Chat Security & Control Center</Typography>
          <Typography variant="body2" color="text.secondary">
            Emergency chat lockdown, slow mode cooldowns, admin M-PIN authorization, and buffer maintenance.
          </Typography>
        </Box>
      </Paper>

      {/* Emergency Lockdown Card */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: '24px',
          border: `1px solid ${settings.chatFrozen ? '#ef4444' : theme.palette.divider}`,
          bgcolor: 'background.paper',
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
              width: 44,
              height: 44,
              borderRadius: '14px',
              bgcolor: settings.chatFrozen ? 'rgba(239,68,68,0.15)' : 'rgba(148,163,184,0.12)',
              color: settings.chatFrozen ? '#ef4444' : 'text.secondary',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <LockIcon />
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              Emergency Chat Lockdown (Freeze Chat)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {settings.chatFrozen
                ? 'Chat is currently FROZEN. Normal earners are prevented from posting.'
                : 'Chat is currently OPEN. All active community earners can message.'}
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
          label={<Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{settings.chatFrozen ? 'FROZEN' : 'ACTIVE'}</Typography>}
        />
      </Paper>

      {/* Slow Mode Rate Limiting */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: '24px',
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <SpeedIcon sx={{ color: 'primary.main' }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Slow Mode (Message Cooldown)</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Prevent spamming by requiring earners to wait a specified cooldown period between consecutive messages.
        </Typography>

        <RadioGroup
          row
          value={String(settings.slowModeSeconds || 0)}
          onChange={(e) => handleSlowModeChange(e.target.value)}
        >
          <FormControlLabel value="0" control={<Radio size="small" />} label="Off (Instant)" />
          <FormControlLabel value="10" control={<Radio size="small" />} label="10 Seconds" />
          <FormControlLabel value="30" control={<Radio size="small" />} label="30 Seconds" />
          <FormControlLabel value="60" control={<Radio size="small" />} label="60 Seconds" />
          <FormControlLabel value="120" control={<Radio size="small" />} label="2 Minutes" />
        </RadioGroup>
      </Paper>

      {/* Admin M-PIN Authorization */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: '24px',
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: 'background.paper',
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
              width: 44,
              height: 44,
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
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Admin Security M-PIN</Typography>
            <Typography variant="body2" color="text.secondary">
              Protects sensitive actions such as message buffer purge and critical moderation. Current M-PIN: ••••
            </Typography>
          </Box>
        </Box>

        <Button
          variant="outlined"
          size="small"
          onClick={() => setMpinModalOpen(true)}
          sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
        >
          Change Admin M-PIN
        </Button>
      </Paper>

      {/* Banned Keywords Blacklist */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: '24px',
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <BlockIcon sx={{ color: 'error.main' }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Forbidden Keywords Blacklist</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Messages containing these keywords or phrases are automatically filtered and blocked by the safety guard.
        </Typography>

        <Box component="form" onSubmit={handleAddKeyword} sx={{ display: 'flex', gap: 1.5, maxWidth: 440 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Add word or phrase (e.g. 'whatsapp', 't.me')..."
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
          />
          <Button
            type="submit"
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ borderRadius: '12px', px: 2.5, fontWeight: 700, textTransform: 'none', boxShadow: 'none' }}
          >
            Add
          </Button>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', pt: 1 }}>
          {(settings.bannedKeywords || []).map((word) => (
            <Chip
              key={word}
              label={word}
              onDelete={() => handleRemoveKeyword(word)}
              color="error"
              variant="outlined"
              sx={{ fontWeight: 700, borderRadius: '10px' }}
            />
          ))}
        </Box>
      </Paper>

      {/* Database Maintenance & Buffer Purge */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: '24px',
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: 'background.paper',
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
              width: 44,
              height: 44,
              borderRadius: '14px',
              bgcolor: 'rgba(239,68,68,0.1)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <DeleteSweepIcon />
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Ephemeral Buffer Maintenance</Typography>
            <Typography variant="body2" color="text.secondary">
              Purge chat messages older than 24 hours to ensure 0-lag performance on the mobile app.
            </Typography>
          </Box>
        </Box>

        <Button
          variant="contained"
          color="error"
          onClick={() => handlePurgeBuffer(24)}
          sx={{ borderRadius: '12px', fontWeight: 800, textTransform: 'none', px: 2.5, boxShadow: 'none' }}
        >
          Clean Buffer (24h+)
        </Button>
      </Paper>

      {/* Change M-PIN Dialog */}
      <Dialog
        open={mpinModalOpen}
        onClose={() => setMpinModalOpen(false)}
        PaperProps={{ sx: { borderRadius: '22px', p: 1, minWidth: 340 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Update Admin M-PIN</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Set a 4 to 6 digit numerical PIN for verifying sensitive admin chat actions.
          </Typography>
          <TextField
            size="small"
            type="password"
            label="New M-PIN"
            fullWidth
            inputProps={{ maxLength: 6 }}
            value={newMpinInput}
            onChange={(e) => setNewMpinInput(e.target.value.replace(/\D/g, ''))}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setMpinModalOpen(false)} sx={{ borderRadius: '12px', textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdateMpin}
            sx={{ borderRadius: '12px', fontWeight: 800, textTransform: 'none', px: 2.5 }}
          >
            Save PIN
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
