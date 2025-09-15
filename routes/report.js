import express from "express";
import { PrismaClient } from "../generated/prisma/index.js";
import { authenticate } from "./admin-auth.js";
import { logReportActivity, logReportChange } from "../utils/logger.js";

const router = express.Router();
const prisma = new PrismaClient();

// ========================================
// CITIZEN REPORT ROUTES
// ========================================

/**
 * POST /api/reports
 * Create a new report
 */
router.post("/", authenticate(["CITIZEN"]), async (req, res) => {
  try {
    const {
      title,
      description,
      latitude,
      longitude,
      address,
      issueTypeId,
      severity = 1,
      isAnonymous = false
    } = req.body;

    // Basic validation
    if (!title || !latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Title, latitude, and longitude are required"
      });
    }

    // For MVP, assume we have a default ward - in real app, calculate from lat/lng
    const defaultWard = await prisma.ward.findFirst();
    if (!defaultWard) {
      return res.status(500).json({
        success: false,
        message: "No wards configured in system"
      });
    }

    // Create the report
    const newReport = await prisma.report.create({
      data: {
        title,
        description,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address,
        issueTypeId,
        severity: parseInt(severity),
        isAnonymous,
        reporterId: req.user.id, // From fake auth
        wardId: defaultWard.id,
        status: "OPEN"
      },
      include: {
        issueType: true,
        ward: true,
        reporter: {
          select: { id: true, name: true }
        }
      }
    });

    // Add to history
    await prisma.reportHistory.create({
      data: {
        reportId: newReport.id,
        actorId: req.user.id,
        actorName: "Citizen",
        action: "REPORT_CREATED",
        newStatus: "OPEN",
        description: "Report created by citizen",
        isSystemGenerated: false
      }
    });

    // Automatically log report creation
    await logReportChange(
      newReport.id,
      req.user.id,
      "REPORT_CREATED",
      `New report created: "${title}"`,
      {
        actorName: req.user.id,
        actorRole: req.user.role,
        reportData: {
          title,
          description,
          wardId,
          severity,
          location: { latitude, longitude, address }
        }
      },
      null,
      newReport
    );

    res.status(201).json({
      success: true,
      message: "Report created successfully",
      data: newReport
    });

  } catch (error) {
    console.error("Error creating report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create report"
    });
  }
});

/**
 * GET /api/reports
 * List reports with filters
 */
router.get("/", async (req, res) => {
  try {
    const {
      status,
      wardId,
      issueTypeId,
      severity,
      page = 1,
      limit = 20,
      userId // for user's own reports
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      ...(status && { status }),
      ...(wardId && { wardId }),
      ...(issueTypeId && { issueTypeId }),
      ...(severity && { severity: parseInt(severity) }),
      ...(userId && { reporterId: userId })
    };

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        include: {
          issueType: true,
          ward: true,
          reporter: {
            select: { id: true, name: true }
          },
          _count: {
            select: {
              comments: true,
              reactions: true
            }
          }
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.report.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        reports,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reports"
    });
  }
});

/**
 * GET /api/reports/:id
 * Get single report with details
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        issueType: true,
        ward: true,
        department: true,
        reporter: {
          select: { id: true, name: true, verified: true }
        },
        comments: {
          include: {
            author: {
              select: { id: true, name: true, role: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        history: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        reactions: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        },
        _count: {
          select: {
            comments: true,
            reactions: true,
            subscriptions: true
          }
        }
      }
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found"
      });
    }

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error("Error fetching report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch report"
    });
  }
});

/**
 * PATCH /api/reports/:id
 * Edit report (only by owner if editable)
 */
router.patch("/:id", authenticate(["CITIZEN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, severity } = req.body;

    // Check if report exists and user owns it
    const existingReport = await prisma.report.findUnique({
      where: { id }
    });

    if (!existingReport) {
      return res.status(404).json({
        success: false,
        message: "Report not found"
      });
    }

    if (existingReport.reporterId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own reports"
      });
    }

    // Check if report is still editable (only OPEN reports)
    if (existingReport.status !== "OPEN") {
      return res.status(400).json({
        success: false,
        message: "Report can only be edited when status is OPEN"
      });
    }

    const updatedReport = await prisma.report.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(severity && { severity: parseInt(severity) }),
        updatedAt: new Date()
      },
      include: {
        issueType: true,
        ward: true,
        reporter: {
          select: { id: true, name: true }
        }
      }
    });

    // Automatically log report update with enhanced details
    await logReportChange(
      id,
      req.user.id,
      "REPORT_UPDATED",
      "Report edited by citizen",
      {
        actorName: req.user.id,
        actorRole: req.user.role,
        changes: { title, description, severity }
      },
      {
        title: existingReport.title,
        description: existingReport.description,
        severity: existingReport.severity
      },
      {
        title: updatedReport.title,
        description: updatedReport.description,
        severity: updatedReport.severity
      }
    );

    res.json({
      success: true,
      message: "Report updated successfully",
      data: updatedReport
    });

  } catch (error) {
    console.error("Error updating report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update report"
    });
  }
});

/**
 * DELETE /api/reports/:id
 * Delete report (by owner or moderator)
 */
router.delete("/:id", authenticate(["CITIZEN", "MODERATOR", "ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;

    const existingReport = await prisma.report.findUnique({
      where: { id }
    });

    if (!existingReport) {
      return res.status(404).json({
        success: false,
        message: "Report not found"
      });
    }

    // Check permissions
    const isOwner = existingReport.reporterId === req.user.id;
    const isModerator = ["MODERATOR", "ADMIN"].includes(req.user.role);

    if (!isOwner && !isModerator) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to delete this report"
      });
    }

    // For MVP, just delete. In production, might want to soft delete
    await prisma.report.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: "Report deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete report"
    });
  }
});

// ========================================
// REPORT ACTIONS (Engagement)
// ========================================

/**
 * POST /api/reports/:id/upvote
 * Upvote a report
 */
router.post("/:id/upvote", authenticate(["CITIZEN"]), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if report exists
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found"
      });
    }

    // Check if user already reacted
    const existingReaction = await prisma.reportReaction.findUnique({
      where: {
        reportId_userId_type: {
          reportId: id,
          userId: req.user.id,
          type: "UPVOTE"
        }
      }
    });

    if (existingReaction) {
      return res.status(400).json({
        success: false,
        message: "You have already upvoted this report"
      });
    }

    // Create reaction
    await prisma.reportReaction.create({
      data: {
        reportId: id,
        userId: req.user.id,
        type: "UPVOTE"
      }
    });

    // Update report upvotes count
    await prisma.report.update({
      where: { id },
      data: {
        upvotes: {
          increment: 1
        }
      }
    });

    res.json({
      success: true,
      message: "Report upvoted successfully"
    });

  } catch (error) {
    console.error("Error upvoting report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upvote report"
    });
  }
});

/**
 * POST /api/reports/:id/subscribe
 * Subscribe to report updates
 */
router.post("/:id/subscribe", authenticate(["CITIZEN"]), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if report exists
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found"
      });
    }

    // Check if already subscribed
    const existingSubscription = await prisma.reportSubscription.findUnique({
      where: {
        reportId_userId: {
          reportId: id,
          userId: req.user.id
        }
      }
    });

    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        message: "Already subscribed to this report"
      });
    }

    await prisma.reportSubscription.create({
      data: {
        reportId: id,
        userId: req.user.id
      }
    });

    res.json({
      success: true,
      message: "Subscribed to report updates"
    });

  } catch (error) {
    console.error("Error subscribing to report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to subscribe to report"
    });
  }
});

/**
 * DELETE /api/reports/:id/subscribe
 * Unsubscribe from report updates
 */
router.delete("/:id/subscribe", authenticate(["CITIZEN"]), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.reportSubscription.deleteMany({
      where: {
        reportId: id,
        userId: req.user.id
      }
    });

    res.json({
      success: true,
      message: "Unsubscribed from report updates"
    });

  } catch (error) {
    console.error("Error unsubscribing from report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unsubscribe from report"
    });
  }
});

/**
 * POST /api/reports/:id/duplicate
 * Mark report as duplicate of another
 */
router.post("/:id/duplicate", authenticate(["MODERATOR", "ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { duplicateOfId } = req.body;

    if (!duplicateOfId) {
      return res.status(400).json({
        success: false,
        message: "duplicateOfId is required"
      });
    }

    // Check both reports exist
    const [report, duplicateOf] = await Promise.all([
      prisma.report.findUnique({ where: { id } }),
      prisma.report.findUnique({ where: { id: duplicateOfId } })
    ]);

    if (!report || !duplicateOf) {
      return res.status(404).json({
        success: false,
        message: "One or both reports not found"
      });
    }

    // Update report status
    await prisma.report.update({
      where: { id },
      data: {
        status: "DUPLICATE",
        duplicateOfId,
        isDuplicate: true
      }
    });

    // Update duplicate count on original
    await prisma.report.update({
      where: { id: duplicateOfId },
      data: {
        noOfDuplicates: {
          increment: 1
        }
      }
    });

    // Automatically log duplicate marking with comprehensive details
    await logReportChange(
      id,
      req.user.id,
      "MARKED_DUPLICATE",
      `Marked as duplicate of report ${duplicateOfId} by ${req.user.role}`,
      {
        actorName: req.user.id,
        actorRole: req.user.role,
        duplicateOfId,
        originalReportTitle: duplicateOf.title
      },
      {
        status: report.status,
        isDuplicate: report.isDuplicate,
        duplicateOfId: report.duplicateOfId
      },
      {
        status: "DUPLICATE",
        isDuplicate: true,
        duplicateOfId
      }
    );

    res.json({
      success: true,
      message: "Report marked as duplicate"
    });

  } catch (error) {
    console.error("Error marking report as duplicate:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark report as duplicate"
    });
  }
});

export default router;
