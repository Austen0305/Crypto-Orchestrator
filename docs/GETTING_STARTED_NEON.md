# Getting Started with CryptoOrchestrator - Neon Database Edition

This guide will help you get CryptoOrchestrator up and running with Neon PostgreSQL in under 10 minutes.

## 🎯 What You'll Need

- **Node.js** 18+ ([Download](https://nodejs.org))
- **Python** 3.12+ ([Download](https://www.python.org/downloads/))
- **A Neon account** (free, no credit card required - [Sign up](https://neon.tech))
- **Git** (to clone the repository)

## ⚡ Quick Setup (5 Steps)

### Step 1: Clone the Repository

```bash
git clone https://github.com/Austen0305/Crypto-Orchestrator.git
cd Crypto-Orchestrator
```

### Step 2: Install Dependencies

```bash
# Install Node.js dependencies
npm install --legacy-peer-deps

# Install Python dependencies
pip install -r requirements.txt
```

### Step 3: Set Up Neon Database

**Option A: Automatic Setup (Recommended)**

```bash
# This will guide you through the setup
npm run setup:neon
```

The script will:
1. Prompt for your Neon connection string
2. Validate the connection
3. Generate secure secrets
4. Create your `.env` file
5. Update Alembic configuration

**Option B: Manual Setup**

1. Create a Neon project at https://console.neon.tech
2. Copy your connection string
3. Run: `cp .env.example .env`
4. Edit `.env` and set:
   ```bash
   DATABASE_URL=postgresql+asyncpg://user:pass@endpoint/db?sslmode=require
   ```

### Step 4: Run Database Migrations

```bash
npm run migrate
```

This creates all the necessary tables in your Neon database.

### Step 5: Start the Application

```bash
# Terminal 1: Start the backend
npm run dev:fastapi

# Terminal 2 (in a new terminal): Start the frontend
npm run dev
```

🎉 **Done!** Open http://localhost:5173 in your browser.

---

## 🔍 Verify Your Setup

Run the validation script to ensure everything is configured correctly:

```bash
npm run setup:neon:validate
```

This will check:
- ✅ Database connection
- ✅ SSL configuration
- ✅ Database permissions
- ✅ Connection pooling status
- ✅ Existing tables

---

## 🎮 What You Get with Neon Free Tier

- **Storage**: 0.5 GB per project (20 projects max = 10 GB total)
- **Compute**: 300 hours/month of active compute time
- **Data Transfer**: 5 GB/month
- **Connections**: Up to 100 concurrent (with pooling)
- **Backups**: 7 days of point-in-time recovery
- **Branching**: Database branching like Git

**Perfect for:**
- Development and testing
- Side projects
- MVP and early-stage products
- Learning and experimentation

---

## 📝 Configuration Details

### Your `.env` File

After running the setup, your `.env` will contain:

```bash
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql+asyncpg://user:pass@endpoint/db?sslmode=require

# Security (auto-generated)
JWT_SECRET=your-secure-secret
JWT_REFRESH_SECRET=your-secure-refresh-secret
EXCHANGE_KEY_ENCRYPTION_KEY=your-encryption-key

# Connection Pool (optimized for Neon)
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=10
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=3600
```

### Neon Connection String Format

**Standard format:**
```
postgresql+asyncpg://user:password@ep-xyz-123.us-east-2.aws.neon.tech/neondb?sslmode=require
```

**Pooled format (recommended for production):**
```
postgresql+asyncpg://user:password@ep-xyz-123.us-east-2.aws.neon.tech-pooler/neondb?sslmode=require
```

Notice the `-pooler` suffix for connection pooling.

---

## 🚀 Next Steps

### 1. Generate Test Data
```bash
npm run generate:test-data
```

### 2. Run Tests
```bash
# Backend tests
npm test

# Frontend tests
npm run test:frontend

# All tests
npm run test:all
```

### 3. Explore the API
Open http://localhost:8000/docs for interactive API documentation.

### 4. Configure Optional Features

#### Redis Cache (Recommended)
1. Sign up for free Redis at [Upstash](https://upstash.com)
2. Copy your Redis URL
3. Add to `.env`:
   ```bash
   REDIS_URL=rediss://default:password@endpoint.upstash.io:6379
   ```

#### Stripe Payments (Optional)
1. Get test keys from [Stripe](https://stripe.com)
2. Add to `.env`:
   ```bash
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

#### Exchange API Keys (For Live Trading)
Add your exchange credentials:
```bash
KRAKEN_API_KEY=your_api_key
KRAKEN_SECRET_KEY=your_secret_key
BINANCE_API_KEY=your_api_key
BINANCE_SECRET_KEY=your_secret_key
```

---

## 📚 Additional Documentation

### Core Guides
- **[Neon Setup Guide](./docs/NEON_SETUP.md)** - Detailed Neon setup and troubleshooting
- **[Neon Quick Start](./docs/NEON_QUICK_START.md)** - 5-minute setup guide
- **[Free Stack Deployment](./docs/FREE_STACK_DEPLOYMENT.md)** - Deploy to production

### Development
- **[Architecture Guide](./docs/architecture.md)** - System architecture
- **[API Documentation](./docs/api.md)** - API reference
- **[Testing Guide](./docs/TESTING_README.md)** - Testing guidelines

### Features
- **[User Guide](./docs/USER_GUIDE.md)** - End-user documentation
- **[Wallet & Payments](./docs/WALLET_AND_REAL_MONEY_VALIDATION.md)** - Payment system
- **[Auth & Data Validation](./docs/AUTH_AND_DATA_VALIDATION.md)** - Authentication

---

## 🐛 Troubleshooting

### Backend Won't Start

**Error: "No module named 'fastapi'"**
```bash
# Reinstall Python dependencies
pip install -r requirements.txt
```

**Error: "Cannot connect to database"**
```bash
# Validate your Neon connection
npm run setup:neon:validate

# Check if DATABASE_URL is set
echo $DATABASE_URL  # Linux/Mac
echo %DATABASE_URL%  # Windows
```

### Frontend Won't Start

**Error: "Port 5173 is already in use"**
```bash
# Kill the process using port 5173
# Linux/Mac:
lsof -ti:5173 | xargs kill -9

# Windows:
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

**Error: "Cannot find module"**
```bash
# Reinstall Node.js dependencies
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Database Connection Issues

**"Connection timeout"**
- Neon databases sleep after inactivity (free tier)
- First connection may take 5-10 seconds
- This is normal behavior

**"SSL certificate verify failed"**
- Ensure `?sslmode=require` is in your DATABASE_URL
- Check that you copied the full connection string from Neon

**"Too many connections"**
- Use the pooled endpoint: add `-pooler` to your endpoint
- Reduce DB_POOL_SIZE in `.env`

### Migration Errors

**"Relation already exists"**
```bash
# The table was already created. This is usually safe to ignore.
# Or reset the database:
alembic downgrade base
alembic upgrade head
```

**"No such table"**
```bash
# Run migrations
npm run migrate
```

---

## 🎓 Learning Resources

### Tutorials
- [FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/)
- [React Documentation](https://react.dev/)
- [Neon Documentation](https://neon.tech/docs)

### Videos
- [FastAPI Crash Course](https://www.youtube.com/results?search_query=fastapi+crash+course)
- [React Crash Course](https://www.youtube.com/results?search_query=react+crash+course)
- [PostgreSQL Tutorial](https://www.youtube.com/results?search_query=postgresql+tutorial)

### Community
- [Discord Community](#) (Coming soon)
- [GitHub Discussions](https://github.com/Austen0305/Crypto-Orchestrator/discussions)
- [Neon Discord](https://discord.gg/neon)

---

## 💡 Tips & Best Practices

### Development
1. **Use branches for features**: Create a new branch for each feature
2. **Run tests frequently**: Catch issues early with `npm test`
3. **Use the validation script**: Check setup with `npm run setup:neon:validate`
4. **Monitor database size**: Check usage in Neon console regularly

### Database
1. **Use pooled connections**: Add `-pooler` to endpoint in production
2. **Enable connection pooling**: Already configured in `.env`
3. **Use database branches**: Test migrations on dev branch first
4. **Monitor queries**: Use Neon's query insights in console

### Security
1. **Never commit `.env`**: Already in `.gitignore`
2. **Rotate secrets regularly**: Generate new secrets periodically
3. **Use environment variables**: Never hardcode credentials
4. **Enable 2FA**: On your Neon account and GitHub

---

## 🎯 Common Development Tasks

### Update Dependencies
```bash
# Node.js packages
npm update

# Python packages
pip install -r requirements.txt --upgrade
```

### Create a Database Migration
```bash
# After changing models
npm run migrate:create "description of changes"

# Apply the migration
npm run migrate
```

### Reset Database
```bash
# Rollback all migrations
alembic downgrade base

# Reapply all migrations
npm run migrate
```

### Run Specific Tests
```bash
# Backend test file
pytest server_fastapi/tests/test_bots.py -v

# Frontend test pattern
npm test -- --testNamePattern="Button"
```

### Check Code Quality
```bash
# Format Python code
npm run format:py

# Lint Python code
npm run lint:py

# Type check TypeScript
npm run check
```

---

## 📊 Project Structure

```
CryptoOrchestrator/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom hooks
│   │   └── lib/           # Utilities
│   └── public/            # Static assets
├── server_fastapi/        # FastAPI backend
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   ├── models/            # Database models
│   └── main.py            # App entry point
├── scripts/               # Utility scripts
│   ├── setup_neon.py      # Neon setup script
│   └── validate_neon_connection.py
├── docs/                  # Documentation
│   ├── NEON_SETUP.md      # Neon guide
│   └── NEON_QUICK_START.md
└── .env                   # Environment config (don't commit!)
```

---

## ✅ Setup Checklist

Use this checklist to ensure everything is configured:

- [ ] Node.js 18+ installed
- [ ] Python 3.12+ installed
- [ ] Repository cloned
- [ ] Dependencies installed (npm + pip)
- [ ] Neon account created
- [ ] Neon project created
- [ ] Setup script run successfully
- [ ] `.env` file created and configured
- [ ] Database migrations applied
- [ ] Backend starts without errors (port 8000)
- [ ] Frontend starts without errors (port 5173)
- [ ] Can access http://localhost:5173
- [ ] Can access http://localhost:8000/docs
- [ ] Connection validated with validation script

---

## 🎉 Success!

You're all set! You now have a fully functional CryptoOrchestrator development environment powered by Neon PostgreSQL.

**What's Next?**
1. Explore the [API documentation](http://localhost:8000/docs)
2. Read the [User Guide](./docs/USER_GUIDE.md)
3. Deploy to production with [Free Stack Deployment](./docs/FREE_STACK_DEPLOYMENT.md)
4. Join the community (Discord link coming soon)

**Happy trading! 🚀📈**

---

## 🆘 Need Help?

- **Documentation**: Check [docs/NEON_SETUP.md](./docs/NEON_SETUP.md)
- **Validation**: Run `npm run setup:neon:validate`
- **Issues**: Open an issue on [GitHub](https://github.com/Austen0305/Crypto-Orchestrator/issues)
- **Neon Support**: Check [Neon docs](https://neon.tech/docs) or [Discord](https://discord.gg/neon)

---

**Built with ❤️ for the crypto trading community**
