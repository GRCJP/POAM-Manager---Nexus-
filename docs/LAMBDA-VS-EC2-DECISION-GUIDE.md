# POAM Nexus - Lambda vs EC2 Decision Guide

**Complete specification for deploying POAM Nexus to AWS: Serverless (Lambda) vs Traditional Server (EC2)**

**Last Updated:** March 11, 2026

---

## Executive Summary

This guide helps you decide between two AWS deployment approaches and provides complete configuration specifications for the chosen path.

**Quick Comparison:**

| Factor | Lambda (Serverless) | EC2 (Traditional Server) |
|--------|-------------------|------------------------|
| **Monthly Cost** | $50-75 | $150-200 |
| **3-Year Total** | $2,250 | $7,200 |
| **Setup Time** | 8 weeks | 2 weeks |
| **Maintenance** | AWS manages | You manage |
| **Scaling** | Automatic | Manual |
| **Team Learning Curve** | Steep | Moderate |

**Recommended Approach:** Hybrid (EC2 POC → Lambda Production)

---

## Part 1: Executive Decision Guide

### Cost Analysis

**Lambda (Serverless) - Monthly Breakdown:**
- Lambda functions: $0.50 (within free tier for 40K requests/month)
- DynamoDB: $40 (500 POAMs, on-demand pricing)
- S3 Storage: $8 (360 GB with lifecycle policies)
- API Gateway: $0.35 (100K requests)
- CloudFront: $0.50 (5 GB data transfer)
- Cognito: $0 (free up to 50K users)
- **Total: $50/month**

**EC2 (Traditional Server) - Monthly Breakdown:**
- EC2 t3.small instance: $15 (1-year reserved)
- RDS PostgreSQL (db.t3.micro): $15
- EBS storage (100 GB): $10
- Application Load Balancer: $25
- S3 backups: $5
- Data transfer: $10
- CloudFront: $5
- **Total: $85/month base + $65 for managed services = $150/month**

**3-Year Cost Projection:**

| Year | Lambda | EC2 | Savings with Lambda |
|------|--------|-----|---------------------|
| Year 1 | $600 | $1,800 | $1,200 |
| Year 2 | $750 | $2,400 | $1,650 |
| Year 3 | $900 | $3,000 | $2,100 |
| **Total** | **$2,250** | **$7,200** | **$4,950** |

*Note: Lambda costs increase slightly as usage grows, but stay lower than EC2*

---

### Time to Deploy

**Lambda (Serverless):**
- Week 1-2: Infrastructure (DynamoDB, S3, Cognito)
- Week 3-4: Lambda functions + API Gateway
- Week 5-6: Frontend migration to React
- Week 7-8: Testing + deployment
- **Total: 8 weeks to production-ready**

**EC2 (Traditional Server):**
- Week 1: Set up EC2, RDS, configure server
- Week 2: Deploy Node.js app, configure Nginx, test
- **Total: 2 weeks to production-ready**

**Hybrid Approach (Recommended):**
- Week 1-2: Deploy on EC2 for POC
- Week 3-4: User validation and feedback
- Week 5-10: Migrate to Lambda for production
- **Total: 2 weeks to POC, 8 weeks to production**

---

### Decision Matrix

**Choose Lambda (Serverless) if:**
- ✅ Long-term cost savings are priority ($4,950 over 3 years)
- ✅ User count will grow significantly (auto-scaling)
- ✅ Team can invest 8 weeks in setup
- ✅ AWS expertise available or willing to learn
- ✅ Want minimal maintenance burden (AWS manages infrastructure)
- ✅ Need compliance/audit features (built-in CloudWatch logging)

**Choose EC2 (Traditional Server) if:**
- ✅ Need to deploy quickly (2 weeks vs 8 weeks)
- ✅ Team has Node.js/Express experience
- ✅ Want simpler mental model (traditional server)
- ✅ May migrate to different cloud provider later (less vendor lock-in)
- ✅ Comfortable managing servers (security patches, updates)
- ✅ Budget allows $150/month ongoing cost

**Choose Hybrid Approach if:**
- ✅ Need quick POC for stakeholder approval (2 weeks)
- ✅ Want long-term cost savings (migrate to Lambda later)
- ✅ Can dedicate 8 weeks total timeline
- ✅ Want to validate requirements before committing to serverless

---

### Risk Assessment

**Lambda Risks:**

| Risk | Mitigation |
|------|-----------|
| **Learning curve** | Allocate 2 weeks for team training, use AWS documentation |
| **AWS vendor lock-in** | Accept as trade-off for cost savings, or use Serverless Framework for portability |
| **Cold start latency** | First request ~1 second, subsequent <100ms. Use provisioned concurrency if needed ($) |
| **Debugging complexity** | Use CloudWatch Logs Insights, AWS X-Ray for tracing |
| **Function size limits** | 250 MB deployment package. Use Lambda Layers for dependencies |

**EC2 Risks:**

| Risk | Mitigation |
|------|-----------|
| **Higher ongoing costs** | Accept as trade-off for simplicity, or plan Lambda migration |
| **Server maintenance** | Set up automated patching, monitoring with CloudWatch |
| **Manual scaling** | Configure Auto Scaling Group, but adds complexity |
| **Security patches** | Use AWS Systems Manager for automated patching |
| **Single point of failure** | Deploy Multi-AZ with load balancer (adds cost) |

---

### Scalability Comparison

**Lambda (Serverless):**
- Handles 1 user or 1,000 users automatically
- No configuration changes needed
- Costs scale linearly with usage
- Maximum 1,000 concurrent executions (can request increase)

**EC2 (Traditional Server):**
- t3.small handles ~50 concurrent users
- Need to upgrade instance type for more users
- t3.medium ($30/month) for 100 users
- t3.large ($60/month) for 200 users
- Requires manual intervention and downtime

**Example: User Growth Impact**

| Users | Lambda Cost | EC2 Cost | Winner |
|-------|-------------|----------|--------|
| 10 | $50/month | $150/month | Lambda |
| 50 | $60/month | $150/month | Lambda |
| 100 | $75/month | $180/month (t3.medium) | Lambda |
| 200 | $100/month | $240/month (t3.large) | Lambda |

---

## Part 2: Complete Lambda Configuration Specification

### Overview

**Total Lambda Functions Required: 15**

**Categories:**
1. Authentication (2 functions)
2. POAM Management (5 functions)
3. Scan Processing (3 functions)
4. Evidence Management (2 functions)
5. Reporting (2 functions)
6. Admin (1 function)

**Total Expected Monthly Requests:** ~41,850
**Total Monthly Cost:** $0.50 (within free tier)

---

### Lambda Function Specifications

#### Category 1: Authentication

**Function 1: `poam-nexus-authorizer`**

```yaml
Purpose: Validate JWT tokens for all API requests
Trigger: API Gateway (Lambda Authorizer)
Runtime: Node.js 20.x
Memory: 256 MB
Timeout: 10 seconds
Concurrency: Reserve 10
Environment Variables:
  USER_POOL_ID: <Cognito User Pool ID>
  APP_CLIENT_ID: <Cognito App Client ID>
  AWS_REGION: us-east-1
IAM Permissions:
  - None (only validates tokens, no AWS resource access)
Dependencies:
  - jsonwebtoken (npm package)
  - jwks-rsa (npm package)
Expected Load: 20,000 requests/month
Cost: $0.00 (free tier)
Error Handling:
  - Return 401 Unauthorized if token invalid
  - Cache authorization decision for 5 minutes
Code Location: /lambda/auth/authorizer.js
```

**Function 2: `poam-nexus-get-current-user`**

```yaml
Purpose: Get current authenticated user profile
Trigger: API Gateway GET /auth/me
Runtime: Node.js 20.x
Memory: 512 MB
Timeout: 30 seconds
Environment Variables:
  TABLE_NAME: poam-nexus-main
IAM Permissions:
  - dynamodb:GetItem on poam-nexus-main table
Dependencies:
  - aws-sdk (included in Lambda runtime)
Expected Load: 1,000 requests/month
Cost: $0.00 (free tier)
Returns:
  {
    "userId": "user-123",
    "email": "user@example.com",
    "role": "engineer",
    "adGroups": ["POAM-Engineers"]
  }
Code Location: /lambda/auth/get-current-user.js
```

---

#### Category 2: POAM Management

**Function 3: `poam-nexus-list-poams`**

```yaml
Purpose: List POAMs with role-based access control filtering
Trigger: API Gateway GET /poams
Runtime: Node.js 20.x
Memory: 512 MB
Timeout: 30 seconds
Environment Variables:
  TABLE_NAME: poam-nexus-main
IAM Permissions:
  - dynamodb:Query on poam-nexus-main table
  - dynamodb:Query on StatusIndex GSI
  - dynamodb:Query on POCIndex GSI
  - dynamodb:Scan (fallback for admin queries)
Query Parameters:
  - status (optional): Filter by POAM status
  - pocId (optional): Filter by POC user ID
  - systemId (optional): Filter by system
RBAC Logic:
  - admin/executive: Return all POAMs
  - engineer: Filter WHERE pocId = userId
  - system_owner: Filter WHERE systemId IN userSystems
Dependencies:
  - aws-sdk
Expected Load: 10,000 requests/month
Cost: $0.00 (free tier)
Response Format:
  {
    "poams": [...],
    "count": 150,
    "filteredBy": "engineer"
  }
Code Location: /lambda/poams/list.js
```

**Function 4: `poam-nexus-get-poam`**

```yaml
Purpose: Get single POAM by ID with permission check
Trigger: API Gateway GET /poams/{id}
Runtime: Node.js 20.x
Memory: 512 MB
Timeout: 30 seconds
Environment Variables:
  TABLE_NAME: poam-nexus-main
IAM Permissions:
  - dynamodb:GetItem on poam-nexus-main table
RBAC Logic:
  - Check if user has permission to view this POAM
  - Engineers can only view POAMs where pocId = userId
  - Admins can view any POAM
Dependencies:
  - aws-sdk
Expected Load: 5,000 requests/month
Cost: $0.00 (free tier)
Error Handling:
  - 404 if POAM not found
  - 403 if user lacks permission
Code Location: /lambda/poams/get.js
```

**Function 5: `poam-nexus-create-poam`**

```yaml
Purpose: Create new POAM with validation
Trigger: API Gateway POST /poams
Runtime: Node.js 20.x
Memory: 512 MB
Timeout: 30 seconds
Environment Variables:
  TABLE_NAME: poam-nexus-main
IAM Permissions:
  - dynamodb:PutItem on poam-nexus-main table
RBAC Logic:
  - Only engineer, system_owner, admin can create
Validation Rules:
  - Required: title, systemId, riskLevel
  - Auto-set: id (UUID), createdBy, createdAt, status=Open
  - Optional: description, pocId, pocTeam, affectedAssets, milestones
Dependencies:
  - aws-sdk
  - uuid (npm package)
Expected Load: 1,000 requests/month
Cost: $0.00 (free tier)
Request Body:
  {
    "systemId": "system-001",
    "title": "Unpatched Apache",
    "description": "...",
    "riskLevel": "High",
    "pocTeam": "Security Team"
  }
Code Location: /lambda/poams/create.js
```

**Function 6: `poam-nexus-update-poam`**

```yaml
Purpose: Update existing POAM with change tracking
Trigger: API Gateway PUT /poams/{id}
Runtime: Node.js 20.x
Memory: 512 MB
Timeout: 30 seconds
Environment Variables:
  TABLE_NAME: poam-nexus-main
IAM Permissions:
  - dynamodb:GetItem on poam-nexus-main table
  - dynamodb:UpdateItem on poam-nexus-main table
RBAC Logic:
  - POC can update their own POAMs
  - System owner can update POAMs for their systems
  - Admin can update any POAM
Change Tracking:
  - Append to statusHistory array
  - Track: field changed, old value, new value, changedBy, changedAt
Dependencies:
  - aws-sdk
Expected Load: 2,000 requests/month
Cost: $0.00 (free tier)
Code Location: /lambda/poams/update.js
```

**Function 7: `poam-nexus-delete-poam`**

```yaml
Purpose: Delete POAM (admin only)
Trigger: API Gateway DELETE /poams/{id}
Runtime: Node.js 20.x
Memory: 512 MB
Timeout: 30 seconds
Environment Variables:
  TABLE_NAME: poam-nexus-main
IAM Permissions:
  - dynamodb:DeleteItem on poam-nexus-main table
RBAC Logic:
  - Admin only
Audit:
  - Log deletion to CloudWatch
  - Include: poamId, deletedBy, deletedAt
Dependencies:
  - aws-sdk
Expected Load: 100 requests/month
Cost: $0.00 (free tier)
Code Location: /lambda/poams/delete.js
```

---

#### Category 3: Scan Processing

**Function 8: `poam-nexus-generate-upload-url`**

```yaml
Purpose: Generate S3 presigned URL for scan file upload
Trigger: API Gateway POST /scans/upload
Runtime: Node.js 20.x
Memory: 512 MB
Timeout: 30 seconds
Environment Variables:
  SCAN_BUCKET: poam-nexus-{account-id}-scan-uploads
  TABLE_NAME: poam-nexus-main
IAM Permissions:
  - s3:PutObject on scan-uploads bucket
  - dynamodb:PutItem (save scan metadata)
RBAC Logic:
  - Engineer, system_owner, admin can upload
Presigned URL:
  - Expires in 5 minutes
  - Allows PUT only
  - Max file size: 50 MB
Dependencies:
  - aws-sdk
  - uuid
Expected Load: 500 requests/month
Cost: $0.00 (free tier)
Returns:
  {
    "uploadUrl": "https://s3.amazonaws.com/...",
    "scanId": "scan-123",
    "s3Key": "system-001/2026/03/scan-123.csv"
  }
Code Location: /lambda/scans/generate-upload-url.js
```

**Function 9: `poam-nexus-process-scan`**

```yaml
Purpose: Parse CSV scan file and create POAMs
Trigger: S3 event (ObjectCreated on scan-uploads bucket)
Runtime: Node.js 20.x
Memory: 1024 MB (needs more for CSV parsing)
Timeout: 300 seconds (5 minutes)
Environment Variables:
  TABLE_NAME: poam-nexus-main
  SCAN_BUCKET: poam-nexus-{account-id}-scan-uploads
IAM Permissions:
  - s3:GetObject on scan-uploads bucket
  - dynamodb:BatchWriteItem on poam-nexus-main table
  - dynamodb:PutItem on poam-nexus-main table
Processing Logic:
  1. Download CSV from S3
  2. Parse CSV using PapaParse
  3. Group findings by vulnerability (same as current app)
  4. Create POAM objects
  5. Batch write to DynamoDB (25 items at a time)
  6. Update scan status in DynamoDB
Dependencies:
  - aws-sdk
  - papaparse (npm package)
Expected Load: 50 scans/month
Cost: ~$0.50/month (higher memory + longer execution)
Error Handling:
  - Retry failed batch writes
  - Log errors to CloudWatch
  - Update scan status to "failed" if processing fails
Code Location: /lambda/scans/process-scan.js
```

**Function 10: `poam-nexus-get-scan-status`**

```yaml
Purpose: Check scan processing status
Trigger: API Gateway GET /scans/{scanId}/status
Runtime: Node.js 20.x
Memory: 512 MB
Timeout: 30 seconds
Environment Variables:
  TABLE_NAME: poam-nexus-main
IAM Permissions:
  - dynamodb:GetItem on poam-nexus-main table
Dependencies:
  - aws-sdk
Expected Load: 1,000 requests/month
Cost: $0.00 (free tier)
Returns:
  {
    "scanId": "scan-123",
    "status": "processing" | "completed" | "failed",
    "poamsCreated": 100,
    "startedAt": "2026-03-11T10:00:00Z",
    "completedAt": "2026-03-11T10:05:00Z"
  }
Code Location: /lambda/scans/get-status.js
```

---

#### Category 4: Evidence Management

**Function 11: `poam-nexus-upload-evidence`**

```yaml
Purpose: Generate presigned URL for evidence file upload
Trigger: API Gateway POST /evidence/upload
Runtime: Node.js 20.x
Memory: 512 MB
Timeout: 30 seconds
Environment Variables:
  EVIDENCE_BUCKET: poam-nexus-{account-id}-evidence
  TABLE_NAME: poam-nexus-main
IAM Permissions:
  - s3:PutObject on evidence bucket
  - dynamodb:PutItem (save evidence metadata)
RBAC Logic:
  - POC or admin can upload evidence for POAM
  - Check if user has permission for parent POAM
Request Body:
  {
    "poamId": "poam-123",
    "filename": "screenshot.png",
    "fileType": "image/png"
  }
Dependencies:
  - aws-sdk
  - uuid
Expected Load: 500 requests/month
Cost: $0.00 (free tier)
Returns:
  {
    "uploadUrl": "https://s3.amazonaws.com/...",
    "evidenceId": "evidence-456",
    "s3Key": "poam-123/evidence-456.png"
  }
Code Location: /lambda/evidence/upload.js
```

**Function 12: `poam-nexus-get-evidence`**

```yaml
Purpose: Generate presigned URL for evidence download
Trigger: API Gateway GET /evidence/{id}
Runtime: Node.js 20.x
Memory: 512 MB
Timeout: 30 seconds
Environment Variables:
  EVIDENCE_BUCKET: poam-nexus-{account-id}-evidence
  TABLE_NAME: poam-nexus-main
IAM Permissions:
  - s3:GetObject on evidence bucket
  - dynamodb:GetItem (get evidence metadata)
RBAC Logic:
  - User must have access to parent POAM
  - Check permissions before generating URL
Presigned URL:
  - Expires in 5 minutes
  - Allows GET only
Dependencies:
  - aws-sdk
Expected Load: 1,000 requests/month
Cost: $0.00 (free tier)
Returns:
  {
    "downloadUrl": "https://s3.amazonaws.com/...",
    "filename": "screenshot.png",
    "fileSize": 1024000
  }
Code Location: /lambda/evidence/get.js
```

---

#### Category 5: Reporting

**Function 13: `poam-nexus-generate-report`**

```yaml
Purpose: Generate OSCAL/CSV/XLSX report
Trigger: API Gateway POST /reports/generate
Runtime: Node.js 20.x
Memory: 1024 MB (needs more for XLSX generation)
Timeout: 60 seconds
Environment Variables:
  TABLE_NAME: poam-nexus-main
  REPORTS_BUCKET: poam-nexus-{account-id}-reports
IAM Permissions:
  - dynamodb:Query on poam-nexus-main table
  - s3:PutObject on reports bucket
Processing Logic:
  1. Query POAMs based on filters
  2. Generate report in requested format (OSCAL, CSV, XLSX)
  3. Upload to S3
  4. Return presigned download URL
Request Body:
  {
    "format": "oscal" | "csv" | "xlsx",
    "filters": {
      "status": "Open",
      "riskLevel": "High"
    }
  }
Dependencies:
  - aws-sdk
  - xlsx (npm package)
Expected Load: 200 requests/month
Cost: $0.00 (free tier)
Returns:
  {
    "reportId": "report-789",
    "downloadUrl": "https://s3.amazonaws.com/...",
    "format": "xlsx",
    "poamCount": 150
  }
Code Location: /lambda/reports/generate.js
```

**Function 14: `poam-nexus-list-reports`**

```yaml
Purpose: List generated reports
Trigger: API Gateway GET /reports
Runtime: Node.js 20.x
Memory: 512 MB
Timeout: 30 seconds
Environment Variables:
  REPORTS_BUCKET: poam-nexus-{account-id}-reports
  TABLE_NAME: poam-nexus-main
IAM Permissions:
  - s3:ListBucket on reports bucket
  - dynamodb:Query (get report metadata)
Dependencies:
  - aws-sdk
Expected Load: 500 requests/month
Cost: $0.00 (free tier)
Returns:
  {
    "reports": [
      {
        "reportId": "report-789",
        "format": "xlsx",
        "createdAt": "2026-03-11T10:00:00Z",
        "createdBy": "user@example.com"
      }
    ]
  }
Code Location: /lambda/reports/list.js
```

---

#### Category 6: Admin

**Function 15: `poam-nexus-migrate-data`**

```yaml
Purpose: Import POAMs from IndexedDB export (one-time migration)
Trigger: Manual invocation (AWS Console or CLI)
Runtime: Node.js 20.x
Memory: 1024 MB
Timeout: 300 seconds (5 minutes)
Environment Variables:
  TABLE_NAME: poam-nexus-main
IAM Permissions:
  - dynamodb:BatchWriteItem on poam-nexus-main table
Processing Logic:
  1. Accept JSON export from IndexedDB
  2. Transform IndexedDB format → DynamoDB format
  3. Batch write (25 items at a time)
  4. Return import summary
Input Format:
  {
    "poams": [...],
    "systems": [...],
    "scanRuns": [...]
  }
Dependencies:
  - aws-sdk
Expected Load: One-time use (migration only)
Cost: $0.00 (free tier)
Returns:
  {
    "imported": 500,
    "failed": 0,
    "errors": []
  }
Code Location: /lambda/admin/migrate-data.js
```

---

### Feature-to-Lambda Mapping

**Current App Feature → Required Lambda Functions**

| Current Feature | Lambda Functions | Memory | Timeout | Notes |
|----------------|------------------|--------|---------|-------|
| **View Dashboard** | `list-poams` | 512 MB | 30s | Queries StatusIndex GSI |
| **Upload Scan** | `generate-upload-url` + `process-scan` | 512 MB + 1024 MB | 30s + 300s | S3 trigger for processing |
| **Create POAM** | `create-poam` | 512 MB | 30s | Validates required fields |
| **Edit POAM** | `get-poam` + `update-poam` | 512 MB + 512 MB | 30s + 30s | RBAC permission check |
| **Delete POAM** | `delete-poam` | 512 MB | 30s | Admin only |
| **Upload Evidence** | `upload-evidence` | 512 MB | 30s | Saves metadata to DynamoDB |
| **Download Evidence** | `get-evidence` | 512 MB | 30s | Returns presigned URL |
| **Generate Report** | `generate-report` | 1024 MB | 60s | XLSX generation needs more memory |
| **View Reports** | `list-reports` | 512 MB | 30s | Lists S3 bucket contents |
| **User Login** | `authorizer` + `get-current-user` | 256 MB + 512 MB | 10s + 30s | JWT validation on every request |
| **Data Migration** | `migrate-data` | 1024 MB | 300s | One-time use |

---

### Decision Rules for Lambda Configuration

**Memory Allocation Guidelines:**

| Function Type | Memory | Reasoning |
|--------------|--------|-----------|
| Simple queries (list, get) | 512 MB | Standard database queries |
| File processing (CSV, XLSX) | 1024 MB | Parsing large files in memory |
| Token validation | 256 MB | Lightweight JWT verification |
| Batch operations | 1024 MB | Processing multiple items |

**Timeout Guidelines:**

| Function Type | Timeout | Reasoning |
|--------------|---------|-----------|
| Simple operations | 30 seconds | Database queries, API calls |
| File processing | 300 seconds (5 min) | CSV parsing, POAM creation |
| Token validation | 10 seconds | Quick JWT check |
| Report generation | 60 seconds | XLSX creation for 500 POAMs |

**Concurrency Settings:**

| Function | Reserved Concurrency | Reasoning |
|----------|---------------------|-----------|
| `authorizer` | 10 | Called on every request, needs guaranteed capacity |
| `process-scan` | 2 | Limit concurrent scan processing to avoid DynamoDB throttling |
| All others | Default (1000) | Standard AWS limit, sufficient for POC |

**Error Handling Strategy:**

| Error Type | Retry Policy | Dead Letter Queue |
|-----------|--------------|-------------------|
| DynamoDB throttling | 3 retries with exponential backoff | SNS topic |
| S3 access errors | 2 retries | SNS topic |
| Validation errors | No retry (return 400) | None |
| Authorization errors | No retry (return 403) | None |

---

### IAM Role Configuration

**Single Lambda Execution Role: `poam-nexus-lambda-role`**

```yaml
Role Name: poam-nexus-lambda-role
Description: Execution role for all POAM Nexus Lambda functions

Managed Policies:
  - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    # Provides CloudWatch Logs permissions

Custom Inline Policy: poam-nexus-lambda-policy
  Statement:
    - Sid: DynamoDBAccess
      Effect: Allow
      Action:
        - dynamodb:GetItem
        - dynamodb:PutItem
        - dynamodb:UpdateItem
        - dynamodb:DeleteItem
        - dynamodb:Query
        - dynamodb:Scan
        - dynamodb:BatchWriteItem
      Resource:
        - arn:aws:dynamodb:*:*:table/poam-nexus-main
        - arn:aws:dynamodb:*:*:table/poam-nexus-main/index/*
    
    - Sid: S3Access
      Effect: Allow
      Action:
        - s3:GetObject
        - s3:PutObject
        - s3:DeleteObject
        - s3:ListBucket
      Resource:
        - arn:aws:s3:::poam-nexus-*/*
        - arn:aws:s3:::poam-nexus-*
    
    - Sid: CloudWatchLogs
      Effect: Allow
      Action:
        - logs:CreateLogGroup
        - logs:CreateLogStream
        - logs:PutLogEvents
      Resource:
        - arn:aws:logs:*:*:log-group:/aws/lambda/poam-nexus-*

Trust Relationship:
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "lambda.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }
```

---

### Environment Variables (All Functions)

**Common Environment Variables:**

```yaml
# DynamoDB
TABLE_NAME: poam-nexus-main

# S3 Buckets (replace {account-id} with your AWS account ID)
SCAN_BUCKET: poam-nexus-{account-id}-scan-uploads
EVIDENCE_BUCKET: poam-nexus-{account-id}-evidence
BACKUPS_BUCKET: poam-nexus-{account-id}-backups
REPORTS_BUCKET: poam-nexus-{account-id}-reports

# Cognito (for authorizer function)
USER_POOL_ID: us-east-1_XXXXXXXXX
APP_CLIENT_ID: xxxxxxxxxxxxxxxxxxxx

# AWS Region
AWS_REGION: us-east-1

# Application Settings
MAX_FILE_SIZE_MB: 50
PRESIGNED_URL_EXPIRY_SECONDS: 300
```

**How to Set:**
```bash
# Set environment variables for a Lambda function
aws lambda update-function-configuration \
  --function-name poam-nexus-list-poams \
  --environment "Variables={TABLE_NAME=poam-nexus-main,AWS_REGION=us-east-1}"
```

---

### Lambda Layer Configuration

**Shared Dependencies Layer: `poam-nexus-dependencies`**

```yaml
Layer Name: poam-nexus-dependencies
Description: Shared npm packages for POAM Nexus Lambda functions
Compatible Runtimes:
  - nodejs20.x

Dependencies (package.json):
  {
    "dependencies": {
      "aws-sdk": "^2.1500.0",
      "uuid": "^9.0.0",
      "papaparse": "^5.4.1",
      "xlsx": "^0.18.5",
      "jsonwebtoken": "^9.0.2",
      "jwks-rsa": "^3.1.0"
    }
  }

Size: ~15 MB (zipped)

Used By: All 15 Lambda functions

Creation Steps:
  1. mkdir -p lambda-layer/nodejs
  2. cd lambda-layer/nodejs
  3. npm install (dependencies above)
  4. cd ..
  5. zip -r layer.zip nodejs/
  6. aws lambda publish-layer-version \
       --layer-name poam-nexus-dependencies \
       --zip-file fileb://layer.zip \
       --compatible-runtimes nodejs20.x
```

---

### Deployment Checklist

**Phase 1: Prerequisites (Week 1)**

- [ ] AWS account created and configured
- [ ] AWS CLI installed and configured (`aws configure`)
- [ ] Node.js 20 installed locally
- [ ] DynamoDB table created (`poam-nexus-main`)
- [ ] S3 buckets created (scan-uploads, evidence, backups, reports)
- [ ] Cognito User Pool created
- [ ] SAML identity provider configured (ADFS)

**Phase 2: IAM Setup (Week 2)**

- [ ] Create IAM role `poam-nexus-lambda-role`
- [ ] Attach AWSLambdaBasicExecutionRole managed policy
- [ ] Create custom inline policy for DynamoDB/S3 access
- [ ] Verify role trust relationship allows Lambda service

**Phase 3: Lambda Layer (Week 3)**

- [ ] Create layer directory structure
- [ ] Install npm dependencies
- [ ] Zip layer package
- [ ] Upload layer to AWS Lambda
- [ ] Note Layer ARN for function deployments

**Phase 4: Deploy Lambda Functions (Week 3-4)**

Deploy in this order (dependencies):

1. [ ] `poam-nexus-authorizer` (needed for all API calls)
2. [ ] `poam-nexus-get-current-user`
3. [ ] `poam-nexus-list-poams`
4. [ ] `poam-nexus-get-poam`
5. [ ] `poam-nexus-create-poam`
6. [ ] `poam-nexus-update-poam`
7. [ ] `poam-nexus-delete-poam`
8. [ ] `poam-nexus-generate-upload-url`
9. [ ] `poam-nexus-process-scan`
10. [ ] `poam-nexus-get-scan-status`
11. [ ] `poam-nexus-upload-evidence`
12. [ ] `poam-nexus-get-evidence`
13. [ ] `poam-nexus-generate-report`
14. [ ] `poam-nexus-list-reports`
15. [ ] `poam-nexus-migrate-data`

**For each function:**
- [ ] Create function code file
- [ ] Test locally (optional: use AWS SAM)
- [ ] Zip deployment package
- [ ] Deploy to AWS Lambda
- [ ] Configure environment variables
- [ ] Attach Lambda layer
- [ ] Set memory and timeout
- [ ] Test with sample event

**Phase 5: API Gateway Setup (Week 5)**

- [ ] Create REST API (`poam-nexus-api`)
- [ ] Create resources (/poams, /scans, /evidence, /reports, /auth)
- [ ] Create methods (GET, POST, PUT, DELETE)
- [ ] Attach Lambda authorizer to all methods (except OPTIONS)
- [ ] Configure Lambda integrations
- [ ] Enable CORS (OPTIONS method + headers)
- [ ] Deploy to `prod` stage
- [ ] Test all endpoints with Postman

**Phase 6: S3 Event Triggers (Week 5)**

- [ ] Configure S3 event notification on scan-uploads bucket
- [ ] Trigger: ObjectCreated:Put for .csv files
- [ ] Target: `poam-nexus-process-scan` Lambda
- [ ] Grant S3 permission to invoke Lambda
- [ ] Test: Upload CSV, verify Lambda triggered

**Phase 7: Monitoring Setup (Week 6)**

- [ ] Create CloudWatch dashboard
- [ ] Add metrics: Invocations, Errors, Duration, Throttles
- [ ] Create alarms: Error rate > 5%, Duration > 25s
- [ ] Configure SNS topic for alarm notifications
- [ ] Test alarm triggers

**Phase 8: Testing (Week 7)**

- [ ] Unit test each Lambda function
- [ ] Integration test API endpoints
- [ ] Load test with Artillery (simulate 100 concurrent users)
- [ ] RBAC test (verify engineers only see their POAMs)
- [ ] End-to-end test (upload scan → create POAMs → view dashboard)

**Phase 9: Data Migration (Week 8)**

- [ ] Export POAMs from IndexedDB (run in browser console)
- [ ] Invoke `migrate-data` Lambda with export JSON
- [ ] Verify all 500 POAMs imported correctly
- [ ] Test POAM access with different user roles

**Phase 10: Production Deployment (Week 8)**

- [ ] Deploy React frontend to S3
- [ ] Configure CloudFront distribution
- [ ] Update Cognito callback URLs
- [ ] Final end-to-end testing
- [ ] User training
- [ ] Go live!

---

### Monitoring & Alerts

**CloudWatch Dashboard Widgets:**

1. **Lambda Invocations** (per function)
   - Metric: AWS/Lambda Invocations
   - Statistic: Sum
   - Period: 5 minutes

2. **Lambda Errors** (per function)
   - Metric: AWS/Lambda Errors
   - Statistic: Sum
   - Period: 5 minutes

3. **Lambda Duration** (per function)
   - Metric: AWS/Lambda Duration
   - Statistic: p50, p95, p99
   - Period: 5 minutes

4. **Lambda Throttles**
   - Metric: AWS/Lambda Throttles
   - Statistic: Sum
   - Period: 5 minutes

5. **DynamoDB Read/Write Capacity**
   - Metric: AWS/DynamoDB ConsumedReadCapacityUnits, ConsumedWriteCapacityUnits
   - Statistic: Sum
   - Period: 5 minutes

6. **API Gateway Requests**
   - Metric: AWS/ApiGateway Count
   - Statistic: Sum
   - Period: 5 minutes

**CloudWatch Alarms:**

```yaml
Alarm 1: High Error Rate
  Metric: AWS/Lambda Errors
  Threshold: > 5% of invocations
  Evaluation: 2 consecutive periods of 5 minutes
  Action: Send SNS notification to ops team

Alarm 2: High Duration (Near Timeout)
  Metric: AWS/Lambda Duration
  Threshold: > 25 seconds (for 30s timeout functions)
  Evaluation: 3 consecutive periods of 5 minutes
  Action: Send SNS notification

Alarm 3: Throttling Detected
  Metric: AWS/Lambda Throttles
  Threshold: > 0
  Evaluation: 1 period of 5 minutes
  Action: Send SNS notification + increase concurrency

Alarm 4: DynamoDB Throttling
  Metric: AWS/DynamoDB UserErrors
  Threshold: > 10
  Evaluation: 2 consecutive periods of 5 minutes
  Action: Send SNS notification + consider provisioned capacity
```

**CloudWatch Logs Insights Queries:**

```sql
-- Find slow Lambda executions
fields @timestamp, @duration, @requestId
| filter @duration > 5000
| sort @duration desc
| limit 20

-- Find Lambda errors
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 50

-- Count requests by user role
fields requestContext.authorizer.claims.custom:role as role
| stats count() by role

-- Find POAMs created in last hour
fields @timestamp, @message
| filter @message like /POAM created/
| sort @timestamp desc
```

---

### Cost Breakdown (Monthly)

**Lambda Function Costs:**

| Function | Requests/Month | Memory | Duration (avg) | Cost |
|----------|---------------|--------|----------------|------|
| `authorizer` | 20,000 | 256 MB | 100ms | $0.00 |
| `get-current-user` | 1,000 | 512 MB | 200ms | $0.00 |
| `list-poams` | 10,000 | 512 MB | 300ms | $0.00 |
| `get-poam` | 5,000 | 512 MB | 200ms | $0.00 |
| `create-poam` | 1,000 | 512 MB | 300ms | $0.00 |
| `update-poam` | 2,000 | 512 MB | 300ms | $0.00 |
| `delete-poam` | 100 | 512 MB | 200ms | $0.00 |
| `generate-upload-url` | 500 | 512 MB | 200ms | $0.00 |
| `process-scan` | 50 | 1024 MB | 60s | $0.50 |
| `get-scan-status` | 1,000 | 512 MB | 200ms | $0.00 |
| `upload-evidence` | 500 | 512 MB | 200ms | $0.00 |
| `get-evidence` | 1,000 | 512 MB | 200ms | $0.00 |
| `generate-report` | 200 | 1024 MB | 10s | $0.00 |
| `list-reports` | 500 | 512 MB | 300ms | $0.00 |
| **Total** | **41,850** | | | **$0.50/month** |

**Note:** First 1 million requests/month are FREE. Your usage (41,850) is well within free tier. Only `process-scan` incurs cost due to high memory + long duration.

**Total AWS Monthly Cost:**
- Lambda: $0.50
- DynamoDB: $40
- S3: $8
- API Gateway: $0.35
- CloudFront: $0.50
- Cognito: $0
- **Grand Total: ~$50/month**

---

## Part 3: EC2 Alternative Specification

### EC2 Configuration (If You Choose Traditional Server)

**Instance Specification:**

```yaml
Instance Type: t3.small
  vCPU: 2
  Memory: 2 GB RAM
  Network: Up to 5 Gbps
  Storage: 30 GB EBS GP3

Operating System: Ubuntu 22.04 LTS

Pricing:
  On-Demand: $0.0208/hour = $15/month
  1-Year Reserved: $0.0125/hour = $9/month (save 40%)
  3-Year Reserved: $0.0083/hour = $6/month (save 60%)

Recommendation: Start with on-demand, switch to reserved after POC validation
```

**Software Stack:**

```yaml
Runtime: Node.js 20 LTS
Database: PostgreSQL 15 (RDS db.t3.micro)
Web Server: Nginx (reverse proxy)
Process Manager: PM2 (keeps Node.js app running)
SSL: Let's Encrypt (free)

Application:
  - Express.js API
  - React frontend (built and served by Nginx)
  - Prisma ORM for PostgreSQL
```

**Architecture:**

```
Users → CloudFront → ALB → EC2 (Nginx → Node.js/Express) → RDS PostgreSQL
                                    ↓
                                S3 (scans, evidence, backups)
```

**Monthly Cost Breakdown:**

| Service | Configuration | Cost |
|---------|--------------|------|
| EC2 t3.small | On-demand | $15 |
| RDS db.t3.micro | PostgreSQL, Single-AZ | $15 |
| EBS Storage | 30 GB GP3 | $3 |
| Application Load Balancer | 1 ALB | $25 |
| S3 Storage | 360 GB | $8 |
| CloudFront | 5 GB data transfer | $0.50 |
| Data Transfer | 10 GB outbound | $1 |
| Route 53 | 1 hosted zone | $0.50 |
| **Total** | | **$68/month** |

**With Reserved Instances (1-year):**
- EC2: $9/month (save $6)
- RDS: $10/month (save $5)
- **Total: $57/month** (vs $68 on-demand)

**Setup Time:** 2 weeks

**Pros:**
- ✅ Faster deployment (2 weeks vs 8 weeks)
- ✅ Simpler mental model (traditional server)
- ✅ Team likely has Node.js/Express experience
- ✅ Easier debugging (SSH into server, view logs)
- ✅ Less vendor lock-in (can migrate to other clouds)

**Cons:**
- ❌ Higher cost ($68/month vs $50/month for Lambda)
- ❌ You manage security patches and updates
- ❌ Manual scaling (need to upgrade instance for more users)
- ❌ Single point of failure (unless Multi-AZ, which adds cost)
- ❌ Always running (pay even when not used)

---

### EC2 Deployment Steps (High-Level)

**Week 1: Infrastructure Setup**

1. Launch EC2 t3.small instance (Ubuntu 22.04)
2. Create RDS PostgreSQL instance (db.t3.micro)
3. Create S3 buckets (scan-uploads, evidence, backups)
4. Create Application Load Balancer
5. Configure security groups (allow HTTP/HTTPS, SSH)
6. Set up Elastic IP for EC2 instance

**Week 2: Application Deployment**

1. SSH into EC2, install Node.js 20
2. Install PostgreSQL client, Nginx, PM2
3. Clone POAM Nexus repository
4. Install npm dependencies
5. Configure Prisma with RDS connection string
6. Run database migrations
7. Build React frontend
8. Configure Nginx to serve frontend + proxy API
9. Start Node.js app with PM2
10. Configure SSL with Let's Encrypt
11. Test end-to-end

**Total Time:** 2 weeks to production-ready

---

## Part 4: Hybrid Approach (Recommended)

### Why Hybrid?

**Best of both worlds:**
- Get POC running quickly on EC2 (2 weeks)
- Validate requirements with users
- Migrate to Lambda for long-term cost savings (6 more weeks)
- Total timeline: 8 weeks, but POC available in 2 weeks

**Timeline:**

```
Week 1-2: Deploy on EC2
  - Quick setup, traditional server
  - Stakeholders can see working POC
  - Validate features and requirements

Week 3-4: User Validation
  - Gather feedback
  - Identify missing features
  - Confirm multi-user requirements

Week 5-8: Migrate to Lambda
  - Build Lambda functions
  - Set up API Gateway
  - Migrate data to DynamoDB
  - Deploy React frontend to S3/CloudFront
  - Decommission EC2

Week 9: Production Launch
  - Final testing
  - User training
  - Go live on Lambda
```

**Cost During Transition:**

| Period | Platform | Cost |
|--------|----------|------|
| Week 1-4 | EC2 | $68/month |
| Week 5-8 | EC2 + Lambda (both running) | $118/month |
| Week 9+ | Lambda only | $50/month |

**Total Cost for Hybrid:** ~$300 for 2 months vs $136 for Lambda-only (8 weeks)

**Extra Cost:** $164 for faster POC delivery

**Is it worth it?**
- If stakeholder approval is critical: **Yes**
- If budget is tight: **No, go straight to Lambda**
- If team needs to learn serverless: **Yes, EC2 buys time**

---

## Part 5: Final Recommendation

### For Your Situation (500 POAMs, 50 users, multi-user with RBAC)

**Recommended Approach: Hybrid**

**Reasoning:**

1. **Quick POC (2 weeks)** - Management sees working system fast
2. **User Validation** - Confirm requirements before committing to serverless
3. **Long-term Savings** - Migrate to Lambda saves $1,200/year
4. **Team Learning** - EC2 gives time to learn serverless concepts
5. **Risk Mitigation** - If Lambda doesn't work out, stay on EC2

**Timeline:**
- **Week 1-2:** Deploy on EC2, demo to management
- **Week 3-4:** User testing, gather feedback
- **Week 5-8:** Migrate to Lambda (if approved)
- **Week 9:** Production launch on Lambda

**Total Cost:**
- POC phase (4 weeks): $136 (EC2)
- Migration phase (4 weeks): $236 (EC2 + Lambda overlap)
- Production (ongoing): $50/month (Lambda)
- **First 2 months: $372**
- **Year 1 total: $872** (vs $1,800 for EC2-only or $600 for Lambda-only)

**Decision Points:**

After Week 4 (POC validation):
- ✅ Users happy, requirements confirmed → Proceed with Lambda migration
- ❌ Major changes needed → Stay on EC2, iterate, re-evaluate
- ❌ Budget cut → Stay on EC2 (simpler, but higher ongoing cost)

---

## Part 6: Next Steps

### If You Choose Lambda (Serverless)

1. **Review this specification** - Ensure you understand all 15 Lambda functions
2. **Review step-by-step deployment guide** - Follow detailed AWS CLI commands
3. **Start with Phase 1** - Set up DynamoDB and S3 buckets
4. **Deploy one function** - Start with `list-poams` to learn the process
5. **Test incrementally** - Verify each function works before moving on
6. **Migrate data** - Use `migrate-data` Lambda to import 500 POAMs
7. **Train users** - Show engineers and leadership how to use cloud app

### If You Choose EC2 (Traditional Server)

1. **Request EC2 deployment guide** - I can create detailed setup instructions
2. **Provision infrastructure** - Launch EC2, RDS, ALB
3. **Deploy application** - Install Node.js, PostgreSQL, Nginx
4. **Migrate data** - Import POAMs to PostgreSQL
5. **Test and launch** - 2 weeks to production

### If You Choose Hybrid (Recommended)

1. **Week 1-2:** Follow EC2 deployment guide
2. **Week 3-4:** User validation and feedback
3. **Week 5-8:** Follow Lambda deployment guide
4. **Week 9:** Production launch on Lambda

---

## Part 7: Questions for Management

Before proceeding, answer these questions:

1. **Timeline Priority:**
   - Need POC in 2 weeks? → EC2 or Hybrid
   - Can wait 8 weeks for production? → Lambda

2. **Budget:**
   - $50/month acceptable? → Lambda
   - $150/month acceptable? → EC2
   - $372 for first 2 months? → Hybrid

3. **Team Expertise:**
   - Team has AWS Lambda experience? → Lambda
   - Team has Node.js/Express experience? → EC2
   - Team willing to learn serverless? → Hybrid

4. **Long-term Vision:**
   - Expect user growth (50 → 200 users)? → Lambda (auto-scales)
   - User count stable? → EC2 (simpler)

5. **Maintenance:**
   - Want AWS to manage infrastructure? → Lambda
   - Comfortable managing servers? → EC2

---

## Appendix: Quick Reference

### Lambda Function Summary

| # | Function Name | Purpose | Memory | Timeout | Cost/Month |
|---|--------------|---------|--------|---------|------------|
| 1 | `authorizer` | Validate JWT tokens | 256 MB | 10s | $0.00 |
| 2 | `get-current-user` | Get user profile | 512 MB | 30s | $0.00 |
| 3 | `list-poams` | List POAMs with RBAC | 512 MB | 30s | $0.00 |
| 4 | `get-poam` | Get single POAM | 512 MB | 30s | $0.00 |
| 5 | `create-poam` | Create new POAM | 512 MB | 30s | $0.00 |
| 6 | `update-poam` | Update POAM | 512 MB | 30s | $0.00 |
| 7 | `delete-poam` | Delete POAM | 512 MB | 30s | $0.00 |
| 8 | `generate-upload-url` | S3 presigned URL | 512 MB | 30s | $0.00 |
| 9 | `process-scan` | Parse CSV, create POAMs | 1024 MB | 300s | $0.50 |
| 10 | `get-scan-status` | Check scan status | 512 MB | 30s | $0.00 |
| 11 | `upload-evidence` | Evidence presigned URL | 512 MB | 30s | $0.00 |
| 12 | `get-evidence` | Download evidence | 512 MB | 30s | $0.00 |
| 13 | `generate-report` | Create OSCAL/CSV/XLSX | 1024 MB | 60s | $0.00 |
| 14 | `list-reports` | List reports | 512 MB | 30s | $0.00 |
| 15 | `migrate-data` | Import from IndexedDB | 1024 MB | 300s | $0.00 |

**Total: 15 functions, ~41,850 requests/month, $0.50/month**

### Cost Comparison Summary

| Approach | Setup Time | Monthly Cost | 3-Year Total |
|----------|-----------|--------------|--------------|
| **Lambda** | 8 weeks | $50 | $2,250 |
| **EC2** | 2 weeks | $150 | $7,200 |
| **Hybrid** | 8 weeks (POC in 2) | $50 (after migration) | $2,622 |

**Savings with Lambda over 3 years: $4,950**

---

**Document Version:** 1.0  
**Last Updated:** March 11, 2026  
**Author:** AI Assistant  
**Purpose:** Help management decide between Lambda vs EC2 and provide complete configuration specification
