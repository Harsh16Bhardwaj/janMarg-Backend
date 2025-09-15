// Simple server test without winston
import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";

// Import route files
import adminAuthRoutes from "./routes/admin-auth.js";

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
  credentials: true
}));

// Basic logging middleware (simple console logging)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Routes
app.use("/api/auth", adminAuthRoutes);

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    message: "JanMarg Backend API Server (Basic)",
    version: "1.0.0",
    status: "running",
    timestamp: new Date().toISOString()
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

app.listen(port, () => {
  console.log(`🚀 JanMarg Backend Server running at http://localhost:${port}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API Base URL: http://localhost:${port}/api`);
  console.log(`🔍 Basic Logging: Enabled`);
});