// Minimal MVP Auth System
import express from "express";
import { token } from "morgan";
const router = express.Router();

// Fake users for MVP
const FAKE_USERS = [
  { id: "admin", password: "admin123", role: "ADMIN", username: "Admin User", token: "fake-jwt-token-admin" },
  { id: "superAdmin", password: "superAdmin1", role: "SUPERADMIN", username: "Citizen User", token: "fake-jwt-token-citizen" },
  { id: "moderator", password: "mod123", role: "MODERATOR", username: "Moderator User", token: "fake-jwt-token-moderator" },
];

// Fake JWT for MVP - just use user data directly
router.post("/", (req, res) => {
  const { id, password } = req.body;
  
  const user = FAKE_USERS.find(u => u.id === id && u.password === password);
  if (!user) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  // Fake token - just base64 encode user data
  const fakeToken = Buffer.from(JSON.stringify({id: user.id, role: user.role})).toString('base64');

  res.json({
    success: true,
    data: {
      username: user.username,
      role: user.role,
      userId: user.id,
      token: fakeToken
    }
  });
});

// Minimal auth middleware
export const authenticate = (requiredRoles = []) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    try {
      // Decode fake token
      const token = authHeader.replace('Bearer ', '');
      const userData = JSON.parse(Buffer.from(token, 'base64').toString());
      
      if (requiredRoles.length > 0 && !requiredRoles.includes(userData.role)) {
        return res.status(403).json({ success: false, message: "Insufficient permissions" });
      }
      
      req.user = userData;
      next();
    } catch (error) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }
  };
};

export default router;
