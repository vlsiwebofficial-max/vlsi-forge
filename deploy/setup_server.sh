#!/bin/bash
# =============================================================================
# VLSI Forge — Server Setup Script
# Run this ONCE on a fresh Ubuntu 22.04 / Debian 12 server as root or sudo user
# Usage: sudo bash setup_server.sh
# =============================================================================

set -e  # Exit on any error

echo "======================================"
echo " VLSI Forge — Server Setup"
echo "======================================"

# ── 1. System packages ────────────────────────────────────────────────────────
echo "[1/8] Installing system packages..."
apt-get update -y
apt-get install -y \
    python3 python3-pip python3-venv \
    iverilog \
    verilator \
    nginx \
    certbot python3-certbot-nginx \
    git \
    curl \
    ufw \
    htop

echo "  ✓ iverilog $(iverilog -V 2>&1 | head -1)"
echo "  ✓ verilator $(verilator --version 2>&1 | head -1)"

# ── 2. Create app user ────────────────────────────────────────────────────────
echo "[2/8] Creating app user..."
if ! id "vlsiforge" &>/dev/null; then
    useradd -m -s /bin/bash vlsiforge
    echo "  ✓ Created user: vlsiforge"
else
    echo "  ✓ User vlsiforge already exists"
fi

# ── 3. Clone / copy app to server ────────────────────────────────────────────
echo "[3/8] Setting up app directory..."
APP_DIR="/opt/vlsiforge"
mkdir -p "$APP_DIR"

# If you have a GitHub repo, replace the echo below with:
#   git clone https://github.com/YOUR_USERNAME/vlsiforge.git "$APP_DIR"
# Otherwise, copy your backend folder here manually via scp:
#   scp -r ./backend user@your-server:/opt/vlsiforge/

echo "  → App directory: $APP_DIR"
echo "  → Copy your backend code here: scp -r ./backend user@YOUR_SERVER:/opt/vlsiforge/"

# ── 4. Python virtual environment ────────────────────────────────────────────
echo "[4/8] Creating Python virtualenv..."
python3 -m venv "$APP_DIR/venv"
source "$APP_DIR/venv/bin/activate"

if [ -f "$APP_DIR/backend/requirements.txt" ]; then
    pip install --upgrade pip -q
    pip install -r "$APP_DIR/backend/requirements.txt" -q
    echo "  ✓ Python dependencies installed"
else
    echo "  ⚠ No requirements.txt found at $APP_DIR/backend/requirements.txt"
    echo "    Copy your backend files first, then re-run: pip install -r requirements.txt"
fi

deactivate

# ── 5. Environment file ───────────────────────────────────────────────────────
echo "[5/8] Setting up environment file..."
ENV_FILE="$APP_DIR/backend/.env"

if [ ! -f "$ENV_FILE" ]; then
    cat > "$ENV_FILE" <<'ENVEOF'
# ── MongoDB Atlas ──────────────────────────────────────────────────────────
# Replace with your Atlas connection string (from Atlas → Connect → Drivers)
MONGO_URL="mongodb+srv://USERNAME:PASSWORD@cluster0.XXXXX.mongodb.net/?retryWrites=true&w=majority"
DB_NAME="vlsiforge"

# ── Security ───────────────────────────────────────────────────────────────
# Generate a strong secret: python3 -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET="REPLACE_WITH_STRONG_SECRET"

# ── CORS ───────────────────────────────────────────────────────────────────
# Set to your actual frontend domain (no trailing slash)
CORS_ORIGINS="https://vlsiweb.com,https://www.vlsiweb.com"
ENVEOF
    chmod 600 "$ENV_FILE"
    echo "  ✓ Created $ENV_FILE — EDIT THIS FILE with your real values before starting!"
else
    echo "  ✓ .env already exists, skipping"
fi

# ── 6. Fix permissions ────────────────────────────────────────────────────────
echo "[6/8] Setting permissions..."
chown -R vlsiforge:vlsiforge "$APP_DIR"
chmod -R 755 "$APP_DIR"
chmod 600 "$APP_DIR/backend/.env"
echo "  ✓ Permissions set"

# ── 7. Firewall ───────────────────────────────────────────────────────────────
echo "[7/8] Configuring firewall..."
ufw --force enable
ufw allow OpenSSH
ufw allow 'Nginx Full'
echo "  ✓ UFW configured (SSH + HTTP/HTTPS open)"

# ── 8. Systemd service ────────────────────────────────────────────────────────
echo "[8/8] Installing systemd service..."
cat > /etc/systemd/system/vlsiforge.service <<'SERVICEEOF'
[Unit]
Description=VLSI Forge FastAPI Backend
After=network.target

[Service]
Type=simple
User=vlsiforge
WorkingDirectory=/opt/vlsiforge/backend
Environment="PATH=/opt/vlsiforge/venv/bin"
EnvironmentFile=/opt/vlsiforge/backend/.env
ExecStart=/opt/vlsiforge/venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001 --workers 2
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=vlsiforge

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/opt/vlsiforge /tmp

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload
systemctl enable vlsiforge
echo "  ✓ Systemd service installed and enabled"

echo ""
echo "======================================"
echo " Setup complete!"
echo "======================================"
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. Copy your backend files to the server:"
echo "   scp -r ./backend/* user@YOUR_SERVER:/opt/vlsiforge/backend/"
echo ""
echo "2. Edit the .env file with your real values:"
echo "   sudo nano /opt/vlsiforge/backend/.env"
echo "   - MONGO_URL  → your Atlas connection string"
echo "   - JWT_SECRET → run: python3 -c \"import secrets; print(secrets.token_hex(32))\""
echo "   - CORS_ORIGINS → https://vlsiweb.com,https://www.vlsiweb.com"
echo ""
echo "3. Copy the Nginx config:"
echo "   sudo cp vlsiforge-nginx.conf /etc/nginx/sites-available/vlsiforge"
echo "   sudo ln -s /etc/nginx/sites-available/vlsiforge /etc/nginx/sites-enabled/"
echo "   sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "4. Get SSL certificate:"
echo "   sudo certbot --nginx -d api.vlsiweb.com"
echo ""
echo "5. Start the backend:"
echo "   sudo systemctl start vlsiforge"
echo "   sudo systemctl status vlsiforge"
echo ""
echo "6. Seed the database:"
echo "   cd /opt/vlsiforge && source venv/bin/activate"
echo "   python3 scripts/seed_database.py"
echo ""
