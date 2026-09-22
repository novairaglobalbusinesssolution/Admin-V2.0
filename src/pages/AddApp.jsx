import { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Stepper, Step, StepLabel, 
  Button, TextField, MenuItem, Select, FormControl, InputLabel, 
  Autocomplete, Chip, Snackbar, Alert, useTheme, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  IconButton, Checkbox, List, ListItem, ListItemText
} from '@mui/material';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AddCircleIcon from '@mui/icons-material/AddCircle';

const steps = ['Task Details', 'Pricing & Provider', 'Assign Bulkers', 'Instructions & Deploy'];

const getISTDateString = (daysToAdd = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + daysToAdd);
  const formatter = new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' 
  });
  return formatter.format(d);
};

export default function AddApp() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Dialogs & Snacks
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // Sponsors & Bulkers State
  const [sponsors, setSponsors] = useState({ clients: [], providers: [] });
  const [bulkers, setBulkers] = useState([]);
  const [fetchingData, setFetchingData] = useState(false);
  
  // Create Dialog States
  const [sponsorDialogOpen, setSponsorDialogOpen] = useState(false);
  const [newSponsorName, setNewSponsorName] = useState('');
  const [creatingSponsor, setCreatingSponsor] = useState(false);

  const [bulkerDialogOpen, setBulkerDialogOpen] = useState(false);
  const [newBulkerData, setNewBulkerData] = useState({ full_name: '', phone: '', email: '' });
  const [creatingBulker, setCreatingBulker] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    task_type: 'Android App',
    app_name: '',
    app_package: '', 
    app_date: getISTDateString(0),
    live_checking_date: getISTDateString(7),
    sponsor_type: 'Clients',
    sponsor_id: '',
    sponsor_amount: '',
    members_reward: '',
    assigned_bulkers: {}, // Changed to Object: { 'BLK-123': '500', 'BLK-456': '200' }
    instructions: '',
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (formData.task_type === 'YT Video' && !formData.instructions) {
      handleChange('instructions', 'Watch the full video, like, and leave a genuine comment.');
    }
  }, [formData.task_type]);

  const fetchInitialData = async () => {
    setFetchingData(true);
    try {
      const [clientsRes, providersRes, bulkersRes] = await Promise.all([
        supabase.from('clients').select('*').order('created_at', { ascending: false }),
        supabase.from('providers').select('*').order('created_at', { ascending: false }),
        supabase.from('bulker_desks').select('*').in('status', ['Active', 'active', 'Verified', 'verified']).order('created_at', { ascending: false })
      ]);
      setSponsors({
        clients: clientsRes.data || [],
        providers: providersRes.data || []
      });
      setBulkers(bulkersRes.data || []);
    } catch (err) {
      console.warn("Could not fetch data.", err);
    } finally {
      setFetchingData(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      if (field === 'app_date' && value) {
        const newDate = new Date(value);
        newDate.setDate(newDate.getDate() + 7);
        newData.live_checking_date = newDate.toISOString().split('T')[0];
      }
      if (field === 'sponsor_type') {
        newData.sponsor_id = '';
      }
      return newData;
    });
  };

  const handleBulkerToggle = (bulkerId) => {
    setFormData(prev => {
      const updated = { ...prev.assigned_bulkers };
      if (updated[bulkerId] !== undefined) {
        delete updated[bulkerId]; // Uncheck
      } else {
        updated[bulkerId] = ''; // Check, default amount empty
      }
      return { ...prev, assigned_bulkers: updated };
    });
  };

  const handleBulkerAmountChange = (bulkerId, amount) => {
    setFormData(prev => ({
      ...prev,
      assigned_bulkers: { ...prev.assigned_bulkers, [bulkerId]: amount }
    }));
  };

  const handleNext = () => setActiveStep((prev) => prev + 1);
  const handleBack = () => setActiveStep((prev) => prev - 1);

  const checkDuplicateAndProceed = async () => {
    if (activeStep === 0) {
      if (!formData.app_name || !formData.app_package) {
        setSnack({ open: true, message: 'App Name and Link are required.', severity: 'error' });
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('apps')
          .select('created_at')
          .eq('app_package', formData.app_package)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) throw error;
        if (data && data.length > 0) {
          const lastDate = new Date(data[0].created_at);
          const now = new Date();
          const diffDays = Math.ceil(Math.abs(now - lastDate) / (1000 * 60 * 60 * 24));
          
          if (diffDays <= 7) {
            setDuplicateWarning({ 
              lastDate: lastDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' }),
              diffDays
            });
            setLoading(false);
            return; 
          }
        }
        handleNext();
      } catch (error) {
        handleNext();
      } finally {
        setLoading(false);
      }
    } else {
      handleNext();
    }
  };

  const proceedAnyway = () => {
    setDuplicateWarning(null);
    handleNext();
  };

  const handleCreateSponsor = async () => {
    if (!newSponsorName.trim()) return;
    setCreatingSponsor(true);
    
    try {
      const isClient = formData.sponsor_type === 'Clients';
      const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
      const generatedId = isClient ? `NOVAIRA/COMMARCIAL/${suffix}` : `NOVAIRA/PROVIDER/${suffix}`;
      const tableName = isClient ? 'clients' : 'providers';
      
      const payload = isClient 
        ? { client_id: generatedId, name: newSponsorName } 
        : { provider_id: generatedId, name: newSponsorName };

      const { data, error } = await supabase.from(tableName).insert([payload]).select().single();
      
      if (error) throw error;

      await fetchInitialData();
      handleChange('sponsor_id', isClient ? data.client_id : data.provider_id);
      
      setSnack({ open: true, message: `${formData.sponsor_type} Created Successfully!`, severity: 'success' });
      setSponsorDialogOpen(false);
      setNewSponsorName('');
    } catch (error) {
      setSnack({ open: true, message: `Error: ${error.message}`, severity: 'error' });
    } finally {
      setCreatingSponsor(false);
    }
  };

  const handleCreateBulker = async () => {
    if (!newBulkerData.full_name || !newBulkerData.phone) {
      setSnack({ open: true, message: 'Name and Phone are required', severity: 'warning' });
      return;
    }
    setCreatingBulker(true);
    try {
      const suffix = Math.floor(10000 + Math.random() * 90000); // 5 digits
      const newBulkerId = `BLK-${suffix}`;
      const payload = {
        bulker_id: newBulkerId,
        full_name: newBulkerData.full_name,
        phone: newBulkerData.phone,
        email: newBulkerData.email || 'N/A',
        status: 'Active'
      };

      const { error } = await supabase.from('bulker_desks').insert([payload]);
      if (error) throw error;

      await fetchInitialData();
      // Auto-check the newly created bulker
      handleBulkerToggle(newBulkerId);
      
      setSnack({ open: true, message: 'Bulker created and selected!', severity: 'success' });
      setBulkerDialogOpen(false);
      setNewBulkerData({ full_name: '', phone: '', email: '' });
    } catch (error) {
      setSnack({ open: true, message: `Error: ${error.message}`, severity: 'error' });
    } finally {
      setCreatingBulker(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Convert assigned_bulkers object to array for DB
      const assignedArray = Object.keys(formData.assigned_bulkers).map(bId => ({
        bulker_id: bId,
        amount: parseFloat(formData.assigned_bulkers[bId]) || 0
      }));

      const payload = {
        app_name: formData.app_name,
        app_package: formData.app_package,
        task_type: formData.task_type,
        sponsor_type: formData.sponsor_type,
        sponsor_id: formData.sponsor_id || 'N/A',
        sponsor_amount: parseFloat(formData.sponsor_amount) || 0.00,
        members_reward: parseFloat(formData.members_reward) || 0.00,
        assigned_bulkers: assignedArray, 
        instructions: formData.instructions,
        status: 'active',
        app_date: formData.app_date || null,
        live_checking_date: formData.live_checking_date || null,
      };

      const { error } = await supabase.from('apps').insert([payload]);
      if (error) throw error;

      setSnack({ open: true, message: 'Task Successfully Deployed!', severity: 'success' });
      setTimeout(() => navigate('/app-list'), 1500);
    } catch (error) {
      setSnack({ open: true, message: error.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const getLinkLabel = () => {
    switch(formData.task_type) {
      case 'YT Video': return 'YouTube Video URL *';
      case 'Registration': return 'Website / Signup Link *';
      case 'iOS App': return 'App Store Link / Bundle ID *';
      default: return 'Google Play Store Link / Package *';
    }
  };

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box className="flex flex-col gap-4 mt-2">
            <FormControl fullWidth variant="outlined">
              <InputLabel>Select Task Type *</InputLabel>
              <Select
                value={formData.task_type}
                onChange={(e) => handleChange('task_type', e.target.value)}
                label="Select Task Type *"
                sx={{ borderRadius: '16px' }}
              >
                <MenuItem value="Android App">Android App</MenuItem>
                <MenuItem value="iOS App">iOS App</MenuItem>
                <MenuItem value="Registration">Registration</MenuItem>
                <MenuItem value="YT Video">YT Video</MenuItem>
              </Select>
            </FormControl>

            <TextField 
              fullWidth label="App / Task Name *" variant="outlined" 
              value={formData.app_name} onChange={(e) => handleChange('app_name', e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
            />
            
            <TextField 
              fullWidth label={getLinkLabel()} variant="outlined" 
              value={formData.app_package} onChange={(e) => handleChange('app_package', e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
            />

            <Box className="flex gap-4">
              <TextField 
                fullWidth label="App Date (IST)" type="date" variant="outlined" 
                InputLabelProps={{ shrink: true }}
                value={formData.app_date} onChange={(e) => handleChange('app_date', e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
              />
              <TextField 
                fullWidth label="Live Checking Date (IST)" type="date" variant="outlined" 
                InputLabelProps={{ shrink: true }}
                value={formData.live_checking_date} onChange={(e) => handleChange('live_checking_date', e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
              />
            </Box>
          </Box>
        );
      case 1:
        const currentOptions = formData.sponsor_type === 'Clients' ? sponsors.clients : sponsors.providers;
        return (
          <Box className="flex flex-col gap-4 mt-2">
            <FormControl fullWidth variant="outlined">
              <InputLabel>Sponsor Type</InputLabel>
              <Select
                value={formData.sponsor_type}
                onChange={(e) => handleChange('sponsor_type', e.target.value)}
                label="Sponsor Type"
                sx={{ borderRadius: '16px' }}
              >
                <MenuItem value="Clients">Clients</MenuItem>
                <MenuItem value="Provider">Provider</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Autocomplete
            fullWidth
            options={currentOptions}
            getOptionLabel={(option) => option ? `${option.name} (${formData.sponsor_type === 'Clients' ? option.client_id : option.provider_id})` : ''}
            loading={fetchingData}
            value={currentOptions.find(opt => (formData.sponsor_type === 'Clients' ? opt.client_id : opt.provider_id) === formData.sponsor_id) || null}
            onChange={(e, newValue) => {
              if (newValue) {
                handleChange('sponsor_id', formData.sponsor_type === 'Clients' ? newValue.client_id : newValue.provider_id);
              } else {
                handleChange('sponsor_id', '');
              }
            }}
            renderInput={(params) => (
                  <TextField 
                    {...params} 
                    label={`Select the ${formData.sponsor_type.slice(0, -1)}`} // Client or Provider
                    variant="outlined"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
                  />
                )}
              />
              <IconButton 
                color="primary" 
                onClick={() => setSponsorDialogOpen(true)}
                sx={{ bgcolor: 'primary.primaryContainer', '&:hover': { bgcolor: 'primary.light' }, width: 48, height: 48 }}
              >
                <AddCircleIcon />
              </IconButton>
            </Box>
            
            <TextField 
              fullWidth label="Sponsor Amount" type="number" variant="outlined" 
              value={formData.sponsor_amount} onChange={(e) => handleChange('sponsor_amount', e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
            />

            <TextField 
              fullWidth label="Members Reward" type="number" variant="outlined" 
              value={formData.members_reward} onChange={(e) => handleChange('members_reward', e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
            />
          </Box>
        );
      case 2:
        return (
          <Box className="flex flex-col gap-4 mt-2">
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Select active bulkers and assign task amounts.
              </Typography>
              <Button 
                variant="outlined" 
                startIcon={<AddCircleIcon />} 
                onClick={() => setBulkerDialogOpen(true)}
                size="small"
                sx={{ borderRadius: '100px' }}
              >
                Create Bulker
              </Button>
            </Box>

            <Paper variant="outlined" sx={{ borderRadius: '16px', maxHeight: '350px', overflow: 'auto' }}>
              <List disablePadding>
                {fetchingData && <ListItem><ListItemText primary="Loading bulkers..." /></ListItem>}
                {!fetchingData && bulkers.length === 0 && (
                  <ListItem><ListItemText primary="No active bulkers found." /></ListItem>
                )}
                
                {bulkers.map((bulker) => {
                  const isSelected = formData.assigned_bulkers[bulker.bulker_id] !== undefined;
                  const amount = formData.assigned_bulkers[bulker.bulker_id] || '';

                  return (
                    <ListItem 
                      key={bulker.bulker_id}
                      disablePadding
                      sx={{ 
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        bgcolor: isSelected ? 'action.selected' : 'transparent',
                        px: 2, py: 1
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 2 }}>
                        <Checkbox 
                          checked={isSelected}
                          onChange={() => handleBulkerToggle(bulker.bulker_id)}
                          sx={{ '& .MuiSvgIcon-root': { fontSize: 28 } }}
                        />
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {bulker.full_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {bulker.bulker_id} • {bulker.phone}
                          </Typography>
                        </Box>
                        
                        {isSelected && (
                          <TextField
                            size="small"
                            placeholder="Amount"
                            type="number"
                            value={amount}
                            onChange={(e) => handleBulkerAmountChange(bulker.bulker_id, e.target.value)}
                            InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                            sx={{ width: '120px', '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: 'background.paper' } }}
                          />
                        )}
                      </Box>
                    </ListItem>
                  );
                })}
              </List>
            </Paper>
          </Box>
        );
      case 3:
        return (
          <Box className="flex flex-col gap-4 mt-2">
            <TextField
              fullWidth
              label="Task Instructions"
              multiline
              rows={5}
              variant="outlined"
              placeholder="Provide detailed instructions for the members..."
              value={formData.instructions}
              onChange={(e) => handleChange('instructions', e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
            />
          </Box>
        );
      default:
        return 'Unknown step';
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, gap: 2 }}>
        <Box sx={{ 
          p: 1.5, borderRadius: '16px', 
          bgcolor: theme.palette.primary.primaryContainer, 
          color: theme.palette.primary.main 
        }}>
          <AssignmentIcon />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 500 }}>
            Task Configuration Wizard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Select a task type and configure the details.
          </Typography>
        </Box>
      </Box>

      <Paper elevation={0} sx={{ 
        p: { xs: 3, md: 5 }, 
        borderRadius: '24px', 
        border: theme.palette.mode === 'light' ? `1px solid ${theme.palette.surfaceVariant.main}` : 'none',
        bgcolor: 'background.paper' 
      }}>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 5 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ minHeight: '300px' }}>
          {getStepContent(activeStep)}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 5 }}>
          <Button disabled={activeStep === 0} onClick={handleBack} sx={{ px: 4 }}>
            Back
          </Button>
          
          {activeStep === steps.length - 1 ? (
            <Button variant="contained" onClick={handleSubmit} disabled={loading} disableElevation sx={{ px: 4, py: 1.2 }}>
              {loading ? 'Deploying...' : 'Deploy Task'}
            </Button>
          ) : (
            <Button variant="contained" onClick={checkDuplicateAndProceed} disabled={loading} disableElevation sx={{ px: 4, py: 1.2 }}>
              {loading ? 'Checking...' : 'Next Step'}
            </Button>
          )}
        </Box>
      </Paper>

      {/* Duplicate Warning Dialog */}
      <Dialog open={Boolean(duplicateWarning)} onClose={() => setDuplicateWarning(null)} PaperProps={{ sx: { borderRadius: '24px', p: 1 } }}>
        <DialogTitle sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 500, color: 'error.main' }}>
          Recent Submission Detected
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.primary' }}>
            A task with this <strong>Link / Package</strong> already exists in the database.
          </DialogContentText>
          <Box sx={{ mt: 2, p: 2, bgcolor: theme.palette.surfaceVariant.main, borderRadius: '12px' }}>
            <Typography variant="body2">Last Processed Date: <strong>{duplicateWarning?.lastDate}</strong></Typography>
            <Typography variant="body2" color="error.main" sx={{ mt: 0.5 }}>
              It has only been <strong>{duplicateWarning?.diffDays} days</strong> since this task was added.
            </Typography>
          </Box>
          <DialogContentText sx={{ mt: 2 }}>Do you want to process this task anyway?</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDuplicateWarning(null)} color="inherit" sx={{ px: 3 }}>Cancel</Button>
          <Button onClick={proceedAnyway} variant="contained" color="error" disableElevation sx={{ px: 3 }}>Process Anyway</Button>
        </DialogActions>
      </Dialog>

      {/* Create Client/Provider Dialog */}
      <Dialog open={sponsorDialogOpen} onClose={() => setSponsorDialogOpen(false)} PaperProps={{ sx: { borderRadius: '24px', minWidth: '350px' } }}>
        <DialogTitle sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 500 }}>
          Create New {formData.sponsor_type === 'Clients' ? 'Client' : 'Provider'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: '20px !important' }}>
          <TextField 
            autoFocus 
            fullWidth 
            label="Name / Company Name" 
            variant="outlined" 
            value={newSponsorName}
            onChange={(e) => setNewSponsorName(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
          />
          <Typography variant="caption" color="text.secondary">
            A unique secure ID will be generated instantly: <br/>
            e.g., {formData.sponsor_type === 'Clients' ? 'NOVAIRA/COMMARCIAL/...' : 'NOVAIRA/PROVIDER/...'}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setSponsorDialogOpen(false)} color="inherit" disabled={creatingSponsor}>
            Cancel
          </Button>
          <Button onClick={handleCreateSponsor} variant="contained" disableElevation disabled={creatingSponsor || !newSponsorName.trim()}>
            {creatingSponsor ? 'Creating...' : 'Create & Select'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Bulker Dialog */}
      <Dialog open={bulkerDialogOpen} onClose={() => setBulkerDialogOpen(false)} PaperProps={{ sx: { borderRadius: '24px', minWidth: '350px' } }}>
        <DialogTitle sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 500 }}>
          Register New Bulker
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '10px !important' }}>
          <TextField 
            autoFocus fullWidth label="Full Name *" variant="outlined" 
            value={newBulkerData.full_name} onChange={(e) => setNewBulkerData({...newBulkerData, full_name: e.target.value})}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
          />
          <TextField 
            fullWidth label="Phone Number *" variant="outlined" type="tel"
            value={newBulkerData.phone} onChange={(e) => setNewBulkerData({...newBulkerData, phone: e.target.value})}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
          />
          <TextField 
            fullWidth label="Email (Optional)" variant="outlined" type="email"
            value={newBulkerData.email} onChange={(e) => setNewBulkerData({...newBulkerData, email: e.target.value})}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
          />
          <Typography variant="caption" color="text.secondary">
            Bulker ID will be auto-generated (e.g., BLK-58219) and status will be Active.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setBulkerDialogOpen(false)} color="inherit" disabled={creatingBulker}>Cancel</Button>
          <Button onClick={handleCreateBulker} variant="contained" disableElevation disabled={creatingBulker}>
            {creatingBulker ? 'Saving...' : 'Save & Assign'}
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
