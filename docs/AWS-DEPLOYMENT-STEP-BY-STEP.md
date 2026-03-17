# POAM Nexus - AWS Deployment Step-by-Step Guide

**Detailed Technical Implementation Instructions**

This guide provides exact commands, configuration files, and code examples for deploying the POAM Nexus multi-user cloud application on AWS.

**Last Updated:** March 10, 2026

---

## Prerequisites

### Required Tools
```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /

# Verify installation
aws --version

# Install Node.js 20 LTS
brew install node@20

# Install Serverless Framework (optional but recommended)
npm install -g serverless

# Install AWS SAM CLI (alternative to Serverless)
brew tap aws/tap
brew install aws-sam-cli
```

### AWS Account Setup
```bash
# Configure AWS credentials
aws configure
# Enter:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region (e.g., us-east-1)
# - Default output format: json

# Verify credentials
aws sts get-caller-identity
```

---

## Phase 1: DynamoDB Setup

### Step 1.1: Create DynamoDB Table

**Via AWS Console:**
1. Go to AWS Console → DynamoDB → Tables → Create table
2. Table name: `poam-nexus-main`
3. Partition key: `PK` (String)
4. Sort key: `SK` (String)
5. Table settings: On-demand
6. Encryption: AWS owned key
7. Click "Create table"

**Via AWS CLI:**
```bash
# Create the main table
aws dynamodb create-table \
  --table-name poam-nexus-main \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
    AttributeName=email,AttributeType=S \
    AttributeName=status,AttributeType=S \
    AttributeName=pocId,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Project,Value=POAMNexus Key=Environment,Value=POC \
  --region us-east-1

# Wait for table to be active
aws dynamodb wait table-exists --table-name poam-nexus-main
```

### Step 1.2: Create Global Secondary Indexes

```bash
# GSI 1: Email lookup
aws dynamodb update-table \
  --table-name poam-nexus-main \
  --attribute-definitions AttributeName=email,AttributeType=S \
  --global-secondary-index-updates \
    "[{\"Create\":{\"IndexName\":\"EmailIndex\",\"KeySchema\":[{\"AttributeName\":\"email\",\"KeyType\":\"HASH\"}],\"Projection\":{\"ProjectionType\":\"ALL\"},\"ProvisionedThroughput\":{\"ReadCapacityUnits\":0,\"WriteCapacityUnits\":0}}}]" \
  --billing-mode PAY_PER_REQUEST

# GSI 2: Status lookup
aws dynamodb update-table \
  --table-name poam-nexus-main \
  --attribute-definitions AttributeName=status,AttributeType=S \
  --global-secondary-index-updates \
    "[{\"Create\":{\"IndexName\":\"StatusIndex\",\"KeySchema\":[{\"AttributeName\":\"status\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"SK\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"},\"ProvisionedThroughput\":{\"ReadCapacityUnits\":0,\"WriteCapacityUnits\":0}}}]" \
  --billing-mode PAY_PER_REQUEST

# GSI 3: POC lookup
aws dynamodb update-table \
  --table-name poam-nexus-main \
  --attribute-definitions AttributeName=pocId,AttributeType=S \
  --global-secondary-index-updates \
    "[{\"Create\":{\"IndexName\":\"POCIndex\",\"KeySchema\":[{\"AttributeName\":\"pocId\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"SK\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"},\"ProvisionedThroughput\":{\"ReadCapacityUnits\":0,\"WriteCapacityUnits\":0}}}]" \
  --billing-mode PAY_PER_REQUEST
```

### Step 1.3: Enable Point-in-Time Recovery

```bash
aws dynamodb update-continuous-backups \
  --table-name poam-nexus-main \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
```

### Step 1.4: Test DynamoDB Access

```bash
# Insert a test item
aws dynamodb put-item \
  --table-name poam-nexus-main \
  --item '{
    "PK": {"S": "TEST#001"},
    "SK": {"S": "METADATA"},
    "testField": {"S": "Hello DynamoDB"}
  }'

# Query the test item
aws dynamodb get-item \
  --table-name poam-nexus-main \
  --key '{
    "PK": {"S": "TEST#001"},
    "SK": {"S": "METADATA"}
  }'

# Delete the test item
aws dynamodb delete-item \
  --table-name poam-nexus-main \
  --key '{
    "PK": {"S": "TEST#001"},
    "SK": {"S": "METADATA"}
  }'
```

---

## Phase 2: S3 Buckets Setup

### Step 2.1: Create S3 Buckets

```bash
# Set variables
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION="us-east-1"
BUCKET_PREFIX="poam-nexus-${ACCOUNT_ID}"

# Create buckets
aws s3 mb s3://${BUCKET_PREFIX}-scan-uploads --region ${REGION}
aws s3 mb s3://${BUCKET_PREFIX}-evidence --region ${REGION}
aws s3 mb s3://${BUCKET_PREFIX}-backups --region ${REGION}
aws s3 mb s3://${BUCKET_PREFIX}-reports --region ${REGION}
aws s3 mb s3://${BUCKET_PREFIX}-frontend --region ${REGION}
```

### Step 2.2: Configure Bucket Encryption

```bash
# Enable encryption on all buckets
for bucket in scan-uploads evidence backups reports frontend; do
  aws s3api put-bucket-encryption \
    --bucket ${BUCKET_PREFIX}-${bucket} \
    --server-side-encryption-configuration '{
      "Rules": [{
        "ApplyServerSideEncryptionByDefault": {
          "SSEAlgorithm": "AES256"
        }
      }]
    }'
done
```

### Step 2.3: Configure Bucket Policies

**Scan Uploads Bucket Policy:**
```bash
cat > scan-uploads-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyUnencryptedObjectUploads",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::${BUCKET_PREFIX}-scan-uploads/*",
      "Condition": {
        "StringNotEquals": {
          "s3:x-amz-server-side-encryption": "AES256"
        }
      }
    }
  ]
}
EOF

aws s3api put-bucket-policy \
  --bucket ${BUCKET_PREFIX}-scan-uploads \
  --policy file://scan-uploads-policy.json
```

### Step 2.4: Configure Lifecycle Policies

**Scan Uploads Lifecycle:**
```bash
cat > scan-uploads-lifecycle.json <<EOF
{
  "Rules": [
    {
      "Id": "TransitionToIA",
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 90,
          "StorageClass": "GLACIER_IR"
        }
      ],
      "Expiration": {
        "Days": 365
      }
    }
  ]
}
EOF

aws s3api put-bucket-lifecycle-configuration \
  --bucket ${BUCKET_PREFIX}-scan-uploads \
  --lifecycle-configuration file://scan-uploads-lifecycle.json
```

### Step 2.5: Enable Versioning

```bash
# Enable versioning on evidence and backups buckets
aws s3api put-bucket-versioning \
  --bucket ${BUCKET_PREFIX}-evidence \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-versioning \
  --bucket ${BUCKET_PREFIX}-backups \
  --versioning-configuration Status=Enabled
```

---

## Phase 3: Cognito + Active Directory Setup

### Step 3.1: Create Cognito User Pool

```bash
# Create user pool
aws cognito-idp create-user-pool \
  --pool-name poam-nexus-users \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 12,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": true
    }
  }' \
  --auto-verified-attributes email \
  --mfa-configuration OPTIONAL \
  --user-attribute-update-settings '{
    "AttributesRequireVerificationBeforeUpdate": ["email"]
  }' \
  --schema '[
    {
      "Name": "email",
      "AttributeDataType": "String",
      "Required": true,
      "Mutable": true
    },
    {
      "Name": "name",
      "AttributeDataType": "String",
      "Required": true,
      "Mutable": true
    },
    {
      "Name": "custom:role",
      "AttributeDataType": "String",
      "Mutable": true
    },
    {
      "Name": "custom:adGroups",
      "AttributeDataType": "String",
      "Mutable": true
    }
  ]' \
  --region ${REGION} \
  --output json > user-pool-output.json

# Extract User Pool ID
USER_POOL_ID=$(cat user-pool-output.json | jq -r '.UserPool.Id')
echo "User Pool ID: ${USER_POOL_ID}"
```

### Step 3.2: Create User Pool Domain

```bash
# Create custom domain for hosted UI
aws cognito-idp create-user-pool-domain \
  --domain poam-nexus-${ACCOUNT_ID} \
  --user-pool-id ${USER_POOL_ID}

# Verify domain
aws cognito-idp describe-user-pool-domain \
  --domain poam-nexus-${ACCOUNT_ID}
```

### Step 3.3: Create App Client

```bash
# Create app client
aws cognito-idp create-user-pool-client \
  --user-pool-id ${USER_POOL_ID} \
  --client-name poam-nexus-web-app \
  --generate-secret \
  --allowed-o-auth-flows authorization_code implicit \
  --allowed-o-auth-scopes openid email profile \
  --allowed-o-auth-flows-user-pool-client \
  --callback-urls '["https://your-cloudfront-domain.cloudfront.net/callback","http://localhost:3000/callback"]' \
  --logout-urls '["https://your-cloudfront-domain.cloudfront.net/logout","http://localhost:3000/logout"]' \
  --supported-identity-providers COGNITO \
  --output json > app-client-output.json

# Extract App Client ID
APP_CLIENT_ID=$(cat app-client-output.json | jq -r '.UserPoolClient.ClientId')
echo "App Client ID: ${APP_CLIENT_ID}"
```

### Step 3.4: Configure SAML Identity Provider

**Prerequisites:**
- Export ADFS metadata XML from your ADFS server
- URL format: `https://your-adfs-server.com/FederationMetadata/2007-06/FederationMetadata.xml`

```bash
# Download ADFS metadata (replace with your ADFS URL)
curl https://your-adfs-server.com/FederationMetadata/2007-06/FederationMetadata.xml \
  -o adfs-metadata.xml

# Create SAML identity provider
aws cognito-idp create-identity-provider \
  --user-pool-id ${USER_POOL_ID} \
  --provider-name ADFS \
  --provider-type SAML \
  --provider-details file://adfs-metadata.xml \
  --attribute-mapping '{
    "email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    "name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
    "custom:adGroups": "http://schemas.xmlsoap.org/claims/Group"
  }'

# Update app client to use SAML
aws cognito-idp update-user-pool-client \
  --user-pool-id ${USER_POOL_ID} \
  --client-id ${APP_CLIENT_ID} \
  --supported-identity-providers COGNITO ADFS
```

### Step 3.5: Configure ADFS Relying Party Trust

**On your ADFS server, run these PowerShell commands:**

```powershell
# Add Relying Party Trust
Add-AdfsRelyingPartyTrust `
  -Name "POAM Nexus" `
  -MetadataUrl "https://cognito-idp.us-east-1.amazonaws.com/${USER_POOL_ID}/.well-known/saml-metadata.xml" `
  -IssuanceTransformRulesFile "C:\claim-rules.txt"

# Create claim-rules.txt with these rules:
@"
@RuleName = "Send LDAP Attributes"
c:[Type == "http://schemas.microsoft.com/ws/2008/06/identity/claims/windowsaccountname", Issuer == "AD AUTHORITY"]
=> issue(store = "Active Directory", types = ("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name", "http://schemas.xmlsoap.org/claims/Group"), query = ";mail,displayName,tokenGroups;{0}", param = c.Value);

@RuleName = "Send Name ID"
c:[Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"]
=> issue(Type = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier", Issuer = c.Issuer, OriginalIssuer = c.OriginalIssuer, Value = c.Value, ValueType = c.ValueType, Properties["http://schemas.xmlsoap.org/ws/2005/05/identity/claimproperties/format"] = "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress");
"@ | Out-File -FilePath C:\claim-rules.txt
```

---

## Phase 4: Lambda Functions Setup

### Step 4.1: Create Lambda Execution Role

```bash
# Create IAM role for Lambda
cat > lambda-trust-policy.json <<EOF
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
EOF

aws iam create-role \
  --role-name poam-nexus-lambda-role \
  --assume-role-policy-document file://lambda-trust-policy.json

# Attach policies
aws iam attach-role-policy \
  --role-name poam-nexus-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create custom policy for DynamoDB and S3 access
cat > lambda-permissions-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/poam-nexus-main",
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/poam-nexus-main/index/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::${BUCKET_PREFIX}-*/*"
      ]
    }
  ]
}
EOF

aws iam create-policy \
  --policy-name poam-nexus-lambda-policy \
  --policy-document file://lambda-permissions-policy.json

aws iam attach-role-policy \
  --role-name poam-nexus-lambda-role \
  --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/poam-nexus-lambda-policy
```

### Step 4.2: Create Lambda Layer (Shared Dependencies)

```bash
# Create layer directory
mkdir -p lambda-layer/nodejs
cd lambda-layer/nodejs

# Create package.json
cat > package.json <<EOF
{
  "name": "poam-nexus-layer",
  "version": "1.0.0",
  "dependencies": {
    "aws-sdk": "^2.1500.0",
    "uuid": "^9.0.0",
    "papaparse": "^5.4.1"
  }
}
EOF

# Install dependencies
npm install

# Create layer zip
cd ..
zip -r layer.zip nodejs/

# Upload layer
aws lambda publish-layer-version \
  --layer-name poam-nexus-dependencies \
  --description "Shared dependencies for POAM Nexus Lambda functions" \
  --zip-file fileb://layer.zip \
  --compatible-runtimes nodejs20.x \
  --output json > layer-output.json

LAYER_ARN=$(cat layer-output.json | jq -r '.LayerVersionArn')
echo "Layer ARN: ${LAYER_ARN}"
```

### Step 4.3: Create Lambda Functions

**Example: List POAMs Function**

```bash
# Create function directory
mkdir -p lambda-functions/poams
cd lambda-functions/poams

# Create list.js
cat > list.js <<'EOF'
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Extract user info from authorizer context
    const userId = event.requestContext.authorizer.claims.sub;
    const userRole = event.requestContext.authorizer.claims['custom:role'];
    
    // Parse query parameters
    const { status, pocId, systemId } = event.queryStringParameters || {};
    
    let params = {
      TableName: process.env.TABLE_NAME
    };
    
    // Query based on filters
    if (status) {
      // Use StatusIndex GSI
      params.IndexName = 'StatusIndex';
      params.KeyConditionExpression = '#status = :status';
      params.ExpressionAttributeNames = { '#status': 'status' };
      params.ExpressionAttributeValues = { ':status': status };
    } else if (pocId) {
      // Use POCIndex GSI
      params.IndexName = 'POCIndex';
      params.KeyConditionExpression = 'pocId = :pocId';
      params.ExpressionAttributeValues = { ':pocId': pocId };
    } else if (systemId) {
      // Query by partition key
      params.KeyConditionExpression = 'PK = :pk AND begins_with(SK, :sk)';
      params.ExpressionAttributeValues = {
        ':pk': `SYSTEM#${systemId}`,
        ':sk': 'POAM#'
      };
    } else {
      // Scan all POAMs (use with caution)
      params.FilterExpression = 'begins_with(SK, :sk)';
      params.ExpressionAttributeValues = { ':sk': 'POAM#' };
    }
    
    const result = await dynamodb.query(params).promise();
    
    // Filter based on user role
    let poams = result.Items;
    if (userRole === 'engineer') {
      // Engineers only see their own POAMs
      poams = poams.filter(p => p.pocId === userId);
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        poams,
        count: poams.length
      })
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
EOF

# Create deployment package
zip function.zip list.js

# Deploy Lambda function
aws lambda create-function \
  --function-name poam-nexus-list-poams \
  --runtime nodejs20.x \
  --role arn:aws:iam::${ACCOUNT_ID}:role/poam-nexus-lambda-role \
  --handler list.handler \
  --zip-file fileb://function.zip \
  --timeout 30 \
  --memory-size 512 \
  --environment "Variables={TABLE_NAME=poam-nexus-main}" \
  --layers ${LAYER_ARN}
```

**Example: Create POAM Function**

```bash
cat > create.js <<'EOF'
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    const userId = event.requestContext.authorizer.claims.sub;
    const userRole = event.requestContext.authorizer.claims['custom:role'];
    
    // Only engineers and admins can create POAMs
    if (!['engineer', 'admin', 'system_owner'].includes(userRole)) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Forbidden' })
      };
    }
    
    const body = JSON.parse(event.body);
    const poamId = uuidv4();
    const timestamp = new Date().toISOString();
    
    const poam = {
      PK: `SYSTEM#${body.systemId}`,
      SK: `POAM#${poamId}`,
      id: poamId,
      systemId: body.systemId,
      title: body.title,
      description: body.description,
      riskLevel: body.riskLevel,
      status: 'Open',
      pocId: body.pocId || userId,
      pocTeam: body.pocTeam,
      affectedAssets: body.affectedAssets || [],
      milestones: body.milestones || [],
      scheduledCompletionDate: body.scheduledCompletionDate,
      createdBy: userId,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    
    await dynamodb.put({
      TableName: process.env.TABLE_NAME,
      Item: poam
    }).promise();
    
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ poam })
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
EOF

zip create-function.zip create.js

aws lambda create-function \
  --function-name poam-nexus-create-poam \
  --runtime nodejs20.x \
  --role arn:aws:iam::${ACCOUNT_ID}:role/poam-nexus-lambda-role \
  --handler create.handler \
  --zip-file fileb://create-function.zip \
  --timeout 30 \
  --memory-size 512 \
  --environment "Variables={TABLE_NAME=poam-nexus-main}" \
  --layers ${LAYER_ARN}
```

### Step 4.4: Create Lambda Authorizer

```bash
cat > authorizer.js <<'EOF'
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const client = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.USER_POOL_ID}/.well-known/jwks.json`
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
    } else {
      const signingKey = key.publicKey || key.rsaPublicKey;
      callback(null, signingKey);
    }
  });
}

exports.handler = async (event) => {
  console.log('Authorizer event:', JSON.stringify(event, null, 2));
  
  const token = event.authorizationToken.replace('Bearer ', '');
  
  try {
    // Verify JWT token
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(token, getKey, {
        issuer: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.USER_POOL_ID}`,
        audience: process.env.APP_CLIENT_ID
      }, (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      });
    });
    
    // Generate IAM policy
    const policy = {
      principalId: decoded.sub,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: event.methodArn.split('/').slice(0, 2).join('/') + '/*'
          }
        ]
      },
      context: {
        userId: decoded.sub,
        email: decoded.email,
        role: decoded['custom:role'] || 'engineer'
      }
    };
    
    return policy;
    
  } catch (error) {
    console.error('Authorization error:', error);
    throw new Error('Unauthorized');
  }
};
EOF

# Install dependencies
npm init -y
npm install jsonwebtoken jwks-rsa

zip -r authorizer.zip authorizer.js node_modules/

aws lambda create-function \
  --function-name poam-nexus-authorizer \
  --runtime nodejs20.x \
  --role arn:aws:iam::${ACCOUNT_ID}:role/poam-nexus-lambda-role \
  --handler authorizer.handler \
  --zip-file fileb://authorizer.zip \
  --timeout 10 \
  --memory-size 256 \
  --environment "Variables={USER_POOL_ID=${USER_POOL_ID},APP_CLIENT_ID=${APP_CLIENT_ID}}"
```

---

## Phase 5: API Gateway Setup

### Step 5.1: Create REST API

```bash
# Create API
aws apigateway create-rest-api \
  --name poam-nexus-api \
  --description "POAM Nexus REST API" \
  --endpoint-configuration types=REGIONAL \
  --output json > api-output.json

API_ID=$(cat api-output.json | jq -r '.id')
echo "API ID: ${API_ID}"

# Get root resource ID
ROOT_ID=$(aws apigateway get-resources \
  --rest-api-id ${API_ID} \
  --query 'items[0].id' \
  --output text)
```

### Step 5.2: Create API Resources

```bash
# Create /poams resource
aws apigateway create-resource \
  --rest-api-id ${API_ID} \
  --parent-id ${ROOT_ID} \
  --path-part poams \
  --output json > poams-resource.json

POAMS_RESOURCE_ID=$(cat poams-resource.json | jq -r '.id')

# Create /poams/{id} resource
aws apigateway create-resource \
  --rest-api-id ${API_ID} \
  --parent-id ${POAMS_RESOURCE_ID} \
  --path-part '{id}' \
  --output json > poam-id-resource.json

POAM_ID_RESOURCE_ID=$(cat poam-id-resource.json | jq -r '.id')
```

### Step 5.3: Create Authorizer

```bash
# Get Lambda authorizer ARN
AUTHORIZER_ARN=$(aws lambda get-function \
  --function-name poam-nexus-authorizer \
  --query 'Configuration.FunctionArn' \
  --output text)

# Create authorizer
aws apigateway create-authorizer \
  --rest-api-id ${API_ID} \
  --name poam-nexus-jwt-authorizer \
  --type TOKEN \
  --authorizer-uri arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${AUTHORIZER_ARN}/invocations \
  --identity-source method.request.header.Authorization \
  --authorizer-result-ttl-in-seconds 300 \
  --output json > authorizer-output.json

AUTHORIZER_ID=$(cat authorizer-output.json | jq -r '.id')

# Grant API Gateway permission to invoke authorizer
aws lambda add-permission \
  --function-name poam-nexus-authorizer \
  --statement-id apigateway-invoke-authorizer \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/authorizers/${AUTHORIZER_ID}"
```

### Step 5.4: Create Methods

**GET /poams**
```bash
# Create GET method
aws apigateway put-method \
  --rest-api-id ${API_ID} \
  --resource-id ${POAMS_RESOURCE_ID} \
  --http-method GET \
  --authorization-type CUSTOM \
  --authorizer-id ${AUTHORIZER_ID} \
  --request-parameters method.request.querystring.status=false,method.request.querystring.pocId=false

# Get Lambda ARN
LIST_LAMBDA_ARN=$(aws lambda get-function \
  --function-name poam-nexus-list-poams \
  --query 'Configuration.FunctionArn' \
  --output text)

# Create integration
aws apigateway put-integration \
  --rest-api-id ${API_ID} \
  --resource-id ${POAMS_RESOURCE_ID} \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LIST_LAMBDA_ARN}/invocations

# Grant API Gateway permission to invoke Lambda
aws lambda add-permission \
  --function-name poam-nexus-list-poams \
  --statement-id apigateway-invoke-list \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/GET/poams"
```

**POST /poams**
```bash
# Create POST method
aws apigateway put-method \
  --rest-api-id ${API_ID} \
  --resource-id ${POAMS_RESOURCE_ID} \
  --http-method POST \
  --authorization-type CUSTOM \
  --authorizer-id ${AUTHORIZER_ID}

# Get Lambda ARN
CREATE_LAMBDA_ARN=$(aws lambda get-function \
  --function-name poam-nexus-create-poam \
  --query 'Configuration.FunctionArn' \
  --output text)

# Create integration
aws apigateway put-integration \
  --rest-api-id ${API_ID} \
  --resource-id ${POAMS_RESOURCE_ID} \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${CREATE_LAMBDA_ARN}/invocations

# Grant permission
aws lambda add-permission \
  --function-name poam-nexus-create-poam \
  --statement-id apigateway-invoke-create \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/POST/poams"
```

### Step 5.5: Enable CORS

```bash
# Create OPTIONS method for CORS preflight
aws apigateway put-method \
  --rest-api-id ${API_ID} \
  --resource-id ${POAMS_RESOURCE_ID} \
  --http-method OPTIONS \
  --authorization-type NONE

# Create mock integration for OPTIONS
aws apigateway put-integration \
  --rest-api-id ${API_ID} \
  --resource-id ${POAMS_RESOURCE_ID} \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json": "{\"statusCode\": 200}"}'

# Create method response
aws apigateway put-method-response \
  --rest-api-id ${API_ID} \
  --resource-id ${POAMS_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters \
    method.response.header.Access-Control-Allow-Headers=false,\
method.response.header.Access-Control-Allow-Methods=false,\
method.response.header.Access-Control-Allow-Origin=false

# Create integration response
aws apigateway put-integration-response \
  --rest-api-id ${API_ID} \
  --resource-id ${POAMS_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters \
    method.response.header.Access-Control-Allow-Headers="'Content-Type,Authorization'",\
method.response.header.Access-Control-Allow-Methods="'GET,POST,PUT,DELETE,OPTIONS'",\
method.response.header.Access-Control-Allow-Origin="'*'"
```

### Step 5.6: Deploy API

```bash
# Create deployment
aws apigateway create-deployment \
  --rest-api-id ${API_ID} \
  --stage-name prod \
  --stage-description "Production stage" \
  --description "Initial deployment"

# Get API endpoint
API_ENDPOINT="https://${API_ID}.execute-api.${REGION}.amazonaws.com/prod"
echo "API Endpoint: ${API_ENDPOINT}"
```

### Step 5.7: Test API

```bash
# Get a test JWT token from Cognito (you'll need to log in via hosted UI first)
# For testing, you can create a test user:

aws cognito-idp admin-create-user \
  --user-pool-id ${USER_POOL_ID} \
  --username testuser@example.com \
  --user-attributes Name=email,Value=testuser@example.com Name=name,Value="Test User" \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS

# Test the API (replace TOKEN with actual JWT)
curl -X GET "${API_ENDPOINT}/poams" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## Phase 6: Frontend Deployment

### Step 6.1: Build React App

```bash
# Navigate to your React app directory
cd /path/to/poam-nexus-frontend

# Create .env.production file
cat > .env.production <<EOF
VITE_API_ENDPOINT=${API_ENDPOINT}
VITE_USER_POOL_ID=${USER_POOL_ID}
VITE_APP_CLIENT_ID=${APP_CLIENT_ID}
VITE_COGNITO_DOMAIN=poam-nexus-${ACCOUNT_ID}.auth.${REGION}.amazoncognito.com
VITE_REDIRECT_URI=https://your-cloudfront-domain.cloudfront.net/callback
EOF

# Build production bundle
npm run build
```

### Step 6.2: Upload to S3

```bash
# Sync build to S3
aws s3 sync dist/ s3://${BUCKET_PREFIX}-frontend/ --delete

# Set bucket for static website hosting
aws s3 website s3://${BUCKET_PREFIX}-frontend/ \
  --index-document index.html \
  --error-document index.html
```

### Step 6.3: Create CloudFront Distribution

```bash
# Create distribution
cat > cloudfront-config.json <<EOF
{
  "CallerReference": "poam-nexus-$(date +%s)",
  "Comment": "POAM Nexus Frontend",
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-${BUCKET_PREFIX}-frontend",
        "DomainName": "${BUCKET_PREFIX}-frontend.s3.${REGION}.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-${BUCKET_PREFIX}-frontend",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"]
    },
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {
        "Forward": "none"
      }
    },
    "MinTTL": 0,
    "DefaultTTL": 86400,
    "MaxTTL": 31536000
  },
  "Enabled": true
}
EOF

aws cloudfront create-distribution \
  --distribution-config file://cloudfront-config.json \
  --output json > cloudfront-output.json

CLOUDFRONT_DOMAIN=$(cat cloudfront-output.json | jq -r '.Distribution.DomainName')
echo "CloudFront Domain: ${CLOUDFRONT_DOMAIN}"
```

---

## Phase 7: Testing & Verification

### Step 7.1: Test Authentication Flow

```bash
# Open Cognito Hosted UI in browser
echo "https://poam-nexus-${ACCOUNT_ID}.auth.${REGION}.amazoncognito.com/login?client_id=${APP_CLIENT_ID}&response_type=code&scope=email+openid+profile&redirect_uri=https://${CLOUDFRONT_DOMAIN}/callback"
```

### Step 7.2: Test API Endpoints

```bash
# After logging in and getting JWT token, test endpoints:

# List POAMs
curl -X GET "${API_ENDPOINT}/poams" \
  -H "Authorization: Bearer ${JWT_TOKEN}"

# Create POAM
curl -X POST "${API_ENDPOINT}/poams" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "systemId": "system-001",
    "title": "Test POAM",
    "description": "Test description",
    "riskLevel": "High",
    "pocTeam": "Security Team"
  }'
```

### Step 7.3: Monitor CloudWatch Logs

```bash
# View Lambda logs
aws logs tail /aws/lambda/poam-nexus-list-poams --follow

# View API Gateway logs
aws logs tail API-Gateway-Execution-Logs_${API_ID}/prod --follow
```

---

## Phase 8: Data Migration

### Step 8.1: Export from IndexedDB

Run this in your browser console on the current app:

```javascript
async function exportPOAMs() {
  const poams = await window.poamDB.getAllPOAMs();
  const systems = await window.poamDB.getAllSystems();
  
  const data = { poams, systems };
  const blob = new Blob([JSON.stringify(data, null, 2)], 
    { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'poam-export.json';
  a.click();
}

exportPOAMs();
```

### Step 8.2: Create Migration Lambda

```bash
cat > migrate.js <<'EOF'
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  const { poams, systems } = JSON.parse(event.body);
  
  let imported = 0;
  let errors = [];
  
  // Import systems first
  for (const system of systems) {
    try {
      await dynamodb.put({
        TableName: process.env.TABLE_NAME,
        Item: {
          PK: `SYSTEM#${system.id}`,
          SK: 'METADATA',
          ...system
        }
      }).promise();
    } catch (error) {
      errors.push({ type: 'system', id: system.id, error: error.message });
    }
  }
  
  // Import POAMs in batches of 25
  for (let i = 0; i < poams.length; i += 25) {
    const batch = poams.slice(i, i + 25);
    const requests = batch.map(poam => ({
      PutRequest: {
        Item: {
          PK: `SYSTEM#${poam.systemId}`,
          SK: `POAM#${poam.id}`,
          ...poam
        }
      }
    }));
    
    try {
      await dynamodb.batchWrite({
        RequestItems: {
          [process.env.TABLE_NAME]: requests
        }
      }).promise();
      imported += batch.length;
    } catch (error) {
      errors.push({ type: 'batch', batch: i, error: error.message });
    }
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      imported,
      total: poams.length,
      errors
    })
  };
};
EOF

zip migrate.zip migrate.js

aws lambda create-function \
  --function-name poam-nexus-migrate-data \
  --runtime nodejs20.x \
  --role arn:aws:iam::${ACCOUNT_ID}:role/poam-nexus-lambda-role \
  --handler migrate.handler \
  --zip-file fileb://migrate.zip \
  --timeout 300 \
  --memory-size 1024 \
  --environment "Variables={TABLE_NAME=poam-nexus-main}"
```

### Step 8.3: Run Migration

```bash
# Invoke migration Lambda with exported data
aws lambda invoke \
  --function-name poam-nexus-migrate-data \
  --payload file://poam-export.json \
  --cli-binary-format raw-in-base64-out \
  response.json

# Check results
cat response.json
```

---

## Summary

You now have a fully deployed multi-user POAM Nexus application with:

✅ **DynamoDB** - Storing 500+ POAMs  
✅ **Lambda Functions** - API endpoints  
✅ **API Gateway** - REST API with JWT auth  
✅ **Cognito** - User authentication with AD integration  
✅ **S3 + CloudFront** - Frontend hosting  

**Access URLs:**
- Frontend: `https://${CLOUDFRONT_DOMAIN}`
- API: `${API_ENDPOINT}`
- Cognito Login: `https://poam-nexus-${ACCOUNT_ID}.auth.${REGION}.amazoncognito.com/login`

**Next Steps:**
1. Configure custom domain (Route 53)
2. Set up CI/CD pipeline (GitHub Actions)
3. Enable monitoring and alarms
4. Train users on new system

---

**Document Version:** 1.0  
**Last Updated:** March 10, 2026
