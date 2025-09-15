// Comprehensive Admin Report Management Routes
import express from "express";
import { PrismaClient } from "../generated/prisma/index.js";
import { authenticate } from "./admin-auth.js";

const router = express.Router();
const prisma = new PrismaClient();


router.get("/reports", authenticate(["ADMIN", "MODERATOR"]), async (req, res) => {
  try {
    const {
      status,
      wardId,
      departmentId,
      issueTypeId,
      severity,
      priority,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      dateFrom,
      dateTo,
      assignedTo,
      isSpam,
      isSensitive
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build comprehensive where clause
    const where = {
      ...(status && { status }),
      ...(wardId && { wardId }),
      ...(departmentId && { departmentId }),
      ...(issueTypeId && { issueTypeId }),
      ...(severity && { severity: parseInt(severity) }),
      ...(isSpam !== undefined && { isSpam: isSpam === 'true' }),
      ...(isSensitive !== undefined && { isSensitive: isSensitive === 'true' }),
      ...(assignedTo && { 
        assignment: { contractorId: assignedTo }
      }),
      ...(dateFrom && dateTo && {
        createdAt: {
          gte: new Date(dateFrom),
          lte: new Date(dateTo)
        }
      }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(priority && { 
        upvotes: priority === 'high' ? { gte: 10 } : 
                 priority === 'medium' ? { gte: 5, lt: 10 } : { lt: 5 }
      })
    };

    // Calculate priority score for sorting
    const orderBy = sortBy === 'priorityScore' ? [
      { severity: 'desc' },
      { upvotes: 'desc' },
      { createdAt: 'desc' }
    ] : { [sortBy]: sortOrder };

    const [reports, total, statusCounts] = await Promise.all([
      prisma.report.findMany({
        where,
        include: {
          issueType: true,
          ward: true,
          department: true,
          reporter: {
            select: { id: true, name: true, verified: true }
          },
          assignment: {
            include: {
              contractor: {
                select: { id: true, businessName: true, avgRating: true }
              }
            }
          },
          _count: {
            select: {
              comments: true,
              reactions: true,
              subscriptions: true,
              bids: true,
              completionProofs: true
            }
          }
        },
        skip,
        take: parseInt(limit),
        orderBy
      }),
      prisma.report.count({ where }),
      // Enhanced status distribution
      prisma.report.groupBy({
        by: ['status'],
        _count: true,
        where: wardId ? { wardId } : {}
      })
    ]);

    // Calculate priority scores for display
    const reportsWithPriority = reports.map(report => ({
      ...report,
      priorityScore: (report.severity * 20) + (report.upvotes * 2) + 
                     (report._count.subscriptions * 5)
    }));

    res.json({
      success: true,
      data: {
        reports: reportsWithPriority,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        },
        statusCounts: statusCounts.reduce((acc, item) => {
          acc[item.status] = item._count;
          return acc;
        }, {}),
        filters: {
          availableStatuses: Object.values(await prisma.$queryRaw`SELECT DISTINCT status FROM Report`),
          totalFiltered: total
        }
      }
    });

  } catch (error) {
    console.error("Error fetching admin reports:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reports"
    });
  }
});

/**
 * GET /api/admin/reports/:id
 * Full detail of a single report with comprehensive data
 */
router.get("/reports/:id", authenticate(["ADMIN", "MODERATOR"]), async (req, res) => {
  try {
    const { id } = req.params;

    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        issueType: true,
        ward: true,
        department: true,
        reporter: {
          select: { id: true, name: true, verified: true, phone: true, email: true }
        },
        assignment: {
          include: {
            contractor: {
              include: {
                user: { select: { name: true, phone: true, email: true } }
              }
            },
            extensions: true
          }
        },
        media: true,
        comments: {
          include: {
            author: {
              select: { id: true, name: true, role: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        history: {
          orderBy: { createdAt: 'desc' }
        },
        reactions: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        },
        subscriptions: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        },
        bids: {
          include: {
            contractor: {
              select: { id: true, businessName: true, avgRating: true }
            }
          },
          orderBy: { amount: 'asc' }
        },
        completionProofs: {
          include: {
            media: true,
            approvals: {
              include: {
                completionProof: {
                  select: { id: true }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        moderatorActions: {
          include: {
            moderator: {
              select: { name: true, role: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        tags: true,
        _count: {
          select: {
            comments: true,
            reactions: true,
            subscriptions: true,
            bids: true
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

    // Calculate additional metrics
    const metrics = {
      priorityScore: (report.severity * 20) + (report.upvotes * 2) + 
                     (report._count.subscriptions * 5),
      daysOpen: Math.floor((new Date() - new Date(report.createdAt)) / (1000 * 60 * 60 * 24)),
      avgBidAmount: report.bids.length > 0 ? 
        report.bids.reduce((sum, bid) => sum + bid.amount, 0) / report.bids.length : 0,
      lowestBid: report.bids.length > 0 ? Math.min(...report.bids.map(b => b.amount)) : 0
    };

    res.json({
      success: true,
      data: {
        ...report,
        metrics
      }
    });

  } catch (error) {
    console.error("Error fetching report details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch report details"
    });
  }
});

/**
 * PATCH /api/admin/reports/:id/status
 * Update report status with mandatory justification
 */
router.patch("/reports/:id/status", authenticate(["ADMIN", "MODERATOR"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, justification } = req.body;

    // Justification is mandatory for MVP transparency
    if (!justification || justification.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Justification is required and must be at least 10 characters"
      });
    }

    const validStatuses = [
      "OPEN", "DUPLICATE", "MERGED", "VALIDATED", "IN_BIDDING", 
      "ASSIGNED", "IN_PROGRESS", "PENDING_CITIZEN_REVIEW", 
      "COMPLETED", "VERIFIED", "CLOSED", "REJECTED", "AUTO_CLOSED"
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
        validStatuses
      });
    }

    const existingReport = await prisma.report.findUnique({
      where: { id }
    });

    if (!existingReport) {
      return res.status(404).json({
        success: false,
        message: "Report not found"
      });
    }

    const updatedReport = await prisma.report.update({
      where: { id },
      data: {
        status,
        updatedAt: new Date(),
        ...(status === "CLOSED" && { closedAt: new Date() })
      },
      include: {
        issueType: true,
        ward: true,
        department: true
      }
    });

    // Add to history with justification
    await prisma.reportHistory.create({
      data: {
        reportId: id,
        actorId: req.user.id,
        actorName: `${req.user.role} (${req.user.id})`,
        action: "STATUS_CHANGED",
        oldStatus: existingReport.status,
        newStatus: status,
        description: `Status changed from ${existingReport.status} to ${status}`,
        justification,
        metadata: { 
          oldStatus: existingReport.status, 
          newStatus: status,
          changedBy: req.user.role,
          adminId: req.user.id
        },
        isSystemGenerated: false
      }
    });

    // Log admin action for audit
    await prisma.adminLog.create({
      data: {
        adminId: req.user.id,
        adminName: req.user.id,
        adminRole: req.user.role,
        entityType: "REPORT",
        entityId: id,
        actionType: "STATUS_CHANGED",
        justificationMessage: justification,
        oldValue: { status: existingReport.status },
        newValue: { status }
      }
    });

    res.json({
      success: true,
      message: "Report status updated successfully",
      data: updatedReport
    });

  } catch (error) {
    console.error("Error updating report status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update report status"
    });
  }
});

/**
 * PATCH /api/admin/reports/:id/assign
 * Assign report to contractor or department with mandatory justification
 */
router.patch("/reports/:id/assign", authenticate(["ADMIN", "MODERATOR"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { contractorId, departmentId, deadline, justification } = req.body;

    // Justification is mandatory
    if (!justification || justification.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Justification is required for assignment (min 10 characters)"
      });
    }

    const report = await prisma.report.findUnique({
      where: { id }
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found"
      });
    }

    let updatedReport;
    let assignmentData = {};
    let assignmentDetails = {};

    if (contractorId) {
      // Assign to contractor
      const contractor = await prisma.contractor.findUnique({
        where: { id: contractorId },
        include: { user: { select: { name: true } } }
      });

      if (!contractor) {
        return res.status(404).json({
          success: false,
          message: "Contractor not found"
        });
      }

      // Create assignment
      assignmentData = {
        assignment: {
          create: {
            contractorId,
            assignedById: req.user.id,
            deadlineAt: deadline ? new Date(deadline) : null,
            status: "ASSIGNED"
          }
        }
      };

      assignmentDetails = {
        type: "contractor",
        assignedTo: contractor.businessName,
        contractorId,
        deadline
      };
    }

    updatedReport = await prisma.report.update({
      where: { id },
      data: {
        status: "ASSIGNED",
        departmentId: departmentId || report.departmentId,
        updatedAt: new Date(),
        ...assignmentData
      },
      include: {
        issueType: true,
        ward: true,
        department: true,
        assignment: {
          include: {
            contractor: {
              select: { id: true, businessName: true, avgRating: true }
            }
          }
        }
      }
    });

    // Add to history with justification
    await prisma.reportHistory.create({
      data: {
        reportId: id,
        actorId: req.user.id,
        actorName: `${req.user.role} (${req.user.id})`,
        action: "REPORT_ASSIGNED",
        oldStatus: report.status,
        newStatus: "ASSIGNED",
        description: contractorId 
          ? `Assigned to contractor ${assignmentDetails.assignedTo}`
          : `Assigned to department`,
        justification,
        metadata: {
          ...assignmentDetails,
          departmentId,
          assignedBy: req.user.role,
          adminId: req.user.id
        },
        isSystemGenerated: false
      }
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: req.user.id,
        adminName: req.user.id,
        adminRole: req.user.role,
        entityType: "REPORT",
        entityId: id,
        actionType: "ASSIGNED",
        justificationMessage: justification,
        newValue: assignmentDetails
      }
    });

    res.json({
      success: true,
      message: "Report assigned successfully",
      data: updatedReport
    });

  } catch (error) {
    console.error("Error assigning report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to assign report"
    });
  }
});

/**
 * POST /api/admin/reports/:id/moderate
 * Comprehensive moderation with mandatory justification
 */
router.post("/reports/:id/moderate", authenticate(["ADMIN", "MODERATOR"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      action, 
      justification, 
      isSpam, 
      isSensitive, 
      duplicateOfId,
      severity 
    } = req.body;

    const validActions = [
      "FLAG_SPAM", "MARK_SENSITIVE", "HIDE", "APPROVE", 
      "MARK_DUPLICATE", "ESCALATE", "REJECT", "UNFLAG"
    ];
    
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid moderation action",
        validActions
      });
    }

    // Justification is mandatory for all moderation actions
    if (!justification || justification.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Justification is required for moderation (min 10 characters)"
      });
    }

    const report = await prisma.report.findUnique({
      where: { id }
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found"
      });
    }

    // Build update data based on action
    const updateData = {
      updatedAt: new Date()
    };

    if (isSpam !== undefined) updateData.isSpam = isSpam;
    if (isSensitive !== undefined) updateData.isSensitive = isSensitive;
    if (action === "MARK_DUPLICATE" && duplicateOfId) {
      updateData.status = "DUPLICATE";
      updateData.duplicateOfId = duplicateOfId;
      updateData.isDuplicate = true;
    }
    if (severity !== undefined) updateData.severity = parseInt(severity);

    const updatedReport = await prisma.report.update({
      where: { id },
      data: updateData
    });

    // Log moderation action
    await prisma.moderatorAction.create({
      data: {
        moderatorId: req.user.id,
        reportId: id,
        action,
        justification,
        oldValue: {
          isSpam: report.isSpam,
          isSensitive: report.isSensitive,
          status: report.status,
          severity: report.severity
        },
        newValue: {
          isSpam: isSpam ?? report.isSpam,
          isSensitive: isSensitive ?? report.isSensitive,
          status: updateData.status ?? report.status,
          severity: updateData.severity ?? report.severity
        }
      }
    });

    // Add to report history
    await prisma.reportHistory.create({
      data: {
        reportId: id,
        actorId: req.user.id,
        actorName: `${req.user.role} (${req.user.id})`,
        action: "MODERATED",
        description: `Report moderated: ${action}`,
        justification,
        metadata: { 
          action, 
          moderatedBy: req.user.role,
          adminId: req.user.id,
          changes: updateData
        },
        isSystemGenerated: false
      }
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: req.user.id,
        adminName: req.user.id,
        adminRole: req.user.role,
        entityType: "REPORT",
        entityId: id,
        actionType: "APPROVED", // or other appropriate action
        justificationMessage: justification,
        oldValue: {
          isSpam: report.isSpam,
          isSensitive: report.isSensitive
        },
        newValue: updateData
      }
    });

    res.json({
      success: true,
      message: "Report moderated successfully",
      data: updatedReport,
      moderationDetails: {
        action,
        moderatedBy: req.user.role,
        timestamp: new Date(),
        justification
      }
    });

  } catch (error) {
    console.error("Error moderating report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to moderate report"
    });
  }
});

/**
 * PATCH /api/admin/reports/:id/moderate
 * Moderate report - mark as spam, sensitive, etc.
 */
router.patch("/reports/:id/moderate", authenticate(["ADMIN", "MODERATOR"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason, isSpam, isSensitive } = req.body;

    const validActions = ["FLAG_SPAM", "MARK_SENSITIVE", "HIDE", "APPROVE"];
    
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid moderation action"
      });
    }

    const report = await prisma.report.findUnique({
      where: { id }
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found"
      });
    }

    const updatedReport = await prisma.report.update({
      where: { id },
      data: {
        ...(isSpam !== undefined && { isSpam }),
        ...(isSensitive !== undefined && { isSensitive }),
        updatedAt: new Date()
      }
    });

    // Log moderation action
    await prisma.moderatorAction.create({
      data: {
        moderatorId: req.user.id,
        reportId: id,
        action,
        justification: reason,
        oldValue: {
          isSpam: report.isSpam,
          isSensitive: report.isSensitive
        },
        newValue: {
          isSpam: isSpam ?? report.isSpam,
          isSensitive: isSensitive ?? report.isSensitive
        }
      }
    });

    // Add to history
    await prisma.reportHistory.create({
      data: {
        reportId: id,
        actorId: req.user.id,
        actorName: req.user.role,
        action: "MODERATED",
        description: `Report moderated: ${action}`,
        justification: reason,
        metadata: { action, moderatedBy: req.user.role },
        isSystemGenerated: false
      }
    });

    res.json({
      success: true,
      message: "Report moderated successfully",
      data: updatedReport
    });

  } catch (error) {
    console.error("Error moderating report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to moderate report"
    });
  }
});

/**
 * PATCH /api/admin/reports/:id/escalate
 * Escalate report to higher priority
 */
router.patch("/reports/:id/escalate", authenticate(["ADMIN", "MODERATOR"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, urgentFlag = true } = req.body;

    const report = await prisma.report.findUnique({
      where: { id }
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found"
      });
    }

    const updatedReport = await prisma.report.update({
      where: { id },
      data: {
        severity: Math.min(report.severity + 1, 5), // Increase severity up to 5
        updatedAt: new Date()
      }
    });

    // Add to history
    await prisma.reportHistory.create({
      data: {
        reportId: id,
        actorId: req.user.id,  
        actorName: req.user.role,
        action: "ESCALATED",
        description: "Report escalated to higher priority",
        justification: reason,
        metadata: {
          oldSeverity: report.severity,
          newSeverity: updatedReport.severity,
          escalatedBy: req.user.role,
          urgentFlag
        },
        isSystemGenerated: false
      }
    });

    res.json({
      success: true,
      message: "Report escalated successfully",
      data: updatedReport
    });

  } catch (error) {
    console.error("Error escalating report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to escalate report"
    });
  }
});

/**
 * GET /api/admin/dashboard/stats
 * Get dashboard statistics
 */
router.get("/dashboard/stats", authenticate(["ADMIN", "MODERATOR"]), async (req, res) => {
  try {
    const { wardId } = req.query;

    const whereClause = wardId ? { wardId } : {};

    const [
      totalReports,
      openReports,
      inProgressReports,
      completedReports,
      recentReports,
      topIssueTypes
    ] = await Promise.all([
      prisma.report.count({ where: whereClause }),
      prisma.report.count({ where: { ...whereClause, status: "OPEN" } }),
      prisma.report.count({ where: { ...whereClause, status: "IN_PROGRESS" } }),
      prisma.report.count({ where: { ...whereClause, status: "COMPLETED" } }),
      prisma.report.findMany({
        where: whereClause,
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          reporter: { select: { name: true } },
          issueType: { select: { title: true } }
        }
      }),
      prisma.report.groupBy({
        by: ['issueTypeId'],
        _count: true,
        where: whereClause,
        orderBy: { _count: { issueTypeId: 'desc' } },
        take: 5
      })
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalReports,
          openReports,
          inProgressReports,
          completedReports,
          completionRate: totalReports > 0 ? (completedReports / totalReports * 100).toFixed(2) : 0
        },
        recentReports,
        topIssueTypes
      }
    });

  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics"
    });
  }
});

/**
 * GET /api/admin/reports/:id/bids
 * View all bids for a report
 */
router.get("/reports/:id/bids", authenticate(["ADMIN", "MODERATOR"]), async (req, res) => {
  try {
    const { id } = req.params;

    const report = await prisma.report.findUnique({
      where: { id },
      select: { id: true, title: true, status: true }
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found"
      });
    }

    const bids = await prisma.bid.findMany({
      where: { reportId: id },
      include: {
        contractor: {
          select: {
            id: true,
            businessName: true,
            avgRating: true,
            completedJobs: true,
            isVerified: true,
            specializations: true,
            user: {
              select: { phone: true, email: true }
            }
          }
        }
      },
      orderBy: [
        { isPreferred: 'desc' },
        { proposedCost: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    // Calculate bid statistics
    const bidStats = {
      total: bids.length,
      avgCost: bids.length > 0 ? bids.reduce((sum, bid) => sum + bid.proposedCost, 0) / bids.length : 0,
      lowestCost: bids.length > 0 ? Math.min(...bids.map(b => b.proposedCost)) : 0,
      highestCost: bids.length > 0 ? Math.max(...bids.map(b => b.proposedCost)) : 0,
      preferredBids: bids.filter(b => b.isPreferred).length
    };

    res.json({
      success: true,
      data: {
        report,
        bids,
        statistics: bidStats
      }
    });

  } catch (error) {
    console.error("Error fetching bids:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bids"
    });
  }
});

/**
 * POST /api/admin/reports/:id/bid/assign
 * Assign bid to contractor with mandatory justification
 */
router.post("/reports/:id/bid/assign", authenticate(["ADMIN", "MODERATOR"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { bidId, justification, deadline } = req.body;

    // Justification is mandatory
    if (!justification || justification.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Justification is required for bid assignment (min 10 characters)"
      });
    }

    const bid = await prisma.bid.findUnique({
      where: { id: bidId },
      include: {
        contractor: {
          select: { id: true, businessName: true, avgRating: true },
          include: { user: { select: { name: true } } }
        },
        report: true
      }
    });

    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found"
      });
    }

    if (bid.reportId !== id) {
      return res.status(400).json({
        success: false,
        message: "Bid does not belong to this report"
      });
    }

    // Update bid status and create assignment
    const updatedBid = await prisma.bid.update({
      where: { id: bidId },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        acceptedBy: req.user.id
      }
    });

    // Create assignment
    const assignment = await prisma.assignment.create({
      data: {
        reportId: id,
        contractorId: bid.contractorId,
        assignedById: req.user.id,
        bidId: bidId,
        agreedCost: bid.proposedCost,
        deadlineAt: deadline ? new Date(deadline) : new Date(Date.now() + (bid.estimatedDays * 24 * 60 * 60 * 1000)),
        status: "ASSIGNED"
      }
    });

    // Update report status
    await prisma.report.update({
      where: { id },
      data: {
        status: "ASSIGNED",
        updatedAt: new Date()
      }
    });

    // Reject other bids
    await prisma.bid.updateMany({
      where: {
        reportId: id,
        id: { not: bidId }
      },
      data: {
        status: "REJECTED",
        rejectedAt: new Date()
      }
    });

    // Log assignment in report history
    await prisma.reportHistory.create({
      data: {
        reportId: id,
        actorId: req.user.id,
        actorName: `${req.user.role} (${req.user.id})`,
        action: "BID_ASSIGNED",
        oldStatus: bid.report.status,
        newStatus: "ASSIGNED",
        description: `Bid assigned to contractor ${bid.contractor.businessName}`,
        justification,
        metadata: {
          bidId,
          contractorId: bid.contractorId,
          agreedCost: bid.proposedCost,
          estimatedDays: bid.estimatedDays,
          assignedBy: req.user.role,
          adminId: req.user.id
        },
        isSystemGenerated: false
      }
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: req.user.id,
        adminName: req.user.id,
        adminRole: req.user.role,
        entityType: "BID",
        entityId: bidId,
        actionType: "ASSIGNED",
        justificationMessage: justification,
        oldValue: { status: "PENDING" },
        newValue: {
          status: "ACCEPTED",
          contractorId: bid.contractorId,
          agreedCost: bid.proposedCost,
          assignmentId: assignment.id
        }
      }
    });

    res.json({
      success: true,
      message: "Bid assigned successfully",
      data: {
        assignment,
        acceptedBid: updatedBid,
        contractor: bid.contractor
      }
    });

  } catch (error) {
    console.error("Error assigning bid:", error);
    res.status(500).json({
      success: false,
      message: "Failed to assign bid"
    });
  }
});

/**
 * PATCH /api/admin/contractors/:id/block
 * Block/unblock contractor with mandatory justification
 */
router.patch("/contractors/:id/block", authenticate(["ADMIN", "SUPERADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { isBlocked, justification } = req.body;

    // Justification is mandatory for both block and unblock
    if (!justification || justification.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Justification is required for contractor blocking/unblocking (min 10 characters)"
      });
    }

    const contractor = await prisma.contractor.findUnique({
      where: { id },
      include: { user: { select: { name: true, email: true } } }
    });

    if (!contractor) {
      return res.status(404).json({
        success: false,
        message: "Contractor not found"
      });
    }

    const updatedContractor = await prisma.contractor.update({
      where: { id },
      data: {
        isBlocked: isBlocked,
        blockReason: isBlocked ? justification : null,
        blockedAt: isBlocked ? new Date() : null,
        blockedBy: isBlocked ? req.user.id : null,
        updatedAt: new Date()
      },
      include: {
        user: { select: { name: true, email: true } }
      }
    });

    // If blocking, cancel active assignments
    if (isBlocked) {
      await prisma.assignment.updateMany({
        where: {
          contractorId: id,
          status: { in: ["ASSIGNED", "IN_PROGRESS"] }
        },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: "Contractor blocked by admin"
        }
      });
    }

    // Log action in admin logs
    await prisma.adminLog.create({
      data: {
        adminId: req.user.id,
        adminName: req.user.id,
        adminRole: req.user.role,
        entityType: "CONTRACTOR",
        entityId: id,
        actionType: isBlocked ? "BLOCKED" : "UNBLOCKED",
        justificationMessage: justification,
        oldValue: {
          isBlocked: contractor.isBlocked,
          blockReason: contractor.blockReason
        },
        newValue: {
          isBlocked: isBlocked,
          blockReason: isBlocked ? justification : null,
          blockedBy: isBlocked ? req.user.id : null
        }
      }
    });

    res.json({
      success: true,
      message: `Contractor ${isBlocked ? 'blocked' : 'unblocked'} successfully`,
      data: updatedContractor,
      action: {
        type: isBlocked ? "BLOCKED" : "UNBLOCKED",
        performedBy: req.user.role,
        justification,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error("Error blocking contractor:", error);
    res.status(500).json({
      success: false,
      message: "Failed to block contractor"
    });
  }
});

/**
 * GET /api/admin/proofs/:id/approve
 * Approve/reject completion proof with mandatory justification
 */
router.patch("/proofs/:id/approve", authenticate(["ADMIN", "MODERATOR"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { isApproved, justification } = req.body;

    // Justification is mandatory
    if (!justification || justification.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Justification is required for proof approval/rejection (min 10 characters)"
      });
    }

    const proof = await prisma.completionProof.findUnique({
      where: { id },
      include: {
        assignment: {
          include: {
            report: { select: { id: true, title: true } },
            contractor: { select: { businessName: true } }
          }
        }
      }
    });

    if (!proof) {
      return res.status(404).json({
        success: false,
        message: "Proof not found"
      });
    }

    const updatedProof = await prisma.completionProof.update({
      where: { id },
      data: {
        status: isApproved ? "APPROVED" : "REJECTED",
        reviewedAt: new Date(),
        reviewedBy: req.user.id,
        reviewNotes: justification
      }
    });

    // If approved, update assignment and report status
    if (isApproved) {
      await prisma.assignment.update({
        where: { id: proof.assignmentId },
        data: {
          status: "COMPLETED",
          completedAt: new Date()
        }
      });

      await prisma.report.update({
        where: { id: proof.assignment.report.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          updatedAt: new Date()
        }
      });
    }

    // Log proof review
    await prisma.reportHistory.create({
      data: {
        reportId: proof.assignment.report.id,
        actorId: req.user.id,
        actorName: `${req.user.role} (${req.user.id})`,
        action: isApproved ? "PROOF_APPROVED" : "PROOF_REJECTED",
        description: `Completion proof ${isApproved ? 'approved' : 'rejected'}`,
        justification,
        metadata: {
          proofId: id,
          contractorBusinessName: proof.assignment.contractor.businessName,
          reviewedBy: req.user.role,
          adminId: req.user.id
        },
        isSystemGenerated: false
      }
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: req.user.id,
        adminName: req.user.id,
        adminRole: req.user.role,
        entityType: "PROOF",
        entityId: id,
        actionType: isApproved ? "APPROVED" : "REJECTED",
        justificationMessage: justification,
        oldValue: { status: proof.status },
        newValue: { 
          status: isApproved ? "APPROVED" : "REJECTED",
          reviewedAt: new Date(),
          reviewNotes: justification
        }
      }
    });

    res.json({
      success: true,
      message: `Proof ${isApproved ? 'approved' : 'rejected'} successfully`,
      data: updatedProof,
      action: {
        type: isApproved ? "APPROVED" : "REJECTED",
        reviewedBy: req.user.role,
        justification,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error("Error reviewing proof:", error);
    res.status(500).json({
      success: false,
      message: "Failed to review proof"
    });
  }
});

/**
 * GET /api/admin/analytics/dashboard
 * Comprehensive admin dashboard analytics
 */
router.get("/analytics/dashboard", authenticate(["ADMIN", "MODERATOR"]), async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    switch (timeframe) {
      case '7d': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case '30d': startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
      case '90d': startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;  
      default: startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Report statistics
    const reportStats = await prisma.report.groupBy({
      by: ['status'],
      _count: true,
      where: {
        createdAt: { gte: startDate }
      }
    });

    const totalReports = await prisma.report.count({
      where: { createdAt: { gte: startDate } }
    });

    // Severity breakdown
    const severityStats = await prisma.report.groupBy({
      by: ['severity'],
      _count: true,
      where: {
        createdAt: { gte: startDate }
      }
    });

    // Ward-wise statistics
    const wardStats = await prisma.report.groupBy({
      by: ['wardId'],
      _count: true,
      where: {
        createdAt: { gte: startDate }
      },
      orderBy: {
        _count: {
          wardId: 'desc'
        }
      },
      take: 10
    });

    // Get ward names
    const wardIds = wardStats.map(w => w.wardId).filter(Boolean);
    const wards = await prisma.ward.findMany({
      where: { id: { in: wardIds } },
      select: { id: true, name: true }
    });

    const wardStatsWithNames = wardStats.map(stat => ({
      ...stat,
      wardName: wards.find(w => w.id === stat.wardId)?.name || 'Unknown'
    }));

    // Response time analytics
    const completedReports = await prisma.report.findMany({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: startDate },
        completedAt: { not: null }
      },
      select: {
        createdAt: true,
        completedAt: true,
        severity: true
      }
    });

    const responseTimeStats = completedReports.map(report => {
      const diffTime = report.completedAt.getTime() - report.createdAt.getTime();
      return {
        responseTimeHours: Math.round(diffTime / (1000 * 60 * 60)),
        severity: report.severity
      };
    });

    const avgResponseTime = responseTimeStats.length > 0 
      ? responseTimeStats.reduce((sum, r) => sum + r.responseTimeHours, 0) / responseTimeStats.length 
      : 0;

    // Contractor performance
    const contractorPerformance = await prisma.assignment.findMany({
      where: {
        createdAt: { gte: startDate },
        status: { in: ['COMPLETED', 'IN_PROGRESS'] }
      },
      include: {
        contractor: {
          select: { id: true, businessName: true, avgRating: true }
        }
      }
    });

    const contractorStats = contractorPerformance.reduce((acc, assignment) => {
      const contractorId = assignment.contractor.id;
      if (!acc[contractorId]) {
        acc[contractorId] = {
          id: contractorId,
          businessName: assignment.contractor.businessName,
          avgRating: assignment.contractor.avgRating,
          totalAssignments: 0,
          completedAssignments: 0
        };
      }
      acc[contractorId].totalAssignments++;
      if (assignment.status === 'COMPLETED') {
        acc[contractorId].completedAssignments++;
      }
      return acc;
    }, {});

    // Admin action logs for accountability
    const adminActions = await prisma.adminLog.count({
      where: {
        createdAt: { gte: startDate }
      }
    });

    const actionsByAdmin = await prisma.adminLog.groupBy({
      by: ['adminRole'],
      _count: true,
      where: {
        createdAt: { gte: startDate }
      }
    });

    res.json({
      success: true,
      data: {
        overview: {
          totalReports,
          avgResponseTime: Math.round(avgResponseTime),
          adminActions,
          timeframe
        },
        reportsByStatus: reportStats,
        reportsBySeverity: severityStats,
        topWards: wardStatsWithNames,
        responseTimeAnalysis: {
          avgResponseTime: Math.round(avgResponseTime),
          byResponseTime: responseTimeStats
        },
        contractorPerformance: Object.values(contractorStats).slice(0, 10),
        adminActivity: {
          totalActions: adminActions,
          actionsByRole: actionsByAdmin
        }
      }
    });

  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch analytics"
    });
  }
});

export default router;
