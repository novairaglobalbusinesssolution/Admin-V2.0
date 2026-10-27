import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Avatar,
  Chip,
  IconButton,
  Button,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Tooltip,
  Paper,
  Divider,
  useTheme,
  Stack,
  Alert
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ShareIcon from '@mui/icons-material/Share';
import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import DownloadIcon from '@mui/icons-material/Download';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';

import { supabase } from '../supabaseClient';
import Swal from 'sweetalert2';
import html2canvas from 'html2canvas';

export default function PujaFeedAdmin() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState(0); // 0: All, 1: Top 10 Stories, 2: Selected / Featured, 3: Latest
  const [featuredIds, setFeaturedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('novaira_featured_puja_posts') || '[]');
    } catch {
      return [];
    }
  });

  // Social Share Modal State
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [activeSharePost, setActiveSharePost] = useState(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const brandedCardRef = useRef(null);

  // Comments Modal State
  const [commentsModalOpen, setCommentsModalOpen] = useState(false);
  const [activeCommentsPost, setActiveCommentsPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  // Fetch posts from Supabase
  const fetchPosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('puja_zone_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching puja posts:', error);
        Swal.fire({
          icon: 'error',
          title: 'Failed to load posts',
          text: error.message,
          background: isDark ? '#171b22' : '#ffffff',
          color: isDark ? '#f1f5f9' : '#111827'
        });
      } else {
        setPosts(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  // Save featured IDs to localStorage
  const toggleFeaturePost = (postId) => {
    setFeaturedIds((prev) => {
      const updated = prev.includes(postId)
        ? prev.filter((id) => id !== postId)
        : [...prev, postId];
      localStorage.setItem('novaira_featured_puja_posts', JSON.stringify(updated));
      return updated;
    });
  };

  // Delete a post with SweetAlert2 confirmation
  const handleDeletePost = async (post) => {
    const result = await Swal.fire({
      title: 'Delete this post?',
      text: `Are you sure you want to delete ${post.user_name || 'this user'}'s puja post? This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!',
      background: isDark ? '#171b22' : '#ffffff',
      color: isDark ? '#f1f5f9' : '#111827'
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase
          .from('puja_zone_posts')
          .delete()
          .eq('id', post.id);

        if (error) throw error;

        setPosts((prev) => prev.filter((p) => p.id !== post.id));
        Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: 'The post has been removed from feed & database.',
          timer: 2000,
          showConfirmButton: false,
          background: isDark ? '#171b22' : '#ffffff',
          color: isDark ? '#f1f5f9' : '#111827'
        });
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Deletion Failed',
          text: err.message,
          background: isDark ? '#171b22' : '#ffffff',
          color: isDark ? '#f1f5f9' : '#111827'
        });
      }
    }
  };

  // Open Comments Modal
  const handleOpenComments = async (post) => {
    setActiveCommentsPost(post);
    setCommentsModalOpen(true);
    setCommentsLoading(true);
    try {
      const { data, error } = await supabase
        .from('puja_zone_comments')
        .select('*')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Comments error:', error);
      } else {
        setComments(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCommentsLoading(false);
    }
  };

  // Open Social Share Modal
  const handleOpenShareModal = (post) => {
    setActiveSharePost(post);
    setSelectedPhotoIndex(0);
    setCopySuccess(false);
    setShareModalOpen(true);
  };

  // Parse images helper
  const getImages = (post) => {
    if (!post) return [];
    if (Array.isArray(post.image_urls)) return post.image_urls;
    if (typeof post.image_urls === 'string') {
      try {
        const parsed = JSON.parse(post.image_urls);
        return Array.isArray(parsed) ? parsed : [post.image_urls];
      } catch {
        return [post.image_urls];
      }
    }
    return [];
  };

  // Statistics
  const stats = useMemo(() => {
    const totalPosts = posts.length;
    let totalPhotos = 0;
    let totalLikes = 0;
    let totalComments = 0;

    posts.forEach((p) => {
      totalPhotos += getImages(p).length;
      totalLikes += Number(p.likes_count || 0);
      totalComments += Number(p.comments_count || 0);
    });

    return {
      totalPosts,
      totalPhotos,
      totalLikes,
      totalComments,
      featuredCount: featuredIds.length
    };
  }, [posts, featuredIds]);

  // Filtered and Searched Posts
  const filteredPosts = useMemo(() => {
    let list = [...posts];

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (p) =>
          (p.user_name && p.user_name.toLowerCase().includes(q)) ||
          (p.earner_id && p.earner_id.toLowerCase().includes(q)) ||
          (p.caption && p.caption.toLowerCase().includes(q)) ||
          (p.location && p.location.toLowerCase().includes(q))
      );
    }

    // Tabs filter
    if (selectedTab === 1) {
      // Top 10 Stories (Leaderboard by Likes)
      list = list.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0)).slice(0, 10);
    } else if (selectedTab === 2) {
      // Featured / Selected
      list = list.filter((p) => featuredIds.includes(p.id));
    } else if (selectedTab === 3) {
      // Latest
      list = list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return list;
  }, [posts, searchTerm, selectedTab, featuredIds]);

  // Generate Social Caption
  const getSocialCaption = (post) => {
    if (!post) return '';
    const images = getImages(post);
    const locationStr = post.location || 'Kolkata, West Bengal';
    const earnerName = post.user_name || 'Novaira Contestant';
    const earnerId = post.earner_id || 'Earner';

    return `🌺 শুভ শারদীয়া ২০২৬! Shubh Sharodiya from Novaira! 🪔✨

🎉 Congratulations to our featured earner ${earnerName} (${earnerId}) for capturing this magnificent Puja moment at ${locationStr}! 📸🏆

${post.caption ? `💬 "${post.caption}"` : ''}

🌟 Join the Novaira Durga Puja 2026 Contest, upload your festive selfies & win exclusive cash rewards and gifts! 🎁💰

📲 Vote & Explore Puja Zone in the app:
http://dashboard.novairasolution.com/durga-puja-2026-feed

#NovairaDurgaPuja2026 #NovairaEarnAndGrow #DurgaPuja2026 #Sharodiya #KolkataDurgaPuja #PandalHopping #FestiveMoments #ContestWinner`;
  };

  // Copy Caption to Clipboard
  const handleCopyCaption = () => {
    if (!activeSharePost) return;
    const text = getSocialCaption(activeSharePost);
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 3000);
  };

  // Download Branded HD Graphic using html2canvas
  const handleDownloadBrandedPhoto = async () => {
    if (!brandedCardRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(brandedCardRef.current, {
        useCORS: true,
        allowTaint: true,
        scale: 2, // High resolution export
        backgroundColor: '#1a1005'
      });

      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Novaira_Puja2026_${activeSharePost?.earner_id || 'Contest'}_branded.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      Swal.fire({
        icon: 'success',
        title: 'Downloaded!',
        text: 'Branded HD Photo is ready to post on Instagram & Facebook!',
        timer: 2500,
        showConfirmButton: false,
        background: isDark ? '#171b22' : '#ffffff',
        color: isDark ? '#f1f5f9' : '#111827'
      });
    } catch (err) {
      console.error('Export error:', err);
      Swal.fire({
        icon: 'error',
        title: 'Export Failed',
        text: 'Could not generate branded image. Please try again.',
        background: isDark ? '#171b22' : '#ffffff',
        color: isDark ? '#f1f5f9' : '#111827'
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Direct Facebook Share
  const handleShareFacebook = () => {
    if (!activeSharePost) return;
    const shareUrl = encodeURIComponent('http://dashboard.novairasolution.com/durga-puja-2026-feed');
    const quote = encodeURIComponent(`🌺 Durga Puja 2026 Contest by Novaira! Featured photo of ${activeSharePost.user_name} (${activeSharePost.location || ''})`);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}&quote=${quote}`, '_blank', 'width=600,height=500');
  };

  // Direct WhatsApp Share
  const handleShareWhatsApp = () => {
    if (!activeSharePost) return;
    const text = encodeURIComponent(getSocialCaption(activeSharePost));
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  // Direct Instagram Shortcut
  const handleOpenInstagram = () => {
    handleCopyCaption();
    window.open('https://www.instagram.com/', '_blank');
  };

  // Native Device Share
  const handleNativeShare = async () => {
    if (!activeSharePost) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Novaira Durga Puja 2026 Contest: ${activeSharePost.user_name}`,
          text: getSocialCaption(activeSharePost),
          url: 'http://dashboard.novairasolution.com/durga-puja-2026-feed'
        });
      } catch (e) {
        console.log('Share dismissed', e);
      }
    } else {
      handleCopyCaption();
    }
  };

  // Format Date in Kolkata IST
  const formatTimeIST = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, minHeight: '100vh' }}>
      {/* 1. Header Banner */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, md: 3.5 },
          mb: 3,
          borderRadius: '24px',
          background: isDark
            ? 'linear-gradient(135deg, #1c140c 0%, #291807 50%, #150f08 100%)'
            : 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 50%, #fed7aa 100%)',
          border: isDark ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(245,158,11,0.3)',
          boxShadow: isDark
            ? '0 10px 30px rgba(0,0,0,0.5)'
            : '0 10px 30px rgba(245,158,11,0.12)'
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { sm: 'center' }, gap: 2 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
              <Chip
                label="🌺 SHARODIYA 2026 SPECIAL"
                size="small"
                sx={{
                  bgcolor: '#f59e0b',
                  color: '#000',
                  fontWeight: 900,
                  fontSize: '0.7rem',
                  letterSpacing: '0.05em'
                }}
              />
              <Chip
                label="LIVE SOCIAL FEED"
                size="small"
                variant="outlined"
                sx={{
                  borderColor: '#f59e0b',
                  color: '#f59e0b',
                  fontWeight: 800,
                  fontSize: '0.65rem'
                }}
              />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 900, fontFamily: '"Google Sans", sans-serif', color: isDark ? '#fff' : '#78350f', letterSpacing: '-0.02em' }}>
              Durga Puja 2026 Photo Moderation & Social Broadcast
            </Typography>
            <Typography variant="body2" sx={{ color: isDark ? '#fbbf24' : '#92400e', mt: 0.5, fontWeight: 500 }}>
              Review user puja photos, select winners, and directly broadcast branded posts to Facebook, Instagram & WhatsApp.
            </Typography>
          </Box>

          <Button
            variant="contained"
            onClick={fetchPosts}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            sx={{
              borderRadius: '16px',
              textTransform: 'none',
              fontWeight: 800,
              bgcolor: '#f59e0b',
              color: '#000',
              px: 2.8,
              py: 1.2,
              '&:hover': { bgcolor: '#d97706' }
            }}
          >
            Refresh Feed
          </Button>
        </Box>

        {/* 2. Key Metrics Row */}
        <Grid container spacing={2} sx={{ mt: 2.5 }}>
          {[
            { label: 'Total Submissions', value: stats.totalPosts, icon: <PhotoLibraryIcon />, color: '#f59e0b' },
            { label: 'Total Photos', value: stats.totalPhotos, icon: <PhotoLibraryIcon />, color: '#3b82f6' },
            { label: 'Total Likes', value: stats.totalLikes, icon: <FavoriteIcon />, color: '#ef4444' },
            { label: 'Total Comments', value: stats.totalComments, icon: <ChatBubbleIcon />, color: '#8b5cf6' },
            { label: 'Selected for Socials', value: stats.featuredCount, icon: <EmojiEventsIcon />, color: '#10b981' }
          ].map((item, idx) => (
            <Grid key={idx} item xs={6} sm={4} md={2.4}>
              <Box
                sx={{
                  p: 1.8,
                  borderRadius: '18px',
                  bgcolor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.7)',
                  border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5
                }}
              >
                <Avatar sx={{ bgcolor: `${item.color}22`, color: item.color, width: 40, height: 40 }}>
                  {item.icon}
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
                    {item.value}
                  </Typography>
                  <Typography variant="caption" sx={{ color: isDark ? '#94a3b8' : '#64748b', fontWeight: 700, fontSize: '0.7rem' }}>
                    {item.label}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* 3. Search & Tabs Toolbar */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: '20px',
          bgcolor: isDark ? '#171b22' : '#ffffff',
          border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)'
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
          <Tabs
            value={selectedTab}
            onChange={(_, val) => setSelectedTab(val)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 800,
                fontSize: '0.85rem',
                borderRadius: '12px',
                minHeight: 40,
                mr: 1
              },
              '& .Mui-selected': {
                bgcolor: isDark ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.14)',
                color: '#f59e0b !important'
              },
              '& .MuiTabs-indicator': {
                bgcolor: '#f59e0b',
                height: 3,
                borderRadius: 2
              }
            }}
          >
            <Tab label={`All Submissions (${posts.length})`} />
            <Tab label="🏆 Top 10 Stories (Likes)" />
            <Tab label={`🌟 Selected for Social (${featuredIds.length})`} />
            <Tab label="⏱️ Most Recent" />
          </Tabs>

          <TextField
            size="small"
            placeholder="Search by User, Earner ID, Location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: '#f59e0b' }} />
                </InputAdornment>
              )
            }}
            sx={{
              minWidth: { xs: '100%', md: 320 },
              '& .MuiOutlinedInput-root': {
                borderRadius: '14px',
                bgcolor: isDark ? 'rgba(0,0,0,0.2)' : '#f8fafc'
              }
            }}
          />
        </Box>
      </Paper>

      {/* 4. Posts Grid */}
      {loading ? (
        <Box sx={{ textAlign: 'center', py: 10 }}>
          <CircularProgress sx={{ color: '#f59e0b' }} />
          <Typography sx={{ mt: 2, fontWeight: 700, color: '#94a3b8' }}>Loading Puja 2026 Feed...</Typography>
        </Box>
      ) : filteredPosts.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: '24px', bgcolor: isDark ? '#171b22' : '#ffffff' }}>
          <PhotoLibraryIcon sx={{ fontSize: 60, color: '#f59e0b', opacity: 0.5, mb: 1.5 }} />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>No Posts Found</Typography>
          <Typography variant="body2" sx={{ color: '#94a3b8', mt: 0.5 }}>
            {searchTerm ? 'No puja posts matched your search criteria.' : 'No users have uploaded puja photos yet.'}
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={2.5}>
          {filteredPosts.map((post) => {
            const images = getImages(post);
            const isFeatured = featuredIds.includes(post.id);

            return (
              <Grid key={post.id} item xs={12} sm={6} lg={4}>
                <Card
                  sx={{
                    borderRadius: '22px',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    bgcolor: isDark ? '#171b22' : '#ffffff',
                    border: isFeatured
                      ? '2px solid #f59e0b'
                      : isDark
                      ? '1px solid rgba(255,255,255,0.08)'
                      : '1px solid rgba(0,0,0,0.08)',
                    boxShadow: isFeatured
                      ? '0 12px 30px rgba(245,158,11,0.18)'
                      : '0 8px 24px rgba(0,0,0,0.04)',
                    transition: 'all 0.25s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    '&:hover': {
                      transform: 'translateY(-3px)',
                      boxShadow: '0 14px 32px rgba(0,0,0,0.12)'
                    }
                  }}
                >
                  {/* Featured Ribbon */}
                  {isFeatured && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 14,
                        right: 14,
                        zIndex: 2,
                        bgcolor: '#f59e0b',
                        color: '#000',
                        px: 1.2,
                        py: 0.3,
                        borderRadius: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        boxShadow: '0 4px 12px rgba(245,158,11,0.4)'
                      }}
                    >
                      <StarIcon sx={{ fontSize: 14 }} />
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: 900 }}>SELECTED</Typography>
                    </Box>
                  )}

                  {/* User Profile Header */}
                  <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar
                      sx={{
                        bgcolor: '#f59e0b',
                        color: '#000',
                        fontWeight: 900,
                        width: 44,
                        height: 44,
                        fontSize: '1.1rem'
                      }}
                    >
                      {post.avatar_letter || (post.user_name ? post.user_name[0].toUpperCase() : 'U')}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }} noWrap>
                          {post.user_name || 'Novaira Earner'}
                        </Typography>
                      </Box>
                      <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 800, fontSize: '0.7rem' }} noWrap display="block">
                        {post.earner_id || 'N/A'}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2 }}>
                        <LocationOnIcon sx={{ fontSize: 13, color: '#94a3b8' }} />
                        <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }} noWrap>
                          {post.location || 'Novaira Sharodiya 2026'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                          • {formatTimeIST(post.created_at)}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Image Preview Box */}
                  <Box
                    sx={{
                      position: 'relative',
                      width: '100%',
                      height: 280,
                      bgcolor: '#0f1117',
                      overflow: 'hidden'
                    }}
                  >
                    {images.length > 0 ? (
                      <img
                        src={images[0]}
                        alt={post.caption || 'Puja photo'}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                        loading="lazy"
                      />
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                        No Image
                      </Box>
                    )}

                    {/* Multi-photo badge */}
                    {images.length > 1 && (
                      <Chip
                        icon={<PhotoLibraryIcon sx={{ fontSize: 13, color: '#fff !important' }} />}
                        label={`1 of ${images.length}`}
                        size="small"
                        sx={{
                          position: 'absolute',
                          bottom: 10,
                          right: 10,
                          bgcolor: 'rgba(0,0,0,0.65)',
                          color: '#fff',
                          backdropFilter: 'blur(4px)',
                          fontWeight: 800,
                          fontSize: '0.65rem'
                        }}
                      />
                    )}
                  </Box>

                  {/* Caption & Content */}
                  <CardContent sx={{ p: 2, flexGrow: 1 }}>
                    {post.caption ? (
                      <Typography variant="body2" sx={{ fontWeight: 600, color: isDark ? '#e2e8f0' : '#334155', mb: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        "{post.caption}"
                      </Typography>
                    ) : (
                      <Typography variant="body2" sx={{ color: '#94a3b8', fontStyle: 'italic', mb: 1.5 }}>
                        No caption provided.
                      </Typography>
                    )}

                    {/* Likes & Comments Counter */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, color: '#ef4444' }}>
                        <FavoriteIcon sx={{ fontSize: 18 }} />
                        <Typography sx={{ fontWeight: 800, fontSize: '0.82rem' }}>
                          {post.likes_count || 0}
                        </Typography>
                      </Box>

                      <Box
                        onClick={() => handleOpenComments(post)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.6,
                          color: '#3b82f6',
                          cursor: 'pointer',
                          '&:hover': { textDecoration: 'underline' }
                        }}
                      >
                        <ChatBubbleIcon sx={{ fontSize: 18 }} />
                        <Typography sx={{ fontWeight: 800, fontSize: '0.82rem' }}>
                          {post.comments_count || 0} comments
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>

                  <Divider sx={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />

                  {/* Action Bar */}
                  <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    {/* Select / Featured Button */}
                    <Tooltip title={isFeatured ? 'Remove from Featured' : 'Select for Official Social Media'}>
                      <Button
                        size="small"
                        onClick={() => toggleFeaturePost(post.id)}
                        startIcon={isFeatured ? <StarIcon sx={{ color: '#f59e0b' }} /> : <StarBorderIcon />}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 800,
                          fontSize: '0.75rem',
                          color: isFeatured ? '#f59e0b' : '#94a3b8',
                          borderRadius: '12px'
                        }}
                      >
                        {isFeatured ? 'Selected' : 'Select'}
                      </Button>
                    </Tooltip>

                    {/* Social Media Share / Export Button */}
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleOpenShareModal(post)}
                      startIcon={<ShareIcon sx={{ fontSize: 16 }} />}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 900,
                        fontSize: '0.75rem',
                        bgcolor: '#f59e0b',
                        color: '#000',
                        borderRadius: '12px',
                        px: 1.8,
                        '&:hover': { bgcolor: '#d97706' }
                      }}
                    >
                      Share to FB / Insta
                    </Button>

                    {/* Delete / Moderate Button */}
                    <Tooltip title="Delete inappropriate post">
                      <IconButton size="small" onClick={() => handleDeletePost(post)} sx={{ color: '#ef4444' }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* ======================================================== */}
      {/* 5. BRANDED SOCIAL MEDIA SHARE & EXPORT MODAL              */}
      {/* ======================================================== */}
      <Dialog
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '24px',
            bgcolor: isDark ? '#171b22' : '#ffffff',
            backgroundImage: 'none'
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ bgcolor: '#f59e0b', color: '#000', width: 34, height: 34 }}>
              <ShareIcon fontSize="small" />
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                Social Media Branded Broadcast
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                Auto-generate Novaira 2026 branded graphics & post directly to Facebook, Instagram & WhatsApp
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setShareModalOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: { xs: 2, md: 3 } }}>
          {activeSharePost && (
            <Grid container spacing={3}>
              {/* Left Column: Live Branded Graphic Card */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.2, color: '#f59e0b' }}>
                  Live 1080p Branded Preview:
                </Typography>

                {/* Photo Selector if user uploaded multiple photos */}
                {getImages(activeSharePost).length > 1 && (
                  <Box sx={{ display: 'flex', gap: 1, mb: 1.5, overflowX: 'auto', pb: 0.5 }}>
                    {getImages(activeSharePost).map((imgUrl, i) => (
                      <Box
                        key={i}
                        onClick={() => setSelectedPhotoIndex(i)}
                        sx={{
                          width: 52,
                          height: 52,
                          borderRadius: '10px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          border: selectedPhotoIndex === i ? '2px solid #f59e0b' : '2px solid transparent',
                          opacity: selectedPhotoIndex === i ? 1 : 0.6
                        }}
                      >
                        <img src={imgUrl} alt={`Thumbnail ${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </Box>
                    ))}
                  </Box>
                )}

                {/* THE BRANDED CANVAS ELEMENT (Exported by html2canvas) */}
                <Box
                  ref={brandedCardRef}
                  sx={{
                    width: '100%',
                    maxWidth: 380,
                    mx: 'auto',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    background: 'linear-gradient(180deg, #1f1406 0%, #110d06 100%)',
                    border: '2px solid #f59e0b',
                    boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
                    color: '#fff',
                    fontFamily: '"Google Sans", sans-serif'
                  }}
                >
                  {/* Top Branding Header */}
                  <Box
                    sx={{
                      p: 1.5,
                      background: 'linear-gradient(90deg, #b45309 0%, #f59e0b 50%, #d97706 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                      <Typography sx={{ fontWeight: 900, fontSize: '0.85rem', color: '#000', letterSpacing: '0.04em' }}>
                        🪔 NOVAIRA SHARODIYA 2026
                      </Typography>
                    </Box>
                    <Chip
                      label="BEST PUJA MOMENT"
                      size="small"
                      sx={{ bgcolor: '#000', color: '#f59e0b', fontWeight: 900, fontSize: '0.6rem', height: 20 }}
                    />
                  </Box>

                  {/* Main Photo Frame */}
                  <Box sx={{ position: 'relative', width: '100%', height: 320, bgcolor: '#000' }}>
                    <img
                      src={getImages(activeSharePost)[selectedPhotoIndex] || ''}
                      alt="Contest Entry"
                      crossOrigin="anonymous"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />

                    {/* Watermark Contest Badge */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        bgcolor: 'rgba(0,0,0,0.7)',
                        backdropFilter: 'blur(6px)',
                        px: 1.2,
                        py: 0.4,
                        borderRadius: '20px',
                        border: '1px solid rgba(245,158,11,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.6
                      }}
                    >
                      <EmojiEventsIcon sx={{ fontSize: 14, color: '#f59e0b' }} />
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: '#f59e0b' }}>
                        Contest Highlight
                      </Typography>
                    </Box>
                  </Box>

                  {/* Lower User & Novaira Info Bar */}
                  <Box sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.8 }}>
                      <Box>
                        <Typography sx={{ fontWeight: 900, fontSize: '0.95rem', color: '#fff' }}>
                          {activeSharePost.user_name || 'Novaira Contestant'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 800 }}>
                          {activeSharePost.earner_id}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                          📍 {activeSharePost.location || 'Kolkata, WB'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.68rem', color: '#ef4444', fontWeight: 800 }}>
                          ❤️ {activeSharePost.likes_count || 0} Likes
                        </Typography>
                      </Box>
                    </Box>

                    {activeSharePost.caption && (
                      <Typography sx={{ fontSize: '0.78rem', color: '#e2e8f0', fontStyle: 'italic', mb: 1 }}>
                        "{activeSharePost.caption}"
                      </Typography>
                    )}

                    {/* Official Footer Banner */}
                    <Box
                      sx={{
                        mt: 1.2,
                        pt: 1,
                        borderTop: '1px solid rgba(245,158,11,0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <Typography sx={{ fontSize: '0.65rem', color: '#fbbf24', fontWeight: 800 }}>
                        Novaira Earn & Grow App
                      </Typography>
                      <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                        dashboard.novairasolution.com
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Grid>

              {/* Right Column: 1-Click Social Sharing Actions */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, color: '#f59e0b' }}>
                  Direct Social Broadcast Channels:
                </Typography>

                <Stack spacing={1.5}>
                  {/* 1. Download Branded HD Photo */}
                  <Button
                    variant="contained"
                    fullWidth
                    disabled={isExporting}
                    onClick={handleDownloadBrandedPhoto}
                    startIcon={isExporting ? <CircularProgress size={18} color="inherit" /> : <DownloadIcon />}
                    sx={{
                      py: 1.3,
                      borderRadius: '16px',
                      textTransform: 'none',
                      fontWeight: 900,
                      bgcolor: '#f59e0b',
                      color: '#000',
                      '&:hover': { bgcolor: '#d97706' }
                    }}
                  >
                    {isExporting ? 'Generating Branded Graphic...' : '1. Download Branded HD Photo'}
                  </Button>

                  {/* 2. Direct Share to Facebook */}
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={handleShareFacebook}
                    startIcon={<FacebookIcon sx={{ color: '#1877f2' }} />}
                    sx={{
                      py: 1.3,
                      borderRadius: '16px',
                      textTransform: 'none',
                      fontWeight: 800,
                      borderColor: '#1877f2',
                      color: '#1877f2',
                      '&:hover': { bgcolor: 'rgba(24,119,242,0.08)', borderColor: '#1877f2' }
                    }}
                  >
                    Post / Share to Facebook
                  </Button>

                  {/* 3. Open Instagram Web & Auto-Copy Caption */}
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={handleOpenInstagram}
                    startIcon={<InstagramIcon sx={{ color: '#e1306c' }} />}
                    sx={{
                      py: 1.3,
                      borderRadius: '16px',
                      textTransform: 'none',
                      fontWeight: 800,
                      borderColor: '#e1306c',
                      color: '#e1306c',
                      '&:hover': { bgcolor: 'rgba(225,48,108,0.08)', borderColor: '#e1306c' }
                    }}
                  >
                    Open Instagram (Copy Caption & Post)
                  </Button>

                  {/* 4. Share to WhatsApp */}
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={handleShareWhatsApp}
                    startIcon={<WhatsAppIcon sx={{ color: '#25d366' }} />}
                    sx={{
                      py: 1.3,
                      borderRadius: '16px',
                      textTransform: 'none',
                      fontWeight: 800,
                      borderColor: '#25d366',
                      color: '#25d366',
                      '&:hover': { bgcolor: 'rgba(37,211,102,0.08)', borderColor: '#25d366' }
                    }}
                  >
                    Share to WhatsApp Community / Group
                  </Button>

                  {/* 5. Device Native Share */}
                  {navigator.share && (
                    <Button
                      variant="outlined"
                      fullWidth
                      onClick={handleNativeShare}
                      startIcon={<ShareIcon />}
                      sx={{
                        py: 1.3,
                        borderRadius: '16px',
                        textTransform: 'none',
                        fontWeight: 800
                      }}
                    >
                      Device Native Share Sheet
                    </Button>
                  )}
                </Stack>

                {/* Pre-crafted Caption Box */}
                <Box sx={{ mt: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.8 }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#94a3b8' }}>
                      Ready-to-Post Marketing Caption:
                    </Typography>
                    <Button
                      size="small"
                      onClick={handleCopyCaption}
                      startIcon={copySuccess ? <CheckCircleIcon sx={{ color: '#10b981' }} /> : <ContentCopyIcon />}
                      sx={{ textTransform: 'none', fontWeight: 800, fontSize: '0.75rem', color: copySuccess ? '#10b981' : '#f59e0b' }}
                    >
                      {copySuccess ? 'Copied!' : 'Copy Caption'}
                    </Button>
                  </Box>

                  <TextField
                    multiline
                    rows={6}
                    fullWidth
                    value={getSocialCaption(activeSharePost)}
                    InputProps={{ readOnly: true }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '16px',
                        fontSize: '0.8rem',
                        bgcolor: isDark ? 'rgba(0,0,0,0.3)' : '#f8fafc'
                      }
                    }}
                  />
                </Box>
              </Grid>
            </Grid>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setShareModalOpen(false)} sx={{ fontWeight: 800, textTransform: 'none' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* ======================================================== */}
      {/* 6. COMMENTS MODAL                                         */}
      {/* ======================================================== */}
      <Dialog
        open={commentsModalOpen}
        onClose={() => setCommentsModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '24px',
            bgcolor: isDark ? '#171b22' : '#ffffff'
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ChatBubbleIcon sx={{ color: '#3b82f6' }} />
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Post Comments ({comments.length})
            </Typography>
          </Box>
          <IconButton onClick={() => setCommentsModalOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {commentsLoading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : comments.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4, color: '#94a3b8' }}>
              No comments on this post yet.
            </Box>
          ) : (
            <Stack spacing={2}>
              {comments.map((c) => (
                <Box
                  key={c.id}
                  sx={{
                    p: 1.5,
                    borderRadius: '14px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                    border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)'
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: '#f59e0b' }}>
                      {c.user_name || c.earner_id || 'User'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                      {formatTimeIST(c.created_at)}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: isDark ? '#e2e8f0' : '#1e293b' }}>
                    {c.comment_text}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
