# =============================================================================
# VLSI Forge — Backend Dockerfile
# Builds a production-ready container with:
#   - Python 3.11
#   - Icarus Verilog (iverilog + vvp)
#   - Verilator (lint)
#   - FastAPI via uvicorn
# =============================================================================

FROM ubuntu:22.04

# Prevent interactive apt prompts
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# ── 1. System packages ────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-venv \
    python3-pip \
    iverilog \
    verilator \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Verify simulation tools are installed
RUN iverilog -V 2>&1 | head -1 && verilator --version 2>&1 | head -1

# ── 2. Create non-root user (security best practice) ─────────────────────────
RUN useradd -m -u 1001 -s /bin/bash appuser

# ── 3. Set up working directory ───────────────────────────────────────────────
WORKDIR /app

# ── 4. Install Python dependencies ───────────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ── 5. Copy application code ──────────────────────────────────────────────────
COPY . .

# ── 6. Fix permissions ────────────────────────────────────────────────────────
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# ── 7. Expose port ────────────────────────────────────────────────────────────
EXPOSE 8001

# ── 8. Health check ───────────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# ── 9. Start server ───────────────────────────────────────────────────────────
# Railway sets PORT env var — use it if available, fallback to 8001
CMD uvicorn server:app \
    --host 0.0.0.0 \
    --port ${PORT:-8001} \
    --workers 2 \
    --log-level info
