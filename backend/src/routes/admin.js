const express = require('express');
const router = express.Router();
const { prisma } = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

/**
 * @route   GET /api/admin/users
 * @desc    List all users on the platform (Admin only)
 * @access  Private (Admin)
 */
router.get('/users', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        fullName: true,
        isVerified: true,
        isBanned: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/admin/users/:id/ban
 * @desc    Ban or unban a user (Admin only)
 * @access  Private (Admin)
 */
router.put('/users/:id/ban', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isBanned } = req.body;

    if (isBanned === undefined) {
      return res.status(400).json({ error: 'Field isBanned is required (true/false).' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ error: 'Admins cannot be banned.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isBanned },
      select: {
        id: true,
        email: true,
        role: true,
        fullName: true,
        isBanned: true,
      },
    });

    // If banning, revoke all their active sessions (refresh tokens) from the database
    if (isBanned) {
      await prisma.refreshToken.deleteMany({
        where: { userId: id },
      });
      console.log(`[Admin] Revoked all active sessions for banned user ${user.email}`);
    }

    res.status(200).json({
      message: `User has been successfully ${isBanned ? 'banned' : 'unbanned'}.`,
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
