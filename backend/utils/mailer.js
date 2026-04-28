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
  const loginUrl = process.env.FRONTEND_URL || 'http://localhost:5001';
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
        <a href="${loginUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:8px">Login Now</a>
        <hr style="margin-top:24px;border:none;border-top:1px solid #e5e7eb"/>
        <p style="font-size:12px;color:#6b7280">If you did not apply for a dealership, please ignore this email or contact support.</p>
      </div>
    `,
  });
};

module.exports = { generateRandomPassword, sendDealerApprovalEmail };
