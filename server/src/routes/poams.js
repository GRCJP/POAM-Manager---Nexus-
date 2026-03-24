// POAM CRUD routes

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize, checkSystemAccess } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

const prisma = new PrismaClient();

// Get all POAMs (filtered by user's systems)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { systemId, status, riskLevel, limit = 100, offset = 0 } = req.query;

    const where = {};

    // Filter by system
    if (systemId) {
      where.systemId = systemId;
    } else {
      // Get user's accessible systems
      if (req.user.role !== 'ADMIN' && req.user.role !== 'EXECUTIVE') {
        const userSystems = await prisma.systemOwner.findMany({
          where: { userId: req.user.id },
          select: { systemId: true }
        });
        where.systemId = { in: userSystems.map(s => s.systemId) };
      } else {
        // Admin/Executive see all systems in their org
        const orgSystems = await prisma.system.findMany({
          where: { organizationId: req.user.organizationId },
          select: { id: true }
        });
        where.systemId = { in: orgSystems.map(s => s.id) };
      }
    }

    // Additional filters
    if (status) where.status = status;
    if (riskLevel) where.riskLevel = riskLevel;

    const poams = await prisma.pOAM.findMany({
      where,
      include: {
        system: { select: { id: true, name: true } },
        assets: true,
        milestones: true,
        _count: { select: { statusHistory: true, comments: true } }
      },
      take: parseInt(limit),
      skip: parseInt(offset),
      orderBy: { createdAt: 'desc' }
    });

    const total = await prisma.pOAM.count({ where });

    res.json({
      poams,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get single POAM by ID
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const poam = await prisma.pOAM.findUnique({
      where: { id },
      include: {
        system: true,
        assets: true,
        milestones: { orderBy: { dueDate: 'asc' } },
        statusHistory: { orderBy: { createdAt: 'desc' }, take: 50 },
        comments: { orderBy: { createdAt: 'desc' } }
      }
    });

    if (!poam) {
      throw new AppError('POAM not found', 404);
    }

    // Check access
    if (req.user.role !== 'ADMIN' && req.user.role !== 'EXECUTIVE') {
      const hasAccess = await prisma.systemOwner.findFirst({
        where: {
          userId: req.user.id,
          systemId: poam.systemId
        }
      });

      if (!hasAccess) {
        throw new AppError('Access denied to this POAM', 403);
      }
    }

    res.json({ poam });
  } catch (error) {
    next(error);
  }
});

// Create new POAM
router.post('/', authenticate, authorize(['ADMIN', 'SYSTEM_OWNER', 'ENGINEER']), async (req, res, next) => {
  try {
    const {
      systemId,
      vulnerabilityName,
      findingDescription,
      riskLevel,
      poc,
      controlFamily,
      scheduledCompletionDate,
      remediationSignature,
      assets = [],
      milestones = []
    } = req.body;

    // Validation
    if (!systemId || !vulnerabilityName || !findingDescription || !riskLevel) {
      throw new AppError('Missing required fields', 400);
    }

    // Check system access
    if (req.user.role !== 'ADMIN') {
      const hasAccess = await prisma.systemOwner.findFirst({
        where: { userId: req.user.id, systemId }
      });

      if (!hasAccess) {
        throw new AppError('You do not have access to this system', 403);
      }
    }

    // Create POAM with related data
    const poam = await prisma.pOAM.create({
      data: {
        systemId,
        vulnerabilityName,
        findingDescription,
        riskLevel,
        poc,
        controlFamily,
        scheduledCompletionDate: scheduledCompletionDate ? new Date(scheduledCompletionDate) : null,
        remediationSignature: remediationSignature || `${systemId}-${Date.now()}`,
        createdById: req.user.id,
        assets: {
          create: assets.map(asset => ({
            assetName: asset.assetName,
            ipv4: asset.ipv4,
            os: asset.os,
            results: asset.results
          }))
        },
        milestones: {
          create: milestones.map(m => ({
            title: m.title,
            description: m.description,
            dueDate: m.dueDate ? new Date(m.dueDate) : null
          }))
        },
        statusHistory: {
          create: {
            action: 'CREATED',
            details: { createdBy: req.user.email },
            changedBy: req.user.email
          }
        }
      },
      include: {
        assets: true,
        milestones: true,
        statusHistory: true
      }
    });

    res.status(201).json({
      message: 'POAM created successfully',
      poam
    });
  } catch (error) {
    next(error);
  }
});

// Update POAM
router.put('/:id', authenticate, authorize(['ADMIN', 'SYSTEM_OWNER', 'ENGINEER']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Get existing POAM
    const existingPoam = await prisma.pOAM.findUnique({
      where: { id }
    });

    if (!existingPoam) {
      throw new AppError('POAM not found', 404);
    }

    // Check access
    if (req.user.role !== 'ADMIN') {
      const hasAccess = await prisma.systemOwner.findFirst({
        where: {
          userId: req.user.id,
          systemId: existingPoam.systemId
        }
      });

      if (!hasAccess) {
        throw new AppError('Access denied to this POAM', 403);
      }
    }

    // Track changes for audit log
    const changes = {};
    const fieldsToTrack = ['status', 'poc', 'riskLevel', 'scheduledCompletionDate', 'mitigation'];
    
    for (const field of fieldsToTrack) {
      if (updates[field] !== undefined && updates[field] !== existingPoam[field]) {
        changes[field] = {
          old: existingPoam[field],
          new: updates[field]
        };
      }
    }

    // Update POAM
    const poam = await prisma.pOAM.update({
      where: { id },
      data: {
        ...updates,
        updatedAt: new Date(),
        statusHistory: Object.keys(changes).length > 0 ? {
          create: {
            action: 'UPDATED',
            details: changes,
            changedBy: req.user.email
          }
        } : undefined
      },
      include: {
        assets: true,
        milestones: true,
        statusHistory: { orderBy: { createdAt: 'desc' }, take: 10 }
      }
    });

    res.json({
      message: 'POAM updated successfully',
      poam
    });
  } catch (error) {
    next(error);
  }
});

// Delete POAM (admin only)
router.delete('/:id', authenticate, authorize(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.pOAM.delete({
      where: { id }
    });

    res.json({ message: 'POAM deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Add milestone to POAM
router.post('/:id/milestones', authenticate, authorize(['ADMIN', 'SYSTEM_OWNER', 'ENGINEER']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, dueDate } = req.body;

    const milestone = await prisma.pOAMMilestone.create({
      data: {
        poamId: id,
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : null
      }
    });

    res.status(201).json({
      message: 'Milestone added successfully',
      milestone
    });
  } catch (error) {
    next(error);
  }
});

// Add comment to POAM
router.post('/:id/comments', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      throw new AppError('Comment content is required', 400);
    }

    const comment = await prisma.pOAMComment.create({
      data: {
        poamId: id,
        content,
        author: req.user.email
      }
    });

    res.status(201).json({
      message: 'Comment added successfully',
      comment
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
