const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { prisma } = require('../config/db');
const { sendVerificationEmail, sendPasswordResetEmail, sendOtpEmail } = require('../services/email');

const JWT_SECRET = process.env.JWT_SECRET || 'taskforge-access-token-secret-key-1234';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'taskforge-refresh-token-secret-key-5678';

// Helpers
function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id, jti: crypto.randomBytes(16).toString('hex') },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * @route   POST /api/auth/register
 * @desc    Register a new client or freelancer
 * @access  Public
 */
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, role, fullName } = req.body;

    if (!email || !password || !role || !fullName) {
      return res.status(400).json({ error: 'All fields (email, password, role, fullName) are required.' });
    }

    if (role !== 'client' && role !== 'freelancer') {
      return res.status(400).json({ error: 'Invalid role. Role must be client or freelancer.' });
    }

    const trimmedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({ where: { email: trimmedEmail } });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email address already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.pendingUser.deleteMany({ where: { email: trimmedEmail } });
    const pendingUser = await prisma.pendingUser.create({
      data: {
        email: trimmedEmail,
        fullName,
        passwordHash,
        role,
        otp,
        expiresAt,
      },
    });

    // Send verification OTP via email
    let emailSent = true;
    try {
      await sendOtpEmail(trimmedEmail, otp);
    } catch (err) {
      console.error('[Register] Failed to send OTP email:', err);
      emailSent = false;
    }

    res.status(201).json({
      message: emailSent
        ? 'Registration initiated! Please check your email for the OTP.'
        : 'Registration initiated! OTP email could not be sent, but you can verify using the fallback OTP below.',
      email: trimmedEmail,
      otp, // Fallback OTP returned so frontend can display it in the UI
      userId: pendingUser.id,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify pending registration using OTP and finalize user creation
 * @access  Public
 */
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required.' });
    }

    const trimmedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({ where: { email: trimmedEmail } });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email address already exists.' });
    }

    const pendingUser = await prisma.pendingUser.findUnique({
      where: { email: trimmedEmail },
    });

    if (!pendingUser) {
      return res.status(400).json({ error: 'No pending registration found for this email address.' });
    }

    if (pendingUser.expiresAt < new Date()) {
      await prisma.pendingUser.delete({ where: { id: pendingUser.id } }).catch(() => {});
      return res.status(400).json({ error: 'OTP has expired. Please register again.' });
    }

    if (pendingUser.otp !== otp.trim()) {
      return res.status(400).json({ error: 'Invalid OTP.' });
    }

    // Create verified user
    const user = await prisma.user.create({
      data: {
        id: pendingUser.id,
        email: pendingUser.email,
        fullName: pendingUser.fullName,
        passwordHash: pendingUser.passwordHash,
        role: pendingUser.role,
        isVerified: true,
      },
    });

    // Delete pending record
    await prisma.pendingUser.delete({ where: { id: pendingUser.id } }).catch(() => {});

    // Log the user in directly (return tokens)
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Save refresh token to DB
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 7); // 7 days expiration

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: tokenExpiresAt,
      },
    });

    res.status(200).json({
      message: 'Email address verified and account created successfully!',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify email using verification token
 * @access  Public
 */
router.post('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required.' });
    }

    const user = await prisma.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token.' });
    }

    // Mark user verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null,
      },
    });

    res.status(200).json({ message: 'Email address verified successfully! You can now log in.' });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Log in user, return access token + refresh token
 * @access  Public
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check ban status
    if (user.isBanned) {
      return res.status(403).json({ error: 'Your account has been banned.' });
    }

    // Check verification status
    if (!user.isVerified) {
      return res.status(403).json({ error: 'Please verify your email address before logging in.' });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Create tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Save refresh token to DB
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    res.status(200).json({
      message: 'Logged in successfully.',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auth/refresh
 * @desc    Get new access token using a valid refresh token
 * @access  Public
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required.' });
    }

    // Check if refresh token exists in DB
    const savedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!savedToken) {
      return res.status(401).json({ error: 'Invalid or revoked refresh token.' });
    }

    if (savedToken.expiresAt < new Date()) {
      // Delete expired token
      await prisma.refreshToken.delete({ where: { id: savedToken.id } });
      return res.status(401).json({ error: 'Expired refresh token. Please log in again.' });
    }

    if (savedToken.user.isBanned) {
      return res.status(403).json({ error: 'User is banned.' });
    }

    // Verify token structure/signature
    try {
      jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid refresh token.' });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(savedToken.user);

    res.status(200).json({
      accessToken: newAccessToken,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Revoke refresh token (log out)
 * @access  Public (client-side deletes JWT, backend deletes refresh token)
 */
router.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required for logout.' });
    }

    // Delete token if exists
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });

    res.status(200).json({ message: 'Logged out successfully.' });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Generate password reset token and send email
 * @access  Public
 */
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Verify if user email exists
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email address.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour validity

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpires,
      },
    });

    const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
    await sendPasswordResetEmail(user.email, resetToken, origin);

    res.status(200).json({ message: 'A password reset link has been sent to your email address.' });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password using reset token
 * @access  Public
 */
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Reset token and new password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpires: null,
      },
    });

    // Revoke all existing refresh tokens for security
    await prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    });

    res.status(200).json({ message: 'Password has been reset successfully! You can now log in with your new password.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
