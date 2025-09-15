import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";

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

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// Simple logging middleware for production
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const userAgent = req.get('User-Agent') || 'Unknown';
  const ip = req.ip || req.connection.remoteAddress;
  
  console.log(`${timestamp} - ${method} ${url} - IP: ${ip} - UA: ${userAgent.substring(0, 50)}`);
  next();
});

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
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use("*", (req, res) => {
  console.warn(`Route not found: ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error occurred:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
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
    timestamp: new Date().toISOString()
  };
  
  console.log(`🚀 JanMarg Backend Server running at http://localhost:${port}`);
  console.log(`📊 Environment: ${serverInfo.environment}`);
  console.log(`🔗 API Base URL: ${serverInfo.apiBaseUrl}`);
  console.log(`🔍 Simple Logging: Enabled`);
  console.log(`⏰ Started at: ${serverInfo.timestamp}`);
});

export default app;