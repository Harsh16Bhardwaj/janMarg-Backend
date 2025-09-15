import express from 'express';
import { validateCredentials, getTestUsers } from '../utils/auth.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * Authenticate user and set token in cookie
 */
router.post("/login", (req, res) => {
  const { id, password } = req.body;
  
  // Validate required fields
  if (!id || !password) {
    return res.status(400).json({ 
      success: false, 
      message: "Both id and password are required" 
    });
  }
  
  // Validate credentials using utility function
  const user = validateCredentials(id, password);
  if (!user) {
    return res.status(401).json({ 
      success: false, 
      message: "Invalid credentials" 
    });
  }

  const token = user.token;

  // Set cookie for browser and also return token for Postman testing
  res.cookie('token', token, {
    httpOnly: false,  // Set to false for Postman testing
    secure: false,    // Set to false for local development
    sameSite: 'lax',  // More permissive for local development
    path: '/',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });

  res.json({
    success: true,
    message: "Login successful",
    data: {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email
      },
      token: token, // Include token for Postman testing
      cookieSet: true
    },
    instructions: {
      postman: "Token is now available in cookies. For API testing, copy the token and use it in Authorization header as 'Bearer <token>'",
      browser: "Token is automatically set in cookies and will be sent with subsequent requests"
    }
  });
});

/**
 * GET /api/auth/test-users
 * Get list of available test users for development
 */
router.get("/test-users", (req, res) => {
  res.json({
    success: true,
    message: "Available test users for development",
    data: getTestUsers(),
    note: "Use these credentials with POST /api/auth/login"
  });
});

/**
 * POST /api/auth/logout
 * Clear authentication cookie
 */
router.post("/logout", (req, res) => {
  res.clearCookie('token', {
    path: '/',
    sameSite: 'lax'
  });
  
  res.json({
    success: true,
    message: "Logged out successfully",
    instructions: "Authentication token has been cleared from cookies"
  });
});

/**
 * GET /api/auth/me
 * Get current user information
 */
import { authenticate } from '../utils/auth.js';
router.get("/me", authenticate(), (req, res) => {
  res.json({
    success: true,
    message: "Current user information",
    data: {
      user: req.user,
      authenticated: true,
      timestamp: new Date().toISOString()
    }
  });
});

// Export authenticate function for use in other routes
export { authenticate };

/**
 * GET /api/auth/admin-data
 * Example protected route for admins only
 */
router.get("/admin-data", authenticate(['ADMIN', 'SUPERADMIN']), (req, res) => {
  res.json({ 
    success: true, 
    message: "This is protected admin data",
    data: {
      secret: "Admin secret information",
      user: req.user.username,
      role: req.user.role,
      timestamp: new Date().toISOString()
    }
  });
});

export default router;