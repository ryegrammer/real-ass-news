#!/bin/bash

# Deployment script for Raspberry Pi
# Usage: ./deploy-to-pi.sh [pi-hostname-or-ip] [username]

PI_HOST=${1:-"raspberrypi.local"}
PI_USER=${2:-"pi"}
PROJECT_NAME="pi-camera-webapp"

echo "🔧 Deploying Pi Camera Web Application to $PI_HOST"

# Check if we can connect to the Pi
echo "📡 Testing connection to $PI_HOST..."
if ! ping -c 1 $PI_HOST >/dev/null 2>&1; then
    echo "❌ Cannot reach $PI_HOST. Please check the hostname/IP and network connection."
    exit 1
fi

echo "✅ Connection to $PI_HOST successful"

# Build the application locally
echo "🏗️ Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix errors and try again."
    exit 1
fi

echo "✅ Build successful"

# Create deployment package
echo "📦 Creating deployment package..."
tar -czf pi-deployment.tar.gz \
    dist/ \
    docker/ \
    scripts/ \
    package.json \
    package-lock.json \
    README.md

echo "✅ Deployment package created"

# Copy files to Pi
echo "📤 Copying files to Pi..."
scp pi-deployment.tar.gz $PI_USER@$PI_HOST:/tmp/

if [ $? -ne 0 ]; then
    echo "❌ Failed to copy files to Pi. Please check SSH access."
    exit 1
fi

echo "✅ Files copied successfully"

# Deploy on Pi
echo "🚀 Deploying on Pi..."
ssh $PI_USER@$PI_HOST << 'EOF'
    # Extract deployment package
    cd /tmp
    tar -xzf pi-deployment.tar.gz

    # Create application directory
    sudo mkdir -p /opt/pi-camera-webapp
    sudo chown $USER:$USER /opt/pi-camera-webapp

    # Copy application files
    cp -r dist /opt/pi-camera-webapp/
    cp -r docker /opt/pi-camera-webapp/
    cp -r scripts /opt/pi-camera-webapp/
    cp package*.json /opt/pi-camera-webapp/

    # Install Docker if not present
    if ! command -v docker &> /dev/null; then
        echo "📥 Installing Docker..."
        curl -fsSL https://get.docker.com | sh
        sudo usermod -aG docker $USER
        sudo systemctl enable docker
        sudo systemctl start docker
    fi

    # Install Docker Compose if not present
    if ! command -v docker-compose &> /dev/null; then
        echo "📥 Installing Docker Compose..."
        sudo pip3 install docker-compose
    fi

    # Stop existing container if running
    cd /opt/pi-camera-webapp/docker
    sudo docker-compose -f docker-compose.pi.yml down 2>/dev/null || true

    # Build and start the application
    echo "🏗️ Building Docker image..."
    sudo docker-compose -f docker-compose.pi.yml build

    echo "🚀 Starting application..."
    sudo docker-compose -f docker-compose.pi.yml up -d

    # Clean up
    rm -f /tmp/pi-deployment.tar.gz
    rm -rf /tmp/dist /tmp/docker /tmp/scripts /tmp/package*.json

    echo "✅ Deployment completed!"
    echo "🌐 Application should be available at: http://$(hostname -I | awk '{print $1}')"
    echo "📹 Camera stream endpoint: ws://$(hostname -I | awk '{print $1}'):8080/camera-stream"
EOF

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed on Pi."
    exit 1
fi

# Clean up local files
rm -f pi-deployment.tar.gz

echo "🎉 Deployment completed successfully!"
echo ""
echo "🌐 Your Pi Camera Web Application is now running!"
echo "   Web Interface: http://$PI_HOST"
echo "   Camera API: http://$PI_HOST:8080/api/camera/"
echo ""
echo "📋 Useful commands:"
echo "   Check status: ssh $PI_USER@$PI_HOST 'cd /opt/pi-camera-webapp/docker && sudo docker-compose -f docker-compose.pi.yml ps'"
echo "   View logs: ssh $PI_USER@$PI_HOST 'cd /opt/pi-camera-webapp/docker && sudo docker-compose -f docker-compose.pi.yml logs -f'"
echo "   Restart: ssh $PI_USER@$PI_HOST 'cd /opt/pi-camera-webapp/docker && sudo docker-compose -f docker-compose.pi.yml restart'"
echo "   Stop: ssh $PI_USER@$PI_HOST 'cd /opt/pi-camera-webapp/docker && sudo docker-compose -f docker-compose.pi.yml down'"