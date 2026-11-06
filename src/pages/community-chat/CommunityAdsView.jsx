import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, TextField, Button,
  Grid, Card, CardMedia, CardContent, CardActions,
  Chip, IconButton, CircularProgress, Stack,
  useTheme, Divider, Tooltip
} from '@mui/material';
import CampaignIcon from '@mui/icons-material/Campaign';
import SendIcon from '@mui/icons-material/Send';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LayersIcon from '@mui/icons-material/Layers';
import RefreshIcon from '@mui/icons-material/Refresh';
import Swal from 'sweetalert2';

import { broadcastAd, fetchAdsHistory, deleteMessage } from './communityChatService';

export default function CommunityAdsView() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [form, setForm] = useState({
    title: 'Weekend Mega Bonus: Earn 2X Coins Today!',
    description: 'Submit 5 app review tasks before midnight and get instant Rs. 50 cash bonus added straight to your Novaira wallet!',
    imageUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=600&auto=format&fit=crop&q=80',
    ctaText: 'Claim Bonus Now',
    ctaUrl: 'https://novairaglobal.com',
    badge: 'Sponsored Promo'
  });

  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await fetchAdsHistory();
      setHistory(data);
    } catch (err) {
      console.error('Failed to load ads history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleBroadcast = async (e) => {
    if (e) e.preventDefault();
    if (!form.title.trim()) {
      Swal.fire({ icon: 'warning', title: 'Title Required', text: 'Please enter a title for the promo ad.' });
      return;
    }

    const confirm = await Swal.fire({
      title: 'Broadcast Ad to Lounge?',
      text: 'This sponsored promotional card will be broadcasted live to all community chat users.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Broadcast Now',
      confirmButtonColor: '#f59e0b'
    });

    if (!confirm.isConfirmed) return;

    setLoading(true);
    try {
      await broadcastAd(form);
      Swal.fire({
        icon: 'success',
        title: 'Ad Broadcasted!',
        text: 'The promotional ad has been delivered to the community lounge.',
        timer: 1800,
        showConfirmButton: false
      });
      loadHistory();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Broadcast Failed', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAd = async (ad) => {
    const confirm = await Swal.fire({
      title: 'Delete Ad from Lounge?',
      text: 'This ad card will be removed from community chat on all devices.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      confirmButtonColor: '#ef4444'
    });

    if (confirm.isConfirmed) {
      try {
        await deleteMessage(ad.rowId);
        setHistory((prev) => prev.filter((a) => a.rowId !== ad.rowId));
        Swal.fire({ icon: 'success', title: 'Deleted', text: 'Ad removed.', timer: 1200, showConfirmButton: false });
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Delete Failed', text: err.message });
      }
    }
  };

  const handleRebroadcast = (ad) => {
    setForm({
      title: ad.title || '',
      description: ad.description || '',
      imageUrl: ad.imageUrl || '',
      ctaText: ad.ctaText || 'Learn More',
      ctaUrl: ad.ctaUrl || '',
      badge: ad.sender_badge || 'Sponsored Promo'
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const badgeOptions = ['Sponsored Promo', 'Flash Deal', 'Limited Offer', 'Community Reward', 'Exclusive Update'];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Top Header Card */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: '24px',
          border: '1px solid',
          borderColor: isDark ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.2)',
          background: isDark
            ? 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(15,23,42,0.85) 100%)'
            : 'linear-gradient(135deg, rgba(254,243,199,0.7) 0%, rgba(255,255,255,0.95) 100%)',
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
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000',
              boxShadow: '0 8px 24px rgba(245,158,11,0.35)'
            }}
          >
            <CampaignIcon sx={{ fontSize: 30 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
              Sponsored Campaigns & In-Chat Ads
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Broadcast rich promotional cards directly into the Community Lounge with 1-click CTA triggers.
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Chip
            icon={<LayersIcon sx={{ fontSize: '1rem !important' }} />}
            label={`${history.length} Broadcasted`}
            sx={{
              bgcolor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)',
              color: '#f59e0b',
              fontWeight: 700,
              border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: '12px'
            }}
          />
          <Tooltip title="Refresh Ads History">
            <IconButton
              onClick={loadHistory}
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

      <Grid container spacing={3}>
        {/* Ad Creator Form */}
        <Grid item xs={12} lg={7}>
          <Paper
            elevation={0}
            component="form"
            onSubmit={handleBroadcast}
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
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AutoAwesomeIcon sx={{ color: '#f59e0b', fontSize: 20 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Compose In-Chat Broadcast
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                Live App Broadcast
              </Typography>
            </Box>

            {/* Badge Picker */}
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, mb: 1, display: 'block' }}>
                SPONSORSHIP BADGE
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {badgeOptions.map((b) => {
                  const isSelected = form.badge === b;
                  return (
                    <Chip
                      key={b}
                      label={b}
                      clickable
                      onClick={() => setForm({ ...form, badge: b })}
                      sx={{
                        fontWeight: 700,
                        borderRadius: '10px',
                        px: 0.5,
                        bgcolor: isSelected
                          ? '#f59e0b'
                          : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                        color: isSelected ? '#000' : 'text.primary',
                        border: '1px solid',
                        borderColor: isSelected ? '#f59e0b' : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        '&:hover': {
                          bgcolor: isSelected ? '#d97706' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'
                        }
                      }}
                    />
                  );
                })}
              </Box>
            </Box>

            <TextField
              size="small"
              label="Ad Title"
              fullWidth
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '14px',
                  bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                }
              }}
            />

            <TextField
              size="small"
              label="Ad Description / Details"
              fullWidth
              multiline
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '14px',
                  bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                }
              }}
            />

            <TextField
              size="small"
              label="Banner Media URL (Optional)"
              fullWidth
              placeholder="https://... (.jpg, .png, .webp)"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '14px',
                  bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                }
              }}
            />

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  size="small"
                  label="Button CTA Label"
                  fullWidth
                  placeholder="e.g. Claim Bonus, Install App"
                  value={form.ctaText}
                  onChange={(e) => setForm({ ...form, ctaText: e.target.value })}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '14px',
                      bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  size="small"
                  label="Target Action URL"
                  fullWidth
                  placeholder="https://..."
                  value={form.ctaUrl}
                  onChange={(e) => setForm({ ...form, ctaUrl: e.target.value })}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '14px',
                      bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                    }
                  }}
                />
              </Grid>
            </Grid>

            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
              sx={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#000',
                borderRadius: '14px',
                py: 1.3,
                fontWeight: 800,
                textTransform: 'none',
                boxShadow: '0 8px 24px rgba(245,158,11,0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #fbbf24 0%, #b45309 100%)',
                  boxShadow: '0 12px 28px rgba(245,158,11,0.45)'
                }
              }}
            >
              {loading ? 'Broadcasting...' : 'Broadcast Ad to Community Lounge'}
            </Button>
          </Paper>
        </Grid>

        {/* Live Mobile Device Preview */}
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
                  Mobile Device Mockup
                </Typography>
              </Box>
              <Chip
                label="LIVE SIMULATION"
                size="small"
                sx={{
                  bgcolor: 'rgba(37,99,235,0.1)',
                  color: '#3b82f6',
                  fontWeight: 800,
                  fontSize: '0.65rem',
                  borderRadius: '8px'
                }}
              />
            </Box>

            {/* Simulated Phone Shell */}
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

              {/* Chat Bubble Container */}
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor: isDark ? 'rgba(245,158,11,0.4)' : '#f59e0b',
                  background: isDark
                    ? 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(30,41,59,0.9) 100%)'
                    : 'linear-gradient(135deg, #fffbeb 0%, #ffffff 100%)',
                  boxShadow: '0 12px 28px rgba(245,158,11,0.2)'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Chip
                    label={form.badge}
                    size="small"
                    sx={{
                      bgcolor: '#f59e0b',
                      color: '#000',
                      fontWeight: 800,
                      fontSize: '0.68rem',
                      height: 22,
                      borderRadius: '8px'
                    }}
                  />
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                    Just now
                  </Typography>
                </Box>

                {form.imageUrl && (
                  <Box
                    component="img"
                    src={form.imageUrl}
                    alt="preview"
                    onError={(e) => { e.target.style.display = 'none'; }}
                    sx={{
                      width: '100%',
                      maxHeight: 160,
                      objectFit: 'cover',
                      borderRadius: '14px',
                      mb: 1.5,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                  />
                )}

                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 800,
                    color: isDark ? '#fbbf24' : '#b45309',
                    lineHeight: 1.3,
                    mb: 0.5
                  }}
                >
                  {form.title || 'Untitled Promo'}
                </Typography>

                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.primary',
                    fontSize: '0.82rem',
                    lineHeight: 1.5,
                    mb: 1.5
                  }}
                >
                  {form.description || 'Ad description will appear here...'}
                </Typography>

                {form.ctaUrl && (
                  <Button
                    fullWidth
                    variant="contained"
                    size="small"
                    endIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
                    sx={{
                      borderRadius: '12px',
                      bgcolor: '#f59e0b',
                      color: '#000',
                      fontWeight: 800,
                      textTransform: 'none',
                      py: 0.9,
                      boxShadow: '0 4px 12px rgba(245,158,11,0.25)',
                      '&:hover': { bgcolor: '#d97706' }
                    }}
                  >
                    {form.ctaText || 'Open Action'}
                  </Button>
                )}
              </Paper>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Previously Broadcasted Ads History */}
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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              Broadcast History & Active Ads
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Review and manage existing promotional items broadcasted in the community lounge.
            </Typography>
          </Box>
        </Box>

        {historyLoading ? (
          <Box sx={{ p: 6, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={32} />
          </Box>
        ) : history.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: 4,
              borderRadius: '18px',
              textAlign: 'center',
              bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              border: '1px dashed',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
            }}
          >
            <Typography variant="body2" color="text.secondary">
              No sponsored ads broadcasted yet. Create your first campaign above!
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={2.5}>
            {history.map((ad) => (
              <Grid item xs={12} sm={6} md={4} key={ad.rowId}>
                <Card
                  elevation={0}
                  sx={{
                    borderRadius: '20px',
                    border: '1px solid',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                    backdropFilter: 'blur(12px)',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-3px)',
                      boxShadow: '0 12px 24px rgba(0,0,0,0.15)'
                    }
                  }}
                >
                  {ad.imageUrl && (
                    <CardMedia
                      component="img"
                      height="130"
                      image={ad.imageUrl}
                      alt={ad.title}
                      sx={{ objectFit: 'cover' }}
                    />
                  )}
                  <CardContent sx={{ flex: 1, pb: 1, pt: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                      <Chip
                        label={ad.sender_badge || 'Promo'}
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          bgcolor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)',
                          color: '#f59e0b',
                          borderRadius: '8px'
                        }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {new Date(ad.created_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }} noWrap>
                      {ad.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        fontSize: '0.8rem',
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {ad.description}
                    </Typography>
                  </CardContent>
                  <Divider sx={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />
                  <CardActions sx={{ px: 2, py: 1.2, justifyContent: 'space-between' }}>
                    <Button
                      size="small"
                      startIcon={<ReplayIcon fontSize="small" />}
                      onClick={() => handleRebroadcast(ad)}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        borderRadius: '10px',
                        color: 'primary.main'
                      }}
                    >
                      Re-use Ad
                    </Button>
                    <Tooltip title="Delete Ad from Lounge">
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteAd(ad)}
                        sx={{
                          color: '#ef4444',
                          bgcolor: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.08)',
                          borderRadius: '10px',
                          '&:hover': { bgcolor: isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.15)' }
                        }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>
    </Box>
  );
}
