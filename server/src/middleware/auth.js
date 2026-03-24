// JWT authentication and RBAC middleware

const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');

// Verify JWT token and attach user to request
const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      organizationId: decoded.organizationId
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(new AppError('Invalid token', 401));
    } else if (error.name === 'TokenExpiredError') {
      next(new AppError('Token expired', 401));
    } else {
      next(error);
    }
  }
};

// Role-based access control
const authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403));
    }

    next();
  };
};

// Check if user owns or has access to a system
const checkSystemAccess = async (req, res, next) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const systemId = req.params.systemId || req.body.systemId;

    if (!systemId) {
      return next(new AppError('System ID required', 400));
    }

    // Admins have access to all systems
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // Check if system belongs to user's organization
    const system = await prisma.system.findUnique({
      where: { id: systemId },
      include: {
        owners: {
          where: { userId: req.user.id }
        }
      }
    });

    if (!system) {
      return next(new AppError('System not found', 404));
    }

    if (system.organizationId !== req.user.organizationId) {
      return next(new AppError('Access denied to this system', 403));
    }

    // System owners and engineers need to be assigned to the system
    if (req.user.role === 'SYSTEM_OWNER' || req.user.role === 'ENGINEER') {
      if (system.owners.length === 0) {
        return next(new AppError('You are not assigned to this system', 403));
      }
    }

    await prisma.$disconnect();
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { authenticate, authorize, checkSystemAccess };
