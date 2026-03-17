# POAM Nexus - AWS Deployment (Cost-Optimized, AWS-Native)

**Target Architecture:** Serverless-first, AWS-native services, cost-optimized for <$200/month

**Last Updated:** March 9, 2026

---

## Architecture Overview - Cost-Optimized

```
┌─────────────────────────────────────────────────────────────────┐
│                    Users (Browser)                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              S3 Static Website + CloudFront                     │
│              - React SPA (static build)                         │
│              - SSL/TLS via ACM (FREE)                           │
│              - Cost: ~$5-10/month                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   API Gateway (REST API)                        │
│                   - JWT authorizer                              │
│                   - Cost: ~$3.50/1M requests                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                ▼                         ▼
┌───────────────────────┐   ┌───────────────────────┐
│   Lambda Functions    │   │   Lambda Functions    │
│   - Node.js 20        │   │   - Node.js 20        │
│   - POAM CRUD         │   │   - Scan processing   │
│   - Cost: FREE TIER   │   │   - Report generation │
└──────────┬────────────┘   └──────────┬────────────┘
           │                           │
           └──────────┬────────────────┘
                      │
        ┌─────────────┼─────────────┬──────────────┐
        ▼             ▼             ▼              ▼
┌──────────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐
│  DynamoDB    │ │   S3    │ │ Cognito  │ │EventBridge   │
│  - POAMs     │ │ Buckets │ │ + AD     │ │(Scheduled)   │
│  - On-demand │ │ - Scans │ │ - SAML   │ │- Backups     │
│  - FREE tier │ │ - Files │ │ - FREE*  │ │- FREE tier   │
└──────────────┘ └─────────┘ └──────────┘ └──────────────┘
```

---

## Cost Optimization Strategy

### Key Changes from Original Plan:

| Original | Cost-Optimized | Savings |
|----------|----------------|---------|
| ECS Fargate (2 tasks) | Lambda Functions | -$60/month |
| Application Load Balancer | API Gateway | -$25/month |
| RDS PostgreSQL Multi-AZ | DynamoDB On-Demand | -$100/month |
| AWS Managed AD | Cognito + SAML (existing AD) | -$150/month |
| CloudFront (1TB) | CloudFront (100GB) | -$70/month |
| **Total Original** | **Total Optimized** | **-$405/month** |
| **$580/month** | **$175/month** | **70% savings** |

---

## Technology Stack - AWS Native Only

### Frontend
- **Hosting:** S3 Static Website + CloudFront
- **Framework:** React 18 (static build via Vite)
- **Auth:** AWS Amplify SDK (Cognito integration)
- **Cost:** ~$5-10/month

### Backend
- **Compute:** AWS Lambda (Node.js 20)
- **API:** API Gateway (REST API)
- **Auth:** Cognito User Pool + Lambda Authorizer
- **Cost:** FREE tier covers most usage

### Database
- **Primary:** DynamoDB (On-Demand pricing)
- **Backup:** DynamoDB Point-in-Time Recovery
- **Cost:** ~$25-50/month (depends on usage)

### Storage
- **S3 Buckets:** Same 4 buckets, optimized lifecycle
- **Cost:** ~$10-15/month

### Authentication
- **AWS Cognito User Pool** (FREE up to 50,000 MAU)
- **SAML 2.0 Federation** with existing AD/ADFS (no AWS Managed AD)
- **Cost:** FREE (under 50K users)

---

## DynamoDB Schema Design

### Single-Table Design (Cost-Optimized)

**Why Single-Table:**
- Lower cost (fewer tables = fewer read/write units)
- Better performance (fewer round trips)
- AWS best practice for DynamoDB

**Table: `poam-nexus-main`**

```javascript
// Partition Key (PK) and Sort Key (SK) patterns

// Users
PK: "USER#<cognito-sub>"
SK: "PROFILE"
Attributes: { email, displayName, role, adGroups, lastLogin }

// Systems
PK: "SYSTEM#<system-id>"
SK: "METADATA"
Attributes: { name, description, systemOwnerId, classification }

// POAMs
PK: "SYSTEM#<system-id>"
SK: "POAM#<poam-id>"
Attributes: { title, description, riskLevel, status, pocId, pocTeam, dates, ... }

// Affected Assets (nested in POAM)
PK: "SYSTEM#<system-id>"
SK: "POAM#<poam-id>"
Attributes: { ..., affectedAssets: [{ hostname, ip, os }] }

// Milestones (nested in POAM)
PK: "SYSTEM#<system-id>"
SK: "POAM#<poam-id>"
Attributes: { ..., milestones: [{ date, description, status }] }

// Scan Files (metadata)
PK: "SYSTEM#<system-id>"
SK: "SCAN#<scan-id>"
Attributes: { filename, s3Bucket, s3Key, fileSize, scanType, uploadedBy, uploadedAt }

// Evidence Files (metadata)
PK: "POAM#<poam-id>"
SK: "EVIDENCE#<evidence-id>"
Attributes: { filename, s3Bucket, s3Key, fileSize, uploadedBy, uploadedAt }

// Audit Logs
PK: "AUDIT#<date>"
SK: "LOG#<timestamp>#<user-id>"
Attributes: { userId, action, resourceType, resourceId, changes, ipAddress }
```

**Global Secondary Indexes (GSIs):**

1. **GSI1: User Lookup**
   - PK: `email`
   - SK: `USER#<cognito-sub>`
   - Use case: Find user by email

2. **GSI2: POAM by Status**
   - PK: `status` (e.g., "Open", "Closed")
   - SK: `SYSTEM#<system-id>#POAM#<poam-id>`
   - Use case: Dashboard queries (all open POAMs)

3. **GSI3: POAM by POC**
   - PK: `pocId`
   - SK: `SYSTEM#<system-id>#POAM#<poam-id>`
   - Use case: "My POAMs" view

**DynamoDB Capacity:**
- **Billing Mode:** On-Demand (pay per request)
- **Point-in-Time Recovery:** Enabled
- **Encryption:** AWS-managed keys (FREE)
- **Estimated Cost:** $25-50/month for 10K POAMs

---

## Lambda Functions Architecture

### Function Organization

**1. API Functions (triggered by API Gateway)**

```
/lambda
  ├── auth/
  │   ├── login.js          # Cognito login handler
  │   ├── logout.js         # Token invalidation
  │   └── me.js             # Get current user
  ├── systems/
  │   ├── list.js           # GET /systems
  │   ├── get.js            # GET /systems/{id}
  │   ├── create.js         # POST /systems
  │   ├── update.js         # PUT /systems/{id}
  │   └── delete.js         # DELETE /systems/{id}
  ├── poams/
  │   ├── list.js           # GET /poams (with filters)
  │   ├── get.js            # GET /poams/{id}
  │   ├── create.js         # POST /poams
  │   ├── update.js         # PUT /poams/{id}
  │   └── delete.js         # DELETE /poams/{id}
  ├── scans/
  │   ├── upload.js         # POST /scans/upload (presigned URL)
  │   └── process.js        # S3 trigger → parse CSV → create POAMs
  ├── evidence/
  │   ├── upload.js         # POST /evidence/upload
  │   └── download.js       # GET /evidence/{id} (presigned URL)
  ├── reports/
  │   ├── generate.js       # POST /reports/generate
  │   └── download.js       # GET /reports/{id}
  └── users/
      ├── list.js           # GET /users (admin only)
      └── update-role.js    # PUT /users/{id}/role
```

**2. Background Functions (triggered by EventBridge/S3)**

```
/lambda
  ├── scheduled/
  │   ├── daily-backup.js   # DynamoDB export to S3
  │   └── weekly-metrics.js # Generate dashboard metrics
  └── triggers/
      └── scan-processor.js # S3 upload → parse scan file
```

**Lambda Configuration:**
- **Runtime:** Node.js 20
- **Memory:** 512 MB (most functions), 1024 MB (scan processing)
- **Timeout:** 30 seconds (API), 5 minutes (background)
- **Environment:** DynamoDB table name, S3 bucket names
- **Layers:** Shared dependencies (AWS SDK, CSV parser)

**Cost Estimate:**
- **Free Tier:** 1M requests/month, 400K GB-seconds
- **Expected Usage:** ~100K requests/month
- **Cost:** $0 (within free tier)

---

## API Gateway Configuration

### REST API Setup

**Endpoints:**
```
POST   /auth/login
POST   /auth/logout
GET    /auth/me

GET    /systems
POST   /systems
GET    /systems/{id}
PUT    /systems/{id}
DELETE /systems/{id}

GET    /poams
POST   /poams
GET    /poams/{id}
PUT    /poams/{id}
DELETE /poams/{id}

POST   /scans/upload
GET    /scans/{id}

POST   /evidence/upload
GET    /evidence/{id}

POST   /reports/generate
GET    /reports/{id}

GET    /users (admin only)
PUT    /users/{id}/role (admin only)
```

**Authorization:**
- **Lambda Authorizer** (validates JWT from Cognito)
- Caches authorization for 5 minutes
- Returns IAM policy with allowed resources

**CORS Configuration:**
- Allow origins: CloudFront domain
- Allow methods: GET, POST, PUT, DELETE, OPTIONS
- Allow headers: Authorization, Content-Type

**Throttling:**
- Rate limit: 1000 requests/second
- Burst limit: 2000 requests

**Cost:**
- $3.50 per million requests
- Expected: ~100K requests/month = $0.35/month

---

## Cognito + AD Integration (Cost-Free)

### Setup Without AWS Managed AD

**Architecture:**
```
On-Prem AD ←→ ADFS (existing) ←→ Cognito User Pool (SAML) ←→ POAM Nexus
```

**Configuration Steps:**

1. **Configure ADFS as SAML Identity Provider**
   - Export ADFS metadata XML
   - Create Relying Party Trust in ADFS
   - Configure claim rules (email, name, groups)

2. **Create Cognito User Pool**
   - Enable SAML identity provider
   - Upload ADFS metadata XML
   - Map SAML attributes to Cognito attributes
   - Configure app client for POAM Nexus

3. **Map AD Groups to Cognito Groups**
   - Create Cognito groups: `admin`, `system_owner`, `engineer`, `executive`, `auditor`
   - Use Lambda trigger (Pre-Token Generation) to map AD groups
   - Add custom claims to JWT token

**Lambda Trigger (Pre-Token Generation):**
```javascript
// lambda/cognito-triggers/pre-token-generation.js
exports.handler = async (event) => {
  // Get AD groups from SAML assertion
  const adGroups = event.request.userAttributes['custom:adGroups'] || '';
  
  // Map AD groups to POAM roles
  const roleMapping = {
    'POAM-Admins': 'admin',
    'POAM-SystemOwners': 'system_owner',
    'POAM-Engineers': 'engineer',
    'POAM-Executives': 'executive',
    'POAM-Auditors': 'auditor'
  };
  
  let role = 'engineer'; // default
  for (const [adGroup, poamRole] of Object.entries(roleMapping)) {
    if (adGroups.includes(adGroup)) {
      role = poamRole;
      break;
    }
  }
  
  // Add custom claims to JWT
  event.response = {
    claimsOverrideDetails: {
      claimsToAddOrOverride: {
        'custom:role': role,
        'custom:adGroups': adGroups
      }
    }
  };
  
  return event;
};
```

**Cost:** FREE (Cognito User Pool is free up to 50,000 MAU)

---

## S3 Bucket Strategy (Optimized)

### Lifecycle Policies for Cost Savings

**1. `poam-nexus-scan-uploads`**
```
Lifecycle:
- Transition to S3 Standard-IA after 30 days (-45% cost)
- Transition to S3 Glacier Instant Retrieval after 90 days (-68% cost)
- Delete after 1 year (or per policy)

Estimated: 100 GB → $2/month (with lifecycle)
```

**2. `poam-nexus-evidence`**
```
Lifecycle:
- Keep in S3 Standard for 90 days
- Transition to S3 Glacier Flexible Retrieval after 90 days (-82% cost)
- Retain indefinitely

Estimated: 50 GB → $1/month (mostly in Glacier)
```

**3. `poam-nexus-backups`**
```
Lifecycle:
- Transition to S3 Glacier Deep Archive immediately (-95% cost)
- Delete after 7 years

Estimated: 200 GB → $2/month (Deep Archive)
```

**4. `poam-nexus-reports`**
```
Lifecycle:
- Delete after 30 days

Estimated: 10 GB → $0.25/month
```

**Total S3 Cost:** ~$5-10/month (vs $15 original)

---

## CloudFront Optimization

### Reduce Data Transfer Costs

**Configuration:**
- **Price Class:** Price Class 100 (US, Canada, Europe only)
- **Caching:** Aggressive caching (1 day for static assets)
- **Compression:** Enable Gzip/Brotli
- **Origin:** S3 static website

**Expected Traffic:**
- 50 users × 20 sessions/month × 5 MB/session = 5 GB/month
- Cost: ~$0.50/month (vs $85 for 1TB)

**Total CloudFront Cost:** ~$0.50-1/month

---

## Revised Build Phases (Serverless)

### Phase 1: Foundation (Week 1)

**1.1 S3 + CloudFront Setup**
- [ ] Create S3 bucket for static website hosting
- [ ] Enable static website hosting
- [ ] Create CloudFront distribution
- [ ] Request ACM certificate for custom domain
- [ ] Configure Route 53 DNS

**1.2 DynamoDB Setup**
- [ ] Create DynamoDB table with single-table design
- [ ] Create GSIs (user lookup, status, POC)
- [ ] Enable Point-in-Time Recovery
- [ ] Enable encryption at rest

**1.3 S3 Buckets for Storage**
- [ ] Create 4 S3 buckets (scans, evidence, backups, reports)
- [ ] Configure lifecycle policies
- [ ] Enable versioning and encryption
- [ ] Set up bucket policies

---

### Phase 2: Authentication (Week 2)

**2.1 Cognito Setup**
- [ ] Create Cognito User Pool
- [ ] Configure SAML identity provider (ADFS metadata)
- [ ] Create app client
- [ ] Configure hosted UI domain
- [ ] Test SAML login flow

**2.2 AD Group Mapping**
- [ ] Create Lambda Pre-Token Generation trigger
- [ ] Implement AD group → role mapping logic
- [ ] Create Cognito groups (admin, engineer, etc.)
- [ ] Test JWT token with custom claims

**2.3 Lambda Authorizer**
- [ ] Create Lambda authorizer function
- [ ] Implement JWT validation logic
- [ ] Add RBAC permission checks
- [ ] Test with sample tokens

---

### Phase 3: Backend API (Week 3-4)

**3.1 Lambda Functions - Core**
- [ ] Set up Lambda project structure
- [ ] Create shared layer (AWS SDK, utilities)
- [ ] Implement auth functions (login, logout, me)
- [ ] Implement systems CRUD functions
- [ ] Implement POAMs CRUD functions

**3.2 Lambda Functions - Files**
- [ ] Implement scan upload (presigned URL generation)
- [ ] Implement scan processor (S3 trigger → parse CSV)
- [ ] Implement evidence upload/download
- [ ] Implement report generation

**3.3 API Gateway**
- [ ] Create REST API
- [ ] Configure Lambda integrations
- [ ] Set up Lambda authorizer
- [ ] Configure CORS
- [ ] Test all endpoints with Postman

**3.4 DynamoDB Integration**
- [ ] Implement DynamoDB access patterns
- [ ] Add error handling and retries
- [ ] Implement optimistic locking
- [ ] Add audit logging

---

### Phase 4: Frontend (Week 5-6)

**4.1 React Migration**
- [ ] Create React app with Vite
- [ ] Install AWS Amplify SDK
- [ ] Configure Amplify with Cognito
- [ ] Migrate existing components to React
- [ ] Implement routing

**4.2 API Integration**
- [ ] Replace IndexedDB with API Gateway calls
- [ ] Implement JWT token management
- [ ] Add loading states and error handling
- [ ] Implement offline fallback (optional)

**4.3 Build & Deploy**
- [ ] Create production build
- [ ] Upload to S3
- [ ] Invalidate CloudFront cache
- [ ] Test in production

---

### Phase 5: Automation & Monitoring (Week 7)

**5.1 CI/CD Pipeline**
- [ ] Create GitHub Actions workflow
- [ ] Automate Lambda deployment (zip + upload)
- [ ] Automate React build + S3 upload
- [ ] Automate CloudFront invalidation

**5.2 Monitoring**
- [ ] Set up CloudWatch dashboards
- [ ] Create Lambda error alarms
- [ ] Create DynamoDB throttling alarms
- [ ] Set up CloudWatch Logs Insights queries

**5.3 Backup & DR**
- [ ] Create EventBridge rule for daily DynamoDB export
- [ ] Implement S3 cross-region replication (backups)
- [ ] Test restore procedure
- [ ] Document DR plan

---

### Phase 6: Testing & Launch (Week 8)

**6.1 Testing**
- [ ] User acceptance testing
- [ ] Load testing (Artillery)
- [ ] Security testing
- [ ] RBAC testing

**6.2 Documentation**
- [ ] User guide
- [ ] Admin guide
- [ ] API documentation
- [ ] Runbook

**6.3 Launch**
- [ ] Final security review
- [ ] Production deployment
- [ ] User training
- [ ] Monitor metrics

---

## Cost Breakdown (Monthly)

| Service | Configuration | Cost |
|---------|--------------|------|
| **Lambda** | 100K requests, 512MB, 1s avg | $0 (free tier) |
| **API Gateway** | 100K requests | $0.35 |
| **DynamoDB** | On-demand, 10K items, 1M reads | $25-50 |
| **S3 Storage** | 360 GB (with lifecycle) | $8 |
| **S3 Requests** | 10K PUT, 100K GET | $0.50 |
| **CloudFront** | 5 GB data transfer | $0.50 |
| **Cognito** | 50 users | $0 (free tier) |
| **Route 53** | 1 hosted zone | $0.50 |
| **CloudWatch Logs** | 5 GB | $2.50 |
| **EventBridge** | 100 rules | $0 (free tier) |
| **Data Transfer** | 10 GB outbound | $0.90 |
| **ACM Certificate** | SSL cert | $0 (free) |
| **TOTAL** | | **~$38-63/month** |

**Compared to Original:** $580/month → $50/month = **91% cost reduction**

---

## Scaling Considerations

### When to Upgrade

**If you exceed free tier:**
- Lambda: >1M requests/month → ~$0.20 per 1M additional
- DynamoDB: >25GB storage → $0.25/GB/month
- S3: >5GB transfer → $0.09/GB

**If you need better performance:**
- DynamoDB: Switch to Provisioned Capacity (predictable cost)
- Lambda: Increase memory for faster execution
- CloudFront: Upgrade to higher price class

**If you need high availability:**
- DynamoDB: Enable Global Tables (multi-region)
- S3: Cross-region replication
- Lambda: Deploy to multiple regions

---

## Security & Compliance (AWS Native)

### AWS Services for Compliance

| Requirement | AWS Service | Cost |
|-------------|-------------|------|
| Audit Logging | CloudTrail | $2/month (data events) |
| Threat Detection | GuardDuty | $4/month (estimate) |
| Config Compliance | AWS Config | $2/month (10 rules) |
| Secrets Management | Secrets Manager | $0.40/secret/month |
| Encryption | KMS | $1/key/month |

**Total Security Add-On:** ~$10/month

**Total with Security:** ~$60-75/month

---

## Migration from IndexedDB to DynamoDB

### Data Export/Import Strategy

**Step 1: Export from IndexedDB**
```javascript
// Run in browser console on current app
async function exportAllData() {
  const poams = await window.poamDB.getAllPOAMs();
  const systems = await window.poamDB.getAllSystems();
  const scanRuns = await window.poamDB.getAllScanRuns();
  
  const backup = {
    version: 1,
    exportDate: new Date().toISOString(),
    poams,
    systems,
    scanRuns
  };
  
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `poam-export-${Date.now()}.json`;
  a.click();
}

exportAllData();
```

**Step 2: Import to DynamoDB**
```javascript
// Lambda function: /lambda/admin/import-legacy-data.js
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  const backup = JSON.parse(event.body);
  
  // Import systems
  for (const system of backup.systems) {
    await dynamodb.put({
      TableName: 'poam-nexus-main',
      Item: {
        PK: `SYSTEM#${system.id}`,
        SK: 'METADATA',
        ...system
      }
    }).promise();
  }
  
  // Import POAMs
  for (const poam of backup.poams) {
    await dynamodb.put({
      TableName: 'poam-nexus-main',
      Item: {
        PK: `SYSTEM#${poam.systemId}`,
        SK: `POAM#${poam.id}`,
        ...poam
      }
    }).promise();
  }
  
  return { statusCode: 200, body: 'Import complete' };
};
```

---

## Next Steps

1. **Confirm Approach** - Serverless vs containers?
2. **AD/ADFS Details** - Do you have ADFS configured?
3. **Data Migration** - Export current IndexedDB data
4. **Start Phase 1** - S3 + CloudFront + DynamoDB setup

---

## Questions

1. **AD Setup:** Do you have ADFS or Azure AD configured for SAML?
2. **Current Data:** How many POAMs are currently in IndexedDB?
3. **Users:** How many concurrent users expected?
4. **Timeline:** When do you need this deployed?
5. **Budget:** Is ~$50-75/month acceptable?

---

**Document Version:** 2.0 (Cost-Optimized)  
**Author:** AI Assistant  
**Date:** March 9, 2026
