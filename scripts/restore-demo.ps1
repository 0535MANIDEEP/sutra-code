# Restore Demo Mode
# This script restores the original demo configuration

Write-Host "🔄 Restoring Sutra-Code Demo Mode..." -ForegroundColor Yellow

# Check if backup exists
if (Test-Path "frontend/.env.backup") {
    # Restore from backup
    Copy-Item "frontend/.env.backup" "frontend/.env" -Force
    Remove-Item "frontend/.env.backup" -Force
    Write-Host "✅ Demo mode restored from backup" -ForegroundColor Green
} else {
    # Create demo .env from scratch
    $demoEnv = @"
# Sutra-Code Frontend Environment Variables
# Demo configuration - AWS services not required for frontend demo

# API Configuration (will fallback to demo mode if not configured)
REACT_APP_API_GATEWAY_URL=https://api.sutra-code.edu.in
REACT_APP_AWS_REGION=ap-south-1

# AWS Cognito Configuration (empty for demo mode)
REACT_APP_USER_POOL_ID=
REACT_APP_CLIENT_ID=
REACT_APP_IDENTITY_POOL_ID=

# WebSocket Configuration (will fallback to demo mode)
REACT_APP_WEBSOCKET_URL=wss://ws.sutra-code.edu.in

# Feature Flags
REACT_APP_DEMO_MODE=true
REACT_APP_ENABLE_VOICE=true
REACT_APP_ENABLE_ANALYTICS=true

# Development
GENERATE_SOURCEMAP=false
"@

    $demoEnv | Out-File -FilePath "frontend/.env" -Encoding UTF8
    Write-Host "✅ Demo mode configuration created" -ForegroundColor Green
}

Write-Host ""
Write-Host "📋 Demo Mode Features:" -ForegroundColor Cyan
Write-Host "  ✅ No AWS credentials required" -ForegroundColor White
Write-Host "  ✅ Simulated authentication" -ForegroundColor White
Write-Host "  ✅ Mock Socratic AI responses" -ForegroundColor White
Write-Host "  ✅ Cultural analogies demonstration" -ForegroundColor White
Write-Host "  ✅ Full UI functionality" -ForegroundColor White
Write-Host ""
Write-Host "🎯 Perfect for hackathon demonstration!" -ForegroundColor Green