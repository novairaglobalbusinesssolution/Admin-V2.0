import { useState } from 'react';
import { Box, Typography, TextField, Button, Paper, ToggleButton, ToggleButtonGroup, CircularProgress } from '@mui/material';
import { supabase } from '../../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';

export default function BulkerLogin() {
    const navigate = useNavigate();
    const [loginType, setLoginType] = useState('email');
    const [authMode, setAuthMode] = useState('password'); // password or otp
    
    const [identifier, setIdentifier] = useState(''); // email or phone
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [generatedOtp, setGeneratedOtp] = useState('');
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSendOtp = async () => {
        if (!identifier) return setError("Please enter your email");
        setLoading(true);
        setError('');
        try {
            const { data: user } = await supabase.from('bulker_desks').select('*').eq('email', identifier).single();
            if (!user) throw new Error("No bulker found with this email.");

            const code = Math.floor(100000 + Math.random() * 900000).toString();
            setGeneratedOtp(code);
            
            // Call Mailer API
            await fetch("https://novaira-mailer.vercel.app/api/send_otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: identifier, otp: code })
            });
            alert("OTP sent to your email!");
            setAuthMode('otp_verify');
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async () => {
        if (!identifier) return setError("Please enter credentials");
        setLoading(true);
        setError('');
        try {
            let column = loginType === 'email' ? 'email' : 'phone';
            
            if (authMode === 'password') {
                const { data: user } = await supabase.from('bulker_desks').select('*').eq(column, identifier).single();
                if (!user || user.password !== password) throw new Error("Invalid credentials!");
                // Success
                localStorage.setItem('bulker_id', user.bulker_id);
                navigate('/bulkers/dashboard');
            } else if (authMode === 'otp_verify') {
                if (otp !== generatedOtp) throw new Error("Invalid OTP!");
                const { data: user } = await supabase.from('bulker_desks').select('*').eq(column, identifier).single();
                localStorage.setItem('bulker_id', user.bulker_id);
                navigate('/bulkers/dashboard');
            }
        } catch(e) {
            setError(e.message || "Login failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f4f6f8' }}>
            <Paper sx={{ p: 4, width: '100%', maxWidth: 400, borderRadius: '16px' }}>
                <Typography variant="h5" fontWeight="bold" mb={3} textAlign="center">Bulker Login</Typography>
                
                {error && <Typography color="error" variant="body2" mb={2} textAlign="center">{error}</Typography>}

                {authMode !== 'otp_verify' && (
                    <>
                        <ToggleButtonGroup
                            color="primary"
                            value={loginType}
                            exclusive
                            onChange={(e, val) => val && setLoginType(val)}
                            fullWidth
                            sx={{ mb: 3 }}
                        >
                            <ToggleButton value="email">Email</ToggleButton>
                            <ToggleButton value="phone">Phone</ToggleButton>
                        </ToggleButtonGroup>
                        
                        <TextField 
                            fullWidth label={loginType === 'email' ? "Email Address" : "Phone Number"} 
                            variant="outlined" margin="normal"
                            value={identifier} onChange={e => setIdentifier(e.target.value)}
                        />

                        {authMode === 'password' && (
                            <TextField 
                                fullWidth label="Password" type="password" 
                                variant="outlined" margin="normal"
                                value={password} onChange={e => setPassword(e.target.value)}
                            />
                        )}
                    </>
                )}

                {authMode === 'otp_verify' && (
                    <TextField 
                        fullWidth label="Enter 6-digit OTP" 
                        variant="outlined" margin="normal"
                        value={otp} onChange={e => setOtp(e.target.value)}
                    />
                )}

                <Button 
                    fullWidth variant="contained" size="large" sx={{ mt: 3, mb: 2, borderRadius: '8px' }}
                    onClick={authMode === 'password' || authMode === 'otp_verify' ? handleLogin : handleSendOtp}
                    disabled={loading}
                >
                    {loading ? <CircularProgress size={24} /> : 
                        authMode === 'otp_verify' ? 'Verify OTP & Login' : 
                        authMode === 'password' ? 'Login' : 'Send OTP'}
                </Button>

                {authMode === 'password' && loginType === 'email' && (
                    <Button fullWidth onClick={() => setAuthMode('otp')} sx={{ mb: 1 }}>Login with Email OTP instead</Button>
                )}
                {authMode === 'otp' && (
                    <Button fullWidth onClick={() => setAuthMode('password')} sx={{ mb: 1 }}>Login with Password instead</Button>
                )}

                <Typography textAlign="center" variant="body2" mt={2}>
                    Don't have an account? <Link to="/bulkers/register" style={{textDecoration:'none', fontWeight:'bold'}}>Register</Link>
                </Typography>
            </Paper>
        </Box>
    );
}
