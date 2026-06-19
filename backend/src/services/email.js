const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@taskforge.com';

let transporter = null;

if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT),
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

/**
 * Send an email (sends real email via SMTP, throws error on failure)
 */
async function sendEmail({ to, subject, html, text }) {
  if (!transporter) {
    throw new Error('SMTP email transporter is not configured. Cannot send email.');
  }

  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      text,
      html,
    });
    console.log(`[Email] Sent email to ${to} via SMTP: "${subject}"`);
  } catch (error) {
    console.error(`[Email] Failed to send SMTP email to ${to}:`, error);
    throw error;
  }
}

/**
 * Send email verification link
 */
async function sendVerificationEmail(email, token, origin) {
  const verifyUrl = `${origin}/verify-email?token=${token}`;
  const html = `
    <h2>Welcome to TaskForge!</h2>
    <p>Thank you for registering. Please click the button below to verify your email address:</p>
    <div style="margin: 25px 0;">
      <a href="${verifyUrl}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Email Address</a>
    </div>
    <p>If you did not register for TaskForge, please ignore this email.</p>
    <p>Or copy and paste this link in your browser:</p>
    <p><a href="${verifyUrl}">${verifyUrl}</a></p>
  `;

  await sendEmail({
    to: email,
    subject: 'Verify your TaskForge Email',
    html,
    text: `Welcome to TaskForge! Verify your email address at: ${verifyUrl}`,
  });
}

/**
 * Send password reset link
 */
async function sendPasswordResetEmail(email, token, origin) {
  const resetUrl = `${origin}/reset-password?token=${token}`;
  const html = `
    <h2>Reset Password Request</h2>
    <p>You requested a password reset for your TaskForge account. Click the button below to reset your password:</p>
    <div style="margin: 25px 0;">
      <a href="${resetUrl}" style="background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
    </div>
    <p>This link is valid for 1 hour. If you did not request a password reset, please ignore this email.</p>
    <p>Or copy and paste this link in your browser:</p>
    <p><a href="${resetUrl}">${resetUrl}</a></p>
  `;

  await sendEmail({
    to: email,
    subject: 'Reset your TaskForge Password',
    html,
    text: `Reset your TaskForge password at: ${resetUrl}`,
  });
}

/**
 * Send OTP verification email
 */
async function sendOtpEmail(email, otp) {
  const html = `
    <h2>Welcome to TaskForge!</h2>
    <p>Thank you for initiating your registration. Please verify your email by entering the following One-Time Password (OTP) in the verification screen:</p>
    <div style="margin: 25px 0;">
      <span style="font-family: monospace; font-size: 2rem; letter-spacing: 4px; font-weight: bold; background: #f1f5f9; padding: 10px 20px; border-radius: 6px; border: 1px solid #cbd5e1; color: #1e293b;">
        ${otp}
      </span>
    </div>
    <p>This code is valid for 15 minutes. If you did not request registration, please ignore this email.</p>
  `;

  await sendEmail({
    to: email,
    subject: 'Your TaskForge Verification OTP',
    html,
    text: `Welcome to TaskForge! Your verification OTP is: ${otp}. This code is valid for 15 minutes.`,
  });
}

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOtpEmail,
};

