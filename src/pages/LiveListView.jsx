import { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, TextField, Button, Grid, 
  CircularProgress, Snackbar, Alert, useTheme,
  Chip, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Collapse, Tabs, Tab,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { supabase } from '../supabaseClient';

function AppRow({ app, handleCopyList, theme }) {
  const [openModal, setOpenModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');

  const filteredUsers = (app.users || []).filter(u => {
    if (!modalSearch) return true;
    const q = modalSearch.toLowerCase();
    if (typeof u === 'string') return u.toLowerCase().includes(q);
    return (
      (u.username || '').toLowerCase().includes(q) ||
      (u.earnerName || '').toLowerCase().includes(q) ||
      (u.earnerId || '').toLowerCase().includes(q)
    );
  });

  return (
    <>
      <TableRow hover sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell sx={{ fontWeight: 600, color: 'primary.main' }}>Task #{app.taskId}</TableCell>
        <TableCell sx={{ fontWeight: 600 }}>{app.appName}</TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {app.sponsorName || 'Unknown'}
          </Typography>
          {app.sponsorId && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {app.sponsorId}
            </Typography>
          )}
        </TableCell>
        <TableCell>{app.appDate ? new Date(app.appDate).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }) : 'N/A'}</TableCell>
        <TableCell align="center">
          <Chip 
            label={(app.users || []).length} 
            size="small" 
            color="primary" 
            sx={{ fontWeight: 700, cursor: 'pointer' }} 
            onClick={() => setOpenModal(true)} 
          />
        </TableCell>
        <TableCell align="right">
          <Tooltip title="Copy Live List">
            <IconButton onClick={(e) => handleCopyList(e, app)} color="primary" sx={{ bgcolor: 'primary.main' + '1A' }}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </TableCell>
      </TableRow>

      <Dialog open={openModal} onClose={() => setOpenModal(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Listed Users - Task #{app.taskId}</Typography>
          <TextField
            size="small"
            placeholder="Search users..."
            value={modalSearch}
            onChange={(e) => setModalSearch(e.target.value)}
            sx={{ minWidth: 250 }}
            InputProps={{
              startAdornment: <SearchIcon color="action" sx={{ mr: 1, fontSize: 20 }} />
            }}
          />
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <TableContainer>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'background.default' }}>Submitted Username</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'background.default' }}>Earner Name</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'background.default' }}>Earner ID</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 3, color: 'text.secondary' }}>No users found matching "{modalSearch}"</TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((u, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{typeof u === 'string' ? u : u.username}</TableCell>
                      <TableCell>{typeof u === 'string' ? 'Loading...' : u.earnerName}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{typeof u === 'string' ? 'Loading...' : u.earnerId}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenModal(false)} color="inherit" sx={{ mr: 1, fontWeight: 600 }}>
            Close
          </Button>
          <Button onClick={(e) => handleCopyList(e, app)} startIcon={<ContentCopyIcon />} color="primary" variant="contained" disableElevation sx={{ borderRadius: '8px', fontWeight: 600 }}>
            Copy List
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function PendingAppRow({ app, theme }) {
  const [openModal, setOpenModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');

  const filteredUsers = (app.users || []).filter(u => {
    if (!modalSearch) return true;
    const q = modalSearch.toLowerCase();
    if (typeof u === 'string') return u.toLowerCase().includes(q);
    return (
      (u.username || '').toLowerCase().includes(q) ||
      (u.earnerName || '').toLowerCase().includes(q) ||
      (u.earnerId || '').toLowerCase().includes(q)
    );
  });

  return (
    <>
      <TableRow hover sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell sx={{ fontWeight: 600, color: 'primary.main' }}>Task #{app.taskId}</TableCell>
        <TableCell sx={{ fontWeight: 600 }}>{app.appName}</TableCell>
        <TableCell>{app.appDate ? new Date(app.appDate).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }) : 'N/A'}</TableCell>
        <TableCell>{app.liveCheckingDate ? new Date(app.liveCheckingDate).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }) : 'N/A'}</TableCell>
        <TableCell align="center">
          <Chip 
            label={app.pendingCount} 
            size="small" 
            color="warning" 
            sx={{ fontWeight: 700, cursor: 'pointer' }} 
            onClick={() => setOpenModal(true)} 
          />
        </TableCell>
        <TableCell align="center">
          <Chip label={app.totalCount} size="small" sx={{ fontWeight: 700 }} />
        </TableCell>
      </TableRow>

      <Dialog open={openModal} onClose={() => setOpenModal(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Pending Users - Task #{app.taskId}</Typography>
          <TextField
            size="small"
            placeholder="Search users..."
            value={modalSearch}
            onChange={(e) => setModalSearch(e.target.value)}
            sx={{ minWidth: 250 }}
            InputProps={{
              startAdornment: <SearchIcon color="action" sx={{ mr: 1, fontSize: 20 }} />
            }}
          />
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <TableContainer>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'background.default' }}>Submitted Username</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'background.default' }}>Earner Name</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'background.default' }}>Earner ID</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 3, color: 'text.secondary' }}>No pending users found matching "{modalSearch}"</TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((u, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{typeof u === 'string' ? u : u.username}</TableCell>
                      <TableCell>{typeof u === 'string' ? 'Loading...' : u.earnerName}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{typeof u === 'string' ? 'Loading...' : u.earnerId}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenModal(false)} color="inherit" sx={{ mr: 1, fontWeight: 600 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default function LiveListView() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [liveAppsData, setLiveAppsData] = useState([]);
  const [filteredApps, setFilteredApps] = useState([]);

  const [activeTab, setActiveTab] = useState(0);
  const [pendingAppsData, setPendingAppsData] = useState([]);
  const [filteredPendingApps, setFilteredPendingApps] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [pendingPage, setPendingPage] = useState(0);
  const [pendingRowsPerPage, setPendingRowsPerPage] = useState(10);

  
  // Pagination
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
      
      // Collect all earner_ids from all review_submit_data across all apps
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
         }
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

      // Chunk profile fetches to prevent URL size limits
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
    setPage(0); // Reset to first page on filter change
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
      textToCopy += `${u.username.toUpperCase()}\n`;
    });

    textToCopy += `\nTOTAL LIVE : ${app.users.length}`;

    navigator.clipboard.writeText(textToCopy);
    setSnack({ open: true, message: 'Live list copied to clipboard!', severity: 'success' });
  };

  if (loading) {
    return <Box sx={{ p: 5, textAlign: 'center' }}><CircularProgress /></Box>;
  }

  // Calculate pagination data
  const paginatedApps = filteredApps.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);


  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', mt: 1, pb: 10 }}>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Live List" sx={{ fontWeight: 700, textTransform: 'none', fontSize: '1rem' }} />
          <Tab label="Live Pending List" sx={{ fontWeight: 700, textTransform: 'none', fontSize: '1rem' }} />
        </Tabs>
      </Box>

      {/* Card 1: Advanced Filtering */}

      <Paper elevation={0} sx={{ p: 3, borderRadius: '24px', mb: 4, border: theme.palette.mode === 'light' ? `1px solid ${theme.palette.divider}` : 'none' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterAltIcon color="primary" /> Advanced Filtering
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              label="Search Apps, Task IDs, or Usernames"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="Filter by App Date"
              InputLabelProps={{ shrink: true }}
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            />
          </Grid>
        </Grid>
      </Paper>

      
      {activeTab === 0 && (
        <Paper elevation={0} sx={{ borderRadius: '24px', border: theme.palette.mode === 'light' ? `1px solid ${theme.palette.divider}` : 'none', overflow: 'hidden' }}>
        <Box sx={{ p: 3, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Apps with Live Members ({filteredApps.length})
          </Typography>
        </Box>

        {filteredApps.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>
            No live lists found matching your filters.
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead sx={{ bgcolor: theme.palette.mode === 'light' ? '#f8f9fa' : 'rgba(255,255,255,0.05)' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Task ID</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>App Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Client / Provider</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>App Date</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Live Users</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedApps.map(app => (
                    <AppRow key={app.appId} app={app} handleCopyList={handleCopyList} theme={theme} />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={filteredApps.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              sx={{ borderTop: `1px solid ${theme.palette.divider}` }}
            />
          </>
        )}
      </Paper>
      )}

      {activeTab === 1 && (
        <Paper elevation={0} sx={{ borderRadius: '24px', border: theme.palette.mode === 'light' ? `1px solid ${theme.palette.divider}` : 'none', overflow: 'hidden' }}>
          <Box sx={{ p: 3, borderBottom: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Pending Apps ({filteredPendingApps.length})
            </Typography>
          </Box>

          {loadingPending ? (
            <Box sx={{ p: 5, textAlign: 'center' }}><CircularProgress /></Box>
          ) : filteredPendingApps.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>
              No pending apps found.
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead sx={{ bgcolor: theme.palette.mode === 'light' ? '#f8f9fa' : 'rgba(255,255,255,0.05)' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Task ID</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>App Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>App Date</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Live Check Date</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>Pending Users</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>Total Users</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredPendingApps.slice(pendingPage * pendingRowsPerPage, pendingPage * pendingRowsPerPage + pendingRowsPerPage).map(app => (
                      <PendingAppRow key={app.taskId} app={app} theme={theme} />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              
              <TablePagination
                rowsPerPageOptions={[5, 10, 25, 50]}
                component="div"
                count={filteredPendingApps.length}
                rowsPerPage={pendingRowsPerPage}
                page={pendingPage}
                onPageChange={(e, newPage) => setPendingPage(newPage)}
                onRowsPerPageChange={(e) => { setPendingRowsPerPage(parseInt(e.target.value, 10)); setPendingPage(0); }}
                sx={{ borderTop: `1px solid ${theme.palette.divider}` }}
              />
            </>
          )}
        </Paper>
      )}

      <Snackbar 
        open={snack.open} 
        autoHideDuration={4000} 
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} sx={{ width: '100%', borderRadius: '12px' }}>
          {snack.message}
        </Alert>
      </Snackbar>

    </Box>
  );
}
