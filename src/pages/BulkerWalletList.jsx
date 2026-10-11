import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TablePagination,
  TextField, InputAdornment, Button, IconButton, Chip, Avatar,
  Stack, MenuItem, CircularProgress, Tooltip, useTheme, Alert
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import GroupIcon from '@mui/icons-material/Group';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import { supabase } from '../supabaseClient';

export default function BulkerWalletList() {
  const theme = useTheme();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [bulkers, setBulkers] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch all bulkers
      const { data: bData, error: bErr } = await supabase
        .from('bulker_desks')
        .select('*')
        .order('full_name', { ascending: true });

      if (bErr) throw bErr;

      // 2. Fetch all bulker transactions from company_fund_transactions
      const { data: cData, error: cErr } = await supabase
        .from('company_fund_transactions')
        .select('*')
        .eq('party_type', 'bulker')
        .order('created_at', { ascending: false });

      let allTx = cData || [];

      // 3. Also check if dedicated bulker_wallet_transactions table exists
      try {
        const { data: bwData, error: bwErr } = await supabase
          .from('bulker_wallet_transactions')
          .select('*')
          .order('created_at', { ascending: false });

        if (!bwErr && bwData && bwData.length > 0) {
          const existingIds = new Set(allTx.map(t => t.transaction_id));
          bwData.forEach(t => {
            if (!existingIds.has(t.transaction_id)) {
              allTx.push({
                ...t,
                party_id: t.bulker_id,
                party_type: 'bulker'
              });
            }
          });
        }
      } catch (err) {
        // Table doesn't exist, ignore
      }

      setTransactions(allTx);

      // 4. Calculate wallet balances and stats per bulker
      const bulkerStats = {};
      allTx.forEach((tx) => {
        const bId = tx.party_id || tx.reference_id || tx.metadata?.bulker_id;
        if (!bId) return;

        if (!bulkerStats[bId]) {
          bulkerStats[bId] = { balance: 0, totalCredits: 0, totalDebits: 0, txCount: 0 };
        }

        const amt = parseFloat(tx.amount || 0);
        const status = (tx.status || 'Completed').toLowerCase();

        if (status === 'cancelled' || status === 'rejected' || status === 'failed') return;

        bulkerStats[bId].txCount += 1;

        if (tx.transaction_type === 'Credit') {
          bulkerStats[bId].balance += amt;
          bulkerStats[bId].totalCredits += amt;
        } else if (tx.transaction_type === 'Debit') {
          bulkerStats[bId].balance -= amt;
          bulkerStats[bId].totalDebits += amt;
        }
      });

      // 5. Merge with bulker records
      const mergedBulkers = (bData || []).map((b) => {
        const stats = bulkerStats[b.bulker_id] || { balance: 0, totalCredits: 0, totalDebits: 0, txCount: 0 };
        return {
          ...b,
          balance: stats.balance,
          totalCredits: stats.totalCredits,
          totalDebits: stats.totalDebits,
          txCount: stats.txCount
        };
      });

      setBulkers(mergedBulkers);
    } catch (err) {
      console.error('Error fetching bulker wallets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered bulkers
  const filteredBulkers = bulkers.filter((b) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      (b.full_name || '').toLowerCase().includes(q) ||
      (b.bulker_id || '').toLowerCase().includes(q) ||
      (b.phone || '').toLowerCase().includes(q) ||
      (b.email || '').toLowerCase().includes(q);

    const matchesAccountType =
      accountTypeFilter === 'ALL' ||
      (accountTypeFilter === 'WALLET' && (b.account_type === 'Wallet System' || !b.account_type)) ||
      (accountTypeFilter === 'MANUAL' && b.account_type === 'Manual');

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && (b.status === 'Active' || b.status === 'Verified')) ||
      (statusFilter === 'INACTIVE' && b.status !== 'Active' && b.status !== 'Verified');

    return matchesSearch && matchesAccountType && matchesStatus;
  });

  // Global calculations
  const totalBalance = bulkers.reduce((acc, b) => acc + (b.balance || 0), 0);
  const totalCredits = bulkers.reduce((acc, b) => acc + (b.totalCredits || 0), 0);
  const totalDebits = bulkers.reduce((acc, b) => acc + (b.totalDebits || 0), 0);

  const paginatedBulkers = filteredBulkers.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleViewBulker = (bulkerId) => {
    navigate(`/payments/bulkers/wallet/${encodeURIComponent(bulkerId)}`);
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', py: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 44, height: 44, borderRadius: '14px' }}>
              <AccountBalanceWalletIcon />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                Bulker Wallet System
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Centralized financial management, balances & transaction ledgers for Bulker Desks
              </Typography>
            </Box>
          </Box>
        </Box>

        <Button
          variant="outlined"
          color="primary"
          startIcon={<RefreshIcon />}
          onClick={fetchData}
          disabled={loading}
          sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
        >
          Refresh Data
        </Button>
      </Box>

      {/* Top CRM Summary Stat Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '20px',
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(15,23,42,0.6)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                  Total Bulkers
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5 }}>
                  {bulkers.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Active Desks
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'rgba(37,99,235,0.1)', color: '#2563eb', width: 48, height: 48, borderRadius: '16px' }}>
                <GroupIcon />
              </Avatar>
            </Stack>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '20px',
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(15,23,42,0.6)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                  Total Bulker Balance
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, color: '#16a34a' }}>
                  ₹{totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Circulating Wallets
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'rgba(22,163,74,0.1)', color: '#16a34a', width: 48, height: 48, borderRadius: '16px' }}>
                <AccountBalanceWalletIcon />
              </Avatar>
            </Stack>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '20px',
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(15,23,42,0.6)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                  Total Credited
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, color: '#2563eb' }}>
                  ₹{totalCredits.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  All-time commissions
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'rgba(37,99,235,0.1)', color: '#2563eb', width: 48, height: 48, borderRadius: '16px' }}>
                <ArrowUpwardIcon />
              </Avatar>
            </Stack>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '20px',
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(15,23,42,0.6)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                  Total Debited
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, color: '#f59e0b' }}>
                  ₹{totalDebits.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Payouts / Withdrawals
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: '#f59e0b', width: 48, height: 48, borderRadius: '16px' }}>
                <ArrowDownwardIcon />
              </Avatar>
            </Stack>
          </Card>
        </Grid>
      </Grid>

      {/* Main Table Card */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: '24px',
          border: `1px solid ${theme.palette.divider}`,
          overflow: 'hidden',
          bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(15,23,42,0.6)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.03)'
        }}
      >
        {/* Table Filters Bar */}
        <Box sx={{ p: 2.5, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search bulker by name, ID, phone, email..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
            sx={{ flex: 1, minWidth: { xs: '100%', sm: 260 }, '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              )
            }}
          />

          <TextField
            select
            size="small"
            label="Account Type"
            value={accountTypeFilter}
            onChange={(e) => { setAccountTypeFilter(e.target.value); setPage(0); }}
            sx={{ minWidth: 160, '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
          >
            <MenuItem value="ALL">All Account Types</MenuItem>
            <MenuItem value="WALLET">Wallet System</MenuItem>
            <MenuItem value="MANUAL">Manual</MenuItem>
          </TextField>

          <TextField
            select
            size="small"
            label="Status"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            sx={{ minWidth: 140, '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
          >
            <MenuItem value="ALL">All Status</MenuItem>
            <MenuItem value="ACTIVE">Active</MenuItem>
            <MenuItem value="INACTIVE">Inactive</MenuItem>
          </TextField>
        </Box>

        {/* Table */}
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.02)' : 'rgba(255,255,255,0.02)' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem', py: 1.8 }}>BULKER NAME</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem' }}>BULKER ID</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem' }}>ACCOUNT TYPE</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem' }}>CONTACT DETAILS</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem' }}>WALLET BALANCE</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem' }}>ALL-TIME CREDITS</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.8rem' }}>STATUS</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.8rem' }}>ACTION</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <CircularProgress size={36} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                      Loading bulker wallets...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : paginatedBulkers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      No Bulkers Found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Try adjusting your search query or filter options.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedBulkers.map((b) => (
                  <TableRow
                    key={b.id || b.bulker_id}
                    hover
                    sx={{
                      '&:last-child td': { border: 0 },
                      transition: 'background-color 0.2s ease'
                    }}
                  >
                    {/* Bulker Name */}
                    <TableCell sx={{ py: 1.8 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar
                          sx={{
                            width: 38,
                            height: 38,
                            bgcolor: 'primary.main',
                            fontWeight: 800,
                            fontSize: '0.9rem',
                            color: '#fff'
                          }}
                        >
                          {b.full_name ? b.full_name.charAt(0).toUpperCase() : 'B'}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 750, color: 'text.primary' }}>
                            {b.full_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {b.txCount || 0} transaction(s)
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    {/* Bulker ID */}
                    <TableCell>
                      <Chip
                        label={b.bulker_id}
                        size="small"
                        sx={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          borderRadius: '8px'
                        }}
                      />
                    </TableCell>

                    {/* Account Type */}
                    <TableCell>
                      <Chip
                        icon={<AccountBalanceWalletIcon sx={{ fontSize: '0.9rem !important' }} />}
                        label={b.account_type || 'Wallet System'}
                        size="small"
                        color={b.account_type === 'Manual' ? 'default' : 'primary'}
                        variant={b.account_type === 'Manual' ? 'outlined' : 'filled'}
                        sx={{ fontWeight: 700, fontSize: '0.75rem', borderRadius: '8px' }}
                      />
                    </TableCell>

                    {/* Contact Details */}
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                        {b.phone && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, fontSize: '0.78rem', color: 'text.secondary' }}>
                            <PhoneIcon sx={{ fontSize: 13 }} />
                            <span>{b.phone}</span>
                          </Box>
                        )}
                        {b.email && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, fontSize: '0.78rem', color: 'text.secondary' }}>
                            <EmailIcon sx={{ fontSize: 13 }} />
                            <span>{b.email}</span>
                          </Box>
                        )}
                      </Box>
                    </TableCell>

                    {/* Wallet Balance */}
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 800,
                          fontSize: '0.95rem',
                          color: (b.balance || 0) >= 0 ? '#16a34a' : 'error.main'
                        }}
                      >
                        ₹{(b.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    </TableCell>

                    {/* Total Credits */}
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                        ₹{(b.totalCredits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <Chip
                        label={b.status || 'Active'}
                        size="small"
                        color={b.status === 'Active' || b.status === 'Verified' ? 'success' : 'default'}
                        sx={{ fontWeight: 700, fontSize: '0.72rem', borderRadius: '8px' }}
                      />
                    </TableCell>

                    {/* Action */}
                    <TableCell align="center">
                      <Button
                        variant="contained"
                        size="small"
                        color="primary"
                        startIcon={<VisibilityIcon fontSize="small" />}
                        onClick={() => handleViewBulker(b.bulker_id)}
                        sx={{
                          borderRadius: '100px',
                          textTransform: 'none',
                          fontWeight: 750,
                          fontSize: '0.8rem',
                          px: 2,
                          boxShadow: 'none'
                        }}
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

        {/* Pagination */}
        <TablePagination
          component="div"
          count={filteredBulkers.length}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(e, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Paper>
    </Box>
  );
}
