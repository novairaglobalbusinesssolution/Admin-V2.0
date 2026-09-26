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
    const { smtp_id, receiver_email, app_data } = req.body;
    if (!smtp_id || !receiver_email) {
      return res.status(400).json({ error: 'Missing SMTP config or Receiver Email' });
    }

    // Fetch SMTP from Supabase
    const { data: smtpData, error: smtpErr } = await supabase
        .from('smtp_settings')
        .select('*')
        .eq('id', smtp_id)
        .single();
        
    if (smtpErr || !smtpData) throw new Error('SMTP Configuration not found in database');

    // Configure nodemailer
    const transporter = nodemailer.createTransport({
        host: smtpData.host,
        port: smtpData.port,
        secure: smtpData.port === 465 || smtpData.encryption === 'SSL',
        auth: {
            user: smtpData.username,
            pass: smtpData.password,
        },
    });

    // Email Content
    const mailOptions = {
        from: `"${smtpData.sender_name}" <${smtpData.sender_email}>`,
        to: receiver_email,
        subject: `Live Checking Update: ${app_data.app_name}`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #0b57d0;">App Live Checking Notification</h2>
                <p>Hello,</p>
                <p>This is an automated notification regarding the app <strong>${app_data.app_name}</strong>.</p>
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px; max-width: 500px;">
                    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Task ID:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">#${app_data.task_id}</td></tr>
                    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>App Name:</strong></td><td style="padding: 8px; border: 1px solid #ddd;"><a href="${app_data.app_package}" style="color: #0b57d0; text-decoration: none; font-weight: bold;">${app_data.app_name}</a></td></tr>
                    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Package/Link:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${app_data.app_package}</td></tr>
                    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>App Date:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${app_data.app_date}</td></tr>
                    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Live Checking Date:</strong></td><td style="padding: 8px; border: 1px solid #ddd; color: #d93025; font-weight: bold;">${app_data.live_checking_date}</td></tr>
                </table>
                <p style="margin-top: 20px;">Please ensure everything is on track for the live checking phase today.</p>
                <p>Best regards,<br/><strong>${smtpData.sender_name}</strong></p>
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
