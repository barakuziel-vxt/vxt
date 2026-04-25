# VXT Node-RED Alert Engine — Azure IoT Edge Module
# Runs on Raspberry Pi 5 (ARM64 / aarch64)
#
# Responsibilities:
#   • Subscribes to SignalK notifications.* WebSocket stream
#   • RBE-filters alarm state changes (only forwards on state transition)
#   • Drives Text-to-Speech via espeak-ng on USB speaker (looping until normal)
#   • Exposes WebSocket server at /ws/vxt-alerts for vxt-orchestrator
#
# SD-card wear protection:
#   /data is expected to be mounted as tmpfs (see createOptions in deployment manifest)
#   contextStorage is set to 'memory' in settings.js
#
# Build (cross-compile for ARM64):
#   docker buildx build --platform linux/arm64 -t ghcr.io/barakuziel-vxt/vxt-nodered:latest .
# Push:
#   docker push ghcr.io/barakuziel-vxt/vxt-nodered:latest

FROM nodered/node-red:latest

USER root

# Install espeak-ng (TTS) and ALSA audio utilities
# Alpine community repo is required for espeak-ng
RUN echo "https://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories \
    && apk update \
    && apk add --no-cache \
       espeak-ng \
       alsa-utils \
       alsa-lib \
    && rm -rf /var/cache/apk/*

# Bundle flows and settings at a fixed image path (not /data — that's tmpfs)
RUN mkdir -p /etc/node-red-bundled
COPY --chown=root:root flows.json   /etc/node-red-bundled/flows.json
COPY --chown=root:root settings.js  /etc/node-red-bundled/settings.js
COPY --chown=root:root entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Azure IoT Edge module metadata
LABEL \
  com.microsoft.azure.iot.edge.module=true \
  description="VXT Node-RED Alert Engine — RBE filter, TTS, WebSocket alerts" \
  org.opencontainers.image.source="https://github.com/barakuziel-vxt/vxt"

# Run as root so the container can write to the tmpfs /data and access /dev/snd
USER root

EXPOSE 1880
ENTRYPOINT ["/entrypoint.sh"]
