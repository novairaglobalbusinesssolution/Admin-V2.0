import { useState, useEffect, useMemo } from 'react';
import { 
  Box, Typography, Paper, Button, TextField, 
  Autocomplete, Chip, Snackbar, Alert, useTheme, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Checkbox, Grid, Stack, Tooltip,
  CircularProgress, Divider
} from '@mui/material';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import AndroidIcon from '@mui/icons-material/Android';
import AppleIcon from '@mui/icons-material/Apple';
import YouTubeIcon from '@mui/icons-material/YouTube';
import LanguageIcon from '@mui/icons-material/Language';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LinkIcon from '@mui/icons-material/Link';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import SearchIcon from '@mui/icons-material/Search';

const steps = [
  { id: 0, title: 'Task Specification', desc: 'Category, App Name & Store URL' },
  { id: 1, title: 'Commercial Economics', desc: 'Partner Billing & Member Rewards' },
  { id: 2, title: 'Bulker Quota Allocation', desc: 'Assign Active Vendor Accounts' },
  { id: 3, title: 'Deployment Protocols', desc: 'Review Instructions & Launch' }
];

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
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Dialogs & Notifications
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // Partners & Bulkers Database State
  const [sponsors, setSponsors] = useState({ clients: [], providers: [] });
  const [bulkers, setBulkers] = useState([]);
  const [fetchingData, setFetchingData] = useState(false);
  const [bulkerSearch, setBulkerSearch] = useState('');
  
  // Create Partner Dialog State
  const [sponsorDialogOpen, setSponsorDialogOpen] = useState(false);
  const [newSponsorName, setNewSponsorName] = useState('');
  const [creatingSponsor, setCreatingSponsor] = useState(false);

  // Create Bulker Dialog State
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
    assigned_bulkers: {},
    instructions: 'Install the app from Google Play Store, open and browse for 2 minutes. Leave a genuine 5-star rating with at least 25 words positive feedback.'
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (formData.task_type === 'YT Video' && (!formData.instructions || formData.instructions.includes('Google Play Store'))) {
      handleChange('instructions', 'Watch the full video without skipping, click like, subscribe to the channel, and leave a genuine, constructive comment.');
    } else if (formData.task_type === 'Registration' && (!formData.instructions || formData.instructions.includes('Google Play Store'))) {
      handleChange('instructions', 'Click the registration link, signup with valid mobile number & email. Complete basic KYC verification to unlock task reward.');
    } else if (formData.task_type === 'Android App' && (!formData.instructions || formData.instructions.includes('Watch the full video'))) {
      handleChange('instructions', 'Install the app from Google Play Store, open and browse for 2 minutes. Leave a genuine 5-star rating with at least 25 words positive feedback.');
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

  const handlePackageInput = (rawVal) => {
    let cleanVal = rawVal.trim();
    if (cleanVal.includes('play.google.com') && cleanVal.includes('id=')) {
      try {
        const url = new URL(cleanVal);
        const pkg = url.searchParams.get('id');
        if (pkg) cleanVal = pkg;
      } catch (_) {}
    }
    handleChange('app_package', cleanVal);
  };

  const handleBulkerToggle = (bulkerId) => {
    setFormData(prev => {
      const updated = { ...prev.assigned_bulkers };
      if (updated[bulkerId] !== undefined) {
        delete updated[bulkerId];
      } else {
        updated[bulkerId] = '';
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

  const handleSelectAllBulkers = () => {
    const allSelected = {};
    bulkers.forEach(b => {
      allSelected[b.bulker_id] = formData.assigned_bulkers[b.bulker_id] || '';
    });
    setFormData(prev => ({ ...prev, assigned_bulkers: allSelected }));
  };

  const handleClearAllBulkers = () => {
    setFormData(prev => ({ ...prev, assigned_bulkers: {} }));
  };

  const handleNext = () => setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
  const handleBack = () => setActiveStep((prev) => Math.max(prev - 1, 0));

  const checkDuplicateAndProceed = async () => {
    if (activeStep === 0) {
      if (!formData.app_name || !formData.app_package) {
        setSnack({ open: true, message: 'App Name and Link / Package ID are required.', severity: 'error' });
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
      
      setSnack({ open: true, message: `${formData.sponsor_type.slice(0, -1)} Created Successfully!`, severity: 'success' });
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
      setSnack({ open: true, message: 'Name and Phone are required.', severity: 'warning' });
      return;
    }
    setCreatingBulker(true);
    try {
      const suffix = Math.floor(10000 + Math.random() * 90000);
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
      handleBulkerToggle(newBulkerId);
      
      setSnack({ open: true, message: 'Bulker registered and selected!', severity: 'success' });
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

      setSnack({ open: true, message: 'Task Successfully Deployed to Production!', severity: 'success' });
      setTimeout(() => navigate('/app-list'), 1500);
    } catch (error) {
      setSnack({ open: true, message: error.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Financial Telemetry Computations
  const sponsorRate = parseFloat(formData.sponsor_amount) || 0;
  const memberReward = parseFloat(formData.members_reward) || 0;
  const netMargin = sponsorRate - memberReward;
  const marginPercentage = sponsorRate > 0 ? ((netMargin / sponsorRate) * 100).toFixed(1) : 0;
  
  const assignedBulkerKeys = Object.keys(formData.assigned_bulkers);
  const totalBulkersAssigned = assignedBulkerKeys.length;
  const totalBulkerAllocatedBudget = assignedBulkerKeys.reduce((acc, k) => {
    return acc + (parseFloat(formData.assigned_bulkers[k]) || 0);
  }, 0);

  // Filtered bulkers
  const filteredBulkers = useMemo(() => {
    if (!bulkerSearch) return bulkers;
    const q = bulkerSearch.toLowerCase();
    return bulkers.filter(b => 
      b.full_name?.toLowerCase().includes(q) || 
      b.bulker_id?.toLowerCase().includes(q) || 
      b.phone?.includes(q)
    );
  }, [bulkers, bulkerSearch]);

  const taskTypeConfigs = [
    {
      id: 'Android App',
      label: 'Google Play Store',
      tag: 'Android App',
      color: '#10b981',
      bgGradient: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%)',
      icon: <AndroidIcon sx={{ fontSize: 22, color: '#10b981' }} />,
      hint: 'Requires 5-Star Rating & Review verification',
      shortHint: 'Play Store Review'
    },
    {
      id: 'iOS App',
      label: 'Apple App Store',
      tag: 'iOS App',
      color: '#3b82f6',
      bgGradient: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)',
      icon: <AppleIcon sx={{ fontSize: 22, color: '#3b82f6' }} />,
      hint: 'App Store review with Bundle ID verification',
      shortHint: 'App Store Review'
    },
    {
      id: 'Registration',
      label: 'Web Registration',
      tag: 'Registration',
      color: '#f59e0b',
      bgGradient: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%)',
      icon: <LanguageIcon sx={{ fontSize: 22, color: '#f59e0b' }} />,
      hint: 'Signups, KYC validation, or deposit completion',
      shortHint: 'Signups & KYC Task'
    },
    {
      id: 'YT Video',
      label: 'YouTube Campaign',
      tag: 'YT Video',
      color: '#ef4444',
      bgGradient: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.05) 100%)',
      icon: <YouTubeIcon sx={{ fontSize: 22, color: '#ef4444' }} />,
      hint: 'Watch time, likes, subscribe & comment task',
      shortHint: 'Watch, Like & Share'
    }
  ];

  const currentTaskConfig = taskTypeConfigs.find(c => c.id === formData.task_type) || taskTypeConfigs[0];
  const currentOptions = formData.sponsor_type === 'Clients' ? sponsors.clients : sponsors.providers;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header Pod */}
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
          gap: 2
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
            <AssignmentIcon sx={{ fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
              Task & Application Deployment Hub
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Configure app review tasks, sponsor billing economics, bulker quotas, and real-time app store distribution.
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Chip
            icon={<TaskAltIcon sx={{ fontSize: '1rem !important' }} />}
            label={`Step ${activeStep + 1} of 4: ${steps[activeStep].title}`}
            sx={{
              bgcolor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)',
              color: '#6366f1',
              fontWeight: 700,
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: '12px'
            }}
          />
        </Stack>
      </Paper>

      {/* Segmented Step Tracker */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: '20px',
          border: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(16px)'
        }}
      >
        <Grid container spacing={1.5}>
          {steps.map((st, idx) => {
            const isActive = activeStep === idx;
            const isCompleted = activeStep > idx;

            return (
              <Grid item xs={12} sm={6} md={3} key={st.id}>
                <Box
                  onClick={() => {
                    if (idx < activeStep) setActiveStep(idx);
                  }}
                  sx={{
                    p: 1.5,
                    borderRadius: '14px',
                    border: '1.5px solid',
                    borderColor: isActive
                      ? '#6366f1'
                      : isCompleted
                      ? 'rgba(16,185,129,0.4)'
                      : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                    bgcolor: isActive
                      ? isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)'
                      : isCompleted
                      ? isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.04)'
                      : isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                    cursor: idx <= activeStep ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      bgcolor: isActive
                        ? '#6366f1'
                        : isCompleted
                        ? '#10b981'
                        : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                      color: isActive || isCompleted ? '#fff' : 'text.secondary'
                    }}
                  >
                    {isCompleted ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : idx + 1}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 800,
                        display: 'block',
                        color: isActive ? '#6366f1' : isCompleted ? '#10b981' : 'text.primary',
                        fontSize: '0.78rem'
                      }}
                      noWrap
                    >
                      {st.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }} noWrap>
                      {st.desc}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            );
          })}
        </Grid>
      </Paper>

      {/* Main Deployment Wizard Form Card (Full Width with Perfect Alignment) */}
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
          gap: 3.5
        }}
      >
        {/* Step 0: Task Details & Specification */}
        {activeStep === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: '-0.01em' }}>
                1. Select Application & Task Category
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Choose the target ecosystem. Task rules, verification engines, and store links adapt automatically.
              </Typography>
            </Box>

            {/* 4 Task Category Cards: Compact Short 1 Row Grid */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
                gap: 1.5,
                width: '100%'
              }}
            >
              {taskTypeConfigs.map((cfg) => {
                const isSelected = formData.task_type === cfg.id;
                return (
                  <Paper
                    key={cfg.id}
                    elevation={0}
                    onClick={() => handleChange('task_type', cfg.id)}
                    sx={{
                      px: 1.5,
                      py: 1.2,
                      borderRadius: '14px',
                      cursor: 'pointer',
                      border: '2px solid',
                      borderColor: isSelected ? cfg.color : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                      bgcolor: isSelected
                        ? isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'
                        : isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.2,
                      minHeight: 56,
                      boxShadow: isSelected ? `0 4px 14px ${cfg.color}25` : 'none',
                      '&:hover': {
                        borderColor: cfg.color,
                        transform: 'translateY(-1px)'
                      }
                    }}
                  >
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        minWidth: 36,
                        borderRadius: '10px',
                        bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {cfg.icon}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: '0.82rem', lineHeight: 1.2 }} noWrap>
                        {cfg.label}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          fontSize: '0.68rem',
                          lineHeight: 1.2,
                          display: 'block'
                        }}
                        noWrap
                      >
                        {cfg.shortHint}
                      </Typography>
                    </Box>
                    {isSelected ? (
                      <CheckCircleIcon sx={{ color: cfg.color, fontSize: 18, minWidth: 18 }} />
                    ) : (
                      <Box sx={{ width: 14, height: 14, minWidth: 14, borderRadius: '50%', border: '2px solid', borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }} />
                    )}
                  </Paper>
                );
              })}
            </Box>

            <Divider sx={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />

            {/* App Name & Store Package ID: Exactly 50/50 Split in 1 Row (Full Card Width) */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2.5,
                width: '100%'
              }}
            >
              <TextField 
                fullWidth 
                label="Application / Task Title *" 
                variant="outlined" 
                placeholder="e.g. PhonePe UPI, Telegram"
                value={formData.app_name} 
                onChange={(e) => handleChange('app_name', e.target.value)}
                sx={{
                  width: '100%',
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '14px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                  }
                }}
              />

              <TextField 
                fullWidth 
                label={
                  formData.task_type === 'Android App' 
                    ? 'Play Store Link or Package ID *'
                    : formData.task_type === 'iOS App' 
                    ? 'App Store Link or Bundle ID *'
                    : formData.task_type === 'YT Video' 
                    ? 'YouTube Video Link *'
                    : 'Target Web Link / URL *'
                } 
                variant="outlined" 
                placeholder={
                  formData.task_type === 'Android App'
                    ? 'e.g. com.whatsapp or play.google.com link'
                    : 'https://...'
                }
                value={formData.app_package} 
                onChange={(e) => handlePackageInput(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LinkIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  )
                }}
                sx={{
                  width: '100%',
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '14px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                  }
                }}
              />
            </Box>

            {/* Date Pickers: Exactly 50/50 Split in 1 Row with Flush Alignment (Full Card Width) */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2.5,
                width: '100%'
              }}
            >
              <TextField 
                fullWidth 
                label="Deployment Date (IST) *" 
                type="date" 
                variant="outlined" 
                InputLabelProps={{ shrink: true }}
                value={formData.app_date} 
                onChange={(e) => handleChange('app_date', e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarMonthIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  )
                }}
                sx={{
                  width: '100%',
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '14px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                  }
                }}
              />

              <TextField 
                fullWidth 
                label="Live Verification Checking Date (IST) *" 
                type="date" 
                variant="outlined" 
                InputLabelProps={{ shrink: true }}
                value={formData.live_checking_date} 
                onChange={(e) => handleChange('live_checking_date', e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarMonthIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  )
                }}
                sx={{
                  width: '100%',
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '14px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                  }
                }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ pl: 0.5, mt: -1.5, display: 'block' }}>
              Verification Date automatically synchronizes to +7 days after release for Google Play Store review indexation.
            </Typography>
          </Box>
        )}

        {/* Step 1: Commercial Economics & Partner */}
        {activeStep === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: '-0.01em' }}>
                2. Commercial Partner & Pricing Economics
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Select who is funding this task and set unit economics to calculate platform gross margins in real-time.
              </Typography>
            </Box>

            {/* Partner Type Selector: 2 Equal Height Cards in 1 Row (Full Card Width) */}
            <Box sx={{ width: '100%' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, mb: 1, display: 'block' }}>
                PARTNER CATEGORY
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 2,
                  width: '100%'
                }}
              >
                {['Clients', 'Provider'].map((type) => {
                  const isSelected = formData.sponsor_type === type;
                  const count = type === 'Clients' ? sponsors.clients.length : sponsors.providers.length;

                  return (
                    <Paper
                      key={type}
                      elevation={0}
                      onClick={() => handleChange('sponsor_type', type)}
                      sx={{
                        p: 2,
                        borderRadius: '16px',
                        cursor: 'pointer',
                        border: '2px solid',
                        borderColor: isSelected ? '#6366f1' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                        bgcolor: isSelected
                          ? isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)'
                          : isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        height: '100%',
                        minHeight: 74,
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                          {type === 'Clients' ? 'Direct Commercial Client' : 'Agency / Provider Account'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {count} Active {type} Registered
                        </Typography>
                      </Box>
                      {isSelected && <CheckCircleIcon sx={{ color: '#6366f1' }} />}
                    </Paper>
                  );
                })}
              </Box>
            </Box>

            {/* Partner Autocomplete & Quick Add: Full Width */}
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', width: '100%' }}>
              <Autocomplete
                fullWidth
                sx={{ flex: 1, width: '100%' }}
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
                    label={`Select Authorized ${formData.sponsor_type.slice(0, -1)} *`}
                    variant="outlined"
                    placeholder="Search by company name or ID..."
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
              <Tooltip title={`Create New ${formData.sponsor_type.slice(0, -1)}`}>
                <Button 
                  variant="outlined"
                  onClick={() => setSponsorDialogOpen(true)}
                  startIcon={<AddCircleIcon />}
                  sx={{
                    borderRadius: '14px',
                    height: 54,
                    px: 2.5,
                    textTransform: 'none',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    borderColor: '#6366f1',
                    color: '#6366f1',
                    borderWidth: '1.5px',
                    '&:hover': { borderWidth: '1.5px' }
                  }}
                >
                  New {formData.sponsor_type.slice(0, -1)}
                </Button>
              </Tooltip>
            </Box>

            <Divider sx={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />

            {/* Pricing Fields: Exactly 50/50 Split in 1 Row (Full Card Width) */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2.5,
                width: '100%'
              }}
            >
              <TextField 
                fullWidth 
                label="Client / Sponsor Billing Rate *" 
                type="number" 
                variant="outlined" 
                placeholder="e.g. 25"
                value={formData.sponsor_amount} 
                onChange={(e) => handleChange('sponsor_amount', e.target.value)}
                InputProps={{ 
                  startAdornment: <InputAdornment position="start">₹</InputAdornment> 
                }}
                sx={{
                  width: '100%',
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '14px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                  }
                }}
              />

              <TextField 
                fullWidth 
                label="Earner Member Reward Rate *" 
                type="number" 
                variant="outlined" 
                placeholder="e.g. 10"
                value={formData.members_reward} 
                onChange={(e) => handleChange('members_reward', e.target.value)}
                InputProps={{ 
                  startAdornment: <InputAdornment position="start">₹</InputAdornment> 
                }}
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
        )}

        {/* Step 2: Bulker Allocation */}
        {activeStep === 2 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: '-0.01em' }}>
                  3. Bulker & Vendor Task Allocation
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Assign target volumes and payout budgets to authorized bulk partners.
                </Typography>
              </Box>
              <Button 
                variant="outlined" 
                startIcon={<GroupAddIcon />} 
                onClick={() => setBulkerDialogOpen(true)}
                size="small"
                sx={{
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 700,
                  borderColor: '#6366f1',
                  color: '#6366f1'
                }}
              >
                Register New Bulker
              </Button>
            </Box>

            {/* Bulker Search & Fast Toggles */}
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder="Search bulkers by name, phone or ID..."
                value={bulkerSearch}
                onChange={(e) => setBulkerSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  )
                }}
                sx={{
                  flex: 1,
                  minWidth: 220,
                  '& .MuiOutlinedInput-root': { borderRadius: '12px' }
                }}
              />
              <Button
                size="small"
                onClick={handleSelectAllBulkers}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Select All
              </Button>
              <Button
                size="small"
                color="inherit"
                onClick={handleClearAllBulkers}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Clear All
              </Button>
            </Box>

            {/* Bulkers Grid List */}
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                borderRadius: '18px',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                maxHeight: 320,
                overflowY: 'auto'
              }}
            >
              {fetchingData ? (
                <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
                  <CircularProgress size={28} />
                </Box>
              ) : filteredBulkers.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No active bulkers found matching search.
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={1}>
                  {filteredBulkers.map((bulker) => {
                    const isSelected = formData.assigned_bulkers[bulker.bulker_id] !== undefined;
                    const amount = formData.assigned_bulkers[bulker.bulker_id] || '';

                    return (
                      <Paper
                        key={bulker.bulker_id}
                        elevation={0}
                        sx={{
                          p: 1.5,
                          borderRadius: '14px',
                          border: '1px solid',
                          borderColor: isSelected
                            ? 'rgba(99,102,241,0.4)'
                            : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                          bgcolor: isSelected
                            ? isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)'
                            : isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 2,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Checkbox 
                            checked={isSelected}
                            onChange={() => handleBulkerToggle(bulker.bulker_id)}
                            sx={{ color: '#6366f1', '&.Mui-checked': { color: '#6366f1' } }}
                          />
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                              {bulker.full_name}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.2 }}>
                              <Chip
                                label={bulker.bulker_id}
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'
                                }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {bulker.phone}
                              </Typography>
                            </Stack>
                          </Box>
                        </Box>

                        {isSelected && (
                          <TextField
                            size="small"
                            placeholder="Allocated ₹"
                            type="number"
                            value={amount}
                            onChange={(e) => handleBulkerAmountChange(bulker.bulker_id, e.target.value)}
                            InputProps={{
                              startAdornment: <InputAdornment position="start">₹</InputAdornment>
                            }}
                            sx={{
                              width: 140,
                              '& .MuiOutlinedInput-root': {
                                borderRadius: '10px',
                                bgcolor: isDark ? 'rgba(15,23,42,0.8)' : '#fff'
                              }
                            }}
                          />
                        )}
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </Paper>
          </Box>
        )}

        {/* Step 3: Instructions & Deployment Protocols */}
        {activeStep === 3 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: '-0.01em' }}>
                4. Earner Guidelines & Production Launch
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Review final instructions that will appear on earner devices and verify pre-flight parameters.
              </Typography>
            </Box>

            {/* Instruction Presets */}
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, mb: 1, display: 'block' }}>
                QUICK INSTRUCTION PRESETS
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                <Chip
                  label="Standard 5-Star Review"
                  clickable
                  onClick={() => handleChange('instructions', 'Install the app from Google Play Store, open and browse for 2 minutes. Leave a genuine 5-star rating with at least 25 words positive feedback.')}
                  sx={{ borderRadius: '10px', fontWeight: 700 }}
                />
                <Chip
                  label="YouTube Video Watch & Like"
                  clickable
                  onClick={() => handleChange('instructions', 'Watch the full video without skipping, click like, subscribe to the channel, and leave a genuine, constructive comment.')}
                  sx={{ borderRadius: '10px', fontWeight: 700 }}
                />
                <Chip
                  label="Web Registration KYC"
                  clickable
                  onClick={() => handleChange('instructions', 'Click the registration link, signup with valid mobile number & email. Complete basic KYC verification to unlock task reward.')}
                  sx={{ borderRadius: '10px', fontWeight: 700 }}
                />
              </Stack>
            </Box>

            <TextField
              fullWidth
              label="Earner Task Instructions *"
              multiline
              rows={4}
              variant="outlined"
              placeholder="Provide precise guidelines for members..."
              value={formData.instructions}
              onChange={(e) => handleChange('instructions', e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '16px',
                  bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                }
              }}
            />
          </Box>
        )}

        {/* Wizard Navigation Action Bar */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 2, borderTop: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
          <Button 
            disabled={activeStep === 0} 
            onClick={handleBack} 
            startIcon={<ArrowBackIcon />}
            sx={{ 
              px: 3, 
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 700
            }}
          >
            Previous Step
          </Button>
          
          {activeStep === steps.length - 1 ? (
            <Button 
              variant="contained" 
              onClick={handleSubmit} 
              disabled={loading || !formData.app_name || !formData.app_package} 
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <RocketLaunchIcon />}
              sx={{ 
                px: 4, 
                py: 1.3,
                borderRadius: '14px',
                fontWeight: 800,
                textTransform: 'none',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                boxShadow: '0 8px 24px rgba(99,102,241,0.35)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #818cf8 0%, #4338ca 100%)',
                  boxShadow: '0 12px 28px rgba(99,102,241,0.45)'
                }
              }}
            >
              {loading ? 'Deploying to Production...' : 'Deploy Task to Production'}
            </Button>
          ) : (
            <Button 
              variant="contained" 
              onClick={checkDuplicateAndProceed} 
              disabled={loading} 
              endIcon={loading ? <CircularProgress size={18} color="inherit" /> : <ArrowForwardIcon />}
              sx={{ 
                px: 4, 
                py: 1.2,
                borderRadius: '14px',
                fontWeight: 800,
                textTransform: 'none',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                boxShadow: '0 8px 20px rgba(99,102,241,0.25)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #818cf8 0%, #4338ca 100%)'
                }
              }}
            >
              {loading ? 'Verifying...' : 'Proceed to Next Step'}
            </Button>
          )}
        </Box>
      </Paper>

      {/* Real-time Telemetry & In-App Simulation: 1 Single Row (Full Width 50% / 50% CSS Grid) */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 3,
          width: '100%'
        }}
      >
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: '24px',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
              gap: 2
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '10px',
                    bgcolor: 'rgba(99,102,241,0.12)',
                    color: '#6366f1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <SmartphoneIcon fontSize="small" />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    Client App Simulation
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Live earner mobile card viewport
                  </Typography>
                </Box>
              </Box>
              <Chip
                label="LIVE VIEWPORT"
                size="small"
                sx={{
                  bgcolor: 'rgba(99,102,241,0.12)',
                  color: '#6366f1',
                  fontWeight: 800,
                  fontSize: '0.65rem',
                  borderRadius: '8px'
                }}
              />
            </Box>

            {/* Simulated Card */}
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: '20px',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                bgcolor: isDark ? 'rgba(30,41,59,0.85)' : '#ffffff',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Chip
                  label={currentTaskConfig.tag}
                  size="small"
                  sx={{
                    bgcolor: currentTaskConfig.bgGradient,
                    color: currentTaskConfig.color,
                    fontWeight: 800,
                    fontSize: '0.68rem',
                    borderRadius: '8px'
                  }}
                />
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#10b981' }}>
                  +₹{memberReward.toFixed(2)}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '14px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                >
                  {currentTaskConfig.icon}
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }} noWrap>
                    {formData.app_name || 'Application Title'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', fontSize: '0.72rem' }}>
                    {formData.app_package || 'com.package.identifier'}
                  </Typography>
                </Box>
              </Box>

              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  fontSize: '0.78rem',
                  lineHeight: 1.45
                }}
              >
                {formData.instructions || 'Task instructions will appear here...'}
              </Typography>

              <Button
                fullWidth
                variant="contained"
                size="small"
                sx={{
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 800,
                  py: 1,
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  boxShadow: 'none'
                }}
              >
                Start Review Task & Earn ₹{memberReward || '0'}
              </Button>
            </Paper>
          </Paper>

        {/* 2. Task Unit Economics (50% Width) */}
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: '24px',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
              gap: 2
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '10px',
                    bgcolor: 'rgba(16,185,129,0.12)',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <TrendingUpIcon fontSize="small" />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    TASK UNIT ECONOMICS
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Real-time profit ledger & margins
                  </Typography>
                </Box>
              </Box>
              <Chip
                label={`${marginPercentage}% MARGIN`}
                size="small"
                sx={{
                  bgcolor: netMargin >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                  color: netMargin >= 0 ? '#10b981' : '#ef4444',
                  fontWeight: 800,
                  fontSize: '0.65rem',
                  borderRadius: '8px'
                }}
              />
            </Box>

            {/* 3 Metric Rows */}
            <Stack spacing={1.5}>
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  borderRadius: '14px',
                  border: '1px solid',
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Partner Billing Rate:
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  ₹{sponsorRate.toFixed(2)}
                </Typography>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  borderRadius: '14px',
                  border: '1px solid',
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Member Wallet Payout:
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#f59e0b' }}>
                  ₹{memberReward.toFixed(2)}
                </Typography>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  borderRadius: '14px',
                  border: '1.5px solid',
                  borderColor: netMargin >= 0 ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)',
                  bgcolor: netMargin >= 0
                    ? isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.05)'
                    : isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  Net Platform Margin:
                </Typography>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 900,
                    color: netMargin >= 0 ? '#10b981' : '#ef4444'
                  }}
                >
                  {netMargin >= 0 ? `+₹${netMargin.toFixed(2)}` : `-₹${Math.abs(netMargin).toFixed(2)}`}
                </Typography>
              </Paper>
            </Stack>

            {/* Bulkers Mini Summary */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Bulkers Distribution:
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#6366f1' }}>
                {totalBulkersAssigned > 0 ? `${totalBulkersAssigned} Bulkers • ₹${totalBulkerAllocatedBudget.toLocaleString()} Total` : 'None Allocated'}
              </Typography>
            </Box>
          </Paper>
      </Box>

      {/* Duplicate Warning Dialog */}
      <Dialog 
        open={Boolean(duplicateWarning)} 
        onClose={() => setDuplicateWarning(null)} 
        PaperProps={{ 
          sx: { 
            borderRadius: '24px', 
            p: 1,
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
            bgcolor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(20px)'
          } 
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon /> Recent Submission Detected
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.primary' }}>
            A task with this <strong>Link / Package ID</strong> already exists in the Novaira database.
          </DialogContentText>
          <Box sx={{ mt: 2, p: 2, bgcolor: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.05)', borderRadius: '14px', border: '1px solid rgba(239,68,68,0.2)' }}>
            <Typography variant="body2">
              Last Processed Date: <strong>{duplicateWarning?.lastDate}</strong>
            </Typography>
            <Typography variant="body2" color="error.main" sx={{ mt: 0.5, fontWeight: 700 }}>
              It has only been <strong>{duplicateWarning?.diffDays} days</strong> since this task was added.
            </Typography>
          </Box>
          <DialogContentText sx={{ mt: 2 }}>
            Do you want to proceed and deploy this task duplicate anyway?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDuplicateWarning(null)} color="inherit" sx={{ borderRadius: '10px', textTransform: 'none' }}>
            Cancel
          </Button>
          <Button onClick={proceedAnyway} variant="contained" color="error" sx={{ borderRadius: '10px', fontWeight: 800, textTransform: 'none' }}>
            Process Anyway
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Client/Provider Dialog */}
      <Dialog 
        open={sponsorDialogOpen} 
        onClose={() => setSponsorDialogOpen(false)} 
        PaperProps={{ 
          sx: { 
            borderRadius: '24px', 
            minWidth: 380,
            p: 1,
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
            bgcolor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(20px)'
          } 
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonAddIcon sx={{ color: '#6366f1' }} /> Create New {formData.sponsor_type === 'Clients' ? 'Commercial Client' : 'Provider Partner'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '10px !important' }}>
          <TextField 
            autoFocus 
            fullWidth 
            label="Company / Sponsor Name *" 
            variant="outlined" 
            placeholder="e.g. Dream11 Interactive"
            value={newSponsorName}
            onChange={(e) => setNewSponsorName(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
          />
          <Paper elevation={0} sx={{ p: 2, borderRadius: '12px', bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
            <Typography variant="caption" color="text.secondary">
              A secure identifier will be generated: <br/>
              <strong>{formData.sponsor_type === 'Clients' ? 'NOVAIRA/COMMARCIAL/[RANDOM]' : 'NOVAIRA/PROVIDER/[RANDOM]'}</strong>
            </Typography>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setSponsorDialogOpen(false)} color="inherit" disabled={creatingSponsor} sx={{ borderRadius: '10px', textTransform: 'none' }}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateSponsor} 
            variant="contained" 
            disabled={creatingSponsor || !newSponsorName.trim()}
            sx={{ 
              borderRadius: '12px', 
              fontWeight: 800, 
              textTransform: 'none',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' 
            }}
          >
            {creatingSponsor ? 'Creating...' : 'Create & Select'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Bulker Dialog */}
      <Dialog 
        open={bulkerDialogOpen} 
        onClose={() => setBulkerDialogOpen(false)} 
        PaperProps={{ 
          sx: { 
            borderRadius: '24px', 
            minWidth: 380,
            p: 1,
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
            bgcolor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(20px)'
          } 
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <GroupAddIcon sx={{ color: '#6366f1' }} /> Register Authorized Bulker
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '10px !important' }}>
          <TextField 
            autoFocus 
            fullWidth 
            label="Full Name *" 
            variant="outlined" 
            value={newBulkerData.full_name} 
            onChange={(e) => setNewBulkerData({...newBulkerData, full_name: e.target.value})}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
          />
          <TextField 
            fullWidth 
            label="Phone Number *" 
            variant="outlined" 
            type="tel"
            value={newBulkerData.phone} 
            onChange={(e) => setNewBulkerData({...newBulkerData, phone: e.target.value})}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
          />
          <TextField 
            fullWidth 
            label="Email Address (Optional)" 
            variant="outlined" 
            type="email"
            value={newBulkerData.email} 
            onChange={(e) => setNewBulkerData({...newBulkerData, email: e.target.value})}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
          />
          <Typography variant="caption" color="text.secondary">
            Bulker ID will be auto-generated (e.g. BLK-58219) and activated immediately.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setBulkerDialogOpen(false)} color="inherit" disabled={creatingBulker} sx={{ borderRadius: '10px', textTransform: 'none' }}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateBulker} 
            variant="contained" 
            disabled={creatingBulker}
            sx={{ 
              borderRadius: '12px', 
              fontWeight: 800, 
              textTransform: 'none',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' 
            }}
          >
            {creatingBulker ? 'Registering...' : 'Save & Assign'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar Alert */}
      <Snackbar 
        open={snack.open} 
        autoHideDuration={4000} 
        onClose={() => setSnack(s => ({ ...s, open: false }))} 
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          severity={snack.severity} 
          variant="filled" 
          sx={{ borderRadius: '14px', width: '100%', fontWeight: 700 }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
