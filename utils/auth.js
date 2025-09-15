// Authentication utility functions for JanMarg Backend

const FAKE_USERS = [
  { 
    id: "admin", 
    password: "admin123", 
    role: "ADMIN", 
    username: "Admin User", 
    token: "fake-jwt-token-admin",
    email: "admin@janmarg.gov.in"
  },
  { 
    id: "superAdmin", 
    password: "superAdmin1", 
    role: "SUPERADMIN", 
    username: "Super Admin", 
    token: "fake-jwt-token-superadmin",
    email: "superadmin@janmarg.gov.in"
  },
  { 
    id: "moderator", 
    password: "mod123", 
    role: "MODERATOR", 
    username: "Moderator User", 
    token: "fake-jwt-token-moderator",
    email: "moderator@janmarg.gov.in"
  },
  { 
    id: "citizen1", 
    password: "citizen123", 
    role: "CITIZEN", 
    username: "Citizen User", 
    token: "fake-jwt-token-citizen",
    email: "citizen@example.com"
  }
];

/**
 * Map token to user information
 * @param {string} token - Authentication token
 * @returns {object|null} User object or null if invalid token
 */
export const getUserFromToken = (token) => {
  if (!token) return null;
  
  const user = FAKE_USERS.find(u => u.token === token);
  if (!user) return null;
  
  // Return user without password
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

/**
 * Validate user credentials
 * @param {string} id - User identifier
 * @param {string} password - User password
 * @returns {object|null} User object or null if invalid credentials
 */
export const validateCredentials = (id, password) => {
  const user = FAKE_USERS.find(u => u.id === id && u.password === password);
  if (!user) return null;
  
  // Return user without password
  const { password: pwd, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

/**
 * Check if user has required role
 * @param {string} userRole - User's role
 * @param {array} requiredRoles - Array of required roles
 * @returns {boolean} True if user has required role
 */
export const hasRequiredRole = (userRole, requiredRoles = []) => {
  if (requiredRoles.length === 0) return true;
  return requiredRoles.includes(userRole);
};

/**
 * Get all available test users (for documentation)
 * @returns {array} Array of users without passwords
 */
export const getTestUsers = () => {
  return FAKE_USERS.map(user => {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  });
};

/**
 * Authentication middleware factory
 * @param {array} requiredRoles - Array of roles that can access the route
 * @returns {function} Express middleware function
 */
export const authenticate = (requiredRoles = []) => {
  return (req, res, next) => {
    // Try to get token from cookie first, then from Authorization header
    let token = req.cookies?.token;
    
    // If no cookie, try Authorization header (for Postman)
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: "No authentication token provided. Please login first.",
        hint: "Send token in cookie 'token' or Authorization header 'Bearer <token>'"
      });
    }
    
    // Get user from token
    const user = getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid or expired token" 
      });
    }
    
    // Check role permissions
    if (!hasRequiredRole(user.role, requiredRoles)) {
      return res.status(403).json({ 
        success: false, 
        message: `Access denied. Required roles: ${requiredRoles.join(', ')}. Your role: ${user.role}` 
      });
    }
    
    // Attach user to request
    req.user = user;
    next();
  };
};

export default {
  getUserFromToken,
  validateCredentials,
  hasRequiredRole,
  getTestUsers,
  authenticate
};