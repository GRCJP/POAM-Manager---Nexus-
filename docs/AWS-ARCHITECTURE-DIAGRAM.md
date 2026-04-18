# POAM Nexus AWS Architecture Diagram

## High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER LAYER                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Web App    │  │  Mobile/Tab  │  │   Desktop    │  │  API Client  │      │
│  │  (Browser)   │  │  (Responsive)│  │  (Electron)  │  │  (Scripts)   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼─────────────────┼─────────────────┼─────────────────┼───────────┘
          │                 │                 │                 │
          └─────────────────┴─────────────────┴─────────────────┘
                              │
                              ▼ HTTPS (TLS 1.3)
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EDGE LAYER (CDN)                                  │
│                         ┌──────────────────┐                                │
│                         │   CLOUDFRONT CDN   │                                │
│                         │  (Global Caching)  │                                │
│                         │  - Static Assets   │                                │
│                         │  - API Responses   │                                │
│                         │  - DDoS Protection │                                │
│                         └─────────┬──────────┘                                │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND HOSTING                                     │
│                      ┌──────────────────┐                                   │
│                      │   S3 BUCKET      │                                   │
│                      │  (Static Website)│                                   │
│                      │  - HTML/CSS/JS   │                                   │
│                      │  - Images/Fonts  │                                   │
│                      │  - Versioning    │                                   │
│                      └──────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ API Calls (REST/HTTPS)
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY LAYER                                   │
│                    ┌────────────────────────┐                               │
│                    │     API GATEWAY          │                               │
│                    │  ┌────────────────────┐ │                               │
│                    │  │  JWT Validation    │ │                               │
│                    │  │  Rate Limiting     │ │                               │
│                    │  │  Request Routing   │ │                               │
│                    │  │  Caching Layer     │ │                               │
│                    │  └────────────────────┘ │                               │
│                    └───────────┬─────────────┘                               │
└────────────────────────────────┼────────────────────────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              ▼                  ▼                  ▼
┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   DAILY TRAFFIC │  │  BURST TRAFFIC   │  │ SCHEDULED TASKS  │
│                 │  │                  │  │                  │
│   ┌─────────┐   │  │   ┌─────────┐    │  │   ┌─────────┐    │
│   │  EC2    │   │  │   │ LAMBDA  │    │  │   │EVENTBRID│    │
│   │  (t3.  │   │  │   │FUNCTIONS│    │  │   │   GE      │    │
│   │ small)  │   │  │   │         │    │  │   │         │    │
│   │         │   │  │   │• Import │    │  │   │         │    │
│   │• Login  │   │  │   │• Export │    │  │   │• Reports│    │
│   │• CRUD   │   │  │   │• Process│    │  │   │• Alerts │    │
│   │• View   │   │  │   │• Notify │    │  │   │• Backup │    │
│   │         │   │  │   │         │    │  │   │         │    │
│   │24/7     │   │  │   │On-Demand│    │  │   │Timed    │    │
│   │Running  │   │  │   │         │    │  │   │         │    │
│   └────┬────┘   │  │   └────┬────┘    │  │   └────┬────┘    │
└────────┼────────┘  └────────┼─────────┘  └────────┼──────────┘
         │                    │                    │
         └────────────────────┴────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                          │
│                                                                              │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │                    DYNAMODB (NoSQL Database)                        │    │
│   │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │    │
│   │  │   POAMs    │  │   Users    │  │   Scans    │  │  Systems   │  │    │
│   │  │   Table    │  │   Table    │  │   Table    │  │   Table    │  │    │
│   │  │            │  │            │  │            │  │            │  │    │
│   │  │ • Findings │  │ • Accounts│  │ • Results  │  │ • Assets   │  │    │
│   │  │ • Status   │  │ • Roles   │  │ • Metadata │  │ • Tags     │  │    │
│   │  │ • Dates    │  │ • MFA     │  │ • History  │  │ • Config   │  │    │
│   │  └────────────┘  └────────────┘  └────────────┘  └────────────┘  │    │
│   │                                                                  │    │
│   │  Features: Auto-scaling │ Encryption │ Backups │ Global Tables   │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │                 SECRETS MANAGER (Sensitive Data)                    │    │
│   │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐       │    │
│   │  │ CDM API Keys   │  │ Qualys Creds   │  │ JWT Signing    │       │    │
│   │  │ (Encrypted)    │  │ (Encrypted)    │  │ Keys           │       │    │
│   │  └────────────────┘  └────────────────┘  └────────────────┘       │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      AUTHENTICATION LAYER                                   │
│                         ┌──────────────────┐                                │
│                         │  COGNITO USER POOL │                               │
│                         │                  │                                │
│                         │  • User Sign-up  │                                │
│                         │  • Login/Logout    │                                │
│                         │  • Password Reset  │                                │
│                         │  • MFA Support     │                                │
│                         │  • JWT Tokens      │                                │
│                         └──────────────────┘                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MONITORING LAYER                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  CLOUDWATCH      │  │    X-RAY         │  │    SNS           │          │
│  │  • Logs          │  │  • Tracing       │  │  • Alerts        │          │
│  │  • Metrics       │  │  • Performance   │  │  • Email         │          │
│  │  • Dashboards    │  │  • Debugging     │  │  • SMS           │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### 1. Daily User Login
```
User Browser → CloudFront → S3 (Static Site)
     │
     │ Login Request
     ▼
API Gateway → JWT Validation → Cognito
     │                           │
     │ Valid Token              │ Check Credentials
     ▼                           ▼
   EC2 ←───────────────────────── Validated
     │
     │ Query User Data
     ▼
DynamoDB (Users Table)
     │
     │ Return User Profile
     ▼
   EC2 → Return JWT + User Data → API Gateway → Browser
```

### 2. View POAMs (Daily Operation)
```
User Browser
     │
     │ GET /api/poams
     ▼
API Gateway (Auth Check)
     │
     │ Valid JWT
     ▼
   EC2 (Running 24/7)
     │
     │ Query POAMs
     ▼
DynamoDB (POAMs Table)
     │
     │ Return Results
     ▼
   EC2 → Filter/Format → JSON Response
     │
     ▼
API Gateway → CloudFront → Browser
```

### 3. Large CSV Import (Burst Operation)
```
User Browser
     │
     │ POST /api/import (5MB CSV)
     ▼
API Gateway (Auth + Size Check)
     │
     │ Route to Lambda
     ▼
Lambda Function (Spawned on demand)
     │
     ├─→ Parse CSV (PapaParse)
     ├─→ Validate Data
     ├─→ Transform to POAM Format
     │
     │ Batch Write
     ▼
DynamoDB (Bulk Insert)
     │
     │ Success Response
     ▼
Lambda → API Gateway → Browser
     │
     │ Send Notification
     ▼
SNS → Email User ("Import Complete")
```

### 4. CISA CDM Integration
```
EventBridge (Scheduled: Every 6 hours)
     │
     │ Trigger
     ▼
Lambda (CDM Sync Function)
     │
     ├─→ Fetch Credentials from Secrets Manager
     ├─→ Call CISA CDM API
     │     │
     │     ▼
     │ CISA CDM Endpoint
     │     │
     │     ▼
     │ Return Vulnerability Data
     │
     ├─→ Transform CDM → POAM Format
     ├─→ Deduplicate (Compare with DynamoDB)
     │
     │ Store New/Updated
     ▼
DynamoDB (POAMs Table)
     │
     │ Notify Users
     ▼
SNS → Email ("New Vulnerabilities Found: 23")
```

---

## Network Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         VPC (Virtual Private Cloud)              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    PUBLIC SUBNET                          │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │  │
│  │  │   EC2       │  │   NAT       │  │   ALB       │  │  │
│  │  │  Instance   │  │  Gateway    │  │ (Optional)  │  │  │
│  │  │             │  │             │  │             │  │  │
│  │  │• Nginx     │  │• Outbound   │  │• HTTPS      │  │  │
│  │  │• Node.js   │  │• No inbound │  │• Routing    │  │  │
│  │  │• PM2       │  │             │  │             │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │  │
│  │         │                                        │       │  │
│  └─────────┼────────────────────────────────────────┼───────┘  │
│            │ Security Group: Web Traffic Only        │          │
│            │            │                          │          │
│            ▼            │                          ▼          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   PRIVATE SUBNET                          │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │           VPC ENDPOINTS                             │  │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐          │  │  │
│  │  │  │DynamoDB  │ │ Secrets  │ │  S3      │          │  │  │
│  │  │  │Endpoint  │ │ Manager  │ │ Endpoint │          │  │  │
│  │  │  │          │ │ Endpoint │ │          │          │  │  │
│  │  │  │No public │ │No public │ │No public │          │  │  │
│  │  │  │internet! │ │internet! │ │internet! │          │  │  │
│  │  │  └──────────┘ └──────────┘ └──────────┘          │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Cost Architecture

```
Monthly Cost Breakdown (50 users, daily usage):

┌────────────────────────────────────────────────────────────┐
│                    FREE TIER (Included)                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │   Lambda    │ │   Cognito   │ │ EventBridge │         │
│  │  1M requests│ │  50K users  │ │  1M events  │         │
│  │   $0.00     │ │    $0.00    │ │    $0.00    │         │
│  └─────────────┘ └─────────────┘ └─────────────┘         │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│                    PAID SERVICES                            │
│                                                             │
│  EC2 (t3.small)     ████████████████████░░░░░░░░ $15.00    │
│  DynamoDB           ██████████░░░░░░░░░░░░░░░░░░  $0.88    │
│  S3 (5GB)           ██░░░░░░░░░░░░░░░░░░░░░░░░░░  $1.00    │
│  CloudFront         ██░░░░░░░░░░░░░░░░░░░░░░░░░░  $1.00    │
│  API Gateway        ████░░░░░░░░░░░░░░░░░░░░░░░░  $1.05    │
│  Data Transfer      █░░░░░░░░░░░░░░░░░░░░░░░░░░░  $0.10    │
│  CloudWatch         ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  $0.00    │
│                                                             │
│  TOTAL: ~$19.03/month                                      │
└────────────────────────────────────────────────────────────┘

Scale to 1000 users: ~$50-60/month
Scale to 10000 users: ~$150-200/month
```

---

## Deployment Pipeline

```
Developer Machine                    AWS Cloud
┌─────────────────┐                ┌──────────────────────────────┐
│  Local Code     │                │      CodePipeline / SAM     │
│  Changes        │                │                              │
└────────┬────────┘                │  ┌────────────────────────┐  │
         │                         │  │      Build Stage       │  │
         │ git push                │  │  ┌──────────────────┐  │  │
         ▼                         │  │  │  SAM Build        │  │  │
┌─────────────────┐                │  │  │  • Compile Lambda │  │  │
│    GitHub       │───────────────▶│  │  │  • Package        │  │  │
│    Repository   │   Trigger      │  │  │  • Run Tests      │  │  │
└─────────────────┘                │  │  └──────────────────┘  │  │
                                   │  └────────────────────────┘  │
                                   │                              │
                                   │  ┌────────────────────────┐  │
                                   │  │     Deploy Stage         │  │
                                   │  │  ┌──────────────────┐  │  │
                                   │  │  │  CloudFormation   │  │  │
                                   │  │  │  • Create/Update  │  │  │
                                   │  │  │  • Rollback on    │  │  │
                                   │  │  │    Failure        │  │  │
                                   │  │  └──────────────────┘  │  │
                                   │  └────────────────────────┘  │
                                   │                              │
                                   │  ┌────────────────────────┐  │
                                   │  │    Test Stage            │  │
                                   │  │  • Integration Tests    │  │
                                   │  │  • Smoke Tests          │  │
                                   │  │  • Notification         │  │  │
                                   │  └────────────────────────┘  │
                                   │                              │
                                   └──────────────────────────────┘
```

---

## Component Legend

| Symbol | Meaning |
|--------|---------|
| 🔵 Blue | Daily Operations (EC2) |
| 🟡 Yellow | Burst/On-Demand (Lambda) |
| 🟢 Green | Data Storage (DynamoDB/S3) |
| 🔴 Red | Security/Auth (Cognito/Secrets) |
| 🟣 Purple | Monitoring (CloudWatch/X-Ray) |
| 🟠 Orange | Network/CDN (CloudFront/API Gateway) |

---

*Generated: April 2026*
*Architecture Version: Hybrid v1.0*
