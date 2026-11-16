# Production Deployment Guide: Sharada School Portal
**Domain & Subpath:** `https://sharada-school.co.in/web`  
**API Endpoint:** `https://sharada-school.co.in/web/api`  
**Database:** PostgreSQL on Supabase (`clexioftxncydfkvsrwz` in `ap-southeast-1` Singapore)

---

## 🏗️ Architecture Overview

- **Frontend:** React + Vite, configured with `base: '/web/'`. Built static assets are output to `Web/client/dist`.
- **Backend:** Node.js Express server on port `4000`. Serves both `/web/api` and the static React files on `/web`.
- **Web Server / Reverse Proxy:** Nginx routes requests from `sharada-school.co.in/web` to the local Node process (`http://127.0.0.1:4000`).
- **Process Manager:** PM2 keeps the Node.js application running, auto-restarts on crash, and starts on system boot.

---

## 🚀 Option A: Linux VPS Deployment (Ubuntu / Debian)

### 1. Prerequisites on the Server
Connect to your server via SSH:
```bash
ssh user@your-server-ip
```
Install Node.js (v18 or v20), Nginx, Git, and PM2:
```bash
sudo apt update
sudo apt install -y curl git nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

---

### 2. Copy Codebase to the Server
Clone or upload the `Web` directory to `/var/www/sharada-school/Web`:
```bash
sudo mkdir -p /var/www/sharada-school
sudo chown -R $USER:$USER /var/www/sharada-school
cd /var/www/sharada-school

# If using Git:
# git clone <YOUR_REPO_URL> .
```

---

### 3. Configure Server Environment (.env)
Create or edit `/var/www/sharada-school/Web/server/.env`:
```bash
nano /var/www/sharada-school/Web/server/.env
```
Ensure it contains:
```env
PORT=4000
DATABASE_URL="postgresql://postgres.clexioftxncydfkvsrwz:Sharada%402026@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"

# SMTP Email Settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=acarya.akshaya@gmail.com
SMTP_PASS=fmoazwyoujcqqxau
SMTP_FROM=noreply@sharada.edu

# OTP Secret
OTP_SECRET=sharada-school-otp
```

---

### 4. Build and Start Application
Run the automated deployment script:
```bash
cd /var/www/sharada-school/Web
chmod +x deploy.sh
./deploy.sh
```
Or run the manual steps:
```bash
cd /var/www/sharada-school/Web

# Install server dependencies
cd server && npm install --omit=dev && cd ..

# Build React client bundle
cd client && npm install && npm run build && cd ..

# Start backend using PM2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Verify PM2 status:
```bash
pm2 status
pm2 logs sharada-school-portal
```

---

### 5. Configure Nginx Reverse Proxy
Copy the provided Nginx configuration to Nginx sites:
```bash
sudo cp /var/www/sharada-school/Web/nginx.conf /etc/nginx/sites-available/sharada-school.co.in
sudo ln -s /etc/nginx/sites-available/sharada-school.co.in /etc/nginx/sites-enabled/
```
Test and reload Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

### 6. Set Up Free SSL with Let's Encrypt (Certbot)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d sharada-school.co.in -d www.sharada-school.co.in
```
Certbot will automatically update the Nginx configuration to redirect HTTP to HTTPS.

---

## 📦 Option B: cPanel / Shared Hosting Deployment

If you are using cPanel with "Setup Node.js App":

1. **Build React Client locally:**
   ```bash
   cd Web/client
   npm install
   npm run build
   ```
2. **Upload Files:**
   Upload `Web/server` and the compiled `Web/client/dist` directory into your cPanel account (e.g. `public_html/web-app` or a root folder).
3. **Open cPanel > Setup Node.js App:**
   - **Node.js version:** Select `20.x` or `18.x`
   - **Application mode:** `Production`
   - **Application root:** path to your server folder (e.g. `web-app/server`)
   - **Application URL:** select `sharada-school.co.in` and subfolder `web`
   - **Application startup file:** `index.js`
4. **Environment Variables:**
   Add `DATABASE_URL`, `PORT`, and SMTP credentials in the cPanel Node.js interface.
5. **Run NPM Install** via the cPanel button.
6. Click **Restart**.

---

## ✅ Verification Checklist

1. **Database Health Check:**
   Visit: `https://sharada-school.co.in/web/api/health`  
   Should show: `✅ Database Connected Successfully!`
2. **Web Portal UI:**
   Visit: `https://sharada-school.co.in/web`  
   Should display the Sharada School login interface with the school logo and background image.
3. **Admin Sign-in:**
   - Email: `admin@sharada.edu`
   - Password: `admin123`
4. **Browser Console:**
   Press `F12` > Network. Verify all requests hit `/web/api/...` and `/web/assets/...` without 404 errors.
