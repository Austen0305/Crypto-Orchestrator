# 🚀 Complete Setup Guide

Complete setup instructions for CryptoOrchestrator.

## 📋 Prerequisites

- **Node.js**: v18+ (LTS recommended)
- **Python**: 3.10+ (3.11 recommended)
- **npm**: 9+ or **yarn**: 1.22+
- **Git**: Latest version

## 🔧 Installation

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd Crypto-Orchestrator
```

### 2. Install Dependencies

```bash
# Install Node.js dependencies
npm install --legacy-peer-deps

# Install Python dependencies
python -m pip install -r requirements.txt
```

### 3. Install Playwright Browsers (First Time Only)

```bash
npx playwright install
```

Or install specific browsers:

```bash
npx playwright install chromium firefox webkit
```

### 4. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and configure:

```env
# Application
NODE_ENV=development
VITE_APP_VERSION=1.0.0
VITE_API_URL=http://localhost:8000

# Sentry Error Tracking (Optional)
VITE_SENTRY_DSN=

# FastAPI Backend
DATABASE_URL=sqlite+aiosqlite:///./data/crypto_orchestrator.db
REDIS_URL=redis://localhost:6379/0

# JWT Authentication
JWT_SECRET_KEY=your-secret-key-change-in-production
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30

# Exchange API Keys (Optional - for live trading)
KRAKEN_API_KEY=
KRAKEN_API_SECRET=

# Feature Flags
ENABLE_2FA=false
ENABLE_NOTIFICATIONS=true
```

### 5. Set Up Database

```bash
# Run migrations
npm run migrate

# Or create database manually
python -m alembic upgrade head
```

### 6. Set Up Redis (Optional but Recommended)

#### Windows:
```powershell
# Download and install Redis from:
# https://github.com/microsoftarchive/redis/releases

# Or use Docker:
docker run -d -p 6379:6379 redis:alpine
```

#### macOS:
```bash
brew install redis
brew services start redis
```

#### Linux:
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

## 🚀 Running the Application

### Development Mode

#### Terminal 1: Backend (FastAPI)
```bash
npm run dev:fastapi
# Or
python -m uvicorn server_fastapi.main:app --reload --host 0.0.0.0 --port 8000
```

#### Terminal 2: Frontend (React)
```bash
npm run dev
# Or
npm run dev:web
```

#### Terminal 3: Electron (Desktop App - Optional)
```bash
npm run electron
```

The application will be available at:
- **Web**: http://localhost:5173
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## 🧪 Running Tests

### Frontend Tests
```bash
# Run all frontend tests
npm run test:frontend

# Run with UI
npm run test:frontend:ui

# Run with coverage
npm run test:frontend:coverage

# Run in watch mode
npm run test:frontend -- --watch
```

### E2E Tests
```bash
# Install browsers (first time only)
npx playwright install

# Run all E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Run specific test
npx playwright test tests/e2e/auth.spec.ts

# Run in headed mode (see browser)
npx playwright test --headed
```

### Backend Tests
```bash
# Run all backend tests
npm test

# Run with coverage
pytest server_fastapi/tests/ -v --cov=server_fastapi --cov-report=html

# Run specific test file
pytest server_fastapi/tests/test_auth.py -v
```

## 🔍 Configuration

### Sentry (Optional)

1. Create account at [sentry.io](https://sentry.io)
2. Create a new project (React)
3. Copy your DSN
4. Add to `.env`:
   ```env
   VITE_SENTRY_DSN=your-dsn-here
   ```

### Exchange API Keys (Optional)

To enable live trading:

1. Create API keys on your exchange (e.g., Kraken)
2. **Important**: Only enable trading permissions, not withdrawal
3. Add to `.env`:
   ```env
   KRAKEN_API_KEY=your-api-key
   KRAKEN_API_SECRET=your-api-secret
   ```

## 🏗️ Building for Production

### Frontend
```bash
npm run build
```

### Desktop App (Electron)
```bash
npm run build:electron
```

### Backend
```bash
# Install production dependencies
pip install -r requirements.txt

# Run migrations
python -m alembic upgrade head

# Start production server
uvicorn server_fastapi.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## 📦 Docker Deployment (Optional)

### Build Backend
```bash
docker build -t crypto-orchestrator-backend -f Dockerfile.backend .
```

### Run Backend
```bash
docker run -d -p 8000:8000 --env-file .env crypto-orchestrator-backend
```

## 🔐 Security Checklist

- [ ] Change `JWT_SECRET_KEY` in production
- [ ] Use strong passwords for database
- [ ] Enable HTTPS in production
- [ ] Set up rate limiting
- [ ] Configure CORS properly
- [ ] Enable 2FA for admin accounts
- [ ] Set up Sentry for error tracking
- [ ] Regular security audits

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Find and kill process on port 8000
# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:8000 | xargs kill
```

### Database Errors
```bash
# Reset database (CAUTION: Deletes all data)
rm data/crypto_orchestrator.db
npm run migrate
```

### Redis Connection Issues
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# Start Redis
# Windows: Start Redis service
# macOS: brew services start redis
# Linux: sudo systemctl start redis
```

### Playwright Browser Issues
```bash
# Reinstall browsers
npx playwright install --force
```

### Module Not Found Errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

## 📚 Additional Resources

- [README.md](README.md) - Project overview
- [README_TESTING.md](README_TESTING.md) - Testing guide
- [docs/USER_GUIDE.md](docs/USER_GUIDE.md) - User guide
- [docs/API_REFERENCE.md](docs/API_REFERENCE.md) - API documentation

## ✅ Verification

After setup, verify everything works:

1. **Backend Health Check**
   ```bash
   npm run health
   # Or visit: http://localhost:8000/health
   ```

2. **Frontend Compiles**
   ```bash
   npm run build
   ```

3. **Tests Pass**
   ```bash
   npm run test:frontend
   npm test
   npm run test:e2e
   ```

## 🎉 You're All Set!

Your CryptoOrchestrator is now ready to use!

For questions or issues, check:
- [Troubleshooting](#-troubleshooting)
- [Documentation](docs/)
- [GitHub Issues](https://github.com/your-repo/issues)

Happy Trading! 🚀

