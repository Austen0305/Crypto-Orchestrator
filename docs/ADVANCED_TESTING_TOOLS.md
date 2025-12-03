# 🧪 Advanced Testing Tools - Quick Reference

## New Features (Phase 2 Implementation)

This document provides quick reference for the newly implemented advanced testing features.

---

## 📊 Test Coverage Reporter

**Purpose:** Generate coverage reports with badges, trends, and threshold checking.

### Commands

```bash
# Run tests and generate full coverage report with badge and trends
npm run test:coverage

# Generate badge only (from existing coverage data)
npm run test:coverage:badge

# Analyze coverage trends
npm run test:coverage:trends

# Run with custom threshold
python scripts/coverage_reporter.py --run-tests --threshold 85.0

# Fail if coverage below threshold
python scripts/coverage_reporter.py --run-tests --fail-under 80.0
```

### Features

- ✅ Automatic HTML, JSON, and terminal reports
- ✅ SVG badge generation (color-coded by coverage %)
- ✅ Coverage trend analysis (last 50 runs)
- ✅ Threshold checking with exit codes
- ✅ Branch coverage tracking
- ✅ History persistence

### Output Files

- `htmlcov/index.html` - Interactive HTML report
- `coverage.json` - Machine-readable coverage data
- `coverage_badge.svg` - SVG badge for README
- `coverage_history.json` - Historical coverage data

---

## ⚡ Performance Monitor

**Purpose:** Track API performance and detect regressions.

### Commands

```bash
# Set baseline (run on main branch)
npm run monitor:performance:baseline

# Monitor and compare with baseline
npm run monitor:performance

# Custom threshold (1.3 = allow 30% slower)
python scripts/monitor_performance.py --compare --threshold 1.3

# Detailed report
python scripts/monitor_performance.py --report
```

### Features

- ✅ Multi-endpoint performance testing
- ✅ p50, p95, p99 latency metrics
- ✅ Baseline comparison
- ✅ Regression detection with thresholds
- ✅ Historical tracking
- ✅ Success rate monitoring

### Monitored Endpoints

- `/health` - Health check
- `/api/health` - API health
- `/api/bots` - Bot management
- `/api/integrations/status` - Integration status
- `/api/analytics/summary` - Analytics

### Output Files

- `performance_baseline.json` - Reference baseline
- `performance_history.json` - Historical metrics (last 100 runs)

### Example Output

```
📊 Performance Regression Analysis
═══════════════════════════════════════════════════════════
/api/bots:
   p95: 142ms (baseline: 125ms)
   Change: +13.6%
   ✓ OK: Within acceptable range

Summary:
   Regressions: 0
   Improvements: 2
   Threshold: 20% slower
═══════════════════════════════════════════════════════════
✅ No performance regressions detected
```

---

## 🎲 Test Data Generator

**Purpose:** Generate realistic test data for development and testing.

### Commands

```bash
# Generate default dataset (10 users, 20 bots, 100 trades)
npm run generate:test-data

# Custom dataset
python scripts/generate_test_data.py --users 50 --bots 100 --trades 500

# Output to specific file
python scripts/generate_test_data.py --output my_test_data.json

# Custom random seed for reproducibility
python scripts/generate_test_data.py --seed 123
```

### Generated Data

**Users:**
- Realistic names and emails
- USD, BTC, ETH balances
- Account metadata
- Email verification status
- 2FA status

**Bots:**
- Various strategies (MA crossover, RSI, Bollinger Bands, etc.)
- Multiple trading pairs
- Performance metrics (win rate, P&L)
- Different statuses (running, stopped, paused)

**Trades:**
- Buy/sell orders
- Realistic prices and amounts
- Fees calculation
- Execution timestamps
- Status tracking

**Market Data:**
- OHLCV (Open, High, Low, Close, Volume)
- Hourly data for 5 trading pairs
- 7 days of historical data
- Realistic price movements (random walk)

**Stripe Test Scenarios:**
- Successful payment (4242 4242 4242 4242)
- Declined payment (4000 0000 0000 0002)
- 3D Secure flow (4000 0025 0000 3155)
- Insufficient funds (4000 0000 0000 9995)

### Output File Structure

```json
{
  "metadata": {
    "generated_at": "2024-12-03T18:00:00",
    "seed": 42,
    "counts": {
      "users": 10,
      "bots": 20,
      "trades": 100,
      "market_data_pairs": 5
    }
  },
  "users": [...],
  "bots": [...],
  "trades": [...],
  "market_data": {...},
  "stripe_test_scenarios": {...}
}
```

### Usage in Tests

```python
import json

# Load test data
with open('test_data.json', 'r') as f:
    data = json.load(f)

# Use in tests
test_user = data['users'][0]
test_bot = data['bots'][0]
test_trade = data['trades'][0]
```

---

## 🔥 Chaos Engineering Tests

**Purpose:** Test system resilience under failure conditions.

### Commands

```bash
# Run all chaos tests
npm run test:chaos

# Run directly
python scripts/test_chaos.py
```

### Test Scenarios

1. **Connection Timeout** - Tests timeout handling
2. **Malformed Requests** - Tests input validation
3. **Rapid Request Flood** - Tests rate limiting
4. **Large Payloads** - Tests payload size limits
5. **Concurrent Operations** - Tests thread safety
6. **Invalid Endpoints** - Tests 404 handling
7. **Database Resilience** - Tests DB failure handling

### Example Output

```
🔥 Chaos Engineering Test Summary
═══════════════════════════════════════════════════════════
Total Tests: 7
Passed: 7 (100.0%)
Failed: 0 (0.0%)
═══════════════════════════════════════════════════════════
✅ All chaos tests passed! System is resilient.
```

---

## 🎭 Interactive Testing CLI

**Purpose:** Wizard-style interface for guided testing.

### Command

```bash
npm run test:interactive
```

### Features

- Interactive menu system
- Phase-by-phase testing guidance
- Server status checking
- Documentation viewer
- Command execution
- Progress tracking

### Menu Options

1. Phase 1: Infrastructure Validation
2. Phase 2: Security Testing
3. Phase 3: Wallet & Payments (Manual)
4. Phase 4: Trading & Bots
5. Phase 9: E2E Tests
6. Phase 10: Load & Performance
7. Chaos Engineering Tests
8. Run All Automated Tests
9. View Test Documentation
0. Exit

---

## 🔧 Integration with CI/CD

All tools are integrated into the GitHub Actions workflow:

### Automatic Execution

**On Pull Request:**
- ✅ Coverage report generated
- ✅ Performance regression check (vs baseline)
- ✅ Test reports uploaded as artifacts
- ✅ Results commented on PR

**On Main Branch:**
- ✅ Performance baseline updated
- ✅ Coverage history maintained
- ✅ Artifacts archived

**Daily Schedule:**
- ✅ All tests run at 2 AM UTC
- ✅ Health monitoring
- ✅ Trend analysis

### Artifacts Available

- `pre-deployment-report` - Comprehensive test results
- `coverage-report` - HTML report, badge, history
- `performance-report` - Baseline and history
- `load-test-results` - Performance metrics

---

## 📝 Best Practices

### Coverage

1. **Set realistic thresholds** - Start at current level, gradually increase
2. **Track trends** - Focus on direction, not absolute numbers
3. **Review untested code** - Use HTML report to find gaps
4. **Update baseline** - After major refactoring

### Performance

1. **Establish baseline early** - Run on stable main branch
2. **Test locally first** - Before pushing to CI
3. **Allow margin** - Use 1.2-1.3 threshold (20-30% slower)
4. **Investigate regressions** - Don't just raise threshold

### Test Data

1. **Use consistent seed** - For reproducible tests
2. **Generate appropriate size** - Don't overload tests
3. **Update scenarios** - Keep Stripe test cards current
4. **Version control** - Check in sample data

### Chaos Testing

1. **Run regularly** - Part of pre-deployment
2. **Test in staging first** - Not production!
3. **Analyze failures** - Each reveals weakness
4. **Improve resilience** - Fix root causes

---

## 🚀 Quick Start Workflow

```bash
# 1. Setup environment (one-time)
npm run setup:complete

# 2. Generate test data
npm run generate:test-data

# 3. Start server
npm run dev:fastapi

# 4. Run interactive testing (another terminal)
npm run test:interactive

# 5. Check coverage
npm run test:coverage

# 6. Monitor performance
npm run monitor:performance:baseline  # First time
npm run monitor:performance           # Subsequent runs

# 7. Run chaos tests
npm run test:chaos

# 8. Comprehensive validation
npm run test:pre-deploy
```

---

## 📚 Related Documentation

- `docs/TESTING_GUIDE.md` - Complete 11-phase testing guide
- `docs/TESTING_README.md` - Quick reference
- `docs/FUTURE_FEATURES.md` - Roadmap and planned features
- `docs/PRE_DEPLOYMENT_STATUS.md` - Implementation status

---

## 🆘 Troubleshooting

### Coverage Reporter

**Issue:** `No coverage data found`  
**Solution:** Run with `--run-tests` flag

**Issue:** `Module not found: pytest`  
**Solution:** `pip install pytest pytest-cov`

### Performance Monitor

**Issue:** `No baseline found`  
**Solution:** Run `npm run monitor:performance:baseline` first

**Issue:** `Connection refused`  
**Solution:** Ensure server is running on localhost:8000

### Test Data Generator

**Issue:** `Permission denied`  
**Solution:** `chmod +x scripts/generate_test_data.py`

### Interactive CLI

**Issue:** `Command not found`  
**Solution:** Use `python scripts/test_interactive.py` directly

---

**Last Updated:** December 3, 2024  
**Version:** 2.0  
**Status:** Production Ready ✅
