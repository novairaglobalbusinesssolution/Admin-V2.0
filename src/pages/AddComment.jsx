import { useState, useEffect, useMemo } from 'react';
import { 
  Box, Typography, Paper, TextField, Button, 
  FormControlLabel, Select, MenuItem, Switch, Checkbox,
  Autocomplete, useTheme, Chip, InputAdornment, IconButton, Tooltip, Divider,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  CircularProgress
} from '@mui/material';
import { supabase } from '../supabaseClient';
import { getApiBaseUrl, getApiHeaders } from '../utils/apiConfig';

// MUI Icons
import AndroidIcon from '@mui/icons-material/Android';
import AppleIcon from '@mui/icons-material/Apple';
import LanguageIcon from '@mui/icons-material/Language';
import YouTubeIcon from '@mui/icons-material/YouTube';
import StarIcon from '@mui/icons-material/Star';
import CommentIcon from '@mui/icons-material/Comment';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import LinkIcon from '@mui/icons-material/Link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import TimerIcon from '@mui/icons-material/Timer';
import BlockIcon from '@mui/icons-material/Block';
import AppsIcon from '@mui/icons-material/Apps';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SendIcon from '@mui/icons-material/Send';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import SpeedIcon from '@mui/icons-material/Speed';
import LayersIcon from '@mui/icons-material/Layers';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import ShieldIcon from '@mui/icons-material/Shield';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';

// IST Time formatting
const getISTDate = () => {
  const d = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + istOffset);
  return istDate.toISOString().slice(0, 10); // YYYY-MM-DD
};

export default function AddComment() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  // Category Tab: 'All', 'Android App', 'iOS App', 'Registration', 'YT Video'
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  const [apps, setApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  
  // Settings State
  const [limit, setLimit] = useState(1);
  const [enableTimer, setEnableTimer] = useState(false);
  const [timerGap, setTimerGap] = useState(10);
  const [blockSameLink, setBlockSameLink] = useState(true);
  const [blockLinkMode, setBlockLinkMode] = useState('7_days'); // '7_days' | 'custom' | 'none'
  const [blockUntilDate, setBlockUntilDate] = useState('');
  
  // Date/Time State
  const [scheduleTime, setScheduleTime] = useState(getISTDate());

  // === REVIEW MODE (Android & iOS) ===
  const [reviewMode, setReviewMode] = useState('text'); // 'text' or 'star_only'
  const [multiStarMode, setMultiStarMode] = useState(false);
  const [globalRating, setGlobalRating] = useState(5);
  const [commentsText, setCommentsText] = useState('');
  const [multiStarTexts, setMultiStarTexts] = useState({ 5: '', 4: '', 3: '', 2: '', 1: '' });
  
  // Star-only slot quantities
  const [starCounts, setStarCounts] = useState({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });

  // === REGISTRATION MODE ===
  const [regProcedure, setRegProcedure] = useState('');
  const [regVideoType, setRegVideoType] = useState('youtube'); // 'youtube' or 'server'
  const [regVideoUrl, setRegVideoUrl] = useState('');
  const [regSlots, setRegSlots] = useState(25);

  // === YT VIDEO MODE ===
  const [ytProcedure, setYtProcedure] = useState('Watch the video for at least 2 minutes, hit like, and subscribe to the channel.');
  const [ytVideoUrl, setYtVideoUrl] = useState('');
  const [ytCommentMode, setYtCommentMode] = useState('none'); // 'none' = Watch/Like only, 'custom_comments' = Post comments
  const [ytSlots, setYtSlots] = useState(20);
  const [ytCommentsText, setYtCommentsText] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [alertData, setAlertData] = useState({ open: false, title: '', message: '', type: 'success' });

  useEffect(() => {
    fetchApps(scheduleTime);
  }, [scheduleTime]);

  const fetchApps = async (selectedDate = scheduleTime) => {
    let query = supabase.from('apps').select('id, app_name, app_package, task_id, task_type, app_date, instructions, assigned_bulkers');

    if (selectedDate) {
      query = query.eq('app_date', selectedDate);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (!error && data) {
      setApps(data);
      setSelectedApp((prev) => (prev && data.some(app => app.id === prev.id) ? prev : null));
    }
  };

  // Filter apps according to selected Category
  const filteredApps = useMemo(() => {
    if (selectedCategory === 'All') return apps;
    return apps.filter(a => a.task_type === selectedCategory);
  }, [apps, selectedCategory]);

  const handleAppChange = async (event, newValue) => {
    setSelectedApp(newValue);
    if (newValue) {
      if (newValue.task_type && selectedCategory !== 'All' && selectedCategory !== newValue.task_type) {
        setSelectedCategory(newValue.task_type);
      }

      // Pre-fill existing settings & instructions
      let { data, error } = await supabase.from('apps')
        .select('comment_limit, enable_timer, timer_gap_minutes, block_same_link_7_days, block_until_date, instructions, app_package')
        .eq('id', newValue.id).single();
      
      if (error && error.message && error.message.includes('block_until_date')) {
        const fallbackRes = await supabase.from('apps')
          .select('comment_limit, enable_timer, timer_gap_minutes, block_same_link_7_days, instructions, app_package')
          .eq('id', newValue.id).single();
        data = fallbackRes.data;
      }
        
      if (data) {
        setLimit(data.comment_limit || 1);
        setEnableTimer(data.enable_timer || false);
        setTimerGap(data.timer_gap_minutes || 10);
        
        if (data.block_until_date) {
          setBlockLinkMode('custom');
          setBlockUntilDate(data.block_until_date);
          setBlockSameLink(true);
        } else if (data.block_same_link_7_days === false) {
          setBlockLinkMode('none');
          setBlockUntilDate('');
          setBlockSameLink(false);
        } else {
          setBlockLinkMode('7_days');
          setBlockUntilDate('');
          setBlockSameLink(true);
        }
        
        if (newValue.task_type === 'Registration') {
          setRegProcedure(data.instructions || '1. Click the registration link\n2. Complete signup with valid mobile number & email\n3. Verify OTP & submit basic KYC\n4. Upload account dashboard screenshot showing registered User ID');
          setRegVideoUrl(data.app_package || '');
        } else if (newValue.task_type === 'YT Video') {
          setYtProcedure(data.instructions || 'Watch full video (minimum 2 mins), hit like button, and subscribe to the channel.');
          setYtVideoUrl(data.app_package || '');
        }
      }
    }
  };

  // Determine effective current task type
  const effectiveType = selectedApp?.task_type || (selectedCategory !== 'All' ? selectedCategory : 'Android App');

  // Get list of assigned bulkers for display
  const assignedBulkersDisplay = useMemo(() => {
    if (!selectedApp) return [];
    let raw = selectedApp.assigned_bulkers;
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); } catch (e) {}
    }
    if (!Array.isArray(raw)) return [];
    return raw.map(b => {
      const bId = typeof b === 'string' ? b : (b?.bulker_id || '');
      return bId.replace(/^NOVAIRA\/BULKER\//i, '');
    }).filter(Boolean);
  }, [selectedApp]);

  // Comment Parser
  const parseText = (text, rating) => {
    if (!text.trim()) return [];
    return text.split('\n')
      .map(line => {
        let cleaned = line.trim()
          .replace(/^\s*(?:\d+|[A-Za-z])[\.\)\-:]\s*/i, '')
          .replace(/^\s*[-*•✔]\s*/, '');
        return cleaned.trim();
      })
      .filter(line => {
        if (line.length === 0) return false;
        const l = line.toLowerCase();
        if (l.includes("here are") && l.includes("review")) return false;
        if (l.includes("here is a")) return false;
        if (l.startsWith("sure!")) return false;
        if (l.startsWith("certainly!")) return false;
        if (l.startsWith("of course")) return false;
        if (l.startsWith("note:")) return false;
        if (l.includes("let me know")) return false;
        if (l.includes("hope these")) return false;
        if (l.includes("feel free to")) return false;
        if (l.includes("5-star review")) return false;
        if (l.match(/^here (are|is) \d+/)) return false;
        return true;
      })
      .map(content => ({
        app_id: selectedApp.id,
        content,
        rating,
        status: 'active'
      }));
  };

  const handleSave = async () => {
    if (!selectedApp) {
      return setAlertData({ open: true, title: 'Application Required', message: 'Please select a target Application / Task first before deploying.', type: 'error' });
    }

    setSaving(true);
    try {
      // 1. Prepare Settings & Instructions Update
      const appUpdatePayload = {
        comment_limit: limit,
        enable_timer: enableTimer,
        timer_gap_minutes: timerGap,
        block_same_link_7_days: blockLinkMode === '7_days' || blockLinkMode === 'custom',
        block_until_date: blockLinkMode === 'custom' ? (blockUntilDate || null) : null
      };

      let newComments = [];

      // 2. Process by Task Type (Only parse comments if provided, otherwise allow saving guard settings)
      if (effectiveType === 'Android App' || effectiveType === 'iOS App') {
        if (reviewMode === 'text') {
          if (!multiStarMode) {
            if (commentsText.trim()) newComments = parseText(commentsText, globalRating);
          } else {
            Object.keys(multiStarTexts).forEach(r => {
              if (multiStarTexts[r].trim()) {
                newComments = [...newComments, ...parseText(multiStarTexts[r], parseInt(r))];
              }
            });
          }
        } else {
          // Star Rating Only Mode (No text comment)
          [5, 4, 3, 2, 1].forEach(r => {
            const count = parseInt(starCounts[r] || 0, 10);
            for (let i = 0; i < count; i++) {
              newComments.push({
                app_id: selectedApp.id,
                content: `Rating Only (${r} Star)`,
                rating: r,
                status: 'active'
              });
            }
          });
        }
      } else if (effectiveType === 'Registration') {
        if (regProcedure.trim()) {
          let instructionsText = regProcedure.trim();
          if (regVideoUrl.trim()) {
            instructionsText += `\n\nTutorial Video (${regVideoType === 'server' ? 'Server Video' : 'YouTube'}): ${regVideoUrl.trim()}`;
          }
          appUpdatePayload.instructions = instructionsText;
        }

        const count = parseInt(regSlots || 0, 10);
        if (count > 0) {
          for (let i = 0; i < count; i++) {
            newComments.push({
              app_id: selectedApp.id,
              content: '',
              rating: 5,
              status: 'active'
            });
          }
        }
      } else if (effectiveType === 'YT Video') {
        if (ytProcedure.trim()) {
          let ytInstructions = ytProcedure.trim();
          if (ytVideoUrl.trim()) {
            ytInstructions += `\n\nYouTube Link: ${ytVideoUrl.trim()}`;
            appUpdatePayload.app_package = ytVideoUrl.trim();
          }
          appUpdatePayload.instructions = ytInstructions;
        }

        if (ytCommentMode === 'custom_comments') {
          if (ytCommentsText.trim()) newComments = parseText(ytCommentsText, 5);
        } else {
          const count = parseInt(ytSlots || 0, 10);
          if (count > 0) {
            for (let i = 0; i < count; i++) {
              newComments.push({
                app_id: selectedApp.id,
                content: '',
                rating: 5,
                status: 'active'
              });
            }
          }
        }
      }

      // 3. Update App in Database
      let { error: settingsError } = await supabase.from('apps').update(appUpdatePayload).eq('id', selectedApp.id);
      if (settingsError && settingsError.message && settingsError.message.includes('block_until_date')) {
        const { block_until_date, ...safePayload } = appUpdatePayload;
        const retryRes = await supabase.from('apps').update(safePayload).eq('id', selectedApp.id);
        settingsError = retryRes.error;
      }
      if (settingsError) throw settingsError;

      // 4. Insert Generated Comments / Slots
      if (newComments.length > 0) {
        const { error: insertError } = await supabase.from('app_comments').insert(newComments);
        if (insertError) throw insertError;
      }

      // 5. Trigger Targeted Push Notifications
      try {
        let assignedBulkerIds = [];
        if (selectedApp.assigned_bulkers) {
          let rawB = selectedApp.assigned_bulkers;
          if (typeof rawB === 'string') {
            try { rawB = JSON.parse(rawB); } catch(e) {}
          }
          if (Array.isArray(rawB)) {
            assignedBulkerIds = rawB.map(b => typeof b === 'string' ? b : b?.bulker_id).filter(Boolean);
          }
        }

        let assignedTokens = [];
        if (assignedBulkerIds.length > 0) {
          const { data: bProfiles } = await supabase
            .from('profiles')
            .select('fcm_token, bulker_id')
            .not('fcm_token', 'is', null);

          if (bProfiles && bProfiles.length > 0) {
            const bSet = new Set(assignedBulkerIds.map(b => String(b).replace(/^NOVAIRA\/BULKER\//i, '').trim().toUpperCase()));
            assignedTokens = bProfiles
              .filter(p => {
                if (!p.bulker_id) return false;
                const bClean = String(p.bulker_id).replace(/^NOVAIRA\/BULKER\//i, '').trim().toUpperCase();
                return bSet.has(bClean);
              })
              .map(p => p.fcm_token)
              .filter(Boolean);
          }
        }

        const baseUrl = getApiBaseUrl();
        await fetch(`${baseUrl}/api/send-bulk-notification`, {
          method: 'POST',
          headers: getApiHeaders(),
          body: JSON.stringify({
            app_id: selectedApp.id,
            bulker_ids: assignedBulkerIds,
            tokens: assignedTokens,
            title: `New ${effectiveType} Task Available!`,
            body: `Task for "${selectedApp.app_name}" has been published with ${newComments.length} slots. Earn rewards now!`,
            type: 'task'
          })
        });
      } catch (err) {
        console.warn('Push notification delivery skipped or failed:', err);
      }

      setAlertData({ 
        open: true, 
        title: newComments.length > 0 ? 'Task Successfully Deployed!' : 'Settings Successfully Updated!', 
        message: newComments.length > 0 
          ? `Successfully released ${newComments.length} task slots/comments for "${selectedApp.app_name}". Push notifications dispatched to target bulker network!`
          : `Task guard settings (Repeat Link Guard, Limits & Cooldown) for "${selectedApp.app_name}" updated successfully in the system!`, 
        type: 'success' 
      });

      // Clear dynamic inputs
      setCommentsText('');
      setMultiStarTexts({ 5: '', 4: '', 3: '', 2: '', 1: '' });
      setStarCounts({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
      setYtCommentsText('');

    } catch (e) {
      console.error(e);
      setAlertData({ open: true, title: 'Deployment Error', message: e.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const addStarCount = (rating, increment) => {
    setStarCounts(prev => ({
      ...prev,
      [rating]: Math.max(0, (parseInt(prev[rating], 10) || 0) + increment)
    }));
  };

  const totalStarOnlySlots = Object.values(starCounts).reduce((a, b) => a + (parseInt(b, 10) || 0), 0);

  // Live count of comments parsed
  const liveParsedCount = useMemo(() => {
    if (effectiveType === 'Android App' || effectiveType === 'iOS App') {
      if (reviewMode === 'text') {
        if (!multiStarMode) {
          return parseText(commentsText, globalRating).length;
        } else {
          return Object.keys(multiStarTexts).reduce((acc, r) => acc + parseText(multiStarTexts[r], parseInt(r)).length, 0);
        }
      } else {
        return totalStarOnlySlots;
      }
    } else if (effectiveType === 'Registration') {
      return parseInt(regSlots || 0, 10);
    } else if (effectiveType === 'YT Video') {
      return ytCommentMode === 'custom_comments' ? parseText(ytCommentsText, 5).length : parseInt(ytSlots || 0, 10);
    }
    return 0;
  }, [effectiveType, reviewMode, multiStarMode, commentsText, globalRating, multiStarTexts, totalStarOnlySlots, regSlots, ytCommentMode, ytCommentsText, ytSlots]);

  const categories = [
    { id: 'All', label: 'All Tasks', icon: <AppsIcon sx={{ fontSize: 18 }} /> },
    { id: 'Android App', label: 'Google Play', icon: <AndroidIcon sx={{ fontSize: 18, color: '#10b981' }} /> },
    { id: 'iOS App', label: 'Apple App Store', icon: <AppleIcon sx={{ fontSize: 18, color: '#3b82f6' }} /> },
    { id: 'Registration', label: 'Web Registration', icon: <LanguageIcon sx={{ fontSize: 18, color: '#f59e0b' }} /> },
    { id: 'YT Video', label: 'YouTube Campaign', icon: <YouTubeIcon sx={{ fontSize: 18, color: '#ef4444' }} /> }
  ];

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 3, pb: 8 }}>
      
      {/* 1. Header Pod: Glassmorphic Executive Bar */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: '24px',
          border: '1px solid',
          borderColor: isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.2)',
          background: isDark
            ? 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(15,23,42,0.85) 100%)'
            : 'linear-gradient(135deg, rgba(238,242,255,0.8) 0%, rgba(255,255,255,0.95) 100%)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
          width: '100%'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 8px 24px rgba(99,102,241,0.35)'
            }}
          >
            <CommentIcon sx={{ fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
              Task Automation & Comment Engine
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Deploy verified review texts, star rating pools, registration instructions, and YouTube campaigns into production workstations.
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Chip
            icon={<CalendarMonthIcon sx={{ fontSize: '1rem !important' }} />}
            label={`IST Target: ${scheduleTime}`}
            sx={{
              bgcolor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)',
              color: '#6366f1',
              fontWeight: 700,
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: '12px'
            }}
          />
          <Chip
            icon={<SpeedIcon sx={{ fontSize: '1rem !important' }} />}
            label={`${filteredApps.length} Tasks Scheduled`}
            sx={{
              bgcolor: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)',
              color: '#10b981',
              fontWeight: 700,
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: '12px'
            }}
          />
        </Box>
      </Paper>

      {/* 2. Compact 1-Row Category Filter Bar (Grid 5 equal columns, No wrapping) */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' },
          gap: 1.5,
          width: '100%'
        }}
      >
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <Paper
              key={cat.id}
              elevation={0}
              onClick={() => setSelectedCategory(cat.id)}
              sx={{
                px: 2,
                py: 1.2,
                borderRadius: '14px',
                cursor: 'pointer',
                border: '1.5px solid',
                borderColor: isSelected
                  ? '#6366f1'
                  : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                bgcolor: isSelected
                  ? isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.08)'
                  : isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
                backdropFilter: 'blur(16px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1.2,
                minHeight: 48,
                transition: 'all 0.2s ease',
                boxShadow: isSelected ? '0 4px 14px rgba(99,102,241,0.25)' : 'none',
                '&:hover': {
                  borderColor: '#6366f1',
                  transform: 'translateY(-1px)'
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {cat.icon}
              </Box>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  color: isSelected ? '#6366f1' : 'text.primary',
                  whiteSpace: 'nowrap'
                }}
              >
                {cat.label}
              </Typography>
            </Paper>
          );
        })}
      </Box>

      {/* 3. Main Operational Command Card (Full Width edge-to-edge) */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, md: 3.5 },
          borderRadius: '24px',
          border: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 3.5,
          width: '100%'
        }}
      >
        {/* Section A: App Selection & Schedule Filter (Full Width 50/50 Grid) */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: '-0.01em' }}>
              1. Target Task & Release Schedule
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Select the live active task to provision comments or instructions for workers.
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '2.5fr 1fr' },
              gap: 2.5,
              width: '100%',
              alignItems: 'start'
            }}
          >
            {/* App Autocomplete */}
            <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Autocomplete
                fullWidth
                options={filteredApps}
                getOptionLabel={(option) => `[Task #${option.task_id || option.id.slice(0, 6)}] ${option.app_name} (${option.task_type || 'Android App'})`}
                value={selectedApp}
                onChange={handleAppChange}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    label="Select Application / Task *"
                    placeholder={`Search ${selectedCategory === 'All' ? 'any' : selectedCategory} task by name or ID...`} 
                    sx={{
                      width: '100%',
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '14px',
                        bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                      }
                    }}
                  />
                )}
              />

              {/* Selected App Live Insight Pill */}
              {selectedApp && (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: '12px',
                    bgcolor: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.05)',
                    border: '1px solid',
                    borderColor: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 1.5,
                    width: '100%'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Chip
                      size="small"
                      label={selectedApp.task_type || 'Task'}
                      sx={{
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        bgcolor: selectedApp.task_type === 'Android App' ? 'rgba(16,185,129,0.15)' :
                                selectedApp.task_type === 'iOS App' ? 'rgba(59,130,246,0.15)' :
                                selectedApp.task_type === 'Registration' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                        color: selectedApp.task_type === 'Android App' ? '#10b981' :
                               selectedApp.task_type === 'iOS App' ? '#3b82f6' :
                               selectedApp.task_type === 'Registration' ? '#f59e0b' : '#ef4444',
                        border: '1px solid',
                        borderColor: selectedApp.task_type === 'Android App' ? 'rgba(16,185,129,0.3)' :
                                     selectedApp.task_type === 'iOS App' ? 'rgba(59,130,246,0.3)' :
                                     selectedApp.task_type === 'Registration' ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'
                      }}
                    />
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                      Package: <span style={{ color: isDark ? '#fff' : '#000', fontFamily: 'monospace' }}>{selectedApp.app_package || 'N/A'}</span>
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                      Bulkers:
                    </Typography>
                    {assignedBulkersDisplay.length > 0 ? (
                      assignedBulkersDisplay.map((bName) => (
                        <Chip 
                          key={bName} 
                          label={bName} 
                          size="small" 
                          sx={{
                            fontWeight: 700,
                            borderRadius: '8px',
                            fontSize: '0.72rem',
                            bgcolor: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)',
                            color: '#6366f1'
                          }} 
                        />
                      ))
                    ) : (
                      <Chip 
                        label="No Bulkers Assigned" 
                        size="small" 
                        sx={{
                          fontWeight: 600,
                          borderRadius: '8px',
                          fontSize: '0.72rem',
                          bgcolor: 'rgba(245,158,11,0.15)',
                          color: '#f59e0b'
                        }} 
                      />
                    )}
                  </Box>
                </Box>
              )}
            </Box>

            {/* Target Schedule Date */}
            <Box sx={{ width: '100%' }}>
              <TextField
                fullWidth
                label="Target Publish Date (IST) *"
                type="date"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                sx={{
                  width: '100%',
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '14px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                  }
                }}
              />
            </Box>
          </Box>
        </Box>

        <Divider sx={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />

        {/* Section B: Engine Automation Protocols (Daily Limits, Timer Gap & Duplicate Link Guard) */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShieldIcon sx={{ color: '#6366f1', fontSize: 20 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                2. Engine Automation Protocols & Security Rules
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              Protects against bot spam, duplicate submissions, and unfair task hogging.
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
              gap: 2,
              width: '100%'
            }}
          >
            {/* 1. Limit per user */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '16px',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: 1
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>
                TASK LIMIT PER EARNER
              </Typography>
              <TextField
                fullWidth
                type="number"
                size="small"
                value={limit}
                onChange={e => setLimit(Math.max(1, Number(e.target.value)))}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '10px',
                    fontWeight: 700
                  }
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                Max times a single user can execute this task.
              </Typography>
            </Paper>

            {/* 2. Timer gap interval */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '16px',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: 1
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>
                TIMER GAP (MINUTES)
              </Typography>
              <TextField
                fullWidth
                type="number"
                size="small"
                disabled={!enableTimer}
                value={timerGap}
                onChange={e => setTimerGap(Math.max(1, Number(e.target.value)))}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '10px',
                    fontWeight: 700
                  }
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                Cooldown enforced between consecutive runs.
              </Typography>
            </Paper>

            {/* 3. Timer gap toggle */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '16px',
                border: '1px solid',
                borderColor: enableTimer ? 'rgba(99,102,241,0.4)' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                bgcolor: enableTimer
                  ? isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.05)'
                  : isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 1
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 800, color: enableTimer ? '#6366f1' : 'text.secondary' }}>
                WAITLIST COOLDOWN
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={enableTimer}
                    onChange={e => setEnableTimer(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.82rem' }}>
                    {enableTimer ? 'Enforced' : 'Disabled'}
                  </Typography>
                }
              />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                Locks next task until cooldown timer expires.
              </Typography>
            </Paper>

            {/* 4. Repeat Link Protection */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '16px',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: 1
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>
                REPEAT LINK GUARD
              </Typography>
              <Select
                size="small"
                fullWidth
                value={blockLinkMode}
                onChange={(e) => {
                  const val = e.target.value;
                  setBlockLinkMode(val);
                  if (val === 'custom' && !blockUntilDate) {
                    const d = new Date();
                    d.setDate(d.getDate() + 7);
                    setBlockUntilDate(d.toISOString().slice(0, 10));
                  }
                }}
                sx={{ borderRadius: '10px', fontWeight: 700, fontSize: '0.82rem' }}
              >
                <MenuItem value="7_days">7 Days Cooldown</MenuItem>
                <MenuItem value="custom">Custom Date Block</MenuItem>
                <MenuItem value="none">No Block (Allow Repeat)</MenuItem>
              </Select>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                Prevents repeat payouts for identical links.
              </Typography>
            </Paper>
          </Box>

          {/* If custom date block selected */}
          {blockLinkMode === 'custom' && (
            <Box sx={{ width: '100%', mt: 0.5 }}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="Block Until Date (IST) *"
                value={blockUntilDate}
                onChange={e => setBlockUntilDate(e.target.value)}
                helperText="Earners cannot repeat this task package link until this timestamp passes."
                FormHelperTextProps={{ sx: { fontSize: '0.72rem' } }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                  }
                }}
              />
            </Box>
          )}
        </Box>

        <Divider sx={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />

        {/* Section C: Dynamic Task Execution Workspaces */}

        {/* CASE 1: PLAY STORE & APP STORE (REVIEWS & STAR RATINGS) */}
        {(effectiveType === 'Android App' || effectiveType === 'iOS App') && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
            
            {/* Header with Mode Toggle */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 2,
                width: '100%'
              }}
            >
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {effectiveType === 'Android App' ? (
                    <AndroidIcon sx={{ color: '#10b981', fontSize: 24 }} />
                  ) : (
                    <AppleIcon sx={{ color: '#3b82f6', fontSize: 24 }} />
                  )}
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    3. App Review & Star Rating Distribution Engine
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Choose between verified text comment generation or star-only rating quotas.
                </Typography>
              </Box>

              {/* Text Comments vs Star Only Switcher */}
              <Box
                sx={{
                  display: 'flex',
                  p: 0.5,
                  borderRadius: '14px',
                  bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                  border: '1px solid',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
                }}
              >
                <Button
                  size="small"
                  variant={reviewMode === 'text' ? 'contained' : 'text'}
                  onClick={() => setReviewMode('text')}
                  startIcon={<CommentIcon sx={{ fontSize: 16 }} />}
                  sx={{
                    borderRadius: '10px',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    textTransform: 'none',
                    bgcolor: reviewMode === 'text' ? '#6366f1' : 'transparent',
                    color: reviewMode === 'text' ? '#fff' : 'text.secondary',
                    boxShadow: reviewMode === 'text' ? '0 4px 14px rgba(99,102,241,0.3)' : 'none'
                  }}
                >
                  Text Comments Mode
                </Button>
                <Button
                  size="small"
                  variant={reviewMode === 'star_only' ? 'contained' : 'text'}
                  onClick={() => setReviewMode('star_only')}
                  startIcon={<StarIcon sx={{ fontSize: 16 }} />}
                  sx={{
                    borderRadius: '10px',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    textTransform: 'none',
                    bgcolor: reviewMode === 'star_only' ? '#6366f1' : 'transparent',
                    color: reviewMode === 'star_only' ? '#fff' : 'text.secondary',
                    boxShadow: reviewMode === 'star_only' ? '0 4px 14px rgba(99,102,241,0.3)' : 'none'
                  }}
                >
                  Star Only Mode (No Comment)
                </Button>
              </Box>
            </Box>

            {/* Sub-mode A: Text Comments Workspace */}
            {reviewMode === 'text' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, width: '100%' }}>
                
                {/* Mode Toolbar: Multi-star switch + Global star select */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 2,
                    p: 2,
                    borderRadius: '16px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                    border: '1px solid',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    width: '100%'
                  }}
                >
                  {!multiStarMode ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        Target Rating for Pool:
                      </Typography>
                      <Select
                        size="small"
                        value={globalRating}
                        onChange={e => setGlobalRating(e.target.value)}
                        sx={{
                          width: 170,
                          borderRadius: '10px',
                          fontWeight: 700,
                          bgcolor: isDark ? 'rgba(255,255,255,0.04)' : '#fff'
                        }}
                      >
                        <MenuItem value={5}>⭐⭐⭐⭐⭐ (5 Star)</MenuItem>
                        <MenuItem value={4}>⭐⭐⭐⭐ (4 Star)</MenuItem>
                        <MenuItem value={3}>⭐⭐⭐ (3 Star)</MenuItem>
                        <MenuItem value={2}>⭐⭐ (2 Star)</MenuItem>
                        <MenuItem value={1}>⭐ (1 Star)</MenuItem>
                      </Select>
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#6366f1' }}>
                      Multi-Star Distribution Active (Separate Text Pools for 5★, 4★, 3★, 2★, 1★)
                    </Typography>
                  )}

                  <FormControlLabel
                    control={
                      <Switch
                        checked={multiStarMode}
                        onChange={e => setMultiStarMode(e.target.checked)}
                        color="secondary"
                      />
                    }
                    label={
                      <Typography variant="button" sx={{ fontWeight: 800, fontSize: '0.82rem' }}>
                        Split Multi-Star Mode
                      </Typography>
                    }
                  />
                </Box>

                {/* Single Global Textarea */}
                {!multiStarMode ? (
                  <Box sx={{ width: '100%' }}>
                    <TextField
                      fullWidth
                      multiline
                      rows={10}
                      placeholder="Paste review comments here (one comment per line)...&#10;&#10;Numbers (1., 2.), bullets (- * • ✔), and AI greetings ('Here are 10 reviews...') will be automatically parsed and filtered out."
                      value={commentsText}
                      onChange={(e) => setCommentsText(e.target.value)}
                      sx={{
                        width: '100%',
                        '& .MuiOutlinedInput-root': {
                          fontFamily: 'monospace',
                          fontSize: '0.88rem',
                          borderRadius: '16px',
                          bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.8)'
                        }
                      }}
                    />
                  </Box>
                ) : (
                  /* 5-Star Split Textareas */
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                      gap: 2,
                      width: '100%'
                    }}
                  >
                    {[5, 4, 3, 2, 1].map(rating => (
                      <Paper
                        key={rating}
                        elevation={0}
                        sx={{
                          p: 2,
                          borderRadius: '16px',
                          border: '1px solid',
                          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                          bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1,
                          gridColumn: rating === 5 ? { xs: 'span 1', md: 'span 2' } : 'span 1'
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#f59e0b' }}>
                            {'⭐'.repeat(rating)} ({rating}-Star Comments)
                          </Typography>
                          <Chip
                            size="small"
                            label={`${parseText(multiStarTexts[rating], rating).length} ready`}
                            sx={{ fontWeight: 700, fontSize: '0.72rem', borderRadius: '8px' }}
                          />
                        </Box>
                        <TextField
                          fullWidth
                          multiline
                          rows={rating === 5 ? 4 : 3}
                          placeholder={`Paste ${rating}-star comments here (one comment per line)...`}
                          value={multiStarTexts[rating]}
                          onChange={(e) => setMultiStarTexts({ ...multiStarTexts, [rating]: e.target.value })}
                          sx={{
                            width: '100%',
                            '& .MuiOutlinedInput-root': {
                              fontFamily: 'monospace',
                              fontSize: '0.85rem',
                              borderRadius: '12px'
                            }
                          }}
                        />
                      </Paper>
                    ))}
                  </Box>
                )}
              </Box>
            )}

            {/* Sub-mode B: Star Rating Only Workspace */}
            {reviewMode === 'star_only' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, width: '100%' }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 1.5,
                    p: 2,
                    borderRadius: '16px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                    border: '1px solid',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
                  }}
                >
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      Star Rating Slot Quotas
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Workers will receive tasks instructing them to submit the exact star rating on the app store without writing a review.
                    </Typography>
                  </Box>
                  <Chip
                    icon={<CheckCircleIcon sx={{ fontSize: '1rem !important' }} />}
                    label={`Total Slots to Create: ${totalStarOnlySlots}`}
                    sx={{
                      bgcolor: 'rgba(99,102,241,0.15)',
                      color: '#6366f1',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      py: 2,
                      borderRadius: '12px',
                      border: '1px solid rgba(99,102,241,0.3)'
                    }}
                  />
                </Box>

                {/* 5-Column Single Row Grid for 5★ down to 1★ */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' },
                    gap: 2,
                    width: '100%'
                  }}
                >
                  {[5, 4, 3, 2, 1].map((r) => (
                    <Paper
                      key={r}
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: '18px',
                        border: '1.5px solid',
                        borderColor: (starCounts[r] || 0) > 0 ? '#f59e0b' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                        bgcolor: (starCounts[r] || 0) > 0
                          ? isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.04)'
                          : isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 1.2,
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#f59e0b', letterSpacing: '0.1em' }}>
                        {'⭐'.repeat(r)}
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                        {r}-Star Quota
                      </Typography>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        value={starCounts[r] || ''}
                        onChange={(e) => setStarCounts({ ...starCounts, [r]: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '10px',
                            textAlign: 'center',
                            fontWeight: 800
                          }
                        }}
                      />
                      <Box sx={{ display: 'flex', gap: 0.5, width: '100%', justifyContent: 'center' }}>
                        <Button size="small" variant="outlined" onClick={() => addStarCount(r, 5)} sx={{ minWidth: 32, p: 0.4, fontSize: '0.72rem', borderRadius: '8px' }}>+5</Button>
                        <Button size="small" variant="outlined" onClick={() => addStarCount(r, 10)} sx={{ minWidth: 32, p: 0.4, fontSize: '0.72rem', borderRadius: '8px' }}>+10</Button>
                        <Button size="small" variant="outlined" onClick={() => addStarCount(r, 25)} sx={{ minWidth: 32, p: 0.4, fontSize: '0.72rem', borderRadius: '8px' }}>+25</Button>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        )}

        {/* CASE 2: REGISTRATION TASK MODE */}
        {effectiveType === 'Registration' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LanguageIcon sx={{ color: '#f59e0b', fontSize: 24 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  3. Web Registration & KYC Workflow Configuration
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Provide comprehensive signup guidelines, tutorial link, and total earner capacity.
              </Typography>
            </Box>

            {/* Registration Procedure Full Width Textarea */}
            <Box sx={{ width: '100%' }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 1 }}>
                REGISTRATION GUIDELINES & STEP-BY-STEP PROCEDURE *
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={6}
                placeholder="1. Click the registration link to open the portal&#10;2. Register with a valid Indian mobile number and email&#10;3. Verify OTP & complete basic profile KYC&#10;4. Take a clear screenshot of your profile screen displaying your registered User ID"
                value={regProcedure}
                onChange={(e) => setRegProcedure(e.target.value)}
                sx={{
                  width: '100%',
                  '& .MuiOutlinedInput-root': {
                    fontFamily: 'monospace',
                    fontSize: '0.88rem',
                    borderRadius: '16px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.8)'
                  }
                }}
              />
            </Box>

            {/* Video Provider + URL + Slots Grid */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1.5fr 1fr' },
                gap: 2,
                width: '100%'
              }}
            >
              {/* Video Provider */}
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 1 }}>
                  TUTORIAL VIDEO TYPE
                </Typography>
                <Select
                  fullWidth
                  size="small"
                  value={regVideoType}
                  onChange={(e) => setRegVideoType(e.target.value)}
                  sx={{ borderRadius: '12px', minHeight: 45, fontWeight: 700 }}
                >
                  <MenuItem value="youtube">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <YouTubeIcon sx={{ color: '#ef4444', fontSize: 18 }} /> YouTube Tutorial
                    </Box>
                  </MenuItem>
                  <MenuItem value="server">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <VideoLibraryIcon sx={{ color: '#3b82f6', fontSize: 18 }} /> Direct MP4 / Server
                    </Box>
                  </MenuItem>
                </Select>
              </Box>

              {/* Video URL */}
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 1 }}>
                  TUTORIAL VIDEO URL (OPTIONAL)
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder={regVideoType === 'youtube' ? 'https://www.youtube.com/watch?v=...' : 'https://...'}
                  value={regVideoUrl}
                  onChange={(e) => setRegVideoUrl(e.target.value)}
                  InputProps={{
                    startAdornment: <LinkIcon color="action" sx={{ mr: 1, fontSize: 18 }} />,
                    endAdornment: regVideoUrl && (
                      <InputAdornment position="end">
                        <Tooltip title="Test Video Link">
                          <IconButton size="small" onClick={() => window.open(regVideoUrl, '_blank')}>
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    )
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
              </Box>

              {/* Total Registration Slots */}
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 1 }}>
                  SLOTS / EARNER BUDGET *
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  placeholder="e.g. 50"
                  value={regSlots}
                  onChange={(e) => setRegSlots(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px', fontWeight: 800 } }}
                />
              </Box>
            </Box>
          </Box>
        )}

        {/* CASE 3: YOUTUBE CAMPAIGN MODE */}
        {effectiveType === 'YT Video' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <YouTubeIcon sx={{ color: '#ef4444', fontSize: 24 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  3. YouTube Video Campaign Engine
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Configure YouTube channel/video links, watch time duration, and engagement requirements.
              </Typography>
            </Box>

            {/* Video URL + Mode Selector Grid */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1.6fr 1fr' },
                gap: 2,
                width: '100%'
              }}
            >
              {/* YouTube Link */}
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 1 }}>
                  YOUTUBE VIDEO OR CHANNEL LINK *
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="https://www.youtube.com/watch?v=... or https://youtube.com/@channel"
                  value={ytVideoUrl}
                  onChange={(e) => setYtVideoUrl(e.target.value)}
                  InputProps={{
                    startAdornment: <YouTubeIcon sx={{ color: '#ef4444', mr: 1, fontSize: 18 }} />,
                    endAdornment: ytVideoUrl && (
                      <InputAdornment position="end">
                        <Tooltip title="Test Link">
                          <IconButton size="small" onClick={() => window.open(ytVideoUrl, '_blank')}>
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    )
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
              </Box>

              {/* Task Requirement Mode */}
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 1 }}>
                  REQUIREMENT MODE *
                </Typography>
                <Select
                  fullWidth
                  size="small"
                  value={ytCommentMode}
                  onChange={(e) => setYtCommentMode(e.target.value)}
                  sx={{ borderRadius: '12px', minHeight: 45, fontWeight: 700 }}
                >
                  <MenuItem value="none">Watch, Like & Subscribe Only</MenuItem>
                  <MenuItem value="custom_comments">Post Specific Comments (Admin Pool)</MenuItem>
                </Select>
              </Box>
            </Box>

            {/* Watch Instructions */}
            <Box sx={{ width: '100%' }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 1 }}>
                TASK PROCEDURE / WATCH INSTRUCTIONS *
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3.5}
                placeholder="e.g. Watch the complete video (minimum 3 mins), click Like, subscribe to the channel with notification bell on, and take a screenshot."
                value={ytProcedure}
                onChange={(e) => setYtProcedure(e.target.value)}
                sx={{
                  width: '100%',
                  '& .MuiOutlinedInput-root': {
                    fontFamily: 'monospace',
                    fontSize: '0.88rem',
                    borderRadius: '16px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.8)'
                  }
                }}
              />
            </Box>

            {/* Slots or Custom Comments */}
            {ytCommentMode === 'none' ? (
              <Box sx={{ width: { xs: '100%', sm: '300px' } }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 1 }}>
                  TOTAL WATCH SLOTS *
                </Typography>
                <TextField
                  fullWidth
                  type="number"
                  size="small"
                  placeholder="e.g. 50"
                  value={ytSlots}
                  onChange={(e) => setYtSlots(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px', fontWeight: 800 } }}
                />
              </Box>
            ) : (
              <Box sx={{ width: '100%' }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 1 }}>
                  PASTE YOUTUBE COMMENTS (ONE COMMENT PER LINE) *
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={8}
                  placeholder="Paste YouTube comments here (one comment per line)..."
                  value={ytCommentsText}
                  onChange={(e) => setYtCommentsText(e.target.value)}
                  sx={{
                    width: '100%',
                    '& .MuiOutlinedInput-root': {
                      fontFamily: 'monospace',
                      fontSize: '0.88rem',
                      borderRadius: '16px',
                      bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.8)'
                    }
                  }}
                />
              </Box>
            )}
          </Box>
        )}

        <Divider sx={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />

        {/* 4. Live Telemetry Summary & Primary Deploy Pod */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2.5,
            p: 2.5,
            borderRadius: '20px',
            bgcolor: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.04)',
            border: '1.5px solid',
            borderColor: isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.18)',
            width: '100%'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                bgcolor: 'rgba(99,102,241,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6366f1'
              }}
            >
              <PlaylistAddCheckIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                {liveParsedCount} Task Slots Ready to Deploy
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedApp ? `Targeting: ${selectedApp.app_name} (${effectiveType})` : 'Select an application above to activate deployment'}
              </Typography>
            </Box>
          </Box>

          <Button
            variant="contained"
            size="large"
            onClick={handleSave}
            disabled={saving || !selectedApp}
            startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
            sx={{
              px: 4,
              py: 1.5,
              borderRadius: '14px',
              fontWeight: 800,
              fontSize: '0.95rem',
              textTransform: 'none',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              boxShadow: '0 8px 24px rgba(99,102,241,0.35)',
              '&:hover': {
                background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                boxShadow: '0 12px 28px rgba(99,102,241,0.45)'
              },
              '&:disabled': {
                opacity: 0.5
              }
            }}
          >
            {saving ? 'Deploying to Workstations...' : `Deploy ${liveParsedCount > 0 ? liveParsedCount : ''} ${effectiveType} Task Slots`}
          </Button>
        </Box>
      </Paper>

      {/* Confirmation & Feedback Dialog */}
      <Dialog 
        open={alertData.open} 
        onClose={() => setAlertData({ ...alertData, open: false })}
        PaperProps={{
          sx: {
            borderRadius: '24px',
            p: 2,
            minWidth: '340px',
            maxWidth: '480px',
            textAlign: 'center',
            bgcolor: isDark ? 'rgba(15,23,42,0.95)' : '#ffffff',
            backdropFilter: 'blur(20px)',
            border: '1px solid',
            borderColor: alertData.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.35)'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.25rem', color: alertData.type === 'error' ? '#ef4444' : '#10b981', pb: 1 }}>
          {alertData.title}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.primary', fontSize: '0.92rem', mt: 0.5 }}>
            {alertData.message}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 1, pt: 1 }}>
          <Button 
            onClick={() => setAlertData({ ...alertData, open: false })} 
            variant="contained" 
            sx={{
              px: 4,
              py: 1,
              borderRadius: '12px',
              fontWeight: 700,
              textTransform: 'none',
              bgcolor: alertData.type === 'error' ? '#ef4444' : '#10b981',
              '&:hover': {
                bgcolor: alertData.type === 'error' ? '#dc2626' : '#059669'
              }
            }}
          >
            Acknowledge
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
