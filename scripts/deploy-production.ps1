# Sutra-Code Production Deployment Script
# This script deploys the complete Sutra-Code system to AWS

param(
    [string]$Profile = "default",
    [switch]$SkipTests = $false
)

Write-Host "🚀 Starting Sutra-Code Production Deployment..." -ForegroundColor Green

# Check AWS CLI installation
try {
    aws --version | Out-Null
    Write-Host "✅ AWS CLI found" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS CLI not found. Please install AWS CLI first." -ForegroundColor Red
    exit 1
}

# Check AWS credentials
try {
    aws sts get-caller-identity --profile $Profile | Out-Null
    Write-Host "✅ AWS credentials configured" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS credentials not configured. Run 'aws configure' first." -ForegroundColor Red
    exit 1
}

# Run tests if not skipped
if (-not $SkipTests) {
    Write-Host "🧪 Running tests..." -ForegroundColor Yellow
    npm test
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Tests failed. Deployment aborted." -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ All tests passed" -ForegroundColor Green
}

# Bootstrap CDK (if not already done)
Write-Host "🔧 Bootstrapping CDK..." -ForegroundColor Yellow
npx cdk bootstrap --profile $Profile

# Deploy CDK stack
Write-Host "☁️ Deploying AWS infrastructure..." -ForegroundColor Yellow
npx cdk deploy SutraCodeStack --profile $Profile --require-approval never

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ CDK deployment failed" -ForegroundColor Red
    exit 1
}

# Get stack outputs
Write-Host "📋 Getting stack outputs..." -ForegroundColor Yellow
$stackOutputs = aws cloudformation describe-stacks --stack-name SutraCodeStack --profile $Profile --query "Stacks[0].Outputs" --output json | ConvertFrom-Json

# Extract important values
$apiGatewayUrl = ($stackOutputs | Where-Object { $_.OutputKey -eq "APIGatewayURL" }).OutputValue
$userPoolId = ($stackOutputs | Where-Object { $_.OutputKey -eq "UserPoolId" }).OutputValue
$clientId = ($stackOutputs | Where-Object { $_.OutputKey -eq "UserPoolClientId" }).OutputValue
$identityPoolId = ($stackOutputs | Where-Object { $_.OutputKey -eq "IdentityPoolId" }).OutputValue

Write-Host "🔧 Updating frontend environment variables..." -ForegroundColor Yellow

# Update frontend .env file
$envContent = @"
# Sutra-Code Frontend Environment Variables
# Production configuration - Connect to actual AWS services

# API Configuration
REACT_APP_API_GATEWAY_URL=$apiGatewayUrl
REACT_APP_AWS_REGION=ap-south-1

# AWS Cognito Configuration
REACT_APP_USER_POOL_ID=$userPoolId
REACT_APP_CLIENT_ID=$clientId
REACT_APP_IDENTITY_POOL_ID=$identityPoolId

# WebSocket Configuration (will be updated when WebSocket is implemented)
REACT_APP_WEBSOCKET_URL=wss://YOUR_WEBSOCKET_ID.execute-api.ap-south-1.amazonaws.com/prod

# Feature Flags - PRODUCTION SETTINGS
REACT_APP_DEMO_MODE=false
REACT_APP_ENABLE_VOICE=true
REACT_APP_ENABLE_ANALYTICS=true

# Production
GENERATE_SOURCEMAP=false
"@

$envContent | Out-File -FilePath "frontend/.env" -Encoding UTF8

# Build frontend for production
Write-Host "🏗️ Building frontend for production..." -ForegroundColor Yellow
Set-Location frontend
npm run build
Set-Location ..

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Frontend build failed" -ForegroundColor Red
    exit 1
}

Write-Host "🎉 Production deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Deployment Summary:" -ForegroundColor Cyan
Write-Host "  API Gateway URL: $apiGatewayUrl" -ForegroundColor White
Write-Host "  User Pool ID: $userPoolId" -ForegroundColor White
Write-Host "  Client ID: $clientId" -ForegroundColor White
Write-Host "  Identity Pool ID: $identityPoolId" -ForegroundColor White
Write-Host ""
Write-Host "🌐 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Configure domain name and SSL certificate" -ForegroundColor White
Write-Host "  2. Set up CloudFront distribution for frontend" -ForegroundColor White
Write-Host "  3. Configure WebSocket API Gateway" -ForegroundColor White
Write-Host "  4. Set up monitoring and alerting" -ForegroundColor White
Write-Host "  5. Configure backup and disaster recovery" -ForegroundColor White