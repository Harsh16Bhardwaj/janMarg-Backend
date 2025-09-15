import fs from 'fs';
import path from 'path';

// Create the Netlify function directory if it doesn't exist
const functionsDir = './netlify/functions';
if (!fs.existsSync(functionsDir)) {
  fs.mkdirSync(functionsDir, { recursive: true });
}

// Create the serverless function wrapper
const netlifyFunctionCode = `import serverless from 'serverless-http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

// Import route files
import adminAuthRoutes from '../../routes/admin-auth.js';
import runRoutes from '../../routes/run.js';
import reportRoutes from '../../routes/report.js';
import adminRoutes from '../../routes/admin.js';
import dashboardRoutes from '../../routes/dashboard.js';
import loginRoutes from '../../routes/login.js';
import zoneRoutes from '../../routes/zone.js';
import userFeedRoutes from '../../routes/user-feed.js';
import reportTrackingRoutes from '../../routes/report-tracking.js';

const app = express();

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS configuration for production
app.use(cors({
  origin: process.env.FRONTEND_URL || true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// Simple logging middleware
app.use((req, res, next) => {
  console.log(\`\${new Date().toISOString()} - \${req.method} \${req.originalUrl}\`);
  next();
});

// Routes
app.use('/api/auth', adminAuthRoutes);
app.use('/api/run', runRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/login', loginRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/feed', userFeedRoutes);
app.use('/api/track', reportTrackingRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'JanMarg Backend API Server',
    version: '1.0.0',
    status: 'running',
    environment: 'production',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.status === 500 ? 'Internal server error' : err.message
  });
});

// Export the serverless function
export const handler = serverless(app);
`;

// Write the Netlify function
fs.writeFileSync(path.join(functionsDir, 'server.js'), netlifyFunctionCode);

console.log('✅ Netlify function created successfully');
console.log('📁 Location: netlify/functions/server.js');
console.log('🚀 Ready for Netlify deployment');