#!/bin/bash

# AWS Serverless Deployment Script for POAM Nexus
# Deploys complete serverless infrastructure to AWS

set -e

echo "🚀 POAM Nexus AWS Serverless Deployment"
echo "========================================"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first:"
    echo "   brew install awscli"
    exit 1
fi

# Check if SAM CLI is installed
if ! command -v sam &> /dev/null; then
    echo "❌ AWS SAM CLI is not installed. Please install it first:"
    echo "   brew install aws-sam-cli"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured. Run:"
    echo "   aws configure"
    exit 1
fi

echo "✅ AWS CLI configured"
echo "✅ SAM CLI installed"
echo ""

# Get deployment stage
read -p "Enter deployment stage (dev/staging/prod) [dev]: " STAGE
STAGE=${STAGE:-dev}

echo ""
echo "📦 Building Lambda functions..."
sam build

echo ""
echo "🚀 Deploying to AWS (stage: $STAGE)..."

if [ "$STAGE" = "prod" ]; then
    echo "⚠️  WARNING: Deploying to PRODUCTION"
    read -p "Are you sure? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "Deployment cancelled"
        exit 0
    fi
fi

# Deploy with SAM
sam deploy \
    --stack-name poam-nexus-$STAGE \
    --parameter-overrides Stage=$STAGE \
    --capabilities CAPABILITY_IAM \
    --resolve-s3 \
    --no-fail-on-empty-changeset

echo ""
echo "✅ Deployment complete!"
echo ""

# Get outputs
echo "📊 Stack Outputs:"
aws cloudformation describe-stacks \
    --stack-name poam-nexus-$STAGE \
    --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
    --output table

echo ""
echo "🌐 Next steps:"
echo "1. Upload frontend to S3 bucket (see output above)"
echo "2. Configure frontend with API endpoint"
echo "3. Create Cognito users"
echo "4. Test the application"
echo ""
echo "To upload frontend:"
echo "  aws s3 sync ../POAM-Manager---Nexus- s3://\$(aws cloudformation describe-stacks --stack-name poam-nexus-$STAGE --query 'Stacks[0].Outputs[?OutputKey==\`FrontendBucketName\`].OutputValue' --output text) --exclude 'server/*' --exclude 'aws-serverless/*' --exclude '.git/*'"
