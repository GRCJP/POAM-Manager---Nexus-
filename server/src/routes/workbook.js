// Workbook (Security Control Monitoring) routes

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

const prisma = new PrismaClient();

// Get all workbook items for a system
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { systemId, status, severityValue } = req.query;

    if (!systemId) {
      throw new AppError('System ID is required', 400);
    }

    const where = { systemId };
    if (status) where.status = status;
    if (severityValue) where.severityValue = severityValue;

    const items = await prisma.workbookItem.findMany({
      where,
      orderBy: { itemNumber: 'asc' }
    });

    res.json({ items });
  } catch (error) {
    next(error);
  }
});

// Get single workbook item
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const item = await prisma.workbookItem.findUnique({
      where: { id },
      include: {
        system: { select: { id: true, name: true } }
      }
    });

    if (!item) {
      throw new AppError('Workbook item not found', 404);
    }

    res.json({ item });
  } catch (error) {
    next(error);
  }
});

// Create workbook item
router.post('/', authenticate, authorize(['ADMIN', 'SYSTEM_OWNER', 'ENGINEER']), async (req, res, next) => {
  try {
    const {
      systemId,
      itemNumber,
      vulnerabilityName,
      vulnerabilityDescription,
      pocName,
      severityValue,
      status,
      scheduledCompletionDate,
      ...otherFields
    } = req.body;

    if (!systemId || !itemNumber || !vulnerabilityName) {
      throw new AppError('System ID, item number, and vulnerability name are required', 400);
    }

    const item = await prisma.workbookItem.create({
      data: {
        systemId,
        itemNumber,
        vulnerabilityName,
        vulnerabilityDescription,
        pocName,
        severityValue,
        status: status || 'Open',
        scheduledCompletionDate: scheduledCompletionDate ? new Date(scheduledCompletionDate) : null,
        ...otherFields
      }
    });

    res.status(201).json({
      message: 'Workbook item created successfully',
      item
    });
  } catch (error) {
    next(error);
  }
});

// Update workbook item
router.put('/:id', authenticate, authorize(['ADMIN', 'SYSTEM_OWNER', 'ENGINEER']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const item = await prisma.workbookItem.update({
      where: { id },
      data: {
        ...updates,
        updatedAt: new Date()
      }
    });

    res.json({
      message: 'Workbook item updated successfully',
      item
    });
  } catch (error) {
    next(error);
  }
});

// Delete workbook item
router.delete('/:id', authenticate, authorize(['ADMIN', 'SYSTEM_OWNER', 'ENGINEER']), async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.workbookItem.delete({
      where: { id }
    });

    res.json({ message: 'Workbook item deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Bulk import workbook items
router.post('/bulk', authenticate, authorize(['ADMIN', 'SYSTEM_OWNER', 'ENGINEER']), async (req, res, next) => {
  try {
    const { systemId, items } = req.body;

    if (!systemId || !Array.isArray(items)) {
      throw new AppError('System ID and items array are required', 400);
    }

    const created = await prisma.workbookItem.createMany({
      data: items.map(item => ({
        systemId,
        ...item,
        scheduledCompletionDate: item.scheduledCompletionDate ? new Date(item.scheduledCompletionDate) : null
      })),
      skipDuplicates: true
    });

    res.status(201).json({
      message: `${created.count} workbook items imported successfully`,
      count: created.count
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
