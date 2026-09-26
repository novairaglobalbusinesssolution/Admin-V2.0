import { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, TextField, Button, Avatar, 
  CircularProgress, Snackbar, Alert, useTheme,
  IconButton, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination,
  Tabs, Tab, Divider, List, ListItem, ListItemText, Chip, Slide, Fade
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddCardIcon from '@mui/icons-material/AddCard';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import HistoryIcon from '@mui/icons-material/History';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CloseIcon from '@mui/icons-material/Close';
import { supabase } from '../supabaseClient';

export default function IndividualWallet() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Right Panel State
  const [selectedUser, setSelectedUser] = useState(null);
  const [panelMode, setPanelMode] = useState('manage'); // 'manage' or 'history'
  
  const [trxType, setTrxType] = useState('Credit');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [processing, setProcessing] = useState(false);

  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    fetchWallets();
  }, []);

  const fetchWallets = async () => {
    setLoading(true);
    try {
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('id, earner_id, first_name, last_name, phone, status');
      if (profErr) throw profErr;

      // Fetch ALL details for transactions so we can show history
      const { data: txns, error: txnErr } = await supabase
        .from('individual_wallet_transactions')
        .select('*')
        .order('created_at', { ascending: false });
      if (txnErr) throw txnErr;

      setAllTransactions(txns);

      // Group balances (Status Aware)
      const balances = {};
      txns.forEach(t => {
        if (!balances[t.earner_id]) balances[t.earner_id] = 0;
        const val = parseFloat(t.amount);
        const st = (t.status || 'Completed').toLowerCase();
        
        if (st === 'cancelled' || st === 'rejected') return;

        if (t.transaction_type === 'Credit' && st === 'completed') {
           balances[t.earner_id] += val;
        } else if (t.transaction_type === 'Debit') {
           // pending debits lock funds, so we deduct them from available balance
           balances[t.earner_id] -= val;
        }
      });

      // Merge data
      const processedUsers = profiles.map(p => ({
        ...p,
        fullName: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown User',
        balance: balances[p.earner_id] || 0
      })).sort((a, b) => b.balance - a.balance); // Sort by highest balance

      setUsers(processedUsers);
      
      // Auto-select the first user by default on page load
      if (processedUsers.length > 0) {
        setSelectedUser(processedUsers[0]);
        setPanelMode('manage');
      }

    } catch (err) {
      console.error(err);
      setSnack({ open: true, message: 'Failed to load wallet data.', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPanel = (user, mode = 'manage') => {
    setSelectedUser(user);
    setPanelMode(mode);
    setTrxType('Credit');
    setAmount('');
    setDescription('');
  };

  const handleClosePanel = () => {
    setSelectedUser(null);
  };

  const handleProcessTransaction = async () => {
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      setSnack({ open: true, message: 'Please enter a valid amount.', severity: 'warning' });
      return;
    }

    setProcessing(true);
    try {
      const generateTrxId = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 16; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };

      const payload = {
        transaction_id: generateTrxId(),
        earner_id: selectedUser.earner_id,
        amount: parseFloat(amount),
        transaction_type: trxType,
        description: description || `Manual ${trxType} by Admin`,
        status: 'Completed',
        created_at: new Date().toISOString()
      };

      const { error } = await supabase.from('individual_wallet_transactions').insert([payload]);
        if (error) throw error;

        // Send Push Notification
        try {
          const baseUrl = import.meta.env.DEV ? 'http://localhost:5000' : 'https://admin-v2-backend.onrender.com';
          await fetch(`${baseUrl}/api/send-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              earner_id: selectedUser.earner_id,
              title: trxType === 'Credit' ? 'Wallet Credited' : 'Wallet Debited',
              body: trxType === 'Credit' 
                  ? `Your wallet has been credited with Rs. ${payload.amount}. Reason: ${payload.description}`
                  : `Your wallet has been debited by Rs. ${payload.amount}. Reason: ${payload.description}`,
              type: 'wallet'
            })
          }).catch(e => console.warn(e));
        } catch (notifErr) {
          console.warn("Failed to send push notification:", notifErr);
        }

      // Update local state to reflect new balance instantly
      setUsers(users.map(u => {
        if (u.earner_id === selectedUser.earner_id) {
          return {
            ...u,
            balance: trxType === 'Credit' ? u.balance + payload.amount : u.balance - payload.amount
          };
        }
        return u;
      }));

      // Update local transactions array to include the new transaction
      setAllTransactions([payload, ...allTransactions]);

      setSnack({ open: true, message: `Transaction Successful!`, severity: 'success' });
      
      // Select updated user and switch to history to show the new transaction
      setSelectedUser({
        ...selectedUser,
        balance: trxType === 'Credit' ? selectedUser.balance + payload.amount : selectedUser.balance - payload.amount
      });
      setPanelMode('history');
      
    } catch (err) {
      console.error(err);
      setSnack({ open: true, message: 'Transaction Failed: ' + err.message, severity: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Pagination Handlers
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const filteredUsers = users.filter(u => 
    u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.earner_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.phone && u.phone.includes(searchQuery))
  );

  const paginatedUsers = filteredUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const totalPlatformLiability = users.reduce((acc, curr) => acc + (curr.balance > 0 ? curr.balance : 0), 0);

  if (loading) {
    return <Box sx={{ p: 5, textAlign: 'center' }}><CircularProgress /></Box>;
  }

  // Material 3 Surface Colors
  const surfaceContainerLow = theme.palette.mode === 'light' ? '#F7F2FA' : '#1D1B20';
  const surfaceContainer = theme.palette.mode === 'light' ? '#F3EDF7' : '#211F26';
  const surfaceContainerHigh = theme.palette.mode === 'light' ? '#ECE6F0' : '#2B2930';

  return (
    <Box sx={{ p: { xs: 1, md: 3 }, pb: 10, maxWidth: 1400, mx: 'auto' }}>
      
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 600 }}>
          Individual Wallets
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
          Manage and monitor all individual earner balances.
        </Typography>
      </Box>

      {/* Main Layout Container */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, position: 'relative' }}>
        
        {/* LEFT COLUMN: Data Table */}
        <Box sx={{ flexGrow: 1, transition: 'width 0.3s ease-in-out', overflow: 'hidden', width: selectedUser ? 'calc(100% - 400px)' : '100%' }}>
          
          {/* Summary Card */}
          <Paper 
            elevation={0} 
            sx={{ 
              p: 2, 
              borderRadius: '20px', 
              bgcolor: theme.palette.mode === 'light' ? '#D3E3FD' : '#0842A0',
              color: theme.palette.mode === 'light' ? '#041E49' : '#D3E3FD',
              mb: 3 
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ p: 1, borderRadius: '12px', bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(255,255,255,0.1)' }}>
                <AccountBalanceWalletIcon color="primary" fontSize="small" />
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, opacity: 0.8, textTransform: 'uppercase', fontSize: '0.65rem' }}>
                  Total Users Liability
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  Rs. {totalPlatformLiability.toFixed(2)}
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* Search Bar */}
          <TextField
            fullWidth
            size="small"
            placeholder="Search by name, earner ID, or phone..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1, fontSize: '1.2rem' }} />,
            }}
            sx={{ 
              mb: 3,
              '& .MuiOutlinedInput-root': { 
                borderRadius: '100px',
                bgcolor: surfaceContainerHigh,
                fontSize: '0.85rem',
                '& fieldset': { border: 'none' },
                '&:hover fieldset': { border: 'none' },
                '&.Mui-focused fieldset': { border: 'none' },
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              } 
            }}
          />

          {/* Data Table */}
          <Paper elevation={0} sx={{ borderRadius: '20px', overflow: 'hidden', bgcolor: 'background.paper', border: `1px solid ${theme.palette.divider}` }}>
            <TableContainer>
              <Table size="small" sx={{ minWidth: 600 }}>
                <TableHead sx={{ bgcolor: surfaceContainerLow }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, py: 1.5, fontSize: '0.75rem' }}>User</TableCell>
                    <TableCell sx={{ fontWeight: 700, py: 1.5, fontSize: '0.75rem' }}>Earner ID</TableCell>
                    <TableCell sx={{ fontWeight: 700, py: 1.5, fontSize: '0.75rem', textAlign: 'right' }}>Balance</TableCell>
                    <TableCell sx={{ fontWeight: 700, py: 1.5, fontSize: '0.75rem', textAlign: 'center' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} sx={{ textAlign: 'center', py: 4, color: 'text.secondary', fontSize: '0.85rem' }}>
                        No users found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedUsers.map((user) => (
                      <TableRow 
                        key={user.id} 
                        hover
                        selected={selectedUser?.earner_id === user.earner_id}
                        sx={{ 
                          cursor: 'pointer', 
                          '&:last-child td, &:last-child th': { border: 0 },
                          ...(selectedUser?.earner_id === user.earner_id && {
                            bgcolor: theme.palette.mode === 'light' ? 'primary.50' : 'rgba(255,255,255,0.08)'
                          })
                        }}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
                            <Avatar sx={{ width: 32, height: 32, bgcolor: theme.palette.primary.main, color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>
                              {user.fullName.charAt(0).toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>{user.fullName}</Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>{user.phone || 'N/A'}</Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'text.secondary', fontWeight: 600 }}>{user.earner_id}</TableCell>
                        <TableCell sx={{ textAlign: 'right', fontWeight: 800, fontSize: '0.9rem', color: user.balance > 0 ? theme.palette.success.main : (user.balance < 0 ? theme.palette.error.main : 'text.primary') }}>
                          Rs. {user.balance.toFixed(2)}
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                            <IconButton 
                              size="small" 
                              sx={{ bgcolor: surfaceContainerHigh, borderRadius: '10px', p: 0.8 }} 
                              onClick={(e) => { e.stopPropagation(); handleOpenPanel(user, 'manage'); }}
                            >
                              <AddCardIcon sx={{ fontSize: '1.2rem' }} color="primary" />
                            </IconButton>
                            <IconButton 
                              size="small" 
                              sx={{ bgcolor: surfaceContainerHigh, borderRadius: '10px', p: 0.8 }} 
                              onClick={(e) => { e.stopPropagation(); handleOpenPanel(user, 'history'); }}
                            >
                              <HistoryIcon sx={{ fontSize: '1.2rem' }} color="secondary" />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={filteredUsers.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[10, 25, 50]}
              sx={{ borderTop: `1px solid ${theme.palette.divider}` }}
            />
          </Paper>
        </Box>

        {/* RIGHT COLUMN: Razorpay Style Action Panel */}
        <Slide direction="left" in={!!selectedUser} mountOnEnter unmountOnExit timeout={300}>
          <Box sx={{ width: { xs: '100%', md: 400 }, flexShrink: 0, position: 'sticky', top: 16 }}>
            {selectedUser && (
              <Paper 
                elevation={6} 
                sx={{ 
                  borderRadius: '24px', 
                  bgcolor: 'background.paper', 
                  border: `1px solid ${theme.palette.divider}`,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  height: 'calc(100vh - 100px)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.08)'
                }}
              >
                {/* Panel Header */}
                <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: `1px solid ${theme.palette.divider}`, bgcolor: theme.palette.mode === 'light' ? '#fafafa' : '#1e1e1e' }}>
                  <Avatar sx={{ width: 44, height: 44, bgcolor: theme.palette.primary.main, color: '#fff', fontWeight: 800 }}>
                    {selectedUser.fullName.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.1 }}>{selectedUser.fullName}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{selectedUser.earner_id}</Typography>
                  </Box>
                  <IconButton onClick={handleClosePanel} size="small" sx={{ bgcolor: surfaceContainerLow, p: 0.8 }}>
                    <CloseIcon sx={{ fontSize: '1.2rem' }} />
                  </IconButton>
                </Box>

                <Box sx={{ px: 2, pt: 2, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, fontSize: '0.7rem', letterSpacing: 0.5 }}>CURRENT BALANCE</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 900, color: selectedUser.balance > 0 ? theme.palette.success.main : 'text.primary' }}>
                    Rs. {selectedUser.balance.toFixed(2)}
                  </Typography>
                </Box>

                <Tabs 
                  value={panelMode} 
                  onChange={(e, v) => setPanelMode(v)} 
                  variant="fullWidth"
                  sx={{ minHeight: '44px', borderBottom: `1px solid ${theme.palette.divider}`, '& .MuiTab-root': { minHeight: '44px', textTransform: 'none', fontWeight: 700, fontSize: '0.85rem' } }}
                >
                  <Tab label="Manage Funds" value="manage" />
                  <Tab label="History" value="history" />
                </Tabs>

                {/* Panel Content Area */}
                <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2, bgcolor: surfaceContainerLow }}>
                  
                  {panelMode === 'manage' && (
                    <Box sx={{ p: 1 }}>
                      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                        <Button
                          fullWidth
                          variant={trxType === 'Credit' ? 'contained' : 'outlined'}
                          color="success"
                          startIcon={<ArrowUpwardIcon sx={{ fontSize: '1rem' }} />}
                          onClick={() => setTrxType('Credit')}
                          sx={{ borderRadius: '16px', py: 1.2, fontWeight: 800, fontSize: '0.8rem', borderWidth: trxType === 'Credit' ? 0 : 2, '&:hover': { borderWidth: trxType === 'Credit' ? 0 : 2 } }}
                        >
                          Credit
                        </Button>
                        <Button
                          fullWidth
                          variant={trxType === 'Debit' ? 'contained' : 'outlined'}
                          color="error"
                          startIcon={<ArrowDownwardIcon sx={{ fontSize: '1rem' }} />}
                          onClick={() => setTrxType('Debit')}
                          sx={{ borderRadius: '16px', py: 1.2, fontWeight: 800, fontSize: '0.8rem', borderWidth: trxType === 'Debit' ? 0 : 2, '&:hover': { borderWidth: trxType === 'Debit' ? 0 : 2 } }}
                        >
                          Debit
                        </Button>
                      </Box>

                      <TextField
                        fullWidth
                        label="Amount (Rs. )"
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        sx={{ mb: 2.5, '& .MuiOutlinedInput-root': { borderRadius: '16px', bgcolor: 'background.paper', fontSize: '0.9rem' } }}
                      />

                      <TextField
                        fullWidth
                        label="Description / Reason"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="e.g. Bonus, Adjustment, Fine"
                        multiline
                        rows={3}
                        sx={{ mb: 4, '& .MuiOutlinedInput-root': { borderRadius: '16px', bgcolor: 'background.paper', fontSize: '0.9rem' } }}
                      />

                      <Button 
                        fullWidth
                        onClick={handleProcessTransaction}
                        variant="contained"
                        disabled={processing}
                        sx={{ borderRadius: '100px', py: 1.5, fontWeight: 800, fontSize: '0.9rem', boxShadow: '0 4px 14px rgba(13Rs. 10,253,0.4)' }}
                      >
                        {processing ? 'Processing...' : 'Confirm Transaction'}
                      </Button>
                    </Box>
                  )}

                  {panelMode === 'history' && (
                    <List disablePadding>
                      {allTransactions.filter(t => t.earner_id === selectedUser.earner_id).length === 0 ? (
                        <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 5, fontWeight: 600 }}>No transactions yet.</Typography>
                      ) : (
                        allTransactions
                          .filter(t => t.earner_id === selectedUser.earner_id)
                          .map((txn, index) => (
                          <Paper elevation={0} key={txn.transaction_id} sx={{ p: 2, mb: 1.5, borderRadius: '16px', border: `1px solid ${theme.palette.divider}` }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: txn.transaction_type === 'Credit' ? theme.palette.success.main : theme.palette.error.main }} />
                                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>
                                  {new Date(txn.created_at).toLocaleDateString()}
                                </Typography>
                              </Box>
                              <Typography variant="body1" sx={{ fontWeight: 900, color: txn.transaction_type === 'Credit' ? theme.palette.success.main : theme.palette.error.main }}>
                                {txn.transaction_type === 'Credit' ? '+' : '-'}Rs. {parseFloat(txn.amount).toFixed(2)}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', lineHeight: 1.4, flex: 1, mr: 1 }}>
                                {txn.description}
                              </Typography>
                              <Chip 
                                label={txn.status || 'Completed'} 
                                size="small" 
                                color={!txn.status || txn.status.toLowerCase() === 'completed' ? 'success' : (txn.status.toLowerCase() === 'pending' || txn.status.toLowerCase() === 'processed' ? 'warning' : 'error')} 
                                sx={{ height: 20, fontSize: '0.65rem', fontWeight: 800 }} 
                              />
                            </Box>
                            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5, fontFamily: 'monospace' }}>
                              ID: {txn.transaction_id}
                            </Typography>
                          </Paper>
                        ))
                      )}
                    </List>
                  )}
                </Box>
              </Paper>
            )}
          </Box>
        </Slide>
      </Box>

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
