// scripts/seed.js - Database Seeding Script
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

async function seedDatabase() {
  try {
    console.log("🌱 Starting database seeding...");

    // 1. Create Zones
    console.log("📍 Creating zones...");
    const ranchiZone = await prisma.zone.create({
      data: {
        name: "Ranchi Zone",
        slug: "ranchi-zone"
      }
    });

    const dhanbadZone = await prisma.zone.create({
      data: {
        name: "Dhanbad Zone", 
        slug: "dhanbad-zone"
      }
    });

    // 2. Create Wards
    console.log("🏘️ Creating wards...");
    const wards = await Promise.all([
      prisma.ward.create({
        data: {
          name: "Ward 1 - Doranda",
          slug: "ward-1-doranda",
          state: "Jharkhand",
          district: "Ranchi",
          zoneId: ranchiZone.id
        }
      }),
      prisma.ward.create({
        data: {
          name: "Ward 2 - Lalpur",
          slug: "ward-2-lalpur", 
          state: "Jharkhand",
          district: "Ranchi",
          zoneId: ranchiZone.id
        }
      }),
      prisma.ward.create({
        data: {
          name: "Ward 15 - Main Road",
          slug: "ward-15-main-road",
          state: "Jharkhand", 
          district: "Ranchi",
          zoneId: ranchiZone.id
        }
      }),
      prisma.ward.create({
        data: {
          name: "Ward 1 - Coal Township",
          slug: "ward-1-coal-township",
          state: "Jharkhand",
          district: "Dhanbad", 
          zoneId: dhanbadZone.id
        }
      })
    ]);

    // 3. Create Departments
    console.log("🏢 Creating departments...");
    const departments = await Promise.all([
      prisma.department.create({
        data: {
          name: "Public Works Department",
          code: "PWD",
          contact: "+91-651-2234567"
        }
      }),
      prisma.department.create({
        data: {
          name: "Public Health Engineering Department", 
          code: "PHED",
          contact: "+91-651-2234568"
        }
      }),
      prisma.department.create({
        data: {
          name: "Health & Sanitation Department",
          code: "HSD", 
          contact: "+91-651-2234569"
        }
      }),
      prisma.department.create({
        data: {
          name: "Electrical Department",
          code: "ED",
          contact: "+91-651-2234570"
        }
      }),
      prisma.department.create({
        data: {
          name: "Engineering Department",
          code: "ENGG",
          contact: "+91-651-2234571"
        }
      }),
      prisma.department.create({
        data: {
          name: "Horticulture Department", 
          code: "HD",
          contact: "+91-651-2234572"
        }
      })
    ]);

    // 4. Create Issue Types
    console.log("📝 Creating issue types...");
    const issueTypes = await Promise.all([
      // PWD Issues
      prisma.issueType.create({
        data: {
          title: "Pothole",
          code: "PWD_001",
          departmentId: departments[0].id, // PWD
          defaultSeverity: 4,
          description: "Road surface damage requiring immediate attention"
        }
      }),
      prisma.issueType.create({
        data: {
          title: "Road Construction",
          code: "PWD_002", 
          departmentId: departments[0].id,
          defaultSeverity: 3,
          description: "New road construction or major repairs"
        }
      }),
      // PHED Issues
      prisma.issueType.create({
        data: {
          title: "Water Supply Disruption",
          code: "PHED_001",
          departmentId: departments[1].id, // PHED
          defaultSeverity: 5,
          description: "Water shortage or supply issues"
        }
      }),
      prisma.issueType.create({
        data: {
          title: "Pipe Leakage",
          code: "PHED_002",
          departmentId: departments[1].id,
          defaultSeverity: 4,
          description: "Water pipe burst or leakage"
        }
      }),
      // Health & Sanitation Issues
      prisma.issueType.create({
        data: {
          title: "Garbage Collection",
          code: "HSD_001",
          departmentId: departments[2].id, // HSD
          defaultSeverity: 3,
          description: "Waste collection and disposal issues"
        }
      }),
      prisma.issueType.create({
        data: {
          title: "Public Toilet Maintenance",
          code: "HSD_002",
          departmentId: departments[2].id,
          defaultSeverity: 3,
          description: "Public toilet cleaning and maintenance"
        }
      }),
      // Electrical Issues
      prisma.issueType.create({
        data: {
          title: "Street Light",
          code: "ED_001",
          departmentId: departments[3].id, // ED
          defaultSeverity: 2,
          description: "Street light not working or damaged"
        }
      }),
      prisma.issueType.create({
        data: {
          title: "Electrical Hazard",
          code: "ED_002",
          departmentId: departments[3].id,
          defaultSeverity: 5,
          description: "Dangerous electrical wiring or equipment"
        }
      }),
      // Engineering Issues
      prisma.issueType.create({
        data: {
          title: "Drainage Blockage",
          code: "ENGG_001",
          departmentId: departments[4].id, // ENGG
          defaultSeverity: 4,
          description: "Blocked drains causing waterlogging"
        }
      }),
      prisma.issueType.create({
        data: {
          title: "Bridge Maintenance",
          code: "ENGG_002",
          departmentId: departments[4].id,
          defaultSeverity: 3,
          description: "Bridge or flyover maintenance required"
        }
      }),
      // Horticulture Issues
      prisma.issueType.create({
        data: {
          title: "Tree Maintenance",
          code: "HD_001",
          departmentId: departments[5].id, // HD
          defaultSeverity: 2,
          description: "Tree trimming or removal required"
        }
      }),
      prisma.issueType.create({
        data: {
          title: "Park Maintenance",
          code: "HD_002", 
          departmentId: departments[5].id,
          defaultSeverity: 2,
          description: "Public park cleaning and maintenance"
        }
      })
    ]);

    // 5. Create Sample Admin Users
    console.log("👨‍💼 Creating admin users...");
    const superAdmin = await prisma.user.create({
      data: {
        name: "System Administrator",
        email: "superadmin@janmarg.gov.in",
        phone: "9999999999",
        role: "SUPERADMIN",
        verified: true
      }
    });

    const adminUser = await prisma.user.create({
      data: {
        name: "Ranchi Municipal Admin",
        email: "admin@ranchi.gov.in", 
        phone: "9999999998",
        role: "ADMIN",
        verified: true,
        wardAdmins: {
          create: wards.slice(0, 3).map(ward => ({
            wardId: ward.id,
            roleDesc: "Municipal Administrator"
          }))
        }
      }
    });

    const moderator = await prisma.user.create({
      data: {
        name: "Ward Moderator", 
        email: "moderator@ranchi.gov.in",
        phone: "9999999997",
        role: "MODERATOR",
        verified: true,
        moderatorRoles: {
          create: {
            wardId: wards[0].id
          }
        }
      }
    });

    // 6. Create Sample Citizens
    console.log("👥 Creating sample citizens...");
    const citizens = await Promise.all([
      prisma.user.create({
        data: {
          name: "Rajesh Kumar",
          email: "rajesh.kumar@example.com",
          phone: "9876543210", 
          role: "CITIZEN",
          verified: true,
          wards: {
            create: {
              wardId: wards[0].id,
              isPrimary: true
            }
          }
        }
      }),
      prisma.user.create({
        data: {
          name: "Priya Sharma",
          email: "priya.sharma@example.com",
          phone: "9876543211",
          role: "CITIZEN", 
          verified: false,
          wards: {
            create: {
              wardId: wards[1].id,
              isPrimary: true
            }
          }
        }
      }),
      prisma.user.create({
        data: {
          name: "Amit Singh",
          email: "amit.singh@example.com",
          phone: "9876543212",
          role: "CITIZEN",
          verified: true,
          wards: {
            create: {
              wardId: wards[2].id, 
              isPrimary: true
            }
          }
        }
      })
    ]);

    // 7. Create Sample Contractor
    console.log("🔧 Creating sample contractor...");
    const contractorUser = await prisma.user.create({
      data: {
        name: "RK Construction Services",
        email: "rk.construction@example.com", 
        phone: "9876543213",
        role: "CONTRACTOR",
        verified: true,
        contractor: {
          create: {
            businessName: "RK Construction Services Pvt Ltd",
            panNumber: "ABCDE1234F",
            gstNumber: "20ABCDE1234F1Z5", 
            registrationNo: "JH/2024/CON/001",
            isVerified: true,
            avgRating: 4.2,
            onTimeRate: 0.85
          }
        }
      }
    });

    console.log("✅ Database seeding completed successfully!");
    console.log(`
📊 Created:
  - ${2} Zones
  - ${wards.length} Wards
  - ${departments.length} Departments  
  - ${issueTypes.length} Issue Types
  - ${4} Admin Users (including contractor)
  - ${citizens.length} Citizens
  - ${1} Contractor
    `);

    console.log(`
🔑 Login Credentials:
  SuperAdmin: superadmin@janmarg.gov.in
  Admin: admin@ranchi.gov.in
  Moderator: moderator@ranchi.gov.in
  Contractor: rk.construction@example.com
    `);

  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run seeding
seedDatabase()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });