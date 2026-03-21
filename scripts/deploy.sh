#!/bin/bash
set -e

SERVER_IP="98.142.138.80"
SSH_PORT="28742"
SSH_USER="root"
DEPLOY_DIR="/opt/psylent-phantom"

echo "=== Building applications ==="
npm run build

echo "=== Creating deployment package ==="
mkdir -p deploy
cp -r apps/server/dist deploy/
cp -r apps/server/package.json deploy/
cp -r apps/web/dist deploy/web
cp -r packages/shared deploy/

# Create production package.json for server
cat > deploy/package.json << 'EOF'
{
  "name": "@psylent/server",
  "version": "1.0.0",
  "scripts": {
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.19.0",
    "socket.io": "^4.7.0",
    "redis": "^4.6.0",
    "pg": "^8.11.0",
    "uuid": "^9.0.0",
    "dotenv": "^16.4.0"
  }
}
EOF

echo "=== Deploying to server ==="
ssh -p $SSH_PORT $SSH_USER@$SERVER_IP "mkdir -p $DEPLOY_DIR"

# Sync files
rsync -avz -e "ssh -p $SSH_PORT" deploy/ $SSH_USER@$SERVER_IP:$DEPLOY_DIR/

# Install dependencies and restart on server
ssh -p $SSH_PORT $SSH_USER@$SERVER_IP << EOF
cd $DEPLOY_DIR
npm install --production

# Create .env file if not exists
if [ ! -f .env ]; then
cat > .env << ENVFILE
PORT=3001
CLIENT_URL=http://98.142.138.80
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://psylent:psylent@localhost:5432/psylent
ENVFILE
fi

# Restart with PM2
pm2 delete psylent-server 2>/dev/null || true
pm2 start dist/index.js --name psylent-server --env production
pm2 save
EOF

echo "=== Deployment complete ==="
echo "Server: http://$SERVER_IP:3001"
echo "Health check: http://$SERVER_IP:3001/health"
