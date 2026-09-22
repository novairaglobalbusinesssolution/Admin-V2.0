import { useEffect, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Checkbox, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, Divider, IconButton, InputAdornment,
  Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TablePagination, TableRow, TextField, Typography, useTheme, Tabs, Tab,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/Edit';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import SearchIcon from '@mui/icons-material/Search';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Tesseract from 'tesseract.js';
import { supabase } from '../supabaseClient';
import Swal from 'sweetalert2';

const getISTDate = () => {
  const d = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + istOffset);
  return istDate.toISOString().slice(0, 10);
};

const normalizeName = (value = '') =>
  value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const extractUsernameFromOCR = (text) => {
  if (!text) return null;
  const match = text.match(/Your review\s+([A-Za-z0-9\s]+?)\s*[\.\*]/i);
  return match ? match[1].trim() : null;
};

const getBestProfileMatch = (ocrText, profiles) => {
  const extracted = extractUsernameFromOCR(ocrText);
  const textToMatch = normalizeName(extracted || ocrText || '');
  if (!textToMatch || !profiles.length) return null;
  let best = null;
  profiles.forEach((profile) => {
    const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    const normalizedFullName = normalizeName(fullName);
    const candidate = { profile, fullName, score: 0 };
    if (!normalizedFullName) return;
    if (textToMatch === normalizedFullName) candidate.score = 100;
    else if (textToMatch.includes(normalizedFullName) || normalizedFullName.includes(textToMatch)) candidate.score = 90;
    else {
      const textTokens = new Set(textToMatch.split(' '));
      const nameTokens = normalizedFullName.split(' ');
      candidate.score = nameTokens.filter((t) => textTokens.has(t)).length * 25;
    }
    if (!best || candidate.score > best.score) best = candidate;
  });
  return best && best.score > 0 ? best : null;
};

export default function ScanZone() {
  const theme = useTheme();
  const [publishDate, setPublishDate] = useState(getISTDate());
  const [apps, setApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [bulkers, setBulkers] = useState([]);
  const [selectedBulker, setSelectedBulker] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [message, setMessage] = useState({ type: 'info', text: '' });

  // Tab state: 0 = Member Add, 1 = OCR Scan
  const [tabMode, setTabMode] = useState(0);

  // ——— OCR Scan state ———
  const [scanRows, setScanRows] = useState([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  // ——— Member Add state ———
  const [bulkerMembers, setBulkerMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [memberPage, setMemberPage] = useState(0);
  const [memberRowsPerPage, setMemberRowsPerPage] = useState(50);
  const [savingMembers, setSavingMembers] = useState(false);

  // ——— Fetch apps ———
  useEffect(() => { fetchApps(); }, [publishDate]);
  useEffect(() => { fetchProfiles(); }, []);

  useEffect(() => {
    if (!selectedApp) { setBulkers([]); setSelectedBulker(null); return; }
    fetchBulkers();
  }, [selectedApp]);

  useEffect(() => {
    if (!selectedBulker) { setBulkerMembers([]); setSelectedMembers([]); return; }
    fetchBulkerMembers();
  }, [selectedBulker]);

  const fetchApps = async () => {
    let query = supabase.from('apps').select('id, app_name, task_id, app_date, task_type');
    if (publishDate) query = query.eq('app_date', publishDate);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (!error && data) {
      setApps(data);
      setSelectedApp((prev) => (prev && data.some((a) => a.id === prev.id) ? prev : null));
    }
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles')
      .select('earner_id, first_name, last_name, phone, email, bulker_id')
      .order('created_at', { ascending: false });
    if (data) setProfiles(data);
  };

  const fetchBulkers = async () => {
    const { data } = await supabase.from('bulker_desks')
      .select('bulker_id, full_name, status')
      .in('status', ['Active', 'active', 'Verified', 'verified'])
      .order('full_name', { ascending: true });
    if (data) {
      setBulkers(data);
      setSelectedBulker((prev) => (prev && data.some((b) => b.bulker_id === prev.bulker_id) ? prev : null));
    }
  };

  const fetchBulkerMembers = async () => {
    if (!selectedBulker) return;
    const shortId = selectedBulker.bulker_id?.replace('NOVAIRA/BULKER/', '') || '';
    const longId = `NOVAIRA/BULKER/${shortId}`;
    const ids = [selectedBulker.bulker_id, shortId, longId].filter(Boolean);

    const { data } = await supabase
      .from('profiles')
      .select('earner_id, first_name, last_name, phone, email, bulker_id')
      .in('bulker_id', ids)
      .order('first_name', { ascending: true });

    if (data) setBulkerMembers(data);
    setSelectedMembers([]);
    setMemberSearch('');
    setMemberPage(0);
  };

  // ——— OCR Scan functions (unchanged) ———
  const processImageFiles = async (filesList) => {
    if (!filesList.length) return;
    if (!selectedApp) { setMessage({ type: 'error', text: 'Please choose an app first.' }); return; }
    setScanLoading(true);
    setMessage({ type: 'info', text: 'Initializing OCR scanner...' });
    try {
      const worker = await Tesseract.createWorker('eng');
      const rows = [];
      for (let i = 0; i < filesList.length; i++) {
        const file = filesList[i];
        setMessage({ type: 'info', text: `Scanning image ${i + 1} of ${filesList.length}...` });
        try {
          const { data } = await worker.recognize(file);
          const text = data.text || '';
          const extractedName = extractUsernameFromOCR(text);
          const match = getBestProfileMatch(text, profiles);
          rows.push({
            id: `${Date.now()}-${Math.random()}`, file, preview: URL.createObjectURL(file),
            ocrText: extractedName || text,
            bestMatch: match,
            matchedName: match ? `${match.profile.first_name || ''} ${match.profile.last_name || ''}`.trim() || match.profile.earner_id : 'No match',
            earnerId: match ? match.profile.earner_id : 'No match',
            status: match ? 'Matched' : 'Unmatched',
          });
        } catch {
          rows.push({
            id: `${Date.now()}-${Math.random()}`, file, preview: URL.createObjectURL(file),
            ocrText: 'OCR Failed', bestMatch: null, matchedName: 'No match', earnerId: 'No match', status: 'Unmatched',
          });
        }
      }
      await worker.terminate();
      setScanRows((prev) => [...prev, ...rows]);
      const successCount = rows.filter((r) => r.bestMatch).length;
      setMessage({ type: successCount > 0 ? 'success' : 'warning', text: `Scan complete: ${successCount} matched out of ${filesList.length} images.` });
    } catch {
      setMessage({ type: 'error', text: 'OCR engine failed. Please try again.' });
    } finally {
      setScanLoading(false);
    }
  };
  const handleFileChange = (e) => { const f = Array.from(e.target.files || []); if (f.length) processImageFiles(f); e.target.value = ''; };
  const removeScanRow = (rowId) => { setScanRows((p) => p.filter((r) => r.id !== rowId)); };
  const openImagePreview = (url) => { setPreviewImage(url); setPreviewOpen(true); };
  const openEditDialog = (row) => {
    setEditRow({ ...row, selectedProfile: row.bestMatch?.profile || null, manualName: row.manualName || (row.matchedName === 'No match' ? '' : row.matchedName) });
  };
  const saveEditedRow = () => {
    if (!editRow) return;
    const sp = editRow.selectedProfile || null;
    const mn = (editRow.manualName || '').trim();
    const nextName = sp ? `${sp.first_name || ''} ${sp.last_name || ''}`.trim() || sp.earner_id : mn || 'No match';
    const nextEid = sp ? sp.earner_id : (mn ? 'MANUAL' : 'No match');
    setScanRows((prev) => prev.map((r) => r.id === editRow.id ? { ...r, bestMatch: sp ? { profile: sp } : null, selectedProfile: sp, manualName: mn, matchedName: nextName, earnerId: nextEid, status: sp || mn ? 'Matched' : 'Unmatched' } : r));
    setEditRow(null);
  };
  const ensureCommentForApp = async () => {
    const { data: existing } = await supabase
      .from('app_comments')
      .select('id')
      .eq('app_id', selectedApp.id)
      .limit(1);

    if (existing && existing.length > 0) return existing[0].id;

    const placeholder = {
      id: crypto.randomUUID(),
      app_id: selectedApp.id,
      content: `Bulk record placeholder for ${selectedApp.app_name}`,
      status: 'active',
      rating: 5,
    };

    const { data, error } = await supabase
      .from('app_comments')
      .insert(placeholder)
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  };

  const handleSaveScans = async () => {
    if (!selectedApp) { setMessage({ type: 'error', text: 'Please choose an app.' }); return; }
    if (!selectedBulker) { setMessage({ type: 'error', text: 'Please choose a bulker.' }); return; }
    if (!scanRows.length) { setMessage({ type: 'error', text: 'Upload at least one image.' }); return; }
    const valid = scanRows.filter((r) => r.bestMatch || (r.manualName && r.manualName.trim()));
    if (!valid.length) { setMessage({ type: 'error', text: 'No matched users. Edit rows or re-scan.' }); return; }
    setSaveLoading(true);
    setMessage({ type: 'info', text: 'Saving scanned records...' });
    try {
      const commentId = await ensureCommentForApp();
      const payload = valid.map((r) => {
        const sp = r.bestMatch?.profile || r.selectedProfile;
        const fn = sp ? `${sp.first_name || ''} ${sp.last_name || ''}`.trim() || sp.earner_id : r.manualName?.trim() || 'Unknown';
        return { app_id: selectedApp.id, comment_id: commentId, earner_id: sp ? sp.earner_id : r.manualName?.trim() || 'MANUAL', bulker_id: selectedBulker.bulker_id, submitted_username: fn, screenshot_url: r.file.name, status: 'Under Review' };
      });
      const { error } = await supabase.from('review_submit_data').insert(payload);
      if (error) throw error;
      setMessage({ type: 'success', text: `Saved ${payload.length} scan record(s).` });
      setScanRows([]);
    } catch (e) {
      setMessage({ type: 'error', text: e.message || 'Failed to save.' });
    } finally {
      setSaveLoading(false);
    }
  };

  // ——— Member Add functions ———
  const toggleMember = (earnerIdVal) => {
    setSelectedMembers((prev) =>
      prev.includes(earnerIdVal) ? prev.filter((id) => id !== earnerIdVal) : [...prev, earnerIdVal]
    );
  };

  const toggleAllFiltered = () => {
    const filtered = getFilteredMembers();
    const allSelected = filtered.every((m) => selectedMembers.includes(m.earner_id));
    if (allSelected) {
      setSelectedMembers((prev) => prev.filter((id) => !filtered.find((m) => m.earner_id === id)));
    } else {
      const newIds = filtered.map((m) => m.earner_id).filter((id) => !selectedMembers.includes(id));
      setSelectedMembers((prev) => [...prev, ...newIds]);
    }
  };

  const getFilteredMembers = () => {
    if (!memberSearch.trim()) return bulkerMembers;
    const q = memberSearch.toLowerCase();
    return bulkerMembers.filter((m) =>
      m.earner_id?.toLowerCase().includes(q) ||
      m.first_name?.toLowerCase().includes(q) ||
      m.last_name?.toLowerCase().includes(q) ||
      m.phone?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q)
    );
  };

  const handleSaveMembers = async () => {
    if (!selectedApp) { setMessage({ type: 'error', text: 'Please choose an app.' }); return; }
    if (!selectedBulker) { setMessage({ type: 'error', text: 'Please choose a bulker.' }); return; }
    if (!selectedMembers.length) { setMessage({ type: 'error', text: 'Please select at least one member.' }); return; }

    const isDark = theme.palette.mode === 'dark';
    const result = await Swal.fire({
      title: 'Add Members?',
      html: `<p>You are about to add <strong>${selectedMembers.length} member(s)</strong> to <strong>${selectedApp.app_name}</strong> under <strong>${selectedBulker.full_name}</strong>.</p><p style="font-weight:700;color:${isDark ? '#4ade80' : '#16a34a'};margin-top:12px">Process anyway?</p>`,
      icon: 'question', showCancelButton: true,
      confirmButtonText: 'Yes, add them', confirmButtonColor: '#16a34a',
      background: isDark ? '#1e293b' : '#fff', color: isDark ? '#f8fafc' : '#0f172a'
    });
    if (!result.isConfirmed) return;

    setSavingMembers(true);
    setMessage({ type: 'info', text: 'Saving members...' });

    try {
      const commentId = await ensureCommentForApp();
      const memberProfiles = selectedMembers.map((eid) => bulkerMembers.find((m) => m.earner_id === eid)).filter(Boolean);

      const payload = memberProfiles.map((p) => ({
        app_id: selectedApp.id,
        comment_id: commentId,
        earner_id: p.earner_id,
        bulker_id: selectedBulker.bulker_id,
        submitted_username: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.phone || p.earner_id,
        screenshot_url: 'manual-add',
        status: 'Under Review',
      }));

      const { error } = await supabase.from('review_submit_data').insert(payload);
      if (error) throw error;

      setMessage({ type: 'success', text: `Successfully added ${payload.length} member(s) to ${selectedApp.app_name}.` });
      setSelectedMembers([]);
      Swal.fire({ title: 'Members Added!', text: `${payload.length} member(s) saved successfully.`, icon: 'success', confirmButtonColor: '#16a34a', background: isDark ? '#1e293b' : '#fff', color: isDark ? '#f8fafc' : '#0f172a' });
    } catch (e) {
      setMessage({ type: 'error', text: e.message || 'Failed to save members.' });
    } finally {
      setSavingMembers(false);
    }
  };

  const filteredMembers = getFilteredMembers();
  const paginatedMembers = filteredMembers.slice(memberPage * memberRowsPerPage, memberPage * memberRowsPerPage + memberRowsPerPage);
  const allFilteredSelected = filteredMembers.length > 0 && filteredMembers.every((m) => selectedMembers.includes(m.earner_id));

  const headCell = { fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap', py: 1.5 };
  const bodyCell = { fontSize: '0.82rem', py: 1.2 };

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', py: 3 }}>
      <Paper sx={{ p: 4, borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>Scan Zone</Typography>
            <Chip label="Bulk Scan & Add" color="primary" variant="filled" />
          </Box>

          <Divider />

          {/* Row 1: Date & App */}
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Publish Date (IST Kolkata 5:30)</Typography>
              <TextField type="date" fullWidth value={publishDate} onChange={(e) => setPublishDate(e.target.value)} />
            </Box>
            <Box sx={{ flex: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Select App</Typography>
              <Autocomplete
                options={apps}
                getOptionLabel={(o) => `[Task #${o.task_id}] ${o.app_name}`}
                value={selectedApp}
                onChange={(e, v) => setSelectedApp(v)}
                renderInput={(params) => <TextField {...params} placeholder="Choose app by date" />}
                fullWidth
              />
            </Box>
          </Box>

          {/* App Style Info Chip */}
          {selectedApp && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Chip
                label={`App Style: ${selectedApp.task_type || 'Unknown'}`}
                color={selectedApp.task_type === 'Registration' ? 'warning' : 'info'}
                variant="filled"
                sx={{ fontWeight: 700, fontSize: '0.85rem' }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                {selectedApp.task_type === 'Registration'
                  ? 'This is a Registration type task — users register on the app.'
                  : 'This is an Android App review task — users submit Play Store reviews.'}
              </Typography>
            </Box>
          )}

          {/* Row 2: Bulker */}
          {selectedApp && (
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
              <Box sx={{ flex: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Select Active Bulker</Typography>
                <Autocomplete
                  options={bulkers}
                  getOptionLabel={(o) => `${o.full_name} (${o.bulker_id})`}
                  value={selectedBulker}
                  onChange={(e, v) => setSelectedBulker(v)}
                  renderInput={(params) => <TextField {...params} placeholder="Choose bulker" />}
                  fullWidth
                />
              </Box>
            </Box>
          )}

          {/* Tab: Member Add vs OCR Scan */}
          {selectedApp && selectedBulker && (
            <Box>
              <Tabs
                value={tabMode}
                onChange={(e, v) => setTabMode(v)}
                textColor="primary"
                indicatorColor="primary"
                sx={{ mb: 2 }}
              >
                <Tab label="Add Members" sx={{ fontWeight: 700, textTransform: 'none', fontSize: '0.95rem' }} />
                <Tab label="OCR Scan (Screenshots)" sx={{ fontWeight: 700, textTransform: 'none', fontSize: '0.95rem' }} />
              </Tabs>

              {/* ————— TAB 0: Member Add ————— */}
              {tabMode === 0 && (
                <Box>
                  {/* Header */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Members of {selectedBulker.full_name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total: {bulkerMembers.length} | Selected: {selectedMembers.length}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {selectedMembers.length > 0 && (
                        <Button
                          variant="contained" color="success" size="small"
                          startIcon={<PersonAddIcon fontSize="small" />}
                          onClick={handleSaveMembers}
                          disabled={savingMembers}
                          sx={{ borderRadius: '100px', fontWeight: 700, textTransform: 'none', px: 3 }}
                        >
                          {savingMembers ? 'Saving...' : `Add ${selectedMembers.length} Member(s)`}
                        </Button>
                      )}
                    </Box>
                  </Box>

                  {/* Search */}
                  <TextField
                    size="small" fullWidth
                    placeholder="Search by name, phone, email, earner ID..."
                    value={memberSearch}
                    onChange={(e) => { setMemberSearch(e.target.value); setMemberPage(0); }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} /></InputAdornment> }}
                    sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                  />

                  {bulkerMembers.length === 0 ? (
                    <Box sx={{ p: 5, textAlign: 'center', border: `1px dashed ${theme.palette.divider}`, borderRadius: '16px' }}>
                      <Typography color="text.secondary">No members found under this bulker.</Typography>
                    </Box>
                  ) : filteredMembers.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center', border: `1px dashed ${theme.palette.divider}`, borderRadius: '12px' }}>
                      <Typography color="text.secondary">No members match your search.</Typography>
                    </Box>
                  ) : (
                    <TableContainer component={Paper} elevation={0} sx={{
                      borderRadius: '16px', border: `1px solid ${theme.palette.divider}`, overflow: 'hidden',
                      bgcolor: theme.palette.mode === 'light' ? '#fff' : 'rgba(15,23,42,0.5)'
                    }}>
                      <Table size="small" stickyHeader>
                        <TableHead sx={{ bgcolor: theme.palette.mode === 'light' ? 'rgba(15,23,42,0.02)' : 'rgba(148,163,184,0.06)' }}>
                          <TableRow>
                            <TableCell padding="checkbox" sx={headCell}>
                              <Checkbox
                                checked={allFilteredSelected}
                                indeterminate={selectedMembers.length > 0 && !allFilteredSelected}
                                onChange={toggleAllFiltered}
                                size="small"
                              />
                            </TableCell>
                            <TableCell sx={headCell}>#</TableCell>
                            <TableCell sx={headCell}>Name</TableCell>
                            <TableCell sx={headCell}>Earner ID</TableCell>
                            <TableCell sx={headCell}>Phone</TableCell>
                            <TableCell sx={headCell}>Email</TableCell>
                            <TableCell align="center" sx={headCell}>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {paginatedMembers.map((m, idx) => {
                            const isSelected = selectedMembers.includes(m.earner_id);
                            const rowNum = memberPage * memberRowsPerPage + idx + 1;
                            const fullName = `${m.first_name || ''} ${m.last_name || ''}`.trim() || '-';

                            return (
                              <TableRow
                                key={m.earner_id} hover
                                onClick={() => toggleMember(m.earner_id)}
                                sx={{
                                  cursor: 'pointer',
                                  bgcolor: isSelected
                                    ? (theme.palette.mode === 'light' ? 'rgba(46,125,50,0.06)' : 'rgba(46,125,50,0.12)')
                                    : 'transparent',
                                  '&:last-child td': { border: 0 }
                                }}
                              >
                                <TableCell padding="checkbox">
                                  <Checkbox checked={isSelected} size="small" />
                                </TableCell>
                                <TableCell sx={{ ...bodyCell, color: 'text.secondary', fontWeight: 600 }}>{rowNum}</TableCell>
                                <TableCell sx={{ ...bodyCell, fontWeight: 600 }}>{fullName}</TableCell>
                                <TableCell sx={bodyCell}>
                                  <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{m.earner_id}</Typography>
                                </TableCell>
                                <TableCell sx={bodyCell}>{m.phone || '-'}</TableCell>
                                <TableCell sx={bodyCell}>{m.email || '-'}</TableCell>
                                <TableCell align="center" sx={bodyCell}>
                                  {isSelected ? (
                                    <Chip icon={<CheckCircleIcon sx={{ fontSize: '0.9rem' }} />} label="Selected" color="success" size="small" sx={{ fontWeight: 700, fontSize: '0.7rem', height: 22 }} />
                                  ) : (
                                    <Typography variant="caption" color="text.secondary">—</Typography>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>

                      <TablePagination
                        component="div" count={filteredMembers.length}
                        page={memberPage} rowsPerPage={memberRowsPerPage}
                        onPageChange={(e, p) => setMemberPage(p)}
                        onRowsPerPageChange={(e) => { setMemberRowsPerPage(parseInt(e.target.value, 10)); setMemberPage(0); }}
                        rowsPerPageOptions={[25, 50, 100]}
                        labelDisplayedRows={({ from, to, count }) => `${from}-${to} of ${count}`}
                      />
                    </TableContainer>
                  )}
                </Box>
              )}

              {/* ————— TAB 1: OCR Scan ————— */}
              {tabMode === 1 && (
                <Box>
                  <Paper sx={{ p: 3, border: '1.5px dashed', borderColor: 'primary.main', borderRadius: '18px', background: 'rgba(25,118,210,0.02)' }}>
                    <Stack spacing={2}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Upload Multiple Images</Typography>
                      <Button component="label" variant="contained" startIcon={<UploadFileIcon />} sx={{ alignSelf: 'flex-start' }}>
                        Choose Images
                        <input hidden multiple type="file" accept="image/*" onChange={handleFileChange} />
                      </Button>
                      {scanLoading && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <CircularProgress size={22} />
                          <Typography variant="body2" color="text.secondary">OCR scanning images...</Typography>
                        </Box>
                      )}
                    </Stack>
                  </Paper>

                  {scanRows.length > 0 && (
                    <Box sx={{ mt: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>OCR Match Results</Typography>
                        <Button variant="contained" color="success" startIcon={<SaveAltIcon />} onClick={handleSaveScans} disabled={saveLoading}>
                          {saveLoading ? 'Saving...' : 'Save Scanned Data'}
                        </Button>
                      </Box>

                      <TableContainer component={Paper} sx={{ borderRadius: '16px' }}>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>Image</TableCell>
                              <TableCell>Extracted Username</TableCell>
                              <TableCell>Matched User</TableCell>
                              <TableCell>Earner ID</TableCell>
                              <TableCell>Status</TableCell>
                              <TableCell align="right">Action</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {scanRows.map((row) => (
                              <TableRow key={row.id} sx={{ '& td': { verticalAlign: 'middle' } }}>
                                <TableCell sx={{ width: 120 }}>
                                  <Box sx={{ position: 'relative', width: 90, height: 90 }}>
                                    <Box component="img" src={row.preview} alt={row.file.name}
                                      onClick={() => openImagePreview(row.preview)}
                                      sx={{ width: 90, height: 90, objectFit: 'cover', borderRadius: '12px', border: '1px solid', borderColor: 'divider', cursor: 'pointer', display: 'block', '&:hover': { transform: 'scale(1.04)' }, transition: 'transform 0.2s ease' }}
                                    />
                                    {row.matchedName && row.matchedName !== 'No match' && (
                                      <Box sx={{ position: 'absolute', left: 6, right: 6, bottom: 6, bgcolor: 'rgba(0,0,0,0.72)', color: '#fff', borderRadius: 1, px: 0.75, py: 0.35, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>
                                        {row.matchedName}
                                      </Box>
                                    )}
                                  </Box>
                                </TableCell>
                                <TableCell sx={{ minWidth: 220 }}>
                                  <Typography variant="body2" sx={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.5 }}>{row.ocrText || 'No text detected'}</Typography>
                                </TableCell>
                                <TableCell sx={{ minWidth: 160 }}>{row.matchedName}</TableCell>
                                <TableCell sx={{ minWidth: 120 }}>{row.earnerId}</TableCell>
                                <TableCell sx={{ minWidth: 120 }}>
                                  <Chip label={row.status} color={row.status === 'Matched' ? 'success' : 'warning'} size="small" />
                                </TableCell>
                                <TableCell align="right" sx={{ minWidth: 120 }}>
                                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                                    <IconButton color="primary" onClick={() => openEditDialog(row)}><EditIcon /></IconButton>
                                    <IconButton color="error" onClick={() => removeScanRow(row.id)}><DeleteOutlineIcon /></IconButton>
                                  </Box>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          )}

          {/* Message */}
          {message.text && <Alert severity={message.type}>{message.text}</Alert>}
        </Stack>
      </Paper>

      {/* Image Preview Dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogContent sx={{ p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: '#111' }}>
          <Box component="img" src={previewImage} alt="Preview" sx={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: '12px' }} />
        </DialogContent>
      </Dialog>

      {/* Edit Scan Row Dialog */}
      <Dialog open={Boolean(editRow)} onClose={() => setEditRow(null)} maxWidth="md" fullWidth>
        {editRow && (
          <>
            <DialogContent>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' }, gap: 3, alignItems: 'center' }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', bgcolor: '#111', borderRadius: '14px', p: 2 }}>
                  <Box component="img" src={editRow.preview} alt={editRow.file.name} sx={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: '10px' }} />
                </Box>
                <Stack spacing={2}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Edit Scan Match</Typography>
                  <Autocomplete
                    options={profiles}
                    getOptionLabel={(o) => { const fn = `${o.first_name || ''} ${o.last_name || ''}`.trim(); return fn ? `${fn} (${o.earner_id || 'No ID'})` : o.earner_id || 'No ID'; }}
                    value={editRow.selectedProfile || null}
                    onChange={(e, v) => setEditRow((p) => ({ ...p, selectedProfile: v }))}
                    renderInput={(params) => <TextField {...params} label="Select User" />}
                    isOptionEqualToValue={(o, v) => o.earner_id === v?.earner_id}
                  />
                  <TextField label="User Name" fullWidth value={editRow.manualName || ''} onChange={(e) => setEditRow((p) => ({ ...p, manualName: e.target.value }))} placeholder="Type user name manually" />
                  <Typography variant="caption" color="text.secondary">Select a matched user or type the name manually.</Typography>
                </Stack>
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 3, pt: 0 }}>
              <Button onClick={() => setEditRow(null)} color="inherit">Cancel</Button>
              <Button variant="contained" onClick={saveEditedRow}>Save</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
