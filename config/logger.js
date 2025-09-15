import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
import fs from 'fs';
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Create Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'janmarg-backend' },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // Write all logs with importance level of `info` or less to `combined.log`
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // Separate file for API access logs
    new winston.transports.File({
      filename: path.join(logsDir, 'api-access.log'),
      level: 'http',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    }),
    
    // Separate file for database operations
    new winston.transports.File({
      filename: path.join(logsDir, 'database.log'),
      level: 'debug',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  ],
});

// If we're not in production, log to the console as well
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        return `${timestamp} [${service}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
      })
    )
  }));
}

// Create a stream object for Morgan
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

// Custom logging methods for different types of operations
logger.apiRequest = (req, res, responseTime) => {
  logger.http('API Request', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userId: req.user?.id,
    userRole: req.user?.role,
    body: req.method !== 'GET' ? req.body : undefined,
    query: Object.keys(req.query).length > 0 ? req.query : undefined
  });
};

logger.dbOperation = (operation, model, data, executionTime) => {
  logger.debug('Database Operation', {
    operation,
    model,
    data: typeof data === 'object' ? JSON.stringify(data) : data,
    executionTime: executionTime ? `${executionTime}ms` : undefined
  });
};

logger.authEvent = (event, userId, details) => {
  logger.info('Authentication Event', {
    event,
    userId,
    ...details
  });
};

logger.error = (message, error, context = {}) => {
  logger.log('error', message, {
    error: {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    },
    ...context
  });
};

logger.security = (event, details) => {
  logger.warn('Security Event', {
    event,
    timestamp: new Date().toISOString(),
    ...details
  });
};

export default logger;