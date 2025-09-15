// Report tracking routes - MVP placeholder
import express from "express";
import { PrismaClient } from "../generated/prisma/index.js";
import { authenticate } from "./admin-auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// Track report status by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        history: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        issueType: { select: { title: true } },
        ward: { select: { name: true } }
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
      data: {
        id: report.id,
        title: report.title,
        status: report.status,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        timeline: report.history
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to track report"
    });
  }
});

export default router;
