import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TextField, Button, InputAdornment, IconButton, Typography, Box, 
  useTheme, Snackbar, Alert 
} from '@mui/material';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';

import { supabase } from '../supabaseClient';

export default function Login() {
  const navigate = useNavigate();
  const theme = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Android Native style Error Snackbar State
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleErrorClose = (event, reason) => {
    if (reason === 'clickaway') return;
    setErrorOpen(false);
  };

  const showError = (message) => {
    setErrorMessage(message);
    setErrorOpen(true);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      showError("Please enter both email and password");
      return;
    }

    setLoading(true);
    try {
      // Direct query to the custom admins table
      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .eq('email', email)
        .single();

      // If user doesn't exist or query failed
      if (error || !data) {
        throw new Error("Invalid email address.");
      }

      // Check if account is locked
      if (data.account_locked_until && new Date(data.account_locked_until) > new Date()) {
        throw new Error("Your account is temporarily locked. Please try again later.");
      }

      // Very basic plain text matching (if old DB uses plain text)
      // If the PHP DB used bcrypt, we'll need to update this logic to hit our Node.js backend.
      // But based on your message "Subhadeep2006@ like that data exisit", we'll try plain text first:
      let isPasswordMatch = false;

      // 1. Try plain text match
      if (data.password_hash === password) {
        isPasswordMatch = true;
      } 
      // 2. We can add bcrypt check later via API if needed.

      if (!isPasswordMatch) {
        // Increment failed attempts (optional feature to add later)
        throw new Error("Incorrect password.");
      }

      // Update last login timestamp
      await supabase
        .from('admins')
        .update({ 
          last_login_timestamp: new Date().toISOString(),
          failed_login_attempts: 0 
        })
        .eq('id', data.id);
      
      // Save session info to local storage
      localStorage.setItem('adminSession', JSON.stringify({
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role
      }));

      // Navigate to dashboard
      navigate('/');
    } catch (error) {
      showError(error.message || "An error occurred during login. Check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="min-h-screen flex items-center justify-center p-4" sx={{ bgcolor: 'background.default' }}>
      <Box className="w-full max-w-sm flex flex-col">
        {/* Android Native Style Icon Header */}
        <Box className="flex flex-col items-center mb-8">
          <Box 
            sx={{ 
              bgcolor: theme.palette.mode === 'light' ? theme.palette.primary.primaryContainer : theme.palette.primary.primaryContainer, 
              color: theme.palette.mode === 'light' ? theme.palette.primary.main : theme.palette.primary.onPrimary,
              width: 72, 
              height: 72, 
              borderRadius: '24px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              mb: 3
            }}
          >
            <AdminPanelSettingsIcon sx={{ fontSize: 40 }} />
          </Box>
          
          <Typography variant="h5" color="text.primary" sx={{ mb: 1, fontFamily: '"Google Sans", Roboto, sans-serif' }}>
            Novaira Admin
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Sign in to your account
          </Typography>
        </Box>

        <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
          <TextField
            fullWidth
            label="Email address"
            variant="outlined"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailOutlinedIcon color="action" />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: theme.palette.mode === 'light' ? '#fbfdf8' : '#111114',
              }
            }}
          />
          
          <TextField
            fullWidth
            label="Password"
            type={showPassword ? 'text' : 'password'}
            variant="outlined"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlinedIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" disabled={loading}>
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: theme.palette.mode === 'light' ? '#fbfdf8' : '#111114',
              }
            }}
          />

          <Box className="flex justify-end mt-1 mb-4">
            <Button variant="text" size="small" sx={{ fontWeight: 500 }} disabled={loading}>
              Forgot password?
            </Button>
          </Box>

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disableElevation
            disabled={loading}
            sx={{ 
              py: 1.5, 
              bgcolor: theme.palette.primary.main,
              color: theme.palette.primary.onPrimary,
              '&:hover': {
                bgcolor: theme.palette.mode === 'light' ? '#0842a0' : '#d3e3fd',
                color: theme.palette.mode === 'light' ? '#ffffff' : '#062e6f',
              }
            }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </Box>

      {/* Android Native Error Snackbar */}
      <Snackbar 
        open={errorOpen} 
        autoHideDuration={4000} 
        onClose={handleErrorClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleErrorClose} 
          severity="error" 
          variant="filled"
          sx={{ 
            width: '100%', 
            borderRadius: '12px',
            bgcolor: theme.palette.error.dark, // Deep error color for Android feel
            color: '#fff',
            fontFamily: '"Google Sans", sans-serif',
            boxShadow: '0px 4px 6px -1px rgba(0,0,0,0.2)'
          }}
        >
          {errorMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
