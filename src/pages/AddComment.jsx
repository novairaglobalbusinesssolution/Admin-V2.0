import { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, TextField, Button, 
  FormControlLabel, Select, MenuItem, Switch, Checkbox,
  Autocomplete, useTheme, Grid
} from '@mui/material';
import { supabase } from '../supabaseClient';
import {
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions
} from '@mui/material';

// Basic IST Time formatting
const getISTDate = () => {
  const d = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + istOffset);
  return istDate.toISOString().slice(0, 10); // YYYY-MM-DD
};

export default function AddComment() {
  const theme = useTheme();
  const [apps, setApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  
  // Settings State
  const [limit, setLimit] = useState(1);
  const [enableTimer, setEnableTimer] = useState(false);
  const [timerGap, setTimerGap] = useState(10);
  const [blockSameLink, setBlockSameLink] = useState(true);
  
  // Date/Time State
  const [scheduleTime, setScheduleTime] = useState(getISTDate());

  // Comment Input State
  const [multiStarMode, setMultiStarMode] = useState(false);
  const [globalRating, setGlobalRating] = useState(5);
  const [commentsText, setCommentsText] = useState('');
  const [multiStarTexts, setMultiStarTexts] = useState({ 5: '', 4: '', 3: '', 2: '', 1: '' });
  
  const [saving, setSaving] = useState(false);
  const [alertData, setAlertData] = useState({ open: false, title: '', message: '', type: 'success' });

  useEffect(() => {
    fetchApps(scheduleTime);
  }, [scheduleTime]);

  const fetchApps = async (selectedDate = scheduleTime) => {
    let query = supabase.from('apps').select('id, app_name, task_id, task_type, app_date');

    if (selectedDate) {
      query = query.eq('app_date', selectedDate);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (!error && data) {
      setApps(data);
      setSelectedApp((prev) => (prev && data.some(app => app.id === prev.id) ? prev : null));
    }
  };

  const handleAppChange = async (event, newValue) => {
    setSelectedApp(newValue);
    if (newValue) {
      // Fetch existing settings for this app to prefill
      const { data } = await supabase.from('apps')
        .select('comment_limit, enable_timer, timer_gap_minutes, block_same_link_7_days')
        .eq('id', newValue.id).single();
        
      if (data) {
        setLimit(data.comment_limit || 1);
        setEnableTimer(data.enable_timer || false);
        setTimerGap(data.timer_gap_minutes || 10);
        setBlockSameLink(data.block_same_link_7_days ?? true);
      }
    }
  };

  const handleSave = async () => {
    if (!selectedApp) {
      return setAlertData({ open: true, title: 'Error', message: 'Please select an App first.', type: 'error' });
    }

    setSaving(true);
    try {
      // 1. Update App Settings
      const { error: settingsError } = await supabase.from('apps').update({
        comment_limit: limit,
        enable_timer: enableTimer,
        timer_gap_minutes: timerGap,
        block_same_link_7_days: blockSameLink
      }).eq('id', selectedApp.id);

      if (settingsError) throw settingsError;

      // 2. Parse and Insert Comments
      let newComments = [];
      
      const parseText = (text, rating) => {
        if (!text.trim()) return [];
        return text.split('\n')
          .map(line => {
            const cleaned = line
              .trim()
              .replace(/^\s*(?:[A-Za-z]|\d+)[\).\-:\]\}]\s*/i, '')
              .replace(/^\s*(?:[A-Za-z]|\d+)\s*\.\s*/i, '')
              .replace(/^\s*[-*•]\s*/, '')
              .trim();
            return cleaned;
          })
          .filter(line => {
            if (line.length === 0) return false;
            const l = line.toLowerCase();
            if (l.includes("5-star review:")) return false;
            if (l.includes("here are") && l.includes("reviews")) return false;
            return true;
          })
          .map(content => ({
            app_id: selectedApp.id,
            content,
            rating,
            status: 'active'
          }));
      };

      if (!multiStarMode) {
        newComments = parseText(commentsText, globalRating);
      } else {
        Object.keys(multiStarTexts).forEach(r => {
          newComments = [...newComments, ...parseText(multiStarTexts[r], parseInt(r))];
        });
      }

      if (newComments.length === 0) {
        setSaving(false);
        return setAlertData({ open: true, title: 'Error', message: 'Please enter at least one comment.', type: 'error' });
      }

      const { error: insertError } = await supabase.from('app_comments').insert(newComments);
      if (insertError) throw insertError;

      // Send Bulk Notification
      try {
        await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/send-bulk-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'New Comment Task Available!',
            body: `A new task for "${selectedApp.app_name}" has been published. Earn rewards now!`,
            type: 'task'
          })
        });
      } catch (err) {
        console.error('Push notification failed:', err);
      }

      setAlertData({ open: true, title: 'Success', message: `Deployed ${newComments.length} comments successfully & Notified Users!`, type: 'success' });
      
      // Clear inputs
      setCommentsText('');
      setMultiStarTexts({ 5: '', 4: '', 3: '', 2: '', 1: '' });
      
    } catch (e) {
      console.error(e);
      setAlertData({ open: true, title: 'Error', message: e.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ maxWidth: '1400px', mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Add Comments</Typography>
      </Box>

      <Paper sx={{ p: 4, borderRadius: '16px', mb: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        
        {/* App Selection & Schedule */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, mb: 4, width: '100%' }}>
          <Box sx={{ flex: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Select Application</Typography>
            <Autocomplete
              options={apps}
              getOptionLabel={(option) => `[Task #${option.task_id}] ${option.app_name}`}
              value={selectedApp}
              onChange={handleAppChange}
              renderInput={(params) => <TextField {...params} placeholder="Search App by Name or Task ID" sx={{ '& .MuiOutlinedInput-root': { minHeight: '60px', fontSize: '1.1rem', borderRadius: '12px', padding: '5px' } }} />}
              fullWidth
            />
          </Box>
          <Box sx={{ flex: 1, minWidth: '220px' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Publish Date (IST Kolkata 5:30)</Typography>
            <TextField
              type="date"
              fullWidth
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { minHeight: '60px', fontSize: '1.1rem', borderRadius: '12px' } }}
            />
          </Box>
        </Box>

        <Box sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)', p: 3, borderRadius: '12px', mb: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Daily Limits / Scheduling</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>1 User Take Comment Limit:</Typography>
              <TextField type="number" value={limit} onChange={e => setLimit(Number(e.target.value))} size="small" sx={{ width: 100 }} />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>Timer Gap (Minutes):</Typography>
              <TextField type="number" value={timerGap} onChange={e => setTimerGap(Number(e.target.value))} size="small" sx={{ width: 100 }} disabled={!enableTimer} />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mt: 3 }}>
            <FormControlLabel control={<Checkbox size="medium" checked={blockSameLink} onChange={e => setBlockSameLink(e.target.checked)} />} label={<Typography variant="body1" sx={{ fontWeight: 600 }}>Block Duplicate App Link (7 Days)</Typography>} />
            <FormControlLabel control={<Checkbox size="medium" checked={enableTimer} onChange={e => setEnableTimer(e.target.checked)} />} label={<Typography variant="body1" sx={{ fontWeight: 600 }}>Enable Waitlist Timer (Gap)</Typography>} />
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Paste Comments List</Typography>
          <FormControlLabel 
            control={<Switch checked={multiStarMode} onChange={e => setMultiStarMode(e.target.checked)} color="secondary" size="medium" />} 
            label={<Typography variant="button" sx={{ fontWeight: 700 }}>Multi-Star Mode</Typography>} 
          />
        </Box>

        {!multiStarMode ? (
          <>
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>Global Rating:</Typography>
              <Select value={globalRating} onChange={e => setGlobalRating(e.target.value)} sx={{ width: 180 }}>
                <MenuItem value={5}>⭐⭐⭐⭐⭐</MenuItem>
                <MenuItem value={4}>⭐⭐⭐⭐</MenuItem>
                <MenuItem value={3}>⭐⭐⭐</MenuItem>
                <MenuItem value={2}>⭐⭐</MenuItem>
                <MenuItem value={1}>⭐</MenuItem>
              </Select>
            </Box>
            <TextField
              fullWidth
              multiline
              rows={15}
              placeholder="Paste comments here (one comment per line)..."
              value={commentsText}
              onChange={(e) => setCommentsText(e.target.value)}
              sx={{ '& .MuiInputBase-root': { fontFamily: 'monospace' } }}
            />
          </>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {[5, 4, 3, 2, 1].map(rating => (
              <Box key={rating}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>{'⭐'.repeat(rating)} Comments</Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  placeholder={`Paste ${rating}-star comments here (one per line)...`}
                  value={multiStarTexts[rating]}
                  onChange={(e) => setMultiStarTexts({...multiStarTexts, [rating]: e.target.value})}
                  sx={{ '& .MuiInputBase-root': { fontFamily: 'monospace' } }}
                />
              </Box>
            ))}
          </Box>
        )}

        <Button 
          variant="contained" 
          size="large" 
          fullWidth 
          onClick={handleSave} 
          disabled={saving || !selectedApp}
          sx={{ mt: 4, py: 1.5, fontSize: '1.1rem', borderRadius: '12px' }}
        >
          {saving ? 'Processing...' : 'Save & Deploy Comments'}
        </Button>
      </Paper>

      {/* Material Alert Dialog */}
      <Dialog 
        open={alertData.open} 
        onClose={() => setAlertData({ ...alertData, open: false })}
        PaperProps={{ sx: { borderRadius: '28px', p: 2, minWidth: '320px', textAlign: 'center' } }}
      >
        <DialogTitle sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 600, fontSize: '1.4rem', color: alertData.type === 'error' ? 'error.main' : 'success.main' }}>
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
            sx={{ px: 4, py: 1, borderRadius: '100px', fontWeight: 600 }}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>

    </Box>

  );
}
