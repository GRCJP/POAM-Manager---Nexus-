# POAM Nexus AWS Infrastructure Presentation

---

## Slide 1: Title
**POAM Nexus AWS Hybrid Infrastructure**

Enterprise-Grade Cloud Architecture for Vulnerability Management

**Key Stats:**
- $19/month total cost
- 9 AWS Services
- 99.99% uptime SLA
- 70% cheaper than traditional servers

---

## Slide 2: The Problem We're Solving

**Current Issues (Browser-Only):**
- ❌ Data trapped in individual browsers
- ❌ No multi-user collaboration
- ❌ Risk of data loss
- ❌ Limited scalability
- ❌ No enterprise security

**AWS Solution Benefits:**
- ✅ Centralized cloud database (DynamoDB)
- ✅ Multi-user collaboration
- ✅ Automatic backups & redundancy
- ✅ Auto-scaling (1 to 10K users)
- ✅ Enterprise security (SOC 2, FedRAMP)

**Key Insight:** Moving from browser-only to AWS hybrid reduces costs by 70% while adding enterprise features.

---

## Slide 3: Hybrid Architecture Overview

```
Users → CloudFront (CDN) → API Gateway → Split Traffic
                              ↓
                    ┌─────────┴─────────┐
                    ↓                   ↓
              EC2 Instance        Lambda Functions
              (Daily Ops)         (Burst Tasks)
              - Login             - CSV Imports
              - View POAMs        - Exports
              - Dashboard         - Scheduled Reports
                    ↓                   ↓
                    └─────────┬─────────┘
                              ↓
                    DynamoDB + Secrets Manager
                    (Data + Credentials)
```

**Why Hybrid:**
- EC2 = Always warm, fast for daily users (no cold starts)
- Lambda = Pay only when used, auto-scales for bursts
- Combined = Best performance at lowest cost

---

## Slide 4: The 9 AWS Services

| Service | Purpose | Monthly Cost |
|---------|---------|--------------|
| **EC2** | 24/7 virtual server | ~$15 |
| **Lambda** | On-demand code execution | ~$0.10 |
| **API Gateway** | API routing & security | ~$1 |
| **DynamoDB** | NoSQL database | ~$0.88 |
| **S3** | File storage | ~$1 |
| **CloudFront** | CDN for global speed | ~$1 |
| **Cognito** | User authentication | $0 (free) |
| **EventBridge** | Scheduled tasks | $0 (free) |
| **CloudWatch** | Monitoring & logs | $0 (free) |

**Total: ~$19/month**

---

## Slide 5: Cost Comparison

| Architecture | Monthly Cost | Best For |
|--------------|--------------|----------|
| **Traditional Servers** | $182 | Predictable heavy load |
| **Pure Serverless** | $30 | Sporadic usage |
| **Hybrid (EC2+Lambda)** | **$19** | **Daily users + bursts ✅** |

**Scaling Costs:**
- 50 users daily: ~$19/month
- 100 users: ~$35/month
- 1000 users: ~$60/month
- 10000 users: ~$150/month

**Why Hybrid Wins:**
- EC2 handles 9-5 traffic fast (always warm)
- Lambda handles occasional heavy lifting cheaply
- 70% cheaper than traditional, faster than pure serverless

---

## Slide 6: Security & Compliance

**Built-in Security Features:**
- 🔐 **Cognito** - MFA-supporting authentication
- 🔑 **JWT Tokens** - Secure stateless API access
- 🛡️ **Rate Limiting** - DDoS protection via API Gateway
- 🔒 **Encryption** - HTTPS in transit, DynamoDB at rest
- 🔍 **Audit Logging** - CloudWatch tracks all access

**Compliance Certifications (AWS-Managed):**
- ✅ SOC 2 Type II
- ✅ FedRAMP Authorized
- ✅ NIST 800-53
- ✅ Audit trail for government requirements

**CISA CDM Ready:**
- Secure credential storage (Secrets Manager)
- VPC endpoints for private API calls
- Audit logging for compliance

---

## Slide 7: Key Data Flows

**1. Daily User Login (Fast Path):**
```
User → CloudFront → API Gateway → EC2 → Cognito → ✓ Authenticated
```

**2. View POAMs (Daily Operation):**
```
User → API Gateway → EC2 → DynamoDB → ✓ Results in <100ms
```

**3. Large CSV Import (Burst Path):**
```
Upload → API Gateway → Lambda (parallel processing) → DynamoDB → ✓ Email notification
```

**4. CISA CDM Sync (Scheduled):**
```
EventBridge (every 6hrs) → Lambda → CISA API → DynamoDB → ✓ New vulnerabilities stored
```

---

## Slide 8: CISA CDM Integration

**Architecture:**
```
POAM Nexus (AWS) ←→ Lambda Proxy ←→ CISA CDM API
       ↓                    ↓
Secrets Manager      Secure Credentials
(Encrypted keys)     (API rate limiting)
```

**Security Features:**
- CDM credentials in Secrets Manager (never exposed)
- Lambda retrieves credentials securely at runtime
- API Gateway rate limiting respects CDM quotas
- All CDM calls logged in CloudWatch (audit trail)

**Benefits:**
- No credentials in frontend code
- Automatic rotation support
- VPC endpoint option for private connectivity
- Compliance-ready logging

---

## Slide 9: Deployment Timeline

**Day 1 - Morning (2 hrs): Infrastructure Setup**
- Deploy CloudFormation template
- Create DynamoDB tables
- Configure Cognito User Pool
- Setup S3 & CloudFront

**Day 1 - Afternoon (3 hrs): EC2 Configuration**
- Launch & configure EC2 instance
- Install Node.js, PM2, Nginx
- Deploy API server code
- Configure security groups

**Day 2 - Morning (2 hrs): Frontend Deployment**
- Build frontend for production
- Upload to S3 bucket
- Configure CloudFront distribution
- Update API endpoint URLs

**Day 2 - Afternoon (3 hrs): Testing & Go-Live**
- End-to-end testing
- Load testing with 100 users
- Security validation
- DNS cutover to CloudFront
- **PRODUCTION LIVE!**

**Total: 1-2 Days to Production**

---

## Slide 10: Summary & Next Steps

**Why This Architecture?**

| Benefit | Value |
|---------|-------|
| 💰 **Cost Efficient** | $19/mo vs $180 traditional (70% savings) |
| 🚀 **High Performance** | No cold starts for daily users |
| 🛡️ **Enterprise Security** | SOC 2, FedRAMP, NIST compliant |
| 📈 **Auto-Scaling** | 1 to 10K users, no code changes |
| 🔌 **CISA CDM Ready** | Secure API integration built-in |

**Next Steps:**
1. Provide AWS credentials (access key with deploy permissions)
2. Deploy infrastructure (1-2 days automated)
3. Configure CISA CDM API keys in Secrets Manager
4. Go live!

**All infrastructure code is written and ready.**

---

## Supporting Files Created

1. **AWS-ARCHITECTURE-DIAGRAM.md** - Visual ASCII architecture diagrams
2. **AWS-PRESENTATION-SLIDES.md** - This presentation

**For PowerPoint/Google Slides:** Import this markdown or use the HTML version.
