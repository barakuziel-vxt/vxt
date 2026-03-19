# Multi-stage build for VXT FastAPI Container
# Using pymssql (pure Python) - no system ODBC drivers needed
# Optimized for minimal image size

# Stage 1: Builder
FROM python:3.11-slim AS builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    find /usr/local/lib/python3.11 -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true && \
    find /usr/local/lib/python3.11 -type f -name "*.pyc" -delete && \
    find /usr/local/lib/python3.11 -type f -name "*.pyo" -delete

# Stage 2: Runtime (Lean image - with FreeTDS for pymssql)
FROM python:3.11-slim

WORKDIR /app

# Install FreeTDS (required for pymssql to connect to SQL Server)
RUN apt-get update && apt-get install -y --no-install-recommends \
    freetds-dev \
    && rm -rf /var/lib/apt/lists/*

# Set UTF-8 encoding to support special characters and proper console output in Azure
ENV PYTHONIOENCODING=utf-8
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

# Copy Python packages from builder (excluding unnecessary files)
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy only essential application code (excluded by .dockerignore)
COPY . .

# Clean up any remaining cache
RUN find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true && \
    find . -type f -name "*.pyc" -delete && \
    find . -type f -name "*.pyo" -delete

# Expose port 8000 for API
EXPOSE 8000

# Run FastAPI with Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

