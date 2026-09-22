import { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Button, CircularProgress, Snackbar, useTheme,
  TextField, TablePagination, InputAdornment 
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SearchIcon from '@mui/icons-material/Search';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function ClientInvoicesList() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [snack, setSnack] = useState({ open: false, message: '' });

  // Filter and Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('status', 'Active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data);
    } catch (err) {
      setSnack({ open: true, message: 'Failed to fetch clients: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (event, newPage) => setPage(newPage);
  
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const filteredClients = clients.filter(client => {
    const q = searchQuery.toLowerCase();
    return (
      client.name.toLowerCase().includes(q) ||
      client.client_id.toLowerCase().includes(q) ||
      (client.email && client.email.toLowerCase().includes(q))
    );
  });

  const paginatedClients = filteredClients.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const surfaceContainerLow = theme.palette.mode === 'light' ? '#F7F2FA' : '#1D1B20';
  const surfaceContainerHigh = theme.palette.mode === 'light' ? '#ECE6F0' : '#2B2930';

  if (loading) return <Box sx={{ p: 5, textAlign: 'center' }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: { xs: 1, md: 3 }, pb: 10, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 700 }}>Active Clients</Typography>
      
      {/* Search Bar */}
      <TextField
        fullWidth
        size="small"
        placeholder="Search clients by name, ID, or email..."
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setPage(0); // Reset page on search
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: 'text.secondary', fontSize: '1.2rem' }} />
            </InputAdornment>
          ),
        }}
        sx={{ 
          mb: 3,
          '& .MuiOutlinedInput-root': { 
            borderRadius: '100px',
            bgcolor: surfaceContainerHigh,
            fontSize: '0.9rem',
            '& fieldset': { border: 'none' },
            '&:hover fieldset': { border: 'none' },
            '&.Mui-focused fieldset': { border: 'none' },
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          } 
        }}
      />

      <Paper elevation={0} sx={{ borderRadius: '20px', overflow: 'hidden', border: `1px solid ${theme.palette.divider}` }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: surfaceContainerLow }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Client Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Client ID</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>No active clients found.</TableCell>
                </TableRow>
              ) : (
                paginatedClients.map((client) => (
                  <TableRow key={client.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{client.name}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{client.client_id}</TableCell>
                    <TableCell>{client.email || 'N/A'}</TableCell>
                    <TableCell align="right">
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<VisibilityIcon fontSize="small" />}
                        onClick={() => navigate(`/payments/clients/invoices/${client.id}`)}
                        sx={{ borderRadius: '100px', boxShadow: 'none' }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[10, 25, 50]}
          component="div"
          count={filteredClients.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          sx={{ borderTop: `1px solid ${theme.palette.divider}` }}
        />
      </Paper>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack({ ...snack, open: false })}
        message={snack.message}
      />
    </Box>
  );
}
