// Scan management routes

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

const prisma = new PrismaClient();

// Get all scan runs for a system
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { systemId } = req.query;

    if (!systemId) {
      throw new AppError('System ID is required', 400);
    }

    const scans = await prisma.scanRun.findMany({
      where: { systemId },
      include: {
        _count: { select: { findings: true } }
      },
      orderBy: { importedAt: 'desc' }
    });

    res.json({ scans });
  } catch (error) {
    next(error);
  }
});

// Get single scan run with findings
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const scan = await prisma.scanRun.findUnique({
      where: { id },
      include: {
        system: { select: { id: true, name: true } },
        findings: { take: 1000 }
      }
    });

    if (!scan) {
      throw new AppError('Scan not found', 404);
    }

    res.json({ scan });
  } catch (error) {
    next(error);
  }
});

// Create scan run (called after frontend processes CSV)
router.post('/', authenticate, authorize(['ADMIN', 'SYSTEM_OWNER', 'ENGINEER']), async (req, res, next) => {
  try {
    const { systemId, fileName, scanType, source, findings = [] } = req.body;

    if (!systemId || !fileName) {
      throw new AppError('System ID and file name are required', 400);
    }

    const scan = await prisma.scanRun.create({
      data: {
        systemId,
        fileName,
        scanType: scanType || 'CSV',
        source,
        totalFindings: findings.length,
        findings: {
          create: findings.map(f => ({
            qid: f.qid,
            cve: f.cve,
            title: f.title,
            severity: f.severity,
            assetName: f.assetName,
            ipv4: f.ipv4,
            rawData: f.rawData
          }))
        }
      },
      include: {
        _count: { select: { findings: true } }
      }
    });

    res.status(201).json({
      message: 'Scan imported successfully',
      scan
    });
  } catch (error) {
    next(error);
  }
});

// Delete scan run
router.delete('/:id', authenticate, authorize(['ADMIN', 'SYSTEM_OWNER']), async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.scanRun.delete({
      where: { id }
    });

    res.json({ message: 'Scan deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
