# 🚀 JanMarg MVP API Testing Guide

## 📋 **Complete API Routes Overview**

Your JanMarg backend is now running with all routes implemented! Here's your complete testing guide.

---

## 🔐 **Authentication (Simplified MVP)**

### **Login**
```bash
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "id": "admin",
  "password": "admin123"
}
```

**Available Test Users:**
- **Admin**: `id: "admin"`, `password: "admin123"`
- **Citizen**: `id: "citizen"`, `password: "citizen123"`  
- **Moderator**: `id: "moderator"`, `password: "mod123"`

**Response:**
```json
{
  "success": true,
  "data": {
    "username": "Admin User",
    "role": "ADMIN",
    "userId": "admin",
    "token": "base64_encoded_token"
  }
}
```

---

## 📱 **Citizen Report Routes** (`/api/reports`)

### **1. Create Report**
```bash
POST http://localhost:3000/api/reports
Authorization: Bearer YOUR_CITIZEN_TOKEN
Content-Type: application/json

{
  "title": "Pothole on Main Street",
  "description": "Large pothole causing traffic issues",
  "latitude": 23.3441,
  "longitude": 85.3096,
  "address": "Main Street, Ranchi",
  "severity": 4,
  "issueTypeId": "issue_type_id_here"
}
```

### **2. List Reports**
```bash
GET http://localhost:3000/api/reports?page=1&limit=10&status=OPEN
```

### **3. Get Single Report**
```bash
GET http://localhost:3000/api/reports/REPORT_ID
```

### **4. Edit Report**
```bash
PATCH http://localhost:3000/api/reports/REPORT_ID
Authorization: Bearer YOUR_CITIZEN_TOKEN
Content-Type: application/json

{
  "title": "Updated title",
  "description": "Updated description",
  "severity": 5
}
```

### **5. Delete Report**
```bash
DELETE http://localhost:3000/api/reports/REPORT_ID
Authorization: Bearer YOUR_CITIZEN_TOKEN
```

---

## 👍 **Report Engagement Routes**

### **6. Upvote Report**
```bash
POST http://localhost:3000/api/reports/REPORT_ID/upvote
Authorization: Bearer YOUR_CITIZEN_TOKEN
```

### **7. Subscribe to Report**
```bash
POST http://localhost:3000/api/reports/REPORT_ID/subscribe
Authorization: Bearer YOUR_CITIZEN_TOKEN
```

### **8. Unsubscribe from Report**
```bash
DELETE http://localhost:3000/api/reports/REPORT_ID/subscribe
Authorization: Bearer YOUR_CITIZEN_TOKEN
```

### **9. Mark as Duplicate**
```bash
POST http://localhost:3000/api/reports/REPORT_ID/duplicate
Authorization: Bearer YOUR_MODERATOR_TOKEN
Content-Type: application/json

{
  "duplicateOfId": "ORIGINAL_REPORT_ID"
}
```

---

## 🛠️ **Admin Report Management** (`/api/admin`)

### **10. Get Admin Reports**
```bash
GET http://localhost:3000/api/admin/reports?status=OPEN&page=1&limit=20
Authorization: Bearer YOUR_ADMIN_TOKEN
```

### **11. Update Report Status**
```bash
PATCH http://localhost:3000/api/admin/reports/REPORT_ID/status
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "status": "IN_PROGRESS",
  "comment": "Work has been started on this issue"
}
```

### **12. Assign Report**
```bash
PATCH http://localhost:3000/api/admin/reports/REPORT_ID/assign
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "contractorId": "CONTRACTOR_ID",
  "departmentId": "DEPARTMENT_ID",
  "deadline": "2024-12-31T23:59:59.000Z",
  "notes": "High priority assignment"
}
```

### **13. Moderate Report**
```bash
PATCH http://localhost:3000/api/admin/reports/REPORT_ID/moderate
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "action": "FLAG_SPAM",
  "reason": "Inappropriate content",
  "isSpam": true
}
```

### **14. Escalate Report**
```bash
PATCH http://localhost:3000/api/admin/reports/REPORT_ID/escalate
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "reason": "Critical infrastructure issue",
  "urgentFlag": true
}
```

### **15. Dashboard Stats**
```bash
GET http://localhost:3000/api/admin/dashboard/stats?wardId=WARD_ID
Authorization: Bearer YOUR_ADMIN_TOKEN
```

---

## 🔧 **Additional Utility Routes**

### **16. User Management**
```bash
# Create Citizen (from your existing /api/run routes)
POST http://localhost:3000/api/run/create-citizen
Content-Type: application/json

{
  "name": "Test Citizen",
  "email": "test@example.com",
  "phone": "9876543210"
}
```

### **17. Get Zones**
```bash
GET http://localhost:3000/api/zones
```

### **18. User Feed**
```bash
GET http://localhost:3000/api/feed?limit=10
Authorization: Bearer YOUR_CITIZEN_TOKEN
```

### **19. Track Report**
```bash
GET http://localhost:3000/api/track/REPORT_ID
```

---

## 🧪 **Complete Testing Workflow**

### **Step 1: Setup Authentication**
1. Login as admin: `POST /api/auth/login`
2. Save the token from response
3. Use token in `Authorization: Bearer TOKEN` header

### **Step 2: Create Test Data**
1. Create some citizens: `POST /api/run/create-citizen`
2. Login as citizen and get citizen token
3. Create sample reports: `POST /api/reports`

### **Step 3: Test Citizen Workflow**
1. List reports: `GET /api/reports`
2. View single report: `GET /api/reports/ID`
3. Upvote report: `POST /api/reports/ID/upvote`
4. Subscribe: `POST /api/reports/ID/subscribe`
5. Edit own report: `PATCH /api/reports/ID`

### **Step 4: Test Admin Workflow**
1. Login as admin
2. View admin reports: `GET /api/admin/reports`
3. Update status: `PATCH /api/admin/reports/ID/status`
4. Assign to contractor: `PATCH /api/admin/reports/ID/assign`
5. View dashboard: `GET /api/admin/dashboard/stats`

---

## ✅ **Status Codes & Responses**

### **Success Responses:**
- **200** - OK (GET, PATCH operations)
- **201** - Created (POST operations)

### **Error Responses:**
- **400** - Bad Request (validation errors)
- **401** - Unauthorized (no/invalid token)
- **403** - Forbidden (insufficient permissions)
- **404** - Not Found (resource doesn't exist)
- **409** - Conflict (duplicate data)
- **500** - Internal Server Error

### **Standard Response Format:**
```json
{
  "success": true/false,
  "message": "Description",
  "data": {} // Only in success responses
}
```

---

## 🎯 **Key Features Implemented**

✅ **Authentication**: Simplified fake JWT system for MVP  
✅ **Report CRUD**: Full create, read, update, delete for reports  
✅ **Report Engagement**: Upvote, subscribe, unsubscribe  
✅ **Admin Management**: Status updates, assignments, moderation  
✅ **Role-based Access**: Different permissions for different roles  
✅ **Audit Trail**: Complete history tracking for all changes  
✅ **Dashboard Stats**: Basic analytics for admin dashboard  
✅ **Error Handling**: Comprehensive error responses  

---

## 🚀 **Next Steps for Full Implementation**

1. **File Upload**: Add image/video upload for reports
2. **Real Authentication**: Replace fake JWT with proper auth
3. **Push Notifications**: Real-time updates for subscribed users
4. **Geolocation**: Auto-assign wards based on coordinates
5. **Advanced Search**: Full-text search and filtering
6. **Analytics**: More detailed reporting and insights

Your **JanMarg MVP Backend** is now fully functional and ready for testing! 🎉