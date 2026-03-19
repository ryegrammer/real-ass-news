const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);

// WebSocket server for signaling (WebRTC) and legacy streaming
const wss = new WebSocket.Server({ server, path: '/camera-stream' });
const signalingWss = new WebSocket.Server({ server, path: '/webrtc-signaling' });

let cameraProcess = null;
let isStreaming = false;

// Track WebRTC peers
const webrtcPeers = new Map();

// Middleware
app.use(express.json());

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check endpoint
app.get('/api/camera/health', (req, res) => {
  res.json({
    status: 'healthy',
    streaming: isStreaming,
    webrtcPeers: webrtcPeers.size,
    timestamp: new Date().toISOString()
  });
});

// Start camera stream
app.post('/api/camera/start', (req, res) => {
  const { quality = 'medium' } = req.body;

  if (isStreaming) {
    return res.status(409).json({ error: 'Camera is already streaming' });
  }

  try {
    startCameraStream(quality);
    isStreaming = true;
    res.json({ status: 'started', quality });
  } catch (error) {
    console.error('Failed to start camera:', error);
    res.status(500).json({ error: 'Failed to start camera stream' });
  }
});

// Stop camera stream
app.post('/api/camera/stop', (req, res) => {
  try {
    stopCameraStream();
    isStreaming = false;
    res.json({ status: 'stopped' });
  } catch (error) {
    console.error('Failed to stop camera:', error);
    res.status(500).json({ error: 'Failed to stop camera stream' });
  }
});

// Get camera status
app.get('/api/camera/status', (req, res) => {
  res.json({
    streaming: isStreaming,
    connected_clients: wss.clients.size,
    webrtc_peers: webrtcPeers.size,
    uptime: process.uptime()
  });
});

// WebRTC configuration endpoint
app.get('/api/camera/webrtc-config', (req, res) => {
  res.json({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  });
});

// Quality settings for libcamera
const qualitySettings = {
  low: { width: 640, height: 480, framerate: 15, bitrate: 1000000 },
  medium: { width: 1280, height: 720, framerate: 30, bitrate: 2000000 },
  high: { width: 1920, height: 1080, framerate: 30, bitrate: 4000000 }
};

function startCameraStream(quality) {
  const settings = qualitySettings[quality] || qualitySettings.medium;

  // Use libcamera for Raspberry Pi Camera Module 3
  const cameraArgs = [
    '--nopreview',
    '--timeout', '0',
    '--width', settings.width.toString(),
    '--height', settings.height.toString(),
    '--framerate', settings.framerate.toString(),
    '--bitrate', settings.bitrate.toString(),
    '--output', '-',
    '--codec', 'h264',
    '--inline',
    '--listen'
  ];

  console.log(`Starting camera with quality: ${quality}`, settings);

  cameraProcess = spawn('libcamera-vid', cameraArgs, {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  cameraProcess.on('error', (error) => {
    console.error('Camera process error:', error);
    console.log('Trying fallback to raspivid...');
    
    const raspividArgs = [
      '-t', '0',
      '-w', settings.width.toString(),
      '-h', settings.height.toString(),
      '-fps', settings.framerate.toString(),
      '-b', settings.bitrate.toString(),
      '-o', '-',
      '-pf', 'baseline'
    ];

    cameraProcess = spawn('raspivid', raspividArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });
  });

  cameraProcess.stdout.on('data', (data) => {
    // Broadcast to legacy WebSocket clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });

    // Send to WebRTC data channels if available
    webrtcPeers.forEach((peer, peerId) => {
      if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
        try {
          peer.dataChannel.send(data);
        } catch (err) {
          console.error(`Error sending to peer ${peerId}:`, err);
        }
      }
    });
  });

  cameraProcess.stderr.on('data', (data) => {
    console.error('Camera stderr:', data.toString());
  });

  cameraProcess.on('close', (code) => {
    console.log(`Camera process exited with code ${code}`);
    isStreaming = false;
  });
}

function stopCameraStream() {
  if (cameraProcess) {
    cameraProcess.kill('SIGTERM');
    cameraProcess = null;
  }
  isStreaming = false;
}

// Legacy WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected to camera stream (legacy)');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'request_stream':
          if (isStreaming) {
            ws.send(JSON.stringify({ type: 'stream_available' }));
          } else {
            ws.send(JSON.stringify({ type: 'stream_unavailable' }));
          }
          break;

        case 'change_quality':
          if (isStreaming) {
            stopCameraStream();
            setTimeout(() => {
              startCameraStream(data.quality || 'medium');
            }, 1000);
          }
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected from camera stream');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// WebRTC Signaling WebSocket handling
signalingWss.on('connection', (ws) => {
  const peerId = `peer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`WebRTC peer connected: ${peerId}`);

  webrtcPeers.set(peerId, { ws, dataChannel: null });

  // Send peer ID to client
  ws.send(JSON.stringify({
    type: 'peer_id',
    peerId
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`Received signaling message from ${peerId}:`, data.type);

      switch (data.type) {
        case 'offer':
          // In a full implementation, this would create an RTCPeerConnection
          // and generate an answer. For Pi, we'd use GStreamer or similar
          // to handle the actual WebRTC connection.
          handleWebRTCOffer(peerId, data);
          break;

        case 'answer':
          handleWebRTCAnswer(peerId, data);
          break;

        case 'ice_candidate':
          handleICECandidate(peerId, data);
          break;

        case 'request_stream':
          if (isStreaming) {
            ws.send(JSON.stringify({ type: 'stream_available', peerId }));
          } else {
            ws.send(JSON.stringify({ type: 'stream_unavailable' }));
          }
          break;

        case 'change_quality':
          if (isStreaming) {
            const quality = data.quality || 'medium';
            stopCameraStream();
            setTimeout(() => startCameraStream(quality), 500);
            ws.send(JSON.stringify({ type: 'quality_changed', quality }));
          }
          break;
      }
    } catch (error) {
      console.error('WebRTC signaling error:', error);
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  });

  ws.on('close', () => {
    console.log(`WebRTC peer disconnected: ${peerId}`);
    webrtcPeers.delete(peerId);
  });

  ws.on('error', (error) => {
    console.error(`WebRTC peer error (${peerId}):`, error);
  });
});

// WebRTC signaling handlers
function handleWebRTCOffer(peerId, data) {
  const peer = webrtcPeers.get(peerId);
  if (!peer) return;

  // For a complete WebRTC implementation on Pi, you would:
  // 1. Use node-webrtc or wrtc package
  // 2. Or spawn GStreamer with webrtcbin
  // 3. Create answer SDP and send back

  // Simplified response - in production, integrate with actual WebRTC stack
  console.log(`Processing WebRTC offer from ${peerId}`);
  
  // Send acknowledgment (actual answer would come from WebRTC stack)
  peer.ws.send(JSON.stringify({
    type: 'offer_received',
    peerId,
    message: 'WebRTC offer received. Preparing stream...'
  }));

  // Notify that stream is ready via legacy method as fallback
  if (isStreaming) {
    peer.ws.send(JSON.stringify({
      type: 'stream_ready',
      peerId,
      fallback: 'websocket'
    }));
  }
}

function handleWebRTCAnswer(peerId, data) {
  const peer = webrtcPeers.get(peerId);
  if (!peer) return;

  console.log(`Processing WebRTC answer from ${peerId}`);
  // Handle SDP answer from client
}

function handleICECandidate(peerId, data) {
  const peer = webrtcPeers.get(peerId);
  if (!peer) return;

  console.log(`Processing ICE candidate from ${peerId}`);
  // In full implementation, add ICE candidate to peer connection
}

// Broadcast to all WebRTC peers
function broadcastToWebRTCPeers(message) {
  const messageStr = JSON.stringify(message);
  webrtcPeers.forEach((peer, peerId) => {
    if (peer.ws.readyState === WebSocket.OPEN) {
      peer.ws.send(messageStr);
    }
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  stopCameraStream();
  
  // Close all WebRTC peers
  webrtcPeers.forEach((peer, peerId) => {
    peer.ws.close();
  });
  webrtcPeers.clear();

  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  stopCameraStream();
  
  webrtcPeers.forEach((peer) => {
    peer.ws.close();
  });
  webrtcPeers.clear();

  server.close(() => {
    process.exit(0);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Pi Camera Server running on port ${PORT}`);
  console.log(`Legacy WebSocket: ws://localhost:${PORT}/camera-stream`);
  console.log(`WebRTC Signaling: ws://localhost:${PORT}/webrtc-signaling`);
  console.log(`HTTP API: http://localhost:${PORT}/api/camera/`);
});
