import { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, TextField, Button, Grid, 
  CircularProgress, Snackbar, Alert, useTheme,
  Chip, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Collapse
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { supabase } from '../supabaseClient';

function AppRow({ app, handleCopyList, theme }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow 
        hover 
        sx={{ 
          '& > *': { borderBottom: 'unset' }, 
          bgcolor: open ? (theme.palette.mode === 'light' ? '#f4f6f8' : 'rgba(255,255,255,0.05)') : 'inherit' 
        }}
      >
        <TableCell>
          <IconButton size="small" onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ fontWeight: 600, color: 'primary.main' }}>Task #{app.taskId}</TableCell>
        <TableCell sx={{ fontWeight: 600 }}>{app.appName}</TableCell>
        <TableCell>{app.appDate ? new Date(app.appDate).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }) : 'N/A'}</TableCell>
        <TableCell align="center">
          <Chip label={app.users.length} size="small" color="primary" sx={{ fontWeight: 700 }} />
        </TableCell>
        <TableCell align="right">
          <Tooltip title="Copy Live List">
            <IconButton onClick={(e) => handleCopyList(e, app)} color="primary" sx={{ bgcolor: 'primary.main' + '1A' }}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0, borderBottom: open ? undefined : 'none' }} colSpan={6}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ m: 2, p: 2, bgcolor: theme.palette.mode === 'light' ? '#fff' : 'background.default', borderRadius: '12px', border: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 2, textTransform: 'uppercase', color: 'text.secondary' }}>
                Listed Usernames ({app.users.length})
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {app.users.map((username, idx) => (
                  <Chip 
                    key={idx} 
                    label={username} 
                    size="small" 
                    variant="outlined"
                    sx={{ 
                      fontWeight: 600, 
                      borderRadius: '8px',
                      textTransform: 'uppercase',
                      bgcolor: theme.palette.mode === 'light' ? '#f8f9fa' : 'transparent'
                    }} 
                  />
                ))}
              </Box>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function LiveListView() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [appsData, setAppsData] = useState([]);
  const [filteredApps, setFilteredApps] = useState([]);
  
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

  const fetchLiveLists = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('review_submit_data')
        .select(`
          id, 
          submitted_username, 
          app_id, 
          apps ( task_id, app_name, app_date, task_type )
        `)
        .eq('status', 'Live')
        .order('submitted_at', { ascending: true });

      if (error) throw error;

      const grouped = {};
      data.forEach(row => {
        if (!row.apps) return;
        const appId = row.app_id;
        if (!grouped[appId]) {
          grouped[appId] = {
            appId: appId,
            taskId: row.apps.task_id,
            appName: row.apps.app_name,
            appDate: row.apps.app_date,
            taskType: row.apps.task_type,
            users: []
          };
        }
        grouped[appId].users.push(row.submitted_username);
      });

      const appsArray = Object.values(grouped).sort((a, b) => b.taskId - a.taskId);
      setAppsData(appsArray);
      setFilteredApps(appsArray);
    } catch (err) {
      console.error(err);
      setSnack({ open: true, message: 'Failed to fetch live lists.', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let result = appsData;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(app => 
        app.taskId.toString().includes(q) || 
        app.appName.toLowerCase().includes(q) ||
        app.users.some(u => u.toLowerCase().includes(q))
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
  }, [searchQuery, dateFilter, appsData]);

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
      textToCopy += `${u.toUpperCase()}\n`;
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
      
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 600 }}>
          All Live Lists
        </Typography>
        <Typography variant="body2" color="text.secondary">
          View and copy live member details for all tasks.
        </Typography>
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

      {/* Card 2: App List */}
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
                    <TableCell width="50"></TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Task ID</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>App Name</TableCell>
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
