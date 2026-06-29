const nodemailer = require('nodemailer');
const twilio = require('twilio');

const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const generateRandomPassword = () => {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '@#$!';
  const all = upper + lower + digits + special;

  // Guarantee at least one of each required character type
  let password =
    upper[Math.floor(Math.random() * upper.length)] +
    lower[Math.floor(Math.random() * lower.length)] +
    digits[Math.floor(Math.random() * digits.length)] +
    special[Math.floor(Math.random() * special.length)];

  for (let i = 4; i < 12; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle to avoid predictable prefix pattern
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

const sendDealerApprovalEmail = async ({ to, businessName, password }) => {
  const fromName = process.env.SMTP_FROM_NAME || 'BrightHorizon Supplier';
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject: 'Your Dealer Account Has Been Approved – Login Credentials',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
        <h2 style="color:#16a34a">Congratulations! Your Dealer Account is Approved</h2>
        <p>Dear <strong>${businessName}</strong>,</p>
        <p>Your dealership application has been reviewed and <strong>approved</strong>. You can now log in using the credentials below.</p>
        <div style="background:#f9fafb;padding:16px;border-radius:6px;margin:16px 0">
          <p style="margin:4px 0"><strong>Email:</strong> ${to}</p>
          <p style="margin:4px 0"><strong>Temporary Password:</strong> <code style="font-size:16px;letter-spacing:1px">${password}</code></p>
        </div>
        <p style="color:#dc2626"><strong>Important:</strong> Please change your password immediately after your first login.</p>
        <hr style="margin-top:24px;border:none;border-top:1px solid #e5e7eb"/>
        <p style="font-size:12px;color:#6b7280">If you did not apply for a dealership, please ignore this email or contact support.</p>
      </div>
    `,
  });
};

const sendDealerApprovalSMS = async ({ phone, businessName, password }) => {
  if (!phone) {
    console.warn('[SMS] Skipped: dealer has no phone number registered');
    return;
  }

  const accountSid    = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken     = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber    = process.env.TWILIO_PHONE_NUMBER?.trim();
  // Ensure whatsapp: prefix is present regardless of how it's written in .env
  const rawWhatsapp   = process.env.TWILIO_WHATSAPP_NUMBER?.trim();
  const whatsappFrom  = rawWhatsapp
    ? rawWhatsapp.startsWith('whatsapp:') ? rawWhatsapp : `whatsapp:${rawWhatsapp}`
    : null;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('[SMS] Skipped: Twilio credentials not configured in .env');
    return;
  }

  // Normalize to E.164 (+91 for India): strip non-digits, keep last 10, prepend country code
  const digits = phone.replace(/\D/g, '').slice(-10);
  const e164   = `+91${digits}`;

  const client  = twilio(accountSid, authToken);
  const message = `Hi ${businessName}, your BrightHorizon dealer account is approved!\nTemporary Password: ${password}\nPlease log in and change your password immediately.`;

  // Step 1: Try WhatsApp first, then check actual delivery status
  if (whatsappFrom) {
    try {
      const waMsg = await client.messages.create({
        from: whatsappFrom,
        to:   `whatsapp:${e164}`,
        body: message,
      });

      // Wait 4 seconds for Twilio to update the delivery status
      // (sandbox silently fails non-joined numbers — status becomes 'failed'/'undelivered')
      await new Promise(resolve => setTimeout(resolve, 4000));

      const updated = await client.messages(waMsg.sid).fetch();
      console.log(`[WhatsApp] Delivery status for ${e164}: ${updated.status}`);

      if (updated.status === 'sent' || updated.status === 'delivered') {
        console.log(`[WhatsApp] Delivered to ${e164} — skipping SMS`);
        return; // WhatsApp delivered, no SMS needed
      }

      console.warn(`[WhatsApp] Status "${updated.status}" for ${e164} — falling back to SMS`);
    } catch (err) {
      console.warn(`[WhatsApp] Failed (${err.code || err.message}) — falling back to SMS`);
    }
  }

  // Step 2: Fallback to normal SMS
  await client.messages.create({
    from: fromNumber,
    to:   e164,
    body: message,
  });
  console.log(`[SMS] Fallback SMS sent to ${e164}`);
};

module.exports = { generateRandomPassword, sendDealerApprovalEmail, sendDealerApprovalSMS };
