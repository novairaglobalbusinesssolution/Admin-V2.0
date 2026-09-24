import { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Grid, IconButton, Button,
  Breadcrumbs, Link, Dialog, DialogTitle, DialogContent,
  DialogActions, DialogContentText, TextField, Menu, MenuItem, CircularProgress,
  useTheme, Snackbar, Alert, Card, CardActionArea, Tooltip, Divider,
  Collapse, List, ListItem, ListItemButton, ListItemIcon, ListItemText
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ImageIcon from '@mui/icons-material/Image';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import HomeIcon from '@mui/icons-material/Home';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import CloseIcon from '@mui/icons-material/Close';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';


// We'll create a Recursive Folder Tree component inside the file
const FolderTreeItem = ({ folder, currentPath, onNavigate, pinnedFolders, togglePin }) => {
  const [open, setOpen] = useState(false);
  const [subfolders, setSubfolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchSub = async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/cloudinary/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: folder.path })
      });
      const data = await res.json();
      setSubfolders(data.folders || []);
      setLoaded(true);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!open) fetchSub();
    setOpen(!open);
  };

  const isPinned = pinnedFolders.includes(folder.path);

  return (
    <Box>
      <ListItem disablePadding>
        <ListItemButton 
          selected={currentPath === folder.path}
          onClick={() => onNavigate(folder.path)}
          sx={{ pl: 2 }}
        >
          <IconButton size="small" onClick={handleToggle} sx={{ mr: 1, p: 0.5 }}>
            {subfolders.length > 0 || !loaded ? (open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />) : <Box sx={{ width: 20 }} />}
          </IconButton>
          <ListItemIcon sx={{ minWidth: 32 }}><FolderIcon color="warning" fontSize="small" /></ListItemIcon>
          <ListItemText primary={folder.name} primaryTypographyProps={{ fontSize: '0.85rem' }} />
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); togglePin(folder.path); }}>
            {isPinned ? <StarIcon fontSize="small" color="warning" /> : <StarBorderIcon fontSize="small" color="disabled" />}
          </IconButton>
        </ListItemButton>
      </ListItem>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List component="div" disablePadding sx={{ pl: 2 }}>
          {loading ? <CircularProgress size={16} sx={{ ml: 4, my: 1 }} /> : 
            subfolders.map(sub => (
              <FolderTreeItem key={sub.path} folder={sub} currentPath={currentPath} onNavigate={onNavigate} pinnedFolders={pinnedFolders} togglePin={togglePin} />
            ))
          }
        </List>
      </Collapse>
    </Box>
  );
};


export default function FileManager() {
  const theme = useTheme();
  const [currentPath, setCurrentPath] = useState(''); // '' means root
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Left Sidebar Tree Data
  const [rootFolders, setRootFolders] = useState([]);
  const [pinnedFolders, setPinnedFolders] = useState(() => {
    try {
      const saved = localStorage.getItem('cloudinary_pinned');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch(e) {
      return [];
    }
  });
  
  // Right Sidebar Preview State
  const [previewFile, setPreviewFile] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  // Menus & Dialogs
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null); // can be file or folder
  const [isFolderMenu, setIsFolderMenu] = useState(false);
  
  const [renameDialog, setRenameDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [snack, setSnack] = useState({ open: false, message: '', type: 'success' });

  // Initial Load (Root Folders for Tree)
  useEffect(() => {
    fetchRootTree();
  }, []);

  const fetchRootTree = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/cloudinary/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: '' })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setRootFolders(data.folders || []);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchContents(currentPath);
  }, [currentPath]);

  const fetchContents = async (folder) => {
    setLoading(true);
    setPreviewFile(null); // close preview when navigating
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/cloudinary/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setFolders(data.folders || []);
        setFiles(data.files || []);
      } else {
        throw new Error(data.error);
      }
    } catch (e) {
      setSnack({ open: true, message: e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const togglePin = (path) => {
    let newPinned;
    if (pinnedFolders.includes(path)) {
      newPinned = pinnedFolders.filter(p => p !== path);
    } else {
      newPinned = [...pinnedFolders, path];
    }
    setPinnedFolders(newPinned);
    localStorage.setItem('cloudinary_pinned', JSON.stringify(newPinned));
  };

  const handleMenuClick = (event, item, isFolder) => {
    event.stopPropagation();
    setSelectedItem(item);
    setIsFolderMenu(isFolder);
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const triggerDelete = () => {
    handleMenuClose();
    setDeleteDialog(true);
  };

  const executeDelete = async () => {
    setDeleting(true);
    const isFolder = isFolderMenu;
    try {
      const url = isFolder ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/cloudinary/delete-folder` : `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/cloudinary/delete`;
      const body = isFolder ? { folder: selectedItem.path } : { public_ids: [selectedItem.public_id] };
      
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSnack({ open: true, message: `${isFolder ? 'Folder' : 'File'} deleted permanently!`, type: 'success' });
        setDeleteDialog(false);
        fetchContents(currentPath);
        if (isFolder && !currentPath) fetchRootTree();
      } else {
        throw new Error(data.error);
      }
    } catch (e) {
      setSnack({ open: true, message: e.message, type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const openRenameDialog = () => {
    handleMenuClose();
    if (isFolderMenu) {
      setNewName(selectedItem.name);
    } else {
      const parts = selectedItem.public_id.split('/');
      setNewName(parts[parts.length - 1]);
    }
    setRenameDialog(true);
  };

  const handleRename = async () => {
    if (!newName.trim()) return;
    setRenaming(true);
    try {
      const isFolder = isFolderMenu;
      let url, body;
      
      if (isFolder) {
        url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/cloudinary/rename-folder`;
        const parts = selectedItem.path.split('/');
        parts[parts.length - 1] = newName.trim();
        body = { from_path: selectedItem.path, to_path: parts.join('/') };
      } else {
        url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/cloudinary/rename`;
        const parts = selectedItem.public_id.split('/');
        parts[parts.length - 1] = newName.trim();
        body = { from_id: selectedItem.public_id, to_id: parts.join('/') };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSnack({ open: true, message: 'Renamed successfully!', type: 'success' });
        setRenameDialog(false);
        fetchContents(currentPath);
        if (isFolder && !currentPath) fetchRootTree();
      } else {
        throw new Error(data.error);
      }
    } catch (e) {
      setSnack({ open: true, message: e.message, type: 'error' });
    } finally {
      setRenaming(false);
    }
  };

  const handleDownload = async () => {
    handleMenuClose();
    if (isFolderMenu) {
      setSnack({ open: true, message: 'Creating zip, please wait... (may take time for large folders)', type: 'info' });
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/cloudinary/download-folder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder: selectedItem.path })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to create zip');
        }
        // Stream blob and trigger download
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedItem.name}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setSnack({ open: true, message: 'Download started!', type: 'success' });
      } catch (e) {
        setSnack({ open: true, message: e.message, type: 'error' });
      }
    } else {
      let url = selectedItem.secure_url;
      url = url.replace('/upload/', '/upload/fl_attachment/');
      window.open(url, '_blank');
    }
  };


  const handleView = () => {
    handleMenuClose();
    window.open(selectedItem.secure_url, '_blank');
  };

  const handleItemClick = (file) => {
    if (file.resource_type === 'image') {
      setPreviewFile(file);
      setZoomLevel(1);
    } else {
      window.open(file.secure_url, '_blank');
    }
  };

  const navigateToFolder = (path) => {
    setCurrentPath(path);
  };

  const breadcrumbs = (currentPath || '').split('/').filter(Boolean);

  const getFileIcon = (format, resource_type) => {
    if (resource_type === 'image') return <ImageIcon sx={{ fontSize: 40, color: '#0b57d0' }} />;
    if (resource_type === 'video') return <VideoFileIcon sx={{ fontSize: 40, color: '#d93025' }} />;
    return <InsertDriveFileIcon sx={{ fontSize: 40, color: '#5f6368' }} />;
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Box sx={{ maxWidth: '100%', height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>File Manager</Typography>
      </Box>

      <Paper sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden', borderRadius: '16px', border: `1px solid ${theme.palette.divider}`, m: 1 }}>
        
        {/* LEFT PANE: Folder Tree */}
        <Box sx={{ width: '280px', minWidth: '280px', borderRight: `1px solid ${theme.palette.divider}`, bgcolor: theme.palette.mode === 'light' ? '#f8f9fa' : 'background.paper', display: 'flex', flexDirection: 'column' }}>
          
          <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
            <ListItemButton onClick={() => navigateToFolder('')} selected={currentPath === ''} sx={{ borderRadius: '8px' }}>
              <ListItemIcon sx={{ minWidth: 32 }}><HomeIcon color="primary" /></ListItemIcon>
              <ListItemText primary="Root" primaryTypographyProps={{ fontWeight: 700 }} />
            </ListItemButton>
          </Box>
          
          <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
            {pinnedFolders.length > 0 && (
              <>
                <Typography variant="overline" sx={{ px: 2, pt: 2, display: 'block', color: 'text.secondary', fontWeight: 700 }}>Pinned Folders</Typography>
                <List disablePadding>
                  {pinnedFolders.map(pf => (
                    <ListItemButton key={pf} onClick={() => navigateToFolder(pf)} sx={{ pl: 3 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}><StarIcon color="warning" fontSize="small" /></ListItemIcon>
                      <ListItemText primary={pf.split('/').pop()} primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600 }} />
                    </ListItemButton>
                  ))}
                </List>
                <Divider sx={{ my: 1 }} />
              </>
            )}
            
            <Typography variant="overline" sx={{ px: 2, pt: 1, display: 'block', color: 'text.secondary', fontWeight: 700 }}>All Folders</Typography>
            <List disablePadding>
              {rootFolders.map(folder => (
                <FolderTreeItem key={folder.path} folder={folder} currentPath={currentPath} onNavigate={navigateToFolder} pinnedFolders={pinnedFolders} togglePin={togglePin} />
              ))}
            </List>
          </Box>

        </Box>

        {/* MIDDLE PANE: Content Grid */}
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', bgcolor: theme.palette.background.default }}>
          
          <Box sx={{ p: 1.5, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', alignItems: 'center' }}>
            <Breadcrumbs aria-label="breadcrumb">
              <Link underline="hover" color="inherit" onClick={() => navigateToFolder('')} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" /> Root
              </Link>
              {breadcrumbs.map((folder, index) => {
                const routeTo = breadcrumbs.slice(0, index + 1).join('/');
                const isLast = index === breadcrumbs.length - 1;
                return isLast ? (
                  <Typography key={routeTo} color="text.primary" sx={{ fontWeight: 600 }}>{folder}</Typography>
                ) : (
                  <Link key={routeTo} underline="hover" color="inherit" onClick={() => navigateToFolder(routeTo)} sx={{ cursor: 'pointer' }}>{folder}</Link>
                );
              })}
            </Breadcrumbs>
          </Box>

          <Box sx={{ flexGrow: 1, p: 3, overflowY: 'auto' }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>
            ) : (
              <Grid container spacing={2}>
                
                {/* Folders */}
                {folders.map(folder => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={folder.path}>
                    <Card elevation={0} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: '12px', bgcolor: 'background.paper', position: 'relative' }}>
                      <IconButton size="small" sx={{ position: 'absolute', top: 4, right: 4, zIndex: 1 }} onClick={(e) => handleMenuClick(e, folder, true)}>
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" sx={{ position: 'absolute', top: 4, left: 4, zIndex: 1 }} onClick={(e) => { e.stopPropagation(); togglePin(folder.path); }}>
                        {pinnedFolders.includes(folder.path) ? <StarIcon fontSize="small" color="warning" /> : <StarBorderIcon fontSize="small" color="disabled" />}
                      </IconButton>
                      <CardActionArea onClick={() => navigateToFolder(folder.path)} sx={{ p: 2, pt: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <FolderIcon sx={{ fontSize: 50, color: '#fbbc04', mb: 1 }} />
                        <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'center' }} noWrap>{folder.name}</Typography>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}

                {/* Files */}
                {files.map(file => {
                  const nameParts = (file.public_id || '').split('/');
                  const fileName = nameParts[nameParts.length - 1];
                  const isSelected = previewFile?.public_id === file.public_id;
                  
                  return (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={file.public_id}>
                      <Card elevation={0} sx={{ 
                        border: `2px solid ${isSelected ? theme.palette.primary.main : theme.palette.divider}`, 
                        borderRadius: '12px', bgcolor: 'background.paper', position: 'relative',
                        boxShadow: isSelected ? '0 0 10px rgba(11,87,208,0.2)' : 'none'
                      }}>
                        <IconButton size="small" sx={{ position: 'absolute', top: 4, right: 4, zIndex: 1, bgcolor: 'background.paper' }} onClick={(e) => handleMenuClick(e, file, false)}>
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                        <CardActionArea onClick={() => handleItemClick(file)} sx={{ p: 2, pt: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          {file.resource_type === 'image' ? (
                            <Box sx={{ width: '60px', height: '60px', mb: 1, borderRadius: '8px', backgroundImage: `url(${file.secure_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                          ) : (
                            <Box sx={{ mb: 1 }}>{getFileIcon(file.format, file.resource_type)}</Box>
                          )}
                          <Tooltip title={`${fileName}.${file.format}`}>
                            <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'center', width: '100%' }} noWrap>
                              {fileName}.{file.format}
                            </Typography>
                          </Tooltip>
                          <Typography variant="caption" color="text.secondary">{formatSize(file.bytes)}</Typography>
                        </CardActionArea>
                      </Card>
                    </Grid>
                  );
                })}

                {!loading && folders.length === 0 && files.length === 0 && (
                  <Box sx={{ width: '100%', textAlign: 'center', py: 10 }}>
                    <Typography color="text.secondary">This folder is empty.</Typography>
                  </Box>
                )}

              </Grid>
            )}
          </Box>
        </Box>

        {/* RIGHT PANE: Preview Panel */}
        {previewFile && (
          <Box sx={{ width: '320px', minWidth: '320px', borderLeft: `1px solid ${theme.palette.divider}`, bgcolor: theme.palette.mode === 'light' ? '#f8f9fa' : 'background.paper', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 1.5, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Preview</Typography>
              <IconButton size="small" onClick={() => setPreviewFile(null)}><CloseIcon fontSize="small" /></IconButton>
            </Box>
            
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', p: 2, overflow: 'hidden' }}>
              
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <IconButton size="small" onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))}><ZoomOutIcon /></IconButton>
                <IconButton size="small" onClick={() => setZoomLevel(1)}><RestartAltIcon /></IconButton>
                <IconButton size="small" onClick={() => setZoomLevel(z => Math.min(3, z + 0.25))}><ZoomInIcon /></IconButton>
              </Box>

              <Box sx={{ flexGrow: 1, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'auto', bgcolor: theme.palette.background.default, borderRadius: '12px', border: `1px solid ${theme.palette.divider}` }}>
                <img 
                  src={previewFile.secure_url} 
                  alt="Preview" 
                  style={{ 
                    transform: `scale(${zoomLevel})`, 
                    transformOrigin: 'center center',
                    transition: 'transform 0.2s ease-in-out',
                    maxWidth: '100%',
                    objectFit: 'contain'
                  }} 
                />
              </Box>

              <Box sx={{ mt: 3, width: '100%' }}>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5, wordBreak: 'break-all' }}>
                  {previewFile.public_id?.split('/')?.pop()}.{previewFile.format}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">Format: {previewFile.format?.toUpperCase()}</Typography>
                <Typography variant="caption" color="text.secondary" display="block">Size: {formatSize(previewFile.bytes)}</Typography>
                <Typography variant="caption" color="text.secondary" display="block">Created: {new Date(previewFile.created_at).toLocaleDateString()}</Typography>
                <Button variant="outlined" size="small" fullWidth sx={{ mt: 2, borderRadius: '100px' }} onClick={() => window.open(previewFile.secure_url, '_blank')}>Open Full Size</Button>
              </Box>

            </Box>
          </Box>
        )}

      </Paper>

      {/* Context Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose} PaperProps={{ sx: { borderRadius: '12px', minWidth: 150 } }}>
        {!isFolderMenu && <MenuItem onClick={handleView}>View Full Size</MenuItem>}
        <MenuItem onClick={handleDownload}>Download {isFolderMenu ? 'Folder (Zip)' : 'File'}</MenuItem>
        <MenuItem onClick={openRenameDialog}>Rename</MenuItem>
        <MenuItem onClick={triggerDelete} sx={{ color: 'error.main' }}>Delete</MenuItem>
      </Menu>

      {/* Rename Dialog */}
      <Dialog open={renameDialog} onClose={() => setRenameDialog(false)} PaperProps={{ sx: { borderRadius: '24px', minWidth: '320px' } }}>
        <DialogTitle sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 600 }}>Rename {isFolderMenu ? 'Folder' : 'File'}</DialogTitle>
        <DialogContent sx={{ pt: '10px !important' }}>
          <TextField autoFocus fullWidth variant="outlined" value={newName} onChange={(e) => setNewName(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setRenameDialog(false)} color="inherit">Cancel</Button>
          <Button onClick={handleRename} variant="contained" disableElevation disabled={renaming}>
            {renaming ? 'Saving...' : 'Rename'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialog} onClose={() => !deleting && setDeleteDialog(false)} PaperProps={{ sx: { borderRadius: '24px', p: 1, minWidth: '320px' } }}>
        <DialogTitle sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 600, color: 'error.main' }}>
          Delete {isFolderMenu ? 'Folder' : 'File'}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.primary', mt: 1 }}>
            Are you sure you want to permanently delete <strong>{isFolderMenu ? selectedItem?.name : selectedItem?.public_id?.split('/')?.pop()}</strong>?
            {isFolderMenu && <Typography color="error.main" sx={{ mt: 1, display: 'block', fontWeight: 600 }}>Warning: All files inside will be permanently lost.</Typography>}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialog(false)} color="inherit" disabled={deleting} sx={{ px: 3 }}>
            Cancel
          </Button>
          <Button onClick={executeDelete} variant="contained" color="error" disableElevation disabled={deleting} sx={{ px: 3, borderRadius: '100px' }}>
            {deleting ? 'Deleting...' : 'Yes, Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.type} variant="filled" sx={{ borderRadius: '12px', width: '100%', fontFamily: '"Google Sans", sans-serif' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
