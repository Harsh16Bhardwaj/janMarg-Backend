// routes/run.js - User Creation APIs for JanMarg System
import express from "express";
import { PrismaClient } from "../generated/prisma/index.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { authenticate } from "./admin-auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// ========================================
// UTILITY FUNCTIONS
// ========================================

// Generate unique slug from name
const generateSlug = (name, suffix = '') => {
  const baseSlug = name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim();
  
  return suffix ? `${baseSlug}-${suffix}` : baseSlug;
};

// Generate unique ID (for admin login IDs)
const generateUniqueId = (name, role) => {
  const rolePrefix = role.toLowerCase().substring(0, 3);
  const namePrefix = name.toLowerCase().replace(/[^a-z]/g, '').substring(0, 4);
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${rolePrefix}${namePrefix}${randomSuffix}`;
};

// Input validation
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone) => {
  const phoneRegex = /^[6-9]\d{9}$/; // Indian mobile number format
  return phoneRegex.test(phone);
};

// ========================================
// CITIZEN USER CREATION API
// ========================================

/**
 * POST /api/run/create-citizen
 * Create a new citizen user
 * 
 * Body: {
 *   name: string,
 *   email: string,
 *   phone?: string,
 *   wardId?: string,
 *   address?: string
 * }
 */
router.post("/create-citizen", async (req, res) => {
  try {
    const { name, email, phone, wardId, address, aadhaarNumber } = req.body;

    // Input validation
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required"
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    if (phone && !validatePhone(phone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format (must be 10 digits starting with 6-9)"
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(phone ? [{ phone }] : [])
        ]
      }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email or phone already exists"
      });
    }

    // Verify ward exists if provided
    let ward = null;
    if (wardId) {
      ward = await prisma.ward.findUnique({
        where: { id: wardId }
      });
      
      if (!ward) {
        return res.status(400).json({
          success: false,
          message: "Invalid ward ID"
        });
      }
    }

    // Create citizen user
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        role: "CITIZEN",
        verified: false,
        ...(wardId && {
          wards: {
            create: {
              wardId,
              isPrimary: true
            }
          }
        })
      },
      include: {
        wards: {
          include: {
            ward: true
          }
        }
      }
    });

    // Generate auth token
    const token = jwt.sign(
      { 
        id: newUser.id, 
        role: newUser.role,
        email: newUser.email 
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Log user creation
    await prisma.auditLog.create({
      data: {
        actorId: "system",
        actorRole: "CITIZEN",
        actorName: "System",
        action: "USER_CREATED",
        entityType: "USER",
        entityId: newUser.id,
        description: `New citizen user created: ${name}`,
        meta: {
          userRole: "CITIZEN",
          email: email,
          wardId: wardId || null
        }
      }
    });

    res.status(201).json({
      success: true,
      message: "Citizen user created successfully",
      data: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        verified: newUser.verified,
        ward: newUser.wards[0]?.ward || null,
        authToken: token,
        createdAt: newUser.createdAt
      }
    });

  } catch (error) {
    console.error("Error creating citizen user:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

// ========================================
// ADMIN USER CREATION API
// ========================================

/**
 * POST /api/run/create-admin
 * Create a new admin user (protected route - requires SUPERADMIN)
 * 
 * Body: {
 *   name: string,
 *   email: string,
 *   phone?: string,
 *   role: "MODERATOR" | "ADMIN" | "SUPERADMIN",
 *   wardIds?: string[],
 *   departmentIds?: string[],
 *   password?: string
 * }
 */
router.post("/create-admin", authenticate(["SUPERADMIN"]), async (req, res) => {
  try {
    const { name, email, phone, role, wardIds = [], departmentIds = [], password } = req.body;

    // Input validation
    if (!name || !email || !role) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and role are required"
      });
    }

    if (!["MODERATOR", "ADMIN", "SUPERADMIN"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Must be MODERATOR, ADMIN, or SUPERADMIN"
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    if (phone && !validatePhone(phone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format"
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(phone ? [{ phone }] : [])
        ]
      }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email or phone already exists"
      });
    }

    // Verify wards exist if provided
    if (wardIds.length > 0) {
      const wardCount = await prisma.ward.count({
        where: { id: { in: wardIds } }
      });
      
      if (wardCount !== wardIds.length) {
        return res.status(400).json({
          success: false,
          message: "One or more ward IDs are invalid"
        });
      }
    }

    // Generate login credentials
    const loginId = generateUniqueId(name, role);
    const defaultPassword = password || `${role.toLowerCase()}123`;
    
    // Hash password if provided (for future use)
    // const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Create admin user
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        role,
        verified: true, // Admin users are verified by default
        // Create ward admin relationships if wardIds provided
        ...(wardIds.length > 0 && {
          wardAdmins: {
            create: wardIds.map(wardId => ({
              wardId,
              roleDesc: role
            }))
          }
        }),
        // Create moderator relationships for moderator role
        ...(role === "MODERATOR" && wardIds.length > 0 && {
          moderatorRoles: {
            create: wardIds.map(wardId => ({
              wardId
            }))
          }
        })
      },
      include: {
        wardAdmins: {
          include: {
            ward: true
          }
        },
        moderatorRoles: {
          include: {
            ward: true
          }
        }
      }
    });

    // Generate auth token
    const token = jwt.sign(
      { 
        id: newUser.id, 
        role: newUser.role,
        email: newUser.email,
        loginId: loginId
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Log admin creation
    await prisma.adminLog.create({
      data: {
        adminId: req.user.id,
        adminName: req.user.username || "Admin",
        adminRole: req.user.role,
        entityType: "USER",
        entityId: newUser.id,
        actionType: "CREATED",
        justificationMessage: `Created new ${role} user: ${name}`,
        newValue: {
          name,
          email,
          role,
          wardIds
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.status(201).json({
      success: true,
      message: `${role} user created successfully`,
      data: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        verified: newUser.verified,
        loginId: loginId,
        defaultPassword: defaultPassword,
        wards: newUser.wardAdmins.map(wa => wa.ward),
        authToken: token,
        createdAt: newUser.createdAt
      },
      credentials: {
        loginId: loginId,
        password: defaultPassword,
        note: "Store these credentials securely. Password should be changed on first login."
      }
    });

  } catch (error) {
    console.error("Error creating admin user:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

// ========================================
// BULK USER CREATION APIs
// ========================================

/**
 * POST /api/run/create-bulk-citizens
 * Create multiple citizen users at once
 */
router.post("/create-bulk-citizens", authenticate(["ADMIN", "SUPERADMIN"]), async (req, res) => {
  try {
    const { users } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Users array is required and cannot be empty"
      });
    }

    if (users.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Cannot create more than 100 users at once"
      });
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < users.length; i++) {
      try {
        const userData = users[i];
        
        // Validate individual user data
        if (!userData.name || !userData.email) {
          errors.push({ index: i, error: "Name and email are required" });
          continue;
        }

        // Check if user already exists
        const existingUser = await prisma.user.findFirst({
          where: {
            OR: [
              { email: userData.email },
              ...(userData.phone ? [{ phone: userData.phone }] : [])
            ]
          }
        });

        if (existingUser) {
          errors.push({ index: i, error: "User already exists" });
          continue;
        }

        // Create user
        const newUser = await prisma.user.create({
          data: {
            name: userData.name,
            email: userData.email,
            phone: userData.phone,
            role: "CITIZEN",
            verified: false,
            ...(userData.wardId && {
              wards: {
                create: {
                  wardId: userData.wardId,
                  isPrimary: true
                }
              }
            })
          }
        });

        results.push({
          index: i,
          id: newUser.id,
          name: newUser.name,
          email: newUser.email
        });

      } catch (error) {
        errors.push({ index: i, error: error.message });
      }
    }

    // Log bulk creation
    await prisma.adminLog.create({
      data: {
        adminId: req.user.id,
        adminName: req.user.username || "Admin",
        adminRole: req.user.role,
        entityType: "USER",
        entityId: "bulk",
        actionType: "CREATED",
        justificationMessage: `Bulk created ${results.length} citizens`,
        metadata: {
          successCount: results.length,
          errorCount: errors.length,
          totalAttempted: users.length
        }
      }
    });

    res.status(201).json({
      success: true,
      message: `Bulk creation completed. ${results.length} users created, ${errors.length} errors`,
      data: {
        created: results,
        errors: errors,
        summary: {
          total: users.length,
          created: results.length,
          failed: errors.length
        }
      }
    });

  } catch (error) {
    console.error("Error in bulk user creation:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

// ========================================
// USER MANAGEMENT APIs
// ========================================

/**
 * GET /api/run/users
 * Get all users with filtering
 */
router.get("/users", authenticate(["ADMIN", "SUPERADMIN", "MODERATOR"]), async (req, res) => {
  try {
    const { 
      role, 
      wardId, 
      verified, 
      page = 1, 
      limit = 20,
      search 
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      ...(role && { role }),
      ...(verified !== undefined && { verified: verified === 'true' }),
      ...(wardId && {
        wards: {
          some: { wardId }
        }
      }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      })
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          wards: {
            include: {
              ward: true
            }
          },
          wardAdmins: {
            include: {
              ward: true
            }
          }
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

/**
 * PUT /api/run/users/:id/verify
 * Verify a user
 */
router.put("/users/:id/verify", authenticate(["ADMIN", "SUPERADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { verified = true } = req.body;

    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { verified }
    });

    // Log verification action
    await prisma.adminLog.create({
      data: {
        adminId: req.user.id,
        adminName: req.user.username || "Admin",
        adminRole: req.user.role,
        entityType: "USER",
        entityId: id,
        actionType: verified ? "APPROVED" : "REJECTED",
        justificationMessage: `User ${verified ? 'verified' : 'unverified'}: ${user.name}`,
        oldValue: { verified: user.verified },
        newValue: { verified }
      }
    });

    res.json({
      success: true,
      message: `User ${verified ? 'verified' : 'unverified'} successfully`,
      data: updatedUser
    });

  } catch (error) {
    console.error("Error verifying user:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

export default router;
