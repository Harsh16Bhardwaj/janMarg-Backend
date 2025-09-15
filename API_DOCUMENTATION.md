# JanMarg Backend API Documentation

## Overview
JanMarg is a comprehensive civic issue reporting and management system. This backend provides APIs for citizens to report issues and administrators to manage them efficiently.

## Base URL
```
http://localhost:3000/api
```

## Authentication System

### How Authentication Works
1. **Login**: Send credentials to `/api/auth/login` to receive a token
2. **Cookie Storage**: Token is automatically stored in browser cookies
3. **API Access**: Token is sent with each request (cookie or Authorization header)
4. **Role-Based Access**: Different endpoints require different user roles

### Available Test Users
| User ID | Password | Role | Purpose |
|---------|----------|------|---------|
| `admin` | `admin123` | ADMIN | General administration |
| `superAdmin` | `superAdmin1` | SUPERADMIN | Full system access |
| `moderator` | `mod123` | MODERATOR | Content moderation |
| `citizen1` | `citizen123` | CITIZEN | Regular user |

---

## Authentication Endpoints

### 1. Login
**POST** `/api/auth/login`

Login and receive authentication token.

**Request Body:**
```json
{
  "id": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "admin",
      "username": "Admin User",
      "role": "ADMIN",
      "email": "admin@janmarg.gov.in"
    },
    "token": "fake-jwt-token-admin",
    "cookieSet": true
  },
  "instructions": {
    "postman": "Token is now available in cookies. For API testing, copy the token and use it in Authorization header as 'Bearer <token>'",
    "browser": "Token is automatically set in cookies and will be sent with subsequent requests"
  }
}
```

**Cookie Set:** `token=fake-jwt-token-admin; Path=/; Max-Age=86400000`

### 2. Get Current User
**GET** `/api/auth/me`

Get information about currently authenticated user.

**Headers:**
```
Authorization: Bearer fake-jwt-token-admin
```

**Response:**
```json
{
  "success": true,
  "message": "Current user information",
  "data": {
    "user": {
      "id": "admin",
      "username": "Admin User",
      "role": "ADMIN",
      "email": "admin@janmarg.gov.in"
    },
    "authenticated": true,
    "timestamp": "2025-09-15T10:30:00.000Z"
  }
}
```

### 3. Logout
**POST** `/api/auth/logout`

Clear authentication token.

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully",
  "instructions": "Authentication token has been cleared from cookies"
}
```

### 4. Get Test Users
**GET** `/api/auth/test-users`

List all available test users for development.

**Response:**
```json
{
  "success": true,
  "message": "Available test users for development",
  "data": [
    {
      "id": "admin",
      "username": "Admin User",
      "role": "ADMIN",
      "token": "fake-jwt-token-admin",
      "email": "admin@janmarg.gov.in"
    }
  ],
  "note": "Use these credentials with POST /api/auth/login"
}
```

---

## Report Management Endpoints

### 1. Create Report
**POST** `/api/reports`

Citizens can create new issue reports.

**Authorization:** `CITIZEN` role required

**Request Body:**
```json
{
  "title": "Pothole on Main Street",
  "description": "Large pothole causing traffic issues",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "address": "Main Street, Block A",
  "wardId": "ward-123",
  "issueTypeId": "issue-type-456",
  "severity": 8
}
```

### 2. Get All Reports
**GET** `/api/reports`

Get list of reports with filtering options.

**Query Parameters:**
- `status` - Filter by report status
- `wardId` - Filter by ward
- `severity` - Minimum severity level
- `limit` - Number of results (default: 20)
- `offset` - Pagination offset (default: 0)

### 3. Get Report Details
**GET** `/api/reports/:id`

Get detailed information about a specific report.

### 4. Update Report
**PATCH** `/api/reports/:id`

Update report details (only by report owner).

**Authorization:** `CITIZEN` role required

---

## Admin Management Endpoints

### 1. Get Admin Reports
**GET** `/api/admin/reports`

Comprehensive report management for administrators.

**Authorization:** `ADMIN`, `MODERATOR` roles required

**Query Parameters:**
- `status` - Filter by status
- `wardId` - Filter by ward
- `departmentId` - Filter by department
- `search` - Search in titles/descriptions
- `startDate` - Filter from date
- `endDate` - Filter to date
- `priority` - Filter by priority score

### 2. Update Report Status
**PATCH** `/api/admin/reports/:id/status`

Change report status with mandatory justification.

**Authorization:** `ADMIN`, `MODERATOR` roles required

**Request Body:**
```json
{
  "status": "IN_PROGRESS",
  "justification": "Assigning to road maintenance team for immediate action"
}
```

### 3. Assign Report
**PATCH** `/api/admin/reports/:id/assign`

Assign report to contractor or department.

**Authorization:** `ADMIN`, `MODERATOR` roles required

**Request Body:**
```json
{
  "contractorId": "contractor-123",
  "deadline": "2025-09-30T00:00:00.000Z",
  "justification": "Contractor has relevant experience and availability"
}
```

---

## Ward Management Endpoints

### 1. Create Ward
**POST** `/api/zones`

Create new administrative ward.

**Authorization:** `ADMIN`, `SUPERADMIN` roles required

**Request Body:**
```json
{
  "name": "Ward 15",
  "state": "Delhi",
  "district": "Central Delhi"
}
```

### 2. Get All Wards
**GET** `/api/zones`

List all wards with optional statistics.

**Query Parameters:**
- `state` - Filter by state
- `district` - Filter by district
- `search` - Search in names
- `includeStats=true` - Include report statistics

### 3. Get Ward Details
**GET** `/api/zones/:wardId`

Detailed ward information with statistics and recent activity.

### 4. Ward Analytics
**GET** `/api/zones/:wardId/analytics`

Comprehensive analytics for a specific ward.

**Authorization:** `ADMIN`, `MODERATOR` roles required

**Query Parameters:**
- `timeframe` - Analysis period: `7d`, `30d`, `90d` (default: `30d`)

---

## Testing with Postman

### Step 1: Login
1. **POST** `http://localhost:3000/api/auth/login`
2. **Body (JSON):**
   ```json
   {
     "id": "admin",
     "password": "admin123"
   }
   ```
3. **Copy the token** from response

### Step 2: Set Authentication
**Option A: Authorization Header**
- Add header: `Authorization: Bearer fake-jwt-token-admin`

**Option B: Cookie (if Postman supports)**
- Cookie will be automatically set from login response

### Step 3: Test Protected Routes
- **GET** `http://localhost:3000/api/auth/me`
- **GET** `http://localhost:3000/api/admin/reports`
- **GET** `http://localhost:3000/api/zones`

---

## Error Responses

### Authentication Errors
```json
{
  "success": false,
  "message": "No authentication token provided. Please login first.",
  "hint": "Send token in cookie 'token' or Authorization header 'Bearer <token>'"
}
```

### Authorization Errors
```json
{
  "success": false,
  "message": "Access denied. Required roles: ADMIN, MODERATOR. Your role: CITIZEN"
}
```

### Validation Errors
```json
{
  "success": false,
  "message": "Both id and password are required"
}
```

---

## Role Hierarchy

1. **SUPERADMIN** - Full system access
2. **ADMIN** - Administrative functions, ward management
3. **MODERATOR** - Content moderation, report management
4. **CITIZEN** - Report creation and management

---

## Logging System

All API calls are automatically logged with:
- Request details (method, URL, headers)
- User information (ID, role)
- Response status and timing
- IP address and user agent
- Request/response bodies (sensitive data redacted)

**Log Files:**
- `logs/api-access.log` - All API requests
- `logs/combined.log` - General application logs
- `logs/error.log` - Error logs only
- `logs/database.log` - Database operations

---

## Development Notes

- **Environment**: Development mode with detailed logging
- **Database**: MongoDB with Prisma ORM
- **Authentication**: Simple token-based (MVP implementation)
- **CORS**: Enabled for local development
- **Cookie Settings**: Configured for Postman compatibility

---

## Quick Start

1. **Start Server:**
   ```bash
   cd d:\JanMargBackend
   node server.js
   ```

2. **Test Authentication:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"id":"admin","password":"admin123"}'
   ```

3. **Test Protected Route:**
   ```bash
   curl -X GET http://localhost:3000/api/auth/me \
     -H "Authorization: Bearer fake-jwt-token-admin"
   ```

The server will start on `http://localhost:3000` with comprehensive logging enabled.