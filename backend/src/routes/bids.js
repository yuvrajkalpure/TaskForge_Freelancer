const express = require('express');
const router = express.Router();
const { prisma } = require('../config/db');
const { authenticateToken, requireRole, requireVerified } = require('../middleware/auth');

/**
 * @route   POST /api/projects/:id/bids
 * @desc    Place a bid on a project (Freelancer only)
 * @access  Private (Freelancer)
 */
router.post('/projects/:id/bids', authenticateToken, requireRole('freelancer'), requireVerified, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, proposal } = req.body;

    if (amount === undefined || !proposal) {
      return res.status(400).json({ error: 'Bid amount and proposal are required.' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Bid amount must be a positive number.' });
    }

    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (project.status !== 'OPEN') {
      return res.status(400).json({ error: 'You can only place bids on OPEN projects.' });
    }

    // Check if freelancer already placed a bid
    const existingBid = await prisma.bid.findUnique({
      where: {
        projectId_freelancerId: {
          projectId: id,
          freelancerId: req.user.id,
        },
      },
    });

    if (existingBid) {
      return res.status(400).json({ error: 'You have already placed a bid on this project. Please update your existing bid instead.' });
    }

    const bid = await prisma.bid.create({
      data: {
        amount: parsedAmount,
        proposal,
        projectId: id,
        freelancerId: req.user.id,
      },
    });

    res.status(201).json({
      message: 'Bid placed successfully.',
      bid,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/bids/:id
 * @desc    Update a bid (Freelancer owner only)
 * @access  Private (Freelancer Owner)
 */
router.put('/bids/:id', authenticateToken, requireRole('freelancer'), requireVerified, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, proposal } = req.body;

    if (amount === undefined || !proposal) {
      return res.status(400).json({ error: 'Bid amount and proposal are required.' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Bid amount must be a positive number.' });
    }

    const bid = await prisma.bid.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!bid) {
      return res.status(404).json({ error: 'Bid not found.' });
    }

    // Resource ownership check
    if (bid.freelancerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You do not own this bid.' });
    }

    // Project state check
    if (bid.project.status !== 'OPEN') {
      return res.status(400).json({ error: 'You cannot update bids on a project that is no longer OPEN.' });
    }

    const updatedBid = await prisma.bid.update({
      where: { id },
      data: {
        amount: parsedAmount,
        proposal,
      },
    });

    res.status(200).json({
      message: 'Bid updated successfully.',
      bid: updatedBid,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/bids/:id
 * @desc    Retract/delete a bid (Freelancer owner only)
 * @access  Private (Freelancer Owner)
 */
router.delete('/bids/:id', authenticateToken, requireRole('freelancer'), requireVerified, async (req, res, next) => {
  try {
    const { id } = req.params;

    const bid = await prisma.bid.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!bid) {
      return res.status(404).json({ error: 'Bid not found.' });
    }

    // Resource ownership check
    if (bid.freelancerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You do not own this bid.' });
    }

    // Project state check
    if (bid.project.status !== 'OPEN') {
      return res.status(400).json({ error: 'You cannot retract bids on a project that is no longer OPEN.' });
    }

    await prisma.bid.delete({
      where: { id },
    });

    res.status(200).json({
      message: 'Bid retracted successfully.',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
