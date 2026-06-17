import '../env';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Send email verification link
export const sendVerificationEmail = async (email: string, name: string, token: string): Promise<void> => {
  const verifyUrl = `${process.env.APP_URL}/api/v1/auth/verify-email?token=${token}`;

  await transporter.sendMail({
    from: `"InternConnect" <${process.env.FROM_EMAIL}>`,
    to: email,
    subject: 'Verify your InternConnect email',
    html: `
      <h2>Welcome to InternConnect, ${name}!</h2>
      <p>Please verify your email address by clicking the button below:</p>
      <a href="${verifyUrl}" style="
        background-color: #4F46E5;
        color: white;
        padding: 12px 24px;
        text-decoration: none;
        border-radius: 6px;
        display: inline-block;
        margin: 16px 0;
      ">Verify Email</a>
      <p>Or copy this link: ${verifyUrl}</p>
      <p>This link expires in 24 hours.</p>
      <p>If you didn't create an account, ignore this email.</p>
    `,
  });
};

// Send password reset OTP
export const sendPasswordResetEmail = async (email: string, name: string, otp: string): Promise<void> => {
  await transporter.sendMail({
    from: `"InternConnect" <${process.env.FROM_EMAIL}>`,
    to: email,
    subject: 'Reset your InternConnect password',
    html: `
      <h2>Password Reset Request</h2>
      <p>Hi ${name},</p>
      <p>You requested to reset your password. Use this OTP code:</p>
      <div style="
        font-size: 36px;
        font-weight: bold;
        letter-spacing: 8px;
        color: #4F46E5;
        text-align: center;
        padding: 24px;
        background: #F3F4F6;
        border-radius: 8px;
        margin: 16px 0;
      ">${otp}</div>
      <p>This OTP expires in <strong>10 minutes</strong>.</p>
      <p>If you didn't request this, ignore this email.</p>
    `,
  });
};