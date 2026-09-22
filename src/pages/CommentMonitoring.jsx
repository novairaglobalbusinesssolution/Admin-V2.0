import { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, TextField, Button, 
  List, ListItem, ListItemText, Chip, Autocomplete, 
  useTheme, CircularProgress
} from '@mui/material';
import { supabase } from '../supabaseClient';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, IconButton, Snackbar, Alert } from '@mui/material';

const getISTDate = () => {
  const d = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + istOffset);
  return istDate.toISOString().slice(0, 10);
};

export default function CommentMonitoring() {
  const theme = useTheme();
  const [apps, setApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [publishDate, setPublishDate] = useState(getISTDate());
  
  const [completions, setCompletions] = useState([]);
  const [loadingCompletions, setLoadingCompletions] = useState(false);
  
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [recoverDialog, setRecoverDialog] = useState({ open: false, completion: null });

  const executeRecover = async () => {
    const comp = recoverDialog.completion;
    if (!comp) return;

    try {
      // 1. Delete the submission from review_submit_data
      const { error: deleteErr } = await supabase.from('review_submit_data').delete().eq('id', comp.id);
      if (deleteErr) throw deleteErr;

      // 2. Update the original comment back to 'active'
      const { error: updateErr } = await supabase.from('app_comments').update({ status: 'active' }).eq('id', comp.comment_id);
      if (updateErr) throw updateErr;

      setSnack({ open: true, message: 'Comment recovered successfully!', severity: 'success' });
      
      // Refresh list
      fetchCompletions(selectedApp.id);
    } catch (e) {
      console.error(e);
      setSnack({ open: true, message: e.message || 'Error recovering comment', severity: 'error' });
    } finally {
      setRecoverDialog({ open: false, completion: null });
    }
  };

  useEffect(() => {
    fetchApps(publishDate);
  }, [publishDate]);

  useEffect(() => {
    if (selectedApp) {
      fetchCompletions(selectedApp.id);
    } else {
      setCompletions([]);
    }
  }, [selectedApp]);

  const fetchApps = async (selectedDate = publishDate) => {
    let query = supabase.from('apps').select('id, app_name, task_id, app_date');

    if (selectedDate) {
      query = query.eq('app_date', selectedDate);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (!error && data) {
      setApps(data);
      setSelectedApp((prev) => (prev && data.some(app => app.id === prev.id) ? prev : null));
    }
  };

  const fetchCompletions = async (appId) => {
    setLoadingCompletions(true);
    try {
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

  return (
    <Box sx={{ maxWidth: '1400px', mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Comment Monitoring</Typography>
      </Box>

      <Paper sx={{ p: 4, borderRadius: '16px', mb: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, mb: 4 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Publish Date (IST Kolkata 5:30)</Typography>
            <TextField
              type="date"
              fullWidth
              value={publishDate}
              onChange={(e) => setPublishDate(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { minHeight: '56px', borderRadius: '12px' } }}
            />
          </Box>
          <Box sx={{ flex: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Select Application</Typography>
            <Autocomplete
              options={apps}
              getOptionLabel={(option) => `[Task #${option.task_id}] ${option.app_name}`}
              value={selectedApp}
              onChange={(e, newValue) => setSelectedApp(newValue)}
              renderInput={(params) => <TextField {...params} placeholder="Search App by Name or Task ID" />}
              fullWidth
            />
          </Box>
        </Box>

        {selectedApp && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>User Completions</Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Button size="small" onClick={() => fetchCompletions(selectedApp.id)} variant="outlined" sx={{ borderRadius: '100px' }}>Refresh</Button>
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
                maxHeight: '700px',
                bgcolor: 'background.default'
              }}>
                {completions.map((comp, idx) => (
                  <Box key={comp.id}>
                    <ListItem sx={{ py: 2, flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'flex-start', borderBottom: idx < completions.length - 1 ? `1px solid ${theme.palette.divider}` : 'none' }}>
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
                                <strong>Date:</strong> {new Date(comp.submitted_at).toLocaleString()}
                              </Typography>
                            </Box>
                          </Box>
                        }
                      />
                      <IconButton 
                        color="error" 
                        onClick={() => setRecoverDialog({ open: true, completion: comp })}
                        title="Recover Comment (Deletes Submission)"
                        sx={{ ml: 2, alignSelf: 'center' }}
                      >
                        <SettingsBackupRestoreIcon />
                      </IconButton>
                    </ListItem>
                  </Box>
                ))}
              </List>
            )}
          </Box>
        )}
      </Paper>

      {/* Recover Confirmation Dialog */}
      <Dialog 
        open={recoverDialog.open} 
        onClose={() => setRecoverDialog({ open: false, completion: null })}
        PaperProps={{ sx: { borderRadius: '24px', p: 1 } }}
      >
        <DialogTitle sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 600, color: 'error.main' }}>
          Recover Comment?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.primary' }}>
            This will permanently delete <strong>{recoverDialog.completion?.submitted_username}</strong>'s review submission and return the comment to active status.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRecoverDialog({ open: false, completion: null })} color="inherit" sx={{ px: 3 }}>
            Cancel
          </Button>
          <Button onClick={executeRecover} variant="contained" color="error" disableElevation sx={{ px: 3 }}>
            Yes, Recover
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} variant="filled" sx={{ borderRadius: '12px', width: '100%', fontFamily: '"Google Sans", sans-serif' }}>
          {snack.message}
        </Alert>
      </Snackbar>

    </Box>
  );
}
