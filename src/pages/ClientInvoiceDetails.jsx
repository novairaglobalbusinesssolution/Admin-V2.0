import { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Button, CircularProgress, Chip, useTheme,
  TextField, TablePagination, InputAdornment
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function ClientInvoiceDetails() {
  const { clientId } = useParams();
  const theme = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState(null);
  const [invoices, setInvoices] = useState([]);

  // Filter and Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    fetchClientAndInvoices();
  }, [clientId]);

  const fetchClientAndInvoices = async () => {
    try {
      const { data: clientData, error: clientErr } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();
      if (clientErr) throw clientErr;
      setClient(clientData);

      const { data: invData, error: invErr } = await supabase
        .from('invoices')
        .select('*')
        .eq('client_id', clientData.client_id)
        .order('created_at', { ascending: false });
      if (invErr && invErr.code !== '42P01') throw invErr; 
      
      setInvoices(invData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (event, newPage) => setPage(newPage);
  
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const filteredInvoices = invoices.filter(inv => {
    const q = searchQuery.toLowerCase();
    return (
      inv.invoice_id.toLowerCase().includes(q) ||
      (inv.description && inv.description.toLowerCase().includes(q)) ||
      (inv.status || 'Pending').toLowerCase().includes(q)
    );
  });

  const paginatedInvoices = filteredInvoices.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const surfaceContainerLow = theme.palette.mode === 'light' ? '#F7F2FA' : '#1D1B20';
  const surfaceContainerHigh = theme.palette.mode === 'light' ? '#ECE6F0' : '#2B2930';

  if (loading) return <Box sx={{ p: 5, textAlign: 'center' }}><CircularProgress /></Box>;
  if (!client) return <Box sx={{ p: 5, textAlign: 'center' }}><Typography>Client not found.</Typography></Box>;

  return (
    <Box sx={{ p: { xs: 1, md: 3 }, pb: 10, maxWidth: 1200, mx: 'auto' }}>
      <Button 
        startIcon={<ArrowBackIcon />} 
        onClick={() => navigate('/payments/clients/invoices')}
        sx={{ mb: 2, borderRadius: '100px' }}
      >
        Back to Clients
      </Button>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>{client.name}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{client.client_id} | {client.email}</Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate(`/payments/clients/invoices/${clientId}/create`)}
          sx={{ borderRadius: '100px', fontWeight: 600, py: 1, px: 3, boxShadow: 'none' }}
        >
          Create New Invoice
        </Button>
      </Box>

      {/* Search Bar */}
      <TextField
        fullWidth
        size="small"
        placeholder="Search invoices by ID, description, or status..."
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setPage(0);
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
                <TableCell sx={{ fontWeight: 700 }}>Invoice ID</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Amount</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Due Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>No invoices found.</TableCell>
                </TableRow>
              ) : (
                paginatedInvoices.map((inv) => (
                  <TableRow key={inv.id} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{inv.invoice_id}</TableCell>
                    <TableCell>{inv.description || 'N/A'}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>₹{parseFloat(inv.amount).toFixed(2)}</TableCell>
                    <TableCell>{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={inv.status} 
                        size="small" 
                        color={(inv.status || 'Pending').toLowerCase() === 'paid' ? 'success' : (inv.status || 'Pending').toLowerCase() === 'pending' ? 'warning' : 'error'} 
                        sx={{ fontWeight: 700, borderRadius: '8px' }} 
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => navigate(`/payments/clients/invoices/view/${inv.id}`)}
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
          count={filteredInvoices.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          sx={{ borderTop: `1px solid ${theme.palette.divider}` }}
        />
      </Paper>
    </Box>
  );
}
