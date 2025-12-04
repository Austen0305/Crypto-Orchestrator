# Observability & Monitoring Tools

**Last Updated:** December 3, 2024  
**Category:** Phase 2 Features - Observability & Monitoring  
**Status:** Production Ready

---

## Overview

This guide covers the observability and monitoring tools added in Phase 2 of the feature rollout. These tools provide continuous health monitoring, log analysis, and visual regression testing capabilities.

---

## 🏥 Health Monitoring

### Purpose

Continuously monitor application health endpoints and alert on failures. Tracks uptime, response times, and consecutive failures.

### Usage

**Basic Monitoring (Continuous):**
```bash
npm run monitor:health
```

This runs indefinitely until stopped (Ctrl+C). Checks every 60 seconds by default.

**Time-Limited Monitoring:**
```bash
npm run monitor:health:60s      # Monitor for 60 seconds
```

**Custom Configuration:**
```bash
python scripts/health_monitor.py \
  --url http://localhost:8000 \
  --interval 30 \
  --threshold 3 \
  --duration 300
```

### Parameters

- `--url`: Base URL to monitor (default: `http://localhost:8000`)
- `--interval`: Check interval in seconds (default: `60`)
- `--threshold`: Consecutive failures before alert (default: `3`)
- `--duration`: Run for N seconds (default: infinite)

### Features

✅ **Multiple Endpoint Monitoring**
- `/health` - Main health check
- `/api/integrations/health` - Integration service
- `/api/analytics/health` - Analytics service

✅ **Alert System**
- Triggers after N consecutive failures
- Console alerts with full details
- Historical tracking

✅ **Historical Data**
- Saves to `health_history.json`
- Keeps last 1000 checks
- Uptime percentage calculation

✅ **Summary Report**
- Total checks and uptime
- Per-endpoint statistics
- Average response times

### Output Example

```
🔍 Starting Health Monitor
Base URL: http://localhost:8000
Check Interval: 60s
Alert Threshold: 3 consecutive failures
--------------------------------------------------------------------------------

[2024-12-03T18:00:00] Overall Status: HEALTHY
  ✅ Health Check: healthy (45.23ms)
  ✅ Integrations Health: healthy (32.45ms)
  ✅ Analytics Health: healthy (28.12ms)

[2024-12-03T18:01:00] Overall Status: HEALTHY
  ✅ Health Check: healthy (42.11ms)
  ✅ Integrations Health: healthy (35.67ms)
  ❌ Analytics Health: unhealthy (1002.34ms)
     Error: Connection timeout

================================================================================
🚨 ALERT: Analytics Health is UNHEALTHY
Consecutive failures: 3
Endpoint: /api/analytics/health
Status Code: 0
Error: Connection timeout
Time: 2024-12-03T18:03:00
================================================================================
```

### Integration

**In CI/CD:**
```yaml
- name: Health check after deployment
  run: npm run monitor:health:60s
```

**In Production:**
```bash
# Run as background service
nohup npm run monitor:health > health_monitor.log 2>&1 &
```

---

## 📊 Log Aggregation & Analysis

### Purpose

Aggregate logs from multiple sources, analyze patterns, detect errors, and provide insights into application behavior.

### Usage

**Basic Analysis:**
```bash
npm run logs:analyze
```

Searches for logs in: `logs/`, `server_fastapi/logs/`, current directory.

**Custom Directories:**
```bash
python scripts/log_aggregator.py --dirs logs/ server_fastapi/logs/ custom_logs/
```

**Time-Filtered Analysis:**
```bash
python scripts/log_aggregator.py --hours 24    # Last 24 hours only
```

**Export to JSON:**
```bash
npm run logs:analyze:json
python scripts/log_aggregator.py --json report.json
```

### Features

✅ **Multi-Source Aggregation**
- Searches multiple directories
- Supports `.log` files
- Handles nested directories

✅ **Pattern Detection**
- Errors, warnings, info levels
- HTTP status codes
- API endpoints
- Timestamps

✅ **Statistics**
- Total lines and log levels
- Error pattern frequency
- Activity by hour
- Top endpoints

✅ **Output Formats**
- Formatted console report
- JSON export for tools
- Historical tracking

### Output Example

```
🔍 Finding log files...
Found 3 log file(s)
  Reading: logs/app.log
  Reading: server_fastapi/logs/uvicorn.log

================================================================================
LOG ANALYSIS REPORT
================================================================================
Generated: 2024-12-03 18:30:00
Total Log Lines: 15,234
Parsed Entries: 12,456

LOG LEVELS:
  INFO: 10,234 (82.2%)
  WARNING: 1,890 (15.2%)
  ERROR: 332 (2.7%)

⚠️  ERRORS DETECTED: 332

TOP ERROR PATTERNS:
  (45x) ERROR: Database connection timeout after 30s
  (32x) ERROR: Failed to fetch price data from Binance
  (28x) Exception: KeyError: 'user_id' in auth middleware
  (12x) ERROR: Redis connection refused

HTTP STATUS CODES:
  200: 8,234
  201: 1,456
  400: 234
  401: 89
  404: 123
  500: 45

TOP ENDPOINTS:
  GET /api/portfolio: 2,345
  POST /api/bots/start: 1,234
  GET /api/analytics: 1,123
  POST /api/trades: 987

ACTIVITY BY HOUR:
  2024-12-03 15:00: ████████████████████ (892)
  2024-12-03 16:00: ██████████████████████████ (1,234)
  2024-12-03 17:00: ███████████████████████ (1,089)
  2024-12-03 18:00: ████████████████ (678)
================================================================================
```

### Use Cases

**Daily Health Check:**
```bash
# Check logs from last 24 hours
python scripts/log_aggregator.py --hours 24 --json daily_report.json
```

**Incident Investigation:**
```bash
# Analyze logs during incident window
python scripts/log_aggregator.py --hours 2
```

**Error Tracking:**
- Identifies error spikes
- Shows error patterns
- Tracks HTTP failures

---

## 🎨 Visual Regression Testing

### Purpose

Detect unintended visual changes in the UI by comparing screenshots against a baseline.

### Usage

**Step 1: Capture Baseline**
```bash
npm run test:visual:baseline
```

This captures reference screenshots for all pages.

**Step 2: Compare (After Changes)**
```bash
npm run test:visual
```

Compares current UI with baseline and highlights differences.

**Debug Mode (Show Browser):**
```bash
npm run test:visual:headed
```

Runs tests with visible browser for debugging.

**Custom Configuration:**
```bash
python scripts/test_visual_regression.py \
  --url http://localhost:3000 \
  --mode compare \
  --headed
```

### Parameters

- `--url`: Base URL to test (default: `http://localhost:3000`)
- `--mode`: `baseline` or `compare`
- `--headed`: Show browser (default: headless)

### Features

✅ **Multiple Page Testing**
- Home page
- Login page
- Dashboard (requires auth)
- Bots, Analytics, Wallet pages

✅ **Screenshot Comparison**
- Full-page screenshots
- Pixel-by-pixel comparison
- Difference percentage calculation
- Red overlay highlighting changes

✅ **Difference Detection**
- Configurable threshold (default: 0.01%)
- Pass/fail status
- Visual diff images

✅ **Reporting**
- Console summary
- JSON report: `visual_regression/report.json`
- Screenshot storage

### Directory Structure

```
visual_regression/
├── baseline/           # Reference screenshots
│   ├── home.png
│   ├── login.png
│   └── ...
├── current/           # Latest screenshots
│   ├── home.png
│   ├── login.png
│   └── ...
├── diff/              # Difference images
│   ├── home_diff.png
│   ├── login_diff.png
│   └── ...
└── report.json       # Test results
```

### Output Example

```
🎨 Starting Visual Regression Testing
Mode: compare
Base URL: http://localhost:3000
--------------------------------------------------------------------------------
  Testing: home (/)
  Testing: login (/login)
  Skipping: dashboard (auth required)

================================================================================
VISUAL REGRESSION TEST SUMMARY
================================================================================
✅ home: PASS
   Difference: 0.0023%
✅ login: PASS
   Difference: 0.0018%
❌ bots: FAIL
   Difference: 2.3456%
⚠️ dashboard: NO_BASELINE
   No baseline screenshot found. Run in baseline mode first.

Tests Passed: 2
Tests Failed: 1
================================================================================

📄 Report saved: visual_regression/report.json
```

### Integration

**In CI/CD:**
```yaml
- name: Visual regression tests
  run: |
    npm run test:visual
  continue-on-error: true  # Allow failures for review
```

**Pre-Deployment Check:**
```bash
# Update baseline before major releases
npm run test:visual:baseline

# Verify no unintended changes
npm run test:visual
```

### Interpreting Results

**PASS:** Visual difference is below threshold (< 0.01%)
- Minor rendering variations
- Anti-aliasing differences
- Safe to proceed

**FAIL:** Visual difference exceeds threshold
- Review `diff/` images
- Verify if changes are intentional
- Update baseline if desired

**NO_BASELINE:** No reference screenshot
- Run baseline mode first
- Common for new pages

---

## 📈 Monitoring Best Practices

### Health Monitoring

**Development:**
```bash
# Quick health check
npm run monitor:health:60s
```

**Staging:**
```bash
# Longer monitoring period
python scripts/health_monitor.py --duration 300 --interval 30
```

**Production:**
```bash
# Continuous with aggressive thresholds
python scripts/health_monitor.py --threshold 2 --interval 30
```

### Log Analysis

**Daily Routine:**
```bash
# Morning health check
npm run logs:analyze:json
```

**Post-Deployment:**
```bash
# Check logs from deployment time
python scripts/log_aggregator.py --hours 1
```

**Incident Response:**
```bash
# Analyze recent logs
python scripts/log_aggregator.py --hours 2 --json incident_$(date +%s).json
```

### Visual Regression

**Feature Development:**
```bash
# Capture baseline for new feature
npm run test:visual:baseline

# After each change
npm run test:visual
```

**Pre-Release:**
```bash
# Final visual check
npm run test:visual
# Review any failures manually
```

---

## 🔗 Integration with Other Tools

### With CI/CD

All tools integrate seamlessly with the GitHub Actions workflow:

```yaml
# .github/workflows/testing-infrastructure.yml already includes:
- Health checks after deployment
- Log analysis on failures
- Visual regression in dedicated job
```

### With Coverage Reporter

```bash
# Combined quality check
npm run test:coverage && npm run monitor:health:60s && npm run logs:analyze
```

### With Performance Monitor

```bash
# Complete observability check
npm run monitor:performance && npm run monitor:health:60s
```

---

## 🐛 Troubleshooting

### Health Monitor

**Issue:** "Connection refused"
```bash
# Ensure backend is running
npm run dev:fastapi
```

**Issue:** False positives
```bash
# Increase threshold
python scripts/health_monitor.py --threshold 5
```

### Log Aggregator

**Issue:** No log files found
```bash
# Specify directories explicitly
python scripts/log_aggregator.py --dirs logs/ server_fastapi/logs/
```

**Issue:** Too many false positives
- Adjust regex patterns in script
- Filter by time with `--hours`

### Visual Regression

**Issue:** Playwright not installed
```bash
pip install playwright
playwright install chromium
```

**Issue:** All tests fail with high percentage
```bash
# Recapture baseline
npm run test:visual:baseline
```

**Issue:** Auth-required pages skipped
- Implement login flow in script
- Or test those pages manually

---

## 📚 Additional Resources

- **GitHub Actions Workflow:** `.github/workflows/testing-infrastructure.yml`
- **Future Features:** `docs/FUTURE_FEATURES.md`
- **Advanced Testing:** `docs/ADVANCED_TESTING_TOOLS.md`
- **Testing Guide:** `docs/TESTING_GUIDE.md`

---

## 🎯 Next Steps

With Phase 2 complete, you now have comprehensive observability. Next features to explore:

**Phase 3: Developer Experience**
- IDE integration
- API playground
- Enhanced documentation

**Phase 4: Advanced Testing**
- Contract testing
- Mutation testing
- Property-based testing

See `docs/FUTURE_FEATURES.md` for the complete roadmap.
