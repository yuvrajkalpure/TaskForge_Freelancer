const express = require('express');
const router = express.Router();
const { prisma } = require('../config/db');
const { authenticateToken, requireRole, requireVerified } = require('../middleware/auth');

/**
 * @route   POST /api/projects
 * @desc    Post a new project (Client only)
 * @access  Private (Client)
 */
router.post('/', authenticateToken, requireRole('client'), requireVerified, async (req, res, next) => {
  try {
    const { title, description, budget } = req.body;

    if (!title || !description || budget === undefined) {
      return res.status(400).json({ error: 'Title, description, and budget are required.' });
    }

    const parsedBudget = parseFloat(budget);
    if (isNaN(parsedBudget) || parsedBudget <= 0) {
      return res.status(400).json({ error: 'Budget must be a positive number.' });
    }

    const project = await prisma.project.create({
      data: {
        title,
        description,
        budget: parsedBudget,
        clientId: req.user.id,
        status: 'OPEN',
      },
    });

    res.status(201).json({
      message: 'Project posted successfully.',
      project,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/projects
 * @desc    List all projects with optional filters
 * @access  Private (All Roles)
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { status, search, myProjects, assignedToMe, biddedByMe } = req.query;

    const where = {};

    // Filter by status
    if (status) {
      if (!['OPEN', 'ASSIGNED', 'DELIVERED', 'COMPLETED'].includes(status.toUpperCase())) {
        return res.status(400).json({ error: 'Invalid status filter.' });
      }
      where.status = status.toUpperCase();
    }

    // Filter by text search
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filter to client's own projects
    if (myProjects === 'true') {
      if (req.user.role !== 'client' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only clients can filter by their own projects.' });
      }
      if (req.user.role === 'client') {
        where.clientId = req.user.id;
      }
    }

    // Filter to freelancer's assigned projects
    if (assignedToMe === 'true') {
      if (req.user.role !== 'freelancer' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only freelancers can filter by assigned projects.' });
      }
      if (req.user.role === 'freelancer') {
        where.freelancerId = req.user.id;
      }
    }

    // Filter to projects where the freelancer has bid
    if (biddedByMe === 'true') {
      if (req.user.role !== 'freelancer' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only freelancers can filter by bidded projects.' });
      }
      where.bids = {
        some: {
          freelancerId: req.user.id
        }
      };
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        client: {
          select: { id: true, fullName: true, email: true },
        },
        freelancer: {
          select: { id: true, fullName: true, email: true },
        },
        _count: {
          select: { bids: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json(projects);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/projects/:id
 * @desc    Get detailed project by ID
 * @access  Private (All Roles)
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        client: {
          select: { id: true, fullName: true, email: true },
        },
        freelancer: {
          select: { id: true, fullName: true, email: true },
        },
        bids: {
          include: {
            freelancer: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
        reviews: true,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Authorization checks for viewing bid list
    // If the user is a freelancer and NOT the assigned freelancer, they can only see their own bid.
    // If the user is client but NOT the project owner, they shouldn't see bids either.
    // Admins can see everything.
    const isOwner = project.clientId === req.user.id;
    const isAdmin = req.user.role === 'admin';
    const isAssigned = project.freelancerId === req.user.id;

    if (!isOwner && !isAdmin) {
      if (req.user.role === 'freelancer') {
        // Filter bids list to only include this freelancer's bid
        project.bids = project.bids.filter(bid => bid.freelancerId === req.user.id);
      } else {
        // Other clients cannot see bids
        project.bids = [];
      }
    }

    res.status(200).json(project);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/projects/:id/accept-bid
 * @desc    Accept a bid and assign project to freelancer (Client only)
 * @access  Private (Client Owner)
 */
router.post('/:id/accept-bid', authenticateToken, requireRole('client'), requireVerified, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { bidId } = req.body;

    if (!bidId) {
      return res.status(400).json({ error: 'Bid ID is required.' });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: { bids: true },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Resource Ownership check
    if (project.clientId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You do not own this project.' });
    }

    if (project.status !== 'OPEN') {
      return res.status(400).json({ error: 'You can only accept bids on OPEN projects.' });
    }

    const bid = project.bids.find(b => b.id === bidId);
    if (!bid) {
      return res.status(404).json({ error: 'Bid not found on this project.' });
    }

    // Update project status and set assignee
    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        status: 'ASSIGNED',
        freelancerId: bid.freelancerId,
      },
      include: {
        freelancer: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    res.status(200).json({
      message: 'Bid accepted and project assigned successfully.',
      project: updatedProject,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/projects/:id/deliver
 * @desc    Mark project work as delivered (Freelancer assignee only)
 * @access  Private (Freelancer Assignee)
 */
router.post('/:id/deliver', authenticateToken, requireRole('freelancer'), requireVerified, async (req, res, next) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Resource Ownership/Assignment check
    if (project.freelancerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You are not assigned to this project.' });
    }

    if (project.status !== 'ASSIGNED') {
      return res.status(400).json({ error: 'You can only deliver work for ASSIGNED projects.' });
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: { status: 'DELIVERED' },
    });

    res.status(200).json({
      message: 'Work marked as delivered successfully.',
      project: updatedProject,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/projects/:id/complete
 * @desc    Mark project as complete (Client owner only)
 * @access  Private (Client Owner)
 */
router.post('/:id/complete', authenticateToken, requireRole('client'), requireVerified, async (req, res, next) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Resource Ownership check
    if (project.clientId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You do not own this project.' });
    }

    if (project.status !== 'DELIVERED' && project.status !== 'ASSIGNED') {
      return res.status(400).json({ error: 'You can only complete projects that are ASSIGNED or DELIVERED.' });
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });

    res.status(200).json({
      message: 'Project marked as completed successfully.',
      project: updatedProject,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
