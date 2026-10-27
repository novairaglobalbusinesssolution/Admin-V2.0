import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, TextField, Button,
  Chip, CircularProgress, RadioGroup, FormControlLabel,
  Radio, useTheme
} from '@mui/material';
import PushPinIcon from '@mui/icons-material/PushPin';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Swal from 'sweetalert2';

import { getActivePinnedNotice, pinNotice, unpinNotice } from './communityChatService';

export default function CommunityPinnedView() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [activePin, setActivePin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('Welcome to Novaira Official Community Lounge');
  const [message, setMessage] = useState('Please respect all fellow earners. Sharing phone numbers, WhatsApp links, or vulgar words is strictly prohibited and results in immediate automated ban.');
  const [urgency, setUrgency] = useState('info');

  useEffect(() => {
    loadActivePin();
  }, []);

  const loadActivePin = async () => {
    setLoading(true);
    try {
      const pin = await getActivePinnedNotice();
      setActivePin(pin);
    } catch (err) {
      console.error('Failed to load pinned notice:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePin = async (e) => {
    if (e) e.preventDefault();
    if (!message.trim()) {
      Swal.fire({ icon: 'warning', title: 'Content Required', text: 'Please enter the announcement text.' });
      return;
    }

    setSaving(true);
    try {
      await pinNotice({
        title: title.trim(),
        message: message.trim(),
        level: urgency
      });
      Swal.fire({
        icon: 'success',
        title: 'Notice Pinned!',
        text: 'This announcement is now pinned sticky at the top of the community lounge in the app.',
        timer: 1800,
        showConfirmButton: false
      });
      loadActivePin();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Pin Failed', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleUnpin = async () => {
    const confirm = await Swal.fire({
      title: 'Unpin Active Notice?',
      text: 'This will remove the sticky banner from the community chat screen.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Unpin',
      confirmButtonColor: '#ec4899'
    });

    if (confirm.isConfirmed) {
      try {
        await unpinNotice(activePin?.rowId);
        setActivePin(null);
        Swal.fire({ icon: 'success', title: 'Unpinned', text: 'Notice removed.', timer: 1200, showConfirmButton: false });
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Unpin Failed', text: err.message });
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
            ? 'linear-gradient(135deg, rgba(236,72,153,0.12) 0%, rgba(15,23,42,0.9) 100%)'
            : 'linear-gradient(135deg, rgba(253,242,248,0.7) 0%, rgba(255,255,255,0.95) 100%)',
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
            bgcolor: '#ec4899',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 8px 20px rgba(236,72,153,0.3)'
          }}
        >
          <PushPinIcon sx={{ fontSize: 28 }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Pinned Sticky Notices</Typography>
          <Typography variant="body2" color="text.secondary">
            Pin important announcements, rules, or system updates at the top of the mobile community chat.
          </Typography>
        </Box>
      </Paper>

      {/* Active Pinned Notice Card */}
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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Currently Active Pinned Notice</Typography>
          {activePin && (
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<DeleteOutlineIcon />}
              onClick={handleUnpin}
              sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
            >
              Unpin Notice
            </Button>
          )}
        </Box>

        {loading ? (
          <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress size={28} /></Box>
        ) : !activePin ? (
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: '18px',
              bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              textAlign: 'center'
            }}
          >
            <Typography variant="body2" color="text.secondary">
              No notice is currently pinned. Compose a new announcement below to stick it to the top of the chat.
            </Typography>
          </Paper>
        ) : (
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '20px',
              border: `1px solid ${activePin.level === 'urgent' ? '#ef4444' : activePin.level === 'warning' ? '#f59e0b' : '#3b82f6'}`,
              background: isDark
                ? 'linear-gradient(135deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.85) 100%)'
                : 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.06)'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <PushPinIcon sx={{ color: '#ec4899', fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{activePin.title}</Typography>
              <Box sx={{ flex: 1 }} />
              <Chip
                label={activePin.level?.toUpperCase() || 'INFO'}
                size="small"
                color={activePin.level === 'urgent' ? 'error' : activePin.level === 'warning' ? 'warning' : 'primary'}
                sx={{ height: 20, fontSize: '0.65rem', fontWeight: 800 }}
              />
            </Box>
            <Typography variant="body2" sx={{ color: 'text.primary', lineHeight: 1.5 }}>
              {activePin.message}
            </Typography>
            {activePin.pinnedAt && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                Pinned on {new Date(activePin.pinnedAt).toLocaleString()}
              </Typography>
            )}
          </Paper>
        )}
      </Paper>

      {/* Compose Form */}
      <Paper
        elevation={0}
        component="form"
        onSubmit={handleSavePin}
        sx={{
          p: 3,
          borderRadius: '24px',
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Create / Replace Pinned Announcement</Typography>

        <TextField
          size="small"
          label="Notice Title"
          fullWidth
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
        />

        <TextField
          size="small"
          label="Announcement Text"
          fullWidth
          multiline
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
        />

        <Box>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
            Urgency / Banner Color
          </Typography>
          <RadioGroup row value={urgency} onChange={(e) => setUrgency(e.target.value)}>
            <FormControlLabel value="info" control={<Radio size="small" />} label="Information (Blue)" />
            <FormControlLabel value="warning" control={<Radio size="small" />} label="Important (Amber)" />
            <FormControlLabel value="urgent" control={<Radio size="small" />} label="Urgent Alert (Red)" />
          </RadioGroup>
        </Box>

        <Button
          type="submit"
          variant="contained"
          disabled={saving}
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <PushPinIcon />}
          sx={{
            borderRadius: '14px',
            py: 1.2,
            bgcolor: '#ec4899',
            fontWeight: 800,
            textTransform: 'none',
            boxShadow: '0 8px 20px rgba(236,72,153,0.25)',
            '&:hover': { bgcolor: '#db2777' }
          }}
        >
          Pin Notice to Community Lounge
        </Button>
      </Paper>
    </Box>
  );
}
