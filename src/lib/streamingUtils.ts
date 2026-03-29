/**
 * Streaming utilities — thin wrappers around the Pi camera REST API.
 *
 * These call the real Pi camera server endpoints. No simulation code.
 */

const PI_HOSTNAME = import.meta.env.VITE_PI_HOSTNAME || 'raspberrypi.local';
const PI_CAMERA_PORT = import.meta.env.VITE_PI_CAMERA_PORT || '8080';
const PI_BASE_URL = `http://${PI_HOSTNAME}:${PI_CAMERA_PORT}`;

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

// ---- Stream lifecycle ----

export const connectToStream = async (quality: string = 'medium'): Promise<void> => {
  await apiFetch('/api/camera/start', {
    method: 'POST',
    body: JSON.stringify({ quality }),
  });
};

export const disconnectFromStream = async (): Promise<void> => {
  await apiFetch('/api/camera/stop', { method: 'POST' });
};

// ---- Recording (server-side — Phase 3 will add real endpoints) ----

export const startRecording = async (options: {
  name: string;
  quality: number;
  autoSave: boolean;
}): Promise<string> => {
  const qualityLabel = options.quality >= 1080 ? 'high' : options.quality >= 720 ? 'medium' : 'low';
  const result = await apiFetch<{ id: string }>('/api/camera/record/start', {
    method: 'POST',
    body: JSON.stringify({ name: options.name, quality: qualityLabel }),
  });
  return result.id;
};

export const stopRecording = async (recordingId: string): Promise<{
  id: string;
  duration: string;
  size: string;
}> => {
  return apiFetch('/api/camera/record/stop', {
    method: 'POST',
    body: JSON.stringify({ id: recordingId }),
  });
};

// ---- Library ----

export interface SavedRecording {
  id: number;
  name: string;
  date: string;
  duration: string;
  size: string;
}

export const getSavedRecordings = async (): Promise<SavedRecording[]> => {
  try {
    return await apiFetch<SavedRecording[]>('/api/camera/recordings');
  } catch {
    // Server doesn't have the recordings endpoint yet (Phase 3)
    console.warn('Recordings endpoint not available — returning empty list');
    return [];
  }
};
