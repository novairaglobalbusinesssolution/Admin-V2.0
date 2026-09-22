import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Paper, IconButton, Chip, Dialog, DialogTitle, 
  DialogContent, DialogActions, TextField, Grid, Divider, InputAdornment, Snackbar, Alert 
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { supabase } from '../supabaseClient';

export default function SmtpSettings() {
  const [smtps, setSmtps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [testEmailDialogOpen, setTestEmailDialogOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [selectedForTest, setSelectedForTest] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  
  const [formData, setFormData] = useState({
    id: null, host: '', port: '', user: '', pass: '', encrypt: 'SSL', senderName: '', senderEmail: ''
  });

  useEffect(() => {
    fetchSmtps();
  }, []);

  const fetchSmtps = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('smtp_settings').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      setSmtps(data);
    }
    setLoading(false);
  };

  const handleOpenNew = () => {
    setFormData({ id: null, host: '', port: '', user: '', pass: '', encrypt: 'SSL', senderName: '', senderEmail: '' });
    setOpenDialog(true);
  };

  const handleOpenEdit = (item) => {
    setFormData({
      id: item.id,
      host: item.host || '',
      port: item.port || '',
      user: item.username || '',
      pass: item.password || '',
      encrypt: item.encryption || 'SSL',
      senderName: item.sender_name || '',
      senderEmail: item.sender_email || ''
    });
    setOpenDialog(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        host: formData.host,
        port: parseInt(formData.port) || 465,
        username: formData.user,
        password: formData.pass,
        encryption: formData.encrypt,
        sender_name: formData.senderName,
        sender_email: formData.senderEmail,
        purpose: 'default'
      };
      
      // If this is the first SMTP being added, make it default
      if (smtps.length === 0 && !formData.id) {
          payload.is_default = true;
      }

      if (formData.id) payload.id = formData.id;

      const { error } = await supabase.from('smtp_settings').upsert(payload);
      if (error) throw error;
      
      setSnack({ open: true, message: 'SMTP saved successfully!', severity: 'success' });
      setOpenDialog(false);
      fetchSmtps();
    } catch (e) {
      setSnack({ open: true, message: e.message, severity: 'error' });
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this SMTP configuration?')) {
      await supabase.from('smtp_settings').delete().eq('id', id);
      fetchSmtps();
    }
  };

  const handleMakeDefault = async (id) => {
    // First set all to false
    await supabase.from('smtp_settings').update({ is_default: false }).neq('id', '00000000-0000-0000-0000-000000000000');
    // Then set the selected one to true
    await supabase.from('smtp_settings').update({ is_default: true }).eq('id', id);
    
    setSnack({ open: true, message: 'Default SMTP updated!', severity: 'success' });
    fetchSmtps();
  };

  
  const handleOpenTest = (item) => {
    setSelectedForTest(item);
    setTestEmail('');
    setTestEmailDialogOpen(true);
  };

  const handleSendTest = async () => {
    if (!testEmail) return;
    setTesting(true);
    try {
      const res = await fetch('http://localhost:5000/api/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: selectedForTest.host,
          port: selectedForTest.port,
          username: selectedForTest.username,
          password: selectedForTest.password,
          encryption: selectedForTest.encryption,
          sender_email: selectedForTest.sender_email,
          sender_name: selectedForTest.sender_name,
          test_email: testEmail
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSnack({ open: true, message: 'Test email sent successfully!', severity: 'success' });
        setTestEmailDialogOpen(false);
      } else {
        throw new Error(data.error || 'Failed to send test email');
      }
    } catch (e) {
      setSnack({ open: true, message: e.message, severity: 'error' });
    }
    setTesting(false);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>SMTP Configurations</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your email delivery providers for system notifications and OTPs.
          </Typography>
        </Box>

        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenNew} sx={{ borderRadius: 2 }}>
          Add SMTP
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <Table>
          <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.02)' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Provider / Host</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Sender Email</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Port / Enc</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} align="center">Loading...</TableCell></TableRow>
            ) : smtps.length === 0 ? (
              <TableRow><TableCell colSpan={5} align="center">No SMTP configurations found.</TableCell></TableRow>
            ) : smtps.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Typography variant="body2" fontWeight="bold">{row.host}</Typography>
                  <Typography variant="caption" color="text.secondary">{row.username}</Typography>
                </TableCell>
                <TableCell>{row.sender_email}</TableCell>
                <TableCell>{row.port} / {row.encryption}</TableCell>
                <TableCell>
                  {row.is_default ? (
                    <Chip label="Active Default" color="success" size="small" icon={<CheckCircleIcon />} />
                  ) : (
                    <Button size="small" variant="outlined" onClick={() => handleMakeDefault(row.id)}>Make Default</Button>
                  )}
                </TableCell>
                <TableCell align="right">
                  <IconButton color="info" onClick={() => handleOpenTest(row)} title="Test SMTP"><SendIcon /></IconButton>
                  <IconButton color="primary" onClick={() => handleOpenEdit(row)} title="Edit"><EditIcon /></IconButton>
                  <IconButton color="error" onClick={() => handleDelete(row.id)}><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog for Add/Edit */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{formData.id ? 'Edit SMTP' : 'Add New SMTP'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth label="Sender Name" value={formData.senderName} 
                onChange={e => setFormData({...formData, senderName: e.target.value})}
                placeholder="e.g. Novaira App"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth label="Sender Email" value={formData.senderEmail} 
                onChange={e => setFormData({...formData, senderEmail: e.target.value})}
                placeholder="no-reply@yourdomain.com"
              />
            </Grid>
            <Grid item xs={12} sx={{ my: -1 }}><Divider /></Grid>
            <Grid item xs={12}>
              <TextField 
                fullWidth label="SMTP Host" value={formData.host} 
                onChange={e => setFormData({...formData, host: e.target.value})}
                placeholder="e.g. smtp.zeptomail.in or smtp.gmail.com"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth label="SMTP Port" value={formData.port} 
                onChange={e => setFormData({...formData, port: e.target.value})}
                placeholder="e.g. 465 or 587"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth label="Encryption" value={formData.encrypt} 
                onChange={e => setFormData({...formData, encrypt: e.target.value})}
                placeholder="SSL or TLS"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField 
                fullWidth label="SMTP Username" value={formData.user} 
                onChange={e => setFormData({...formData, user: e.target.value})}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField 
                fullWidth label="SMTP Password" type={showPassword ? 'text' : 'password'} value={formData.pass} 
                onChange={e => setFormData({...formData, pass: e.target.value})}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disableElevation>Save Configuration</Button>
        </DialogActions>
      </Dialog>
    
      
      {/* Test Email Dialog */}
      <Dialog open={testEmailDialogOpen} onClose={() => setTestEmailDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Send Test Email</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Enter an email address to test the <b>{selectedForTest?.host}</b> connection.
          </Typography>
          <TextField 
            fullWidth label="Test Email Address" type="email" value={testEmail} 
            onChange={e => setTestEmail(e.target.value)} autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setTestEmailDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSendTest} disabled={!testEmail || testing} disableElevation>
            {testing ? 'Sending...' : 'Send Test Mail'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={6000} onClose={() => setSnack({ ...snack, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnack({ ...snack, open: false })} severity={snack.severity} sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
