# LMS Local Development Startup Script
# This script helps you start all services locally

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "LMS Local Development Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "Checking prerequisites..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found. Please install Node.js 18+ from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check if Docker is running
Write-Host "Checking Docker..." -ForegroundColor Yellow
try {
    docker ps | Out-Null
    Write-Host "✓ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker is not running. Please start Docker Desktop" -ForegroundColor Red
    exit 1
}

# Step 1: Install backend dependencies
Write-Host ""
Write-Host "Step 1: Installing backend dependencies..." -ForegroundColor Yellow
Set-Location backend
if (-not (Test-Path node_modules)) {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Failed to install backend dependencies" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✓ Backend dependencies already installed" -ForegroundColor Green
}

# Step 2: Create .env file if it doesn't exist
Write-Host ""
Write-Host "Step 2: Checking backend .env file..." -ForegroundColor Yellow
if (-not (Test-Path .env)) {
    if (Test-Path .env.example) {
        Copy-Item .env.example .env
        Write-Host "✓ Created .env file from .env.example" -ForegroundColor Green
        Write-Host "⚠ Please edit backend/.env and configure your settings!" -ForegroundColor Yellow
    } else {
        Write-Host "✗ .env.example not found" -ForegroundColor Red
    }
} else {
    Write-Host "✓ .env file exists" -ForegroundColor Green
}

Set-Location ..

# Step 3: Install frontend dependencies
Write-Host ""
Write-Host "Step 3: Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location frontend
if (-not (Test-Path node_modules)) {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Failed to install frontend dependencies" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✓ Frontend dependencies already installed" -ForegroundColor Green
}
Set-Location ..

# Step 4: Start Learning Locker
Write-Host ""
Write-Host "Step 4: Starting Learning Locker (LRS)..." -ForegroundColor Yellow
Set-Location docker
Write-Host "Starting Docker containers..." -ForegroundColor Cyan
docker-compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to start Learning Locker" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Learning Locker starting (this may take 2-3 minutes)" -ForegroundColor Green
Write-Host "  Access at: http://localhost:8080" -ForegroundColor Cyan
Set-Location ..

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Edit backend/.env and configure:" -ForegroundColor White
Write-Host "   - Database connection" -ForegroundColor Gray
Write-Host "   - LRS credentials (from Learning Locker)" -ForegroundColor Gray
Write-Host "   - JWT_SECRET" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Set up Learning Locker:" -ForegroundColor White
Write-Host "   - Open http://localhost:8080" -ForegroundColor Gray
Write-Host "   - Create account, organization, store, and client" -ForegroundColor Gray
Write-Host "   - Copy Basic Auth credentials to backend/.env" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Run database migrations:" -ForegroundColor White
Write-Host "   cd backend" -ForegroundColor Gray
Write-Host "   npm run migrate" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Start backend (in new terminal):" -ForegroundColor White
Write-Host "   cd backend" -ForegroundColor Gray
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Start frontend (in new terminal):" -ForegroundColor White
Write-Host "   cd frontend" -ForegroundColor Gray
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "6. Open browser:" -ForegroundColor White
Write-Host "   http://localhost:5173" -ForegroundColor Cyan
Write-Host ""


