import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, TextField, Button,
  Divider, IconButton, Chip, Autocomplete, useTheme,
  CircularProgress, InputAdornment, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  Tooltip
} from '@mui/material';
import { supabase } from '../supabaseClient';
import DeleteIcon from '@mui/icons-material/Delete';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SearchIcon from '@mui/icons-material/Search';
import Swal from 'sweetalert2';

const getISTDate = () => {
  const d = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + istOffset);
  return istDate.toISOString().slice(0, 10);
};

export default function ManageComment() {
  const theme = useTheme();
  const [apps, setApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [publishDate, setPublishDate] = useState(getISTDate());

  const [manageComments, setManageComments] = useState([]);
  const [loadingManage, setLoadingManage] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  // Lookup maps
  const [profileMap, setProfileMap] = useState({});
  const [bulkerMap, setBulkerMap] = useState({});

  useEffect(() => {
    fetchApps(publishDate);
  }, [publishDate]);

  useEffect(() => {
    if (selectedApp) {
      fetchManageComments(selectedApp.id);
    } else {
      setManageComments([]);
    }
  }, [selectedApp]);

  // Load profiles & bulkers once
  useEffect(() => {
    (async () => {
      const [{ data: profiles }, { data: bulkers }] = await Promise.all([
        supabase.from('profiles').select('earner_id, first_name, last_name, phone, bulker_id'),
        supabase.from('bulker_desks').select('bulker_id, full_name')
      ]);
      if (profiles) {
        const pm = {};
        profiles.forEach(p => { pm[p.earner_id] = p; });
        setProfileMap(pm);
      }
      if (bulkers) {
        const bm = {};
        bulkers.forEach(b => {
          bm[b.bulker_id] = b.full_name;
          if (b.bulker_id?.startsWith('NOVAIRA/BULKER/')) {
            bm[b.bulker_id.replace('NOVAIRA/BULKER/', '')] = b.full_name;
          }
        });
        setBulkerMap(bm);
      }
    })();
  }, []);

  const fetchApps = async (selectedDate = publishDate) => {
    let query = supabase.from('apps').select('id, app_name, task_id, app_date');
    if (selectedDate) query = query.eq('app_date', selectedDate);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (!error && data) {
      setApps(data);
      setSelectedApp((prev) => (prev && data.some(app => app.id === prev.id) ? prev : null));
    }
  };

  const fetchManageComments = async (appId) => {
    setLoadingManage(true);
    try {
      const { data, error } = await supabase.from('app_comments')
        .select('*')
        .eq('app_id', appId)
        .order('created_at', { ascending: false });
      if (!error && data) setManageComments(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingManage(false);
      setPage(0);
    }
  };

  const formatKolkata = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return String(dateStr);
    }
  };

  const getUserInfo = (earnerIdRaw) => {
    if (!earnerIdRaw) return { name: '-', bulkerName: '-', bulkerId: '-' };
    const profile = profileMap[earnerIdRaw];
    if (!profile) return { name: earnerIdRaw, bulkerName: '-', bulkerId: '-' };

    const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.phone || earnerIdRaw;
    const rawBulker = profile.bulker_id || '';
    const bulkerName = bulkerMap[rawBulker]
      || bulkerMap[`NOVAIRA/BULKER/${rawBulker}`]
      || '-';

    return { name, bulkerName, bulkerId: rawBulker };
  };

  // ——— Actions ———

  const handleMarkActive = async (item) => {
    const isDark = theme.palette.mode === 'dark';
    const userInfo = getUserInfo(item.assigned_user_id);
    const result = await Swal.fire({
      title: 'Make Comment Active?',
      html: `
        <div style="text-align:left;font-size:0.92rem;line-height:1.6">
          <p>This comment is currently <strong>${(item.status || 'taken').toUpperCase()}</strong>${item.assigned_user_id ? ` by <strong>${userInfo.name}</strong> (${item.assigned_user_id})` : ''}.</p>
          <p style="color:${isDark ? '#94a3b8' : '#64748b'}">Releasing will clear user assignment and return it to the <strong>Public Pool</strong> so any other user can claim it.</p>
          <p style="font-weight:700;color:${isDark ? '#4ade80' : '#16a34a'};margin-top:12px;font-size:1rem">Process anyway?</p>
        </div>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Process anyway',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#16a34a',
      background: isDark ? '#1e293b' : '#ffffff',
      color: isDark ? '#f8fafc' : '#0f172a'
    });
    if (!result.isConfirmed) return;

    try {
      const { error } = await supabase.from('app_comments')
        .update({
          status: 'active', assigned_user_id: null,
          taken_at: null, submitted_at: null,
          user_device_ip: null, user_fingerprint: null,
          screenshot_url: null, extracted_username: null
        })
        .eq('id', item.id);
      if (error) throw error;

      setManageComments(prev => prev.map(c => c.id === item.id
        ? { ...c, status: 'active', assigned_user_id: null, taken_at: null, submitted_at: null, user_device_ip: null, user_fingerprint: null, screenshot_url: null, extracted_username: null }
        : c
      ));
      Swal.fire({ title: 'Marked as Active!', text: 'Comment returned to the public pool.', icon: 'success', confirmButtonColor: '#16a34a', background: isDark ? '#1e293b' : '#fff', color: isDark ? '#f8fafc' : '#0f172a' });
    } catch (e) {
      Swal.fire({ title: 'Update failed', text: e.message, icon: 'error' });
    }
  };

  const handleMarkAllTakenActive = async () => {
    if (!selectedApp || takenCount === 0) return;
    const isDark = theme.palette.mode === 'dark';
    const result = await Swal.fire({
      title: 'Release All Taken Comments?',
      html: `<p>Found <strong>${takenCount} taken comments</strong> for "${selectedApp.app_name}".<br/>This will return them to the public pool.</p><p style="font-weight:700;color:${isDark ? '#4ade80' : '#16a34a'};margin-top:12px">Process anyway?</p>`,
      icon: 'warning', showCancelButton: true,
      confirmButtonText: 'Process anyway', confirmButtonColor: '#16a34a',
      background: isDark ? '#1e293b' : '#fff', color: isDark ? '#f8fafc' : '#0f172a'
    });
    if (!result.isConfirmed) return;

    try {
      const { error } = await supabase.from('app_comments')
        .update({ status: 'active', assigned_user_id: null, taken_at: null, submitted_at: null, user_device_ip: null, user_fingerprint: null, screenshot_url: null, extracted_username: null })
        .eq('app_id', selectedApp.id).eq('status', 'taken');
      if (error) throw error;
      fetchManageComments(selectedApp.id);
      Swal.fire({ title: 'All Released!', text: `${takenCount} comments returned to pool.`, icon: 'success', confirmButtonColor: '#16a34a', background: isDark ? '#1e293b' : '#fff', color: isDark ? '#f8fafc' : '#0f172a' });
    } catch (e) {
      Swal.fire({ title: 'Update failed', text: e.message, icon: 'error' });
    }
  };

  const handleDeleteComment = async (id) => {
    const result = await Swal.fire({ title: 'Delete Comment?', text: 'This cannot be undone.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, delete it!' });
    if (result.isConfirmed) {
      const { error } = await supabase.from('app_comments').delete().eq('id', id);
      if (!error) {
        setManageComments(prev => prev.filter(c => c.id !== id));
        Swal.fire({ title: 'Deleted!', icon: 'success' });
      }
    }
  };

  const handleDeleteAllComments = async () => {
    if (!selectedApp) return;
    const result = await Swal.fire({ title: 'Delete all comments?', text: `Permanently delete every comment for "${selectedApp.app_name}".`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, delete all' });
    if (!result.isConfirmed) return;
    const { error } = await supabase.from('app_comments').delete().eq('app_id', selectedApp.id);
    if (error) { Swal.fire({ title: 'Delete failed', text: error.message, icon: 'error' }); return; }
    setManageComments([]);
    Swal.fire({ title: 'All deleted', icon: 'success' });
  };

  // ——— Derived ———
  const activeCount = manageComments.filter(c => c.status === 'active').length;
  const takenCount = manageComments.filter(c => c.status === 'taken').length;
  const completedCount = manageComments.filter(c => c.status === 'completed').length;

  const filteredComments = manageComments.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      const ui = getUserInfo(c.assigned_user_id);
      return (
        c.content?.toLowerCase().includes(q) ||
        c.assigned_user_id?.toLowerCase().includes(q) ||
        c.extracted_username?.toLowerCase().includes(q) ||
        ui.name?.toLowerCase().includes(q) ||
        ui.bulkerName?.toLowerCase().includes(q) ||
        ui.bulkerId?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const paginatedComments = filteredComments.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const statusChipColor = (s) => {
    if (s === 'active') return 'success';
    if (s === 'taken') return 'warning';
    if (s === 'completed') return 'info';
    return 'default';
  };

  const headCell = { fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap', py: 1.5 };
  const bodyCell = { fontSize: '0.8rem', py: 1.2, verticalAlign: 'top' };

  return (
    <Box sx={{ maxWidth: '1400px', mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Manage Comments</Typography>
      </Box>

      <Paper sx={{ p: 4, borderRadius: '16px', mb: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, mb: 4 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Publish Date (IST Kolkata 5:30)</Typography>
            <TextField
              type="date" fullWidth value={publishDate}
              onChange={(e) => setPublishDate(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { minHeight: '56px', borderRadius: '12px' } }}
            />
          </Box>
          <Box sx={{ flex: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Select Application</Typography>
            <Autocomplete
              options={apps}
              getOptionLabel={(o) => `[Task #${o.task_id}] ${o.app_name}`}
              value={selectedApp}
              onChange={(e, v) => setSelectedApp(v)}
              renderInput={(params) => <TextField {...params} placeholder="Search App by Name or Task ID" />}
              fullWidth
            />
          </Box>
        </Box>

        {selectedApp && (
          <Box>
            {/* Header with counts & buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Comments for {selectedApp.app_name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total: {manageComments.length} &nbsp;|&nbsp; Active: {activeCount} &nbsp;|&nbsp; Taken: {takenCount} &nbsp;|&nbsp; Completed: {completedCount}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button size="small" onClick={() => fetchManageComments(selectedApp.id)} variant="outlined" sx={{ borderRadius: '100px', fontWeight: 600 }}>Refresh</Button>
                {takenCount > 0 && (
                  <Button size="small" onClick={handleMarkAllTakenActive} variant="contained" color="success"
                    startIcon={<RestartAltIcon fontSize="small" />}
                    sx={{ borderRadius: '100px', fontWeight: 700, textTransform: 'none' }}>
                    Release All Taken ({takenCount})
                  </Button>
                )}
                <Button size="small" onClick={handleDeleteAllComments} variant="contained" color="error"
                  sx={{ borderRadius: '100px', fontWeight: 600, boxShadow: '0 8px 24px rgba(244,67,54,0.25)' }}>
                  Delete All
                </Button>
              </Box>
            </Box>

            {/* Filter Chips & Search */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2.5, flexWrap: 'wrap' }}>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {[
                  { key: 'all', label: `All (${manageComments.length})`, color: 'primary' },
                  { key: 'active', label: `Active (${activeCount})`, color: 'success' },
                  { key: 'taken', label: `Taken (${takenCount})`, color: 'warning' },
                  { key: 'completed', label: `Completed (${completedCount})`, color: 'info' },
                ].map(f => (
                  <Chip key={f.key} label={f.label} clickable
                    color={statusFilter === f.key ? f.color : 'default'}
                    onClick={() => { setStatusFilter(f.key); setPage(0); }}
                    sx={{ fontWeight: 600 }}
                  />
                ))}
              </Stack>

              <TextField
                size="small" placeholder="Search comment, user, bulker..."
                value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setPage(0); }}
                InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} /></InputAdornment>) }}
                sx={{ minWidth: { xs: '100%', sm: 280 }, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
              />
            </Box>

            {/* Data Table */}
            {loadingManage ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
            ) : filteredComments.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center', border: `1px dashed ${theme.palette.divider}`, borderRadius: '12px' }}>
                <Typography color="text.secondary">
                  {manageComments.length === 0 ? 'No comments found for this app.' : 'No comments match the selected filter.'}
                </Typography>
              </Box>
            ) : (
              <TableContainer component={Paper} elevation={0} sx={{
                borderRadius: '16px', border: `1px solid ${theme.palette.divider}`, overflow: 'hidden',
                bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(15,23,42,0.5)'
              }}>
                <Table size="small" stickyHeader>
                  <TableHead sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.02)' : 'rgba(148,163,184,0.06)' }}>
                    <TableRow>
                      <TableCell sx={headCell}>#</TableCell>
                      <TableCell sx={headCell}>Comment</TableCell>
                      <TableCell sx={headCell}>Rating</TableCell>
                      <TableCell sx={headCell}>Status</TableCell>
                      <TableCell sx={headCell}>Assigned User</TableCell>
                      <TableCell sx={headCell}>Bulker</TableCell>
                      <TableCell sx={headCell}>SS Username</TableCell>
                      <TableCell sx={headCell}>Taken At</TableCell>
                      <TableCell align="center" sx={headCell}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedComments.map((item, idx) => {
                      const isActive = item.status === 'active';
                      const ui = getUserInfo(item.assigned_user_id);
                      const rowNum = page * rowsPerPage + idx + 1;

                      return (
                        <TableRow key={item.id} hover sx={{
                          '&:last-child td, &:last-child th': { border: 0 },
                          bgcolor: item.status === 'taken'
                            ? (theme.palette.mode === 'light' ? 'rgba(237,108,2,0.03)' : 'rgba(237,108,2,0.06)')
                            : 'transparent'
                        }}>
                          <TableCell sx={{ ...bodyCell, color: 'text.secondary', fontWeight: 600 }}>{rowNum}</TableCell>

                          <TableCell sx={{ ...bodyCell, maxWidth: 320 }}>
                            <Tooltip title={item.content} arrow>
                              <Typography variant="body2" sx={{
                                fontWeight: 600, lineHeight: 1.4,
                                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis'
                              }}>
                                {item.content}
                              </Typography>
                            </Tooltip>
                          </TableCell>

                          <TableCell sx={bodyCell}>{'⭐'.repeat(item.rating || 5)}</TableCell>

                          <TableCell sx={bodyCell}>
                            <Chip size="small"
                              label={isActive ? 'Active' : item.status?.toUpperCase() || '-'}
                              color={statusChipColor(item.status)}
                              sx={{ fontSize: '0.7rem', fontWeight: 700, height: 22 }}
                            />
                          </TableCell>

                          <TableCell sx={bodyCell}>
                            {item.assigned_user_id ? (
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>{ui.name}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>{item.assigned_user_id}</Typography>
                              </Box>
                            ) : (
                              <Typography variant="caption" color="text.secondary">-</Typography>
                            )}
                          </TableCell>

                          <TableCell sx={bodyCell}>
                            {ui.bulkerId !== '-' ? (
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>{ui.bulkerName}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>{ui.bulkerId}</Typography>
                              </Box>
                            ) : (
                              <Typography variant="caption" color="text.secondary">-</Typography>
                            )}
                          </TableCell>

                          <TableCell sx={bodyCell}>
                            {item.extracted_username ? (
                              <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main', fontSize: '0.8rem' }}>
                                {item.extracted_username}
                              </Typography>
                            ) : (
                              <Typography variant="caption" color="text.secondary">-</Typography>
                            )}
                          </TableCell>

                          <TableCell sx={{ ...bodyCell, whiteSpace: 'nowrap' }}>
                            {item.taken_at ? formatKolkata(item.taken_at) : '-'}
                          </TableCell>

                          <TableCell align="center" sx={{ ...bodyCell, whiteSpace: 'nowrap' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
                              {!isActive && (
                                <Button size="small" variant="contained" color="success"
                                  startIcon={<RestartAltIcon sx={{ fontSize: '0.85rem' }} />}
                                  onClick={() => handleMarkActive(item)}
                                  sx={{ borderRadius: '100px', textTransform: 'none', fontWeight: 700, fontSize: '0.7rem', px: 1.2, py: 0.3, minWidth: 0, boxShadow: 'none' }}>
                                  Active
                                </Button>
                              )}
                              <IconButton color="error" size="small" onClick={() => handleDeleteComment(item.id)}>
                                <DeleteIcon sx={{ fontSize: '1rem' }} />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <TablePagination
                  component="div"
                  count={filteredComments.length}
                  page={page}
                  rowsPerPage={rowsPerPage}
                  onPageChange={(e, newPage) => setPage(newPage)}
                  onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                  rowsPerPageOptions={[25, 50, 100]}
                  labelRowsPerPage="Rows per page"
                  labelDisplayedRows={({ from, to, count }) => `${from}-${to} of ${count}`}
                />
              </TableContainer>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
}
