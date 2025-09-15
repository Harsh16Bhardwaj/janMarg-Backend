import morgan from 'morgan';
import logger from './logger.js';

// Define custom Morgan token for user info
morgan.token('user-id', (req) => {
  return req.user?.id || 'anonymous';
});

morgan.token('user-role', (req) => {
  return req.user?.role || 'none';
});

morgan.token('real-ip', (req) => {
  return req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
});

morgan.token('request-body', (req) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return '';
  }
  
  // Don't log sensitive data
  if (req.body && req.body.password) {
    const sanitized = { ...req.body };
    sanitized.password = '[REDACTED]';
    return JSON.stringify(sanitized);
  }
  
  return req.body ? JSON.stringify(req.body) : '';
});

morgan.token('response-body-size', (req, res) => {
  return res.get('content-length') || '0';
});

// Custom format for detailed API logging
const detailedFormat = [
  '[:date[iso]]',
  ':real-ip',
  '":method :url HTTP/:http-version"',
  ':status',
  ':response-time ms',
  '":user-agent"',
  'User: :user-id (:user-role)',
  'Body: :request-body',
  'Size: :response-body-size bytes'
].join(' ');

// Simple format for console during development
const simpleFormat = ':method :url :status :response-time ms - :res[content-length]';

// Create different Morgan middleware for different environments
export const apiLogger = morgan(detailedFormat, {
  stream: logger.stream,
  skip: (req, res) => {
    // Skip logging for health check endpoints
    return req.url === '/' || req.url === '/health';
  }
});

export const consoleLogger = process.env.NODE_ENV === 'production' 
  ? morgan('combined')
  : morgan(simpleFormat);

// Error logging middleware
export const errorLogger = (err, req, res, next) => {
  logger.error('API Error', err, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    userRole: req.user?.role,
    body: req.body,
    query: req.query,
    params: req.params
  });
  
  next(err);
};

// Request/Response timing middleware
export const timingLogger = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    
    // Log slow requests (over 1 second)
    if (responseTime > 1000) {
      logger.warn('Slow API Request', {
        method: req.method,
        url: req.originalUrl,
        responseTime: `${responseTime}ms`,
        statusCode: res.statusCode,
        userId: req.user?.id
      });
    }
    
    // Use custom logging method
    logger.apiRequest(req, res, responseTime);
  });
  
  next();
};

// Security event logger
export const securityLogger = (event, req, details = {}) => {
  logger.security(event, {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    url: req.originalUrl,
    method: req.method,
    userId: req.user?.id,
    ...details
  });
};

export default {
  apiLogger,
  consoleLogger,
  errorLogger,
  timingLogger,
  securityLogger
};