import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";

// Import logging configuration
import logger from "./config/logger.js";
import { apiLogger, consoleLogger, errorLogger, timingLogger } from "./config/morgan.js";

// Import all route files
import adminAuthRoutes from "./routes/admin-auth.js";
import runRoutes from "./routes/run.js";
import reportRoutes from "./routes/report.js";
import adminRoutes from "./routes/admin.js";
import dashboardRoutes from "./routes/dashboard.js";
import loginRoutes from "./routes/login.js";
import zoneRoutes from "./routes/zone.js";
import userFeedRoutes from "./routes/user-feed.js";
import reportTrackingRoutes from "./routes/report-tracking.js";

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Logging middleware (must be early in the middleware stack)
app.use(consoleLogger); // Console logging for development
app.use(apiLogger); // Detailed API logging to files
app.use(timingLogger); // Request timing and performance logging

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

// Routes
app.use("/api/auth", adminAuthRoutes);
app.use("/api/run", runRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/login", loginRoutes);
app.use("/api/zones", zoneRoutes);
app.use("/api/feed", userFeedRoutes);
app.use("/api/track", reportTrackingRoutes);

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    message: "JanMarg Backend API Server",
    version: "1.0.0",
    status: "running",
    timestamp: new Date().toISOString()
  });
});

// 404 handler with logging
app.use("*", (req, res) => {
  logger.warn('Route not found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id
  });
  
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

// Error logging middleware
app.use(errorLogger);

// Global error handler
app.use((err, req, res, next) => {
  // Error is already logged by errorLogger middleware
  
  res.status(err.status || 500).json({
    success: false,
    message: err.status === 500 ? "Internal server error" : err.message,
    error: process.env.NODE_ENV === "development" ? {
      message: err.message,
      stack: err.stack
    } : undefined
  });
});

app.listen(port, () => {
  const serverInfo = {
    port,
    environment: process.env.NODE_ENV || 'development',
    apiBaseUrl: `http://localhost:${port}/api`,
    logsDirectory: './logs'
  };
  
  logger.info('JanMarg Backend Server Started', serverInfo);
  
  // Console output for immediate feedback
  console.log(`🚀 JanMarg Backend Server running at http://localhost:${port}`);
  console.log(`📊 Environment: ${serverInfo.environment}`);
  console.log(`🔗 API Base URL: ${serverInfo.apiBaseUrl}`);
  console.log(`📋 Logs Directory: ${serverInfo.logsDirectory}`);
  console.log(`🔍 API Logging: Enabled (Winston + Morgan)`);
});
