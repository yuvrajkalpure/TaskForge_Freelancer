const express = require('express');
const router = express.Router();
const { prisma } = require('../config/db');
const { authenticateToken, requireVerified } = require('../middleware/auth');

/**
 * @route   POST /api/reviews
 * @desc    Leave a review for a completed project (Client or Freelancer of the project)
 * @access  Private (Client or Freelancer of the project)
 */
router.post('/', authenticateToken, requireVerified, async (req, res, next) => {
  try {
    const { projectId, rating, comment } = req.body;

    if (!projectId || rating === undefined || !comment) {
      return res.status(400).json({ error: 'Project ID, rating, and comment are required.' });
    }

    const parsedRating = parseInt(rating);
    if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5.' });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Verify project is completed
    if (project.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'You can only leave reviews for COMPLETED projects.' });
    }

    // Determine roles and check authorization
    const isClientReviewer = project.clientId === req.user.id;
    const isFreelancerReviewer = project.freelancerId === req.user.id;

    if (!isClientReviewer && !isFreelancerReviewer) {
      return res.status(403).json({ error: 'Access denied. You were not involved in this project.' });
    }

    // Determine reviewee
    let revieweeId;
    if (isClientReviewer) {
      revieweeId = project.freelancerId;
    } else {
      revieweeId = project.clientId;
    }

    // Check if reviewee exists (e.g. assignee wasn't deleted somehow, though in our design they are linked)
    if (!revieweeId) {
      return res.status(400).json({ error: 'Cannot leave review as no freelancer is assigned to this project.' });
    }

    // Check if this reviewer already reviewed this project
    const existingReview = await prisma.review.findUnique({
      where: {
        projectId_reviewerId: {
          projectId,
          reviewerId: req.user.id,
        },
      },
    });

    if (existingReview) {
      return res.status(400).json({ error: 'You have already submitted a review for this project.' });
    }

    const review = await prisma.review.create({
      data: {
        rating: parsedRating,
        comment,
        projectId,
        reviewerId: req.user.id,
        revieweeId,
      },
    });

    res.status(201).json({
      message: 'Review submitted successfully.',
      review,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
