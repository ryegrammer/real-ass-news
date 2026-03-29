# Real Ass News

A streaming website for Raspberry Pi 5 that streams live content from the device's camera and records streams to build an educational content library.

## Quick Start (Raspberry Pi)

```sh
git clone https://github.com/ryegrammer/real-ass-news.git && cd real-ass-news && npm install && npm run build && cd docker && docker-compose -f docker-compose.pi.yml up -d
```

## Access Points

After deployment, access:
- **Web UI**: `http://raspberrypi.local:8080`
- **Camera API**: `http://raspberrypi.local:3001/api/camera/*`
- **WebRTC Signaling**: `ws://raspberrypi.local:3001/webrtc-signaling`

## Local Development

```sh
git clone https://github.com/ryegrammer/real-ass-news.git && cd real-ass-news && npm install && npm run dev
```

## Technologies

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Docker (for Pi deployment)

## Automated Deployment

Use the deploy script for one-command deployment to your Pi:

```sh
./scripts/deploy-to-pi.sh
```

## Project Info

**Lovable URL**: https://lovable.dev/projects/deea6293-da9c-4cb1-959a-a3137d8caa10
