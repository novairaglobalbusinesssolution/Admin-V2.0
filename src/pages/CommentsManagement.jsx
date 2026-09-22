import { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Tabs, Tab, TextField, Button, 
  List, ListItem, ListItemText, Divider, IconButton, Chip,
  useTheme, CircularProgress, Avatar, Checkbox, FormControlLabel,
  Select, MenuItem, Switch, Snackbar, Alert
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import CommentIcon from '@mui/icons-material/Comment';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import Swal from 'sweetalert2';

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function CommentsManagement() {
  const { appId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();

  const [tabValue, setTabValue] = useState(0);
  const [appDetails, setAppDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  // Settings State
  const [limit, setLimit] = useState(1);
  const [enableTimer, setEnableTimer] = useState(false);
  const [timerGap, setTimerGap] = useState(10);
  const [blockSameLink, setBlockSameLink] = useState(true);
  const [allowDuplicates, setAllowDuplicates] = useState(false);

  // Comment Input State
  const [multiStarMode, setMultiStarMode] = useState(false);
  const [globalRating, setGlobalRating] = useState(5);
  const [commentsText, setCommentsText] = useState('');
  const [multiStarTexts, setMultiStarTexts] = useState({ 5: '', 4: '', 3: '', 2: '', 1: '' });
  
  const [saving, setSaving] = useState(false);
  const [manageComments, setManageComments] = useState([]);
  const [loadingManage, setLoadingManage] = useState(false);

  // Completions State
  const [completions, setCompletions] = useState([]);
  const [loadingCompletions, setLoadingCompletions] = useState(false);

  useEffect(() => {
    fetchAppDetails();
    fetchManageComments();
    fetchCompletions();
  }, [appId]);

  const fetchAppDetails = async () => {
    try {
      const { data, error } = await supabase.from('apps')
        .select('id, task_id, app_name, task_type, comment_limit, enable_timer, timer_gap_minutes, block_same_link_7_days')
        .eq('id', appId).single();
        
      if (error) throw error;
      setAppDetails(data);
      setLimit(data.comment_limit || 1);
      setEnableTimer(data.enable_timer || false);
      setTimerGap(data.timer_gap_minutes || 10);
      setBlockSameLink(data.block_same_link_7_days ?? true);
    } catch (e) {
      console.error(e);
      setSnack({ open: true, message: 'Failed to load app details.', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchManageComments = async () => {
    setLoadingManage(true);
    try {
      const { data, error } = await supabase.from('app_comments')
        .select('*')
        .eq('app_id', appId)
        .order('created_at', { ascending: false });
      if (!error && data) setManageComments(data);
    } catch(e) {
      console.error(e);
    } finally {
      setLoadingManage(false);
    }
  };

  const fetchCompletions = async () => {
    setLoadingCompletions(true);
    try {
      // Fetch review_submit_data with joined comment text
      const { data, error } = await supabase.from('review_submit_data')
        .select(`
          *,
          app_comments ( content )
        `)
        .eq('app_id', appId)
        .order('submitted_at', { ascending: false });
      
      if (!error && data) {
        setCompletions(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCompletions(false);
    }
  };

  const handleRecoverComment = async (completion) => {
    const result = await Swal.fire({
      title: 'Recover Comment?',
      text: `This will permanently delete ${completion.submitted_username}'s review submission and return the comment to active status.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: theme.palette.mode === 'light' ? '#0b57d0' : '#a8c7fa',
      confirmButtonText: 'Yes, recover it!',
      background: theme.palette.background.paper,
      color: theme.palette.text.primary,
      borderRadius: '24px'
    });

    if (!result.isConfirmed) return;
    
    try {
      // 1. Delete the submission from review_submit_data
      const { error: deleteErr } = await supabase.from('review_submit_data').delete().eq('id', completion.id);
      if (deleteErr) throw deleteErr;

      // 2. Update the original comment back to 'active'
      const { error: updateErr } = await supabase.from('app_comments').update({ status: 'active' }).eq('id', completion.comment_id);
      if (updateErr) throw updateErr;

      setSnack({ open: true, message: 'Comment recovered successfully!', severity: 'success' });
      
      // Refresh lists
      fetchCompletions();
      fetchManageComments();
    } catch (e) {
      console.error(e);
      setSnack({ open: true, message: e.message || 'Error recovering comment', severity: 'error' });
    }
  };

  const handleSaveComments = async () => {
    setSaving(true);
    try {
      // 1. Update App Settings
      const { error: settingsError } = await supabase.from('apps').update({
        comment_limit: parseInt(limit) || 1,
        enable_timer: enableTimer,
        timer_gap_minutes: parseInt(timerGap) || 10,
        block_same_link_7_days: blockSameLink
      }).eq('id', appId);

      if (settingsError) throw settingsError;

      // 2. Prepare Batches
      let batches = [];
      if (multiStarMode) {
        [5, 4, 3, 2, 1].forEach(r => {
          if (multiStarTexts[r].trim()) batches.push({ rating: r, text: multiStarTexts[r].trim() });
        });
      } else {
        if (commentsText.trim()) batches.push({ rating: globalRating, text: commentsText.trim() });
      }

      if (batches.length === 0) {
        setSnack({ open: true, message: 'Settings saved! No comments provided to insert.', severity: 'info' });
        setSaving(false);
        return;
      }

      // Fetch existing if duplicates not allowed
      let existingCommentsMap = new Set();
      if (!allowDuplicates) {
        const { data: existData } = await supabase.from('app_comments').select('content').eq('app_id', appId);
        if (existData) existData.forEach(c => existingCommentsMap.add(c.content.trim()));
      }

      let insertArray = [];
      let skipped = 0;

      batches.forEach(batch => {
        const lines = batch.text.split('\n');
        lines.forEach(line => {
          let cleanLine = line.trim();
          // Remove numbering e.g., "1. ", "2) ", "10 - "
          cleanLine = cleanLine.replace(/^\s*\d+[\.\)\-]?\s+/u, '').trim();

          if (cleanLine) {
            if (!allowDuplicates && existingCommentsMap.has(cleanLine)) {
              skipped++;
            } else {
              insertArray.push({
                app_id: appId,
                content: cleanLine,
                rating: batch.rating,
                status: 'active'
              });
              if (!allowDuplicates) existingCommentsMap.add(cleanLine); // prevent dupes in same batch
            }
          }
        });
      });

      if (insertArray.length > 0) {
        const { error: insertError } = await supabase.from('app_comments').insert(insertArray);
        if (insertError) throw insertError;
      }

      const inserted = insertArray.length;
      let msg = `${inserted} new comments saved successfully!`;
      if (skipped > 0) msg += ` (${skipped} duplicates skipped).`;

      setSnack({ open: true, message: msg, severity: 'success' });
      setCommentsText('');
      setMultiStarTexts({ 5: '', 4: '', 3: '', 2: '', 1: '' });
      fetchManageComments(); // Refresh list

    } catch (e) {
      console.error(e);
      setSnack({ open: true, message: e.message, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteComment = async (id) => {
    const result = await Swal.fire({
      title: 'Delete Comment?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: theme.palette.mode === 'light' ? '#0b57d0' : '#a8c7fa',
      confirmButtonText: 'Yes, delete it!',
      background: theme.palette.background.paper,
      color: theme.palette.text.primary
    });

    if (!result.isConfirmed) return;

    try {
      await supabase.from('app_comments').delete().eq('id', id);
      setManageComments(prev => prev.filter(c => c.id !== id));
      setSnack({ open: true, message: 'Comment deleted.', severity: 'success' });
    } catch(e) {
      console.error(e);
    }
  };

  if (loading) return <Box sx={{ p: 5, textAlign: 'center' }}><CircularProgress /></Box>;
  if (!appDetails) return <Box sx={{ p: 5, textAlign: 'center' }}>App not found.</Box>;

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', mt: 2, pb: 10, px: { xs: 1, md: 2 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 5, gap: 2.5 }}>
        <IconButton onClick={() => navigate('/app-list')} sx={{ bgcolor: 'action.hover', width: 52, height: 52 }}>
          <ArrowBackIcon fontSize="medium" />
        </IconButton>
        <Box sx={{ p: 2, borderRadius: '18px', bgcolor: 'secondary.main', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CommentIcon fontSize="medium" />
        </Box>
        <Box>
          <Typography variant="h4" sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 600 }}>
            Comments Management
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
            Task #{appDetails.task_id} • {appDetails.app_name}
          </Typography>
        </Box>
      </Box>

      {/* Tabs */}
      <Paper elevation={0} sx={{ borderRadius: '24px', border: theme.palette.mode === 'light' ? `1px solid ${theme.palette.surfaceVariant.main}` : 'none', overflow: 'hidden' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, pt: 2, bgcolor: theme.palette.mode === 'light' ? '#fdfdfd' : 'background.paper' }}>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} textColor="secondary" indicatorColor="secondary">
            <Tab label="Add Comment" sx={{ fontWeight: 600, textTransform: 'none', fontSize: '1.1rem', py: 2, px: 3 }} />
            <Tab label="Manage Comments" sx={{ fontWeight: 600, textTransform: 'none', fontSize: '1.1rem', py: 2, px: 3 }} />
            <Tab label="View Completions" sx={{ fontWeight: 600, textTransform: 'none', fontSize: '1.1rem', py: 2, px: 3 }} />
          </Tabs>
        </Box>

        <Box sx={{ p: { xs: 3, md: 5 }, minHeight: '500px' }}>
          
          {/* TAB 1: ADD COMMENT */}
          <TabPanel value={tabValue} index={0}>
            {/* Configuration Section */}
            <Box sx={{ mb: 5, p: 4, borderRadius: '20px', bgcolor: 'background.default', border: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, color: 'primary.main' }}>Task Configuration</Typography>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4, mb: 4 }}>
                <TextField 
                  label="Limit Per Device" type="number"
                  value={limit} onChange={e => setLimit(e.target.value)}
                  sx={{ width: 220 }} InputProps={{ inputProps: { min: 1 }, sx: { fontSize: '1.1rem' } }}
                  InputLabelProps={{ sx: { fontSize: '1.1rem' } }}
                  helperText="Min 1 comment/device"
                />
                
                {enableTimer && (
                  <TextField 
                    label="Comment Gap (Minutes)" type="number"
                    value={timerGap} onChange={e => setTimerGap(e.target.value)}
                    sx={{ width: 220 }} InputProps={{ inputProps: { min: 1 }, sx: { fontSize: '1.1rem' } }}
                    InputLabelProps={{ sx: { fontSize: '1.1rem' } }}
                  />
                )}
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControlLabel control={<Checkbox size="medium" checked={blockSameLink} onChange={e => setBlockSameLink(e.target.checked)} />} label={<Typography variant="body1" sx={{ fontWeight: 600 }}>Block Duplicate App Link (7 Days)</Typography>} />
                <FormControlLabel control={<Checkbox size="medium" checked={enableTimer} onChange={e => setEnableTimer(e.target.checked)} />} label={<Typography variant="body1" sx={{ fontWeight: 600 }}>Enable Waitlist Timer (Gap)</Typography>} />
                <FormControlLabel control={<Checkbox size="medium" checked={allowDuplicates} onChange={e => setAllowDuplicates(e.target.checked)} />} label={<Typography variant="body1" sx={{ fontWeight: 600 }}>Allow Duplicate Comments</Typography>} />
              </Box>
            </Box>

            {/* Paste Section */}
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
                  <Select value={globalRating} onChange={e => setGlobalRating(e.target.value)} sx={{ width: 180, fontSize: '1.1rem' }}>
                    <MenuItem value={5}>⭐⭐⭐⭐⭐</MenuItem>
                    <MenuItem value={4}>⭐⭐⭐⭐</MenuItem>
                    <MenuItem value={3}>⭐⭐⭐</MenuItem>
                    <MenuItem value={2}>⭐⭐</MenuItem>
                    <MenuItem value={1}>⭐</MenuItem>
                  </Select>
                </Box>
                <TextField 
                  fullWidth multiline rows={10} 
                  placeholder="Example format:&#10;1. This app is amazing! 🚀&#10;2) Love the new update.&#10;3 - Highly recommended!" 
                  value={commentsText} onChange={e => setCommentsText(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px', fontSize: '1.1rem', lineHeight: 1.6 } }}
                />
              </>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[5, 4, 3].map(star => (
                  <Box key={star} sx={{ p: 3, borderRadius: '20px', border: `1px solid ${theme.palette.divider}`, bgcolor: 'background.default' }}>
                    <Typography variant="body1" sx={{ fontWeight: 600, mb: 2 }}>{'⭐'.repeat(star)} ({star} Stars)</Typography>
                    <TextField 
                      fullWidth multiline rows={4} 
                      placeholder={`Paste ${star}-star comments here...`}
                      value={multiStarTexts[star]} onChange={e => setMultiStarTexts({...multiStarTexts, [star]: e.target.value})}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px', fontSize: '1.1rem', lineHeight: 1.6 } }}
                    />
                  </Box>
                ))}
              </Box>
            )}

            <Button 
              variant="contained" color="secondary" disableElevation 
              onClick={handleSaveComments} disabled={saving}
              sx={{ mt: 5, borderRadius: '100px', px: 6, py: 1.5, fontWeight: 600, fontSize: '1.1rem' }}
            >
              {saving ? 'Processing...' : 'Save & Deploy Comments'}
            </Button>
          </TabPanel>

          {/* TAB 2: MANAGE COMMENTS */}
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Total Comments: {manageComments.length}</Typography>
              <Button size="small" onClick={fetchManageComments} variant="outlined" sx={{ borderRadius: '100px' }}>Refresh</Button>
            </Box>
            
            {loadingManage ? (
              <CircularProgress />
            ) : manageComments.length === 0 ? (
              <Typography color="text.secondary">No comments found.</Typography>
            ) : (
              <List disablePadding sx={{ 
                border: `1px solid ${theme.palette.divider}`, 
                borderRadius: '16px', 
                overflowY: 'auto', 
                maxHeight: '600px',
                bgcolor: 'background.default'
              }}>
                {manageComments.map((item, index) => (
                  <Box key={item.id}>
                    <ListItem sx={{ py: 2 }}>
                      <ListItemText 
                        primary={<Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>{item.content}</Typography>}
                        secondary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <Chip size="small" label={'⭐'.repeat(item.rating || 5)} sx={{ height: 20 }} />
                            <Typography variant="caption" color="text.secondary">Added: {new Date(item.created_at).toLocaleDateString()}</Typography>
                            <Chip size="small" label={item.status} color={item.status === 'active' ? 'success' : 'default'} sx={{ height: 20, fontSize: '0.65rem' }} />
                          </Box>
                        }
                      />
                      <IconButton color="error" onClick={() => handleDeleteComment(item.id)}><DeleteIcon /></IconButton>
                    </ListItem>
                    {index < manageComments.length - 1 && <Divider />}
                  </Box>
                ))}
              </List>
            )}
          </TabPanel>

          {/* TAB 3: VIEW COMPLETIONS */}
          <TabPanel value={tabValue} index={2}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>User Completions</Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Button size="small" onClick={fetchCompletions} variant="outlined" sx={{ borderRadius: '100px' }}>Refresh</Button>
                <Chip icon={<FormatListBulletedIcon />} label={`Total: ${completions.length}`} color="primary" variant="outlined" />
              </Box>
            </Box>
            
            {loadingCompletions ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
            ) : completions.length === 0 ? (
              <Box sx={{ p: 5, textAlign: 'center', border: `1px dashed ${theme.palette.divider}`, borderRadius: '16px' }}>
                <Typography color="text.secondary">No completed comments yet for this task.</Typography>
              </Box>
            ) : (
              <List disablePadding sx={{ 
                border: `1px solid ${theme.palette.divider}`, 
                borderRadius: '16px', 
                overflowY: 'auto', 
                maxHeight: '600px',
                bgcolor: 'background.default'
              }}>
                {completions.map((comp, idx) => (
                  <Box key={comp.id}>
                    <ListItem sx={{ py: 2, flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'flex-start' }}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                            <Typography variant="body1" sx={{ fontWeight: 700 }}>
                              {comp.submitted_username}
                            </Typography>
                            <Chip 
                              size="small" 
                              label={comp.status} 
                              color={comp.status === 'Approved' ? 'success' : comp.status === 'Under Review' ? 'warning' : 'default'} 
                              sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }} 
                            />
                          </Box>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Typography variant="body2" sx={{ color: 'text.primary', bgcolor: theme.palette.mode === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)', p: 1, borderRadius: '8px', borderLeft: `3px solid ${theme.palette.secondary.main}` }}>
                              {comp.app_comments?.content || 'Comment text missing'}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2, mt: 0.5, flexWrap: 'wrap' }}>
                              <Typography variant="caption" color="text.secondary">
                                <strong>Earner:</strong> {comp.earner_id}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                <strong>Bulker:</strong> {comp.bulker_id}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                <strong>Time:</strong> {new Date(comp.submitted_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })}
                              </Typography>
                            </Box>
                          </Box>
                        }
                      />
                      <IconButton 
                        color="error" 
                        onClick={() => handleRecoverComment(comp)}
                        title="Recover Comment (Deletes Submission)"
                        sx={{ mt: { xs: 2, sm: 0 }, ml: { sm: 2 }, alignSelf: { sm: 'center' } }}
                      >
                        <SettingsBackupRestoreIcon />
                      </IconButton>
                    </ListItem>
                    {idx < completions.length - 1 && <Divider />}
                  </Box>
                ))}
              </List>
            )}
          </TabPanel>
        </Box>
      </Paper>
      
      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({...snack, open: false})} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnack({...snack, open: false})} severity={snack.severity} sx={{ width: '100%', borderRadius: '12px' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
