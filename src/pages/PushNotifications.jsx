import { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Grid, Card, CardContent, CircularProgress, Snackbar, Alert, RadioGroup, FormControlLabel, Radio,
  Autocomplete, Chip, useTheme
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { supabase } from '../supabaseClient';

export default function PushNotifications() {
  const theme = useTheme();
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  
  // Form State
  const [targetType, setTargetType] = useState('all'); // 'all' or 'selected'
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [notiType, setNotiType] = useState('system'); // system, tasks, wallet
  
  const [sending, setSending] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: '', type: 'success' });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${import.meta.env.DEV ? 'http://localhost:5000' : 'https://admin-v2-backend.onrender.com'}/api/users`);
      const json = await res.json();
      if (json.status === 'success') {
        setUsers(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSend = async () => {
    if (!title || !description) return setSnack({ open: true, message: 'Title and Description are required', type: 'warning' });
    if (targetType === 'selected' && selectedUsers.length === 0) return setSnack({ open: true, message: 'Please select at least one user', type: 'warning' });

    setSending(true);
    try {
      const res = await fetch(`${import.meta.env.DEV ? 'http://localhost:5000' : 'https://admin-v2-backend.onrender.com'}/api/send-custom-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: targetType,
          user_ids: selectedUsers.map(u => u.earner_id),
          title,
          body: description,
          link,
          type: notiType
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSnack({ open: true, message: `Successfully sent to ${data.successCount} devices!`, type: 'success' });
        setTitle('');
        setDescription('');
        setLink('');
        setSelectedUsers([]);
      } else {
        throw new Error(data.error || 'Failed to send');
      }
    } catch(e) {
      setSnack({ open: true, message: e.message, type: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Box sx={{ maxWidth: '1000px', mx: 'auto', pb: 5 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Push Notifications</Typography>
        <Typography variant="body2" color="text.secondary">
          Dispatch custom push notifications to Android users directly.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4, alignItems: 'flex-start' }}>
        
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Paper sx={{ p: 4, borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Target Audience</Typography>
            <FormControl component="fieldset" sx={{ mb: 3 }}>
              <RadioGroup row value={targetType} onChange={(e) => setTargetType(e.target.value)}>
                <FormControlLabel value="all" control={<Radio />} label="All Users" />
                <FormControlLabel value="selected" control={<Radio />} label="Selected Users Only" />
              </RadioGroup>
            </FormControl>

            {targetType === 'selected' && (
              <Box sx={{ mb: 4 }}>
                <Autocomplete
                  multiple
                  options={users}
                  getOptionLabel={(option) => {
                    const name = option.first_name ? `${option.first_name} ${option.last_name || ''}`.trim() : (option.email || 'Unknown User');
                    return `${name} (${option.earner_id})`;
                  }}
                  value={selectedUsers}
                  onChange={(e, newValue) => setSelectedUsers(newValue)}
                  loading={loadingUsers}
                  renderInput={(params) => (
                    <TextField {...params} variant="outlined" label="Search & Select Users" placeholder="Select..." />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip variant="outlined" label={option.earner_id} {...getTagProps({ index })} />
                    ))
                  }
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
              </Box>
            )}

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Notification Content</Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={8}>
                <TextField 
                  fullWidth label="Notification Title" variant="outlined" 
                  value={title} onChange={(e) => setTitle(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Type</InputLabel>
                  <Select 
                    value={notiType} onChange={(e) => setNotiType(e.target.value)} label="Type"
                    sx={{ borderRadius: '12px' }}
                  >
                    <MenuItem value="system">System</MenuItem>
                    <MenuItem value="tasks">Tasks</MenuItem>
                    <MenuItem value="wallet">Wallet</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <TextField 
                  fullWidth label="Description (Body)" variant="outlined" multiline rows={3}
                  value={description} onChange={(e) => setDescription(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField 
                  fullWidth label="Action Link (Optional)" variant="outlined" placeholder="https://"
                  value={link} onChange={(e) => setLink(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  If provided, tapping the notification will open this link in the app.
                </Typography>
              </Grid>

            </Grid>

            <Box sx={{ mt: 5, textAlign: 'right' }}>
              <Button 
                variant="contained" size="large" onClick={handleSend} disabled={sending}
                endIcon={sending ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                sx={{ borderRadius: '100px', px: 5, py: 1.5, fontWeight: 700 }} disableElevation
              >
                {sending ? 'Dispatching...' : (targetType === 'all' ? 'Send to All Users' : 'Send to Selected')}
              </Button>
            </Box>

          </Paper>
        </Box>

        <Box sx={{ width: { xs: '100%', md: '350px' }, flexShrink: 0 }}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '24px', bgcolor: 'transparent' }}>
            <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: 'primary.light', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2, color: 'primary.main' }}>
                <SendIcon fontSize="large" />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Live Preview</Typography>
              
              {/* Android Notification Mockup */}
              <Box sx={{ width: '100%', mt: 3, p: 2, borderRadius: '16px', bgcolor: theme.palette.mode === 'light' ? '#fff' : '#1e1e1e', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', textAlign: 'left', border: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Novaira <Box component="span" sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'text.disabled' }} /> {notiType.toUpperCase()}
                  </Typography>
                  <Typography variant="caption" sx={{ ml: 'auto', color: 'text.disabled' }}>now</Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>{title || 'Notification Title'}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {description || "This is how your description will appear on the user's lock screen."}
                </Typography>
              </Box>

            </CardContent>
          </Card>
        </Box>

      </Box>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.type} variant="filled" sx={{ borderRadius: '12px', width: '100%', fontFamily: '"Google Sans", sans-serif' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
