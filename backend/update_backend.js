const fs = require('fs');

const path = "D:/Novaira_Upgrade/novaira_v2_admin/backend/index.js";
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('nodemailer')) {
    content = "const nodemailer = require('nodemailer');\n" + content;
}

const otpRoute = `
// Send OTP via Zoho SMTP (reads from smtp_settings table)
app.post('/api/send-otp', async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
        return res.status(400).json({ error: 'Missing email or otp' });
    }

    try {
        // Fetch default SMTP settings from Supabase
        const { data: smtpData, error: smtpErr } = await supabase
            .from('smtp_settings')
            .select('*')
            .eq('is_default', true)
            .single();

        if (smtpErr || !smtpData) {
            console.error("SMTP Fetch Error:", smtpErr);
            return res.status(500).json({ error: 'SMTP settings not found in database' });
        }

        // Create Nodemailer transporter
        const transporter = nodemailer.createTransport({
            host: smtpData.host,
            port: smtpData.port,
            secure: smtpData.port === 465 || smtpData.encryption === 'SSL',
            auth: {
                user: smtpData.username,
                pass: smtpData.password,
            },
        });

        // Send Email
        const mailOptions = {
            from: \`"\${smtpData.sender_name}" <\${smtpData.sender_email}>\`,
            to: email,
            subject: 'Novaira Login/Registration OTP',
            text: \`Your OTP for Novaira is: \${otp}. It is valid for 10 minutes. Please do not share this with anyone.\`,
            html: \`
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; margin: 0 auto; border: 1px solid #ddd; border-radius: 10px;">
                    <h2 style="color: #4CAF50; text-align: center;">Novaira Verification</h2>
                    <p style="font-size: 16px; color: #333;">Hello,</p>
                    <p style="font-size: 16px; color: #333;">Your One-Time Password (OTP) for login/registration is:</p>
                    <div style="text-align: center; margin: 20px 0;">
                        <span style="font-size: 24px; font-weight: bold; background: #f4f4f4; padding: 10px 20px; border-radius: 8px; letter-spacing: 5px;">\${otp}</span>
                    </div>
                    <p style="font-size: 14px; color: #666;">This OTP is valid for 10 minutes. Please do not share it with anyone.</p>
                </div>
            \`
        };

        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'OTP sent successfully via Zoho' });
    } catch (error) {
        console.error("OTP Send Error:", error);
        res.status(500).json({ error: 'Failed to send email: ' + error.message });
    }
});
`;

if (!content.includes('/api/send-otp')) {
    content += "\n" + otpRoute;
    fs.writeFileSync(path, content, 'utf8');
}
