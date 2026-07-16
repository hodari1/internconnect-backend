"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendInterviewEmail = exports.sendPasswordResetEmail = exports.sendVerificationEmail = void 0;
require("../env");
const nodemailer_1 = __importDefault(require("nodemailer"));
const transporter = nodemailer_1.default.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});
// Send email verification link
const sendVerificationEmail = async (email, name, token) => {
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
exports.sendVerificationEmail = sendVerificationEmail;
// Send password reset OTP
const sendPasswordResetEmail = async (email, name, otp) => {
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
exports.sendPasswordResetEmail = sendPasswordResetEmail;
// Send interview invitation email
const sendInterviewEmail = async (email, studentName, jobTitle, companyName, datetime, location, notes) => {
    const formattedDate = datetime.toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    const formattedTime = datetime.toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit',
    });
    await transporter.sendMail({
        from: `"InternConnect" <${process.env.FROM_EMAIL}>`,
        to: email,
        subject: `Interview Scheduled: ${jobTitle} at ${companyName}`,
        html: `
      <h2>Congratulations, ${studentName}! 🎉</h2>
      <p>You have been scheduled for an interview for the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong>.</p>

      <div style="
        background: #F3F4F6;
        border-left: 4px solid #4F46E5;
        padding: 16px 20px;
        margin: 20px 0;
        border-radius: 6px;
      ">
        <p style="margin: 0 0 8px 0;"><strong>📅 Date:</strong> ${formattedDate}</p>
        <p style="margin: 0 0 8px 0;"><strong>🕐 Time:</strong> ${formattedTime}</p>
        ${location ? `<p style="margin: 0 0 8px 0;"><strong>📍 Location:</strong> ${location}</p>` : ''}
      </div>

      ${notes ? `<p><strong>Additional notes from the employer:</strong></p><p>${notes}</p>` : ''}

      <p>Please make sure to be available at the scheduled time. Good luck!</p>
      <p>— The InternConnect Team</p>
    `,
    });
};
exports.sendInterviewEmail = sendInterviewEmail;
