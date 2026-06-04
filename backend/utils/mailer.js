const nodemailer = require('nodemailer');

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

const sendPasswordResetEmail = async ({ to, name, resetLink }) => {
  const fromName = process.env.SMTP_FROM_NAME || 'BrightHorizon Supplier';
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject: 'Password Reset Request',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
        <h2 style="color:#1d4ed8">Password Reset Request</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>We received a request to reset your password. Click the button below to proceed. This link expires in <strong>15 minutes</strong>.</p>
        <div style="text-align:center;margin:24px 0">
          <a href="${resetLink}" style="background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Reset Password</a>
        </div>
        <p>Or copy this link into your browser:</p>
        <p style="word-break:break-all;color:#4b5563">${resetLink}</p>
        <hr style="margin-top:24px;border:none;border-top:1px solid #e5e7eb"/>
        <p style="font-size:12px;color:#6b7280">If you did not request a password reset, please ignore this email.</p>
      </div>
    `,
  });
};

module.exports = { generateRandomPassword, sendDealerApprovalEmail, sendPasswordResetEmail };
