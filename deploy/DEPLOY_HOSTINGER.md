# VLSI Forge — Deployment Guide
## Hostinger Web Hosting + Railway + Vercel

**Final architecture:**
```
vlsiweb.com        ──DNS from Hostinger──▶  Vercel  (React app, free)
api.vlsiweb.com    ──DNS from Hostinger──▶  Railway (FastAPI + iverilog, free tier)
                                                 ↓
                                          MongoDB Atlas (free 512MB)
```

**Why not Hostinger for the backend?**
Hostinger shared/web hosting is PHP-based. It cannot install system binaries like `iverilog`
or run persistent Python processes. Your domain stays on Hostinger — we just point the DNS
to Railway and Vercel.

---

## PART 1 — MongoDB Atlas (10 minutes)

### 1.1 Create a free cluster

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) → Sign up
2. **Create** → Choose **M0 FREE** → pick a region → **Create**
3. Cluster name: `vlsiforge`

### 1.2 Create a database user

1. **Database Access** → **Add New Database User**
2. Username: `vlsiforge_user` / Password: generate a strong one → **save it**
3. Built-in role: **Read and write to any database** → **Add User**

### 1.3 Allow all IPs (for Railway — IPs change dynamically)

1. **Network Access** → **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`)
2. This is fine because your MongoDB user password protects the database

### 1.4 Get your connection string

1. **Clusters** → **Connect** → **Drivers** → Python → copy the string
2. It looks like: `mongodb+srv://vlsiforge_user:PASSWORD@cluster0.abc12.mongodb.net/`
3. Save this — you'll need it in Part 2

---

## PART 2 — Backend on Railway (15 minutes)

### 2.1 Push your code to GitHub

If not already on GitHub:
```bash
# From the root of your VLSI_Forge project
git init
git add .
git commit -m "Initial commit — VLSI Forge"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/vlsiforge.git
git push -u origin main
```

Make sure these files are in the repo (already created for you):
- `backend/Dockerfile`
- `backend/.dockerignore`
- `railway.toml` (in project root)

### 2.2 Create a Railway account

1. Go to [railway.app](https://railway.app) → **Login with GitHub**
2. Railway gives you **$5 free credit/month** — enough to run a small FastAPI app

### 2.3 Create a new project

1. Railway Dashboard → **New Project** → **Deploy from GitHub repo**
2. Select your `vlsiforge` repository
3. Railway detects `railway.toml` and uses the `backend/Dockerfile` automatically

### 2.4 Set environment variables

In Railway → your service → **Variables** tab → add these one by one:

| Variable | Value |
|----------|-------|
| `MONGO_URL` | `mongodb+srv://vlsiforge_user:PASSWORD@cluster0.XXXXX.mongodb.net/?retryWrites=true&w=majority` |
| `DB_NAME` | `vlsiforge` |
| `JWT_SECRET` | Generate: `python3 -c "import secrets; print(secrets.token_hex(32))"` |
| `CORS_ORIGINS` | `https://vlsiweb.com,https://www.vlsiweb.com` |

Click **Deploy** — Railway builds the Docker image (takes ~3 minutes first time).

### 2.5 Get your Railway URL

After deploy succeeds, Railway gives you a URL like:
`vlsiforge-production.up.railway.app`

Test it:
```
https://vlsiforge-production.up.railway.app/health
```
Should return: `{"status":"ok","timestamp":"..."}`

### 2.6 Add your custom domain on Railway

1. Railway → your service → **Settings** → **Networking** → **Custom Domain**
2. Add: `api.vlsiweb.com`
3. Railway shows you a CNAME record to add — **copy it** (looks like `vlsiforge-xxxx.up.railway.app`)

---

## PART 3 — Frontend on Vercel (10 minutes)

### 3.1 Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub `vlsiforge` repo
3. Settings:
   - **Root Directory**: `frontend`
   - **Framework**: Create React App
   - **Build Command**: `yarn build`
   - **Output Directory**: `build`

### 3.2 Set environment variables in Vercel

Project → **Settings** → **Environment Variables**:

| Key | Value |
|-----|-------|
| `REACT_APP_BACKEND_URL` | `https://api.vlsiweb.com` |
| `ENABLE_HEALTH_CHECK` | `false` |

### 3.3 Add your domain to Vercel

1. Vercel → your project → **Settings** → **Domains**
2. Add: `vlsiweb.com`
3. Also add: `www.vlsiweb.com`
4. Vercel shows you the DNS records to add — **copy them**

---

## PART 4 — DNS in Hostinger (5 minutes)

This is where your Hostinger account comes in — just for DNS.

### 4.1 Open Hostinger DNS Manager

1. Log in to [hpanel.hostinger.com](https://hpanel.hostinger.com)
2. **Domains** → click `vlsiweb.com` → **DNS / Nameservers** → **DNS Records**

### 4.2 Add records for the frontend (vlsiweb.com → Vercel)

Delete any existing A records for `@` and `www`, then add:

| Type  | Name | Points to / Value      | TTL  |
|-------|------|------------------------|------|
| A     | @    | `76.76.21.21`          | 3600 |
| CNAME | www  | `cname.vercel-dns.com` | 3600 |

> **Note:** Vercel's IP may vary — always check your Vercel dashboard under Domains for the latest recommended A record.

### 4.3 Add record for the backend (api.vlsiweb.com → Railway)

| Type  | Name | Points to / Value                           | TTL  |
|-------|------|---------------------------------------------|------|
| CNAME | api  | `vlsiforge-xxxx.up.railway.app` ← from Railway | 3600 |

Replace `vlsiforge-xxxx.up.railway.app` with the actual CNAME Railway gave you in step 2.6.

### 4.4 Wait for DNS propagation

DNS changes take 5–30 minutes. Check with:
```bash
# On your computer
nslookup vlsiweb.com
nslookup api.vlsiweb.com
```

Or use [dnschecker.org](https://dnschecker.org) to check from multiple locations.

---

## PART 5 — Seed the database (2 minutes)

Once the Railway backend is up and `api.vlsiweb.com` resolves, seed the database:

```bash
# On your local machine
cd /path/to/VLSI_Forge

# Set the real Atlas URL temporarily
export MONGO_URL="mongodb+srv://vlsiforge_user:PASSWORD@cluster0.XXXXX.mongodb.net/"
export DB_NAME="vlsiforge"

# Run the seeder
python3 deploy/seed_atlas.py
```

This creates:
- Admin: `admin@vlsiweb.com` / `admin123` ← **change this after first login**
- 3 sample problems to start

---

## PART 6 — Final checks

```bash
# 1. Backend health
curl https://api.vlsiweb.com/health
# → {"status":"ok","timestamp":"..."}

# 2. Frontend loads
open https://vlsiweb.com
# → VLSI Forge landing page

# 3. Login works
# Go to vlsiweb.com → Login → admin@vlsiweb.com / admin123

# 4. Simulation works
# Browse problems → pick Half Adder → Submit the starter code → see results
```

---

## Ongoing costs

| Service | Plan | Cost |
|---------|------|------|
| Hostinger | Your existing plan (domain only) | already paying |
| Railway | Hobby — $5 free credit/month | **$0** for small traffic |
| MongoDB Atlas | M0 Free | **$0** |
| Vercel | Hobby | **$0** |
| **Total extra** | | **$0/month** to start |

Railway's free $5/month credit covers roughly 500 hours of a small container. Once you exceed that (when you get real traffic), Railway charges ~$0.000463/GB RAM/min — typically $2–5/month for a small app.

---

## Troubleshooting

**Railway build fails:**
```
# View logs in Railway → your service → Deployments → click failing deploy → Logs
# Common issue: requirements.txt has a package that fails to install
# Fix: remove or pin the problematic package
```

**CORS error in browser console:**
```
# Check CORS_ORIGINS in Railway Variables
# Must exactly match: https://vlsiweb.com,https://www.vlsiweb.com
# No trailing slash, no spaces
```

**DNS not resolving:**
```
# Hostinger DNS changes sometimes take up to 2 hours
# Check: https://dnschecker.org → enter api.vlsiweb.com
# Make sure you saved the DNS records in Hostinger hPanel
```

**MongoDB connection refused:**
```
# Check Network Access in Atlas — should have 0.0.0.0/0 (allow all)
# Check MONGO_URL in Railway Variables — password must not have special chars
# URL-encode special chars: @ → %40, # → %23, $ → %24
```

**Simulation returns 500 error:**
```bash
# SSH into Railway shell (Railway → service → Deploy → Open Shell)
which iverilog    # should return a path
iverilog -V       # should show version
echo "module t; initial begin \$finish; end endmodule" > /tmp/t.v
iverilog -o /tmp/t /tmp/t.v && echo "iverilog works"
```
