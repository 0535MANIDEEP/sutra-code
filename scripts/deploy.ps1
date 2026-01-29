# Sutra-Code Infrastructure Deployment Script (PowerShell)
# This script deploys the AWS CDK infrastructure for the Sutra-Code Socratic AI Mentor system

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting Sutra-Code Infrastructure Deployment..." -ForegroundColor Green
Write-Host "📍 Target Region: ap-south-1 (Mumbai) for DPDP Act 2023 compliance" -ForegroundColor Yellow
Write-Host ""

# Check if AWS CLI is configured
try {
    $null = aws sts get-caller-identity 2>$null
} catch {
    Write-Host "❌ AWS CLI is not configured or credentials are invalid" -ForegroundColor Red
    Write-Host "Please run 'aws configure' to set up your credentials" -ForegroundColor Yellow
    exit 1
}

# Get AWS account ID and region
$ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
$REGION = "ap-south-1"

Write-Host "🔍 AWS Account: $ACCOUNT_ID" -ForegroundColor Cyan
Write-Host "🌏 Region: $REGION" -ForegroundColor Cyan
Write-Host ""

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install

# Build the project
Write-Host "🔨 Building TypeScript project..." -ForegroundColor Yellow
npm run build

# Run tests
Write-Host "🧪 Running infrastructure tests..." -ForegroundColor Yellow
npm test

# Check if CDK is bootstrapped
Write-Host "🔧 Checking CDK bootstrap status..." -ForegroundColor Yellow
try {
    $null = aws cloudformation describe-stacks --stack-name CDKToolkit --region $REGION 2>$null
    Write-Host "✅ CDK already bootstrapped in $REGION" -ForegroundColor Green
} catch {
    Write-Host "⚠️  CDK not bootstrapped in $REGION. Bootstrapping now..." -ForegroundColor Yellow
    npx cdk bootstrap "aws://$ACCOUNT_ID/$REGION"
}

# Synthesize the stack
Write-Host "🏗️  Synthesizing CloudFormation template..." -ForegroundColor Yellow
npx cdk synth

# Deploy the stack
Write-Host "🚀 Deploying Sutra-Code infrastructure..." -ForegroundColor Green
Write-Host "⚠️  This will create AWS resources that may incur charges" -ForegroundColor Yellow
$confirmation = Read-Host "Do you want to continue? (y/N)"

if ($confirmation -eq 'y' -or $confirmation -eq 'Y') {
    npx cdk deploy --require-approval never
    
    Write-Host ""
    Write-Host "🎉 Deployment completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Note down the CloudFormation outputs for use in Lambda functions"
    Write-Host "2. Deploy the Lambda functions for each service component"
    Write-Host "3. Configure Cognito User Pools for authentication"
    Write-Host "4. Set up monitoring and alerting"
    Write-Host ""
    Write-Host "🔐 Security Reminders:" -ForegroundColor Magenta
    Write-Host "- All data is encrypted with customer-managed KMS keys"
    Write-Host "- Data residency is maintained in ap-south-1 for DPDP compliance"
    Write-Host "- API Gateway has rate limiting configured (100 req/min per user)"
    Write-Host ""
    Write-Host "📊 Monitoring:" -ForegroundColor Blue
    Write-Host "- Check CloudWatch for API Gateway and DynamoDB metrics"
    Write-Host "- Monitor DynamoDB Streams for real-time analytics"
    Write-Host "- Review CloudTrail logs for audit compliance"
    
} else {
    Write-Host "❌ Deployment cancelled" -ForegroundColor Red
    exit 1
}