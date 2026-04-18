# VXT Orchestrator — Azure IoT Edge Module
# Runs on Raspberry Pi 5 (ARM64 / aarch64)
#
# Build:
#   docker buildx build --platform linux/arm64 -t ghcr.io/barakuziel-vxt/vxt-orchestrator:latest .
# Push:
#   docker push ghcr.io/barakuziel-vxt/vxt-orchestrator:latest

FROM python:3.13-slim

WORKDIR /app

# Install dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY main.py .

# Azure IoT Edge module metadata
LABEL \
  com.microsoft.azure.iot.edge.module=true \
  description="VXT Orchestrator — twin sync, telemetry, alarms, geofences" \
  org.opencontainers.image.source="https://github.com/barakuziel-vxt/vxt"

# Run as non-root
RUN groupadd -r vxt && useradd -r -g vxt vxt
USER vxt

CMD ["python", "-u", "main.py"]
