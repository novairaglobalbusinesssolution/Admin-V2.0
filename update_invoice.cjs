const fs = require('fs');
let content = fs.readFileSync('D:/Novaira_Upgrade/novaira_v2_admin/frontend/src/pages/UserView.jsx', 'utf8');

const invoicePlaceholder = `<Box sx={{ p: 5, textAlign: 'center', border: \`1px dashed \${theme.palette.divider}\`, borderRadius: '16px' }}>
                  <Typography color="text.secondary">Monthly Invoice Coming Soon...</Typography>
                </Box>`;

const invoiceContent = `
                {data?.billing_cycle?.toLowerCase() !== 'monthly' ? (
                  <Box sx={{ p: 5, textAlign: 'center', border: \`1px dashed \${theme.palette.divider}\`, borderRadius: '16px' }}>
                    <Typography color="text.secondary">Monthly Invoice is only available for users with a Monthly billing cycle.</Typography>
                  </Box>
                ) : (
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>Monthly Invoice Data</Typography>
                    <TableContainer component={Paper} elevation={0} sx={{ border: \`1px solid \${theme.palette.divider}\`, borderRadius: '16px', maxHeight: 600 }}>
                      <Table stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>App Name</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>App ID</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>Total Live Count</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>App Rate</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(() => {
                            const bId = data.bulker_id;
                            const shortBulkerId = bId ? bId.replace('NOVAIRA/BULKER/', '') : '';
                            const longBulkerId = \`NOVAIRA/BULKER/\${shortBulkerId}\`;
                            
                            let grandTotal = 0;
                            const rows = bulkerApps.map(app => {
                              let assigned = app.assigned_bulkers || [];
                              while (typeof assigned === 'string') {
                                try { assigned = JSON.parse(assigned); } catch (e) { break; }
                              }
                              if (!Array.isArray(assigned)) assigned = [];
                              
                              const rateObj = assigned.find(b => {
                                const id = typeof b === 'string' ? b : b.bulker_id;
                                return [bId, shortBulkerId, longBulkerId].includes(id);
                              });
                              const rate = rateObj && typeof rateObj === 'object' ? Number(rateObj.amount || 0) : 0;
                              
                              const appReviews = reviews.filter(r => r.apps?.task_id === app.task_id);
                              // Count approved/live reviews
                              const liveCount = appReviews.filter(r => r.status === 'Approved').length;
                              const total = liveCount * rate;
                              grandTotal += total;

                              return {
                                ...app,
                                rate,
                                liveCount,
                                total
                              };
                            });

                            return (
                              <>
                                {rows.map(row => (
                                  <TableRow key={row.id} hover>
                                    <TableCell sx={{ fontWeight: 600 }}>{row.app_name}</TableCell>
                                    <TableCell sx={{ color: 'primary.main', fontWeight: 600 }}>#{row.task_id}</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 700 }}>{row.liveCount}</TableCell>
                                    <TableCell align="right" sx={{ color: 'success.main', fontWeight: 600 }}>?{row.rate.toFixed(2)}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>?{row.total.toFixed(2)}</TableCell>
                                  </TableRow>
                                ))}
                                {rows.length === 0 && (
                                  <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ p: 4, color: 'text.secondary' }}>No apps assigned yet.</TableCell>
                                  </TableRow>
                                )}
                                <TableRow sx={{ backgroundColor: theme.palette.mode === 'light' ? '#f8f9fa' : 'rgba(255,255,255,0.05)' }}>
                                  <TableCell colSpan={4} align="right" sx={{ fontWeight: 800, fontSize: '1.1rem' }}>Final Grand Total:</TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 900, fontSize: '1.2rem', color: 'primary.main' }}>?{grandTotal.toFixed(2)}</TableCell>
                                </TableRow>
                              </>
                            );
                          })()}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}`;

if (content.includes('Monthly Invoice Coming Soon...')) {
    content = content.replace(invoicePlaceholder, invoiceContent);
    fs.writeFileSync('D:/Novaira_Upgrade/novaira_v2_admin/frontend/src/pages/UserView.jsx', content, 'utf8');
    console.log('Successfully updated Invoice logic.');
} else {
    console.log('Could not find placeholder.');
}
