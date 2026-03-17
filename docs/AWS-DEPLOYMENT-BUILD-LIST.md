# POAM Nexus - AWS Deployment Build List

**Target Architecture:** Multi-user cloud deployment with Active Directory authentication, PostgreSQL database, and S3 file storage

**Last Updated:** March 9, 2026

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Active Directory Integration](#active-directory-integration)
4. [Database Strategy](#database-strategy)
5. [S3 Storage Strategy](#s3-storage-strategy)
6. [Build Phases](#build-phases)
7. [Security & Compliance](#security--compliance)
8. [Cost Estimates](#cost-estimates)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Users (Browser)                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CloudFront (CDN + WAF)                        │
│                   SSL/TLS Termination                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Application Load Balancer (ALB)                    │
│              - Health checks                                    │
│              - SSL offloading                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                ▼                         ▼
┌───────────────────────┐   ┌───────────────────────┐
│   ECS Fargate         │   │   ECS Fargate         │
│   (Frontend - React)  │   │   (Backend - Node.js) │
│   - Static assets     │   │   - Express API       │
│   - Client-side app   │   │   - JWT auth          │
└───────────────────────┘   └──────────┬────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
        ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐
        │   RDS PostgreSQL │  │  S3 Buckets  │  │  AWS Cognito │
        │   Multi-AZ       │  │  - Scan files│  │  + AD Sync   │
        │   - POAM data    │  │  - Evidence  │  │  - SAML 2.0  │
        │   - Audit logs   │  │  - Backups   │  │  - User pool │
        └──────────────────┘  └──────────────┘  └──────────────┘
                                                        │
                                                        ▼
                                            ┌──────────────────────┐
                                            │  Active Directory    │
                                            │  (On-prem or AWS AD) │
                                            │  - User directory    │
                                            │  - Groups/Roles      │
                                            └──────────────────────┘
```

---

## Technology Stack

### Frontend
- **Framework:** React 18+ (migrated from vanilla JS)
- **State Management:** React Context + IndexedDB (offline mode)
- **UI Library:** Tailwind CSS (existing)
- **Build Tool:** Vite
- **Hosting:** S3 + CloudFront OR ECS Fargate

### Backend (NEW)
- **Runtime:** Node.js 20 LTS
- **Framework:** Express.js
- **ORM:** Prisma
- **Authentication:** Passport.js + JWT
- **API:** RESTful + GraphQL (optional)

### Database
- **Primary:** Amazon RDS PostgreSQL 15
  - Multi-AZ deployment for HA
  - Automated backups (7-day retention)
  - Read replicas for reporting
- **Alternative:** Aurora PostgreSQL Serverless v2 (auto-scaling)

### Storage
- **S3 Buckets:**
  - `poam-nexus-scan-uploads` - Vulnerability scan files
  - `poam-nexus-evidence` - Evidence artifacts
  - `poam-nexus-backups` - Database backups
  - `poam-nexus-reports` - Generated reports (OSCAL, CSV, XLSX)

### Authentication
- **AWS Cognito User Pool** + Active Directory Federation
- **SAML 2.0** for SSO
- **JWT tokens** for API authentication
- **Role-Based Access Control (RBAC)**

---

## Active Directory Integration

### Option 1: AWS Managed Microsoft AD (Recommended for Gov/Enterprise)

**Architecture:**
```
On-Prem AD ←→ AWS Directory Service (Managed AD) ←→ AWS Cognito ←→ POAM Nexus
```

**Setup:**
1. Deploy AWS Managed Microsoft AD in VPC
2. Configure AD Connector or two-way trust with on-prem AD
3. Sync users/groups to Cognito User Pool
4. Map AD groups to RBAC roles

**Pros:**
- Native AWS integration
- Automatic user/group sync
- Supports MFA
- FedRAMP compliant option available

**Cons:**
- Higher cost (~$150-300/month)
- Requires VPC setup

---

### Option 2: SAML 2.0 Federation (Lower Cost)

**Architecture:**
```
On-Prem AD ←→ ADFS/Azure AD ←→ AWS Cognito (SAML) ←→ POAM Nexus
```

**Setup:**
1. Configure ADFS or Azure AD as SAML Identity Provider
2. Register POAM Nexus as Service Provider in ADFS
3. Configure Cognito to accept SAML assertions
4. Map SAML attributes to user roles

**Pros:**
- Lower AWS costs
- Leverages existing ADFS/Azure AD
- No VPC required

**Cons:**
- Requires ADFS/Azure AD infrastructure
- More complex initial setup

---

### RBAC Role Mapping

**AD Groups → POAM Nexus Roles:**

| AD Group | POAM Role | Permissions |
|----------|-----------|-------------|
| `POAM-Admins` | `admin` | Full access, user management, system config |
| `POAM-SystemOwners` | `system_owner` | Manage POAMs for assigned systems, approve milestones |
| `POAM-Engineers` | `engineer` | Create/edit POAMs, upload scans, add evidence |
| `POAM-Executives` | `executive` | Read-only dashboard, reports, metrics |
| `POAM-Auditors` | `auditor` | Read-only access, audit logs, export data |

**Implementation:**
```javascript
// Backend: middleware/rbac.js
const rolePermissions = {
  admin: ['*'],
  system_owner: ['poam:read', 'poam:write', 'poam:approve', 'system:manage'],
  engineer: ['poam:read', 'poam:write', 'scan:upload', 'evidence:upload'],
  executive: ['dashboard:read', 'report:read', 'metric:read'],
  auditor: ['poam:read', 'audit:read', 'export:read']
};

function checkPermission(userRole, requiredPermission) {
  const permissions = rolePermissions[userRole] || [];
  return permissions.includes('*') || permissions.includes(requiredPermission);
}
```

---

## Database Strategy

### Recommended: Amazon RDS PostgreSQL 15

**Configuration:**
- **Instance Class:** db.t4g.medium (2 vCPU, 4 GB RAM) - start small
- **Storage:** 100 GB GP3 SSD (auto-scaling enabled)
- **Multi-AZ:** Yes (for production)
- **Backup:** Automated daily backups, 7-day retention
- **Encryption:** At-rest (AWS KMS) + in-transit (SSL/TLS)

**Schema Design:**
```sql
-- Users (synced from AD via Cognito)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cognito_sub VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  role VARCHAR(50) NOT NULL,
  ad_groups TEXT[],
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Systems (enclaves/applications)
CREATE TABLE systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  system_owner_id UUID REFERENCES users(id),
  classification VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- POAMs (main table)
CREATE TABLE poams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID REFERENCES systems(id),
  poam_id VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  risk_level VARCHAR(20),
  status VARCHAR(50),
  poc_id UUID REFERENCES users(id),
  poc_team VARCHAR(255),
  scheduled_completion_date DATE,
  actual_completion_date DATE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Affected Assets
CREATE TABLE affected_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poam_id UUID REFERENCES poams(id) ON DELETE CASCADE,
  hostname VARCHAR(255),
  ip_address INET,
  os VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Milestones
CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poam_id UUID REFERENCES poams(id) ON DELETE CASCADE,
  milestone_date DATE NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50),
  completed_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Scan Files (metadata, actual files in S3)
CREATE TABLE scan_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID REFERENCES systems(id),
  filename VARCHAR(255) NOT NULL,
  s3_bucket VARCHAR(255) NOT NULL,
  s3_key VARCHAR(500) NOT NULL,
  file_size BIGINT,
  scan_type VARCHAR(50),
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Evidence Files (metadata, actual files in S3)
CREATE TABLE evidence_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poam_id UUID REFERENCES poams(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  s3_bucket VARCHAR(255) NOT NULL,
  s3_key VARCHAR(500) NOT NULL,
  file_size BIGINT,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_poams_system_id ON poams(system_id);
CREATE INDEX idx_poams_status ON poams(status);
CREATE INDEX idx_poams_poc_id ON poams(poc_id);
CREATE INDEX idx_affected_assets_poam_id ON affected_assets(poam_id);
CREATE INDEX idx_milestones_poam_id ON milestones(poam_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

**Why PostgreSQL over DynamoDB:**
- ✅ Complex relational queries (POAMs + assets + milestones + users)
- ✅ ACID transactions for data integrity
- ✅ Full-text search capabilities
- ✅ Mature ecosystem (Prisma ORM, pgAdmin)
- ✅ Easier migration from IndexedDB structure
- ✅ Better for reporting/analytics
- ❌ DynamoDB would require denormalization and complex access patterns

---

## S3 Storage Strategy

### Bucket Architecture

**1. `poam-nexus-scan-uploads` (Scan Files)**
```
Lifecycle Policy:
- Transition to S3 Intelligent-Tiering after 30 days
- Delete after 2 years (or per retention policy)

Security:
- Server-side encryption (SSE-KMS)
- Bucket policy: Only authenticated users
- Versioning: Enabled
- Public access: BLOCKED

Structure:
s3://poam-nexus-scan-uploads/
  ├── {system-id}/
  │   ├── {year}/
  │   │   ├── {month}/
  │   │   │   ├── {scan-id}-qualys.csv
  │   │   │   ├── {scan-id}-nessus.csv
```

**2. `poam-nexus-evidence` (Evidence Files)**
```
Lifecycle Policy:
- Transition to S3 Glacier after 1 year
- Retain indefinitely (compliance)

Security:
- SSE-KMS with customer-managed key
- Object lock (WORM) for compliance
- Versioning: Enabled

Structure:
s3://poam-nexus-evidence/
  ├── {poam-id}/
  │   ├── screenshots/
  │   ├── reports/
  │   ├── remediation-docs/
```

**3. `poam-nexus-backups` (Database Backups)**
```
Lifecycle Policy:
- Transition to S3 Glacier Deep Archive after 90 days
- Delete after 7 years

Security:
- SSE-KMS
- Cross-region replication (DR)
- MFA delete enabled

Structure:
s3://poam-nexus-backups/
  ├── rds-automated/
  ├── manual-exports/
  │   ├── {date}-full-backup.sql.gz
```

**4. `poam-nexus-reports` (Generated Reports)**
```
Lifecycle Policy:
- Delete after 90 days

Structure:
s3://poam-nexus-reports/
  ├── {user-id}/
  │   ├── {report-id}.pdf
  │   ├── {report-id}.xlsx
  │   ├── {report-id}-oscal.json
```

### S3 Access Pattern

**Backend API Integration:**
```javascript
// Backend: services/s3-service.js
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

async function uploadScanFile(file, systemId, userId) {
  const key = `${systemId}/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${file.name}`;
  
  const params = {
    Bucket: 'poam-nexus-scan-uploads',
    Key: key,
    Body: file.buffer,
    ServerSideEncryption: 'aws:kms',
    Metadata: {
      'uploaded-by': userId,
      'system-id': systemId
    }
  };
  
  const result = await s3.upload(params).promise();
  
  // Save metadata to PostgreSQL
  await db.scanFiles.create({
    systemId,
    filename: file.name,
    s3Bucket: params.Bucket,
    s3Key: key,
    fileSize: file.size,
    uploadedBy: userId
  });
  
  return result.Location;
}

async function getPresignedDownloadUrl(s3Key) {
  const params = {
    Bucket: 'poam-nexus-scan-uploads',
    Key: s3Key,
    Expires: 300 // 5 minutes
  };
  
  return s3.getSignedUrl('getObject', params);
}
```

---

## Build Phases

### Phase 1: Infrastructure Setup (Week 1-2)

**1.1 AWS Account & Networking**
- [ ] Create/configure AWS account
- [ ] Set up VPC with public/private subnets (2 AZs minimum)
- [ ] Configure NAT Gateway for private subnets
- [ ] Set up Security Groups and NACLs
- [ ] Configure VPC Flow Logs

**1.2 Database Setup**
- [ ] Create RDS PostgreSQL instance (Multi-AZ)
- [ ] Configure security groups (allow only from ECS)
- [ ] Create database schema (run migration scripts)
- [ ] Set up automated backups
- [ ] Create read replica (optional, for reporting)

**1.3 S3 Buckets**
- [ ] Create 4 S3 buckets (scan-uploads, evidence, backups, reports)
- [ ] Configure bucket policies and encryption
- [ ] Set up lifecycle policies
- [ ] Enable versioning and logging
- [ ] Configure cross-region replication for backups

**1.4 Active Directory Integration**
- [ ] Deploy AWS Managed Microsoft AD OR configure SAML federation
- [ ] Set up AD Connector (if using on-prem AD)
- [ ] Test AD connectivity and user sync
- [ ] Create AD security groups for RBAC

---

### Phase 2: Authentication & User Management (Week 2-3)

**2.1 AWS Cognito Setup**
- [ ] Create Cognito User Pool
- [ ] Configure SAML identity provider (AD FS or Azure AD)
- [ ] Set up user pool domain
- [ ] Configure app client for POAM Nexus
- [ ] Enable MFA (optional but recommended)

**2.2 User Sync & RBAC**
- [ ] Configure AD group → Cognito group mapping
- [ ] Create Lambda function for user provisioning
- [ ] Set up attribute mapping (email, name, groups)
- [ ] Test SSO login flow
- [ ] Implement JWT token validation in backend

**2.3 Backend Auth Implementation**
- [ ] Install Passport.js + JWT strategy
- [ ] Create authentication middleware
- [ ] Implement RBAC permission checks
- [ ] Add audit logging for auth events
- [ ] Test role-based access

---

### Phase 3: Backend API Development (Week 3-5)

**3.1 API Foundation**
- [ ] Initialize Node.js + Express project
- [ ] Set up Prisma ORM with PostgreSQL
- [ ] Create database models (users, systems, poams, etc.)
- [ ] Run Prisma migrations
- [ ] Set up environment configuration

**3.2 Core API Endpoints**
- [ ] **Auth:** `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
- [ ] **Systems:** CRUD for systems/enclaves
- [ ] **POAMs:** CRUD for POAMs
- [ ] **Assets:** CRUD for affected assets
- [ ] **Milestones:** CRUD for milestones
- [ ] **Scans:** Upload scan file, parse CSV, create POAMs
- [ ] **Evidence:** Upload/download evidence files
- [ ] **Reports:** Generate OSCAL, CSV, XLSX exports
- [ ] **Users:** User management (admin only)
- [ ] **Audit:** Query audit logs

**3.3 S3 Integration**
- [ ] Implement file upload to S3 (scans, evidence)
- [ ] Generate presigned URLs for downloads
- [ ] Handle file metadata in PostgreSQL
- [ ] Implement file size/type validation

**3.4 API Testing**
- [ ] Write unit tests (Jest)
- [ ] Write integration tests
- [ ] Test RBAC permissions
- [ ] Load testing (Artillery or k6)

---

### Phase 4: Frontend Migration (Week 5-7)

**4.1 React Setup**
- [ ] Create React app with Vite
- [ ] Migrate existing HTML/CSS to React components
- [ ] Set up React Router for navigation
- [ ] Implement Context API for state management
- [ ] Keep Tailwind CSS styling

**4.2 Authentication UI**
- [ ] Create login page with Cognito Hosted UI redirect
- [ ] Implement JWT token storage (httpOnly cookies)
- [ ] Add token refresh logic
- [ ] Create protected route wrapper
- [ ] Add logout functionality

**4.3 Component Migration**
- [ ] Dashboard module → React component
- [ ] Vulnerability tracking → React component
- [ ] POAM detail view → React component
- [ ] Reporting module → React component
- [ ] Upload modal → React component
- [ ] Migrate all existing features to React

**4.4 API Integration**
- [ ] Replace IndexedDB calls with API fetch calls
- [ ] Implement offline mode (optional, IndexedDB fallback)
- [ ] Add loading states and error handling
- [ ] Implement optimistic UI updates

---

### Phase 5: Deployment & DevOps (Week 7-8)

**5.1 Container Setup**
- [ ] Create Dockerfile for backend (Node.js)
- [ ] Create Dockerfile for frontend (Nginx + React build)
- [ ] Build and test Docker images locally
- [ ] Push images to Amazon ECR

**5.2 ECS Fargate Deployment**
- [ ] Create ECS cluster
- [ ] Create task definitions (frontend, backend)
- [ ] Configure ECS services with auto-scaling
- [ ] Set up Application Load Balancer
- [ ] Configure ALB target groups and health checks
- [ ] Set up CloudWatch logs

**5.3 CloudFront & DNS**
- [ ] Create CloudFront distribution
- [ ] Configure SSL certificate (ACM)
- [ ] Set up custom domain (Route 53)
- [ ] Configure WAF rules (optional)
- [ ] Test CDN caching

**5.4 CI/CD Pipeline**
- [ ] Set up GitHub Actions or AWS CodePipeline
- [ ] Automate Docker build on push to main
- [ ] Automate ECR push
- [ ] Automate ECS deployment
- [ ] Add automated testing in pipeline

---

### Phase 6: Security & Compliance (Week 8-9)

**6.1 Security Hardening**
- [ ] Enable AWS GuardDuty
- [ ] Configure AWS Config rules
- [ ] Set up AWS Security Hub
- [ ] Enable CloudTrail logging
- [ ] Configure VPC Flow Logs
- [ ] Implement WAF rules (SQL injection, XSS)

**6.2 Compliance**
- [ ] Document data retention policies
- [ ] Implement audit logging for all actions
- [ ] Configure encryption at rest (RDS, S3)
- [ ] Configure encryption in transit (TLS 1.2+)
- [ ] Create compliance reports (NIST 800-53, FedRAMP)

**6.3 Backup & DR**
- [ ] Test RDS automated backups
- [ ] Create manual backup procedure
- [ ] Set up cross-region replication
- [ ] Document disaster recovery plan
- [ ] Test restore procedure

---

### Phase 7: Testing & Launch (Week 9-10)

**7.1 User Acceptance Testing**
- [ ] Create test users in AD
- [ ] Test SSO login flow
- [ ] Test all RBAC roles
- [ ] Test POAM CRUD operations
- [ ] Test scan upload and parsing
- [ ] Test evidence upload/download
- [ ] Test report generation

**7.2 Performance Testing**
- [ ] Load test API endpoints
- [ ] Test concurrent user scenarios
- [ ] Optimize slow queries
- [ ] Configure database connection pooling
- [ ] Test auto-scaling behavior

**7.3 Documentation**
- [ ] Create user guide
- [ ] Create admin guide
- [ ] Document API endpoints (Swagger/OpenAPI)
- [ ] Create runbook for operations
- [ ] Document troubleshooting procedures

**7.4 Launch**
- [ ] Final security review
- [ ] Final compliance review
- [ ] Production deployment
- [ ] Monitor CloudWatch metrics
- [ ] User training sessions

---

## Security & Compliance

### NIST 800-53 Controls Addressed

| Control | Implementation |
|---------|----------------|
| AC-2 (Account Management) | AWS Cognito + AD sync, automated provisioning |
| AC-3 (Access Enforcement) | RBAC middleware, JWT validation |
| AC-6 (Least Privilege) | Role-based permissions, principle of least privilege |
| AU-2 (Audit Events) | Comprehensive audit logging in PostgreSQL + CloudTrail |
| AU-9 (Protection of Audit Info) | S3 object lock, CloudTrail log file validation |
| IA-2 (Identification & Auth) | MFA via Cognito, SAML SSO |
| SC-8 (Transmission Confidentiality) | TLS 1.2+ for all connections |
| SC-13 (Cryptographic Protection) | AES-256 encryption at rest (KMS), TLS in transit |
| SC-28 (Protection of Info at Rest) | RDS encryption, S3 SSE-KMS |

### FedRAMP Considerations

If targeting FedRAMP compliance:
- Use **AWS GovCloud** regions
- Enable **AWS Config** for continuous compliance
- Implement **FIPS 140-2** validated encryption
- Use **AWS Artifact** for compliance documentation
- Consider **AWS Managed Services** for operations

---

## Cost Estimates

### Monthly AWS Costs (Estimated)

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| **RDS PostgreSQL** | db.t4g.medium, Multi-AZ, 100GB | $120 |
| **ECS Fargate** | 2 tasks (1 vCPU, 2GB each) | $60 |
| **Application Load Balancer** | 1 ALB | $25 |
| **S3 Storage** | 500 GB (mixed tiers) | $15 |
| **CloudFront** | 1 TB data transfer | $85 |
| **AWS Managed AD** | Standard edition | $150 |
| **Cognito** | 10,000 MAU | $50 |
| **CloudWatch Logs** | 10 GB/month | $5 |
| **Data Transfer** | 500 GB outbound | $45 |
| **Backups & Snapshots** | RDS + S3 | $20 |
| **Route 53** | Hosted zone + queries | $5 |
| **ACM Certificate** | Free | $0 |
| **Total** | | **~$580/month** |

**Cost Optimization Tips:**
- Use Reserved Instances for RDS (save 30-40%)
- Use Savings Plans for ECS Fargate (save 20%)
- Implement S3 Intelligent-Tiering
- Use CloudFront caching aggressively
- Consider Aurora Serverless v2 for variable workloads

---

## Next Steps

1. **Review & Approve Architecture** - Stakeholder sign-off
2. **Provision AWS Account** - Set up billing, IAM users
3. **Start Phase 1** - Infrastructure setup
4. **Weekly Progress Reviews** - Track against build list
5. **Security Review Checkpoints** - After Phases 2, 4, 6

---

## Questions to Answer Before Starting

1. **Active Directory:**
   - Do you have on-prem AD or Azure AD?
   - Do you have ADFS configured?
   - What AD groups exist for POAM users?

2. **Compliance:**
   - Is FedRAMP compliance required?
   - What is the data classification level?
   - What is the required data retention period?

3. **Scale:**
   - How many concurrent users expected?
   - How many POAMs in the system?
   - How many scan uploads per month?

4. **Budget:**
   - What is the monthly budget for AWS?
   - Can we use Reserved Instances/Savings Plans?

5. **Timeline:**
   - What is the target go-live date?
   - Are there any hard deadlines?

---

**Document Version:** 1.0  
**Author:** AI Assistant  
**Date:** March 9, 2026
