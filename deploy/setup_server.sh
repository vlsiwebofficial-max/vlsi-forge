#!/bin/bash
# =============================================================================
# VLSI Forge — One-Shot VPS Setup Script
# Tested on: Ubuntu 22.04 LTS (Hostinger KVM)
#
# Run as root:
#   curl -fsSL https://raw.githubusercontent.com/vlsiwebofficial-max/vlsi-forge/main/deploy/setup_server.sh | sudo bash
#
# Or after uploading:
#   sudo bash setup_server.sh
# =============================================================================

set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
GREEN="\e[32m"; YELLOW="\e[33m"; RED="\e[31m"; RESET="\e[0m"; BOLD="\e[1m"
ok()   { echo -e "${GREEN}  ✓ $*${RESET}"; }
warn() { echo -e "${YELLOW}  ⚠ $*${RESET}"; }
err()  { echo -e "${RED}  ✗ $*${RESET}"; exit 1; }
hdr()  { echo -e "\n${BOLD}[$1/9] $2${RESET}"; }

echo -e "${BOLD}"
echo "╔══════════════════════════════════════════╗"
echo "║      VLSI Forge — Server Setup           ║"
echo "║      Ubuntu 22.04 · Hostinger VPS        ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${RESET}"

GITHUB_REPO="https://github.com/vlsiwebofficial-max/vlsi-forge.git"
APP_DIR="/opt/vlsiforge"
APP_USER="vlsiforge"

# ── 1. System packages ────────────────────────────────────────────────────────
hdr 1 "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y -q
apt-get install -y -q \
    python3.11 python3.11-venv python3-pip \
    iverilog \
    verilator \
    nginx \
    certbot python3-certbot-nginx \
    git \
    curl \
    ufw \
    htop \
    ca-certificates

ok "iverilog: $(iverilog -V 2>&1 | head -1)"
ok "verilator: $(verilator --version 2>&1 | head -1)"
ok "Python: $(python3.11 --version)"
ok "nginx: $(nginx -v 2>&1)"

# ── 2. Create non-root app user ───────────────────────────────────────────────
hdr 2 "Creating app user"
if id "$APP_USER" &>/dev/null; then
    warn "User '$APP_USER' already exists — skipping"
else
    useradd -m -s /bin/bash "$APP_USER"
    ok "Created user: $APP_USER"
fi

# ── 3. Clone repository ───────────────────────────────────────────────────────
hdr 3 "Cloning repository from GitHub"
if [ -d "$APP_DIR/.git" ]; then
    warn "Repo already cloned — pulling latest"
    git -C "$APP_DIR" pull --ff-only
else
    git clone "$GITHUB_REPO" "$APP_DIR"
    ok "Cloned to $APP_DIR"
fi

# ── 4. Python virtual environment + dependencies ──────────────────────────────
hdr 4 "Setting up Python environment"
python3.11 -m venv "$APP_DIR/venv"
source "$APP_DIR/venv/bin/activate"
pip install --upgrade pip -q
pip install -r "$APP_DIR/backend/requirements.txt" -q
deactivate
ok "All Python dependencies installed"

# ── 5. Environment file ───────────────────────────────────────────────────────
hdr 5 "Environment configuration"
ENV_FILE="$APP_DIR/backend/.env"

if [ ! -f "$ENV_FILE" ]; then
    # Generate a random JWT secret automatically
    JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")

    cat > "$ENV_FILE" <<ENVEOF
# ── MongoDB Atlas ──────────────────────────────────────────────────────────────
# Replace with your real Atlas connection string
MONGO_URL=mongodb+srv://vlsiforge_user:PASSWORD@cluster0.XXXXX.mongodb.net/?retryWrites=true&w=majority
DB_NAME=vlsiforge

# ── Security ───────────────────────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}

# ── CORS ───────────────────────────────────────────────────────────────────────
CORS_ORIGINS=https://vlsiweb.com,https://www.vlsiweb.com

# ── Optional: Anthropic API for AI hints (leave blank to disable) ──────────────
# ANTHROPIC_API_KEY=sk-ant-...

# ── Optional: Resend API for email verification ────────────────────────────────
# RESEND_API_KEY=re_...
# FROM_EMAIL=noreply@vlsiweb.com
ENVEOF
    chmod 600 "$ENV_FILE"
    ok "Created $ENV_FILE (JWT secret auto-generated)"
    warn "Edit MONGO_URL in $ENV_FILE before starting the service!"
else
    ok ".env already exists — keeping existing file"
fi

# ── 6. Nginx configuration ────────────────────────────────────────────────────
hdr 6 "Configuring Nginx"
cp "$APP_DIR/deploy/vlsiforge-nginx.conf" /etc/nginx/sites-available/vlsiforge

# Enable by creating symlink (safe if already exists)
ln -sf /etc/nginx/sites-available/vlsiforge /etc/nginx/sites-enabled/vlsiforge

# Disable the default site
rm -f /etc/nginx/sites-enabled/default

nginx -t && ok "Nginx configuration valid"
systemctl enable nginx
systemctl restart nginx
ok "Nginx running"

# ── 7. Systemd service ────────────────────────────────────────────────────────
hdr 7 "Installing systemd service"
cat > /etc/systemd/system/vlsiforge.service <<'SERVICEEOF'
[Unit]
Description=VLSI Forge FastAPI Backend
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=vlsiforge
Group=vlsiforge
WorkingDirectory=/opt/vlsiforge/backend
Environment="PATH=/opt/vlsiforge/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
EnvironmentFile=/opt/vlsiforge/backend/.env

ExecStart=/opt/vlsiforge/venv/bin/uvicorn server:app \
    --host 127.0.0.1 \
    --port 8001 \
    --workers 2 \
    --log-level info

Restart=always
RestartSec=5
StartLimitIntervalSec=60
StartLimitBurst=5

# Logging
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
ok "Service 'vlsiforge' installed and enabled (auto-starts on reboot)"

# ── 8. Fix file permissions ───────────────────────────────────────────────────
hdr 8 "Setting file permissions"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chmod 600 "$APP_DIR/backend/.env"
ok "Ownership: $APP_USER, .env mode: 600"

# ── 9. Firewall ───────────────────────────────────────────────────────────────
hdr 9 "Configuring firewall (UFW)"
ufw --force enable
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw status verbose
ok "Firewall active (SSH + HTTP/HTTPS allowed)"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║   Setup complete!  Do these 3 things to go live:    ║"
echo "╚══════════════════════════════════════════════════════╝"
echo -e "${RESET}"

SERVER_IP=$(curl -s https://api.ipify.org 2>/dev/null || echo "YOUR_SERVER_IP")

echo -e "${BOLD}STEP A — Edit your environment file:${RESET}"
echo "   sudo nano /opt/vlsiforge/backend/.env"
echo "   → Set MONGO_URL to your Atlas connection string"
echo ""
echo -e "${BOLD}STEP B — Start the backend:${RESET}"
echo "   sudo systemctl start vlsiforge"
echo "   sudo journalctl -u vlsiforge -f   # watch logs"
echo ""
echo -e "${BOLD}STEP C — Get SSL certificate (after DNS is pointed here):${RESET}"
echo "   Your server IP: ${GREEN}${SERVER_IP}${RESET}"
echo "   In Hostinger DNS, add:  A record  api  →  ${SERVER_IP}"
echo "   Then run:"
echo "   sudo certbot --nginx -d api.vlsiweb.com --non-interactive --agree-tos -m your@email.com"
echo ""
echo -e "${BOLD}STEP D — Seed the database:${RESET}"
echo "   cd /opt/vlsiforge && source venv/bin/activate"
echo "   export \$(cat backend/.env | grep -v '^#' | xargs)"
echo "   python3 deploy/seed_atlas.py"
echo ""
echo -e "${BOLD}STEP E — Test everything:${RESET}"
echo "   curl http://localhost:8001/health"
echo "   curl https://api.vlsiweb.com/health   # after SSL"
echo ""
echo -e "${GREEN}Good luck! — VLSI Forge${RESET}"
