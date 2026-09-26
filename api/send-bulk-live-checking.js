import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { smtp_id, apps } = req.body;
    if (!smtp_id || !apps || !apps.length) {
      return res.status(400).json({ error: 'Missing SMTP config or Apps Data' });
    }

    // Fetch SMTP
    const { data: smtpData, error: smtpErr } = await supabase
        .from('smtp_settings')
        .select('*')
        .eq('id', smtp_id)
        .single();
    if (smtpErr || !smtpData) throw new Error('SMTP Config not found');

    // Fetch Receivers
    const { data: receivers, error: recErr } = await supabase.from('live_list_settings').select('receiver_email');
    if (recErr || !receivers.length) throw new Error('No receivers found in list');

    const receiverEmails = receivers.map(r => r.receiver_email).join(',');

    const transporter = nodemailer.createTransport({
        host: smtpData.host,
        port: smtpData.port,
        secure: smtpData.port === 465 || smtpData.encryption === 'SSL',
        auth: {
            user: smtpData.username,
            pass: smtpData.password,
        },
    });

    const appsRows = apps.map(app => `
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd;">#${app.task_id}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${app.app_name}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${app.app_date}</td>
            <td style="padding: 8px; border: 1px solid #ddd; color: #d93025; font-weight: bold;">${app.live_checking_date}</td>
        </tr>
    `).join('');

    const mailOptions = {
        from: `"${smtpData.sender_name}" <${smtpData.sender_email}>`,
        to: receiverEmails,
        subject: `Daily Live Checking Summary - ${apps.length} Apps`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #0b57d0;">Daily Live Checking Summary</h2>
                <p>Hello,</p>
                <p>There are <strong>${apps.length}</strong> apps scheduled for live checking today.</p>
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                    <tr style="background-color: #f1f3f4;">
                        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Task ID</th>
                        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">App Name</th>
                        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">App Date</th>
                        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Live Date</th>
                    </tr>
                    ${appsRows}
                </table>
                <p style="margin-top: 20px;">Best regards,<br/><strong>${smtpData.sender_name}</strong></p>
            </div>
        `
    };

    const info = await transporter.sendMail(mailOptions);
    res.json({ status: 'success', info });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', error: error.message });
  }
}
