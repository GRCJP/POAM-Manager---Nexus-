// System management routes

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

const prisma = new PrismaClient();

// Get all systems (filtered by user's organization and access)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const where = { organizationId: req.user.organizationId };

    // Non-admin/executive users only see systems they own
    if (req.user.role !== 'ADMIN' && req.user.role !== 'EXECUTIVE') {
      const userSystemIds = await prisma.systemOwner.findMany({
        where: { userId: req.user.id },
        select: { systemId: true }
      });
      where.id = { in: userSystemIds.map(s => s.systemId) };
    }

    const systems = await prisma.system.findMany({
      where,
      include: {
        _count: {
          select: { poams: true, workbookItems: true }
        },
        owners: {
          include: {
            user: {
              select: { id: true, email: true, firstName: true, lastName: true }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json({ systems });
  } catch (error) {
    next(error);
  }
});

// Get single system
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const system = await prisma.system.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true } },
        owners: {
          include: {
            user: {
              select: { id: true, email: true, firstName: true, lastName: true, role: true }
            }
          }
        },
        _count: {
          select: { poams: true, scanRuns: true, workbookItems: true, criticalAssets: true }
        }
      }
    });

    if (!system) {
      throw new AppError('System not found', 404);
    }

    // Check access
    if (system.organizationId !== req.user.organizationId) {
      throw new AppError('Access denied to this system', 403);
    }

    if (req.user.role !== 'ADMIN' && req.user.role !== 'EXECUTIVE') {
      const hasAccess = await prisma.systemOwner.findFirst({
        where: { userId: req.user.id, systemId: id }
      });

      if (!hasAccess) {
        throw new AppError('You are not assigned to this system', 403);
      }
    }

    res.json({ system });
  } catch (error) {
    next(error);
  }
});

// Create new system
router.post('/', authenticate, authorize(['ADMIN', 'SYSTEM_OWNER']), async (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      throw new AppError('System name is required', 400);
    }

    const system = await prisma.system.create({
      data: {
        name,
        description,
        organizationId: req.user.organizationId,
        owners: {
          create: {
            userId: req.user.id
          }
        }
      },
      include: {
        owners: {
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true } }
          }
        }
      }
    });

    res.status(201).json({
      message: 'System created successfully',
      system
    });
  } catch (error) {
    next(error);
  }
});

// Update system
router.put('/:id', authenticate, authorize(['ADMIN', 'SYSTEM_OWNER']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    // Check access
    const existingSystem = await prisma.system.findUnique({
      where: { id }
    });

    if (!existingSystem) {
      throw new AppError('System not found', 404);
    }

    if (existingSystem.organizationId !== req.user.organizationId) {
      throw new AppError('Access denied to this system', 403);
    }

    if (req.user.role !== 'ADMIN') {
      const isOwner = await prisma.systemOwner.findFirst({
        where: { userId: req.user.id, systemId: id }
      });

      if (!isOwner) {
        throw new AppError('Only system owners can update this system', 403);
      }
    }

    const system = await prisma.system.update({
      where: { id },
      data: { name, description, isActive }
    });

    res.json({
      message: 'System updated successfully',
      system
    });
  } catch (error) {
    next(error);
  }
});

// Delete system (admin only)
router.delete('/:id', authenticate, authorize(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.system.delete({
      where: { id }
    });

    res.json({ message: 'System deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Assign user to system
router.post('/:id/owners', authenticate, authorize(['ADMIN', 'SYSTEM_OWNER']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      throw new AppError('User ID is required', 400);
    }

    // Verify user exists and is in same org
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.organizationId !== req.user.organizationId) {
      throw new AppError('Cannot assign users from different organizations', 403);
    }

    const assignment = await prisma.systemOwner.create({
      data: {
        userId,
        systemId: id
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } }
      }
    });

    res.status(201).json({
      message: 'User assigned to system successfully',
      assignment
    });
  } catch (error) {
    next(error);
  }
});

// Remove user from system
router.delete('/:id/owners/:userId', authenticate, authorize(['ADMIN', 'SYSTEM_OWNER']), async (req, res, next) => {
  try {
    const { id, userId } = req.params;

    await prisma.systemOwner.deleteMany({
      where: {
        userId,
        systemId: id
      }
    });

    res.json({ message: 'User removed from system successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
