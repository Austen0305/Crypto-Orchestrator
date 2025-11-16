# ⚡ Quick Start Guide

Get CryptoOrchestrator running in 5 minutes!

## 🚀 Fast Setup

### 1. Install Dependencies (2 minutes)
```bash
npm install --legacy-peer-deps
python -m pip install -r requirements.txt
```

### 2. Install Playwright Browsers (1 minute)
```bash
npx playwright install chromium
```

### 3. Configure Environment (30 seconds)
```bash
cp .env.example .env
# Edit .env if needed (optional)
```

### 4. Start Backend (Terminal 1)
```bash
npm run dev:fastapi
```

### 5. Start Frontend (Terminal 2)
```bash
npm run dev
```

### 6. Open in Browser
Visit: **http://localhost:5173**

## ✅ Verify Setup

```bash
# Check backend health
npm run health

# Run tests (optional)
npm run test:frontend -- --run
```

## 🎉 Done!

You're ready to start trading! Check out:
- Dashboard: http://localhost:5173
- API Docs: http://localhost:8000/docs

For detailed setup, see [SETUP_GUIDE.md](SETUP_GUIDE.md)
