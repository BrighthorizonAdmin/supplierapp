const nodemailer = require('nodemailer');

/**
 * Ledger-module-local mail transport.
 *
 * Deliberately separate from utils/mailer.js so that shared file is not
 * modified. It reuses the exact same SMTP_* environment variables, so no new
 * configuration is required.
 */

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.office365.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
};

/**
 * Send a payment-ledger statement / reminder email to a dealer.
 * Returns { ok, error }. Never throws.
 */
const sendLedgerEmail = async ({ to, subject, html, text }) => {
  if (!to) return { ok: false, error: 'Dealer has no email address on file' };
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return { ok: false, error: 'SMTP_USER / SMTP_PASS not configured' };
  }

  const fromName = process.env.SMTP_FROM_NAME || 'Buvvas Supplier';
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

  try {
    await getTransporter().sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      text,
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error('[ledger.mailer] send failed:', err.message);
    return { ok: false, error: err.message };
  }
};

module.exports = { sendLedgerEmail };
