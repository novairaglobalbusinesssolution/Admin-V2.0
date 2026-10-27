import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, TextField, Button,
  Grid, Card, CardMedia, CardContent, CardActions,
  Chip, IconButton, CircularProgress, Stack,
  useTheme, Divider
} from '@mui/material';
import CampaignIcon from '@mui/icons-material/Campaign';
import SendIcon from '@mui/icons-material/Send';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import Swal from 'sweetalert2';

import { broadcastAd, fetchAdsHistory, deleteMessage } from './communityChatService';

export default function CommunityAdsView() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [form, setForm] = useState({
    title: '🚀 Weekend Mega Bonus: Earn 2X Coins Today!',
    description: 'Submit 5 app review tasks before midnight and get instant Rs. 50 cash bonus added straight to your Novaira wallet!',
    imageUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=600&auto=format&fit=crop&q=80',
    ctaText: 'Claim Bonus Now',
    ctaUrl: 'https://novairaglobal.com',
    badge: '📢 Sponsored Promo'
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
      badge: ad.sender_badge || '📢 Sponsored Promo'
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Top Header Card */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: '22px',
          border: `1px solid ${theme.palette.divider}`,
          background: isDark
            ? 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(15,23,42,0.9) 100%)'
            : 'linear-gradient(135deg, rgba(254,243,199,0.7) 0%, rgba(255,255,255,0.95) 100%)',
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
            bgcolor: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#000',
            boxShadow: '0 8px 20px rgba(245,158,11,0.3)'
          }}
        >
          <CampaignIcon sx={{ fontSize: 28 }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>In-Chat Ads & Sponsored Campaigns</Typography>
          <Typography variant="body2" color="text.secondary">
            Create rich promotional banners and push them into the Community Group Chat. Users see them live with 1-click CTA buttons.
          </Typography>
        </Box>
      </Paper>

      <Grid container spacing={3}>
        {/* Ad Creator Form */}
        <Grid item xs={12} md={7}>
          <Paper
            elevation={0}
            component="form"
            onSubmit={handleBroadcast}
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
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Create New In-Chat Promotion</Typography>

            {/* Badge Picker */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {['📢 Sponsored Promo', '🔥 Flash Deal', '⚡ Limited Offer', '🎉 Community Reward'].map((b) => (
                <Chip
                  key={b}
                  label={b}
                  clickable
                  onClick={() => setForm({ ...form, badge: b })}
                  color={form.badge === b ? 'warning' : 'default'}
                  variant={form.badge === b ? 'filled' : 'outlined'}
                  sx={{ fontWeight: 700, borderRadius: '10px' }}
                />
              ))}
            </Box>

            <TextField
              size="small"
              label="Ad Title"
              fullWidth
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            />

            <TextField
              size="small"
              label="Ad Description / Details"
              fullWidth
              multiline
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            />

            <TextField
              size="small"
              label="Banner Image URL (Optional)"
              fullWidth
              placeholder="https://... (.jpg, .png, .webp)"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            />

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  size="small"
                  label="Button Label (CTA)"
                  fullWidth
                  placeholder="e.g. Claim Bonus, Install App"
                  value={form.ctaText}
                  onChange={(e) => setForm({ ...form, ctaText: e.target.value })}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
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
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
              </Grid>
            </Grid>

            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
              sx={{
                bgcolor: '#f59e0b',
                color: '#000',
                borderRadius: '14px',
                py: 1.2,
                fontWeight: 800,
                textTransform: 'none',
                boxShadow: '0 8px 20px rgba(245,158,11,0.25)',
                '&:hover': { bgcolor: '#d97706' }
              }}
            >
              Broadcast Ad to Community Lounge
            </Button>
          </Paper>
        </Grid>

        {/* Live Mobile Device Preview */}
        <Grid item xs={12} md={5}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '24px',
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: 'background.paper',
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SmartphoneIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Mobile In-App Preview</Typography>
            </Box>

            {/* Mobile Mock Bubble */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '20px',
                border: '1px solid #f59e0b',
                background: isDark
                  ? 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(30,41,59,0.8) 100%)'
                  : 'linear-gradient(135deg, #fffbeb 0%, #ffffff 100%)',
                boxShadow: '0 12px 28px rgba(245,158,11,0.18)'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Chip
                  label={form.badge}
                  size="small"
                  sx={{ bgcolor: '#f59e0b', color: '#000', fontWeight: 800, fontSize: '0.7rem' }}
                />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Just now</Typography>
              </Box>

              {form.imageUrl && (
                <Box
                  component="img"
                  src={form.imageUrl}
                  alt="preview"
                  onError={(e) => { e.target.style.display = 'none'; }}
                  sx={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: '12px', mb: 1.5 }}
                />
              )}

              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: isDark ? '#fbbf24' : '#b45309', lineHeight: 1.3 }}>
                {form.title || 'Untitled Promo'}
              </Typography>

              <Typography variant="body2" sx={{ my: 1, color: 'text.primary', fontSize: '0.85rem', lineHeight: 1.5 }}>
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
                    py: 1,
                    mt: 1,
                    boxShadow: 'none'
                  }}
                >
                  {form.ctaText || 'Open Action'}
                </Button>
              )}
            </Paper>
          </Paper>
        </Grid>
      </Grid>

      {/* Previously Broadcasted Ads History */}
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
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Broadcast History & Manage Active Ads</Typography>

        {historyLoading ? (
          <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress size={28} /></Box>
        ) : history.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No ads broadcasted yet.</Typography>
        ) : (
          <Grid container spacing={2}>
            {history.map((ad) => (
              <Grid item xs={12} sm={6} md={4} key={ad.rowId}>
                <Card
                  elevation={0}
                  sx={{
                    borderRadius: '18px',
                    border: `1px solid ${theme.palette.divider}`,
                    bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%'
                  }}
                >
                  {ad.imageUrl && (
                    <CardMedia component="img" height="120" image={ad.imageUrl} alt={ad.title} />
                  )}
                  <CardContent sx={{ flex: 1, pb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Chip label={ad.sender_badge || 'Promo'} size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 800 }} />
                      <Typography variant="caption" color="text.secondary">
                        {new Date(ad.created_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>
                      {ad.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem', mt: 0.5 }} maxLines={2}>
                      {ad.description}
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ px: 2, pb: 1.5, pt: 0, justifyContent: 'space-between' }}>
                    <Button
                      size="small"
                      startIcon={<ReplayIcon />}
                      onClick={() => handleRebroadcast(ad)}
                      sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                      Re-use
                    </Button>
                    <IconButton size="small" color="error" onClick={() => handleDeleteAd(ad)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
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
