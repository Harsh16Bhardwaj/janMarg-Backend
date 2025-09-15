# JanMarg Backend - Comprehensive Logging System

## Overview
The JanMarg backend now features a comprehensive logging system using **Winston** and **Morgan** that captures all API calls, errors, security events, and performance metrics.

## Logging Architecture

### 🗂️ Log Files Created
- **`logs/combined.log`** - All application logs (info level and above)
- **`logs/error.log`** - Error logs only
- **`logs/api-access.log`** - Detailed API request/response logs
- **`logs/database.log`** - Database operation logs

### 📊 What Gets Logged

#### API Request Logging (Morgan + Winston)
- **Request Method** (GET, POST, PUT, DELETE, etc.)
- **Full URL** and query parameters
- **Request Body** (with password redaction)
- **Response Status Code**
- **Response Time** in milliseconds
- **Client IP Address**
- **User Agent** (browser/client info)
- **User ID and Role** (when authenticated)
- **Response Size** in bytes

#### Application Events (Winston)
- **Server startup/shutdown**
- **Authentication events** (login, logout, token validation)
- **Security events** (failed logins, unauthorized access attempts)
- **Database operations** with execution time
- **Report activities** (creation, updates, status changes)
- **Ward management** activities
- **Admin actions** with justifications

#### Error Logging
- **Full error stack traces**
- **Request context** (URL, method, user, etc.)
- **Error categorization** (validation, database, system errors)
- **Performance issues** (slow requests > 1 second)

### 🚀 Features

#### Automatic Log Rotation
- **Max file size**: 5MB per log file
- **Max files**: 5-10 files per type (configurable)
- **Automatic cleanup** of old log files

#### Development vs Production
- **Development**: Console output + file logging with detailed formatting
- **Production**: File logging only with JSON format for log aggregation

#### Security & Privacy
- **Password redaction** in request bodies
- **Sensitive data filtering**
- **IP address tracking** for security auditing
- **User action attribution**

## Testing the Logging System

### 1. Check Log Files
```bash
# Navigate to logs directory
cd logs

# Check combined logs
tail -f combined.log

# Check API access logs  
tail -f api-access.log

# Check error logs
tail -f error.log
```

### 2. Make API Calls
Try making various API calls to see logging in action:

```bash
# Health check
curl http://localhost:3000/

# Get all wards
curl http://localhost:3000/api/zones

# Test authentication
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"id":"admin","password":"admin123"}'

# Test protected route
curl http://localhost:3000/api/admin/reports \
  -H "Cookie: token=fake-jwt-token-admin"
```

### 3. Generate Different Log Types
- **Successful requests** → Info logs
- **404 errors** → Warning logs with route not found
- **500 errors** → Error logs with full stack traces
- **Slow requests** → Performance warning logs
- **Authentication failures** → Security event logs

## Log Format Examples

### API Access Log
```json
{
  "timestamp": "2025-09-15 13:57:39",
  "level": "http",
  "message": "GET /api/zones 200 45ms",
  "service": "janmarg-backend",
  "method": "GET",
  "url": "/api/zones",
  "ip": "::1",
  "userAgent": "curl/7.68.0",
  "statusCode": 200,
  "responseTime": "45ms",
  "userId": "admin",
  "userRole": "ADMIN"
}
```

### Error Log
```json
{
  "timestamp": "2025-09-15 13:57:39",
  "level": "error",
  "message": "Database connection failed",
  "service": "janmarg-backend",
  "error": {
    "name": "PrismaClientInitializationError",
    "message": "Connection timed out",
    "stack": "..."
  },
  "context": {
    "method": "GET",
    "url": "/api/reports",
    "userId": "admin"
  }
}
```

### Security Event Log
```json
{
  "timestamp": "2025-09-15 13:57:39",
  "level": "warn",
  "message": "Security Event",
  "service": "janmarg-backend",
  "event": "UNAUTHORIZED_ACCESS",
  "ip": "192.168.1.100",
  "userAgent": "suspicious-bot/1.0",
  "url": "/api/admin/reports",
  "userId": null
}
```

## Performance Monitoring

### Slow Request Detection
Requests taking longer than 1 second are automatically flagged:
```json
{
  "level": "warn",
  "message": "Slow API Request",
  "responseTime": "2500ms",
  "url": "/api/admin/analytics/dashboard",
  "statusCode": 200
}
```

### Database Operation Tracking
```json
{
  "level": "debug",
  "message": "Database Operation",
  "operation": "findMany",
  "model": "Report",
  "executionTime": "125ms"
}
```

## Integration with Existing Systems

The logging system integrates seamlessly with:
- **Existing audit trails** (ReportHistory, AdminLog, AuditLog)
- **Authentication middleware**
- **Error handling middleware**
- **Ward management system**
- **Report tracking system**

## Production Considerations

### Log Aggregation
In production, consider using:
- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Splunk** for enterprise logging
- **Datadog** or **New Relic** for APM
- **Fluentd** for log forwarding

### Security
- Ensure log files are properly secured
- Consider log encryption for sensitive data
- Implement proper log retention policies
- Monitor log file disk usage

### Performance
- Log rotation prevents disk space issues
- Asynchronous logging prevents blocking
- Consider log level optimization for production

The logging system is now fully operational and will capture all API activity for monitoring, debugging, and security purposes! 🚀