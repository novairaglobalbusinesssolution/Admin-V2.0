import { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, TextField, Button, Grid, Avatar, 
  Snackbar, Alert, CircularProgress, useTheme, Card, CardMedia, CardContent, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, InputAdornment
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import { supabase } from '../supabaseClient';

export default function GiftCards() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState([]);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  
  // Dialog state
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    brand: '',
    image_url: ''
  });

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('gift_cards')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setCards(data || []);
    } catch (err) {
      console.error(err);
      setSnack({ open: true, message: 'Failed to load gift cards', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setFormData({ title: '', description: '', price: '', brand: '', image_url: '' });
    setOpen(true);
  };

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    if (!formData.title || !formData.price) {
      setSnack({ open: true, message: 'Title and Price are required', severity: 'warning' });
      return;
    }
    
    setSaving(true);
    try {
      const { error } = await supabase.from('gift_cards').insert([{
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price),
        brand: formData.brand,
        image_url: formData.image_url,
        status: 'Active'
      }]);

      if (error) throw error;
      
      setSnack({ open: true, message: 'Gift card added successfully!', severity: 'success' });
      setOpen(false);
      fetchCards();
    } catch (err) {
      console.error(err);
      setSnack({ open: true, message: 'Failed to save gift card', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this gift card?')) return;
    try {
      const { error } = await supabase.from('gift_cards').delete().eq('id', id);
      if (error) throw error;
      setSnack({ open: true, message: 'Gift card deleted', severity: 'success' });
      setCards(cards.filter(c => c.id !== id));
    } catch (err) {
      setSnack({ open: true, message: 'Failed to delete gift card', severity: 'error' });
    }
  };

  return (
    <Box sx={{ p: { xs: 1, md: 3 }, pb: 10, maxWidth: 1200, mx: 'auto' }}>
      
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 800 }}>
            Gift Cards (Individuals)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage available gift cards for individual earners.
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={handleOpen}
          sx={{ borderRadius: '100px', px: 3, py: 1, fontWeight: 700 }}
        >
          Add Gift Card
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>
      ) : (
        <Grid container spacing={3}>
          {cards.length === 0 ? (
            <Grid item xs={12}>
              <Paper elevation={0} sx={{ p: 5, textAlign: 'center', borderRadius: '24px', border: `1px solid ${theme.palette.divider}` }}>
                <CardGiftcardIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" fontWeight={700}>No Gift Cards Found</Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>Click the button above to create the first gift card.</Typography>
                <Button variant="outlined" onClick={handleOpen} sx={{ borderRadius: '100px' }}>Add Gift Card</Button>
              </Paper>
            </Grid>
          ) : (
            cards.map(card => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={card.id}>
                <Card elevation={0} sx={{ borderRadius: '24px', border: `1px solid ${theme.palette.divider}`, height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                  <IconButton 
                    size="small" 
                    onClick={() => handleDelete(card.id)}
                    sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(255,255,255,0.8)', color: 'error.main', '&:hover': { bgcolor: 'error.main', color: '#fff' } }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                  
                  <Box sx={{ height: 140, bgcolor: theme.palette.mode === 'light' ? '#f5f5f5' : '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
                    {card.image_url ? (
                      <Box component="img" src={card.image_url} sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    ) : (
                      <CardGiftcardIcon sx={{ fontSize: 60, color: 'text.disabled' }} />
                    )}
                  </Box>
                  
                  <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 800, textTransform: 'uppercase', mb: 0.5 }}>
                      {card.brand || 'Generic'}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2, mb: 1 }}>
                      {card.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexGrow: 1, fontSize: '0.8rem' }}>
                      {card.description}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 900, color: 'success.main' }}>
                      ₹{parseFloat(card.price).toFixed(2)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      )}

      {/* Add Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '24px', p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Add New Gift Card</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="Gift Card Title" name="title" value={formData.title} onChange={handleChange} fullWidth />
            <TextField label="Brand (e.g. Amazon, Flipkart)" name="brand" value={formData.brand} onChange={handleChange} fullWidth />
            <TextField 
              label="Price Value" 
              name="price" 
              type="number" 
              value={formData.price} 
              onChange={handleChange} 
              fullWidth 
              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} 
            />
            <TextField label="Description" name="description" value={formData.description} onChange={handleChange} fullWidth multiline rows={3} />
            <TextField label="Image URL (Optional)" name="image_url" value={formData.image_url} onChange={handleChange} fullWidth />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)} sx={{ borderRadius: '100px', color: 'text.secondary', fontWeight: 600 }}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} variant="contained" sx={{ borderRadius: '100px', px: 3, fontWeight: 700 }}>
            {saving ? 'Saving...' : 'Add Gift Card'}
          </Button>
        </DialogActions>
      </Dialog>

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
