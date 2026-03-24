// Reports routes

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

const prisma = new PrismaClient();

// Get all reports
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { reportType, limit = 50 } = req.query;

    const where = {};
    if (reportType) where.reportType = reportType;

    const reports = await prisma.report.findMany({
      where,
      orderBy: { generatedAt: 'desc' },
      take: parseInt(limit),
      select: {
        id: true,
        reportType: true,
        title: true,
        generatedBy: true,
        generatedAt: true,
        parameters: true
      }
    });

    res.json({ reports });
  } catch (error) {
    next(error);
  }
});

// Get single report with full data
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const report = await prisma.report.findUnique({
      where: { id }
    });

    if (!report) {
      throw new AppError('Report not found', 404);
    }

    res.json({ report });
  } catch (error) {
    next(error);
  }
});

// Generate and save report
router.post('/', authenticate, authorize(['ADMIN', 'EXECUTIVE', 'SYSTEM_OWNER']), async (req, res, next) => {
  try {
    const { reportType, title, parameters, data } = req.body;

    if (!reportType || !title || !data) {
      throw new AppError('Report type, title, and data are required', 400);
    }

    const report = await prisma.report.create({
      data: {
        reportType,
        title,
        generatedBy: req.user.email,
        parameters,
        data
      }
    });

    res.status(201).json({
      message: 'Report generated successfully',
      report
    });
  } catch (error) {
    next(error);
  }
});

// Delete report
router.delete('/:id', authenticate, authorize(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.report.delete({
      where: { id }
    });

    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
