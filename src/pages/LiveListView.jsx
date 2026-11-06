import { useState, useEffect, useMemo } from 'react';
import { 
  Box, Typography, Paper, TextField, Button, 
  CircularProgress, Snackbar, Alert, useTheme,
  Chip, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  Dialog, DialogTitle, DialogContent, DialogActions, InputAdornment
} from '@mui/material';
import { supabase } from '../supabaseClient';

// MUI Icons
import SearchIcon from '@mui/icons-material/Search';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import RefreshIcon from '@mui/icons-material/Refresh';
import LayersIcon from '@mui/icons-material/Layers';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import PersonIcon from '@mui/icons-material/Person';
import ClearIcon from '@mui/icons-material/Clear';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import BusinessIcon from '@mui/icons-material/Business';

function AppRow({ app, handleCopyList, theme, isDark }) {
  const [openModal, setOpenModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');

  const filteredUsers = useMemo(() => {
    return (app.users || []).filter(u => {
      if (!modalSearch) return true;
      const q = modalSearch.toLowerCase();
      if (typeof u === 'string') return u.toLowerCase().includes(q);
      return (
        (u.username || '').toLowerCase().includes(q) ||
        (u.earnerName || '').toLowerCase().includes(q) ||
        (u.earnerId || '').toLowerCase().includes(q)
      );
    });
  }, [app.users, modalSearch]);

  const formattedDate = app.appDate 
    ? new Date(app.appDate).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }) 
    : 'N/A';

  return (
    <>
      <TableRow
        hover
        sx={{
          transition: 'background-color 0.15s ease',
          '&:hover': {
            bgcolor: isDark ? 'rgba(255,255,255,0.03) !important' : 'rgba(0,0,0,0.02) !important'
          }
        }}
      >
        <TableCell sx={{ fontWeight: 800, color: '#6366f1', fontSize: '0.82rem' }}>
          #{app.taskId}
        </TableCell>
        <TableCell sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {app.appName}
            </Typography>
            {app.taskType && (
              <Chip
                size="small"
                label={app.taskType}
                sx={{
                  height: 20,
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderRadius: '6px'
                }}
              />
            )}
          </Box>
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
            <BusinessIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8rem', lineHeight: 1.2 }}>
                {app.sponsorName || 'Direct'}
              </Typography>
              {app.sponsorId && (
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem', fontFamily: 'monospace' }}>
                  {app.sponsorId}
                </Typography>
              )}
            </Box>
          </Box>
        </TableCell>
        <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary', fontWeight: 600 }}>
          {formattedDate}
        </TableCell>
        <TableCell align="center">
          <Tooltip title="Click to view live user list">
            <Chip 
              label={`${(app.users || []).length} Live Earners`} 
              size="small" 
              onClick={() => setOpenModal(true)} 
              sx={{
                fontWeight: 800,
                fontSize: '0.72rem',
                borderRadius: '8px',
                cursor: 'pointer',
                bgcolor: 'rgba(16,185,129,0.15)',
                color: '#10b981',
                border: '1px solid rgba(16,185,129,0.3)',
                '&:hover': {
                  bgcolor: 'rgba(16,185,129,0.25)'
                }
              }} 
            />
          </Tooltip>
        </TableCell>
        <TableCell align="right" sx={{ whiteSpace: 'nowrap', width: 160 }}>
          <Tooltip title="Copy Formatted Live List for Client">
            <Button
              size="small"
              variant="outlined"
              onClick={(e) => handleCopyList(e, app)}
              startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
              sx={{
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '0.75rem',
                textTransform: 'none',
                whiteSpace: 'nowrap',
                minWidth: 'max-content',
                px: 2,
                py: 0.7,
                borderColor: 'rgba(99,102,241,0.3)',
                color: '#6366f1',
                bgcolor: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.04)',
                '&:hover': {
                  borderColor: '#6366f1',
                  bgcolor: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.1)'
                }
              }}
            >
              Copy Report
            </Button>
          </Tooltip>
        </TableCell>
      </TableRow>

      {/* Modal: View Listed Users */}
      <Dialog 
        open={openModal} 
        onClose={() => setOpenModal(false)} 
        maxWidth="md" 
        fullWidth 
        PaperProps={{ 
          sx: { 
            borderRadius: '24px',
            p: 1,
            bgcolor: isDark ? 'rgba(15,23,42,0.95)' : '#ffffff',
            backdropFilter: 'blur(20px)',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
          } 
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, pb: 1 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Live Submissions Dossier — Task #{app.taskId}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {app.appName} • {(app.users || []).length} Verified Live Earners
            </Typography>
          </Box>
          <TextField
            size="small"
            placeholder="Search username, earner..."
            value={modalSearch}
            onChange={(e) => setModalSearch(e.target.value)}
            sx={{
              minWidth: 260,
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
              }
            }}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 18 }} />
            }}
          />
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
          <TableContainer sx={{ maxHeight: 480 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ '& th': { bgcolor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(248,250,252,0.95)', fontWeight: 800, fontSize: '0.75rem', py: 1.5, color: 'text.secondary' } }}>
                  <TableCell width="60">#</TableCell>
                  <TableCell>SUBMITTED USERNAME</TableCell>
                  <TableCell>EARNER NAME</TableCell>
                  <TableCell>EARNER ID</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                      No live users found matching "{modalSearch}"
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((u, idx) => (
                    <TableRow key={idx} hover sx={{ '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' } }}>
                      <TableCell sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem' }}>
                        {idx + 1}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#10b981', fontSize: '0.82rem' }}>
                        {typeof u === 'string' ? u : (u.username || 'UNKNOWN').toUpperCase()}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                        {typeof u === 'string' ? 'Loading...' : u.earnerName}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {typeof u === 'string' ? 'Loading...' : u.earnerId}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Showing {filteredUsers.length} of {(app.users || []).length} total records
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              onClick={() => setOpenModal(false)}
              sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700 }}
              color="inherit"
            >
              Close
            </Button>
            <Button 
              onClick={(e) => handleCopyList(e, app)} 
              startIcon={<ContentCopyIcon sx={{ fontSize: 16 }} />} 
              variant="contained" 
              sx={{
                borderRadius: '12px',
                fontWeight: 800,
                textTransform: 'none',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
              }}
            >
              Copy Full Client Report
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </>
  );
}

function PendingAppRow({ app, theme, isDark }) {
  const [openModal, setOpenModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');

  const filteredUsers = useMemo(() => {
    return (app.users || []).filter(u => {
      if (!modalSearch) return true;
      const q = modalSearch.toLowerCase();
      if (typeof u === 'string') return u.toLowerCase().includes(q);
      return (
        (u.username || '').toLowerCase().includes(q) ||
        (u.earnerName || '').toLowerCase().includes(q) ||
        (u.earnerId || '').toLowerCase().includes(q)
      );
    });
  }, [app.users, modalSearch]);

  const formattedAppDate = app.appDate 
    ? new Date(app.appDate).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }) 
    : 'N/A';
  const formattedCheckDate = app.liveCheckingDate 
    ? new Date(app.liveCheckingDate).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }) 
    : 'N/A';

  return (
    <>
      <TableRow
        hover
        sx={{
          transition: 'background-color 0.15s ease',
          '&:hover': {
            bgcolor: isDark ? 'rgba(255,255,255,0.03) !important' : 'rgba(0,0,0,0.02) !important'
          }
        }}
      >
        <TableCell sx={{ fontWeight: 800, color: '#6366f1', fontSize: '0.82rem' }}>
          #{app.taskId}
        </TableCell>
        <TableCell sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
          {app.appName}
        </TableCell>
        <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary', fontWeight: 600 }}>
          {formattedAppDate}
        </TableCell>
        <TableCell sx={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700 }}>
          {formattedCheckDate}
        </TableCell>
        <TableCell align="center">
          <Tooltip title="Click to view pending reviews">
            <Chip 
              label={`${app.pendingCount} Pending`} 
              size="small" 
              onClick={() => setOpenModal(true)} 
              sx={{
                fontWeight: 800,
                fontSize: '0.72rem',
                borderRadius: '8px',
                cursor: 'pointer',
                bgcolor: 'rgba(245,158,11,0.15)',
                color: '#f59e0b',
                border: '1px solid rgba(245,158,11,0.3)',
                '&:hover': {
                  bgcolor: 'rgba(245,158,11,0.25)'
                }
              }} 
            />
          </Tooltip>
        </TableCell>
        <TableCell align="center">
          <Chip
            label={`${app.totalCount} Total`}
            size="small"
            sx={{
              fontWeight: 700,
              fontSize: '0.72rem',
              borderRadius: '8px',
              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
            }}
          />
        </TableCell>
      </TableRow>

      {/* Modal: View Pending Users */}
      <Dialog 
        open={openModal} 
        onClose={() => setOpenModal(false)} 
        maxWidth="md" 
        fullWidth 
        PaperProps={{ 
          sx: { 
            borderRadius: '24px',
            p: 1,
            bgcolor: isDark ? 'rgba(15,23,42,0.95)' : '#ffffff',
            backdropFilter: 'blur(20px)',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
          } 
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, pb: 1 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Pending Verification Queue — Task #{app.taskId}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {app.appName} • {app.pendingCount} Reviews Awaiting Verification
            </Typography>
          </Box>
          <TextField
            size="small"
            placeholder="Search pending user..."
            value={modalSearch}
            onChange={(e) => setModalSearch(e.target.value)}
            sx={{
              minWidth: 260,
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
              }
            }}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 18 }} />
            }}
          />
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
          <TableContainer sx={{ maxHeight: 480 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ '& th': { bgcolor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(248,250,252,0.95)', fontWeight: 800, fontSize: '0.75rem', py: 1.5, color: 'text.secondary' } }}>
                  <TableCell width="60">#</TableCell>
                  <TableCell>SUBMITTED USERNAME</TableCell>
                  <TableCell>EARNER NAME</TableCell>
                  <TableCell>EARNER ID</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                      No pending users found matching "{modalSearch}"
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((u, idx) => (
                    <TableRow key={idx} hover sx={{ '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' } }}>
                      <TableCell sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem' }}>
                        {idx + 1}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#f59e0b', fontSize: '0.82rem' }}>
                        {typeof u === 'string' ? u : (u.username || 'UNKNOWN').toUpperCase()}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                        {typeof u === 'string' ? 'Loading...' : u.earnerName}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {typeof u === 'string' ? 'Loading...' : u.earnerId}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Showing {filteredUsers.length} of {app.pendingCount} pending submissions
          </Typography>
          <Button
            onClick={() => setOpenModal(false)}
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700 }}
            color="inherit"
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default function LiveListView() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [loading, setLoading] = useState(true);
  const [liveAppsData, setLiveAppsData] = useState([]);
  const [filteredApps, setFilteredApps] = useState([]);

  const [activeTab, setActiveTab] = useState(0); // 0: Live Deliverables, 1: Pending Backlog
  const [pendingAppsData, setPendingAppsData] = useState([]);
  const [filteredPendingApps, setFilteredPendingApps] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [pendingPage, setPendingPage] = useState(0);
  const [pendingRowsPerPage, setPendingRowsPerPage] = useState(10);

  // Pagination for Live
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    fetchLiveLists();
  }, []);

  const fetchPendingApps = async () => {
    setLoadingPending(true);
    try {
      const { data, error } = await supabase
        .from('apps')
        .select(`id, task_id, app_name, app_date, live_checking_date, review_submit_data ( status, submitted_username, earner_id )`)
        .order('task_id', { ascending: false });

      if (error) throw error;
      
      let allEarnerIds = [];
      data.forEach(app => {
         if (app.review_submit_data) {
             app.review_submit_data.forEach(r => {
                 if (r.earner_id) allEarnerIds.push(r.earner_id);
             });
         }
      });
      const uniqueEarnerIds = [...new Set(allEarnerIds)];
      
      const { data: profiles } = await supabase.from('profiles').select('earner_id, first_name, last_name').in('earner_id', uniqueEarnerIds);
      
      const nameMap = {};
      if (profiles) {
         profiles.forEach(p => {
             nameMap[p.earner_id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown';
         });
      }

      const pending = data.map(app => {
         const reviews = app.review_submit_data || [];
         const pendingReviews = reviews.filter(r => r.status === 'Under Review');
         
         const pendingUsers = pendingReviews.map(r => {
            let eName = nameMap[r.earner_id];
            if (!eName || eName === 'Unknown') {
              if (r.earner_id && !r.earner_id.startsWith('NOVAIRA/')) {
                eName = r.earner_id;
              } else if (r.submitted_username) {
                eName = r.submitted_username;
              } else {
                eName = r.earner_id || 'Member';
              }
            }
            return {
              username: r.submitted_username || 'Unknown',
              earnerId: r.earner_id || 'N/A',
              earnerName: eName
            };
         });
         
         return {
            taskId: app.task_id,
            appName: app.app_name,
            appDate: app.app_date,
            liveCheckingDate: app.live_checking_date,
            pendingCount: pendingReviews.length,
            totalCount: reviews.length,
            users: pendingUsers
         };
      }).filter(app => app.pendingCount > 0);

      setPendingAppsData(pending);
      setFilteredPendingApps(pending);
    } catch(err) {
      console.error(err);
      setSnack({ open: true, message: 'Failed to fetch pending apps.', severity: 'error' });
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    if (activeTab === 1 && pendingAppsData.length === 0) {
      fetchPendingApps();
    }
  }, [activeTab]);

  useEffect(() => {
    let result = pendingAppsData;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(app => 
        app.taskId.toString().includes(q) || 
        app.appName.toLowerCase().includes(q)
      );
    }

    if (dateFilter) {
      result = result.filter(app => {
        if (!app.appDate) return false;
        return app.appDate.startsWith(dateFilter);
      });
    }

    setFilteredPendingApps(result);
    setPendingPage(0);
  }, [searchQuery, dateFilter, pendingAppsData]);

  const fetchLiveLists = async () => {
    setLoading(true);
    try {
      let data = [];
      let pageNum = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const from = pageNum * pageSize;
        const to = from + pageSize - 1;
        const { data: chunk, error } = await supabase
          .from('review_submit_data')
          .select(`
            id, 
            submitted_username, 
            earner_id,
            app_id, 
            apps ( task_id, app_name, app_date, task_type, sponsor_type, sponsor_id )
          `)
          .eq('status', 'Live')
          .range(from, to)
          .order('submitted_at', { ascending: false });

        if (error) throw error;
        if (chunk && chunk.length > 0) {
          data = data.concat(chunk);
          if (chunk.length < pageSize) {
            hasMore = false;
          } else {
            pageNum++;
          }
        } else {
          hasMore = false;
        }
      }
      
      const earnerIds = [...new Set(data.map(d => d.earner_id).filter(Boolean))];
      const allSponsorIds = [...new Set(data.map(d => d.apps?.sponsor_id).filter(Boolean))];

      const profileChunks = [];
      const pChunkSize = 100;
      for (let i = 0; i < earnerIds.length; i += pChunkSize) {
        const slice = earnerIds.slice(i, i + pChunkSize);
        profileChunks.push(supabase.from('profiles').select('earner_id, first_name, last_name').in('earner_id', slice));
      }

      const [profilesResults, clientsRes, providersRes] = await Promise.all([
        Promise.all(profileChunks),
        allSponsorIds.length > 0 ? supabase.from('clients').select('client_id, name').in('client_id', allSponsorIds) : Promise.resolve({ data: [] }),
        allSponsorIds.length > 0 ? supabase.from('providers').select('provider_id, name').in('provider_id', allSponsorIds) : Promise.resolve({ data: [] })
      ]);
      
      const nameMap = {};
      profilesResults.forEach(res => {
        (res.data || []).forEach(p => {
          nameMap[p.earner_id] = `${p.first_name || ''} ${p.last_name || ''}`.trim();
        });
      });

      const sponsorMap = {};
      (clientsRes.data || []).forEach(c => {
        sponsorMap[c.client_id] = { name: c.name, id: c.client_id };
      });
      (providersRes.data || []).forEach(p => {
        sponsorMap[p.provider_id] = { name: p.name, id: p.provider_id };
      });

      const grouped = {};
      data.forEach(row => {
        if (!row.apps) return;
        const appId = row.app_id;
        const sId = row.apps.sponsor_id;
        const sInfo = sponsorMap[sId];
        const shortSponsorCode = sId ? sId.split('/').pop() : '';
        const sponsorName = sInfo?.name || (shortSponsorCode ? `${row.apps.sponsor_type || 'Provider'} (${shortSponsorCode})` : (row.apps.sponsor_type || 'Direct'));
        const sponsorId = sInfo?.id || sId || 'N/A';

        if (!grouped[appId]) {
          grouped[appId] = {
            appId: appId,
            taskId: row.apps.task_id,
            appName: row.apps.app_name,
            sponsorName: sponsorName,
            sponsorId: sponsorId,
            provider: `${sponsorName} (${sponsorId})`,
            appDate: row.apps.app_date,
            taskType: row.apps.task_type,
            users: []
          };
        }

        let earnerName = nameMap[row.earner_id];
        if (!earnerName || earnerName === 'Unknown') {
          if (row.earner_id && !row.earner_id.startsWith('NOVAIRA/')) {
            earnerName = row.earner_id;
          } else if (row.submitted_username) {
            earnerName = row.submitted_username;
          } else {
            earnerName = row.earner_id || 'Member';
          }
        }

        grouped[appId].users.push({
            username: row.submitted_username || 'Unknown',
            earnerId: row.earner_id || 'N/A',
            earnerName: earnerName
        });
      });

      const appsArray = Object.values(grouped).sort((a, b) => b.taskId - a.taskId);
      setLiveAppsData(appsArray);
      setFilteredApps(appsArray);
    } catch (err) {
      console.error(err);
      setSnack({ open: true, message: 'Failed to fetch live lists.', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let result = liveAppsData;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(app => 
        app.taskId.toString().includes(q) || 
        app.appName.toLowerCase().includes(q) ||
        (app.sponsorName && app.sponsorName.toLowerCase().includes(q)) ||
        (app.sponsorId && app.sponsorId.toLowerCase().includes(q)) ||
        app.users.some(u => 
            (u.username || '').toLowerCase().includes(q) || 
            (u.earnerId || '').toLowerCase().includes(q) || 
            (u.earnerName || '').toLowerCase().includes(q)
        )
      );
    }

    if (dateFilter) {
      result = result.filter(app => {
        if (!app.appDate) return false;
        return app.appDate.startsWith(dateFilter);
      });
    }

    setFilteredApps(result);
    setPage(0);
  }, [searchQuery, dateFilter, liveAppsData]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCopyList = (e, app) => {
    e.stopPropagation();
    
    const formattedDate = app.appDate 
      ? new Date(app.appDate).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }) 
      : 'N/A';

    let textToCopy = `${app.appName}\n`;
    textToCopy += `APP ID : ${app.taskId}\n`;
    textToCopy += `APP DATE: ${formattedDate}\n\n`;

    app.users.forEach(u => {
      textToCopy += `${(u.username || 'UNKNOWN').toUpperCase()}\n`;
    });

    textToCopy += `\nTOTAL LIVE : ${app.users.length}`;

    navigator.clipboard.writeText(textToCopy);
    setSnack({ open: true, message: `Copied ${app.users.length} live submissions for "${app.appName}"!`, severity: 'success' });
  };

  // Top KPI Metrics Computations
  const totalLiveApps = liveAppsData.length;
  const totalLiveSubmissions = useMemo(() => {
    return liveAppsData.reduce((acc, a) => acc + (a.users || []).length, 0);
  }, [liveAppsData]);

  const totalPendingApps = pendingAppsData.length;
  const totalPendingSubmissions = useMemo(() => {
    return pendingAppsData.reduce((acc, a) => acc + (a.pendingCount || 0), 0);
  }, [pendingAppsData]);

  const kpis = [
    {
      title: 'LIVE DELIVERABLE APPS',
      value: totalLiveApps,
      hint: 'Ready for client dispatch',
      color: '#6366f1',
      icon: <PlaylistPlayIcon sx={{ fontSize: 22, color: '#6366f1' }} />,
      bg: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)'
    },
    {
      title: 'VERIFIED LIVE REVIEWS',
      value: totalLiveSubmissions,
      hint: 'Completed earner reviews',
      color: '#10b981',
      icon: <CheckCircleIcon sx={{ fontSize: 22, color: '#10b981' }} />,
      bg: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.06)'
    },
    {
      title: 'PENDING CHECKING APPS',
      value: totalPendingApps,
      hint: 'Tasks with unverified reviews',
      color: '#f59e0b',
      icon: <HourglassEmptyIcon sx={{ fontSize: 22, color: '#f59e0b' }} />,
      bg: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.06)'
    },
    {
      title: 'REVIEWS IN REVIEW QUEUE',
      value: totalPendingSubmissions,
      hint: 'Earner proof submissions',
      color: '#06b6d4',
      icon: <PendingActionsIcon sx={{ fontSize: 22, color: '#06b6d4' }} />,
      bg: isDark ? 'rgba(6,182,212,0.1)' : 'rgba(6,182,212,0.06)'
    }
  ];

  const paginatedApps = filteredApps.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 12, gap: 2 }}>
        <CircularProgress size={40} sx={{ color: '#6366f1' }} />
        <Typography variant="body2" color="text.secondary">Loading live client deliverables...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 3, pb: 8 }}>
      
      {/* 1. Header Pod: Glassmorphic Executive Bar */}
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
          gap: 2,
          width: '100%'
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
            <FactCheckIcon sx={{ fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
              Live Deliverables & Client Submission Reports
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Review published live batches, generate 1-click copyable client reports, and track pending verification backlogs.
            </Typography>
          </Box>
        </Box>

        {/* Tab Controls: Modern Glass Segmented Pills */}
        <Box
          sx={{
            display: 'flex',
            p: 0.6,
            borderRadius: '14px',
            bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            gap: 0.5
          }}
        >
          <Button
            size="small"
            onClick={() => setActiveTab(0)}
            startIcon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
            sx={{
              borderRadius: '10px',
              fontWeight: 800,
              fontSize: '0.84rem',
              px: 2,
              py: 0.8,
              textTransform: 'none',
              bgcolor: activeTab === 0 ? '#10b981' : 'transparent',
              color: activeTab === 0 ? '#fff' : 'text.secondary',
              boxShadow: activeTab === 0 ? '0 4px 14px rgba(16,185,129,0.3)' : 'none',
              '&:hover': {
                bgcolor: activeTab === 0 ? '#059669' : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
              }
            }}
          >
            Live Deliverables ({totalLiveApps})
          </Button>
          <Button
            size="small"
            onClick={() => setActiveTab(1)}
            startIcon={<HourglassEmptyIcon sx={{ fontSize: 16 }} />}
            sx={{
              borderRadius: '10px',
              fontWeight: 800,
              fontSize: '0.84rem',
              px: 2,
              py: 0.8,
              textTransform: 'none',
              bgcolor: activeTab === 1 ? '#f59e0b' : 'transparent',
              color: activeTab === 1 ? '#fff' : 'text.secondary',
              boxShadow: activeTab === 1 ? '0 4px 14px rgba(245,158,11,0.3)' : 'none',
              '&:hover': {
                bgcolor: activeTab === 1 ? '#d97706' : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
              }
            }}
          >
            Pending Backlog ({totalPendingApps})
          </Button>
        </Box>
      </Paper>

      {/* 2. Top 4 KPI Telemetry Pods */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
          gap: 2,
          width: '100%'
        }}
      >
        {kpis.map((k, i) => (
          <Paper
            key={i}
            elevation={0}
            sx={{
              p: 2.2,
              borderRadius: '20px',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(16px)',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              width: '100%'
            }}
          >
            <Box
              sx={{
                width: 46,
                height: 46,
                borderRadius: '14px',
                bgcolor: k.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {k.icon}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.05em', display: 'block' }} noWrap>
                {k.title}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: k.color, my: 0.2 }}>
                {k.value}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }} noWrap>
                {k.hint}
              </Typography>
            </Box>
          </Paper>
        ))}
      </Box>

      {/* 3. Advanced Filtering & Search Bar (Full Width) */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, md: 3 },
          borderRadius: '24px',
          border: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(16px)',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterAltIcon sx={{ color: '#6366f1', fontSize: 20 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              Live Deliverables Filter & Query Controls
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {(searchQuery || dateFilter) && (
              <Button
                size="small"
                variant="text"
                onClick={() => {
                  setSearchQuery('');
                  setDateFilter('');
                }}
                startIcon={<ClearIcon sx={{ fontSize: 14 }} />}
                sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, color: 'text.secondary' }}
              >
                Clear Filters
              </Button>
            )}
            <Button
              size="small"
              onClick={activeTab === 0 ? fetchLiveLists : fetchPendingApps}
              startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
              sx={{
                borderRadius: '10px',
                fontWeight: 700,
                textTransform: 'none',
                color: 'text.primary',
                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
              }}
            >
              Refresh
            </Button>
          </Box>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '2.5fr 1fr' },
            gap: 2,
            width: '100%'
          }}
        >
          <TextField
            fullWidth
            size="small"
            placeholder="Search by app name, task ID, client/provider, or submitted earner username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 18 }} />
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '14px',
                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
              }
            }}
          />

          <TextField
            fullWidth
            size="small"
            type="date"
            label="Filter by App Release Date"
            InputLabelProps={{ shrink: true }}
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '14px',
                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
              }
            }}
          />
        </Box>
      </Paper>

      {/* ============================================================== */}
      {/* TAB 0: LIVE DELIVERABLES TABLE (APPS WITH LIVE MEMBERS)        */}
      {/* ============================================================== */}
      {activeTab === 0 && (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: '24px',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(16px)',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Live Client Deliverables ({filteredApps.length} Tasks)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Applications with verified live earner reviews ready for 1-click clipboard export to partners.
              </Typography>
            </Box>
          </Box>

          {filteredApps.length === 0 ? (
            <Box
              sx={{
                py: 8,
                px: 3,
                textAlign: 'center',
                borderRadius: '16px',
                border: '1.5px dashed',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1.5
              }}
            >
              <FactCheckIcon sx={{ fontSize: 44, color: 'text.secondary', opacity: 0.5 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                No Live Deliverables Found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 450 }}>
                No applications match your active search or date filters. Ensure reviews have been marked "Live" via the Live List Hub.
              </Typography>
            </Box>
          ) : (
            <TableContainer
              component={Paper}
              elevation={0}
              sx={{
                borderRadius: '16px',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                overflow: 'hidden',
                bgcolor: isDark ? 'rgba(15,23,42,0.4)' : '#ffffff',
                width: '100%'
              }}
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: isDark ? 'rgba(15,23,42,0.9)' : 'rgba(248,250,252,0.95)', backdropFilter: 'blur(10px)', fontWeight: 800, fontSize: '0.75rem', py: 1.5, color: 'text.secondary', letterSpacing: '0.04em' } }}>
                    <TableCell width="120" sx={{ whiteSpace: 'nowrap' }}>TASK ID</TableCell>
                    <TableCell>APPLICATION NAME</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>CLIENT / SPONSOR</TableCell>
                    <TableCell width="160" sx={{ whiteSpace: 'nowrap' }}>RELEASE DATE</TableCell>
                    <TableCell align="center" width="160" sx={{ whiteSpace: 'nowrap' }}>LIVE REVIEWS</TableCell>
                    <TableCell align="right" width="160" sx={{ whiteSpace: 'nowrap' }}>ACTIONS</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedApps.map(app => (
                    <AppRow 
                      key={app.appId} 
                      app={app} 
                      handleCopyList={handleCopyList} 
                      theme={theme}
                      isDark={isDark}
                    />
                  ))}
                </TableBody>
              </Table>

              <TablePagination
                rowsPerPageOptions={[5, 10, 25, 50, 100]}
                component="div"
                count={filteredApps.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                sx={{
                  borderTop: '1px solid',
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                  '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }
                }}
              />
            </TableContainer>
          )}
        </Paper>
      )}

      {/* ============================================================== */}
      {/* TAB 1: PENDING VERIFICATION BACKLOG                            */}
      {/* ============================================================== */}
      {activeTab === 1 && (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: '24px',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(16px)',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Pending Verification Backlog ({filteredPendingApps.length} Tasks)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Applications with submitted reviews pending verification against store listings.
              </Typography>
            </Box>
          </Box>

          {loadingPending ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, gap: 2 }}>
              <CircularProgress size={36} sx={{ color: '#6366f1' }} />
              <Typography variant="body2" color="text.secondary">Loading pending verification queue...</Typography>
            </Box>
          ) : filteredPendingApps.length === 0 ? (
            <Box
              sx={{
                py: 8,
                px: 3,
                textAlign: 'center',
                borderRadius: '16px',
                border: '1.5px dashed',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1.5
              }}
            >
              <CheckCircleIcon sx={{ fontSize: 44, color: '#10b981', opacity: 0.6 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                No Pending Reviews in Queue
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 450 }}>
                All submitted reviews have been verified and settled!
              </Typography>
            </Box>
          ) : (
            <TableContainer
              component={Paper}
              elevation={0}
              sx={{
                borderRadius: '16px',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                overflow: 'hidden',
                bgcolor: isDark ? 'rgba(15,23,42,0.4)' : '#ffffff',
                width: '100%'
              }}
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: isDark ? 'rgba(15,23,42,0.9)' : 'rgba(248,250,252,0.95)', backdropFilter: 'blur(10px)', fontWeight: 800, fontSize: '0.75rem', py: 1.5, color: 'text.secondary', letterSpacing: '0.04em' } }}>
                    <TableCell width="120">TASK ID</TableCell>
                    <TableCell>APPLICATION NAME</TableCell>
                    <TableCell width="160">RELEASE DATE</TableCell>
                    <TableCell width="160">LIVE CHECK DATE</TableCell>
                    <TableCell align="center" width="160">PENDING AUDIT</TableCell>
                    <TableCell align="center" width="140">TOTAL USERS</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredPendingApps
                    .slice(pendingPage * pendingRowsPerPage, pendingPage * pendingRowsPerPage + pendingRowsPerPage)
                    .map(app => (
                      <PendingAppRow 
                        key={app.taskId} 
                        app={app} 
                        theme={theme}
                        isDark={isDark}
                      />
                    ))}
                </TableBody>
              </Table>

              <TablePagination
                rowsPerPageOptions={[5, 10, 25, 50, 100]}
                component="div"
                count={filteredPendingApps.length}
                rowsPerPage={pendingRowsPerPage}
                page={pendingPage}
                onPageChange={(e, newPage) => setPendingPage(newPage)}
                onRowsPerPageChange={(e) => { setPendingRowsPerPage(parseInt(e.target.value, 10)); setPendingPage(0); }}
                sx={{
                  borderTop: '1px solid',
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                  '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }
                }}
              />
            </TableContainer>
          )}
        </Paper>
      )}

      {/* Snackbar Notification */}
      <Snackbar 
        open={snack.open} 
        autoHideDuration={4000} 
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnack({ ...snack, open: false })} 
          severity={snack.severity} 
          sx={{ width: '100%', borderRadius: '14px', fontWeight: 700 }}
        >
          {snack.message}
        </Alert>
      </Snackbar>

    </Box>
  );
}
