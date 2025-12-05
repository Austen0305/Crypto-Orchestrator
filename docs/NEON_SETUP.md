# Neon Database Setup Guide

This guide walks you through setting up Neon as your PostgreSQL database for the CryptoOrchestrator platform.

## What is Neon?

Neon is a serverless PostgreSQL database platform that offers:
- **Generous Free Tier**: 20 projects × 0.5 GB storage each (10 GB total)
- **Serverless Architecture**: Automatic scaling and instant cold starts
- **Branching**: Database branching like Git (dev/staging/production)
- **Point-in-Time Recovery**: Time-travel to any point in the last 7 days
- **Connection Pooling**: Built-in PgBouncer for efficient connection management
- **Zero Infrastructure**: No servers to manage, fully managed PostgreSQL

## Prerequisites

- A Neon account (sign up at https://neon.tech - no credit card required)
- Python 3.12+ installed
- This CryptoOrchestrator repository cloned locally

---

## Step 1: Create a Neon Project

1. **Sign up or log in to Neon**:
   - Go to https://console.neon.tech
   - Sign up with GitHub, Google, or email (no credit card required)

2. **Create a new project**:
   - Click "Create a project" or "New Project"
   - **Project Name**: `crypto-orchestrator`
   - **Region**: Choose closest to your users (e.g., US East, EU West, Asia Pacific)
   - **PostgreSQL Version**: 16 (recommended) or 15
   - Click "Create project"

3. **Copy your connection string**:
   - After creation, you'll see a connection string like:
     ```
     postgresql://[user]:[password]@[endpoint]/[database]?sslmode=require
     ```
   - Click the copy button to save it

---

## Step 2: Configure Environment Variables

### Option A: Using the Setup Script (Recommended)

Run the Neon setup script which will guide you through the process:

```bash
# Make the script executable (Linux/Mac)
chmod +x scripts/setup-neon.sh

# Run the setup script
./scripts/setup-neon.sh
```

Or on Windows:
```bash
python scripts/setup_neon.py
```

The script will:
- Prompt you for your Neon connection string
- Validate the connection
- Generate secure secrets
- Create a `.env` file with proper configuration
- Test the database connection

### Option B: Manual Setup

1. **Copy the environment template**:
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` file** and update the DATABASE_URL:

   ```bash
   # For async operations (FastAPI app)
   DATABASE_URL=postgresql+asyncpg://[user]:[password]@[endpoint]/[database]?sslmode=require

   # Other required variables
   JWT_SECRET=your-secret-here-change-in-production
   EXCHANGE_KEY_ENCRYPTION_KEY=your-encryption-key-32-chars-minimum
   ```

3. **Important**: Replace the bracketed values with your actual Neon credentials:
   - `[user]` - Your Neon database username
   - `[password]` - Your Neon database password
   - `[endpoint]` - Your Neon endpoint (e.g., `ep-xyz-123.us-east-2.aws.neon.tech`)
   - `[database]` - Your database name (usually `neondb` by default)

---

## Step 3: Update Alembic Configuration

The Alembic configuration needs to be updated to use your Neon database for migrations.

Edit `alembic.ini` and find the `sqlalchemy.url` line. Since Alembic runs synchronously, update it to:

```ini
# Use synchronous PostgreSQL driver for Alembic
sqlalchemy.url = postgresql://[user]:[password]@[endpoint]/[database]?sslmode=require
```

**Note**: Use `postgresql://` (not `postgresql+asyncpg://`) for Alembic migrations.

Alternatively, you can set the `DATABASE_URL` environment variable and Alembic will use it automatically:

```bash
export DATABASE_URL=postgresql://[user]:[password]@[endpoint]/[database]?sslmode=require
npm run migrate
```

---

## Step 4: Install Dependencies

Ensure you have the required database dependencies installed:

```bash
# Install Python dependencies
pip install -r requirements.txt

# This includes:
# - asyncpg (async PostgreSQL driver)
# - sqlalchemy[asyncio] (ORM)
# - alembic (migrations)
```

---

## Step 5: Verify Connection

Test your database connection using the validation script:

```bash
python scripts/validate_neon_connection.py
```

This will:
- ✅ Check if the connection string is valid
- ✅ Test the database connection
- ✅ Verify SSL is enabled
- ✅ Check database permissions
- ✅ Display connection info (region, version, etc.)

---

## Step 6: Run Database Migrations

Initialize your database schema by running migrations:

```bash
# Run all pending migrations
npm run migrate

# Or use alembic directly
alembic upgrade head
```

You should see output like:
```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade  -> abc123, Initial schema
INFO  [alembic.runtime.migration] Running upgrade abc123 -> def456, Add users table
```

---

## Step 7: Start the Application

Start your FastAPI backend:

```bash
npm run dev:fastapi
```

Check the logs for successful database connection:
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Database connected: PostgreSQL 16.2 on x86_64-pc-linux-gnu
INFO:     Application startup complete.
```

---

## Neon-Specific Optimizations

### Connection Pooling

Neon provides built-in connection pooling via PgBouncer. For optimal performance:

1. **Use the pooled connection string** (recommended for web apps):
   ```
   postgresql://[user]:[password]@[endpoint]-pooler/[database]?sslmode=require
   ```
   
   Notice the `-pooler` suffix in the endpoint.

2. **Update your `.env` file**:
   ```bash
   # For high-concurrency web applications, use pooled connection
   DATABASE_URL=postgresql+asyncpg://[user]:[password]@[endpoint]-pooler/[database]?sslmode=require
   ```

3. **Configure pool size** in `.env`:
   ```bash
   # Neon free tier supports up to 100 concurrent connections
   DB_POOL_SIZE=20
   DB_MAX_OVERFLOW=10
   DB_POOL_TIMEOUT=30
   ```

### Database Branching (Advanced)

Neon supports database branching like Git:

1. **Create a development branch**:
   ```bash
   # In Neon console, create a branch from main
   # Named: "dev" or "staging"
   ```

2. **Get the branch connection string** and use it for development:
   ```bash
   # In .env.development
   DATABASE_URL=postgresql+asyncpg://[user]:[password]@[dev-endpoint]/[database]?sslmode=require
   ```

3. **Benefits**:
   - Test migrations on dev branch first
   - Isolate development data from production
   - Easy rollback and experimentation

---

## Troubleshooting

### Connection Timeout

**Problem**: `asyncpg.exceptions.CannotConnectNowError: connection timeout`

**Solutions**:
1. Check if your Neon project is active (may be in sleep mode on free tier)
2. Verify your internet connection
3. Ensure the endpoint URL is correct
4. Check if SSL is required: `?sslmode=require`

### SSL Certificate Error

**Problem**: `SSL certificate verify failed`

**Solution**: Ensure your connection string includes `?sslmode=require`:
```bash
DATABASE_URL=postgresql+asyncpg://user:pass@endpoint/db?sslmode=require
```

### "Too Many Connections"

**Problem**: `FATAL: sorry, too many clients already`

**Solutions**:
1. Use the pooled connection endpoint (`-pooler` suffix)
2. Reduce `DB_POOL_SIZE` in your `.env` file
3. Close idle connections properly
4. Upgrade to paid tier for more connections

### Migration Fails

**Problem**: `alembic upgrade head` fails with errors

**Solutions**:
1. Check if you're using the synchronous driver:
   ```bash
   # Correct for Alembic
   postgresql://user:pass@endpoint/db?sslmode=require
   
   # Wrong (async driver doesn't work with Alembic)
   postgresql+asyncpg://user:pass@endpoint/db
   ```

2. Verify database user has CREATE permissions:
   ```bash
   python scripts/validate_neon_connection.py
   ```

3. Check Alembic version compatibility:
   ```bash
   pip install --upgrade alembic
   ```

### Connection Drops After Inactivity

**Problem**: Connection lost after periods of inactivity

**Solution**: Enable connection pre-ping in `.env`:
```bash
# This is already configured in database.py
# The pool_pre_ping=True setting handles this automatically
```

---

## Production Deployment

### Render / Koyeb / Fly.io

When deploying to hosting platforms:

1. **Add DATABASE_URL as environment variable**:
   - Use the pooled connection string for better performance
   - Ensure `sslmode=require` is included

2. **Set connection pool limits**:
   ```bash
   DATABASE_URL=postgresql+asyncpg://[user]:[password]@[endpoint]-pooler/[database]?sslmode=require
   DB_POOL_SIZE=10
   DB_MAX_OVERFLOW=5
   ```

3. **Run migrations during deployment**:
   ```bash
   # Add to your build/deploy command
   alembic upgrade head && uvicorn server_fastapi.main:app
   ```

### Docker Deployment

In `docker-compose.yml`, add:

```yaml
services:
  backend:
    environment:
      - DATABASE_URL=postgresql+asyncpg://[user]:[password]@[endpoint]-pooler/[database]?sslmode=require
      - DB_POOL_SIZE=15
      - DB_MAX_OVERFLOW=10
```

---

## Monitoring & Maintenance

### Check Database Usage

1. **Via Neon Console**:
   - Go to https://console.neon.tech
   - Select your project
   - View "Usage" tab for storage and compute metrics

2. **Via SQL** (in psql or database client):
   ```sql
   -- Check database size
   SELECT pg_size_pretty(pg_database_size('neondb'));
   
   -- Check table sizes
   SELECT schemaname, tablename, 
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
   FROM pg_tables
   WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
   ```

### Backup Strategy

Neon automatically provides:
- **Continuous backup**: Every change is backed up
- **Point-in-time recovery**: Last 7 days (free tier)
- **Snapshots**: Can be taken manually in console

For additional safety:
```bash
# Export database backup
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d).sql

# Or use the backup script
python scripts/backup_neon_db.py
```

---

## Cost Management

### Free Tier Limits

- **Storage**: 0.5 GB per project (20 projects = 10 GB total)
- **Compute**: 300 hours/month of active compute time
- **Data Transfer**: 5 GB/month
- **Branches**: 10 per project
- **Point-in-Time Recovery**: 7 days

### Optimization Tips

1. **Use connection pooling** to reduce compute time
2. **Create indexes** on frequently queried columns
3. **Clean up old data** periodically
4. **Monitor your usage** in the Neon console
5. **Use database branching** to avoid duplicate projects

### When to Upgrade

Consider upgrading to a paid plan when:
- Storage exceeds 0.5 GB
- Need more than 300 compute hours/month
- Require longer point-in-time recovery (30 days)
- Need higher connection limits
- Want autoscaling and better performance

---

## Next Steps

1. ✅ **Database is set up** - Your Neon database is ready
2. 📝 **Create test data**: Run `npm run generate:test-data`
3. 🧪 **Run tests**: Execute `npm test` to verify everything works
4. 🚀 **Deploy**: Follow [FREE_STACK_DEPLOYMENT.md](./FREE_STACK_DEPLOYMENT.md)
5. 📊 **Monitor**: Set up [monitoring](./MONITORING_SETUP.md) for production

---

## Additional Resources

- **Neon Documentation**: https://neon.tech/docs
- **Neon Status**: https://neonstatus.com
- **Community Discord**: https://discord.gg/neon
- **GitHub Discussions**: https://github.com/neondatabase/neon/discussions
- **Connection Pooling Guide**: https://neon.tech/docs/connect/connection-pooling
- **Migration Guide**: https://neon.tech/docs/migrate/migrate-from-postgres

---

## Support

If you encounter issues:

1. Check [Neon Status](https://neonstatus.com) for outages
2. Review [Troubleshooting](#troubleshooting) section above
3. Run `python scripts/validate_neon_connection.py` for diagnostics
4. Check Neon logs in the console under "Monitoring"
5. Ask in [Neon Discord](https://discord.gg/neon) or [GitHub Discussions](https://github.com/Austen0305/Crypto-Orchestrator/discussions)

---

**Built with ❤️ for the CryptoOrchestrator community**
