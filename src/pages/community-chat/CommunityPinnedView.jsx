import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, TextField, Button,
  Chip, CircularProgress, useTheme, Grid, Stack, Tooltip, IconButton
} from '@mui/material';
import PushPinIcon from '@mui/icons-material/PushPin';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import InfoIcon from '@mui/icons-material/Info';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorIcon from '@mui/icons-material/Error';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RefreshIcon from '@mui/icons-material/Refresh';
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

  const urgencyLevels = [
    {
      id: 'info',
      label: 'Information',
      desc: 'General updates & news',
      color: '#3b82f6',
      icon: <InfoIcon fontSize="small" sx={{ color: '#3b82f6' }} />
    },
    {
      id: 'warning',
      label: 'Important',
      desc: 'Action required & rules',
      color: '#f59e0b',
      icon: <WarningAmberIcon fontSize="small" sx={{ color: '#f59e0b' }} />
    },
    {
      id: 'urgent',
      label: 'Urgent Alert',
      desc: 'Emergency announcements',
      color: '#ef4444',
      icon: <ErrorIcon fontSize="small" sx={{ color: '#ef4444' }} />
    }
  ];

  const getUrgencyConfig = (level) => {
    switch (level) {
      case 'urgent':
        return { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', label: 'URGENT ALERT' };
      case 'warning':
        return { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', label: 'IMPORTANT' };
      default:
        return { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)', label: 'INFO UPDATE' };
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: '24px',
          border: '1px solid',
          borderColor: isDark ? 'rgba(236,72,153,0.25)' : 'rgba(236,72,153,0.2)',
          background: isDark
            ? 'linear-gradient(135deg, rgba(236,72,153,0.12) 0%, rgba(15,23,42,0.85) 100%)'
            : 'linear-gradient(135deg, rgba(253,242,248,0.7) 0%, rgba(255,255,255,0.95) 100%)',
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
              background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 8px 24px rgba(236,72,153,0.35)'
            }}
          >
            <PushPinIcon sx={{ fontSize: 30 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
              Pinned Sticky Notices
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Pin announcements, rules, or system updates at the top of the mobile community chat.
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Chip
            icon={<PushPinIcon sx={{ fontSize: '1rem !important' }} />}
            label={activePin ? 'Active Notice Live' : 'No Active Notice'}
            sx={{
              bgcolor: activePin
                ? isDark ? 'rgba(236,72,153,0.15)' : 'rgba(236,72,153,0.1)'
                : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              color: activePin ? '#ec4899' : 'text.secondary',
              fontWeight: 700,
              border: '1px solid',
              borderColor: activePin ? 'rgba(236,72,153,0.3)' : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              borderRadius: '12px'
            }}
          />
          <Tooltip title="Refresh Active Pin">
            <IconButton
              onClick={loadActivePin}
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

      {/* Active Pinned Notice Card */}
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
          gap: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PushPinIcon sx={{ color: '#ec4899', fontSize: 20 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              Currently Active Sticky Banner
            </Typography>
          </Box>
          {activePin && (
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<DeleteOutlineIcon />}
              onClick={handleUnpin}
              sx={{
                borderRadius: '12px',
                textTransform: 'none',
                fontWeight: 700,
                borderWidth: '1.5px',
                '&:hover': { borderWidth: '1.5px' }
              }}
            >
              Unpin Notice
            </Button>
          )}
        </Box>

        {loading ? (
          <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={30} />
          </Box>
        ) : !activePin ? (
          <Paper
            elevation={0}
            sx={{
              p: 3.5,
              borderRadius: '20px',
              bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              border: '1px dashed',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              textAlign: 'center'
            }}
          >
            <Typography variant="body2" color="text.secondary">
              No notice is currently pinned. Compose a new announcement below to stick it to the top of the chat in user apps.
            </Typography>
          </Paper>
        ) : (
          (() => {
            const cfg = getUrgencyConfig(activePin.level);
            return (
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: '20px',
                  border: `1px solid ${cfg.border}`,
                  background: isDark
                    ? `linear-gradient(135deg, ${cfg.bg} 0%, rgba(15,23,42,0.9) 100%)`
                    : `linear-gradient(135deg, #ffffff 0%, ${cfg.bg} 100%)`,
                  boxShadow: `0 8px 24px rgba(0,0,0,0.15)`
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '10px',
                      bgcolor: cfg.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff'
                    }}
                  >
                    <PushPinIcon sx={{ fontSize: 18 }} />
                  </Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary' }}>
                    {activePin.title}
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  <Chip
                    label={cfg.label}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      bgcolor: cfg.color,
                      color: '#fff',
                      borderRadius: '8px'
                    }}
                  />
                </Box>
                <Typography variant="body2" sx={{ color: 'text.primary', lineHeight: 1.6, pl: 0.5 }}>
                  {activePin.message}
                </Typography>
                {activePin.pinnedAt && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1.5, pl: 0.5 }}>
                    Pinned on {new Date(activePin.pinnedAt).toLocaleString()}
                  </Typography>
                )}
              </Paper>
            );
          })()
        )}
      </Paper>

      {/* Compose Form & Live Simulator */}
      <Grid container spacing={3}>
        {/* Form Column */}
        <Grid item xs={12} lg={7}>
          <Paper
            elevation={0}
            component="form"
            onSubmit={handleSavePin}
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AutoAwesomeIcon sx={{ color: '#ec4899', fontSize: 20 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                Create / Replace Pinned Announcement
              </Typography>
            </Box>

            <TextField
              size="small"
              label="Notice Title"
              fullWidth
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '14px',
                  bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                }
              }}
            />

            <TextField
              size="small"
              label="Announcement Text"
              fullWidth
              multiline
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '14px',
                  bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                }
              }}
            />

            {/* Urgency Selector Cards */}
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, mb: 1, display: 'block' }}>
                PRIORITY & HIGHLIGHT THEME
              </Typography>
              <Grid container spacing={1.5}>
                {urgencyLevels.map((lvl) => {
                  const isSelected = urgency === lvl.id;
                  return (
                    <Grid item xs={12} sm={4} key={lvl.id}>
                      <Paper
                        elevation={0}
                        onClick={() => setUrgency(lvl.id)}
                        sx={{
                          p: 1.5,
                          borderRadius: '16px',
                          cursor: 'pointer',
                          border: '2px solid',
                          borderColor: isSelected ? lvl.color : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                          bgcolor: isSelected
                            ? isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'
                            : isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          '&:hover': {
                            borderColor: lvl.color
                          }
                        }}
                      >
                        {lvl.icon}
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: '0.85rem' }}>
                            {lvl.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.72rem' }}>
                            {lvl.desc}
                          </Typography>
                        </Box>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>

            <Button
              type="submit"
              variant="contained"
              disabled={saving}
              startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <PushPinIcon />}
              sx={{
                background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                color: '#fff',
                borderRadius: '14px',
                py: 1.3,
                fontWeight: 800,
                textTransform: 'none',
                boxShadow: '0 8px 24px rgba(236,72,153,0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #f472b6 0%, #be185d 100%)',
                  boxShadow: '0 12px 28px rgba(236,72,153,0.45)'
                }
              }}
            >
              {saving ? 'Pinning Notice...' : 'Pin Notice to Community Lounge'}
            </Button>
          </Paper>
        </Grid>

        {/* Live Mobile Sticky Simulation */}
        <Grid item xs={12} lg={5}>
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
              gap: 2
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SmartphoneIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  Sticky Banner Simulation
                </Typography>
              </Box>
              <Chip
                label="CLIENT APP PREVIEW"
                size="small"
                sx={{
                  bgcolor: 'rgba(236,72,153,0.1)',
                  color: '#ec4899',
                  fontWeight: 800,
                  fontSize: '0.65rem',
                  borderRadius: '8px'
                }}
              />
            </Box>

            {/* Mobile Viewport Simulation */}
            <Box
              sx={{
                p: 2.5,
                borderRadius: '24px',
                border: '2px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                background: isDark
                  ? 'linear-gradient(180deg, #0b1120 0%, #030712 100%)'
                  : 'linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%)',
                boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.2), 0 16px 36px rgba(0,0,0,0.2)'
              }}
            >
              {/* Speaker Notch */}
              <Box
                sx={{
                  width: 60,
                  height: 4,
                  bgcolor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                  borderRadius: '4px',
                  mx: 'auto',
                  mb: 2
                }}
              />

              {/* Chat Header Mock */}
              <Box sx={{ px: 1, py: 1, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#10b981' }} />
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.primary' }}>
                  Novaira Official Lounge
                </Typography>
              </Box>

              {/* Live Sticky Notice Simulation */}
              {(() => {
                const cfg = getUrgencyConfig(urgency);
                return (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: '16px',
                      border: `1.5px solid ${cfg.border}`,
                      background: isDark
                        ? `linear-gradient(135deg, ${cfg.bg} 0%, rgba(15,23,42,0.95) 100%)`
                        : `linear-gradient(135deg, #ffffff 0%, ${cfg.bg} 100%)`,
                      boxShadow: '0 8px 20px rgba(0,0,0,0.2)'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <PushPinIcon sx={{ fontSize: 16, color: '#ec4899' }} />
                      <Typography variant="caption" sx={{ fontWeight: 800, color: cfg.color, fontSize: '0.75rem' }}>
                        {title || 'Notice Title'}
                      </Typography>
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.primary',
                        display: 'block',
                        lineHeight: 1.4,
                        fontSize: '0.75rem'
                      }}
                    >
                      {message || 'Announcement message preview will appear here...'}
                    </Typography>
                  </Paper>
                );
              })()}

              {/* Simulated chat message below sticky */}
              <Box sx={{ mt: 2, p: 1.5, borderRadius: '14px', bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', maxWidth: '80%' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                  Earner #2841: Thanks for the update admin!
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
