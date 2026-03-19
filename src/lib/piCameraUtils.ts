import JMuxer from 'jmuxer';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PI_HOSTNAME = import.meta.env.VITE_PI_HOSTNAME || 'raspberrypi.local';
const PI_CAMERA_PORT = import.meta.env.VITE_PI_CAMERA_PORT || '8080';
const PI_BASE_URL = `http://${PI_HOSTNAME}:${PI_CAMERA_PORT}`;
const PI_WS_URL = `ws://${PI_HOSTNAME}:${PI_CAMERA_PORT}`;

export type StreamQuality = 'low' | 'medium' | 'high' | 'auto';

interface StreamState {
  ws: WebSocket | null;
  jmuxer: JMuxer | null;
  isConnected: boolean;
  quality: StreamQuality;
}

const state: StreamState = {
  ws: null,
  jmuxer: null,
  isConnected: false,
  quality: 'auto',
};

// ---------------------------------------------------------------------------
// HTTP helpers — talk to the Pi camera server REST API
// ---------------------------------------------------------------------------

async function apiFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${PI_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Pi API ${path}: ${res.status} — ${body}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether the Pi camera server is reachable.
 */
export const initPiCamera = async (): Promise<boolean> => {
  try {
    const health = await apiFetch<{ status: string }>('/api/camera/health');
    console.log('Pi camera server health:', health);
    return health.status === 'healthy';
  } catch (err) {
    console.warn('Pi camera server unreachable — running in offline/dev mode.', err);
    return false;
  }
};

/**
 * Tell the Pi server to start the camera, then open a WebSocket that receives
 * raw H.264 NAL units and feeds them into JMuxer for playback in a <video>.
 */
export const startPiCameraStream = async (
  videoElement: HTMLVideoElement,
  quality: StreamQuality = 'auto',
): Promise<string | null> => {
  // Resolve "auto" to "medium"
  const resolvedQuality = quality === 'auto' ? 'medium' : quality;
  state.quality = resolvedQuality;

  // 1. Ask the server to start the camera process
  try {
    await apiFetch('/api/camera/start', {
      method: 'POST',
      body: JSON.stringify({ quality: resolvedQuality }),
    });
  } catch (err: unknown) {
    // 409 = already streaming — that's fine
    if (!(err instanceof Error && err.message.includes('409'))) throw err;
  }

  // 2. Set up JMuxer on the provided <video> element
  cleanup(); // tear down any previous session

  const jmuxer = new JMuxer({
    node: videoElement,
    mode: 'video',
    fps: resolvedQuality === 'low' ? 15 : 30,
    flushingTime: 100,
    debug: false,
  });

  // 3. Open WebSocket to receive H.264 data
  return new Promise<string>((resolve, reject) => {
    const wsUrl = `${PI_WS_URL}/camera-stream?quality=${resolvedQuality}`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket connection timed out'));
    }, 10_000);

    ws.onopen = () => {
      clearTimeout(timeout);
      console.log('WebSocket connected to Pi camera stream');

      // Ask the server for the stream (legacy protocol handshake)
      ws.send(JSON.stringify({ type: 'request_stream' }));

      state.ws = ws;
      state.jmuxer = jmuxer;
      state.isConnected = true;

      resolve(wsUrl);
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        // Control / signaling message
        try {
          const msg = JSON.parse(event.data);
          console.log('Pi camera control message:', msg);
        } catch {
          // ignore
        }
        return;
      }

      // Binary H.264 data → feed into JMuxer
      const data = new Uint8Array(event.data as ArrayBuffer);
      jmuxer.feed({ video: data });
    };

    ws.onerror = (e) => {
      clearTimeout(timeout);
      console.error('WebSocket error:', e);
      reject(new Error('WebSocket connection failed'));
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      state.isConnected = false;
    };
  });
};

/**
 * Stop the camera stream — close the WebSocket, destroy JMuxer, and tell the
 * Pi server to stop the camera process.
 */
export const stopPiCameraStream = async (): Promise<void> => {
  cleanup();

  try {
    await apiFetch('/api/camera/stop', { method: 'POST' });
  } catch (err) {
    console.warn('Failed to tell Pi to stop camera (may already be stopped):', err);
  }
};

/**
 * Get the current connection status.
 */
export const getCameraStatus = (): {
  isConnected: boolean;
  quality: StreamQuality;
  piHost: string;
} => ({
  isConnected: state.isConnected,
  quality: state.quality,
  piHost: `${PI_HOSTNAME}:${PI_CAMERA_PORT}`,
});

/**
 * Fetch camera status from the Pi server.
 */
export const getRemoteCameraStatus = async () => {
  return apiFetch<{
    streaming: boolean;
    connected_clients: number;
    webrtc_peers: number;
    uptime: number;
  }>('/api/camera/status');
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function cleanup() {
  if (state.ws) {
    state.ws.close();
    state.ws = null;
  }
  if (state.jmuxer) {
    state.jmuxer.destroy();
    state.jmuxer = null;
  }
  state.isConnected = false;
}
