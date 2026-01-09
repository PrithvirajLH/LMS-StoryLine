#!/bin/bash

# LMS Local Development Setup Script for Linux
# This script helps you start all services locally on Linux

echo "========================================"
echo "LMS Local Development Setup (Linux)"
echo "========================================"
echo ""

# Check if Node.js is installed
echo "Checking prerequisites..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✓ Node.js found: $NODE_VERSION"
else
    echo "✗ Node.js not found. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_MAJOR=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo "✗ Node.js version 18+ required. Current version: $(node --version)"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "✗ npm not found. Please install npm"
    exit 1
fi

# Step 1: Install root dependencies
echo ""
echo "Step 1: Installing root dependencies..."
if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "✗ Failed to install root dependencies"
        exit 1
    fi
else
    echo "✓ Root dependencies already installed"
fi

# Step 2: Install backend dependencies
echo ""
echo "Step 2: Installing backend dependencies..."
cd backend
if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "✗ Failed to install backend dependencies"
        exit 1
    fi
else
    echo "✓ Backend dependencies already installed"
fi

# Step 3: Create .env file if it doesn't exist
echo ""
echo "Step 3: Checking backend .env file..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✓ Created .env file from .env.example"
        echo "⚠ Please edit backend/.env and configure your settings!"
    else
        echo "⚠ .env.example not found. Please create backend/.env manually"
    fi
else
    echo "✓ .env file exists"
fi

cd ..

# Step 4: Install frontend dependencies
echo ""
echo "Step 4: Installing frontend dependencies..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "✗ Failed to install frontend dependencies"
        exit 1
    fi
else
    echo "✓ Frontend dependencies already installed"
fi

# Step 5: Create frontend .env if needed
echo ""
echo "Step 5: Checking frontend .env file..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✓ Created .env file from .env.example"
    else
        # Create a basic .env file
        echo "VITE_API_URL=http://localhost:3001" > .env
        echo "✓ Created basic .env file"
    fi
else
    echo "✓ Frontend .env file exists"
fi

cd ..

# Summary
echo ""
echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Edit backend/.env and configure:"
echo "   - Azure Storage connection"
echo "   - LRS credentials (if using external LRS)"
echo "   - JWT_SECRET"
echo ""
echo "2. Update frontend/.env if needed:"
echo "   - VITE_API_URL (default: http://localhost:3001)"
echo ""
echo "3. Start the development servers:"
echo "   npm run dev"
echo ""
echo "   Or start individually:"
echo "   Terminal 1: npm run dev:backend"
echo "   Terminal 2: npm run dev:frontend"
echo ""
echo "4. Access the application:"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:3001"
echo ""
