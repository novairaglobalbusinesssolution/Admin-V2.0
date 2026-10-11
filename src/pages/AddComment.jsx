import { useState, useEffect, useMemo } from 'react';
import { 
  Box, Typography, Paper, TextField, Button, 
  FormControlLabel, Select, MenuItem, Switch, Checkbox, Radio, RadioGroup,
  Autocomplete, useTheme, Grid, Tabs, Tab, Chip, Card,
  CardContent, InputAdornment, IconButton, Tooltip, Divider,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions
} from '@mui/material';
import { supabase } from '../supabaseClient';

// MUI Icons
import AndroidIcon from '@mui/icons-material/Android';
import AppleIcon from '@mui/icons-material/Apple';
import AppRegistrationIcon from '@mui/icons-material/AppRegistration';
import YouTubeIcon from '@mui/icons-material/YouTube';
import StarIcon from '@mui/icons-material/Star';
import CommentIcon from '@mui/icons-material/Comment';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import LinkIcon from '@mui/icons-material/Link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import TimerIcon from '@mui/icons-material/Timer';
import BlockIcon from '@mui/icons-material/Block';
import AppsIcon from '@mui/icons-material/Apps';

// Basic IST Time formatting
const getISTDate = () => {
  const d = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + istOffset);
  return istDate.toISOString().slice(0, 10); // YYYY-MM-DD
};

export default function AddComment() {
  const theme = useTheme();
  
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
  // 'text' = Normal text comments, 'star_only' = Only star ratings without comment text
  const [reviewMode, setReviewMode] = useState('text');
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
      // Auto-switch category tab to match the selected app's task type if not already
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
          setRegProcedure(data.instructions || '1. Download / Open the link\n2. Complete registration with mobile/email\n3. Verify OTP and take screenshot of dashboard');
          setRegVideoUrl(data.app_package || '');
        } else if (newValue.task_type === 'YT Video') {
          setYtProcedure(data.instructions || 'Watch full video, like, and subscribe to the channel.');
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
      return setAlertData({ open: true, title: 'Error', message: 'Please select an Application / Task first.', type: 'error' });
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

      // 2. Process by Task Type
      if (effectiveType === 'Android App' || effectiveType === 'iOS App') {
        if (reviewMode === 'text') {
          if (!multiStarMode) {
            newComments = parseText(commentsText, globalRating);
          } else {
            Object.keys(multiStarTexts).forEach(r => {
              newComments = [...newComments, ...parseText(multiStarTexts[r], parseInt(r))];
            });
          }
          if (newComments.length === 0) {
            throw new Error('Please enter at least one comment in the text box.');
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
          if (newComments.length === 0) {
            throw new Error('Please enter a quantity greater than 0 for at least one star rating.');
          }
        }
      } else if (effectiveType === 'Registration') {
        if (!regProcedure.trim()) {
          throw new Error('Please enter the registration guidelines / procedure.');
        }
        
        let instructionsText = regProcedure.trim();
        if (regVideoUrl.trim()) {
          instructionsText += `\n\nTutorial Video (${regVideoType === 'server' ? 'Server Video' : 'YouTube'}): ${regVideoUrl.trim()}`;
        }
        appUpdatePayload.instructions = instructionsText;

        const count = parseInt(regSlots || 1, 10);
        if (count <= 0) throw new Error('Please specify at least 1 registration slot.');

        for (let i = 0; i < count; i++) {
          newComments.push({
            app_id: selectedApp.id,
            content: '', // Registration tasks use instructions, no dummy comment text
            rating: 5,
            status: 'active'
          });
        }
      } else if (effectiveType === 'YT Video') {
        if (!ytProcedure.trim()) {
          throw new Error('Please enter the YouTube task instructions / procedure.');
        }

        let ytInstructions = ytProcedure.trim();
        if (ytVideoUrl.trim()) {
          ytInstructions += `\n\nYouTube Link: ${ytVideoUrl.trim()}`;
          appUpdatePayload.app_package = ytVideoUrl.trim();
        }
        appUpdatePayload.instructions = ytInstructions;

        if (ytCommentMode === 'custom_comments') {
          newComments = parseText(ytCommentsText, 5);
          if (newComments.length === 0) {
            throw new Error('Please paste at least one YouTube comment (Admin custom added).');
          }
        } else {
          // Watch & Like only (Without Comment): Slots created with strictly blank content. Zero dummy comments!
          const count = parseInt(ytSlots || 1, 10);
          if (count <= 0) throw new Error('Please specify at least 1 video watch slot.');
          for (let i = 0; i < count; i++) {
            newComments.push({
              app_id: selectedApp.id,
              content: '', // Admin did not add extra comment, so content is completely blank
              rating: 5,
              status: 'active'
            });
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

      // 5. Trigger Notifications exclusively to workers of assigned bulkers
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

        await fetch(`${import.meta.env.DEV ? 'http://localhost:5000' : 'https://admin-v2-backend.onrender.com'}/api/send-bulk-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            app_id: selectedApp.id,
            bulker_ids: assignedBulkerIds,
            title: `New ${effectiveType} Task Available!`,
            body: `Task for "${selectedApp.app_name}" has been published with ${newComments.length} slots. Earn rewards now!`,
            type: 'task'
          })
        });
      } catch (err) {
        console.warn('Push notification failed:', err);
      }

      setAlertData({ 
        open: true, 
        title: 'Task Configured Successfully!', 
        message: `Deployed ${newComments.length} task slots/comments for "${selectedApp.app_name}". Push notification sent exclusively to assigned bulker earners!`, 
        type: 'success' 
      });

      // Clear dynamic inputs
      setCommentsText('');
      setMultiStarTexts({ 5: '', 4: '', 3: '', 2: '', 1: '' });
      setStarCounts({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
      setYtCommentsText('');

    } catch (e) {
      console.error(e);
      setAlertData({ open: true, title: 'Error', message: e.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Helper for star count quick buttons
  const addStarCount = (rating, increment) => {
    setStarCounts(prev => ({
      ...prev,
      [rating]: Math.max(0, (parseInt(prev[rating], 10) || 0) + increment)
    }));
  };

  const totalStarOnlySlots = Object.values(starCounts).reduce((a, b) => a + (parseInt(b, 10) || 0), 0);

  return (
    <Box sx={{ maxWidth: '1400px', mx: 'auto', pb: 10 }}>
      
      {/* Page Title */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Deploy Tasks & Comments</Typography>
          <Typography variant="body2" color="text.secondary">Configure reviews, ratings, registration guidelines, or video tasks by category.</Typography>
        </Box>
      </Box>

      {/* Category Tabs */}
      <Paper elevation={0} sx={{ borderRadius: '16px', mb: 3, p: 0.5, border: `1px solid ${theme.palette.divider}`, bgcolor: theme.palette.mode === 'light' ? '#fbfbfb' : 'background.paper' }}>
        <Tabs 
          value={selectedCategory} 
          onChange={(e, val) => setSelectedCategory(val)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.95rem',
              borderRadius: '12px',
              minHeight: 48,
              mr: 1
            }
          }}
        >
          <Tab value="All" label="All Tasks" icon={<AppsIcon fontSize="small" />} iconPosition="start" />
          <Tab value="Android App" label="Android App" icon={<AndroidIcon fontSize="small" color="success" />} iconPosition="start" />
          <Tab value="iOS App" label="iOS App" icon={<AppleIcon fontSize="small" />} iconPosition="start" />
          <Tab value="Registration" label="Registration" icon={<AppRegistrationIcon fontSize="small" color="primary" />} iconPosition="start" />
          <Tab value="YT Video" label="YT Video" icon={<YouTubeIcon fontSize="small" color="error" />} iconPosition="start" />
        </Tabs>
      </Paper>

      <Paper sx={{ p: { xs: 2.5, md: 4 }, borderRadius: '24px', mb: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: `1px solid ${theme.palette.divider}` }}>
        
        {/* App Selection & Schedule */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, mb: 4, width: '100%' }}>
          <Box sx={{ flex: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Select Application / Task</Typography>
              {selectedApp && (
                <Chip 
                  size="small" 
                  label={selectedApp.task_type || 'Task'} 
                  color={
                    selectedApp.task_type === 'Android App' ? 'success' : 
                    selectedApp.task_type === 'iOS App' ? 'default' : 
                    selectedApp.task_type === 'Registration' ? 'primary' : 'error'
                  }
                  sx={{ fontWeight: 700, borderRadius: '8px' }} 
                />
              )}
            </Box>
            <Autocomplete
              options={filteredApps}
              getOptionLabel={(option) => `[Task #${option.task_id}] ${option.app_name} (${option.task_type || 'Android App'})`}
              value={selectedApp}
              onChange={handleAppChange}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  placeholder={`Search ${selectedCategory === 'All' ? 'any' : selectedCategory} Task by Name or ID`} 
                  sx={{ '& .MuiOutlinedInput-root': { minHeight: '56px', fontSize: '1.05rem', borderRadius: '14px' } }} 
                />
              )}
              fullWidth
            />
            {selectedApp && (
              <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  Assigned Bulker(s):
                </Typography>
                {assignedBulkersDisplay.length > 0 ? (
                  assignedBulkersDisplay.map((bName) => (
                    <Chip 
                      key={bName} 
                      label={bName} 
                      size="small" 
                      variant="outlined" 
                      color="primary"
                      sx={{ fontWeight: 700, borderRadius: '8px' }} 
                    />
                  ))
                ) : (
                  <Chip 
                    label="No Bulkers Assigned" 
                    size="small" 
                    color="warning" 
                    variant="outlined"
                    sx={{ fontWeight: 600, borderRadius: '8px' }} 
                  />
                )}
                <Typography variant="caption" sx={{ color: 'text.secondary', ml: 0.5 }}>
                  (Push notification will strictly reach ONLY devices of workers under {assignedBulkersDisplay.length > 0 ? `these ${assignedBulkersDisplay.length} bulker(s)` : 'assigned bulkers'})
                </Typography>
              </Box>
            )}
          </Box>
          <Box sx={{ flex: 1, minWidth: '220px' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Publish Date (IST Kolkata)</Typography>
            <TextField
              type="date"
              fullWidth
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { minHeight: '56px', fontSize: '1rem', borderRadius: '14px' } }}
            />
          </Box>
        </Box>

        {/* Daily Limits & Time Gap Section */}
        <Box sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)', p: 3, borderRadius: '16px', mb: 4, border: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <TimerIcon color="primary" fontSize="small" /> Daily Limits & Scheduling Settings
          </Typography>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>1 User Take Limit:</Typography>
              <TextField 
                type="number" 
                fullWidth 
                value={limit} 
                onChange={e => setLimit(Number(e.target.value))} 
                size="small" 
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} 
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Timer Gap (Minutes):</Typography>
              <TextField 
                type="number" 
                fullWidth 
                value={timerGap} 
                onChange={e => setTimerGap(Number(e.target.value))} 
                size="small" 
                disabled={!enableTimer} 
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} 
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControlLabel 
                control={<Checkbox checked={enableTimer} onChange={e => setEnableTimer(e.target.checked)} color="primary" />} 
                label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Enable Waitlist Timer Gap</Typography>} 
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Repeat Link Block Rule:</Typography>
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
                  sx={{ borderRadius: '10px' }}
                >
                  <MenuItem value="7_days">7 Days Cooldown (Default)</MenuItem>
                  <MenuItem value="custom">Set Custom Date Block</MenuItem>
                  <MenuItem value="none">No Block (Allow Repeat)</MenuItem>
                </Select>
              </Box>
            </Grid>
            {blockLinkMode === 'custom' && (
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, color: 'primary.main' }}>
                  Block Until Date (IST):
                </Typography>
                <TextField 
                  type="date" 
                  fullWidth 
                  value={blockUntilDate} 
                  onChange={e => setBlockUntilDate(e.target.value)} 
                  size="small" 
                  helperText="User cannot repeat task until this date passes"
                  FormHelperTextProps={{ sx: { fontSize: '0.72rem', mt: 0.5 } }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} 
                />
              </Grid>
            )}
          </Grid>
        </Box>

        {/* ============================================================== */}
        {/* CASE 1: ANDROID APP & IOS APP (REVIEW & STAR RATINGS)          */}
        {/* ============================================================== */}
        {(effectiveType === 'Android App' || effectiveType === 'iOS App') && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                  {effectiveType === 'Android App' ? <AndroidIcon color="success" /> : <AppleIcon />} 
                  App Reviews & Star Ratings
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Choose whether to deploy text comments or star ratings only.
                </Typography>
              </Box>

              {/* Toggle Review Mode */}
              <Box sx={{ display: 'flex', bgcolor: theme.palette.mode === 'light' ? '#eceff1' : 'rgba(255,255,255,0.06)', p: 0.5, borderRadius: '12px' }}>
                <Button 
                  size="small"
                  variant={reviewMode === 'text' ? 'contained' : 'text'}
                  color={reviewMode === 'text' ? 'primary' : 'inherit'}
                  onClick={() => setReviewMode('text')}
                  startIcon={<CommentIcon />}
                  sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700 }}
                >
                  Text Comments
                </Button>
                <Button 
                  size="small"
                  variant={reviewMode === 'star_only' ? 'contained' : 'text'}
                  color={reviewMode === 'star_only' ? 'primary' : 'inherit'}
                  onClick={() => setReviewMode('star_only')}
                  startIcon={<StarIcon />}
                  sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700 }}
                >
                  Star Only (No Comment)
                </Button>
              </Box>
            </Box>

            {/* Sub-mode A: Text Comments */}
            {reviewMode === 'text' && (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Paste Comments List</Typography>
                  <FormControlLabel 
                    control={<Switch checked={multiStarMode} onChange={e => setMultiStarMode(e.target.checked)} color="secondary" />} 
                    label={<Typography variant="button" sx={{ fontWeight: 700 }}>Multi-Star Mode</Typography>} 
                  />
                </Box>

                {!multiStarMode ? (
                  <>
                    <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Global Rating:</Typography>
                      <Select value={globalRating} onChange={e => setGlobalRating(e.target.value)} size="small" sx={{ width: 160, borderRadius: '10px' }}>
                        <MenuItem value={5}>⭐⭐⭐⭐⭐ (5 Star)</MenuItem>
                        <MenuItem value={4}>⭐⭐⭐⭐ (4 Star)</MenuItem>
                        <MenuItem value={3}>⭐⭐⭐ (3 Star)</MenuItem>
                        <MenuItem value={2}>⭐⭐ (2 Star)</MenuItem>
                        <MenuItem value={1}>⭐ (1 Star)</MenuItem>
                      </Select>
                    </Box>
                    <TextField
                      fullWidth
                      multiline
                      rows={12}
                      placeholder="Paste review comments here (one comment per line)... Numbers (1., 2.) and bullets will be cleaned automatically."
                      value={commentsText}
                      onChange={(e) => setCommentsText(e.target.value)}
                      sx={{ '& .MuiOutlinedInput-root': { fontFamily: 'monospace', borderRadius: '14px' } }}
                    />
                  </>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    {[5, 4, 3, 2, 1].map(rating => (
                      <Box key={rating}>
                        <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 700 }}>
                          {'⭐'.repeat(rating)} ({rating} Star Comments)
                        </Typography>
                        <TextField
                          fullWidth
                          multiline
                          rows={3.5}
                          placeholder={`Paste ${rating}-star comments here (one per line)...`}
                          value={multiStarTexts[rating]}
                          onChange={(e) => setMultiStarTexts({...multiStarTexts, [rating]: e.target.value})}
                          sx={{ '& .MuiOutlinedInput-root': { fontFamily: 'monospace', borderRadius: '12px' } }}
                        />
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            )}

            {/* Sub-mode B: Star Rating Only */}
            {reviewMode === 'star_only' && (
              <Box sx={{ p: 3, borderRadius: '16px', bgcolor: theme.palette.mode === 'light' ? '#fdfdfd' : 'rgba(255,255,255,0.02)', border: `1px solid ${theme.palette.divider}` }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Specify Star Rating Quantities
                  </Typography>
                  <Chip 
                    label={`Total Slots to Create: ${totalStarOnlySlots}`} 
                    color="primary" 
                    sx={{ fontWeight: 700, fontSize: '0.9rem', py: 2, borderRadius: '10px' }} 
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Workers will receive tasks instructing them to give the selected star rating on Play Store / App Store without typing any text comment.
                </Typography>

                <Grid container spacing={2.5}>
                  {[5, 4, 3, 2, 1].map(r => (
                    <Grid item xs={12} sm={6} md={2.4} key={r}>
                      <Card variant="outlined" sx={{ borderRadius: '14px', p: 2, textAlign: 'center' }}>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: '#f59e0b', mb: 0.5 }}>
                          {'⭐'.repeat(r)}
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 1.5, color: 'text.secondary' }}>
                          {r}-Star Rating
                        </Typography>
                        <TextField 
                          type="number"
                          fullWidth
                          size="small"
                          label="Quantity"
                          value={starCounts[r] || ''}
                          onChange={(e) => setStarCounts({ ...starCounts, [r]: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', textAlign: 'center' } }}
                        />
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, mt: 1 }}>
                          <Button size="small" variant="outlined" onClick={() => addStarCount(r, 5)} sx={{ minWidth: 32, p: 0.3, fontSize: '0.75rem' }}>+5</Button>
                          <Button size="small" variant="outlined" onClick={() => addStarCount(r, 10)} sx={{ minWidth: 32, p: 0.3, fontSize: '0.75rem' }}>+10</Button>
                          <Button size="small" variant="outlined" onClick={() => addStarCount(r, 25)} sx={{ minWidth: 32, p: 0.3, fontSize: '0.75rem' }}>+25</Button>
                        </Box>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
          </Box>
        )}

        {/* ============================================================== */}
        {/* CASE 2: REGISTRATION TASK MODE                                  */}
        {/* ============================================================== */}
        {effectiveType === 'Registration' && (
          <Box sx={{ p: 3, borderRadius: '16px', bgcolor: theme.palette.mode === 'light' ? '#fdfdfd' : 'rgba(255,255,255,0.02)', border: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <AppRegistrationIcon color="primary" /> Registration Task Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Provide the step-by-step registration procedure and tutorial video link for workers to complete the signup successfully.
            </Typography>

            <Grid container spacing={3}>
              {/* Guidelines / Procedure */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Registration Guidelines & Step-by-Step Procedure *
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={6}
                  placeholder={`Example:\n1. Click the link to open the registration page\n2. Sign up using a valid Indian mobile number & verify OTP\n3. Complete basic profile KYC\n4. Take a clear screenshot of your account profile screen showing your user ID`}
                  value={regProcedure}
                  onChange={(e) => setRegProcedure(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px', fontFamily: 'monospace' } }}
                />
              </Grid>

              {/* Tutorial Video Type & URL */}
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Tutorial Video Type</Typography>
                <Select
                  fullWidth
                  size="small"
                  value={regVideoType}
                  onChange={(e) => setRegVideoType(e.target.value)}
                  sx={{ borderRadius: '12px', minHeight: 45 }}
                >
                  <MenuItem value="youtube">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <YouTubeIcon color="error" fontSize="small" /> YouTube Tutorial Link
                    </Box>
                  </MenuItem>
                  <MenuItem value="server">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <VideoLibraryIcon color="primary" fontSize="small" /> Server / Direct MP4 Link
                    </Box>
                  </MenuItem>
                </Select>
              </Grid>

              <Grid item xs={12} md={5}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Tutorial Video URL (Optional)</Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder={regVideoType === 'youtube' ? 'https://www.youtube.com/watch?v=...' : 'https://res.cloudinary.com/... or server link'}
                  value={regVideoUrl}
                  onChange={(e) => setRegVideoUrl(e.target.value)}
                  InputProps={{
                    startAdornment: <LinkIcon color="action" sx={{ mr: 1, fontSize: 20 }} />,
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
              </Grid>

              {/* Task Slots */}
              <Grid item xs={12} md={3}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Registration Slots / Capacity *</Typography>
                <TextField
                  fullWidth
                  type="number"
                  size="small"
                  placeholder="e.g. 50"
                  value={regSlots}
                  onChange={(e) => setRegSlots(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
                <Typography variant="caption" color="text.secondary">Number of workers who can take this task</Typography>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* ============================================================== */}
        {/* CASE 3: YT VIDEO TASK MODE                                     */}
        {/* ============================================================== */}
        {effectiveType === 'YT Video' && (
          <Box sx={{ p: 3, borderRadius: '16px', bgcolor: theme.palette.mode === 'light' ? '#fdfdfd' : 'rgba(255,255,255,0.02)', border: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <YouTubeIcon color="error" /> YouTube Video Task Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Configure watch time, channel/video link, and choose whether workers must post specific comments or just watch & like.
            </Typography>

            <Grid container spacing={3}>
              {/* YouTube Video or Channel Link */}
              <Grid item xs={12} md={8}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  YouTube Video Link or Channel Link *
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="https://www.youtube.com/watch?v=... or https://youtube.com/@channel"
                  value={ytVideoUrl}
                  onChange={(e) => setYtVideoUrl(e.target.value)}
                  InputProps={{
                    startAdornment: <YouTubeIcon color="error" sx={{ mr: 1, fontSize: 20 }} />,
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
              </Grid>

              {/* Task Mode (Watch & Like vs Paste Comments) */}
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Task Requirement Mode</Typography>
                <Select
                  fullWidth
                  size="small"
                  value={ytCommentMode}
                  onChange={(e) => setYtCommentMode(e.target.value)}
                  sx={{ borderRadius: '12px', minHeight: 45 }}
                >
                  <MenuItem value="none">Watch, Like & Subscribe Only (Without Comment)</MenuItem>
                  <MenuItem value="custom_comments">Post Specific Comments (Admin Added Only)</MenuItem>
                </Select>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  {ytCommentMode === 'none' 
                    ? 'Pure watch & like task. Absolutely no dummy comments will be added.' 
                    : 'Only comments explicitly entered by you will be assigned.'}
                </Typography>
              </Grid>

              {/* Task Description / Procedure */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Task Procedure / Watch Instructions *
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={3.5}
                  placeholder="e.g. Watch the complete video (minimum 3 mins), click Like, subscribe to the channel with notification bell on, and take a screenshot."
                  value={ytProcedure}
                  onChange={(e) => setYtProcedure(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px', fontFamily: 'monospace' } }}
                />
              </Grid>

              {/* If Watch & Like only: Slots */}
              {ytCommentMode === 'none' && (
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Watch Task Slots / Capacity *</Typography>
                  <TextField
                    fullWidth
                    type="number"
                    size="small"
                    placeholder="e.g. 50"
                    value={ytSlots}
                    onChange={(e) => setYtSlots(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                  />
                  <Typography variant="caption" color="text.secondary">Total workers who can perform this task</Typography>
                </Grid>
              )}

              {/* If specific comments: Comments List */}
              {ytCommentMode === 'custom_comments' && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    Paste YouTube Comments List (One per line) *
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={8}
                    placeholder="Paste YouTube comments here (one comment per line)..."
                    value={ytCommentsText}
                    onChange={(e) => setYtCommentsText(e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px', fontFamily: 'monospace' } }}
                  />
                </Grid>
              )}
            </Grid>
          </Box>
        )}

        {/* Save & Deploy Button */}
        <Button 
          variant="contained" 
          size="large" 
          fullWidth 
          onClick={handleSave} 
          disabled={saving || !selectedApp}
          sx={{ 
            mt: 4, 
            py: 1.8, 
            fontSize: '1.15rem', 
            fontWeight: 700, 
            borderRadius: '16px',
            textTransform: 'none',
            boxShadow: '0 8px 24px rgba(25, 118, 210, 0.25)'
          }}
        >
          {saving ? 'Processing & Deploying Tasks...' : `Save & Deploy ${effectiveType} Task`}
        </Button>
      </Paper>

      {/* Material Alert Dialog */}
      <Dialog 
        open={alertData.open} 
        onClose={() => setAlertData({ ...alertData, open: false })}
        PaperProps={{ sx: { borderRadius: '28px', p: 2, minWidth: '320px', textAlign: 'center' } }}
      >
        <DialogTitle sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 700, fontSize: '1.4rem', color: alertData.type === 'error' ? 'error.main' : 'success.main' }}>
          {alertData.title}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.primary', fontSize: '1.05rem', mt: 1 }}>
            {alertData.message}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2, pt: 1 }}>
          <Button 
            onClick={() => setAlertData({ ...alertData, open: false })} 
            variant="contained" 
            color={alertData.type === 'error' ? 'error' : 'success'} 
            disableElevation 
            sx={{ px: 4, py: 1, borderRadius: '100px', fontWeight: 600, textTransform: 'none' }}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
