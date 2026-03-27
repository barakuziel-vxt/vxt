# Multi-stage optimized build for Azure Functions
# Stage 1: Build dependencies
FROM python:3.11-slim as builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /tmp/requirements.txt
RUN pip install --user --no-cache-dir -r /tmp/requirements.txt

# Stage 2: Minimal runtime
FROM python:3.11-slim

# Install only runtime dependencies (NOT build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder
COPY --from=builder /root/.local /root/.local

ENV PATH=/root/.local/bin:$PATH \
    AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsVersion=4 \
    PYTHONPATH=/home/site/wwwroot \
    PYTHONUNBUFFERED=1

# Copy function app code
COPY . /home/site/wwwroot/

WORKDIR /home/site/wwwroot

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/ || exit 1 ; true

EXPOSE 8080

CMD ["python", "-m", "azure.functions"]

