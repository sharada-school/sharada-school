#!/usr/bin/env bash
# ==============================================================================
# Sharada School - Automated Production Deployment Script
# Domain: sharada-school.co.in/web
# ==============================================================================

set -e

echo "🚀 [1/5] Checking environment..."
cd "$(dirname "$0")"

if [ ! -f "server/.env" ]; then
    echo "⚠️ Warning: server/.env not found! Creating from example if available..."
    if [ -f "server/.env.example" ]; then
        cp server/.env.example server/.env
        echo "Created server/.env. Please update your database credentials."
    fi
fi

echo "📦 [2/5] Installing server dependencies..."
cd server
npm install --omit=dev
cd ..

echo "🎨 [3/5] Building React client for /web subpath..."
cd client
npm install
npm run build
cd ..

echo "🔄 [4/5] Reloading PM2 process..."
if command -v pm2 &> /dev/null; then
    pm2 startOrReload ecosystem.config.cjs --update-env
    pm2 save
    echo "✅ PM2 process restarted successfully!"
else
    echo "⚠️ PM2 not found globally. Starting with Node.js directly or run: npm install -g pm2"
fi

echo "✨ [5/5] Deployment complete!"
echo "Check health: curl http://localhost:4000/web/api/health"
