# Deployment automation script for CryptoOrchestrator
# Handles production deployment with safety checks

param(
    [string]$Environment = "staging",
    [switch]$SkipTests = $false,
    [switch]$SkipBuild = $false,
    [switch]$DryRun = $false
)

Write-Host "=== CryptoOrchestrator Deployment ===" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host "Dry Run: $DryRun" -ForegroundColor Yellow

# Safety checks
if ($Environment -eq "production" -and -not $DryRun) {
    $confirmation = Read-Host "Deploying to PRODUCTION. Type 'DEPLOY' to confirm"
    if ($confirmation -ne "DEPLOY") {
        Write-Host "Deployment cancelled." -ForegroundColor Red
        exit 1
    }
}

# Step 1: Run tests
if (-not $SkipTests) {
    Write-Host "`n[1/6] Running tests..." -ForegroundColor Cyan
    pytest server_fastapi/tests/ -v --cov=server_fastapi --cov-fail-under=80
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Tests failed! Deployment aborted." -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Tests passed" -ForegroundColor Green
} else {
    Write-Host "`n[1/6] Skipping tests" -ForegroundColor Yellow
}

# Step 2: Linting
Write-Host "`n[2/6] Running linters..." -ForegroundColor Cyan
python -m black --check server_fastapi/ || Write-Host "Black formatting issues found" -ForegroundColor Yellow
python -m flake8 server_fastapi/ --max-line-length=120 || Write-Host "Flake8 issues found" -ForegroundColor Yellow

# TypeScript check
npm run check
if ($LASTEXITCODE -ne 0) {
    Write-Host "TypeScript check failed! Deployment aborted." -ForegroundColor Red
    exit 1
}
Write-Host "✓ Linting passed" -ForegroundColor Green

# Step 3: Build
if (-not $SkipBuild) {
    Write-Host "`n[3/6] Building application..." -ForegroundColor Cyan
    npm run build
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed! Deployment aborted." -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Build successful" -ForegroundColor Green
} else {
    Write-Host "`n[3/6] Skipping build" -ForegroundColor Yellow
}

# Step 4: Database migrations
Write-Host "`n[4/6] Running database migrations..." -ForegroundColor Cyan
if ($DryRun) {
    Write-Host "DRY RUN: Would run: alembic upgrade head" -ForegroundColor Yellow
} else {
    alembic upgrade head
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Migration failed! Deployment aborted." -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Migrations applied" -ForegroundColor Green
}

# Step 5: Create deployment package
Write-Host "`n[5/6] Creating deployment package..." -ForegroundColor Cyan
$deployDir = "deploy/$Environment"
New-Item -ItemType Directory -Path $deployDir -Force | Out-Null

# Copy files
Copy-Item -Path "dist" -Destination "$deployDir/dist" -Recurse -Force
Copy-Item -Path "server_fastapi" -Destination "$deployDir/server_fastapi" -Recurse -Force
Copy-Item -Path "requirements.txt" -Destination "$deployDir/" -Force
Copy-Item -Path "alembic.ini" -Destination "$deployDir/" -Force
Copy-Item -Path "alembic" -Destination "$deployDir/alembic" -Recurse -Force

# Create .env template
@"
# Production Environment Variables
# Fill in actual values before deployment

NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/crypto
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=CHANGE_THIS_IN_PRODUCTION
"@ | Out-File -FilePath "$deployDir/.env.example" -Encoding UTF8

Write-Host "✓ Deployment package created at $deployDir" -ForegroundColor Green

# Step 6: Deployment instructions
Write-Host "`n[6/6] Deployment instructions:" -ForegroundColor Cyan
Write-Host "1. Copy files from $deployDir to server" -ForegroundColor White
Write-Host "2. Install dependencies: pip install -r requirements.txt" -ForegroundColor White
Write-Host "3. Configure .env file with production values" -ForegroundColor White
Write-Host "4. Run migrations: alembic upgrade head" -ForegroundColor White
Write-Host "5. Start services:" -ForegroundColor White
Write-Host "   - FastAPI: uvicorn server_fastapi.main:app --host 0.0.0.0 --port 8000" -ForegroundColor White
Write-Host "   - Or use systemd/service manager" -ForegroundColor White

if ($DryRun) {
    Write-Host "`n=== DRY RUN COMPLETE ===" -ForegroundColor Yellow
} else {
    Write-Host "`n=== DEPLOYMENT PACKAGE READY ===" -ForegroundColor Green
}

