# AWS Serverless Infrastructure - Simple Explanation

## What You Requested (In Simple Terms)

You requested an **AWS serverless architecture** to keep costs low and scale automatically. Here's what each component does:

---

## The 7 AWS Services Explained

### 1. **S3 Buckets** 📦
**What it is:** Cloud storage for files  
**What we use it for:** Hosting the POAM Nexus website (HTML, JavaScript, CSS files)  
**Why:** Cheap storage ($0.023 per GB/month), no servers to manage  
**Cost:** ~$1-5/month for typical usage

### 2. **CloudFront Distribution** 🌐
**What it is:** Content Delivery Network (CDN)  
**What we use it for:** Makes the website load fast worldwide by caching files in edge locations  
**Why:** Users in California and Virginia both get fast load times  
**Cost:** ~$1-10/month depending on traffic

### 3. **API Gateway** 🚪
**What it is:** The "front door" for your API  
**What we use it for:** Routes requests like `/api/poams` or `/api/login` to the right Lambda function  
**Why:** Handles authentication, rate limiting, and CORS automatically  
**Cost:** $3.50 per million requests (first million free)

### 4. **Lambda Functions** ⚡
**What it is:** Code that runs only when needed (no servers running 24/7)  
**What we use it for:** All backend logic (login, get POAMs, create POAMs, etc.)  
**Why:** You only pay when code runs - if no one uses the app, you pay $0  
**Cost:** First 1 million requests free, then $0.20 per million  
**Examples:**
- `auth-login` - Handles user login
- `get-poams` - Retrieves POAMs from database
- `create-poam` - Creates new POAM
- `update-poam` - Updates existing POAM

### 5. **DynamoDB Tables** 🗄️
**What it is:** NoSQL database (like MongoDB but managed by AWS)  
**What we use it for:** Storing all POAM data, users, systems, scans  
**Why:** Scales automatically, pay-per-request pricing, no server management  
**Cost:** $1.25 per million writes, $0.25 per million reads  
**Tables we created:**
- `poams` - All POAM records
- `users` - User accounts
- `systems` - IT systems being monitored
- `scans` - Vulnerability scan data
- `workbook` - Security control monitoring

### 6. **Cognito (Authentication)** 🔐
**What it is:** User authentication service  
**What we use it for:** User login, password management, multi-factor authentication  
**Why:** Handles all security best practices automatically  
**Cost:** First 50,000 users free, then $0.0055 per user/month

### 7. **EventBridge** ⏰
**What it is:** Scheduled task runner (like cron jobs)  
**What we use it for:** Automated daily reports, overdue POAM notifications  
**Why:** Runs tasks on schedule without a server  
**Cost:** First 1 million events free

### 8. **CloudWatch** 📊
**What it is:** Monitoring and logging service  
**What we use it for:** Track errors, performance metrics, debug issues  
**Why:** See what's happening in your application  
**Cost:** First 5GB of logs free, then $0.50 per GB

---

## How It All Works Together

```
User opens website
    ↓
CloudFront serves website from S3 bucket
    ↓
User clicks "Login"
    ↓
JavaScript sends request to API Gateway
    ↓
API Gateway routes to "auth-login" Lambda function
    ↓
Lambda checks password against DynamoDB Users table
    ↓
Lambda returns JWT token via API Gateway
    ↓
User is logged in!

User clicks "View POAMs"
    ↓
JavaScript sends request with JWT token to API Gateway
    ↓
API Gateway validates token with Cognito
    ↓
API Gateway routes to "get-poams" Lambda function
    ↓
Lambda queries DynamoDB POAMs table
    ↓
Lambda returns POAM data
    ↓
Website displays POAMs
```

---

## Cost Breakdown (Monthly Estimates)

| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| **S3** | 5GB storage, 10K requests | $1 |
| **CloudFront** | 10GB data transfer | $1 |
| **API Gateway** | 100K requests | $0.35 |
| **Lambda** | 100K invocations, 512MB RAM | $0.20 |
| **DynamoDB** | 100K reads, 50K writes | $0.88 |
| **Cognito** | 50 users | $0 (free tier) |
| **EventBridge** | 100 scheduled events | $0 (free tier) |
| **CloudWatch** | 2GB logs | $0 (free tier) |
| **TOTAL** | | **~$3.43/month** |

**At scale (1,000 users, 1M requests/month):** ~$50-100/month

---

## Why Serverless vs Traditional Servers?

### Traditional Servers (What We Built First)
- **Cost:** $182/month even if no one uses it
- **Scaling:** Manual - need to add more servers
- **Management:** You manage OS updates, security patches
- **Downtime:** If server crashes, app goes down

### Serverless (What You Requested)
- **Cost:** $3-5/month for low usage, scales with demand
- **Scaling:** Automatic - AWS handles it
- **Management:** Zero - AWS manages everything
- **Downtime:** 99.99% uptime guaranteed by AWS

---

## Security Features

✅ **Cognito Authentication** - Industry-standard user management  
✅ **JWT Tokens** - Secure API access  
✅ **API Gateway Rate Limiting** - Prevents DDoS attacks  
✅ **DynamoDB Encryption** - Data encrypted at rest  
✅ **CloudFront HTTPS** - All traffic encrypted in transit  
✅ **IAM Roles** - Least-privilege access for Lambda functions  
✅ **CloudWatch Logging** - Audit trail for compliance

---

## Deployment Process

### One-Time Setup (15 minutes)
```bash
# Install AWS SAM CLI
brew install aws-sam-cli

# Configure AWS credentials
aws configure

# Deploy infrastructure
cd aws-serverless
sam build
sam deploy --guided
```

### Ongoing Deployments (2 minutes)
```bash
# Update code
cd aws-serverless
sam build
sam deploy
```

---

## What Gets Created When You Deploy

1. **5 DynamoDB Tables** - Database for all data
2. **10+ Lambda Functions** - Backend API logic
3. **1 API Gateway** - API endpoint (https://xxx.execute-api.us-east-1.amazonaws.com)
4. **1 S3 Bucket** - Frontend hosting
5. **1 CloudFront Distribution** - CDN (https://xxx.cloudfront.net)
6. **1 Cognito User Pool** - User authentication
7. **EventBridge Rules** - Scheduled automation
8. **CloudWatch Log Groups** - Monitoring

**Total deployment time:** 10-15 minutes  
**Total resources created:** ~25 AWS resources

---

## Advantages for Your Use Case

### 1. **Cost Efficiency**
- Only pay for what you use
- No idle server costs
- Free tier covers development/testing

### 2. **Automatic Scaling**
- Handles 1 user or 10,000 users automatically
- No capacity planning needed
- No performance degradation under load

### 3. **High Availability**
- 99.99% uptime SLA
- Multi-region redundancy
- Automatic failover

### 4. **Security & Compliance**
- AWS handles infrastructure security
- SOC 2, FedRAMP, NIST 800-53 compliant
- Automatic security patches

### 5. **Developer Productivity**
- No server management
- Focus on code, not infrastructure
- Fast deployment (2 minutes)

---

## Migration from Current Setup

### What Stays the Same
✅ All frontend code (HTML, JavaScript, CSS)  
✅ CSV processing logic  
✅ Vulnerability analysis engine  
✅ UI/UX - no changes visible to users

### What Changes
🔄 Data storage: IndexedDB → DynamoDB  
🔄 API calls: Direct IndexedDB → Lambda functions via API Gateway  
🔄 Authentication: Browser-only → Cognito  
🔄 Hosting: Local server → S3 + CloudFront

### Migration Steps
1. Deploy AWS infrastructure (10 minutes)
2. Upload frontend to S3 (2 minutes)
3. Update API endpoint in frontend config (1 line of code)
4. Test with staging environment
5. Switch DNS to CloudFront distribution
6. Done!

---

## Monitoring & Troubleshooting

### CloudWatch Dashboards Show:
- API request count and latency
- Lambda function errors
- DynamoDB read/write capacity
- User authentication attempts
- Cost tracking

### Alerts Configured:
- Email if error rate > 5%
- Email if API latency > 1 second
- Email if Lambda function fails
- Daily cost summary

---

## Questions for Your Team

1. **AWS Account:** Do you have an existing AWS account, or do we need to create one?
2. **Region:** Which AWS region? (us-east-1 recommended for lowest cost)
3. **Domain Name:** Do you want a custom domain (poam.yourcompany.com) or use CloudFront URL?
4. **Budget:** Confirm $50-100/month budget for production usage?
5. **Timeline:** When do you need this deployed? (Can be done in 1 day)

---

## Next Steps

1. ✅ Infrastructure code created (`aws-serverless/template.yaml`)
2. ✅ Lambda functions written
3. ⏳ Deploy to AWS (waiting for your approval)
4. ⏳ Upload frontend to S3
5. ⏳ Configure Cognito user pool
6. ⏳ Test end-to-end
7. ⏳ Go live!

---

## Files Created

- `aws-serverless/template.yaml` - Infrastructure as Code (CloudFormation)
- `aws-serverless/lambda/auth/login.js` - Login Lambda function
- `aws-serverless/lambda/poams/get.js` - Get POAMs Lambda function
- More Lambda functions for all API endpoints
- Deployment scripts

**Everything is ready to deploy. Just need your AWS credentials and approval to proceed.**
