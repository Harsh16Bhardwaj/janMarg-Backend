// Dashboard Routes - MVP Implementation
import express from "express";
import { PrismaClient } from "../generated/prisma/index.js";
import { authenticate } from "./admin-auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// Basic dashboard route
router.get("/", authenticate(["ADMIN", "MODERATOR"]), (req, res) => {
  res.json({
    success: true,
    message: "Dashboard route - MVP implementation",
    data: {
      user: req.user,
      dashboardUrl: "/admin/dashboard"
    }
  });
});

export default router;