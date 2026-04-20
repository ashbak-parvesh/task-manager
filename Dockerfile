# ============================================================
# Stage 1 – Builder
# Install dependencies into a virtual environment so the
# final image stays lean and reproducible.
# ============================================================
FROM python:3.12-slim AS builder

# Prevent .pyc files and enable unbuffered stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /build

# Install only the packages needed to compile wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Create an isolated virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies (cached layer unless requirements change)
COPY requirements.txt .
RUN pip install --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt


# ============================================================
# Stage 2 – Runtime
# Copy only the venv and application source – no build tools.
# ============================================================
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    # Default runtime env-vars (override via docker run -e or .env)
    APP_NAME="FastAPI Task Manager" \
    DEBUG="false" \
    DATABASE_URL="sqlite+aiosqlite:////data/task_manager.db" \
    ACCESS_TOKEN_EXPIRE_MINUTES="60"

# Create a non-root user for security
RUN addgroup --system appgroup \
 && adduser  --system --ingroup appgroup --no-create-home appuser

WORKDIR /app

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv

# Copy application source
COPY app/       ./app/
COPY frontend/  ./frontend/

# Persistent volume for the SQLite database file
# Mount a host directory here so data survives container restarts:
#   docker run -v $(pwd)/data:/data ...
RUN mkdir -p /data && chown appuser:appgroup /data
VOLUME ["/data"]

# Switch to non-root user
USER appuser

# Expose the application port
EXPOSE 8000

# Health-check – Docker will poll this every 30 s
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c \
        "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" \
        || exit 1

# ── Start server ──────────────────────────────────────────────
# • --host 0.0.0.0   bind to all interfaces inside the container
# • --workers 1      SQLite doesn't support concurrent writers;
#                    use PostgreSQL + increase workers for production
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "1", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*"]