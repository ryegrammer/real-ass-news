

# Phase 4: USB Camera Support + Build Fix

## Overview
Two things block running on the Pi: (1) build errors in test files, (2) server only supports CSI cameras via `libcamera-vid`. This plan fixes both and adds ffmpeg-based USB camera support.

## Changes

### 1. Fix build errors in `useTheme.test.tsx`
The test mocks `useLocalStorage` returning 2 elements but the hook now expects 3. Add the missing third element (a `removeItem` mock) to all test cases.

### 2. Add USB camera support to `pi-camera-server.js`
- Add a `detectCameraType()` function that checks:
  - `libcamera-vid --list-cameras` → if it finds a camera, return `'csi'`
  - `ls /dev/video*` → if found, return `'usb'`
  - Otherwise return `'none'`
- In `startCameraStream()`, if camera type is `'usb'`, spawn ffmpeg instead:
  ```
  ffmpeg -f v4l2 -i /dev/video0 -c:v libx264 -preset ultrafast
         -tune zerolatency -f h264 -
  ```
  Output goes to stdout → same WebSocket broadcast, no frontend changes needed
- Same change in the recording endpoint: use ffmpeg for USB cameras writing to file
- Update `/api/camera/health` to return `cameraType: 'csi' | 'usb' | 'none'`

### 3. Update Dockerfile to install ffmpeg
Add `apk add --no-cache ffmpeg` to the production stage of `docker/Dockerfile.pi`.

### 4. Update `docker-compose.pi.yml`
The USB camera may appear as `/dev/video0`, `/dev/video1`, etc. Add a note and keep the existing device mapping.

### 5. Update `StreamingSection.tsx`
Display the detected camera type from the health endpoint (e.g., "USB Camera connected" vs "CSI Camera connected").

## Files changed

| Action | File |
|--------|------|
| Edit | `src/hooks/useTheme.test.tsx` — fix mock return values |
| Edit | `docker/pi-camera-server.js` — add camera detection + ffmpeg path |
| Edit | `docker/Dockerfile.pi` — install ffmpeg |
| Edit | `src/components/StreamingSection.tsx` — show camera type |

