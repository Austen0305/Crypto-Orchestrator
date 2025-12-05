# Scripts Directory

Utility scripts for CryptoOrchestrator development, deployment, and maintenance.

## 🗄️ Database Setup Scripts

### Neon PostgreSQL Setup

Setup and validate Neon database connection:

```bash
# Interactive setup (recommended)
python scripts/setup_neon.py
# or
./scripts/setup-neon.sh

# Validate connection
python scripts/validate_neon_connection.py
```

**Features:**
- Interactive connection string input
- Connection validation
- Automatic secret generation
- `.env` file creation
- Alembic configuration update

**Usage via npm:**
```bash
npm run setup:neon           # Run setup
npm run setup:neon:validate  # Validate connection
```

### Database Migrations

```bash
# Validate migrations
python scripts/validate_db_migrations.py

# Check database status
python scripts/check_db.py
```

## 🧪 Testing Scripts

### Infrastructure Testing
```bash
python scripts/test_infrastructure.py
npm run test:infrastructure
```

### Security Testing
```bash
python scripts/test_security.py
npm run test:security
```

### Pre-deployment Testing
```bash
python scripts/test_pre_deploy.py
npm run test:pre-deploy
```

### Load Testing
```bash
python scripts/load_test.py
npm run load:test
```

### Chaos Engineering
```bash
python scripts/test_chaos.py
npm run test:chaos
```

### Visual Regression Testing
```bash
python scripts/test_visual_regression.py --mode baseline  # Create baseline
python scripts/test_visual_regression.py --mode compare   # Compare changes
npm run test:visual
```

## 🛠️ Development Scripts

### Development Setup
```bash
python scripts/dev_setup.py
npm run setup:dev
```

### Generate Test Data
```bash
python scripts/generate_test_data.py
npm run generate:test-data
```

### Code Coverage
```bash
python scripts/coverage_reporter.py --run-tests --badge --trends
npm run test:coverage
```

### Code Quality Scan
```bash
python scripts/code_quality_scan.py
```

## 🚀 Deployment Scripts

### Free Hosting Setup
```bash
./scripts/setup-free-hosting.sh
# or
powershell -ExecutionPolicy Bypass -File scripts/setup-free-hosting.ps1
```

### Docker Deployment
```bash
./scripts/docker_deploy.sh
# or
powershell -ExecutionPolicy Bypass -File scripts/docker_deploy.ps1
```

### Render Services Setup
```bash
powershell -ExecutionPolicy Bypass -File scripts/setup-render-services.ps1
```

## 📊 Monitoring Scripts

### Health Monitoring
```bash
python scripts/health_monitor.py
python scripts/health_monitor.py --duration 60
npm run monitor:health
npm run monitor:health:60s
```

### Performance Monitoring
```bash
python scripts/monitor_performance.py --compare --report
python scripts/monitor_performance.py --set-baseline
npm run monitor:performance
npm run monitor:performance:baseline
```

### Log Analysis
```bash
python scripts/log_aggregator.py
python scripts/log_aggregator.py --json log_analysis.json
npm run logs:analyze
```

## 🔐 Security Scripts

### Secrets Management
```bash
python scripts/secrets_manager.py
```

### Rotate Secrets
```bash
powershell -ExecutionPolicy Bypass -File scripts/rotate_secrets.ps1
```

### JWT Authentication Validation
```bash
python scripts/validate_jwt_auth.py
npm run validate:jwt-auth
```

### Environment Variables Validation
```bash
python scripts/validate_env_vars.py
npm run validate:env
```

## 🔄 Background Services

### Redis Setup
```bash
python scripts/redis_setup.py

# Start Redis (Windows)
powershell -ExecutionPolicy Bypass -File scripts/start_redis.ps1
# or (Unix)
./scripts/start_redis.sh
```

### Celery Worker
```bash
# Start Celery worker (Windows)
powershell -ExecutionPolicy Bypass -File scripts/start_celery.ps1
# or (Unix)
./scripts/start_celery.sh
```

## 🏗️ Build Scripts

### Bundle Analysis
```bash
node scripts/bundle-analyze.js
npm run bundle:analyze
```

### Check Dependencies
```bash
node scripts/check-deps.js
npm run check:deps
```

### Python Runtime Bundling
```bash
./scripts/bundle_python_runtime.sh
# or
powershell -ExecutionPolicy Bypass -File scripts/bundle_python_runtime.ps1
```

## 📦 Release Scripts

### GitHub Release
```bash
python scripts/github_release.py
```

### API Client Generator
```bash
python scripts/api_client_generator.py
npm run generate:api-client
```

## 🧹 Maintenance Scripts

### Cleanup
```bash
powershell -ExecutionPolicy Bypass -File scripts/cleanup.ps1
npm run cleanup
```

### Update TODO Progress
```bash
node scripts/update_todo_progress.js
node scripts/update_todo_progress.js --count
npm run todo:update
npm run todo:count
```

## 🎯 Feature Testing

### Test Specific Features
```bash
node scripts/test_feature.js
# or
powershell -ExecutionPolicy Bypass -File scripts/test_feature.ps1
npm run test:feature
```

### Interactive Testing
```bash
python scripts/test_interactive.py
npm run test:interactive
```

## 📝 Script Conventions

### Python Scripts
- Use `#!/usr/bin/env python3` shebang
- Include docstrings
- Use argparse for CLI arguments
- Follow PEP 8 style guide
- Include error handling

### Shell Scripts
- Use `#!/bin/bash` shebang
- Include comments
- Use `set -e` for error handling
- Check for required commands
- Provide usage information

### PowerShell Scripts
- Include comment-based help
- Use approved verbs
- Validate parameters
- Handle errors with try/catch
- Use Write-Host for output

## 🆘 Getting Help

### For Neon Setup Issues
1. Run validation: `npm run setup:neon:validate`
2. Check [docs/NEON_SETUP.md](../docs/NEON_SETUP.md)
3. Review logs in the terminal output

### For Other Script Issues
1. Check script documentation in this file
2. Run script with `--help` if available
3. Check main [README.md](../README.md)
4. Review [docs/](../docs/) directory

## 🔧 Troubleshooting

### "Command not found"
- Ensure script is executable: `chmod +x scripts/script-name.sh`
- Use full path: `./scripts/script-name.sh`
- For Python: `python scripts/script-name.py`

### "Permission denied"
- Make script executable: `chmod +x scripts/script-name.sh`
- Or run with interpreter: `bash scripts/script-name.sh`

### "Module not found"
- Install Python dependencies: `pip install -r requirements.txt`
- Install Node dependencies: `npm install`

### PowerShell Execution Policy
```powershell
# Temporarily bypass
powershell -ExecutionPolicy Bypass -File scripts/script-name.ps1

# Or set policy (as admin)
Set-ExecutionPolicy RemoteSigned
```

## 📚 Additional Resources

- **Main Documentation**: [../docs/](../docs/)
- **Neon Setup**: [../docs/NEON_SETUP.md](../docs/NEON_SETUP.md)
- **Getting Started**: [../GETTING_STARTED.md](../GETTING_STARTED.md)
- **Testing Guide**: [../docs/TESTING_README.md](../docs/TESTING_README.md)

---

**Need to add a new script?**

1. Create the script in this directory
2. Make it executable (if shell script)
3. Add documentation to this README
4. Consider adding an npm script in `package.json`
5. Test thoroughly before committing
