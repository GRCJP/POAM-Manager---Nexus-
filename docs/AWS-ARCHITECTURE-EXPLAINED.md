# POAM Nexus - AWS Architecture Explained

**Understanding the Cloud Migration: Local vs Multi-User Cloud**

This guide explains WHY each AWS component is needed and HOW it transforms your local POAM tool into a multi-user cloud application.

**Last Updated:** March 10, 2026

---

## Current State: How Your Local App Works

### Your Local Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Browser                             │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  POAM Nexus (index.html + JavaScript)             │   │
│  │                                                    │   │
│  │  • Upload CSV scan files                          │   │
│  │  • Parse CSV in browser (PapaParse.js)           │   │
│  │  • Create POAMs from scan data                    │   │
│  │  • Store in IndexedDB (local browser storage)    │   │
│  │  • Display dashboard, metrics, reports            │   │
│  └────────────────────────────────────────────────────┘   │
│                          ↓                                  │
│  ┌────────────────────────────────────────────────────┐   │
│  │  IndexedDB (Browser Storage)                       │   │
│  │  • 500+ POAMs stored locally                       │   │
│  │  • Only YOU can see this data                      │   │
│  │  • Data lives on YOUR computer only                │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**How It Works:**
1. You open `http://localhost:8080` in your browser
2. You upload a Qualys/Nessus CSV file
3. JavaScript parses the CSV and creates POAMs
4. POAMs are saved to IndexedDB (browser's local database)
5. Dashboard shows metrics from IndexedDB
6. Everything runs **client-side** (in your browser)

**Limitations:**
- ❌ Only YOU can access the POAMs
- ❌ Engineers can't see their assigned POAMs
- ❌ Leadership can't view metrics
- ❌ Data is lost if you clear browser cache
- ❌ No collaboration or sharing
- ❌ No centralized management

---

## Cloud Architecture: Multi-User Shared System

### What Changes and Why

```
┌──────────────────────────────────────────────────────────────────┐
│                    Multiple Users                                │
│  (Engineers, System Owners, Leadership, You)                     │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│              CloudFront (Content Delivery)                       │
│  PURPOSE: Delivers the app fast to all users globally           │
│  REPLACES: Your local web server (localhost:8080)               │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│              API Gateway (Request Router)                        │
│  PURPOSE: Routes user requests to correct functions              │
│  REPLACES: Direct JavaScript → IndexedDB calls                   │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│              Lambda Functions (Business Logic)                   │
│  PURPOSE: Process requests, enforce permissions                  │
│  REPLACES: Your JavaScript functions (but with RBAC)            │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│              DynamoDB (Shared Database)                          │
│  PURPOSE: Store POAMs that EVERYONE can access                   │
│  REPLACES: IndexedDB (browser-only storage)                      │
└──────────────────────────────────────────────────────────────────┘
```

---

## Component-by-Component Explanation

### 1. DynamoDB - Shared POAM Database

**What It Replaces:** IndexedDB (browser local storage)

**Why You Need It:**
Your current app stores POAMs in IndexedDB, which is **local to your browser**. If an engineer opens the app, they see an empty database because IndexedDB is not shared.

**What It Does:**
- Stores all 500+ POAMs in a **centralized cloud database**
- Everyone connects to the **same database**
- Engineers see POAMs assigned to them
- Leadership sees all POAMs for metrics
- You can manage everything from one place

**Real-World Example:**
```
LOCAL (Current):
- You upload scan → 100 POAMs created → Stored in YOUR browser
- Engineer opens app → Sees 0 POAMs (different browser)
- Leadership opens app → Sees 0 POAMs (different browser)

CLOUD (With DynamoDB):
- You upload scan → 100 POAMs created → Stored in DynamoDB
- Engineer opens app → Sees 20 POAMs assigned to them
- Leadership opens app → Sees dashboard with all 100 POAMs
```

**How Your App Uses It:**
```javascript
// OLD (Local): Direct IndexedDB access
const poams = await window.poamDB.getAllPOAMs();

// NEW (Cloud): API call to Lambda → DynamoDB
const response = await fetch('https://api.example.com/poams', {
  headers: { 'Authorization': 'Bearer ' + userToken }
});
const poams = await response.json();
```

**Cost:** ~$25-50/month for 500 POAMs

---

### 2. Lambda Functions - Server-Side Logic

**What It Replaces:** Your JavaScript functions (but adds security)

**Why You Need It:**
Your current app runs all JavaScript in the browser. Anyone can open DevTools and see/modify the code. With Lambda, the business logic runs on AWS servers where users can't tamper with it.

**What It Does:**
- **Enforces permissions** - Engineers can only see their POAMs
- **Validates data** - Prevents invalid POAMs from being created
- **Processes requests** - Handles CRUD operations securely
- **Runs server-side** - Code is protected from tampering

**Real-World Example:**
```
LOCAL (Current):
- Engineer opens DevTools
- Runs: window.poamDB.getAllPOAMs()
- Sees ALL 500 POAMs (including ones not assigned to them)

CLOUD (With Lambda):
- Engineer calls API: GET /poams
- Lambda checks: "Is this user an engineer?"
- Lambda filters: "Only return POAMs where pocId = engineer's ID"
- Engineer sees only their 20 POAMs
```

**Lambda Functions You'll Have:**

| Function | Purpose | Example |
|----------|---------|---------|
| `list-poams` | Get POAMs with RBAC filtering | Engineer sees only their POAMs |
| `create-poam` | Create new POAM with validation | Only engineers/admins can create |
| `update-poam` | Update existing POAM | Only POC or admin can update |
| `delete-poam` | Delete POAM | Only admins can delete |
| `upload-scan` | Process CSV scan file | Same as current, but server-side |
| `generate-report` | Create OSCAL/CSV reports | Same as current, but server-side |

**How Your App Uses It:**
```javascript
// OLD (Local): Direct function call
const poams = await createPOAMsFromScan(scanData);

// NEW (Cloud): API call to Lambda
const response = await fetch('https://api.example.com/scans/process', {
  method: 'POST',
  headers: { 
    'Authorization': 'Bearer ' + userToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ scanData })
});
const poams = await response.json();
```

**Cost:** FREE (within 1M requests/month free tier)

---

### 3. API Gateway - Request Router

**What It Replaces:** Direct JavaScript → IndexedDB calls

**Why You Need It:**
Your current app directly calls IndexedDB functions. In the cloud, you need a "front door" that routes requests to the correct Lambda function and checks authentication.

**What It Does:**
- **Routes requests** - `/poams` → `list-poams` Lambda
- **Validates JWT tokens** - Ensures user is logged in
- **Throttles requests** - Prevents abuse
- **Logs requests** - Audit trail for compliance

**Real-World Example:**
```
LOCAL (Current):
Browser → JavaScript function → IndexedDB

CLOUD (With API Gateway):
Browser → API Gateway → Lambda Authorizer (check JWT) → Lambda Function → DynamoDB
```

**API Endpoints You'll Have:**

| Endpoint | Method | Purpose | Who Can Use |
|----------|--------|---------|-------------|
| `/poams` | GET | List POAMs | All (filtered by role) |
| `/poams` | POST | Create POAM | Engineers, Admins |
| `/poams/{id}` | GET | Get POAM details | All (if authorized) |
| `/poams/{id}` | PUT | Update POAM | POC, Admin |
| `/poams/{id}` | DELETE | Delete POAM | Admin only |
| `/scans/upload` | POST | Upload scan file | Engineers, Admins |
| `/reports/generate` | POST | Generate report | All |

**How Your App Uses It:**
```javascript
// OLD (Local): Direct database access
const poam = await window.poamDB.getPOAM(poamId);

// NEW (Cloud): HTTP request to API
const response = await fetch(`https://api.example.com/poams/${poamId}`, {
  headers: { 'Authorization': 'Bearer ' + userToken }
});
const poam = await response.json();
```

**Cost:** ~$0.35/month (100K requests)

---

### 4. Cognito - User Authentication

**What It Replaces:** Nothing (you don't have user login currently)

**Why You Need It:**
Your current app has no login - anyone who opens it can see/edit everything. With multiple users, you need to know WHO is accessing the app and WHAT they're allowed to do.

**What It Does:**
- **Authenticates users** - Verifies identity via Active Directory
- **Issues JWT tokens** - Secure tokens that prove who you are
- **Maps AD groups to roles** - "POAM-Engineers" → `engineer` role
- **Manages sessions** - Keeps users logged in

**Real-World Example:**
```
LOCAL (Current):
- Anyone opens http://localhost:8080
- Full access to everything
- No concept of "users"

CLOUD (With Cognito):
- User opens https://poam-nexus.example.com
- Redirected to Cognito login page
- Logs in with AD credentials (john.doe@company.com)
- Cognito checks AD: "John is in POAM-Engineers group"
- Cognito issues JWT token with role: "engineer"
- App uses token to call API
- Lambda checks token: "This is John, he's an engineer"
- Returns only John's POAMs
```

**User Flow:**
```
1. User visits app
2. Not logged in → Redirect to Cognito Hosted UI
3. Cognito → SAML → Active Directory
4. AD validates credentials
5. AD returns groups: ["POAM-Engineers", "IT-Staff"]
6. Cognito maps "POAM-Engineers" → role: "engineer"
7. Cognito issues JWT token with claims:
   {
     "sub": "user-id-123",
     "email": "john.doe@company.com",
     "custom:role": "engineer",
     "custom:adGroups": "POAM-Engineers,IT-Staff"
   }
8. App stores token, uses for all API calls
9. Lambda validates token on every request
```

**How Your App Uses It:**
```javascript
// NEW: Login flow (using AWS Amplify SDK)
import { Auth } from 'aws-amplify';

// Configure Amplify
Auth.configure({
  userPoolId: 'us-east-1_XXXXXXXXX',
  userPoolWebClientId: 'xxxxxxxxxxxxxxxxxxxx',
  oauth: {
    domain: 'poam-nexus.auth.us-east-1.amazoncognito.com',
    redirectSignIn: 'https://poam-nexus.example.com/callback',
    redirectSignOut: 'https://poam-nexus.example.com/logout',
    responseType: 'code'
  }
});

// Login (redirects to AD)
await Auth.federatedSignIn({ provider: 'ADFS' });

// Get current user
const user = await Auth.currentAuthenticatedUser();
console.log(user.attributes.email); // john.doe@company.com
console.log(user.attributes['custom:role']); // engineer

// Get JWT token for API calls
const session = await Auth.currentSession();
const token = session.getIdToken().getJwtToken();

// Use token in API calls
fetch('https://api.example.com/poams', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

**Cost:** FREE (up to 50,000 users)

---

### 5. S3 - File Storage

**What It Replaces:** Browser file handling (File API)

**Why You Need It:**
Your current app handles CSV files in the browser. For a multi-user system, you need centralized file storage so everyone can access uploaded scans and evidence files.

**What It Does:**
- **Stores scan files** - Qualys/Nessus CSV uploads
- **Stores evidence files** - Screenshots, remediation docs
- **Stores backups** - Database exports
- **Stores reports** - Generated OSCAL/CSV/XLSX files

**Real-World Example:**
```
LOCAL (Current):
- You upload scan.csv via file input
- JavaScript reads file in browser
- File is NOT saved anywhere
- If you refresh page, file is gone

CLOUD (With S3):
- You upload scan.csv
- File is uploaded to S3 bucket
- Metadata saved to DynamoDB (filename, S3 path, uploader)
- Lambda processes file from S3
- File is available to all users
- File is backed up and versioned
```

**S3 Buckets You'll Have:**

| Bucket | Purpose | Lifecycle |
|--------|---------|-----------|
| `scan-uploads` | Store uploaded CSV scan files | Move to cheaper storage after 30 days, delete after 1 year |
| `evidence` | Store evidence files (screenshots, docs) | Keep forever (compliance) |
| `backups` | Store database backups | Move to Glacier, keep 7 years |
| `reports` | Store generated reports | Delete after 90 days |
| `frontend` | Host React app (HTML/JS/CSS) | No expiration |

**How Your App Uses It:**
```javascript
// OLD (Local): File input → read in browser
const file = document.getElementById('fileInput').files[0];
const text = await file.text();
const scanData = Papa.parse(text);

// NEW (Cloud): Upload to S3 → Lambda processes
// Step 1: Get presigned URL from API
const response = await fetch('https://api.example.com/scans/upload', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + token },
  body: JSON.stringify({ filename: file.name })
});
const { uploadUrl, s3Key } = await response.json();

// Step 2: Upload file directly to S3
await fetch(uploadUrl, {
  method: 'PUT',
  body: file
});

// Step 3: Lambda automatically processes file from S3
// (triggered by S3 event when file is uploaded)
```

**Cost:** ~$8/month (360 GB with lifecycle policies)

---

### 6. CloudFront - Content Delivery Network

**What It Replaces:** Your local web server (localhost:8080)

**Why You Need It:**
Your current app runs on `localhost:8080` which only you can access. CloudFront makes the app available to all users with fast loading times.

**What It Does:**
- **Hosts the React app** - Serves HTML/JS/CSS files
- **Caches content globally** - Fast loading from anywhere
- **Provides HTTPS** - Secure connection
- **Custom domain** - `https://poam-nexus.company.com`

**Real-World Example:**
```
LOCAL (Current):
- You run: python3 -m http.server 8080
- You access: http://localhost:8080
- Only works on YOUR computer
- No HTTPS

CLOUD (With CloudFront):
- React app deployed to S3
- CloudFront serves from S3
- Users access: https://poam-nexus.company.com
- Works from anywhere
- HTTPS with SSL certificate
- Cached globally for fast loading
```

**How It Works:**
```
User Browser → CloudFront → S3 (React app files)
                    ↓
              (Cached for 24 hours)
                    ↓
          Next user gets cached version (fast!)
```

**Cost:** ~$0.50/month (5 GB data transfer)

---

## How Components Work Together

### Example: Engineer Views Their POAMs

**Step-by-Step Flow:**

```
1. Engineer opens https://poam-nexus.company.com
   └─→ CloudFront serves React app from S3

2. React app checks: "Is user logged in?"
   └─→ No → Redirect to Cognito Hosted UI

3. Cognito redirects to Active Directory (SAML)
   └─→ Engineer logs in with AD credentials

4. AD returns: "User is in POAM-Engineers group"
   └─→ Cognito maps to role: "engineer"

5. Cognito issues JWT token with claims:
   {
     "sub": "engineer-123",
     "email": "jane.doe@company.com",
     "custom:role": "engineer"
   }

6. React app stores token, calls API:
   GET https://api.example.com/poams
   Authorization: Bearer eyJhbGc...

7. API Gateway receives request
   └─→ Calls Lambda Authorizer to validate JWT

8. Lambda Authorizer validates token:
   ✓ Token signature valid
   ✓ Token not expired
   ✓ User role: "engineer"
   └─→ Returns IAM policy: "Allow"

9. API Gateway routes to list-poams Lambda

10. list-poams Lambda:
    - Checks user role: "engineer"
    - Queries DynamoDB: "Get POAMs where pocId = engineer-123"
    - Returns only POAMs assigned to this engineer

11. React app receives 20 POAMs, displays in UI
```

**What Changed from Local:**
- **Authentication:** Now knows WHO the user is
- **Authorization:** Filters POAMs based on role
- **Centralized Data:** POAMs stored in DynamoDB, not browser
- **Shared Access:** Multiple users can access same data

---

### Example: You Upload a Scan File

**Step-by-Step Flow:**

```
1. You click "Upload Scan" in React app

2. React app calls API:
   POST https://api.example.com/scans/upload
   Body: { filename: "qualys-scan-2026-03-10.csv" }
   Authorization: Bearer eyJhbGc...

3. API Gateway → Lambda: generate-presigned-url

4. Lambda generates S3 presigned URL:
   - Bucket: poam-nexus-scan-uploads
   - Key: system-001/2026/03/qualys-scan-2026-03-10.csv
   - Expires: 5 minutes
   └─→ Returns URL to React app

5. React app uploads file directly to S3 using presigned URL
   (bypasses Lambda for large file upload)

6. S3 triggers Lambda: process-scan-file
   (S3 event notification)

7. process-scan-file Lambda:
   - Downloads CSV from S3
   - Parses CSV (same logic as your current app)
   - Creates POAMs from scan data
   - Saves POAMs to DynamoDB
   - Saves scan metadata to DynamoDB

8. React app polls API: GET /scans/{scanId}/status
   └─→ Returns: "Processing complete, 100 POAMs created"

9. React app refreshes POAM list
   └─→ Shows new POAMs
```

**What Changed from Local:**
- **File Storage:** CSV saved to S3 (not lost on refresh)
- **Processing:** Lambda processes file (same logic, but server-side)
- **Shared Results:** All users see new POAMs
- **Audit Trail:** Who uploaded, when, what file

---

## Role-Based Access Control (RBAC)

### How Permissions Work

**Your Current App:** No permissions - everyone sees everything

**Cloud App:** Role-based filtering

| Role | Can See | Can Do |
|------|---------|--------|
| **Engineer** | POAMs assigned to them | Create, edit their POAMs, upload scans |
| **System Owner** | POAMs for their systems | Approve milestones, reassign POAMs |
| **Executive** | All POAMs (read-only) | View dashboard, generate reports |
| **Admin (You)** | Everything | Full access, user management, API access |

**Implementation in Lambda:**
```javascript
// list-poams Lambda function
exports.handler = async (event) => {
  const userRole = event.requestContext.authorizer.claims['custom:role'];
  const userId = event.requestContext.authorizer.claims.sub;
  
  let poams;
  
  if (userRole === 'admin' || userRole === 'executive') {
    // Admins and executives see all POAMs
    poams = await getAllPOAMs();
  } else if (userRole === 'engineer') {
    // Engineers only see POAMs assigned to them
    poams = await getPOAMsByPOC(userId);
  } else if (userRole === 'system_owner') {
    // System owners see POAMs for their systems
    const systems = await getSystemsByOwner(userId);
    poams = await getPOAMsBySystems(systems);
  }
  
  return { statusCode: 200, body: JSON.stringify(poams) };
};
```

---

## Data Migration: Local → Cloud

### How Your 500 POAMs Move to DynamoDB

**Current State:**
- 500 POAMs in IndexedDB (your browser)
- Only you can see them

**Migration Process:**

```
1. Export from IndexedDB (run in browser console):
   └─→ Downloads poam-export.json

2. Upload to migration Lambda:
   └─→ Lambda reads JSON
   └─→ Transforms IndexedDB format → DynamoDB format
   └─→ Batch writes to DynamoDB (25 items at a time)

3. Verify migration:
   └─→ Open cloud app
   └─→ See all 500 POAMs
   └─→ Engineers see their assigned POAMs
   └─→ Leadership sees dashboard with all POAMs
```

**Data Transformation:**
```javascript
// IndexedDB format (current)
{
  id: "poam-001",
  title: "Unpatched Apache",
  systemId: "system-001",
  affectedAssets: [...],
  status: "Open"
}

// DynamoDB format (cloud)
{
  PK: "SYSTEM#system-001",      // Partition key
  SK: "POAM#poam-001",           // Sort key
  id: "poam-001",
  title: "Unpatched Apache",
  systemId: "system-001",
  affectedAssets: [...],
  status: "Open",
  pocId: "user-123",             // NEW: Who owns this POAM
  createdBy: "admin-user",       // NEW: Who created it
  createdAt: "2026-03-10T10:00:00Z"
}
```

---

## Cost Comparison

### Local (Current): FREE
- Your computer
- Your browser
- Your time

### Cloud (Multi-User): ~$50-75/month

| Component | Cost | What You Get |
|-----------|------|--------------|
| DynamoDB | $40 | Shared database for 500 POAMs |
| Lambda | $0 | Server-side logic (free tier) |
| API Gateway | $0.35 | Request routing |
| S3 | $8 | File storage with backups |
| CloudFront | $0.50 | Global app delivery |
| Cognito | $0 | User authentication (free tier) |
| **Total** | **~$50/month** | Multi-user, secure, scalable |

**What You're Paying For:**
- ✅ Multiple users can access simultaneously
- ✅ Role-based permissions
- ✅ Active Directory integration
- ✅ Centralized data management
- ✅ Automatic backups
- ✅ Audit logging
- ✅ 99.99% uptime SLA
- ✅ No server management

---

## Summary: Why Each Component Matters

| Component | Local Equivalent | Why You Need It in Cloud |
|-----------|------------------|--------------------------|
| **DynamoDB** | IndexedDB | Share POAMs across all users |
| **Lambda** | JavaScript functions | Enforce permissions, run server-side |
| **API Gateway** | Direct function calls | Route requests, validate tokens |
| **Cognito** | None | Authenticate users, map AD groups to roles |
| **S3** | File input | Store files centrally, enable sharing |
| **CloudFront** | localhost:8080 | Make app accessible to all users |

**Bottom Line:**
Your local app works great for YOU. The cloud architecture enables the same functionality for MULTIPLE USERS with proper security, permissions, and collaboration.

---

## Next Steps

1. **Review this guide** - Understand why each component is needed
2. **Review step-by-step guide** - See HOW to configure each component
3. **Start with Phase 1** - Set up DynamoDB and S3
4. **Test incrementally** - Verify each component works before moving on
5. **Migrate data** - Move your 500 POAMs to DynamoDB
6. **Train users** - Show engineers and leadership how to use the cloud app

---

**Questions to Ask Yourself:**

- ✓ Do I understand why DynamoDB replaces IndexedDB?
- ✓ Do I understand how Lambda enforces permissions?
- ✓ Do I understand how Cognito authenticates users?
- ✓ Do I understand the data flow from browser → API → DynamoDB?
- ✓ Am I ready to start deploying?

If you answered YES to all, you're ready to begin deployment!

---

**Document Version:** 1.0  
**Last Updated:** March 10, 2026
