# Karaoke Eternal with Spleeter support
FROM node:24-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install spleeter, stable-ts and faster-whisper in a virtual environment
RUN python3 -m venv /opt/spleeter-venv && \
    /opt/spleeter-venv/bin/pip install --no-cache-dir spleeter && \
    /opt/spleeter-venv/bin/pip install --no-cache-dir faster-whisper && \
    /opt/spleeter-venv/bin/pip install --no-cache-dir stable-ts && \
    /opt/spleeter-venv/bin/pip install --no-cache-dir --force-reinstall \
      torch==2.5.1+cpu torchaudio==2.5.1+cpu --index-url https://download.pytorch.org/whl/cpu && \
    /opt/spleeter-venv/bin/pip install --no-cache-dir "typer<0.4.0"

# Note: spleeter 2stems model is downloaded at runtime by bootstrap.ts
# and persisted on the /app/tmp volume

# Create a wrapper script so "spleeter" is available on PATH
RUN echo '#!/bin/sh\nexec /opt/spleeter-venv/bin/spleeter "$@"' > /usr/local/bin/spleeter && \
    chmod +x /usr/local/bin/spleeter

WORKDIR /app

# Copy the karaoke-eternal source
COPY . .

# Install dependencies and build
RUN npm install
# Build client without minification for readable stack traces
RUN WEBPACK_NO_MINIMIZE=1 npm run build:client && npm run build:server

# Create data directory
RUN mkdir -p /data

# Expose default port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV KES_PATH_DATA=/data

CMD ["node", "build/server/main.js", "-p", "3000"]
