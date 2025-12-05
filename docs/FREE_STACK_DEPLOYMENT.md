# Free Stack Deployment Guide

This guide walks you through deploying Crypto-Orchestrator using entirely free services, with no credit card required.

## Overview

We'll use the following free services:
- **Backend**: Render.com or Koyeb (free tier)
- **Database**: Neon PostgreSQL (free tier)
- **Redis**: Upstash Redis (free tier)
- **Frontend**: Netlify or Cloudflare Pages (free tier)
- **CDN & Security**: Cloudflare (free tier)
- **Bot Protection**: hCaptcha (free tier)
- **Monitoring**: UptimeRobot (free tier)

## Prerequisites

- GitHub account
- Accounts for the services above (all free, no credit card required)

---

## Step 1: Set Up Neon Database (PostgreSQL)

### Create Database

1. Go to [Neon](https://neon.tech) and sign up (no credit card required)
2. Create a new project: "crypto-orchestrator"
3. Copy the connection string (it looks like: `postgresql://user:password@host/database`)
4. Save it for later use as `DATABASE_URL`

### Features
- **Free Tier**: 20 projects × 0.5 GB each
- Serverless PostgreSQL
- Automatic scaling
- Point-in-time recovery

### Environment Variable
```bash
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

---

## Step 2: Set Up Upstash Redis

### Create Redis Database

1. Go to [Upstash](https://upstash.com) and sign up (no credit card required)
2. Click "Create Database"
3. Choose a name: "crypto-orchestrator-cache"
4. Select a region close to your backend
5. Copy the Redis URL
6. Save it for later use as `REDIS_URL`

### Features
- **Free Tier**: 500K commands/month
- Serverless Redis
- Global edge locations
- Built-in data persistence

### Environment Variable
```bash
REDIS_URL=rediss://default:password@host:port
```

---

## Step 3: Deploy Backend to Render

### Option A: Using Blueprint (Recommended)

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "Blueprint"
3. Connect your GitHub repository
4. Render will detect the `render.yaml` file
5. Add environment variables:
   - `DATABASE_URL`: From Step 1
   - `REDIS_URL`: From Step 2
   - `JWT_SECRET`: Generate a random 64-character string
   - `JWT_REFRESH_SECRET`: Generate another random 64-character string
   - `EXCHANGE_KEY_ENCRYPTION_KEY`: Generate another random 64-character string
6. Click "Apply"

### Option B: Manual Setup

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: crypto-orchestrator-backend
   - **Region**: Oregon (US West)
   - **Branch**: main
   - **Root Directory**: leave empty
   - **Environment**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server_fastapi.main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Free
5. Add environment variables (same as Option A)
6. Click "Create Web Service"

### Features
- **Free Tier**: 750 hours/month
- Automatic HTTPS
- Auto-deploy on git push
- Health checks

### Copy Backend URL
After deployment, copy your backend URL:
```
https://crypto-orchestrator-backend.onrender.com
```

---

## Step 4: Deploy Backend to Koyeb (Alternative)

If you prefer Koyeb over Render:

1. Go to [Koyeb Dashboard](https://app.koyeb.com)
2. Click "Create Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: crypto-orchestrator-backend
   - **Region**: Frankfurt (or closest to you)
   - **Instance Type**: Nano (free)
   - **Build Command**: `pip install -r requirements.txt`
   - **Run Command**: `uvicorn server_fastapi.main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables (same as Render)
6. Click "Deploy"

### Features
- **Free Tier**: 2 services, 512MB RAM each
- Global deployment
- Auto-scaling
- Free SSL

---

## Step 5: Set Up Cloudflare

### Configure DNS and CDN

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Add your domain (or use a free subdomain service)
3. Update nameservers to Cloudflare's nameservers
4. Add DNS records:
   - **A record**: Point to your frontend (Netlify/Cloudflare Pages)
   - **CNAME**: api.yourdomain.com → your backend URL

### Enable Security Features

1. **SSL/TLS**:
   - Go to SSL/TLS → Overview
   - Set encryption mode to "Full (strict)"

2. **Firewall Rules**:
   - Go to Security → WAF
   - Enable managed rules
   - Add custom rules if needed

3. **DDoS Protection**:
   - Automatically enabled on all plans
   - Go to Security → DDoS for settings

4. **Bot Protection**:
   - Go to Security → Bots
   - Enable Bot Fight Mode (free)

5. **Caching**:
   - Go to Caching → Configuration
   - Set cache level to "Standard"
   - Add page rules for API endpoints

### Features
- **Free Tier**: Unlimited bandwidth
- DDoS protection
- Free SSL certificates
- Global CDN
- Web Application Firewall (WAF)

---

## Step 6: Set Up hCaptcha

### Create hCaptcha Site

1. Go to [hCaptcha](https://www.hcaptcha.com)
2. Sign up (no credit card required)
3. Add new site
4. Copy the Site Key and Secret Key

### Integration

Add to your environment variables:
```bash
HCAPTCHA_SITE_KEY=your_site_key
HCAPTCHA_SECRET_KEY=your_secret_key
```

### Features
- **Free Tier**: 100K requests/month
- Privacy-focused
- GDPR compliant
- Accessibility friendly

---

## Step 7: Deploy Frontend to Netlify

### Automatic Deployment

1. Go to [Netlify Dashboard](https://app.netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Connect your GitHub repository
4. Configure:
   - **Base directory**: leave empty
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Add environment variable:
   - `VITE_API_URL`: Your backend URL from Step 3
6. Click "Deploy site"

### Custom Domain (Optional)

1. Go to Domain Management
2. Add custom domain or use Netlify subdomain
3. Configure DNS (if using Cloudflare, already done)

### Features
- **Free Tier**: 100GB bandwidth/month
- Automatic deployments
- Branch previews
- Built-in CI/CD

---

## Step 8: Deploy Frontend to Cloudflare Pages (Alternative)

If you prefer Cloudflare Pages over Netlify:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Go to "Pages" → "Create a project"
3. Connect your GitHub repository
4. Configure:
   - **Project name**: crypto-orchestrator
   - **Production branch**: main
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Add environment variable:
   - `VITE_API_URL`: Your backend URL from Step 3
6. Click "Save and Deploy"

### Features
- **Free Tier**: Unlimited bandwidth
- Global edge network
- Automatic deployments
- Built-in analytics

---

## Step 9: Set Up UptimeRobot (Monitoring)

### Create Monitors

1. Go to [UptimeRobot](https://uptimerobot.com)
2. Sign up (no credit card required)
3. Add HTTP(s) monitor:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: Backend API
   - **URL**: https://your-backend-url.onrender.com/health
   - **Monitoring Interval**: 5 minutes
4. Add another monitor for frontend:
   - **URL**: https://your-frontend-url.netlify.app

### Status Page (Optional)

1. Create a public status page
2. Share with users: https://stats.uptimerobot.com/your-id

### Features
- **Free Tier**: 50 monitors
- 5-minute intervals
- Email/SMS alerts
- Public status pages

---

## Step 10: Run Database Migrations

### Connect to Backend

```bash
# SSH into Render (or use Render shell)
# Or run locally pointing to Neon database

# Export environment variables
export DATABASE_URL="your_neon_database_url"

# Run migrations
npm run migrate
```

---

## Step 11: Configure GitHub Actions

The repository already has GitHub Actions configured. Update secrets:

1. Go to GitHub repository → Settings → Secrets and variables → Actions
2. Add the following secrets:
   - `RENDER_API_KEY`: From Render dashboard → Account Settings → API Keys
   - `DATABASE_URL`: Your Neon database URL
   - `REDIS_URL`: Your Upstash Redis URL

GitHub Actions will automatically:
- Run tests on every push
- Deploy to Render on push to main
- Run security scans

---

## Step 12: Verify Deployment

### Check Backend

```bash
curl https://your-backend-url.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "database": "connected",
  "redis": "connected"
}
```

### Check Frontend

Visit: https://your-frontend-url.netlify.app

---

## Environment Variables Summary

### Backend (Render/Koyeb)

```bash
# Database
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# Redis
REDIS_URL=rediss://default:password@host:port

# Security
JWT_SECRET=your_random_64_char_string
JWT_REFRESH_SECRET=your_random_64_char_string
EXCHANGE_KEY_ENCRYPTION_KEY=your_random_64_char_string

# hCaptcha
HCAPTCHA_SITE_KEY=your_site_key
HCAPTCHA_SECRET_KEY=your_secret_key

# Application
NODE_ENV=production
PORT=8000
ENVIRONMENT=production
ENABLE_RATE_LIMITING=true
ENABLE_SECURITY_HEADERS=true

# CORS
CORS_ORIGINS=https://your-frontend-url.netlify.app,https://your-frontend-url.pages.dev
```

### Frontend (Netlify/Cloudflare Pages)

```bash
# API URL
VITE_API_URL=https://your-backend-url.onrender.com

# hCaptcha (for frontend integration)
VITE_HCAPTCHA_SITE_KEY=your_site_key
```

---

## Cost Breakdown

**Monthly Cost: $0** (within free tier limits)

### Service Limits

| Service | Free Tier | Limit |
|---------|-----------|-------|
| Render | 750 hours/month | Backend |
| Neon | 0.5 GB × 20 projects | Database |
| Upstash | 500K commands/month | Redis |
| Netlify | 100GB bandwidth/month | Frontend |
| Cloudflare | Unlimited bandwidth | CDN & Security |
| hCaptcha | 100K requests/month | Bot Protection |
| UptimeRobot | 50 monitors | Monitoring |
| GitHub Actions | 2,000 minutes/month | CI/CD |

### When You Might Need to Upgrade

- Backend uptime > 750 hours/month (always-on)
- Database storage > 0.5 GB
- Redis commands > 500K/month
- Frontend bandwidth > 100GB/month
- More than 100K bot protection requests/month

---

## Troubleshooting

### Backend Won't Start

1. Check logs in Render/Koyeb dashboard
2. Verify all environment variables are set
3. Ensure database migrations ran successfully
4. Check DATABASE_URL format (must include `?sslmode=require`)

### Frontend Can't Connect to Backend

1. Verify VITE_API_URL is correct
2. Check CORS settings in backend
3. Ensure Cloudflare isn't blocking requests
4. Check browser console for errors

### Database Connection Issues

1. Verify DATABASE_URL format
2. Check Neon dashboard for database status
3. Ensure SSL is enabled
4. Whitelist Render/Koyeb IPs if needed

### Redis Connection Issues

1. Verify REDIS_URL format
2. Check Upstash dashboard for usage
3. Ensure TLS is enabled (rediss://)
4. Check firewall settings

---

## Next Steps

1. Set up monitoring dashboards (see [Monitoring Guide](./MONITORING_SETUP.md))
2. Configure backup strategy (see [Backup Guide](./BACKUP_GUIDE.md))
3. Set up CI/CD enhancements (see [CI/CD Guide](./CICD_SETUP.md))
4. Implement advanced features from [Next-steps.md](./Next-steps.md)

---

## Support & Resources

- [Render Documentation](https://render.com/docs)
- [Neon Documentation](https://neon.tech/docs/introduction)
- [Upstash Documentation](https://upstash.com/docs)
- [Cloudflare Documentation](https://developers.cloudflare.com/docs)
- [Netlify Documentation](https://docs.netlify.com/)
- [hCaptcha Documentation](https://docs.hcaptcha.com/)

---

## Security Checklist

- [ ] All secrets stored as environment variables (never in code)
- [ ] HTTPS enabled on all endpoints
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] Bot protection active
- [ ] Firewall rules configured
- [ ] Regular security audits scheduled
- [ ] Database backups enabled
- [ ] Monitoring and alerts configured
