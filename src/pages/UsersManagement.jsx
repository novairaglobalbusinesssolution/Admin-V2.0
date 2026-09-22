import { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, CircularProgress,
  Avatar, Chip, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, useTheme, IconButton, TextField, Button, TablePagination, Skeleton, Stack
} from '@mui/material';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import GroupIcon from '@mui/icons-material/Group';
import StorefrontIcon from '@mui/icons-material/Storefront';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FilterListIcon from '@mui/icons-material/FilterList';

const tabs = [
  { id: 0, label: 'INDIVIDUALS', icon: <PersonIcon sx={{ fontSize: 18 }} />, table: 'profiles', typeParam: 'individual' },
  { id: 1, label: 'BULKERS', icon: <GroupIcon sx={{ fontSize: 18 }} />, table: 'bulker_desks', typeParam: 'bulker' },
  { id: 2, label: 'PROVIDERS', icon: <StorefrontIcon sx={{ fontSize: 18 }} />, table: 'providers', typeParam: 'provider' },
  { id: 3, label: 'CLIENTS', icon: <BusinessIcon sx={{ fontSize: 18 }} />, table: 'clients', typeParam: 'client' }
];

export default function UsersManagement() {
  const theme = useTheme();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState(0);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const rowsPerPage = 10;

  const [filters, setFilters] = useState({ search: '', fromDate: '', toDate: '' });

  useEffect(() => {
    // Reset page and filters when changing tabs
    setPage(1);
    setFilters({ search: '', fromDate: '', toDate: '' });
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [activeTab, page]);

  const fetchData = async () => {
    setLoading(true);
    setData([]);
    const tableName = tabs[activeTab].table;

    try {
      let q = supabase.from(tableName).select('*', { count: 'exact' });

      // Apply Dates Filter
      if (filters.fromDate) q = q.gte('created_at', filters.fromDate);
      if (filters.toDate) q = q.lte('created_at', filters.toDate);

      // Apply Search Filter (Dynamically check based on table)
      if (filters.search) {
        const s = `%${filters.search}%`;
        if (activeTab === 0) q = q.or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s},phone.ilike.${s},earner_id.ilike.${s}`); // Profiles
        else if (activeTab === 1) q = q.or(`full_name.ilike.${s},bulker_id.ilike.${s},phone.ilike.${s}`); // Bulkers
        else if (activeTab === 2) q = q.or(`name.ilike.${s},provider_id.ilike.${s}`); // Providers
        else if (activeTab === 3) q = q.or(`name.ilike.${s},client_id.ilike.${s}`); // Clients
      }

      // Pagination
      const from = (page - 1) * rowsPerPage;
      const to = from + rowsPerPage - 1;

      q = q.range(from, to).order('created_at', { ascending: false });

      const { data: result, count, error } = await q;
      
      if (error) throw error;
      
      let finalData = result || [];

      // Augment data with relational names if on INDIVIDUALS tab
      if (activeTab === 0 && finalData.length > 0) {
        // Fetch Bulkers (Format ID with prefix)
        const bulkerIds = [...new Set(finalData.map(r => r.bulker_id).filter(Boolean))];
        const formattedBulkerIds = bulkerIds.map(id => id.includes('NOVAIRA/BULKER/') ? id : `NOVAIRA/BULKER/${id}`);
        
        let bulkersMap = {};
        if (formattedBulkerIds.length > 0) {
          const { data: bulkers } = await supabase.from('bulker_desks').select('bulker_id, full_name').in('bulker_id', formattedBulkerIds);
          if (bulkers) bulkers.forEach(b => bulkersMap[b.bulker_id] = b.full_name);
        }

        // Fetch Referrers
        const refCodes = [...new Set(finalData.map(r => r.referral_code).filter(Boolean))];
        let refsMap = {};
        if (refCodes.length > 0) {
          const { data: refs } = await supabase.from('profiles').select('earner_id, first_name, last_name').in('earner_id', refCodes);
          if (refs) refs.forEach(r => refsMap[r.earner_id] = `${r.first_name} ${r.last_name || ''}`.trim());
        }

        finalData = finalData.map(row => {
          let bId = row.bulker_id;
          let fullBId = bId ? (bId.includes('NOVAIRA/BULKER/') ? bId : `NOVAIRA/BULKER/${bId}`) : null;
          
          return {
            ...row,
            bulkerName: fullBId ? (bulkersMap[fullBId] || 'Unknown Bulker') : null,
            referrerName: row.referral_code ? (refsMap[row.referral_code] || 'Unknown Referrer') : null
          };
        });
      }

      setData(finalData);
      setTotalPages(Math.ceil((count || 0) / rowsPerPage));
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterApply = () => {
    setPage(1);
    fetchData();
  };

  const renderTableHead = () => {
    switch (activeTab) {
      case 0:
        return (
          <TableRow>
            <TableCell sx={{ fontWeight: 600, py: 1.5 }}>Earner Info</TableCell>
            <TableCell sx={{ fontWeight: 600, py: 1.5 }}>Contact</TableCell>
            <TableCell sx={{ fontWeight: 600, py: 1.5 }}>Bulker / Ref</TableCell>
            <TableCell sx={{ fontWeight: 600, py: 1.5 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 600, py: 1.5 }}>Joined</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, py: 1.5 }}>Actions</TableCell>
          </TableRow>
        );
      case 1:
        return (
          <TableRow>
            <TableCell sx={{ fontWeight: 600, py: 1.5 }}>Bulker Info</TableCell>
            <TableCell sx={{ fontWeight: 600, py: 1.5 }}>Contact</TableCell>
            <TableCell sx={{ fontWeight: 600, py: 1.5 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 600, py: 1.5 }}>Joined</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, py: 1.5 }}>Actions</TableCell>
          </TableRow>
        );
      case 2:
      case 3:
        return (
          <TableRow>
            <TableCell sx={{ fontWeight: 600, py: 1.5 }}>ID</TableCell>
            <TableCell sx={{ fontWeight: 600, py: 1.5 }}>Name</TableCell>
            <TableCell sx={{ fontWeight: 600, py: 1.5 }}>Joined</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, py: 1.5 }}>Actions</TableCell>
          </TableRow>
        );
      default:
        return null;
    }
  };

  const renderTableRow = (row) => {
    switch (activeTab) {
      case 0:
        return (
          <TableRow key={row.id} hover>
            <TableCell sx={{ py: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar sx={{ bgcolor: 'primary.main', width: 34, height: 34, fontSize: '1rem' }}>
                  {(row.first_name || 'U')[0].toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.first_name} {row.last_name}</Typography>
                  <Typography variant="caption" color="text.secondary">ID: {row.earner_id}</Typography>
                </Box>
              </Box>
            </TableCell>
            <TableCell sx={{ py: 1.5 }}>
              <Typography variant="body2">{row.email || 'N/A'}</Typography>
              <Typography variant="caption" color="text.secondary">{row.phone || 'N/A'}</Typography>
            </TableCell>
            <TableCell sx={{ py: 1.5 }}>
              {row.bulker_id ? (
                <Box sx={{ mb: 0.5 }}>
                  <Typography variant="body2" color="primary.main" sx={{ fontWeight: 600, lineHeight: 1.2 }}>{row.bulkerName}</Typography>
                  <Typography variant="caption" color="text.secondary">ID: {row.bulker_id}</Typography>
                </Box>
              ) : (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>No Bulker</Typography>
              )}
              
              {row.referral_code ? (
                <Box>
                  <Typography variant="body2" color="secondary.main" sx={{ fontWeight: 600, lineHeight: 1.2 }}>{row.referrerName}</Typography>
                  <Typography variant="caption" color="text.secondary">Ref ID: {row.referral_code}</Typography>
                </Box>
              ) : (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>No Referral</Typography>
              )}
            </TableCell>
            <TableCell sx={{ py: 1.5 }}>
              <Chip size="small" label={row.status || 'Active'} color={row.status?.toLowerCase() === 'active' ? 'success' : 'default'} sx={{ height: 22, fontSize: '0.7rem' }} />
            </TableCell>
            <TableCell sx={{ py: 1.5 }}>
              <Typography variant="body2">{new Date(row.created_at).toLocaleDateString()}</Typography>
            </TableCell>
            <TableCell align="right" sx={{ py: 1.5 }}>
              <IconButton color="primary" size="small" onClick={() => navigate(`/user-view/individual/${row.id}`)}><VisibilityIcon fontSize="small" /></IconButton>
            </TableCell>
          </TableRow>
        );
      case 1:
        return (
          <TableRow key={row.id} hover>
            <TableCell sx={{ py: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar sx={{ bgcolor: 'secondary.main', width: 34, height: 34, fontSize: '1rem' }}>
                  {(row.full_name || 'B')[0].toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.full_name}</Typography>
                  <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600 }}>{row.bulker_id}</Typography>
                </Box>
              </Box>
            </TableCell>
            <TableCell sx={{ py: 1.5 }}>
              <Typography variant="body2">{row.phone}</Typography>
              <Typography variant="caption" color="text.secondary">{row.email}</Typography>
            </TableCell>
            <TableCell sx={{ py: 1.5 }}>
              <Chip size="small" label={row.status || 'Active'} color={row.status?.toLowerCase() === 'active' || row.status?.toLowerCase() === 'verified' ? 'success' : 'warning'} sx={{ height: 22, fontSize: '0.7rem' }} />
            </TableCell>
            <TableCell sx={{ py: 1.5 }}>
              <Typography variant="body2">{new Date(row.created_at).toLocaleDateString()}</Typography>
            </TableCell>
            <TableCell align="right" sx={{ py: 1.5 }}>
              <IconButton color="primary" size="small" onClick={() => navigate(`/user-view/bulker/${row.id}`)}><VisibilityIcon fontSize="small" /></IconButton>
            </TableCell>
          </TableRow>
        );
      case 2:
      case 3:
        const idCol = activeTab === 2 ? row.provider_id : row.client_id;
        const typeParam = activeTab === 2 ? 'provider' : 'client';
        return (
          <TableRow key={row.id} hover>
            <TableCell sx={{ py: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>{idCol}</Typography>
            </TableCell>
            <TableCell sx={{ py: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.name}</Typography>
            </TableCell>
            <TableCell sx={{ py: 1.5 }}>
              <Typography variant="body2">{new Date(row.created_at).toLocaleDateString()}</Typography>
            </TableCell>
            <TableCell align="right" sx={{ py: 1.5 }}>
              <IconButton color="primary" size="small" onClick={() => navigate(`/user-view/${typeParam}/${row.id}`)}><VisibilityIcon fontSize="small" /></IconButton>
            </TableCell>
          </TableRow>
        );
      default:
        return null;
    }
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', mt: 2, pb: 10, px: { xs: 1, md: 2 } }}>
      <Paper
        elevation={0}
        sx={{
          p: 2.6,
          mb: 3,
          borderRadius: '28px',
          border: theme.palette.mode === 'light' ? '1px solid rgba(148, 163, 184, 0.2)' : '1px solid rgba(148, 163, 184, 0.1)',
          background: theme.palette.mode === 'light'
            ? 'linear-gradient(135deg, rgba(232, 239, 255, 0.95), rgba(240, 245, 255, 0.92))'
            : 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(59,130,246,0.14), rgba(15,23,42,0.96))',
          boxShadow: theme.palette.mode === 'light' ? 'none' : '0 22px 40px rgba(2, 6, 23, 0.35)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(37,99,235,0.15), rgba(96,165,250,0.22))',
                color: '#1d4ed8',
                boxShadow: 'inset 0 0 0 1px rgba(37, 99, 235, 0.08)',
              }}
            >
              <GroupIcon sx={{ fontSize: 28 }} />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.03em' }}>
                Users Management
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5, fontSize: '1.02rem' }}>
                Manage individuals, bulkers, providers, and clients.
              </Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Chip
              label={`${totalCount} total`}
              size="small"
              sx={{
                borderRadius: '999px',
                bgcolor: theme.palette.mode === 'light' ? 'rgba(37, 99, 235, 0.08)' : 'rgba(96, 165, 250, 0.15)',
                color: theme.palette.primary.main,
                fontWeight: 700,
                px: 0.8,
                height: 34,
                fontSize: '0.9rem',
              }}
            />
          </Stack>
        </Box>
      </Paper>

      <Box sx={{
        display: 'flex', gap: 1.5, mb: 3, overflowX: 'auto', pb: 1,
        '&::-webkit-scrollbar': { height: '6px' },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(0,0,0,0.12)', borderRadius: '10px' }
      }}>
        {tabs.map((tab, index) => {
          const isActive = activeTab === index;
          return (
            <Box
              key={tab.id}
              onClick={() => setActiveTab(index)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.1,
                py: 1.15, px: 2.4, borderRadius: '999px', cursor: 'pointer',
                transition: 'all 0.25s ease', whiteSpace: 'nowrap',
                bgcolor: isActive
                  ? (theme.palette.mode === 'light' ? '#f9fbff' : 'rgba(15, 23, 42, 0.72)')
                  : (theme.palette.mode === 'light' ? '#f6f7fb' : 'rgba(15, 23, 42, 0.48)'),
                color: isActive ? 'text.primary' : 'text.primary',
                boxShadow: isActive
                  ? (theme.palette.mode === 'light' ? '0 0 0 1px rgba(37,99,235,0.10), 0 10px 22px rgba(15,23,42,0.06)' : '0 0 0 1px rgba(148,163,184,0.12), 0 8px 18px rgba(15,23,42,0.18)')
                  : (theme.palette.mode === 'light' ? '0 1px 0 rgba(15,23,42,0.03)' : 'none'),
                border: isActive ? '1px solid rgba(37,99,235,0.12)' : '1px solid rgba(148,163,184,0.15)',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: theme.palette.mode === 'light' ? '0 8px 18px rgba(15,23,42,0.06)' : '0 10px 22px rgba(15,23,42,0.18)'
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, color: 'text.primary' }}>
                {tab.icon}
              </Box>
              <Typography variant="button" sx={{ fontWeight: 700, letterSpacing: 0.45, fontSize: '0.82rem', textTransform: 'uppercase' }}>
                {tab.label}
              </Typography>
            </Box>
          );
        })}
      </Box>

      <Paper elevation={0} sx={{ p: 2.25, mb: 3, borderRadius: '18px', border: theme.palette.mode === 'light' ? '1px solid rgba(15, 23, 42, 0.06)' : '1px solid rgba(148, 163, 184, 0.09)', bgcolor: 'background.paper', boxShadow: theme.palette.mode === 'light' ? '0 12px 22px rgba(15, 23, 42, 0.03)' : '0 16px 30px rgba(2, 6, 23, 0.22)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <FilterListIcon fontSize="small" color="primary" />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Filter Records</Typography>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <TextField
            size="small" label="Search Name, Email, or ID"
            value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})}
            sx={{ flexGrow: 1, minWidth: 220, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
          />
          <TextField
            size="small" label="From Date" type="date" InputLabelProps={{ shrink: true }}
            value={filters.fromDate} onChange={e => setFilters({...filters, fromDate: e.target.value})}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
          />
          <TextField
            size="small" label="To Date" type="date" InputLabelProps={{ shrink: true }}
            value={filters.toDate} onChange={e => setFilters({...filters, toDate: e.target.value})}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
          />
          <Button variant="contained" disableElevation onClick={handleFilterApply} sx={{ borderRadius: '12px', px: 2.5, fontWeight: 700, boxShadow: 'none' }}>
            Apply Filter
          </Button>
        </Box>
      </Paper>

      <Paper elevation={0} sx={{
        borderRadius: '22px',
        border: theme.palette.mode === 'light' ? '1px solid rgba(15, 23, 42, 0.06)' : '1px solid rgba(148, 163, 184, 0.08)',
        overflow: 'hidden',
        bgcolor: 'background.paper',
        boxShadow: theme.palette.mode === 'light' ? '0 16px 28px rgba(15, 23, 42, 0.04)' : '0 18px 32px rgba(2, 6, 23, 0.25)'
      }}>
        {loading ? (
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1.25 }}>
              <Skeleton variant="text" width={180} height={22} sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }} />
              <Skeleton variant="text" width={120} height={22} sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }} />
            </Box>

            {Array.from({ length: 6 }).map((_, idx) => (
              <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.4, borderTop: idx === 0 ? 'none' : `1px solid ${theme.palette.divider}` }}>
                <Skeleton variant="circular" width={34} height={34} sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }} />
                <Box sx={{ flex: 1.5, minWidth: 0 }}>
                  <Skeleton variant="text" width="70%" height={18} sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }} />
                  <Skeleton variant="text" width="50%" height={14} sx={{ mt: 0.5, bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }} />
                </Box>
                <Box sx={{ flex: 1.8, minWidth: 0 }}>
                  <Skeleton variant="text" width="80%" height={18} sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }} />
                  <Skeleton variant="text" width="60%" height={14} sx={{ mt: 0.5, bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }} />
                </Box>
                <Box sx={{ flex: 1, display: { xs: 'none', md: 'block' } }}>
                  <Skeleton variant="text" width="60%" height={18} sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: 90 }}>
                  <Skeleton variant="rectangular" width={30} height={30} sx={{ borderRadius: '10px', bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }} />
                </Box>
              </Box>
            ))}
          </Box>
        ) : data.length === 0 ? (
          <Box sx={{ p: 8, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">No records found matching your criteria.</Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)' }}>
                  {renderTableHead()}
                </TableHead>
                <TableBody>
                  {data.map(row => renderTableRow(row))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary', pl: 1 }}>
                Total {tabs[activeTab].label}: {totalCount}
              </Typography>
              <TablePagination
                component="div"
                count={totalCount}
                page={page - 1}
                onPageChange={(e, newPage) => setPage(newPage + 1)}
                rowsPerPage={rowsPerPage}
                rowsPerPageOptions={[10]}
                sx={{ borderBottom: 'none' }}
              />
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}
