# 🚀 Quick Deploy Script for Mally AI

Write-Host "🤖 Deploying Mally AI to Firebase..." -ForegroundColor Cyan
Write-Host ""

# Check if Firebase CLI is installed
$firebaseInstalled = Get-Command firebase -ErrorAction SilentlyContinue
if (-not $firebaseInstalled) {
    Write-Host "❌ Firebase CLI not found!" -ForegroundColor Red
    Write-Host "Install it with: npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Firebase CLI found" -ForegroundColor Green

# Check if logged in
Write-Host ""
Write-Host "Checking Firebase authentication..." -ForegroundColor Cyan
firebase projects:list 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "🔐 Please login to Firebase..." -ForegroundColor Yellow
    firebase login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Login failed!" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ Authenticated" -ForegroundColor Green

# Set Gemini API Key Secret
Write-Host ""
Write-Host "📝 Configuring Gemini API key..." -ForegroundColor Cyan
Write-Host "Checking if GEMINI_API_KEY secret exists..." -ForegroundColor Gray

$secretExists = firebase functions:secrets:access GEMINI_API_KEY 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  GEMINI_API_KEY secret not found" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please enter your Gemini API key:" -ForegroundColor Cyan
    Write-Host "(Get it from: https://makersuite.google.com/app/apikey)" -ForegroundColor Gray
    $apiKey = Read-Host "API Key"
    
    if ([string]::IsNullOrWhiteSpace($apiKey)) {
        Write-Host "❌ No API key provided!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Setting secret..." -ForegroundColor Gray
    $apiKey | firebase functions:secrets:set GEMINI_API_KEY
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to set secret!" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Secret configured" -ForegroundColor Green
} else {
    Write-Host "✅ GEMINI_API_KEY secret already exists" -ForegroundColor Green
}

# Build functions
Write-Host ""
Write-Host "🔨 Building Firebase Functions..." -ForegroundColor Cyan
Set-Location firebase/functions
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    Set-Location ../..
    exit 1
}
Set-Location ../..
Write-Host "✅ Build successful" -ForegroundColor Green

# Deploy functions
Write-Host ""
Write-Host "🚀 Deploying to Firebase..." -ForegroundColor Cyan
firebase deploy --only functions

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "🎉 Deployment successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "✅ Mally AI is now live with full intelligence!" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Test it with these commands:" -ForegroundColor Gray
    Write-Host "  • 'Schedule a meeting tomorrow at 2pm'" -ForegroundColor White
    Write-Host "  • 'Add buy groceries to my todos'" -ForegroundColor White
    Write-Host "  • 'Set an alarm for 8am every weekday'" -ForegroundColor White
    Write-Host ""
    Write-Host "Monitor your usage at: https://aistudio.google.com/" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host "Check the error messages above for details." -ForegroundColor Yellow
    exit 1
}
