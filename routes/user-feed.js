// User feed routes - MVP placeholder
import express from "express";
import { PrismaClient } from "../generated/prisma/index.js";
import { authenticate } from "./admin-auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// Get user feed of recent reports
router.get("/", authenticate(["CITIZEN"]), async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const reports = await prisma.report.findMany({
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        issueType: { select: { title: true } },
        ward: { select: { name: true } },
        reporter: { select: { name: true } },
        _count: {
          select: { reactions: true, comments: true }
        }
      }
    });

    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch user feed"
    });
  }
});

export default router;
