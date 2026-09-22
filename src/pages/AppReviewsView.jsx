import { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, IconButton, Button, 
  useTheme, CircularProgress, Snackbar, Alert, Chip
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import GroupIcon from '@mui/icons-material/Group';

export default function AppReviewsView() {
  const { appId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();

  const [appDetails, setAppDetails] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    fetchData();
  }, [appId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch App Details
      const { data: appData, error: appError } = await supabase
        .from('apps')
        .select('id, task_id, app_name, app_date')
        .eq('id', appId)
        .single();
        
      if (appError) throw appError;
      setAppDetails(appData);

      // Fetch Reviews
      const { data: revData, error: revError } = await supabase
        .from('review_submit_data')
        .select('*')
        .eq('app_id', appId)
        .order('submitted_at', { ascending: false });

      if (revError) throw revError;
      setReviews(revData || []);

    } catch (e) {
      console.error(e);
      setSnack({ open: true, message: 'Failed to load data.', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyList = () => {
    if (!appDetails) return;

    // Formatting date as "23/04/2026" or similar if needed.
    // Assuming app_date is stored cleanly, if not we format it.
    let formattedDate = appDetails.app_date ? new Date(appDetails.app_date).toLocaleDateString('en-IN') : 'N/A';

    let textToCopy = `${appDetails.app_name}\n`;
    textToCopy += `APP ID : ${appDetails.task_id}\n`;
    textToCopy += `APP DATE: ${formattedDate}\n\n`;

    reviews.forEach(r => {
      textToCopy += `${r.submitted_username.toUpperCase()}\n`;
    });

    textToCopy += `\nTOTAL LIVE : ${reviews.length}`;

    navigator.clipboard.writeText(textToCopy);
    setSnack({ open: true, message: 'Copied to clipboard!', severity: 'success' });
  };

  if (loading) return <Box sx={{ p: 5, textAlign: 'center' }}><CircularProgress /></Box>;
  if (!appDetails) return <Box sx={{ p: 5, textAlign: 'center' }}>App not found.</Box>;

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 2, pb: 10, px: { xs: 1, md: 2 } }}>
      
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/app-list')} sx={{ bgcolor: 'action.hover', width: 52, height: 52 }}>
            <ArrowBackIcon fontSize="medium" />
          </IconButton>
          <Box sx={{ p: 1.5, borderRadius: '16px', bgcolor: 'success.main', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GroupIcon fontSize="medium" />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 600 }}>
              Submitted Reviews
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Task #{appDetails.task_id} • {appDetails.app_name}
            </Typography>
          </Box>
        </Box>

        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<ContentCopyIcon />} 
          onClick={handleCopyList}
          disableElevation
          sx={{ borderRadius: '12px', px: 3, py: 1.2, fontWeight: 600 }}
        >
          Copy List
        </Button>
      </Box>

      {/* Reviews Table */}
      <Paper elevation={0} sx={{ borderRadius: '24px', border: theme.palette.mode === 'light' ? `1px solid ${theme.palette.surfaceVariant.main}` : 'none', overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Submitted Username</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Earner ID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Bulker ID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Submitted At</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reviews.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    No reviews submitted for this app yet.
                  </TableCell>
                </TableRow>
              ) : (
                reviews.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>
                      {row.submitted_username.toUpperCase()}
                    </TableCell>
                    <TableCell>{row.earner_id}</TableCell>
                    <TableCell>{row.bulker_id}</TableCell>
                    <TableCell>
                      <Chip 
                        size="small" 
                        label={row.status} 
                        color={row.status === 'Approved' ? 'success' : row.status === 'Under Review' ? 'warning' : 'default'} 
                        sx={{ fontWeight: 500 }}
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(row.submitted_at).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit'
                      })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack({...snack, open: false})} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnack({...snack, open: false})} severity={snack.severity} sx={{ width: '100%', borderRadius: '12px' }}>
          {snack.message}
        </Alert>
      </Snackbar>

    </Box>
  );
}
