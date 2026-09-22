import { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Grid, Button, CircularProgress, Chip, 
  Divider, useTheme, Card, Table, TableBody, TableCell, TableHead, TableRow, TableContainer
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PrintIcon from '@mui/icons-material/Print';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import EmailIcon from '@mui/icons-material/Email';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return <div style={{padding: 20, color: 'red'}}><h1>Something went wrong.</h1><pre>{this.state.error.toString()}</pre></div>;
    }
    return this.props.children;
  }
}

function ViewInvoiceInner() {
  const { invoiceId } = useParams();
  const theme = useTheme();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState(null);
  const [client, setClient] = useState(null);

  useEffect(() => {
    fetchInvoiceDetails();
  }, [invoiceId]);

  const fetchInvoiceDetails = async () => {
    try {
      const { data: invData, error: invErr } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();
      
      if (invErr) throw invErr;
      setInvoice(invData);

      if (invData.client_id) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('*')
          .eq('client_id', invData.client_id)
          .single();
        setClient(clientData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <Box sx={{ p: 5, textAlign: 'center' }}><CircularProgress /></Box>;
  if (!invoice) return <Box sx={{ p: 5, textAlign: 'center' }}><Typography>Invoice not found.</Typography></Box>;

  const cSym = invoice.currency === 'USD' ? '$' : '₹';
  const surfaceContainer = theme.palette.mode === 'light' ? '#F7F2FA' : '#1D1B20';
  const isPaid = (invoice.status || 'Pending').toLowerCase() === 'paid';
  const itemsArray = Array.isArray(invoice.items_json) ? invoice.items_json : (typeof invoice.items_json === 'string' ? JSON.parse(invoice.items_json || '[]') : []);

  return (
    <Box>
      {/* -------------------- WEB UI (NO PRINT) -------------------- */}
      <Box sx={{ p: { xs: 1, md: 3 }, pb: 10, maxWidth: 1400, mx: 'auto' }} className="no-print">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Button 
            startIcon={<ArrowBackIcon />} 
            onClick={() => navigate(-1)}
            sx={{ borderRadius: '100px' }}
            color="inherit"
          >
            Back
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button 
              variant="outlined" 
              startIcon={<ContentCopyIcon />} 
              sx={{ borderRadius: '100px' }}
              onClick={() => {
                const link = 'https://payments.novairasolution.com/#/pay/' + invoiceId;
                navigator.clipboard.writeText(link);
                alert('Payment Link Copied to Clipboard!');
              }}
            >
              Copy Payment Link
            </Button>
            <Button variant="outlined" startIcon={<EmailIcon />} sx={{ borderRadius: '100px' }}>Send Reminder</Button>
            <Button variant="outlined" startIcon={<EditIcon />} sx={{ borderRadius: '100px' }}>Edit</Button>
            <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint} sx={{ borderRadius: '100px', boxShadow: '0 4px 14px rgba(13,110,253,0.3)' }}>Print / PDF</Button>
          </Box>
        </Box>

        <Grid container spacing={3}>
          {/* Left Column - Main Invoice */}
          <Grid item xs={12} lg={8}>
            <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: '24px', border: `1px solid ${theme.palette.divider}`, bgcolor: theme.palette.mode === 'light' ? '#fff' : 'background.paper' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 5 }}>
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 900, color: 'primary.main', mb: 1 }}>INVOICE</Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.secondary', fontFamily: 'monospace' }}>#{invoice.invoice_id}</Typography>
                  <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                    <Typography variant="body2" color="text.secondary">Generated: <b>{new Date(invoice.created_at).toLocaleDateString()}</b></Typography>
                    {invoice.due_date && <Typography variant="body2" color="text.secondary">Due: <b>{new Date(invoice.due_date).toLocaleDateString()}</b></Typography>}
                  </Box>
                </Box>
                <Chip label={(invoice.status || 'Pending').toUpperCase()} color={isPaid ? 'success' : 'warning'} sx={{ fontWeight: 800, px: 1, borderRadius: '8px' }} />
              </Box>

              <Grid container spacing={4} sx={{ mb: 5 }}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="overline" color="text.disabled" sx={{ fontWeight: 800 }}>Billed By</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>Novaira Global Solutions</Typography>
                  <Typography variant="body2" color="text.secondary">support@novairasolution.com</Typography>
                  <Typography variant="body2" color="text.secondary">Website: novairasolution.com</Typography>
                  {invoice.gst_details_json?.company_gstin && <Typography variant="body2" color="text.secondary">GSTIN: {invoice.gst_details_json.company_gstin}</Typography>}
                  {invoice.company_pan && <Typography variant="body2" color="text.secondary">PAN: {invoice.company_pan}</Typography>}
                </Grid>
                <Grid item xs={12} sm={6} sx={{ textAlign: { sm: 'right' } }}>
                  <Typography variant="overline" color="text.disabled" sx={{ fontWeight: 800 }}>Billed To</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>{client?.name || 'Unknown Client'}</Typography>
                  {client?.email && <Typography variant="body2" color="text.secondary">{client.email}</Typography>}
                  {client?.phone && <Typography variant="body2" color="text.secondary">{client.phone}</Typography>}
                  {invoice.gst_details_json?.client_gstin && <Typography variant="body2" color="text.secondary">GSTIN: {invoice.gst_details_json.client_gstin}</Typography>}
                </Grid>
              </Grid>

              <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Service Breakdown</Typography>
              <TableContainer sx={{ mb: 4, borderRadius: '12px', overflow: 'hidden', border: `1px solid ${theme.palette.divider}` }}>
                <Table>
                  <TableHead sx={{ bgcolor: surfaceContainer }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Rate</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Qty</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {itemsArray.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell sx={{ fontWeight: 600 }}>{item.name}</TableCell>
                        <TableCell>{cSym}{Number(item.rate).toFixed(2)}</TableCell>
                        <TableCell>{item.qty}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{cSym}{(Number(item.rate) * Number(item.qty)).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 5 }}>
                <Box sx={{ minWidth: 250 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography color="text.secondary">Subtotal</Typography>
                    <Typography sx={{ fontWeight: 600 }}>{cSym}{Number(invoice.subtotal).toFixed(2)}</Typography>
                  </Box>
                  {Number(invoice.discount) > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography color="text.secondary">Discount</Typography>
                      <Typography sx={{ fontWeight: 600, color: 'success.main' }}>-{cSym}{Number(invoice.discount).toFixed(2)}</Typography>
                    </Box>
                  )}
                  {Number(invoice.tax_amount) > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography color="text.secondary">Tax</Typography>
                      <Typography sx={{ fontWeight: 600 }}>+{cSym}{Number(invoice.tax_amount).toFixed(2)}</Typography>
                    </Box>
                  )}
                  {Number(invoice.tds_amount) > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography color="text.secondary">TDS ({invoice.tds_percentage}%)</Typography>
                      <Typography sx={{ fontWeight: 600, color: 'error.main' }}>-{cSym}{Number(invoice.tds_amount).toFixed(2)}</Typography>
                    </Box>
                  )}
                  <Divider sx={{ my: 1.5 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>Final Payable</Typography>
                    <Typography sx={{ fontWeight: 900, fontSize: '1.2rem', color: 'primary.main' }}>{cSym}{Number(invoice.net_payable).toFixed(2)}</Typography>
                  </Box>
                </Box>
              </Box>

              <Box sx={{ bgcolor: surfaceContainer, p: 3, borderRadius: '16px' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Notes & Terms:</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {invoice.notes || 'Thank you for your business!'}
                </Typography>
                {Number(invoice.tds_percentage) > 0 && (
                  <>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, mt: 2, mb: 1 }}>Tax & Compliance (TDS):</Typography>
                    <Typography variant="body2" color="text.secondary">
                      TDS, if applicable, shall be deducted by the client as per the applicable provisions of the Income-tax Act, 1961.
                    </Typography>
                  </>
                )}
              </Box>
            </Paper>
          </Grid>

          {/* Right Column - Timeline */}
          <Grid item xs={12} lg={4}>
            <Card elevation={0} sx={{ p: 3, borderRadius: '24px', border: `1px solid ${theme.palette.divider}`, bgcolor: isPaid ? (theme.palette.mode === 'light' ? 'success.50' : 'rgba(46,125,50,0.1)') : surfaceContainer, mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Payment Summary</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography color="text.secondary" variant="body2">Invoice Total</Typography>
                <Typography sx={{ fontWeight: 700 }} variant="body2">{cSym}{Number(invoice.grand_total).toFixed(2)}</Typography>
              </Box>
              <Divider sx={{ my: 1.5, borderColor: isPaid ? 'success.light' : 'divider' }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: isPaid ? 'success.main' : 'text.primary' }}>
                  {isPaid ? 'Amount Paid' : 'Net Payable'}
                </Typography>
                <Typography sx={{ fontWeight: 900, fontSize: '1.2rem', color: isPaid ? 'success.main' : 'primary.main' }}>
                  {cSym}{Number(invoice.net_payable).toFixed(2)}
                </Typography>
              </Box>
              {isPaid && (
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                  <Chip label="PAID IN FULL" color="success" sx={{ fontWeight: 800, borderRadius: '100px', px: 2 }} />
                </Box>
              )}
            </Card>
            
            {/* Activity Timeline */}
            <Card elevation={0} sx={{ p: 3, borderRadius: '24px', border: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Activity Timeline</Typography>
              <Box sx={{ pl: 2, borderLeft: `2px solid ${theme.palette.divider}`, position: 'relative' }}>
                
                <Box sx={{ mb: 3, position: 'relative' }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'primary.main', position: 'absolute', left: -23, top: 4, border: `2px solid ${theme.palette.background.paper}` }} />
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Invoice Generated</Typography>
                  <Typography variant="caption" color="text.secondary">{new Date(invoice.created_at).toLocaleString()}</Typography>
                </Box>

                {isPaid && (
                  <Box sx={{ mb: 1, position: 'relative' }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'success.main', position: 'absolute', left: -23, top: 4, border: `2px solid ${theme.palette.background.paper}` }} />
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main' }}>Payment Received</Typography>
                    <Typography variant="caption" color="text.secondary">Amount: {cSym}{Number(invoice.net_payable).toFixed(2)}</Typography>
                  </Box>
                )}

              </Box>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* -------------------- PRINT ONLY AUTHENTIC INVOICE FORMAT -------------------- */}
      <div className="print-only">
        <div className="print-header">
          <div>
            <div className="invoice-title">INVOICE</div>
            <div className="invoice-subtitle">#{invoice.invoice_id}</div>
          </div>
          <div className="company-details">
            <h2>Novaira Global Solutions</h2>
            <p>support@novairasolution.com</p>
            <p>novairasolution.com</p>
            {invoice.gst_details_json?.company_gstin && <p><strong>GSTIN:</strong> {invoice.gst_details_json.company_gstin}</p>}
            {invoice.company_pan && <p><strong>PAN:</strong> {invoice.company_pan}</p>}
          </div>
        </div>
        
        <div className="print-meta">
          <div className="billed-to">
            <p className="meta-label">Billed To</p>
            <h3>{client?.name || 'Unknown Client'}</h3>
            {client?.email && <p>{client.email}</p>}
            {client?.phone && <p>{client.phone}</p>}
            {invoice.gst_details_json?.client_gstin && <p><strong>GSTIN:</strong> {invoice.gst_details_json.client_gstin}</p>}
          </div>
          <div className="invoice-dates">
            <table className="dates-table">
              <tbody>
                <tr>
                  <td className="meta-label">Date of Issue:</td>
                  <td className="meta-value">{new Date(invoice.created_at).toLocaleDateString()}</td>
                </tr>
                {invoice.due_date && (
                  <tr>
                    <td className="meta-label">Due Date:</td>
                    <td className="meta-value">{new Date(invoice.due_date).toLocaleDateString()}</td>
                  </tr>
                )}
                <tr>
                  <td className="meta-label">Status:</td>
                  <td className="meta-value" style={{ color: isPaid ? '#10b981' : '#f59e0b', textTransform: 'uppercase' }}>
                    {(invoice.status || 'Pending')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <table className="print-items-table">
          <thead>
            <tr>
              <th style={{ width: '50%', textAlign: 'left' }}>Description of Services</th>
              <th style={{ width: '15%', textAlign: 'center' }}>Rate</th>
              <th style={{ width: '10%', textAlign: 'center' }}>Qty</th>
              <th style={{ width: '25%', textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {itemsArray.map((item, idx) => (
              <tr key={idx}>
                <td>{item.name}</td>
                <td style={{ textAlign: 'center' }}>{cSym}{Number(item.rate).toFixed(2)}</td>
                <td style={{ textAlign: 'center' }}>{item.qty}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{cSym}{(Number(item.rate) * Number(item.qty)).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="print-totals-box">
          <table className="totals-table">
            <tbody>
              <tr>
                <td className="total-label">Subtotal</td>
                <td className="total-value">{cSym}{Number(invoice.subtotal).toFixed(2)}</td>
              </tr>
              {Number(invoice.discount) > 0 && (
                <tr>
                  <td className="total-label">Discount</td>
                  <td className="total-value" style={{ color: '#10b981' }}>-{cSym}{Number(invoice.discount).toFixed(2)}</td>
                </tr>
              )}
              {Number(invoice.tax_amount) > 0 && (
                <tr>
                  <td className="total-label">Tax</td>
                  <td className="total-value">+{cSym}{Number(invoice.tax_amount).toFixed(2)}</td>
                </tr>
              )}
              {Number(invoice.tds_amount) > 0 && (
                <tr>
                  <td className="total-label">TDS ({invoice.tds_percentage}%)</td>
                  <td className="total-value" style={{ color: '#ef4444' }}>-{cSym}{Number(invoice.tds_amount).toFixed(2)}</td>
                </tr>
              )}
              <tr className="grand-total-row">
                <td className="total-label">Amount Due</td>
                <td className="total-value">{cSym}{Number(invoice.net_payable).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="print-footer">
          <p className="footer-title">Notes & Terms:</p>
          <div className="footer-notes">{invoice.notes || 'Thank you for your business!'}</div>
          
          {Number(invoice.tds_percentage) > 0 && (
            <div className="footer-tds">
              <strong>Tax & Compliance (TDS):</strong> TDS, if applicable, shall be deducted by the client as per the applicable provisions of the Income-tax Act, 1961. The client is requested to deposit the deducted TDS with the Income Tax Department and provide the corresponding TDS certificate.
            </div>
          )}
          <div className="footer-signature">
            This is a computer generated invoice and requires no physical signature.
          </div>
        </div>
      </div>

      <style>{`
        @media screen {
          .print-only { display: none !important; }
        }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; width: 100%; color: #1a1a1a; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
          
          @page { size: A4; margin: 20mm; }
          body { background: #fff; margin: 0; padding: 0; -webkit-print-color-adjust: exact; color-adjust: exact; }
          .MuiDrawer-root, .MuiAppBar-root { display: none !important; }
          main { margin-left: 0 !important; padding: 0 !important; }
          
          .print-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 50px; }
          .invoice-title { font-size: 36px; font-weight: 900; color: #111; letter-spacing: -0.5px; margin-bottom: 4px; }
          .invoice-subtitle { font-size: 16px; color: #6b7280; font-family: monospace; }
          
          .company-details { text-align: right; }
          .company-details h2 { margin: 0 0 5px 0; font-size: 20px; font-weight: 800; color: #111; }
          .company-details p { margin: 2px 0; font-size: 14px; color: #4b5563; }
          
          .print-meta { display: flex; justify-content: space-between; margin-bottom: 50px; }
          .meta-label { text-transform: uppercase; font-size: 11px; font-weight: 700; color: #9ca3af; letter-spacing: 1px; margin: 0 0 8px 0; }
          .billed-to h3 { margin: 0 0 5px 0; font-size: 16px; font-weight: 700; color: #111; }
          .billed-to p { margin: 3px 0; font-size: 14px; color: #4b5563; }
          
          .dates-table { border-collapse: collapse; font-size: 14px; margin-left: auto; }
          .dates-table td { padding: 4px 0; }
          .dates-table .meta-label { padding-right: 20px; text-align: right; margin: 0; }
          .dates-table .meta-value { font-weight: 700; color: #111; text-align: right; }
          
          .print-items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          .print-items-table th { padding: 12px 5px; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
          .print-items-table td { padding: 16px 5px; border-bottom: 1px solid #f3f4f6; color: #1f2937; font-size: 14px; vertical-align: top; }
          
          .print-totals-box { display: flex; justify-content: flex-end; margin-bottom: 50px; }
          .totals-table { width: 350px; border-collapse: collapse; font-size: 14px; }
          .totals-table td { padding: 8px 5px; }
          .total-label { color: #6b7280; }
          .total-value { text-align: right; font-weight: 600; color: #111; }
          .grand-total-row td { padding: 15px 5px 5px 5px; font-size: 18px; font-weight: 800; border-top: 2px solid #111; color: #111; }
          
          .print-footer { margin-top: auto; padding-top: 30px; border-top: 1px solid #e5e7eb; }
          .footer-title { font-weight: 700; font-size: 14px; color: #111; margin: 0 0 8px 0; }
          .footer-notes { font-size: 13px; color: #4b5563; white-space: pre-wrap; line-height: 1.5; margin-bottom: 15px; }
          .footer-tds { font-size: 12px; color: #6b7280; margin-top: 15px; line-height: 1.4; }
          .footer-signature { text-align: center; margin-top: 40px; font-size: 12px; color: #9ca3af; font-style: italic; }
        }
      `}</style>
    
    </Box>
  );
}

export default function ViewInvoice() {
  return <ErrorBoundary><ViewInvoiceInner /></ErrorBoundary>;
}
