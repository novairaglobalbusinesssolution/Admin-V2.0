import React, { useState, useEffect } from 'react';
import { Typography, Card, CardContent, Box, useTheme, Avatar, CircularProgress, Divider, List, ListItem, ListItemAvatar, ListItemText, Skeleton } from '@mui/material';

import GroupIcon from '@mui/icons-material/Group';
import AppsIcon from '@mui/icons-material/Apps';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import BusinessIcon from '@mui/icons-material/Business';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import { supabase } from '../supabaseClient';

const getColorTokens = (theme, color) => {
  const tones = {
    info: {
      light: theme.palette.mode === 'light' ? '#dbeafe' : '#1d4ed8',
      dark: theme.palette.mode === 'light' ? '#1d4ed8' : '#bfdbfe',
      glow: theme.palette.mode === 'light' ? 'rgba(37, 99, 235, 0.14)' : 'rgba(96, 165, 250, 0.18)',
    },
    success: {
      light: theme.palette.mode === 'light' ? '#dcfce7' : '#166534',
      dark: theme.palette.mode === 'light' ? '#15803d' : '#bbf7d0',
      glow: theme.palette.mode === 'light' ? 'rgba(34, 197, 94, 0.14)' : 'rgba(134, 239, 172, 0.15)',
    },
    warning: {
      light: theme.palette.mode === 'light' ? '#fef3c7' : '#b45309',
      dark: theme.palette.mode === 'light' ? '#b45309' : '#fef3c7',
      glow: theme.palette.mode === 'light' ? 'rgba(245, 158, 11, 0.14)' : 'rgba(251, 191, 36, 0.18)',
    },
    secondary: {
      light: theme.palette.mode === 'light' ? '#f3e8ff' : '#6d28d9',
      dark: theme.palette.mode === 'light' ? '#7c3aed' : '#ddd6fe',
      glow: theme.palette.mode === 'light' ? 'rgba(168, 85, 247, 0.13)' : 'rgba(196, 181, 253, 0.12)',
    },
  };

  return tones[color] || tones.info;
};

const StatCard = ({ title, value, icon, color, loading }) => {
  const theme = useTheme();
  const tones = getColorTokens(theme, color);

  return (
    <Card elevation={0} sx={{
      border: theme.palette.mode === 'light' ? '1px solid rgba(15, 23, 42, 0.06)' : '1px solid rgba(148, 163, 184, 0.08)',
      bgcolor: theme.palette.mode === 'light' ? 'background.paper' : 'rgba(17, 24, 39, 0.62)',
      borderRadius: '18px',
      height: '100%',
      boxShadow: theme.palette.mode === 'light' ? '0 10px 26px rgba(15, 23, 42, 0.04)' : '0 14px 30px rgba(2, 6, 23, 0.34)',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      '&:hover': { transform: 'translateY(-2px)', boxShadow: theme.palette.mode === 'light' ? '0 14px 28px rgba(15, 23, 42, 0.08)' : '0 18px 38px rgba(2, 6, 23, 0.48)' },
    }}>
      <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography color="text.secondary" variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 600, letterSpacing: '0.03em' }}>
              {title}
            </Typography>
            {loading ? (
              <CircularProgress size={20} thickness={5} sx={{ mt: 0.5, color: tones.dark }} />
            ) : (
              <Typography variant="h5" color="text.primary" sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 600, lineHeight: 1.2 }}>
                {value}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              background: `linear-gradient(135deg, ${tones.light}, ${tones.glow})`,
              color: tones.dark,
              width: 42,
              height: 42,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '14px',
              boxShadow: `inset 0 0 0 1px ${theme.palette.mode === 'light' ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.08)'}`,
              animation: 'pulse-soft 2.4s ease-in-out infinite',
              '@keyframes pulse-soft': {
                '0%, 100%': { transform: 'scale(1)', opacity: 1 },
                '50%': { transform: 'scale(1.06)', opacity: 0.92 },
              },
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};


const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const seconds = Math.floor((new Date() - date) / 1000);
  
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  return Math.floor(seconds) + " seconds ago";
};

export default function Dashboard() {
  const theme = useTheme();
  const [stats, setStats] = useState({ users: 0, apps: 0, bulkers: 0, clients: 0 });
  const [recentUsers, setRecentUsers] = useState([]);
  const [recentApps, setRecentApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Counts
      const [usersCount, appsCount, bulkersCount, clientsCount] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('apps').select('*', { count: 'exact', head: true }),
        supabase.from('bulker_desks').select('*', { count: 'exact', head: true }),
        supabase.from('clients').select('*', { count: 'exact', head: true })
      ]);

      setStats({
        users: usersCount.count || 0,
        apps: appsCount.count || 0,
        bulkers: bulkersCount.count || 0,
        clients: clientsCount.count || 0
      });

      // 2. Fetch Recent Users (Last 6 registered)
      const { data: latestUsers } = await supabase
        .from('profiles')
        .select('earner_id, first_name, last_name, email, created_at, status')
        .order('created_at', { ascending: false })
        .limit(6);
      
      if (latestUsers) setRecentUsers(latestUsers);

      // 3. Fetch Recent Apps
      const { data: latestApps } = await supabase
        .from('apps')
        .select('task_id, app_name, app_package, created_at, status')
        .order('created_at', { ascending: false })
        .limit(6);
        
      if (latestApps) setRecentApps(latestApps);

    } catch (e) {
      console.error('Error fetching dashboard data', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.2 }}>
        <Typography variant="h6" color="text.primary" sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 700 }}>
          Dashboard Overview
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2.25 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <StatCard title="Total Earner Users" value={stats.users.toLocaleString()} icon={<GroupIcon fontSize="small" />} color="info" loading={loading} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <StatCard title="Total Apps Published" value={stats.apps.toLocaleString()} icon={<AppsIcon fontSize="small" />} color="success" loading={loading} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <StatCard title="Total Bulkers" value={stats.bulkers.toLocaleString()} icon={<PersonAddIcon fontSize="small" />} color="warning" loading={loading} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <StatCard title="Total Clients" value={stats.clients.toLocaleString()} icon={<BusinessIcon fontSize="small" />} color="secondary" loading={loading} />
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2.25 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Card elevation={0} sx={{
            border: theme.palette.mode === 'light' ? '1px solid rgba(15, 23, 42, 0.06)' : '1px solid rgba(148, 163, 184, 0.08)',
            bgcolor: theme.palette.mode === 'light' ? 'background.paper' : 'rgba(17, 24, 39, 0.62)',
            borderRadius: '20px',
            minHeight: 330,
            boxShadow: theme.palette.mode === 'light' ? '0 10px 26px rgba(15, 23, 42, 0.04)' : '0 14px 30px rgba(2, 6, 23, 0.3)',
          }}>
            <Box sx={{ p: 2.25, borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Recently Added Users</Typography>
              <Typography variant="caption" color="text.secondary">Latest registrations</Typography>
            </Box>

            {loading ? (
              <Box sx={{ p: 2.25, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {Array.from({ length: 4 }).map((_, index) => (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Skeleton variant="circular" width={36} height={36} sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Skeleton variant="text" width="55%" height={18} sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }} />
                      <Skeleton variant="text" width="70%" height={14} sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }} />
                    </Box>
                    <Skeleton variant="text" width={72} height={14} sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }} />
                  </Box>
                ))}
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {recentUsers.map((user, i) => (
                  <React.Fragment key={user.earner_id}>
                    <ListItem sx={{ py: 1.2, px: 2.25, alignItems: 'flex-start' }}>
                      <ListItemAvatar sx={{ minWidth: 42, mt: 0.3 }}>
                        <Avatar sx={{ width: 34, height: 34, bgcolor: theme.palette.primary.main, fontWeight: 700, fontSize: '0.8rem' }}>
                          {(user.first_name?.[0] || user.earner_id?.[0] || 'U').toUpperCase()}
                        </Avatar>
                      </ListItemAvatar>

                      <ListItemText
                        sx={{
                          my: 0,
                          minWidth: 0,
                          '& .MuiListItemText-primary': { mb: 0.35 },
                          '& .MuiListItemText-secondary': { display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap', overflow: 'hidden' },
                        }}
                        primary={<Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.35 }}>{user.first_name} {user.last_name || ''}</Typography>}
                        secondary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, width: '100%' }}>
                            <EmailOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'inline-block',
                                minWidth: 0,
                                maxWidth: '100%',
                              }}
                            >
                              {user.earner_id} • {user.email || 'No email'}
                            </Typography>
                          </Box>
                        }
                      />

                      <Box sx={{ textAlign: 'right', minWidth: 96, ml: 1.5, mt: 0.2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.4, color: 'text.secondary', mb: 0.15 }}>
                          <AccessTimeOutlinedIcon sx={{ fontSize: 12 }} />
                          <Typography variant="caption" color="text.secondary">
                            {timeAgo(user.created_at)}
                          </Typography>
                        </Box>
                        <Typography variant="caption" sx={{ color: user.status === 'Active' ? 'success.main' : 'error.main', fontWeight: 700 }}>
                          {user.status || 'Active'}
                        </Typography>
                      </Box>
                    </ListItem>
                    {i < recentUsers.length - 1 && <Divider component="li" sx={{ mx: 2.25 }} />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Card>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Card elevation={0} sx={{
            border: theme.palette.mode === 'light' ? '1px solid rgba(15, 23, 42, 0.06)' : '1px solid rgba(148, 163, 184, 0.08)',
            bgcolor: theme.palette.mode === 'light' ? 'background.paper' : 'rgba(17, 24, 39, 0.62)',
            borderRadius: '20px',
            minHeight: 330,
            boxShadow: theme.palette.mode === 'light' ? '0 10px 26px rgba(15, 23, 42, 0.04)' : '0 14px 30px rgba(2, 6, 23, 0.3)',
          }}>
            <Box sx={{ p: 2.25, borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Recently Published Apps</Typography>
              <Typography variant="caption" color="text.secondary">Latest app activity</Typography>
            </Box>

            {loading ? (
              <Box sx={{ p: 2.25, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {Array.from({ length: 4 }).map((_, index) => (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Skeleton variant="circular" width={36} height={36} sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Skeleton variant="text" width="50%" height={18} sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }} />
                      <Skeleton variant="text" width="72%" height={14} sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }} />
                    </Box>
                    <Skeleton variant="text" width={72} height={14} sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }} />
                  </Box>
                ))}
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {recentApps.map((app, i) => (
                  <React.Fragment key={app.task_id}>
                    <ListItem sx={{ py: 1.2, px: 2.25, alignItems: 'flex-start' }}>
                      <ListItemAvatar sx={{ minWidth: 42, mt: 0.3 }}>
                        <Avatar sx={{ width: 34, height: 34, bgcolor: theme.palette.success.main, color: '#fff', fontWeight: 700 }}>
                          <AppsIcon fontSize="small" />
                        </Avatar>
                      </ListItemAvatar>

                      <ListItemText
                        sx={{
                          my: 0,
                          minWidth: 0,
                          '& .MuiListItemText-primary': { mb: 0.35 },
                          '& .MuiListItemText-secondary': { display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap', overflow: 'hidden' },
                        }}
                        primary={
                          <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.35, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {app.app_name}
                          </Typography>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, width: '100%' }}>
                            <OpenInNewOutlinedIcon sx={{ fontSize: 13, color: 'text.secondary', flexShrink: 0 }} />
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'inline-block',
                                minWidth: 0,
                                maxWidth: '100%',
                              }}
                            >
                              Task #{app.task_id} • {app.app_package}
                            </Typography>
                          </Box>
                        }
                      />

                      <Box sx={{ textAlign: 'right', minWidth: 96, ml: 1.5, mt: 0.2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.4, color: 'text.secondary', mb: 0.15 }}>
                          <AccessTimeOutlinedIcon sx={{ fontSize: 12 }} />
                          <Typography variant="caption" color="text.secondary">
                            {timeAgo(app.created_at)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.4 }}>
                          <CheckCircleOutlineOutlinedIcon sx={{ fontSize: 12, color: app.status === 'active' ? 'success.main' : 'text.secondary' }} />
                          <Typography variant="caption" sx={{ color: app.status === 'active' ? 'success.main' : 'text.secondary', fontWeight: 700, textTransform: 'capitalize' }}>
                            {app.status || 'Active'}
                          </Typography>
                        </Box>
                      </Box>
                    </ListItem>
                    {i < recentApps.length - 1 && <Divider component="li" sx={{ mx: 2.25 }} />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Card>
        </Box>
      </Box>
    </Box>
  );
}
