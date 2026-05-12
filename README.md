# Karaoke Eternal

Host awesome karaoke parties where everyone can easily find and queue songs from their phone's browser. The player is also fully browser-based with support for MP3+G, MP4 videos and WebGL visualizations. The server is self-hosted and runs on nearly everything.

[![Karaoke Eternal](/docs/assets/images/README.jpg?raw=true)](/docs/assets/images/README.jpg?raw=true)

<p align="center">
  <i>App in mobile browser (top) controlling player in desktop browser (bottom)</i>
</p>

## Features

- Plays:
  - MP3+G (MP3 with CDG lyrics; including zipped)
  - MP4 videos
  - Music-synced visualizations (with automatic lyrics background removal)
- Fast, modern mobile browser app designed for "karaoke conditions"
- Easy joining with QR codes and guest accounts
- Multiple simultaneous rooms/queues (optionally password-protected)
- Dynamic queues keep parties fair, fun and no-fuss
- Fully self-hosted
- No ads or telemetry

Microphones are *not* required since the player itself only outputs music - this allows your audio setup to be as simple or complex as you like. See the [F.A.Q.](https://www.karaoke-eternal.com/faq/#recommended-audio-microphone-setup) for more information.

## Getting Started

 Karaoke Eternal basically has 3 parts. See [Getting Started](https://www.karaoke-eternal.com/docs/getting-started/) to get up and running step-by-step, or jump to the documentation for each part below:
 
- **[Server:](https://www.karaoke-eternal.com/docs/karaoke-eternal-server/)** Runs on pretty much anything to serve the web app and your media files, including a Windows PC, Mac, or a dedicated server like a Raspberry Pi or Synology NAS.
- **[App:](https://www.karaoke-eternal.com/docs/karaoke-eternal-app/)** Fast, modern mobile web app designed for "karaoke conditions".
- **[Player:](https://www.karaoke-eternal.com/docs/karaoke-eternal-app/#player)** Just another part of the app, but meant to run fullscreen on the system handling audio/video for a [room](https://www.karaoke-eternal.com/docs/karaoke-eternal-app/#rooms-admin-only)

## Installation

There are several [installation methods](https://www.karaoke-eternal.com/docs/karaoke-eternal-server/#installation) available for Karaoke Eternal Server.

### Docker (with YouTube & Karaoke Generation)

This fork includes Docker support with integrated YouTube search, Spleeter vocal isolation, Whisper lyrics alignment, and AutoLyrixAlign.

#### Prerequisites

- Docker and Docker Compose
- ~15 GB disk space for AutoLyrixAlign data (downloaded on first run)
- ~200 MB for Spleeter 2stems model (downloaded on first start)

#### 1. Configure Volumes

Edit `docker-compose.yml` and adjust the volume paths to match your system:

```yaml
volumes:
  - /path/to/data:/data                  # Database and app data
  - /path/to/media:/media                # Your media library (MP3+G, MP4, etc.)
  - /path/to/youtube-tmp:/app/tmp        # Temp storage for YouTube downloads & processing
```

For the AutoLyrixAlign service:
```yaml
volumes:
  - /path/to/autolyrixalign-data:/app/NUSAutoLyrixAlign  # ~13 GB alignment models
```

#### 2. Build and Start

```bash
docker compose up -d --build
```

This builds two containers:
- **karaoke-4ever** — the main Karaoke Eternal app (port `9988`)
- **autolyrixalign** — the AutoLyrixAlign lyrics alignment service (port `3001`)

#### 3. Initial Setup

1. Open `http://<your-host>:9988` in a browser
2. Create your admin account (first user is automatically admin)
3. Go to **Account** and add your media folder path (`/media`)

#### 4. Enable YouTube & Karaoke Generation

In the **Account** page (admin only):

1. Check **Enable YouTube search** — lets users search and queue YouTube videos
2. Check **Automatically create karaoke mixes** — enables Spleeter + lyrics alignment
3. Set **Spleeter path** to `spleeter` (default, already on PATH in the container)
4. Set **AutoLyrixAlign Service Host** to `autolyrixalign:3000` (the Docker service name)
5. Use the **Test** buttons to verify both services are working

#### 5. Port Configuration

| Service | Container Port | Default Host Port |
|---------|---------------|-------------------|
| Karaoke Eternal | 3000 | 9988 |
| AutoLyrixAlign | 3000 | 3001 |

Edit the `ports` section in `docker-compose.yml` to change host ports.

#### Notes

- The AutoLyrixAlign container runs in **privileged mode** (required by Singularity)
- On first run, AutoLyrixAlign will download ~13 GB of alignment data — this is persisted in the volume
- The Spleeter 2stems model (~200 MB) is automatically downloaded on first startup
- YouTube processing uses Whisper (via stable-ts + faster-whisper) for non-Latin lyrics alignment and falls back to AutoLyrixAlign for English

## Discord & Support

Join the [Karaoke Eternal Discord Server](https://discord.gg/PgqVtFq) for general support and development chat, or just to say hi!

## Contributing & Development

Contributions are welcome! Please join the `#dev` channel of the [Discord Server](https://discord.gg/PgqVtFq) before embarking on major features; the project's scope is limited to ensure success.

Make sure you have [Node.js](https://nodejs.org/en/) v24 or later, then:

1. Fork and clone the repo
2. `npm i`
3. `npm run dev` and look for "Web server running at" for the **server URL**
