import { Box, Typography, Paper, Grid } from '@mui/material';

export default function PaymentDashboard() {
  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', mt: 1, pb: 10 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ fontFamily: '"Google Sans", sans-serif', fontWeight: 600 }}>
          Payment Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Overview of transactions, wallets, and settings.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: '24px', border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 700 }}>Total Processed</Typography>
            <Typography variant="h4" color="primary" sx={{ fontWeight: 700, mt: 1 }}>₹0.00</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: '24px', border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 700 }}>Pending Withdrawals</Typography>
            <Typography variant="h4" color="warning.main" sx={{ fontWeight: 700, mt: 1 }}>0</Typography>
          </Paper>
        </Grid>
      </Grid>
      
      <Box sx={{ mt: 5, p: 5, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: '24px' }}>
        <Typography color="text.secondary">Select an option from the sidebar to view details.</Typography>
      </Box>
    </Box>
  );
}
