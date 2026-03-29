#!/bin/bash
# Pi Camera detection and diagnostics script
# Called during container startup to verify camera hardware

echo "=== Pi Camera Diagnostics ==="
echo "Date: $(date)"
echo "Hostname: $(hostname)"

# Check for camera device
CAMERA_DEVICE=${CAMERA_DEVICE:-/dev/video0}
echo ""
echo "--- Camera Device ---"
if [ -e "$CAMERA_DEVICE" ]; then
    echo "✅ Camera device found: $CAMERA_DEVICE"
    ls -la "$CAMERA_DEVICE"
else
    echo "⚠️  Camera device not found: $CAMERA_DEVICE"
    echo "   Available video devices:"
    ls -la /dev/video* 2>/dev/null || echo "   (none found)"
fi

# Check V4L2 devices
echo ""
echo "--- V4L2 Devices ---"
if command -v v4l2-ctl &>/dev/null; then
    v4l2-ctl --list-devices 2>/dev/null || echo "No V4L2 devices detected"
else
    echo "v4l2-ctl not installed (optional)"
fi

# Check for libcamera
echo ""
echo "--- libcamera ---"
if command -v libcamera-vid &>/dev/null; then
    echo "✅ libcamera-vid available"
    libcamera-vid --version 2>/dev/null || true
elif command -v raspivid &>/dev/null; then
    echo "✅ raspivid available (legacy)"
else
    echo "⚠️  No camera CLI found (libcamera-vid or raspivid)"
    echo "   Install with: sudo apt install libcamera-apps"
fi

# Check recording directory
RECORDING_PATH=${RECORDING_PATH:-/var/recordings}
echo ""
echo "--- Recording Storage ---"
if [ -d "$RECORDING_PATH" ]; then
    echo "✅ Recording directory exists: $RECORDING_PATH"
    df -h "$RECORDING_PATH" 2>/dev/null
else
    echo "Creating recording directory: $RECORDING_PATH"
    mkdir -p "$RECORDING_PATH"
fi

echo ""
echo "=== Diagnostics Complete ==="
