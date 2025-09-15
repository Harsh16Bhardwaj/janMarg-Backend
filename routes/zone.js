// Ward management routes (Zone equivalent in schema)
import express from "express";
import { PrismaClient } from "../generated/prisma/index.js";
import { authenticate } from "./admin-auth.js";
import { logWardActivity, logAPIActivity } from "../utils/logger.js";

const router = express.Router();
const prisma = new PrismaClient();

// Apply general API logging to all routes
router.use(logAPIActivity);

/**
 * POST /api/zones (Create Ward)
 * Create a new ward with automatic logging
 */
router.post("/", authenticate(["ADMIN", "SUPERADMIN"]), async (req, res) => {
  try {
    const { name, state, district } = req.body;

    if (!name || !state) {
      return res.status(400).json({
        success: false,
        message: "Name and state are required"
      });
    }

    const ward = await prisma.ward.create({
      data: {
        name,
        state,
        district
      }
    });

    // Log ward creation
    await logWardActivity(
      ward.id,
      req.user.id,
      "WARD_CREATED",
      `Ward "${name}" created in ${state}${district ? `, ${district}` : ''}`,
      {
        actorName: req.user.id,
        actorRole: req.user.role,
        wardData: { name, state, district }
      }
    );

    res.status(201).json({
      success: true,
      message: "Ward created successfully",
      data: {
        wardId: ward.id,
        name: ward.name,
        state: ward.state,
        district: ward.district,
        createdAt: ward.createdAt
      }
    });

  } catch (error) {
    console.error("Error creating ward:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create ward"
    });
  }
});

/**
 * GET /api/zones (Get All Wards)
 * Get all wards with filtering and stats
 */
router.get("/", async (req, res) => {
  try {
    const { state, district, search, includeStats } = req.query;

    // Build filter conditions
    const whereCondition = {};
    if (state) whereCondition.state = state;
    if (district) whereCondition.district = district;
    if (search) {
      whereCondition.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { state: { contains: search, mode: 'insensitive' } },
        { district: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Base query
    const includeConfig = {
      userWards: {
        select: { id: true }
      },
      admins: {
        select: { 
          id: true,
          roleDesc: true,
          user: { select: { name: true, email: true } }
        }
      }
    };

    // Add report stats if requested
    if (includeStats === 'true') {
      includeConfig.reports = {
        select: { 
          id: true, 
          status: true, 
          severity: true,
          createdAt: true 
        }
      };
    }

    const wards = await prisma.ward.findMany({
      where: whereCondition,
      include: includeConfig,
      orderBy: [
        { state: 'asc' },
        { name: 'asc' }
      ]
    });

    // Calculate statistics if requested
    const wardsWithStats = wards.map(ward => {
      const baseWard = {
        wardId: ward.id,
        name: ward.name,
        state: ward.state,
        district: ward.district,
        userCount: ward.userWards.length,
        adminCount: ward.admins.length,
        createdAt: ward.createdAt
      };

      if (includeStats === 'true' && ward.reports) {
        const reportStats = {
          reportCount: ward.reports.length,
          statusDistribution: ward.reports.reduce((acc, report) => {
            acc[report.status] = (acc[report.status] || 0) + 1;
            return acc;
          }, {}),
          severityDistribution: ward.reports.reduce((acc, report) => {
            const severity = report.severity || 0;
            const level = severity >= 8 ? 'HIGH' : severity >= 5 ? 'MEDIUM' : 'LOW';
            acc[level] = (acc[level] || 0) + 1;
            return acc;
          }, {}),
          recentReports: ward.reports
            .filter(r => new Date(r.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
            .length
        };
        
        return { ...baseWard, ...reportStats };
      }

      return baseWard;
    });

    res.json({
      success: true,
      data: wardsWithStats,
      meta: {
        total: wards.length,
        includeStats: includeStats === 'true',
        filters: { state, district, search }
      }
    });

  } catch (error) {
    console.error("Error fetching wards:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch wards"
    });
  }
});

/**
 * GET /api/zones/:wardId (Get Ward by ID)
 * Get detailed ward information
 */
router.get("/:wardId", async (req, res) => {
  try {
    const { wardId } = req.params;

    const ward = await prisma.ward.findUnique({
      where: { id: wardId },
      include: {
        userWards: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true }
            }
          }
        },
        admins: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        moderators: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        reports: {
          select: {
            id: true,
            title: true,
            status: true,
            severity: true,
            createdAt: true,
            reporter: {
              select: { name: true }
            },
            issueType: {
              select: { title: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!ward) {
      return res.status(404).json({
        success: false,
        message: "Ward not found"
      });
    }

    // Calculate comprehensive statistics
    const allReports = await prisma.report.count({
      where: { wardId }
    });

    const statusStats = await prisma.report.groupBy({
      by: ['status'],
      where: { wardId },
      _count: true
    });

    const recentActivity = await prisma.reportHistory.findMany({
      where: {
        report: { wardId }
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: {
        report: {
          select: { title: true }
        }
      }
    });

    res.json({
      success: true,
      data: {
        wardId: ward.id,
        name: ward.name,
        state: ward.state,
        district: ward.district,
        createdAt: ward.createdAt,
        users: ward.userWards.map(uw => ({
          ...uw.user,
          isPrimary: uw.isPrimary,
          joinedAt: uw.joinedAt
        })),
        admins: ward.admins.map(admin => ({
          ...admin.user,
          roleDesc: admin.roleDesc,
          assignedAt: admin.createdAt
        })),
        moderators: ward.moderators.map(mod => ({
          ...mod.user,
          assignedAt: mod.assignedAt
        })),
        recentReports: ward.reports,
        statistics: {
          totalReports: allReports,
          statusDistribution: statusStats.reduce((acc, stat) => {
            acc[stat.status] = stat._count;
            return acc;
          }, {}),
          userCount: ward.userWards.length,
          adminCount: ward.admins.length,
          moderatorCount: ward.moderators.length
        },
        recentActivity
      }
    });

  } catch (error) {
    console.error("Error fetching ward:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch ward details"
    });
  }
});

/**
 * PUT /api/zones/:wardId (Update Ward)
 * Update ward information with logging
 */
router.put("/:wardId", authenticate(["ADMIN", "SUPERADMIN"]), async (req, res) => {
  try {
    const { wardId } = req.params;
    const { name, state, district } = req.body;

    const existingWard = await prisma.ward.findUnique({
      where: { id: wardId }
    });

    if (!existingWard) {
      return res.status(404).json({
        success: false,
        message: "Ward not found"
      });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (state !== undefined) updateData.state = state;
    if (district !== undefined) updateData.district = district;

    const updatedWard = await prisma.ward.update({
      where: { id: wardId },
      data: {
        ...updateData,
        updatedAt: new Date()
      }
    });

    // Log ward update
    await logWardActivity(
      wardId,
      req.user.id,
      "WARD_UPDATED",
      `Ward "${updatedWard.name}" updated`,
      {
        actorName: req.user.id,
        actorRole: req.user.role,
        oldData: {
          name: existingWard.name,
          state: existingWard.state,
          district: existingWard.district
        },
        newData: updateData
      }
    );

    res.json({
      success: true,
      message: "Ward updated successfully",
      data: updatedWard
    });

  } catch (error) {
    console.error("Error updating ward:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update ward"
    });
  }
});

/**
 * DELETE /api/zones/:wardId (Soft Delete Ward)
 * Mark ward as inactive instead of hard delete
 */
router.delete("/:wardId", authenticate(["SUPERADMIN"]), async (req, res) => {
  try {
    const { wardId } = req.params;

    const ward = await prisma.ward.findUnique({
      where: { id: wardId },
      include: {
        reports: { select: { id: true } },
        userWards: { select: { id: true } }
      }
    });

    if (!ward) {
      return res.status(404).json({
        success: false,
        message: "Ward not found"
      });
    }

    // Check if ward has active reports
    const activeReports = await prisma.report.count({
      where: {
        wardId,
        status: { in: ["OPEN", "IN_PROGRESS", "ASSIGNED", "IN_BIDDING"] }
      }
    });

    if (activeReports > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete ward with ${activeReports} active reports. Please resolve them first.`
      });
    }

    // For this MVP, we'll log the deletion intent
    await logWardActivity(
      wardId,
      req.user.id,
      "WARD_DELETION_REQUESTED",
      `Deletion requested for ward "${ward.name}" (${ward.reports.length} total reports, ${ward.userWards.length} users)`,
      {
        actorName: req.user.id,
        actorRole: req.user.role,
        wardData: {
          name: ward.name,
          state: ward.state,
          totalReports: ward.reports.length,
          totalUsers: ward.userWards.length
        }
      }
    );

    res.json({
      success: true,
      message: "Ward deletion request logged. Implementation pending schema update for soft delete.",
      data: {
        wardId,
        action: "DELETION_LOGGED",
        note: "Ward will be marked inactive once soft delete field is added to schema"
      }
    });

  } catch (error) {
    console.error("Error deleting ward:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete ward"
    });
  }
});

/**
 * POST /api/zones/:wardId/users (Assign User to Ward)
 * Assign a user to a ward
 */
router.post("/:wardId/users", authenticate(["ADMIN", "SUPERADMIN"]), async (req, res) => {
  try {
    const { wardId } = req.params;
    const { userId, isPrimary = false } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required"
      });
    }

    // Check if ward exists
    const ward = await prisma.ward.findUnique({
      where: { id: wardId }
    });

    if (!ward) {
      return res.status(404).json({
        success: false,
        message: "Ward not found"
      });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if already assigned
    const existingAssignment = await prisma.userWard.findUnique({
      where: {
        userId_wardId: {
          userId,
          wardId
        }
      }
    });

    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        message: "User already assigned to this ward"
      });
    }

    // Create assignment
    const assignment = await prisma.userWard.create({
      data: {
        userId,
        wardId,
        isPrimary
      },
      include: {
        user: {
          select: { name: true, email: true, role: true }
        },
        ward: {
          select: { name: true, state: true }
        }
      }
    });

    // Log assignment
    await logWardActivity(
      wardId,
      req.user.id,
      "USER_ASSIGNED_TO_WARD",
      `User ${user.name || userId} assigned to ward "${ward.name}"`,
      {
        actorName: req.user.id,
        actorRole: req.user.role,
        assignedUserId: userId,
        isPrimary,
        userName: user.name,
        userRole: user.role
      }
    );

    res.json({
      success: true,
      message: "User assigned to ward successfully",
      data: assignment
    });

  } catch (error) {
    console.error("Error assigning user to ward:", error);
    res.status(500).json({
      success: false,
      message: "Failed to assign user to ward"
    });
  }
});

/**
 * GET /api/zones/:wardId/reports (Get Reports by Ward)
 * Get all reports for a specific ward with filtering
 */
router.get("/:wardId/reports", async (req, res) => {
  try {
    const { wardId } = req.params;
    const { 
      status, 
      severity, 
      issueType, 
      limit = 20, 
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter conditions
    const whereCondition = { wardId };
    if (status) whereCondition.status = status;
    if (severity) whereCondition.severity = { gte: parseInt(severity) };
    if (issueType) whereCondition.issueTypeId = issueType;

    const reports = await prisma.report.findMany({
      where: whereCondition,
      include: {
        reporter: {
          select: { id: true, name: true }
        },
        issueType: {
          select: { title: true, code: true }
        },
        department: {
          select: { name: true }
        },
        assignment: {
          select: {
            status: true,
            contractor: {
              select: { businessName: true }
            }
          }
        }
      },
      orderBy: {
        [sortBy]: sortOrder
      },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    // Get total count for pagination
    const totalReports = await prisma.report.count({
      where: whereCondition
    });

    // Calculate urgency score for each report
    const reportsWithUrgency = reports.map(report => ({
      reportId: report.id,
      title: report.title,
      status: report.status,
      severity: report.severity,
      urgencyScore: calculateUrgencyScore(report),
      createdAt: report.createdAt,
      reporter: report.reporter,
      issueType: report.issueType,
      department: report.department,
      assignment: report.assignment,
      location: {
        latitude: report.latitude,
        longitude: report.longitude,
        address: report.address
      }
    }));

    res.json({
      success: true,
      data: reportsWithUrgency,
      pagination: {
        total: totalReports,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(totalReports / parseInt(limit))
      }
    });

  } catch (error) {
    console.error("Error fetching ward reports:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch ward reports"
    });
  }
});

/**
 * GET /api/zones/:wardId/analytics (Ward Analytics)
 * Get comprehensive analytics for a ward
 */
router.get("/:wardId/analytics", authenticate(["ADMIN", "MODERATOR"]), async (req, res) => {
  try {
    const { wardId } = req.params;
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

    // Basic ward info
    const ward = await prisma.ward.findUnique({
      where: { id: wardId },
      select: { name: true, state: true, district: true }
    });

    if (!ward) {
      return res.status(404).json({
        success: false,
        message: "Ward not found"
      });
    }

    // Report statistics
    const [totalReports, recentReports, statusStats, severityStats, completionStats] = await Promise.all([
      // Total reports
      prisma.report.count({ where: { wardId } }),
      
      // Recent reports
      prisma.report.count({ 
        where: { 
          wardId, 
          createdAt: { gte: startDate } 
        } 
      }),
      
      // Status distribution
      prisma.report.groupBy({
        by: ['status'],
        where: { wardId },
        _count: true
      }),
      
      // Severity distribution
      prisma.report.groupBy({
        by: ['severity'],
        where: { wardId },
        _count: true
      }),
      
      // Completion rate
      prisma.report.findMany({
        where: { 
          wardId,
          status: 'COMPLETED',
          createdAt: { gte: startDate }
        },
        select: { createdAt: true, updatedAt: true }
      })
    ]);

    // Calculate average resolution time
    const avgResolutionTime = completionStats.length > 0
      ? completionStats.reduce((sum, report) => {
          const diffTime = report.updatedAt.getTime() - report.createdAt.getTime();
          return sum + (diffTime / (1000 * 60 * 60 * 24)); // days
        }, 0) / completionStats.length
      : 0;

    res.json({
      success: true,
      data: {
        ward: {
          id: wardId,
          name: ward.name,
          state: ward.state,
          district: ward.district
        },
        overview: {
          totalReports,
          recentReports,
          completionRate: totalReports > 0 ? (completionStats.length / totalReports * 100) : 0,
          avgResolutionTime: Math.round(avgResolutionTime * 10) / 10,
          timeframe
        },
        distributions: {
          status: statusStats.reduce((acc, stat) => {
            acc[stat.status] = stat._count;
            return acc;
          }, {}),
          severity: severityStats.reduce((acc, stat) => {
            acc[stat.severity] = stat._count;
            return acc;
          }, {})
        }
      }
    });

  } catch (error) {
    console.error("Error fetching ward analytics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch ward analytics"
    });
  }
});

/**
 * Helper function to calculate urgency score
 */
function calculateUrgencyScore(report) {
  let score = 0;
  
  // Base severity score (0-10)
  score += (report.severity || 0);
  
  // Age factor (newer reports get higher priority)
  const ageInDays = (new Date() - new Date(report.createdAt)) / (1000 * 60 * 60 * 24);
  if (ageInDays < 1) score += 5;
  else if (ageInDays < 3) score += 3;
  else if (ageInDays < 7) score += 1;
  
  // Status factor
  if (report.status === 'OPEN') score += 3;
  else if (report.status === 'VALIDATED') score += 2;
  
  // Community engagement
  score += Math.min(report.upvotes || 0, 5);
  
  return Math.min(Math.round(score), 100);
}

export default router;
