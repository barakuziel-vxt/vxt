# Multi-stage build for VXT FastAPI Container
# Using pymssql (pure Python) - no system ODBC drivers needed

# Stage 1: Builder
FROM python:3.11-slim AS builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Stage 2: Runtime (Lean image - no ODBC system packages)
FROM python:3.11-slim

WORKDIR /app

# Copy Python packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY . .

# Expose port 8000 for API
EXPOSE 8000

# Run FastAPI with Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

