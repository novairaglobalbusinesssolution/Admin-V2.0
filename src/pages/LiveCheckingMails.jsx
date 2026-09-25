import { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  useTheme, Snackbar, Alert, Card, CardContent, CircularProgress, Tooltip, IconButton, Divider, Switch, FormControlLabel
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { supabase } from '../supabaseClient';

const getISTDateString = () => {
  const d = new Date();
  const istTime = new Date(d.getTime() + (330 * 60000));
  return istTime.toISOString().split('T')[0];
};

export default function LiveCheckingMails() {
  const theme = useTheme();
  const [apps, setApps] = useState([]);
  const [sponsorMap, setSponsorMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const rowsPerPage = 10;
  
  // Settings State
  const [smtps, setSmtps] = useState([]);
  const [selectedSmtp, setSelectedSmtp] = useState('');
  const [receivers, setReceivers] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  
  // Loading states
  const [sendingId, setSendingId] = useState(null);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [settingDefault, setSettingDefault] = useState(false);
  const [cronTime, setCronTime] = useState('');
  const [cronActive, setCronActive] = useState(false);
  const [savingCron, setSavingCron] = useState(false);
  
  const [snack, setSnack] = useState({ open: false, message: '', type: 'success' });
  const todayIST = getISTDateString();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: appsData } = await supabase.from('apps').select('*').eq('live_checking_date', todayIST).order('created_at', { ascending: false });
      
      const { data: clients } = await supabase.from('clients').select('client_id, name');
      const { data: providers } = await supabase.from('providers').select('provider_id, name');
      const map = {};
      if (clients) clients.forEach(c => map[c.client_id] = c.name);
      if (providers) providers.forEach(p => map[p.provider_id] = p.name);
      
      const { data: smtpData } = await supabase.from('smtp_settings').select('id, sender_email, purpose, is_default');
      if (smtpData) {
        setSmtps(smtpData);
        const def = smtpData.find(s => s.is_default);
        if (def) setSelectedSmtp(def.id);
        else if (smtpData.length > 0) setSelectedSmtp(smtpData[0].id);
      }

      const { data: recData } = await supabase.from('live_list_settings').select('*').order('created_at');
      if (recData) setReceivers(recData);
      
      const { data: cronData } = await supabase.from('cron_settings').select('*').eq('id', 1).single();
      if (cronData) {
        setCronTime(cronData.schedule_time.substring(0, 5));
        setCronActive(cronData.is_active);
      }
      
      setSponsorMap(map);
      setApps(appsData || []);
    } catch (error) {
      setSnack({ open: true, message: error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCron = async () => {
    if (!cronTime) return setSnack({ open: true, message: 'Please select a valid time', type: 'warning' });
    setSavingCron(true);
    try {
      const { error } = await supabase.from('cron_settings').upsert({ id: 1, schedule_time: cronTime, is_active: cronActive });
      if (error) throw error;
      setSnack({ open: true, message: 'Automated Schedule saved!', type: 'success' });
    } catch(e) {
      setSnack({ open: true, message: e.message, type: 'error' });
    } finally { setSavingCron(false); }
  };

  const handleSetDefaultSmtp = async () => {
    if (!selectedSmtp) return;
    setSettingDefault(true);
    try {
      await supabase.from('smtp_settings').update({ is_default: false }).neq('id', '00000000-0000-0000-0000-000000000000'); // unset all
      const { error } = await supabase.from('smtp_settings').update({ is_default: true }).eq('id', selectedSmtp);
      if (error) throw error;
      setSnack({ open: true, message: 'SMTP set as default successfully!', type: 'success' });
      const newSmtps = smtps.map(s => ({ ...s, is_default: s.id === selectedSmtp }));
      setSmtps(newSmtps);
    } catch(e) {
      setSnack({ open: true, message: e.message, type: 'error' });
    } finally {
      setSettingDefault(false);
    }
  };

  const handleAddReceiver = async () => {
    if (!newEmail.includes('@')) return setSnack({ open: true, message: 'Invalid email', type: 'warning' });
    try {
      const { data, error } = await supabase.from('live_list_settings').insert([{ receiver_email: newEmail.trim() }]).select().single();
      if (error) throw error;
      setReceivers([...receivers, data]);
      setNewEmail('');
      setSnack({ open: true, message: 'Email added to list', type: 'success' });
    } catch(e) {
      setSnack({ open: true, message: e.message, type: 'error' });
    }
  };

  const handleDeleteReceiver = async (id) => {
    try {
      const { error } = await supabase.from('live_list_settings').delete().eq('id', id);
      if (error) throw error;
      setReceivers(receivers.filter(r => r.id !== id));
      setSnack({ open: true, message: 'Email deleted', type: 'success' });
    } catch(e) {
      setSnack({ open: true, message: e.message, type: 'error' });
    }
  };

  const handleSendSingle = async (app) => {
    if (!selectedSmtp) return setSnack({ open: true, message: 'Select an SMTP sender first!', type: 'warning' });
    if (receivers.length === 0) return setSnack({ open: true, message: 'Add at least one receiver email first!', type: 'warning' });
    setSendingId(app.id);
    try {
      const recEmails = receivers.map(r => r.receiver_email).join(',');
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://admin-v2-backend.onrender.com'}/api/send-live-checking-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smtp_id: selectedSmtp, receiver_email: recEmails, app_data: app })
      });
      const data = await res.json();
      if (data.status === 'success') setSnack({ open: true, message: 'Email sent successfully!', type: 'success' });
      else throw new Error(data.error);
    } catch (e) {
      setSnack({ open: true, message: `Failed: ${e.message}`, type: 'error' });
    } finally { setSendingId(null); }
  };

  const handleSendBulk = async () => {
    if (!selectedSmtp) return setSnack({ open: true, message: 'Select an SMTP sender first!', type: 'warning' });
    if (receivers.length === 0) return setSnack({ open: true, message: 'Add at least one receiver email first!', type: 'warning' });
    if (apps.length === 0) return setSnack({ open: true, message: 'No apps in the table to send!', type: 'warning' });
    
    setSendingBulk(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://admin-v2-backend.onrender.com'}/api/send-bulk-live-checking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smtp_id: selectedSmtp, apps })
      });
      const data = await res.json();
      if (data.status === 'success') setSnack({ open: true, message: 'Bulk summary email sent to all receivers!', type: 'success' });
      else throw new Error(data.error);
    } catch (e) {
      setSnack({ open: true, message: `Failed: ${e.message}`, type: 'error' });
    } finally { setSendingBulk(false); }
  };

  return (
    <Box sx={{ maxWidth: '1400px', mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Live Checking Mails</Typography>
          <Typography variant="body2" color="text.secondary">
            Apps matching Live Checking Date for Today ({new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'long' })})
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: 'flex-start' }}>
        
        {/* Left Side: Table */}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Paper sx={{ borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <TableContainer>
              <Table sx={{ minWidth: 700 }}>
                <TableHead sx={{ bgcolor: theme.palette.mode === 'light' ? '#f8f9fa' : 'background.paper' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Task ID</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>App Name & Link</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Provider / Client</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Dates</TableCell>
                    
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5 }}><CircularProgress size={30} /></TableCell></TableRow>
                  ) : apps.length === 0 ? (
                    <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5 }}>No apps found for today's live checking.</TableCell></TableRow>
                  ) : (
                    apps.slice(page * 10, page * 10 + 10).map((app) => (
                      <TableRow key={app.id} hover>
                        <TableCell sx={{ fontWeight: 600 }}>#{app.task_id}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{app.app_name}</Typography>
                          <Tooltip title={app.app_package}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'inline-block', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.app_package}</Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{sponsorMap[app.sponsor_id] || 'Unknown'}</Typography>
                          <Typography variant="caption" color="text.secondary">{app.sponsor_id}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" display="block">App: <strong>{app.app_date}</strong></Typography>
                          <Typography variant="caption" display="block" color="primary.main">Live: <strong>{app.live_checking_date}</strong></Typography>
                        </TableCell>

                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination component="div" count={apps.length} page={page} onPageChange={(e, p) => setPage(p)} rowsPerPage={10} rowsPerPageOptions={[10]} />
          </Paper>
        </Box>

        {/* Right Side: Settings Cards */}
        <Box sx={{ width: { xs: '100%', md: '300px', lg: '350px' }, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          
          {/* Card 0: Action Buttons */}
          <Card elevation={0} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: '16px', bgcolor: theme.palette.mode === 'light' ? '#e3f2fd' : 'rgba(144, 202, 249, 0.1)' }}>
            <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'primary.main' }}>Action Buttons</Typography>
            </Box>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                Instantly send a bulk email containing a list of ALL apps scheduled for today's live checking to the configured receivers.
              </Typography>
              <Button 
                variant="contained" color="primary" fullWidth disableElevation
                onClick={handleSendBulk} disabled={sendingBulk || apps.length === 0}
                endIcon={sendingBulk ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                sx={{ py: 1.2, borderRadius: '12px', fontWeight: 700 }}
              >
                {sendingBulk ? 'Sending Bulk Mail...' : 'Send Bulk Live List'}
              </Button>
            </CardContent>
          </Card>

          {/* Card 1.5: Cron Automated Schedule */}
          <Card elevation={0} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: '16px' }}>
            <Box sx={{ p: 2, bgcolor: theme.palette.mode === 'light' ? '#f8f9fa' : 'background.paper', borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Automated Schedule</Typography>
              <FormControlLabel 
                control={<Switch size="small" checked={cronActive} onChange={(e) => setCronActive(e.target.checked)} color="primary" />} 
                label={<Typography variant="caption" sx={{ fontWeight: 700, color: cronActive ? 'primary.main' : 'text.disabled' }}>{cronActive ? 'ON' : 'OFF'}</Typography>}
                sx={{ m: 0 }}
              />
            </Box>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                Set a daily time (IST) to automatically send the Bulk Summary Mail.
              </Typography>
              <TextField 
                type="time" 
                variant="outlined" 
                size="small" 
                fullWidth 
                value={cronTime} 
                onChange={(e) => setCronTime(e.target.value)} 
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' }, mb: 2 }} 
                InputLabelProps={{ shrink: true }}
              />
              <Button variant="contained" color="secondary" fullWidth size="small" onClick={handleSaveCron} disabled={savingCron} sx={{ borderRadius: '12px', disableElevation: true }}>
                {savingCron ? 'Saving...' : 'Save Schedule'}
              </Button>
            </CardContent>
          </Card>

          {/* Card 1: SMTP Config */}
          <Card elevation={0} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: '16px' }}>
            <Box sx={{ p: 2, bgcolor: theme.palette.mode === 'light' ? '#f8f9fa' : 'background.paper', borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>1. SMTP Sender Setup</Typography>
            </Box>
            <CardContent sx={{ p: 2 }}>
              <FormControl fullWidth variant="outlined" size="small">
                <InputLabel>SMTP Config</InputLabel>
                <Select label="SMTP Config" value={selectedSmtp} onChange={(e) => setSelectedSmtp(e.target.value)} sx={{ borderRadius: '12px' }}>
                  {smtps.map(s => <MenuItem key={s.id} value={s.id}>{s.sender_email} {s.is_default && '(Default)'}</MenuItem>)}
                </Select>
              </FormControl>
              {selectedSmtp && !smtps.find(s => s.id === selectedSmtp)?.is_default && (
                <Button variant="outlined" color="primary" fullWidth size="small" onClick={handleSetDefaultSmtp} disabled={settingDefault} sx={{ mt: 2, borderRadius: '12px' }}>
                  {settingDefault ? 'Setting...' : 'Set as Default SMTP'}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Card 2: Receiver Settings */}
          <Card elevation={0} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: '16px' }}>
            <Box sx={{ p: 2, bgcolor: theme.palette.mode === 'light' ? '#f8f9fa' : 'background.paper', borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>2. Receiver Details</Typography>
            </Box>
            <CardContent sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField label="Add Email" variant="outlined" size="small" fullWidth value={newEmail} onChange={(e) => setNewEmail(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
                <Button variant="contained" color="primary" onClick={handleAddReceiver} disableElevation sx={{ minWidth: '40px', borderRadius: '12px', p: 0 }}><AddIcon /></Button>
              </Box>
              
              <Box sx={{ mt: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: '12px', overflow: 'hidden' }}>
                <Table size="small">
                  <TableBody>
                    {receivers.map(r => (
                      <TableRow key={r.id}>
                        <TableCell sx={{ borderBottom: 0, py: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.receiver_email}</Typography>
                        </TableCell>
                        <TableCell sx={{ borderBottom: 0, py: 1 }} align="right">
                          <IconButton size="small" color="error" onClick={() => handleDeleteReceiver(r.id)}><DeleteIcon fontSize="small" /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {receivers.length === 0 && <TableRow><TableCell colSpan={2} align="center" sx={{ borderBottom: 0, color: 'text.secondary', py: 2 }}>No emails added</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </Box>
            </CardContent>
          </Card>

        </Box>
      </Box>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.type} variant="filled" sx={{ borderRadius: '12px', width: '100%', fontFamily: '"Google Sans", sans-serif' }}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}
