#!/bin/bash

# POAM Nexus API Setup Script
# Automates initial setup for development environment

set -e

echo "🚀 POAM Nexus API Setup"
echo "======================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+ first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi

echo "✅ npm version: $(npm --version)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Copy .env.example to .env if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env and set your database credentials and JWT secret!"
else
    echo "✅ .env file already exists"
fi

# Check if Docker is available
if command -v docker &> /dev/null; then
    echo ""
    echo "🐳 Docker detected. You can use docker-compose to start PostgreSQL:"
    echo "   cd .. && docker-compose up -d db"
else
    echo ""
    echo "⚠️  Docker not found. You'll need to install PostgreSQL manually."
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env and set your DATABASE_URL and JWT_SECRET"
echo "2. Start PostgreSQL (via Docker or manually)"
echo "3. Run: npx prisma migrate dev"
echo "4. Run: npm run dev"
echo ""
echo "For full stack with Docker:"
echo "  cd .. && docker-compose up -d"
