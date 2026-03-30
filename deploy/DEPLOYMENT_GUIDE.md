# VLSI Forge — Deployment Guide
## From Emergent → vlsiweb.com (Your Own Stack)

**Architecture after this guide:**
```
vlsiweb.com          →  Vercel  (React frontend)
api.vlsiweb.com      →  Your server  (FastAPI + Icarus Verilog)
                         ↓
                     MongoDB Atlas  (database, free tier)
```

---

## PART 1 — MongoDB Atlas (10 minutes)

### 1.1 Create a free cluster

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) → Sign up / Log in
2. Click **Create** → Choose **M0 FREE** → Pick a region closest to your server → **Create**
3. Cluster name: `vlsiforge`

### 1.2 Create a database user

1. Left sidebar → **Database Access** → **Add New Database User**
2. Username: `vlsiforge_user`
3. Password: generate a strong one — save it
4. Built-in role: **Read and write to any database**
5. Click **Add User**

### 1.3 Whitelist your server IP

1. Left sidebar → **Network Access** → **Add IP Address**
2. Enter your server's public IP address (find it with `curl ifconfig.me` on your server)
3. Comment: "VPS backend" → **Confirm**

### 1.4 Get your connection string

1. **Clusters** → **Connect** → **Drivers**
2. Driver: **Python**, Version: **3.12 or later**
3. Copy the string — it looks like:
   ```
   mongodb+srv://vlsiforge_user:<password>@cluster0.abc12.mongodb.net/
   ```
4. Replace `<password>` with the password you created in step 1.2
5. Save this — you'll need it in Part 2

---

## PART 2 — Backend on Your Server (20 minutes)

SSH into your server, then run these commands.

### 2.1 Run the setup script

```bash
# Upload the deploy folder to your server first
scp -r ./deploy user@YOUR_SERVER_IP:/tmp/vlsiforge-deploy

# SSH in and run setup
ssh user@YOUR_SERVER_IP
sudo bash /tmp/vlsiforge-deploy/setup_server.sh
```

This installs: Python, iverilog, verilator, Nginx, certbot, and creates the app user + systemd service.

### 2.2 Upload your backend code

```bash
# From your local machine
scp -r ./backend user@YOUR_SERVER_IP:/opt/vlsiforge/
scp -r ./scripts user@YOUR_SERVER_IP:/opt/vlsiforge/
```

### 2.3 Install Python dependencies

```bash
ssh user@YOUR_SERVER_IP
cd /opt/vlsiforge
source venv/bin/activate
pip install -r backend/requirements.txt
deactivate
```

### 2.4 Configure the .env file

```bash
sudo nano /opt/vlsiforge/backend/.env
```

Fill in these three values:

```env
MONGO_URL="mongodb+srv://vlsiforge_user:YOUR_PASSWORD@cluster0.XXXXX.mongodb.net/?retryWrites=true&w=majority"
DB_NAME="vlsiforge"
JWT_SECRET="GENERATE_WITH: python3 -c \"import secrets; print(secrets.token_hex(32))\""
CORS_ORIGINS="https://vlsiweb.com,https://www.vlsiweb.com"
```

Generate your JWT secret:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 2.5 Configure Nginx

```bash
# Copy the nginx config
sudo cp /tmp/vlsiforge-deploy/vlsiforge-nginx.conf /etc/nginx/sites-available/vlsiforge
sudo ln -s /etc/nginx/sites-available/vlsiforge /etc/nginx/sites-enabled/

# Remove the default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### 2.6 Point api.vlsiweb.com DNS to your server

Log into your DNS provider (Cloudflare, Namecheap, GoDaddy, etc.) and add:

| Type | Name | Value               | TTL |
|------|------|---------------------|-----|
| A    | api  | YOUR_SERVER_IP      | 300 |

Wait 5 minutes for DNS to propagate, then verify:
```bash
dig api.vlsiweb.com
# Should show your server IP
```

### 2.7 Get SSL certificate (HTTPS)

```bash
sudo certbot --nginx -d api.vlsiweb.com
# Follow prompts — choose option 2 (redirect HTTP to HTTPS)
```

Certbot auto-renews every 90 days. Verify it's scheduled:
```bash
sudo systemctl status certbot.timer
```

### 2.8 Seed the database

```bash
cd /opt/vlsiforge
source venv/bin/activate
python3 deploy/seed_atlas.py
deactivate
```

This creates:
- Admin user: `admin@vlsiweb.com` / `admin123` ← **change this password after first login**
- 3 sample problems to get started

### 2.9 Start the backend

```bash
sudo systemctl start vlsiforge
sudo systemctl status vlsiforge
```

You should see `Active: active (running)`.

Test it:
```bash
curl https://api.vlsiweb.com/health
# Expected: {"status":"ok","timestamp":"..."}
```

---

## PART 3 — Frontend on Vercel (10 minutes)

### 3.1 Push to GitHub

If your code isn't on GitHub yet:
```bash
cd /path/to/VLSI_Forge/frontend
git init
git remote add origin https://github.com/YOUR_USERNAME/vlsiforge-frontend.git
git add .
git commit -m "Initial commit"
git push -u origin main
```

### 3.2 Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repository
3. **Framework Preset**: Create React App
4. **Root Directory**: `frontend` (if your repo has both frontend + backend)
5. **Build Command**: `yarn build`
6. **Output Directory**: `build`

### 3.3 Set environment variables in Vercel

Go to your project → **Settings** → **Environment Variables** → add:

| Key | Value |
|-----|-------|
| `REACT_APP_BACKEND_URL` | `https://api.vlsiweb.com` |
| `ENABLE_HEALTH_CHECK` | `false` |
| `WDS_SOCKET_PORT` | `443` |

### 3.4 Copy the vercel.json

Place `deploy/vercel.json` into your `frontend/` directory:
```bash
cp deploy/vercel.json frontend/vercel.json
```
Commit and push — Vercel will redeploy automatically.

### 3.5 Point vlsiweb.com to Vercel

In your DNS provider, add these records:

| Type  | Name | Value                      | TTL |
|-------|------|----------------------------|-----|
| A     | @    | 76.76.21.21                | 300 |
| CNAME | www  | cname.vercel-dns.com       | 300 |

Then in Vercel → **Settings** → **Domains** → add `vlsiweb.com` and `www.vlsiweb.com`.

Vercel handles SSL automatically.

---

## PART 4 — Update frontend API call (1 minute)

Make sure your React app's API calls point to `REACT_APP_BACKEND_URL`. Open `frontend/src/` and search for any hardcoded Emergent URLs:

```bash
grep -r "emergentagent" frontend/src/
```

Replace any found with:
```javascript
const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
```

---

## PART 5 — Remove Emergent dependencies

### 5.1 Google OAuth (replace Emergent auth)

In `backend/server.py`, the `/auth/google/session` endpoint calls `demobackend.emergentagent.com`. Replace it with your own Google OAuth flow:

1. Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** → **Credentials**
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Authorized redirect URIs: `https://api.vlsiweb.com/api/auth/google/callback`
4. Use `google-auth-oauthlib` library to handle the flow

Or simply disable Google OAuth and use email/password only — it's already fully implemented and works without Emergent.

### 5.2 Remove Emergent craco plugins

The `frontend/` has Emergent-specific craco plugins. For production, simplify `craco.config.js`:

```javascript
// craco.config.js — simplified for production
const path = require("path");

module.exports = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
};
```

---

## Quick Reference — Useful Commands

```bash
# View backend logs (live)
sudo journalctl -u vlsiforge -f

# Restart backend after code changes
sudo systemctl restart vlsiforge

# Check nginx errors
sudo tail -f /var/log/nginx/vlsiforge-error.log

# Test API health
curl https://api.vlsiweb.com/health

# Reload nginx config without downtime
sudo nginx -t && sudo systemctl reload nginx

# Check SSL expiry
sudo certbot certificates

# Force SSL renewal
sudo certbot renew --dry-run
```

---

## Architecture Summary

```
User Browser
    │
    ├── GET vlsiweb.com         → Vercel CDN → React app (built from frontend/)
    │
    └── POST/GET api.vlsiweb.com/api/*
            │
            ▼
        Your Linux Server (Ubuntu 22.04)
            │
            ├── Nginx (port 443/80)
            │     ├── SSL termination
            │     ├── CORS headers
            │     └── Rate limiting
            │
            └── FastAPI + uvicorn (127.0.0.1:8001)
                  ├── Auth (JWT + bcrypt)
                  ├── Problem management
                  ├── Code submission
                  │     ├── Security scan
                  │     ├── iverilog compile
                  │     ├── vvp simulate
                  │     └── verilator lint
                  └── MongoDB Atlas (cloud)
```

---

## Estimated Cost

| Service | Plan | Cost |
|---------|------|------|
| VPS (e.g. DigitalOcean, Hetzner) | 2 vCPU / 2GB RAM | ~$6–12/month |
| MongoDB Atlas | M0 Free | $0 |
| Vercel | Hobby | $0 |
| Domain (vlsiweb.com) | Annual renewal | ~$10–15/year |
| SSL (Let's Encrypt) | Auto | $0 |
| **Total** | | **~$6–12/month** |
