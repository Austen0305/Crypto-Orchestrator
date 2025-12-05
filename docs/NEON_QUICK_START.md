# Quick Neon Setup Guide

Set up your free Neon PostgreSQL database in 5 minutes.

## 🚀 Quick Setup

### 1. Get Neon Database (30 seconds)
1. Go to https://console.neon.tech
2. Sign up (no credit card required)
3. Click "Create a project"
4. Name it "crypto-orchestrator"
5. Copy the connection string

### 2. Run Setup Script (2 minutes)

**On Linux/Mac:**
```bash
./scripts/setup-neon.sh
```

**On Windows:**
```bash
python scripts/setup_neon.py
```

**Or manually:**
```bash
npm run setup:neon
```

The script will:
- ✅ Validate your connection string
- ✅ Test the database connection
- ✅ Generate secure secrets
- ✅ Create `.env` file with proper configuration

### 3. Run Migrations (1 minute)
```bash
npm run migrate
```

### 4. Start Development (1 minute)
```bash
npm run dev:fastapi  # Terminal 1
npm run dev          # Terminal 2
```

---

## 💡 Connection String Format

Your Neon connection string should look like:
```
postgresql://user:password@ep-xyz-123.us-east-2.aws.neon.tech/neondb?sslmode=require
```

**Important:**
- Always include `?sslmode=require`
- For web apps, use pooled endpoint: `ep-xyz-123.us-east-2.aws.neon.tech-pooler`

---

## 🔍 Verify Setup

Check if everything is working:
```bash
npm run setup:neon:validate
```

This will verify:
- ✅ Connection to Neon
- ✅ Database permissions
- ✅ SSL configuration
- ✅ Connection pooling status

---

## 🎯 Connection String in .env

The setup script creates your `.env` file with:

```bash
# For FastAPI (async driver)
DATABASE_URL=postgresql+asyncpg://user:pass@endpoint/db?sslmode=require

# Connection pool settings
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=10
DB_POOL_TIMEOUT=30
```

---

## 📊 Free Tier Limits

- **Storage**: 0.5 GB per project (20 projects = 10 GB total)
- **Compute**: 300 hours/month of active time
- **Data Transfer**: 5 GB/month
- **Connections**: 100 concurrent (with pooling)

Perfect for development and small production apps!

---

## 🐛 Troubleshooting

### Connection Timeout
- Neon databases sleep after inactivity (free tier)
- First connection may take 5-10 seconds to wake up
- This is normal behavior

### SSL Error
- Ensure `?sslmode=require` is in your connection string
- Check that you copied the full URL from Neon console

### Migration Errors
- Make sure you're using the correct driver format
- For Alembic: `postgresql://` (sync driver)
- For FastAPI: `postgresql+asyncpg://` (async driver)

### "Too Many Connections"
- Use the pooled endpoint: add `-pooler` to your endpoint
- Example: `ep-xyz-123.us-east-2.aws.neon.tech-pooler`

---

## 📖 Full Documentation

For detailed information, see:
- [Complete Neon Setup Guide](./NEON_SETUP.md) - Full setup with troubleshooting
- [Free Stack Deployment](./FREE_STACK_DEPLOYMENT.md) - Deploy to production
- [Database Architecture](./architecture.md) - Technical details

---

## ✅ Quick Checklist

- [ ] Neon account created
- [ ] Project created in Neon console
- [ ] Connection string copied
- [ ] Setup script run successfully
- [ ] `.env` file created
- [ ] Migrations run successfully
- [ ] Backend starts without errors
- [ ] Connection validated

---

## 🎉 You're Done!

Your Neon database is ready. Start building your crypto trading platform!

**Next Steps:**
1. Generate test data: `npm run generate:test-data`
2. Run tests: `npm test`
3. Deploy: See [FREE_STACK_DEPLOYMENT.md](./FREE_STACK_DEPLOYMENT.md)

---

**Need Help?**
- Check [Neon Documentation](https://neon.tech/docs)
- Run validation: `npm run setup:neon:validate`
- Review [troubleshooting guide](./NEON_SETUP.md#troubleshooting)
