// netlify/functions/api.js - Netlify Function for API
import serverless from 'serverless-http';
import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";

// Import route files
import adminAuthRoutes from "../../routes/admin-auth.js";
import runRoutes from "../../routes/run.js";
import reportRoutes from "../../routes/report.js";
import adminRoutes from "../../routes/admin.js";
import dashboardRoutes from "../../routes/dashboard.js";
import loginRoutes from "../../routes/login.js";
import zoneRoutes from "../../routes/zone.js";
import userFeedRoutes from "../../routes/user-feed.js";
import reportTrackingRoutes from "../../routes/report-tracking.js";

// Load environment variables
dotenv.config();

const app = express();

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS configuration for Netlify
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true
}));

// Simple logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Routes with /api prefix removed since Netlify will handle that
app.use("/auth", adminAuthRoutes);
app.use("/run", runRoutes);
app.use("/reports", reportRoutes);
app.use("/admin", adminRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/login", loginRoutes);
app.use("/zones", zoneRoutes);
app.use("/feed", userFeedRoutes);
app.use("/track", reportTrackingRoutes);

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    message: "JanMarg Backend API Server (Netlify)",
    version: "1.0.0",
    status: "running",
    timestamp: new Date().toISOString(),
    environment: "netlify"
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.status === 500 ? "Internal server error" : err.message
  });
});

// Export the serverless function
export const handler = serverless(app);