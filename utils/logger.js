import { PrismaClient } from "../generated/prisma/index.js";
import logger from "../config/logger.js";

const prisma = new PrismaClient();

/**
 * Automatic logging helper for major report changes
 * This middleware runs before sending the response to log important actions
 */
export const logReportActivity = (action, description) => {
  return async (req, res, next) => {
    // Save reference to original response methods
    const originalSend = res.send;
    const originalJson = res.json;

    // Override res.send
    res.send = async function (body) {
      await performLogging(req, res, action, description, body);
      return originalSend.call(this, body);
    };

    // Override res.json  
    res.json = async function (body) {
      await performLogging(req, res, action, description, body);
      return originalJson.call(this, body);
    };

    next();
  };
};

/**
 * Direct logging function for report activities
 */
export const logReportChange = async (reportId, actorId, action, description, metadata = {}, oldValue = null, newValue = null) => {
  try {
    // Log to ReportHistory for timeline
    await prisma.reportHistory.create({
      data: {
        reportId,
        actorId,
        actorName: metadata.actorName || `User (${actorId})`,
        action,
        description,
        oldValue,
        newValue,
        metadata: {
          ...metadata,
          timestamp: new Date(),
          source: 'api'
        },
        isSystemGenerated: false
      }
    });

    // Log to AuditLog for comprehensive tracking
    await prisma.auditLog.create({
      data: {
        actorId,
        actorRole: metadata.actorRole,
        actorName: metadata.actorName,
        action,
        entityType: 'REPORT',
        entityId: reportId,
        description,
        meta: {
          ...metadata,
          oldValue,
          newValue
        },
        ipAddress: metadata.ipAddress
      }
    });

    // Also log to Winston for file logging
    logger.info('Report Activity Logged', {
      reportId,
      actorId,
      action,
      description,
      metadata
    });
    
    console.log(`✅ Logged activity: ${action} for report ${reportId}`);
  } catch (error) {
    logger.error('Failed to log report activity', error, {
      reportId,
      actorId,
      action,
      description
    });
    console.error('❌ Failed to log report activity:', error);
    // Don't throw error to avoid breaking the main operation
  }
};

/**
 * Automatic logging for ward activities  
 */
export const logWardActivity = async (wardId, actorId, action, description, metadata = {}) => {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        actorRole: metadata.actorRole,
        actorName: metadata.actorName,
        action,
        entityType: 'WARD',
        entityId: wardId,
        description,
        meta: {
          ...metadata,
          timestamp: new Date(),
          source: 'api'
        },
        ipAddress: metadata.ipAddress
      }
    });

    // Also log to Winston
    logger.info('Ward Activity Logged', {
      wardId,
      actorId,
      action,
      description,
      metadata
    });
    
    console.log(`✅ Logged ward activity: ${action} for ward ${wardId}`);
  } catch (error) {
    logger.error('Failed to log ward activity', error, {
      wardId,
      actorId,
      action,
      description
    });
    console.error('❌ Failed to log ward activity:', error);
  }
};

/**
 * General API logging middleware
 */
export const logAPIActivity = async (req, res, next) => {
  // Save reference to original response methods
  const originalSend = res.send;
  const originalJson = res.json;

  const logData = {
    userId: req.user?.id || "system",
    actorRole: req.user?.role,
    route: req.originalUrl,
    method: req.method,
    payload: req.body,
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    timestamp: new Date()
  };

  // Override res.send
  res.send = async function (body) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        await prisma.auditLog.create({
          data: {
            actorId: logData.userId,
            actorRole: logData.actorRole,
            action: `${logData.method}_${logData.route.replace(/[^a-zA-Z0-9]/g, '_')}`,
            description: `${logData.method} ${logData.route}`,
            meta: {
              ...logData,
              statusCode: res.statusCode,
              responseBody: typeof body === 'string' ? JSON.parse(body) : body
            },
            ipAddress: logData.ipAddress
          }
        });
      } catch (error) {
        console.error('API logging failed:', error);
      }
    }
    return originalSend.call(this, body);
  };

  // Override res.json
  res.json = async function (body) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        await prisma.auditLog.create({
          data: {
            actorId: logData.userId,
            actorRole: logData.actorRole,
            action: `${logData.method}_${logData.route.replace(/[^a-zA-Z0-9]/g, '_')}`,
            description: `${logData.method} ${logData.route}`,
            meta: {
              ...logData,
              statusCode: res.statusCode,
              responseBody: body
            },
            ipAddress: logData.ipAddress
          }
        });
      } catch (error) {
        console.error('API logging failed:', error);
      }
    }
    return originalJson.call(this, body);
  };

  next();
};

/**
 * Internal helper for performing logging
 */
async function performLogging(req, res, action, description, responseBody) {
  // Only log successful operations
  if (res.statusCode >= 200 && res.statusCode < 300) {
    try {
      const reportId = req.params.id || req.body.reportId || (responseBody?.data?.id);
      
      if (reportId && req.user) {
        await logReportChange(
          reportId,
          req.user.id,
          action,
          description,
          {
            actorName: req.user.id,
            actorRole: req.user.role,
            ipAddress: req.ip || req.connection.remoteAddress,
            route: req.originalUrl,
            method: req.method,
            statusCode: res.statusCode
          },
          null, // oldValue can be passed if needed
          responseBody?.data || responseBody
        );
      }
    } catch (error) {
      console.error('Automatic report logging failed:', error);
    }
  }
}

export default {
  logReportActivity,
  logReportChange,
  logWardActivity,
  logAPIActivity
};