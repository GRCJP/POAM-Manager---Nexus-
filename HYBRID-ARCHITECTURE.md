# Hybrid Architecture: EC2 + Lambda for Daily Usage

## The Smart Approach for Daily-Use Applications

Since your POAM app will be used **daily**, a hybrid approach is more cost-effective than pure serverless:

---

## Recommended Hybrid Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLOUDFRONT (CDN)                          │
│  Serves: Static files (HTML, JS, CSS) from S3               │
└────────────────┬────────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ↓                 ↓
┌──────────────┐   ┌──────────────────────────────────────┐
│   S3 BUCKET  │   │      API GATEWAY                     │
│   (Frontend) │   │  Routes to EC2 or Lambda based on    │
└──────────────┘   │  traffic pattern                     │
                   └────────┬─────────────────────────────┘
                            │
                   ┌────────┴────────┐
                   │                 │
                   ↓                 ↓
        ┌──────────────────┐  ┌─────────────────┐
        │  EC2 INSTANCE    │  │  LAMBDA         │
        │  (t3.small)      │  │  FUNCTIONS      │
        │                  │  │                 │
        │  Handles:        │  │  Handles:       │
        │  • Daily CRUD    │  │  • Burst traffic│
        │  • Reports       │  │  • Scheduled    │
        │  • Dashboards    │  │    tasks        │
        │  • Workbook      │  │  • Automation   │
        │                  │  │                 │
        │  Runs 24/7       │  │  Runs on-demand │
        └────────┬─────────┘  └────────┬────────┘
                 │                     │
                 └──────────┬──────────┘
                            ↓
                   ┌─────────────────┐
                   │   DYNAMODB      │
                   │  (Shared Data)  │
                   └─────────────────┘
```

---

## What Runs Where

### **EC2 Instance (Always On)**
**Use for:** Predictable, consistent daily workload

✅ **User login/authentication** - Used every day  
✅ **POAM CRUD operations** - Daily viewing/editing  
✅ **Dashboard rendering** - Constant access  
✅ **Workbook management** - Regular updates  
✅ **Report generation** - Daily/weekly reports  

**Why EC2 for these:**
- Used consistently throughout the day
- Predictable load
- Lower latency (no cold starts)
- More cost-effective for constant usage

### **Lambda Functions (On-Demand)**
**Use for:** Burst traffic and scheduled tasks

✅ **Bulk imports** - Occasional large CSV uploads  
✅ **Scheduled reports** - Daily 8am automated reports  
✅ **Email notifications** - Triggered by events  
✅ **Data exports** - Occasional XLSX/PDF generation  
✅ **Backup automation** - Nightly backups  
✅ **Spike handling** - If 100 users suddenly log in  

**Why Lambda for these:**
- Infrequent or scheduled
- Burst capacity needed
- Don't want to size EC2 for peak load
- Pay only when they run

---

## Cost Comparison

### Pure Serverless (All Lambda)
**Daily usage (20 users, 10K requests/day):**
- Lambda: $15/month
- API Gateway: $10/month
- DynamoDB: $5/month
- **Total: $30/month**

**Problem:** Lambda cold starts slow down daily users

### Pure EC2 (Traditional)
**Daily usage (20 users):**
- EC2 t3.small: $15/month
- RDS PostgreSQL: $30/month
- Load Balancer: $18/month
- **Total: $63/month**

**Problem:** Overkill for 20 users, but handles burst well

### **Hybrid (EC2 + Lambda) ✅ RECOMMENDED**
**Daily usage (20 users, 10K requests/day):**
- EC2 t3.small: $15/month (handles daily traffic)
- Lambda: $3/month (only for burst/scheduled tasks)
- DynamoDB: $5/month (shared by both)
- API Gateway: $5/month
- S3 + CloudFront: $2/month
- **Total: $30/month**

**Benefits:**
- ✅ Fast response for daily users (no cold starts)
- ✅ Handles burst traffic automatically
- ✅ Lower cost than pure EC2
- ✅ More reliable than pure Lambda

---

## Detailed Cost Breakdown (Hybrid)

| Component | Specification | Monthly Cost | Why |
|-----------|---------------|--------------|-----|
| **EC2 Instance** | t3.small (2 vCPU, 2GB RAM) | $15 | Handles daily API traffic |
| **DynamoDB** | Pay-per-request | $5 | Shared database for both EC2 and Lambda |
| **Lambda** | 50K invocations/month | $3 | Burst traffic + scheduled tasks only |
| **API Gateway** | 300K requests | $5 | Routes to EC2 or Lambda |
| **S3** | 5GB storage | $1 | Frontend hosting |
| **CloudFront** | 10GB transfer | $1 | CDN for fast global access |
| **CloudWatch** | Logs + monitoring | $2 | Monitoring both EC2 and Lambda |
| **Elastic IP** | Static IP for EC2 | $0 | Free when attached to running instance |
| **TOTAL** | | **$32/month** | **Best value for daily usage** |

**At scale (100 users):** ~$50/month (EC2 stays same, Lambda scales)

---

## How Traffic Routing Works

### API Gateway Routes:

```javascript
// API Gateway configuration
{
  "/api/auth/*": "EC2",           // Daily login - use EC2
  "/api/poams": "EC2",             // Daily CRUD - use EC2
  "/api/systems": "EC2",           // Daily access - use EC2
  "/api/workbook": "EC2",          // Daily updates - use EC2
  "/api/reports/generate": "EC2",  // Regular reports - use EC2
  
  "/api/import/bulk": "Lambda",    // Occasional bulk import - use Lambda
  "/api/export/xlsx": "Lambda",    // Occasional export - use Lambda
  "/api/backup": "Lambda",         // Scheduled backup - use Lambda
  "/api/notifications": "Lambda"   // Event-driven - use Lambda
}
```

### Load Balancing:
- **Normal traffic (< 100 req/min):** EC2 handles it
- **Burst traffic (> 100 req/min):** API Gateway routes overflow to Lambda
- **Scheduled tasks:** Lambda only (EC2 doesn't waste cycles)

---

## Architecture Benefits

### 1. **Performance**
- EC2 has no cold starts (always warm)
- Daily users get instant response
- Lambda handles spikes without slowing EC2

### 2. **Cost Efficiency**
- EC2 runs 24/7 but handles most traffic
- Lambda only runs for burst/scheduled tasks
- 40% cheaper than pure EC2
- More reliable than pure Lambda

### 3. **Scalability**
- EC2 handles baseline load
- Lambda auto-scales for bursts
- Can upgrade EC2 to t3.medium if needed ($30/month)

### 4. **Reliability**
- If Lambda has cold starts, EC2 still works
- If EC2 goes down, Lambda takes over
- DynamoDB provides consistent data layer

---

## Deployment Strategy

### Phase 1: Deploy EC2 Backend (Week 1)
```bash
# Use the Express.js server we already built
cd server
docker build -t poam-nexus-api .
# Deploy to EC2 with Docker
```

### Phase 2: Deploy Lambda Functions (Week 2)
```bash
# Deploy Lambda for burst/scheduled tasks
cd aws-serverless
sam deploy
```

### Phase 3: Configure API Gateway (Week 2)
```bash
# Route daily traffic to EC2
# Route burst/scheduled to Lambda
```

### Phase 4: Deploy Frontend to S3 + CloudFront (Week 3)
```bash
# Upload frontend to S3
aws s3 sync . s3://poam-nexus-frontend
# Configure CloudFront
```

---

## Infrastructure as Code (Terraform)

```hcl
# EC2 Instance
resource "aws_instance" "api_server" {
  ami           = "ami-0c55b159cbfafe1f0" # Amazon Linux 2
  instance_type = "t3.small"
  
  user_data = <<-EOF
    #!/bin/bash
    docker run -d -p 3000:3000 \
      -e DATABASE_URL=${aws_dynamodb_table.poams.arn} \
      poam-nexus-api:latest
  EOF
  
  tags = {
    Name = "poam-nexus-api"
  }
}

# Lambda Functions (for burst/scheduled)
resource "aws_lambda_function" "bulk_import" {
  function_name = "poam-bulk-import"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  memory_size   = 1024
  timeout       = 300
  
  environment {
    variables = {
      DYNAMODB_TABLE = aws_dynamodb_table.poams.name
    }
  }
}

# API Gateway with routing
resource "aws_api_gateway_rest_api" "main" {
  name = "poam-nexus-api"
}

# Route /api/poams to EC2
resource "aws_api_gateway_integration" "poams_ec2" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.poams.id
  http_method = "GET"
  
  type                    = "HTTP_PROXY"
  integration_http_method = "GET"
  uri                     = "http://${aws_instance.api_server.private_ip}:3000/api/poams"
}

# Route /api/import/bulk to Lambda
resource "aws_api_gateway_integration" "import_lambda" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.import.id
  http_method = "POST"
  
  type                    = "AWS_PROXY"
  integration_http_method = "POST"
  uri                     = aws_lambda_function.bulk_import.invoke_arn
}
```

---

## Monitoring & Auto-Scaling

### EC2 Auto-Scaling (Optional)
```hcl
resource "aws_autoscaling_group" "api" {
  min_size         = 1
  max_size         = 3
  desired_capacity = 1
  
  # Scale up if CPU > 70% for 5 minutes
  # Scale down if CPU < 30% for 10 minutes
}
```

### Lambda Concurrency
```hcl
resource "aws_lambda_function" "bulk_import" {
  reserved_concurrent_executions = 10
  # Prevents Lambda from consuming all account concurrency
}
```

### CloudWatch Alarms
- Alert if EC2 CPU > 80%
- Alert if Lambda errors > 5%
- Alert if DynamoDB throttling occurs

---

## Migration Path

### Current State
- Browser-only with IndexedDB

### Step 1: Add EC2 Backend (Week 1)
- Deploy Express.js API to EC2
- Keep IndexedDB as fallback
- Test with feature flag

### Step 2: Add Lambda for Burst (Week 2)
- Deploy Lambda functions
- Configure API Gateway routing
- Test bulk imports via Lambda

### Step 3: Move Frontend to S3 (Week 3)
- Upload to S3
- Configure CloudFront
- Update DNS

### Step 4: Migrate Data (Week 4)
- Export from IndexedDB
- Import to DynamoDB
- Verify data integrity
- Switch feature flag

---

## When to Use What

| Task | Use EC2 | Use Lambda | Why |
|------|---------|------------|-----|
| User login | ✅ | | Daily, needs fast response |
| View POAMs | ✅ | | Daily, constant access |
| Edit POAM | ✅ | | Daily, needs low latency |
| Generate report | ✅ | | Regular, predictable |
| Bulk CSV import | | ✅ | Occasional, CPU-intensive |
| Scheduled backup | | ✅ | Nightly, don't waste EC2 |
| Email notifications | | ✅ | Event-driven, unpredictable |
| Export to Excel | | ✅ | Occasional, memory-intensive |

---

## Cost Optimization Tips

### 1. **Use Reserved Instance for EC2**
- 1-year commitment: Save 30% ($15 → $10/month)
- 3-year commitment: Save 60% ($15 → $6/month)

### 2. **Use DynamoDB On-Demand**
- Pay only for reads/writes
- No capacity planning needed
- Auto-scales with traffic

### 3. **Enable CloudFront Caching**
- Cache static files for 1 year
- Reduces S3 requests by 90%
- Saves $5-10/month

### 4. **Use Lambda Provisioned Concurrency Sparingly**
- Only for critical functions
- Costs $0.015/hour per instance
- Most functions can tolerate cold starts

---

## Final Recommendation

**For daily-use POAM app with 20-100 users:**

✅ **Use Hybrid Architecture**
- EC2 t3.small for daily API traffic ($15/month)
- Lambda for burst/scheduled tasks ($3/month)
- DynamoDB for shared data ($5/month)
- S3 + CloudFront for frontend ($2/month)
- **Total: $30-35/month**

**Why this is optimal:**
- Fast response for daily users (no Lambda cold starts)
- Handles burst traffic automatically
- 50% cheaper than pure EC2 with RDS
- More reliable than pure serverless
- Easy to scale (upgrade EC2 or add instances)

**When to switch to pure serverless:**
- If usage drops below 5 users/day
- If traffic is extremely sporadic
- If you want zero server management

**When to switch to pure EC2:**
- If you exceed 500 users/day
- If you need complex database queries (switch to RDS)
- If you need persistent WebSocket connections
