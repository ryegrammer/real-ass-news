

# Phase 1: Fix Infrastructure Issues

## What needs to happen

Phase 1 fixes the broken build/deploy pipeline so the Docker image actually builds and the app can start on a Pi. Currently the Docker build **will fail** because a referenced file doesn't exist.

### 1. Create missing `docker/start-camera.sh`
The Dockerfile copies `docker/start-camera.sh` (line 36) but the file doesn't exist. This is a simple shell script to detect the camera device and start the camera process. It should:
- Check for `/dev/video0` or a V4L2 device
- Verify `libcamera-vid` or `raspivid` is available
- Print diagnostic info and exit (the actual streaming is started by the Node server on demand)

### 2. Delete dead `src/lib/cameraUtils.ts`
This file imports `@capacitor/camera` which is not installed and is irrelevant to the Pi architecture. It will cause build warnings and confusion. Remove it.

### 3. Add `.env.example` with Pi configuration variables
Document the environment variables the app needs so someone cloning the repo knows what to configure:
- `VITE_PI_HOSTNAME` — the Pi's address (default `raspberrypi.local`)
- `VITE_PI_CAMERA_PORT` — camera server port (default `8080`)
- `CAMERA_DEVICE`, `RECORDING_PATH` — server-side vars already in docker-compose

### 4. Fix `deploy-to-pi.sh` context path
The deploy script runs `docker-compose -f docker/docker-compose.pi.yml build` from `/opt/pi-camera-webapp`, but the compose file's `context: ..` expects to be run from the `docker/` subdirectory. Fix the working directory or the context path so the build actually works.

### 5. Fix Dockerfile `npm ci` flag
Line 10 uses `npm ci --only=production` which skips devDependencies needed for `npm run build` (Vite, TypeScript, etc.). Change to `npm ci` so the builder stage has everything it needs.

---

## Post-Phase 1: Revised look at Phases 2–5

After Phase 1, here's a tightened view of what remains:

**Phase 2 — Get WebSocket streaming working end-to-end**
- Add `jmuxer` package to decode H.264 in the browser
- Rewrite `piCameraUtils.ts` to open a real WebSocket to the Pi, pipe data through JMuxer into a `<video>` element
- Replace all simulation code in `streamingUtils.ts` with real HTTP calls to `/api/camera/start`, `/stop`, `/status`
- Add a Pi host setting (env var `VITE_PI_HOSTNAME`) wired into the connection logic

**Phase 3 — Server-side recording**
- Add `/api/camera/record/start`, `/record/stop`, `/recordings`, `/recordings/:id` endpoints to `pi-camera-server.js`
- Wire `RecordingControls.tsx` to these real endpoints instead of React state
- Align the quality slider values (360/720/1080) with server presets (low/medium/high)

**Phase 4 — Security**
- API key middleware on camera server (shared secret via env var)
- Restrict CORS to nginx origin
- Rate limiting on start/stop endpoints

**Phase 5 — WebRTC (future)**
- Only needed if WebSocket latency is too high; defer until Phases 2–3 are tested on hardware

---

## Files changed in Phase 1

| Action | File |
|--------|------|
| Create | `docker/start-camera.sh` |
| Create | `.env.example` |
| Delete | `src/lib/cameraUtils.ts` |
| Edit | `docker/Dockerfile.pi` (fix `npm ci` flag) |
| Edit | `scripts/deploy-to-pi.sh` (fix compose context path) |

