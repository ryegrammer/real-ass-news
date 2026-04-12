const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);

// WebSocket server for signaling (WebRTC) and legacy streaming
const wss = new WebSocket.Server({ server, path: '/camera-stream' });
const signalingWss = new WebSocket.Server({ server, path: '/webrtc-signaling' });

let cameraProcess = null;
let isStreaming = false;

// ---- Recording state ----
const RECORDING_PATH = process.env.RECORDING_PATH || '/var/recordings';
let activeRecording = null; // { id, name, quality, filePath, startedAt, process }

// Ensure recording directory exists
try { fs.mkdirSync(RECORDING_PATH, { recursive: true }); } catch (_) {}

// Track WebRTC peers
const webrtcPeers = new Map();

// ---- Camera type detection ----
let detectedCameraType = null; // cached after first detection

function detectCameraType() {
  if (detectedCameraType) return detectedCameraType;

  // 1. Check for CSI camera via libcamera
  try {
    const out = execSync('libcamera-vid --list-cameras 2>&1', { timeout: 5000 }).toString();
    if (out && !out.includes('No cameras available')) {
      detectedCameraType = 'csi';
      console.log('Detected CSI camera via libcamera');
      return 'csi';
    }
  } catch (_) {}

  // 2. Check for V4L2 (USB) devices
  const cameraDevice = process.env.CAMERA_DEVICE || '/dev/video0';
  try {
    if (fs.existsSync(cameraDevice)) {
      detectedCameraType = 'usb';
      console.log(`Detected USB camera at ${cameraDevice}`);
      return 'usb';
    }
    // Also check common alternatives
    for (const dev of ['/dev/video0', '/dev/video1', '/dev/video2']) {
      if (fs.existsSync(dev)) {
        detectedCameraType = 'usb';
        console.log(`Detected USB camera at ${dev}`);
        return 'usb';
      }
    }
  } catch (_) {}

  detectedCameraType = 'none';
  console.log('No camera detected');
  return 'none';
}

// Force re-detection (e.g. after hot-plugging a camera)
function resetCameraDetection() {
  detectedCameraType = null;
}

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
  // Reset detection cache so health always gives fresh info
  resetCameraDetection();
  const cameraType = detectCameraType();

  res.json({
    status: 'healthy',
    streaming: isStreaming,
    cameraType,
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
    res.json({ status: 'started', quality, cameraType: detectedCameraType });
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
    cameraType: detectedCameraType || detectCameraType(),
    connected_clients: wss.clients.size,
    webrtc_peers: webrtcPeers.size,
    uptime: process.uptime()
  });
});

// ---- Recording endpoints ----

// Start recording
app.post('/api/camera/record/start', (req, res) => {
  const { name = 'Recording', quality = 'medium' } = req.body;

  if (activeRecording) {
    return res.status(409).json({ error: 'A recording is already in progress' });
  }

  const id = `rec_${Date.now()}`;
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${safeName}_${id}.h264`;
  const filePath = path.join(RECORDING_PATH, fileName);
  const settings = qualitySettings[quality] || qualitySettings.medium;
  const camType = detectCameraType();

  try {
    let recProcess;

    if (camType === 'usb') {
      // USB camera → use ffmpeg
      const cameraDevice = process.env.CAMERA_DEVICE || '/dev/video0';
      const ffmpegArgs = [
        '-f', 'v4l2',
        '-video_size', `${settings.width}x${settings.height}`,
        '-framerate', settings.framerate.toString(),
        '-i', cameraDevice,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-b:v', settings.bitrate.toString(),
        '-f', 'h264',
        filePath,
      ];
      recProcess = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      recProcess.stderr.on('data', (d) => console.error('ffmpeg rec stderr:', d.toString()));
    } else {
      // CSI camera → libcamera-vid with raspivid fallback
      const recArgs = [
        '--nopreview',
        '--timeout', '0',
        '--width', settings.width.toString(),
        '--height', settings.height.toString(),
        '--framerate', settings.framerate.toString(),
        '--bitrate', settings.bitrate.toString(),
        '--output', filePath,
        '--codec', 'h264',
        '--inline',
      ];

      recProcess = spawn('libcamera-vid', recArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      recProcess.on('error', () => {
        // Fallback to raspivid
        const rvArgs = [
          '-t', '0',
          '-w', settings.width.toString(),
          '-h', settings.height.toString(),
          '-fps', settings.framerate.toString(),
          '-b', settings.bitrate.toString(),
          '-o', filePath,
          '-pf', 'baseline',
        ];
        activeRecording.process = spawn('raspivid', rvArgs, {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      });
    }

    recProcess.on('close', () => {
      if (activeRecording && activeRecording.id === id) {
        activeRecording = null;
      }
    });

    activeRecording = { id, name, quality, filePath, fileName, startedAt: Date.now(), process: recProcess };
    console.log(`Recording started (${camType}): ${id} → ${filePath}`);
    res.json({ id, name, quality, cameraType: camType });
  } catch (error) {
    console.error('Failed to start recording:', error);
    res.status(500).json({ error: 'Failed to start recording' });
  }
});

// Stop recording
app.post('/api/camera/record/stop', (req, res) => {
  const { id } = req.body;

  if (!activeRecording) {
    return res.status(404).json({ error: 'No active recording' });
  }
  if (id && activeRecording.id !== id) {
    return res.status(404).json({ error: 'Recording ID mismatch' });
  }

  const rec = activeRecording;
  try {
    rec.process.kill('SIGTERM');
  } catch (_) {}

  const durationMs = Date.now() - rec.startedAt;
  const durationSec = Math.round(durationMs / 1000);
  const minutes = Math.floor(durationSec / 60).toString().padStart(2, '0');
  const seconds = (durationSec % 60).toString().padStart(2, '0');
  const duration = `${minutes}:${seconds}`;

  let size = '0 KB';
  try {
    const stats = fs.statSync(rec.filePath);
    const mb = stats.size / (1024 * 1024);
    size = mb >= 1 ? `${mb.toFixed(1)} MB` : `${(stats.size / 1024).toFixed(0)} KB`;
  } catch (_) {}

  activeRecording = null;
  console.log(`Recording stopped: ${rec.id} (${duration})`);

  // Write metadata alongside file
  const meta = { id: rec.id, name: rec.name, quality: rec.quality, date: new Date(rec.startedAt).toISOString().split('T')[0], duration, size, fileName: rec.fileName };
  try {
    fs.writeFileSync(rec.filePath.replace('.h264', '.json'), JSON.stringify(meta, null, 2));
  } catch (_) {}

  res.json({ id: rec.id, duration, size });
});

// List saved recordings
app.get('/api/camera/recordings', (req, res) => {
  try {
    const files = fs.readdirSync(RECORDING_PATH).filter(f => f.endsWith('.json'));
    const recordings = files.map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(RECORDING_PATH, f), 'utf-8'));
      } catch (_) { return null; }
    }).filter(Boolean).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    res.json(recordings);
  } catch (error) {
    console.error('Failed to list recordings:', error);
    res.json([]);
  }
});

// Download a recording file
app.get('/api/camera/recordings/:id', (req, res) => {
  try {
    const files = fs.readdirSync(RECORDING_PATH).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const meta = JSON.parse(fs.readFileSync(path.join(RECORDING_PATH, f), 'utf-8'));
      if (meta.id === req.params.id && meta.fileName) {
        const videoPath = path.join(RECORDING_PATH, meta.fileName);
        if (fs.existsSync(videoPath)) {
          res.setHeader('Content-Disposition', `attachment; filename="${meta.fileName}"`);
          return res.sendFile(videoPath);
        }
      }
    }
    res.status(404).json({ error: 'Recording not found' });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download recording' });
  }
});


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
  const camType = detectCameraType();

  console.log(`Starting camera stream (${camType}) with quality: ${quality}`, settings);

  if (camType === 'usb') {
    // USB camera → ffmpeg producing H.264 on stdout
    const cameraDevice = process.env.CAMERA_DEVICE || '/dev/video0';
    const ffmpegArgs = [
      '-f', 'v4l2',
      '-video_size', `${settings.width}x${settings.height}`,
      '-framerate', settings.framerate.toString(),
      '-i', cameraDevice,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-b:v', settings.bitrate.toString(),
      '-f', 'h264',
      '-',
    ];

    cameraProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    cameraProcess.stderr.on('data', (data) => {
      // ffmpeg writes progress to stderr — only log errors
      const msg = data.toString();
      if (msg.includes('Error') || msg.includes('error')) {
        console.error('ffmpeg error:', msg);
      }
    });
  } else {
    // CSI camera → libcamera-vid with raspivid fallback
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

      // Attach stdout listener to fallback process
      attachStdoutBroadcast(cameraProcess);
    });

    cameraProcess.stderr.on('data', (data) => {
      console.error('Camera stderr:', data.toString());
    });
  }

  // Broadcast stdout H.264 data to WebSocket clients
  attachStdoutBroadcast(cameraProcess);

  cameraProcess.on('close', (code) => {
    console.log(`Camera process exited with code ${code}`);
    isStreaming = false;
  });
}

function attachStdoutBroadcast(proc) {
  if (!proc || !proc.stdout) return;
  proc.stdout.on('data', (data) => {
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

  console.log(`Processing WebRTC offer from ${peerId}`);

  peer.ws.send(JSON.stringify({
    type: 'offer_received',
    peerId,
    message: 'WebRTC offer received. Preparing stream...'
  }));

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
}

function handleICECandidate(peerId, data) {
  const peer = webrtcPeers.get(peerId);
  if (!peer) return;
  console.log(`Processing ICE candidate from ${peerId}`);
}

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
  console.log(`Camera type: ${detectCameraType()}`);
  console.log(`Legacy WebSocket: ws://localhost:${PORT}/camera-stream`);
  console.log(`WebRTC Signaling: ws://localhost:${PORT}/webrtc-signaling`);
  console.log(`HTTP API: http://localhost:${PORT}/api/camera/`);
});
