import { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, List, ListItem, ListItemButton, 
  ListItemAvatar, Avatar, ListItemText, IconButton, Drawer, 
  Divider, Chip, useTheme, CircularProgress, TextField, 
  Button, Pagination, InputAdornment, Menu, MenuItem, Snackbar, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { supabase } from '../supabaseClient';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import NotificationsIcon from '@mui/icons-material/Notifications';
import DeleteIcon from '@mui/icons-material/Delete';
import FilterListIcon from '@mui/icons-material/FilterList';
import CommentIcon from '@mui/icons-material/Comment';
import GroupIcon from '@mui/icons-material/Group';
import { useNavigate } from 'react-router-dom';

export default function AppList() {
  const theme = useTheme();
  const navigate = useNavigate();
  
  // Data State
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const rowsPerPage = 10;
  const [filters, setFilters] = useState({ id: '', name: '', link: '', fromDate: '', toDate: '' });

  // Drawer State
  const [selectedApp, setSelectedApp] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [extendedDetails, setExtendedDetails] = useState({ sponsorName: 'Loading...', bulkers: [] });

  // Options Menu & Delete Dialog State
  const [anchorEl, setAnchorEl] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [appToDelete, setAppToDelete] = useState(null);
  
  // Snack
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    fetchApps();
  }, [page]); // Re-fetch when page changes

  const fetchApps = async () => {
    setLoading(true);
    try {
      let q = supabase.from('apps').select('*', { count: 'exact' });
      
      if (filters.id) q = q.eq('task_id', filters.id);
      if (filters.name) q = q.ilike('app_name', `%${filters.name}%`);
      if (filters.link) q = q.ilike('app_package', `%${filters.link}%`);
      if (filters.fromDate) q = q.gte('app_date', filters.fromDate);
      if (filters.toDate) q = q.lte('app_date', filters.toDate);
      
      const from = (page - 1) * rowsPerPage;
      const to = from + rowsPerPage - 1;
      
      q = q.range(from, to).order('created_at', { ascending: false });
      
      const { data, count, error } = await q;

      if (error) throw error;
      setApps(data || []);
      setTotalPages(Math.ceil((count || 0) / rowsPerPage));
    } catch (error) {
      console.error("Error fetching apps:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterApply = () => {
    setPage(1); // Reset to page 1
    fetchApps();
  };

  const handleOpenDetails = async (app) => {
    setSelectedApp(app);
    setDrawerOpen(true);
    setExtendedDetails({ sponsorName: 'Loading...', bulkers: [] });

    // Fetch Sponsor Name and Bulker Names concurrently
    try {
      const isClient = app.sponsor_type === 'Clients';
      const sponsorTable = isClient ? 'clients' : 'providers';
      const sponsorIdCol = isClient ? 'client_id' : 'provider_id';

      const pSponsor = supabase.from(sponsorTable).select('name').eq(sponsorIdCol, app.sponsor_id).single();
      
      const bulkerIds = (app.assigned_bulkers || []).map(b => b.bulker_id);
      const pBulkers = bulkerIds.length > 0 
        ? supabase.from('bulker_desks').select('bulker_id, full_name').in('bulker_id', bulkerIds)
        : Promise.resolve({ data: [] });

      const [sponsorRes, bulkersRes] = await Promise.all([pSponsor, pBulkers]);

      // Map bulker names to the assigned_bulkers array
      const bulkersData = (app.assigned_bulkers || []).map(b => {
        const match = (bulkersRes.data || []).find(bd => bd.bulker_id === b.bulker_id);
        return { ...b, full_name: match ? match.full_name : 'Unknown' };
      });

      setExtendedDetails({
        sponsorName: sponsorRes.data ? sponsorRes.data.name : 'Unknown Sponsor',
        bulkers: bulkersData
      });
    } catch (error) {
      setExtendedDetails({ sponsorName: 'Error Loading', bulkers: app.assigned_bulkers || [] });
    }
  };

  const handleCloseDetails = () => {
    setDrawerOpen(false);
    setTimeout(() => setSelectedApp(null), 300);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSnack({ open: true, message: 'Link Copied to Clipboard!', severity: 'success' });
  };

  const initiateDelete = (app) => {
    setAppToDelete(app);
    setDeleteDialogOpen(true);
    setAnchorEl(null);
  };

  const handleDeleteConfirm = async () => {
    if (!appToDelete) return;
    try {
      const { error } = await supabase.from('apps').delete().eq('id', appToDelete.id);
      if(error) throw error;
      setSnack({ open: true, message: 'App deleted successfully!', severity: 'success' });
      setDeleteDialogOpen(false);
      setAppToDelete(null);
      handleCloseDetails();
      fetchApps();
    } catch (e) {
      setSnack({ open: true, message: e.message, severity: 'error' });
    }
  };

  const getTaskImage = (type) => {
    switch(type) {
      case 'iOS App': return '/images/appstore.png';
      case 'YT Video': return '/images/youtube.png';
      case 'Registration': return '/images/web.png';
      default: return '/images/playstore.png';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', mt: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, gap: 2 }}>
        <Box sx={{ p: 1.5, borderRadius: '16px', bgcolor: 'primary.primaryContainer', color: 'primary.main' }}>
          <FormatListBulletedIcon />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 500 }}>Apps & Tasks List</Typography>
          <Typography variant="body2" color="text.secondary">Manage tasks, bulkers, and analytics.</Typography>
        </Box>
      </Box>

      {/* Filter Section */}
      <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: '24px', border: theme.palette.mode === 'light' ? `1px solid ${theme.palette.surfaceVariant.main}` : 'none' }}>
        <Typography variant="subtitle2" color="primary" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterListIcon fontSize="small" /> FILTER & SEARCH
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
          <TextField size="small" label="Task ID" value={filters.id} onChange={e => setFilters({...filters, id: e.target.value})} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
          <TextField size="small" label="App Name" value={filters.name} onChange={e => setFilters({...filters, name: e.target.value})} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
          <TextField size="small" label="Link / Package" value={filters.link} onChange={e => setFilters({...filters, link: e.target.value})} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
          <TextField size="small" label="From Date" type="date" InputLabelProps={{ shrink: true }} value={filters.fromDate} onChange={e => setFilters({...filters, fromDate: e.target.value})} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
          <TextField size="small" label="To Date" type="date" InputLabelProps={{ shrink: true }} value={filters.toDate} onChange={e => setFilters({...filters, toDate: e.target.value})} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
          
          <Button variant="contained" disableElevation onClick={handleFilterApply} sx={{ borderRadius: '12px', height: '100%' }}>
            Apply Filters
          </Button>
        </Box>
      </Paper>

      {/* List Section */}
      <Paper elevation={0} sx={{ borderRadius: '24px', border: theme.palette.mode === 'light' ? `1px solid ${theme.palette.surfaceVariant.main}` : 'none', overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
        ) : apps.length === 0 ? (
          <Box sx={{ p: 5, textAlign: 'center' }}><Typography color="text.secondary">No apps found matching filters.</Typography></Box>
        ) : (
          <>
            <List disablePadding>
              {apps.map((app, index) => (
                <Box key={app.id}>
                  <ListItemButton onClick={() => handleOpenDetails(app)} sx={{ py: 2, px: 3, '&:hover': { bgcolor: 'action.hover' } }}>
                    <ListItemAvatar sx={{ mr: 2 }}>
                      <Avatar src={getTaskImage(app.task_type)} sx={{ width: 52, height: 52, bgcolor: theme.palette.mode === 'light' ? '#f5f5f5' : '#1e1e1e', p: 0.8, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }} />
                    </ListItemAvatar>
                    
                    <ListItemText 
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                          <Typography variant="body1" sx={{ fontWeight: 600, fontFamily: '"Google Sans", sans-serif', color: 'text.primary' }}>{app.app_name}</Typography>
                          <Typography variant="caption" sx={{ color: theme.palette.mode === 'light' ? 'primary.main' : 'primary.light', bgcolor: theme.palette.mode === 'light' ? 'primary.primaryContainer' : 'rgba(168, 199, 250, 0.15)', px: 1, py: 0.2, borderRadius: '6px', fontWeight: 600 }}>ID: #{app.task_id}</Typography>
                        </Box>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip size="small" label={app.task_type || 'Unknown'} sx={{ height: 20, fontSize: '0.7rem', fontWeight: 500 }} />
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>• Added {formatDate(app.app_date)}</Typography>
                        </Box>
                      }
                    />
                    
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                      <IconButton 
                        edge="end" 
                        color="success" 
                        onClick={(e) => { e.stopPropagation(); navigate(`/app-reviews/${app.id}`); }} 
                        sx={{ bgcolor: theme.palette.mode === 'light' ? '#e8f5e9' : 'rgba(76, 175, 80, 0.1)' }}
                        title="Users View"
                      >
                        <GroupIcon />
                      </IconButton>
                      <IconButton 
                        edge="end" 
                        color="primary" 
                        onClick={(e) => { e.stopPropagation(); handleOpenDetails(app); }} 
                        sx={{ bgcolor: theme.palette.mode === 'light' ? '#f3f4f9' : '#2d2f33' }}
                        title="View Details"
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Box>
                  </ListItemButton>
                  {index < apps.length - 1 && <Divider sx={{ opacity: 0.5 }} />}
                </Box>
              ))}
            </List>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                <Pagination count={totalPages} page={page} onChange={(e, val) => setPage(val)} color="primary" />
              </Box>
            )}
          </>
        )}
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} PaperProps={{ sx: { borderRadius: '20px', minWidth: '320px' } }}>
        <DialogTitle sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 600 }}>Delete Task</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to permanently delete this task? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} color="inherit">Cancel</Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error" disableElevation>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Details Drawer */}
      <Drawer
        anchor="right" open={drawerOpen} onClose={handleCloseDetails}
        PaperProps={{ sx: { width: { xs: '100%', sm: 400, md: 450 }, bgcolor: 'background.default', borderTopLeftRadius: { sm: '24px' }, borderBottomLeftRadius: { sm: '24px' } } }}
      >
        {selectedApp && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', bgcolor: 'background.paper', borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Box>
                <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600, letterSpacing: 1 }}>TASK #{selectedApp.task_id}</Typography>
                <Typography variant="h6" sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 500, mt: 0.5, lineHeight: 1.2 }}>{selectedApp.app_name}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <Avatar src={getTaskImage(selectedApp.task_type)} sx={{ width: 24, height: 24, bgcolor: 'transparent' }} variant="rounded" />
                  <Chip size="small" label={selectedApp.task_type || 'Unknown'} sx={{ fontWeight: 500 }} />
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ bgcolor: 'action.hover' }}><MoreVertIcon /></IconButton>
                <IconButton onClick={handleCloseDetails} sx={{ bgcolor: 'action.hover' }}><CloseIcon /></IconButton>
              </Box>
            </Box>

            {/* Actions Menu */}
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)} PaperProps={{ sx: { borderRadius: '12px', minWidth: 200, mt: 1 } }}>
              <MenuItem onClick={() => { setAnchorEl(null); navigate(`/edit-app/${selectedApp.id}`); }}><EditIcon sx={{ mr: 1.5, color: 'text.secondary', fontSize: 20 }}/> Edit App</MenuItem>
              <MenuItem onClick={() => { setAnchorEl(null); setSnack({open:true, message:'Notification triggered!', severity:'success'}); }}><NotificationsIcon sx={{ mr: 1.5, color: 'text.secondary', fontSize: 20 }}/> Notify Users</MenuItem>
              <Divider />
              <MenuItem onClick={() => initiateDelete(selectedApp)} sx={{ color: 'error.main' }}><DeleteIcon sx={{ mr: 1.5, color: 'error.main', fontSize: 20 }}/> Delete App</MenuItem>
            </Menu>

            <Box sx={{ p: 3, flexGrow: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Task Details Card */}
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: '16px', border: `1px solid ${theme.palette.divider}` }}>
                <Typography variant="subtitle2" color="primary" sx={{ mb: 2, fontWeight: 600 }}>TASK DETAILS</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Link / Package / ID</Typography>
                    <TextField 
                      fullWidth size="small" value={selectedApp.app_package}
                      InputProps={{
                        readOnly: true,
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton onClick={(e) => { e.stopPropagation(); copyToClipboard(selectedApp.app_package); }} size="small"><ContentCopyIcon fontSize="small"/></IconButton>
                          </InputAdornment>
                        ),
                        sx: { cursor: 'pointer', '& input': { cursor: 'pointer', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, borderRadius: '8px' }
                      }}
                      onClick={() => {
                        if(selectedApp.app_package.startsWith('http')) window.open(selectedApp.app_package, '_blank');
                        else window.open(`https://play.google.com/store/apps/details?id=${selectedApp.app_package}`, '_blank');
                      }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 4 }}>
                    <Box><Typography variant="caption" color="text.secondary" display="block">Start Date</Typography><Typography variant="body2" sx={{ fontWeight: 500 }}>{formatDate(selectedApp.app_date)}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary" display="block">Checking Date</Typography><Typography variant="body2" sx={{ fontWeight: 500 }}>{formatDate(selectedApp.live_checking_date)}</Typography></Box>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">Status</Typography>
                    <Chip size="small" label={(selectedApp.status || 'Active').toUpperCase()} color="success" sx={{ mt: 0.5, fontWeight: 600, fontSize: '0.7rem' }} />
                  </Box>
                </Box>
              </Paper>

              {/* Pricing & Sponsor Card */}
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: '16px', border: `1px solid ${theme.palette.divider}` }}>
                <Typography variant="subtitle2" color="primary" sx={{ mb: 2, fontWeight: 600 }}>PRICING & SPONSOR</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Box sx={{ gridColumn: 'span 2' }}>
                    <Typography variant="caption" color="text.secondary" display="block">Sponsor Name & ID</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{extendedDetails.sponsorName}</Typography>
                    <Typography variant="caption" color="text.secondary">{selectedApp.sponsor_id} ({selectedApp.sponsor_type})</Typography>
                  </Box>
                  <Box><Typography variant="caption" color="text.secondary" display="block">Sponsor Amount</Typography><Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main' }}>₹ {selectedApp.sponsor_amount}</Typography></Box>
                  <Box><Typography variant="caption" color="text.secondary" display="block">Members Reward</Typography><Typography variant="body2" sx={{ fontWeight: 600, color: 'info.main' }}>₹ {selectedApp.members_reward}</Typography></Box>
                </Box>
              </Paper>

              {/* Bulkers Card */}
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: '16px', border: `1px solid ${theme.palette.divider}` }}>
                <Typography variant="subtitle2" color="primary" sx={{ mb: 2, fontWeight: 600 }}>ASSIGNED BULKERS</Typography>
                {extendedDetails.bulkers.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No bulkers assigned.</Typography>
                ) : (
                  <List disablePadding>
                    {extendedDetails.bulkers.map((bulker, i) => (
                      <ListItem key={i} disablePadding sx={{ py: 1, borderBottom: i !== extendedDetails.bulkers.length - 1 ? `1px dashed ${theme.palette.divider}` : 'none' }}>
                        <ListItemText 
                          primary={bulker.full_name} 
                          secondary={bulker.bulker_id}
                          primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>₹ {bulker.amount}</Typography>
                      </ListItem>
                    ))}
                  </List>
                )}
              </Paper>

              {/* Instructions Card */}
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: '16px', border: `1px solid ${theme.palette.divider}` }}>
                <Typography variant="subtitle2" color="primary" sx={{ mb: 1, fontWeight: 600 }}>INSTRUCTIONS</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary' }}>
                  {selectedApp.instructions || 'No instructions provided.'}
                </Typography>
              </Paper>
            </Box>
          </Box>
        )}
      </Drawer>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({...s, open: false}))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} variant="filled" sx={{ borderRadius: '12px' }}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}
