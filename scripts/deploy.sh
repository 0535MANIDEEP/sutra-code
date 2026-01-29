#!/bin/bash

# Sutra-Code Infrastructure Deployment Script
# This script deploys the AWS CDK infrastructure for the Sutra-Code Socratic AI Mentor system

set -e

echo "🚀 Starting Sutra-Code Infrastructure Deployment..."
echo "📍 Target Region: ap-south-1 (Mumbai) for DPDP Act 2023 compliance"
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI is not configured or credentials are invalid"
    echo "Please run 'aws configure' to set up your credentials"
    exit 1
fi

# Get AWS account ID and region
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION="ap-south-1"

echo "🔍 AWS Account: $ACCOUNT_ID"
echo "🌏 Region: $REGION"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building TypeScript project..."
npm run build

# Run tests
echo "🧪 Running infrastructure tests..."
npm test

# Check if CDK is bootstrapped
echo "🔧 Checking CDK bootstrap status..."
if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region $REGION > /dev/null 2>&1; then
    echo "⚠️  CDK not bootstrapped in $REGION. Bootstrapping now..."
    npx cdk bootstrap aws://$ACCOUNT_ID/$REGION
else
    echo "✅ CDK already bootstrapped in $REGION"
fi

# Synthesize the stack
echo "🏗️  Synthesizing CloudFormation template..."
npx cdk synth

# Deploy the stack
echo "🚀 Deploying Sutra-Code infrastructure..."
echo "⚠️  This will create AWS resources that may incur charges"
read -p "Do you want to continue? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx cdk deploy --require-approval never
    
    echo ""
    echo "🎉 Deployment completed successfully!"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Note down the CloudFormation outputs for use in Lambda functions"
    echo "2. Deploy the Lambda functions for each service component"
    echo "3. Configure Cognito User Pools for authentication"
    echo "4. Set up monitoring and alerting"
    echo ""
    echo "🔐 Security Reminders:"
    echo "- All data is encrypted with customer-managed KMS keys"
    echo "- Data residency is maintained in ap-south-1 for DPDP compliance"
    echo "- API Gateway has rate limiting configured (100 req/min per user)"
    echo ""
    echo "📊 Monitoring:"
    echo "- Check CloudWatch for API Gateway and DynamoDB metrics"
    echo "- Monitor DynamoDB Streams for real-time analytics"
    echo "- Review CloudTrail logs for audit compliance"
    
else
    echo "❌ Deployment cancelled"
    exit 1
fi