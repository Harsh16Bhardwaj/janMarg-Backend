# 🚀 JanMarg API Testing Guide

## 📋 **API Endpoints Overview**

### 🔐 **Authentication Routes** (`/api/auth`)
- `POST /api/auth/login` - Admin login

### 👥 **User Management Routes** (`/api/run`)
- `POST /api/run/create-citizen` - Create citizen user
- `POST /api/run/create-admin` - Create admin user (requires SUPERADMIN)
- `POST /api/run/create-bulk-citizens` - Bulk create citizens
- `GET /api/run/users` - Get users with filtering
- `PUT /api/run/users/:id/verify` - Verify user

---

## 🔧 **Postman Collection Setup**

### **1. Admin Login**
```
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "id": "superadmin",
  "password": "super123"
}
```

**Response:**
```json
{
  "username": "Super Admin",
  "role": "superadmin",
  "authToken": "jwt_token_here"
}
```

### **2. Create Citizen User**
```
POST http://localhost:3000/api/run/create-citizen
Content-Type: application/json

{
  "name": "Rajesh Kumar",
  "email": "rajesh.kumar@example.com",
  "phone": "9876543210",
  "address": "123 Main Street, Ranchi",
  "aadhaarNumber": "123456789012"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Citizen user created successfully",
  "data": {
    "id": "user_id",
    "name": "Rajesh Kumar",
    "email": "rajesh.kumar@example.com",
    "phone": "9876543210",
    "role": "CITIZEN",
    "verified": false,
    "ward": null,
    "authToken": "jwt_token_here",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### **3. Create Admin User** (Requires SUPERADMIN auth)
```
POST http://localhost:3000/api/run/create-admin
Content-Type: application/json
Authorization: Bearer YOUR_SUPERADMIN_TOKEN

{
  "name": "Ward Admin",
  "email": "admin@ranchi.gov.in",
  "phone": "9876543211",
  "role": "ADMIN",
  "wardIds": ["ward_id_1", "ward_id_2"],
  "password": "custom_password123"
}
```

### **4. Get Users with Filtering**
```
GET http://localhost:3000/api/run/users?role=CITIZEN&page=1&limit=10&search=rajesh
Authorization: Bearer YOUR_ADMIN_TOKEN
```

### **5. Verify User**
```
PUT http://localhost:3000/api/run/users/USER_ID/verify
Content-Type: application/json
Authorization: Bearer YOUR_ADMIN_TOKEN

{
  "verified": true
}
```

---

## 🏛️ **Municipal Structure Implementation**

### **Issue Categories (Based on Jharkhand Municipal Structure):**

1. **Roads & Infrastructure**
   - Potholes, road damage, construction issues
   - Department: Public Works Department (PWD)

2. **Water Supply**
   - Water shortage, pipe leakage, quality issues
   - Department: Public Health Engineering Department (PHED)

3. **Sanitation & Waste Management**
   - Garbage collection, open drains, public toilets
   - Department: Health & Sanitation

4. **Electricity & Street Lights**
   - Street light issues, power cuts, electrical hazards
   - Department: Electrical Department

5. **Drainage**
   - Waterlogging, drain blockage, sewage overflow
   - Department: Engineering Department

6. **Parks & Environment**
   - Tree cutting, park maintenance, pollution
   - Department: Horticulture Department

### **Accountability Layers:**

#### **Level 1: Ward Level**
- **Ward Councillor** (Elected) - Policy decisions
- **Ward Officer** (Administrative) - Day-to-day operations
- **Field Staff** - Ground-level execution

#### **Level 2: Municipal Level**
- **Mayor/Chairperson** - Overall governance
- **Municipal Commissioner** - Administration head
- **Department Heads** - Specialized services

#### **Level 3: District Level**
- **District Collector** - Coordination with state
- **District Urban Development Agency** - Implementation oversight

#### **Level 4: State Level**
- **Urban Development Department** - Policy formulation
- **JUIDCO** - Infrastructure development
- **SUDA** - Technical assistance

### **Resolution Mechanism:**

#### **In-House Services:**
- Basic maintenance (cleaning, minor repairs)
- Inspection and monitoring
- Administrative processing

#### **Outsourced Services:**
- **Contractors** - Major construction, specialized repairs
- **Self Help Groups** - Community-based solutions
- **Private Agencies** - Waste collection, security

#### **Bidding System:**
- **Tender Process** - For projects > ₹50,000
- **Direct Assignment** - For urgent/small tasks
- **Community Participation** - For validation and feedback

---

## 🔐 **Authentication Flow**

### **Admin Users:**
1. Login with `id` and `password`
2. Receive JWT token with role-based permissions
3. Use token for protected operations

### **Citizens:**
1. Register through mobile app or web
2. Email/phone verification
3. Ward assignment (optional)
4. Access to report creation and tracking

---

## 📊 **Data Structure Highlights**

### **User Roles Hierarchy:**
- **SUPERADMIN** - System administration
- **ADMIN** - Municipal administration
- **MODERATOR** - Ward-level moderation
- **CONTRACTOR** - Service providers
- **CITIZEN** - General users

### **Report Status Flow:**
```
OPEN → VALIDATED → IN_BIDDING → ASSIGNED → IN_PROGRESS → 
PENDING_CITIZEN_REVIEW → COMPLETED → VERIFIED → CLOSED
```

### **Audit Trail:**
- Every action logged in `AdminLog`
- Complete report timeline in `ReportHistory`
- User activity tracking in `AuditLog`

---

## 🧪 **Testing Scenarios**

### **Scenario 1: Complete Admin Workflow**
1. Login as SUPERADMIN
2. Create ward admins
3. Create moderators
4. Assign wards to officials

### **Scenario 2: Citizen Onboarding**
1. Create citizen accounts
2. Assign to wards
3. Verify users
4. Enable report creation

### **Scenario 3: Bulk Operations**
1. Bulk create citizens from CSV data
2. Assign multiple users to wards
3. Bulk verification process

---

## 📋 **Environment Setup Checklist**

- [ ] MongoDB running
- [ ] Environment variables configured
- [ ] Prisma client generated
- [ ] Dependencies installed
- [ ] Server running on port 3000

## 🚨 **Error Handling**

The API includes comprehensive error handling:
- Input validation errors (400)
- Authentication errors (401)
- Authorization errors (403)
- Resource not found (404)
- Duplicate entries (409)
- Server errors (500)

All errors return consistent JSON format:
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error (development only)"
}
```