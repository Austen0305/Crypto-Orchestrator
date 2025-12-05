#!/usr/bin/env python3
"""
Neon Database Setup Script for CryptoOrchestrator

This script helps set up Neon PostgreSQL database by:
1. Validating the Neon connection string format
2. Testing the database connection
3. Generating secure secrets
4. Creating a properly configured .env file
5. Verifying database permissions
"""

import os
import sys
import secrets
import re
from pathlib import Path
from typing import Optional, Tuple


# Color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'


def print_header():
    """Print the script header."""
    print(f"\n{Colors.BOLD}{Colors.BLUE}╔══════════════════════════════════════════════════════╗{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}║  CryptoOrchestrator - Neon Database Setup          ║{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}╚══════════════════════════════════════════════════════╝{Colors.END}\n")


def print_success(message: str):
    """Print success message."""
    print(f"{Colors.GREEN}✓ {message}{Colors.END}")


def print_warning(message: str):
    """Print warning message."""
    print(f"{Colors.YELLOW}⚠ {message}{Colors.END}")


def print_error(message: str):
    """Print error message."""
    print(f"{Colors.RED}✗ {message}{Colors.END}")


def print_info(message: str):
    """Print info message."""
    print(f"{Colors.BLUE}ℹ {message}{Colors.END}")


def validate_neon_connection_string(connection_string: str) -> Tuple[bool, str, Optional[dict]]:
    """
    Validate that a connection string is in the correct Neon format.
    
    Returns:
        Tuple of (is_valid, message, parsed_info)
    """
    # Basic PostgreSQL connection string pattern
    pattern = r'postgresql(?:\+asyncpg)?://([^:]+):([^@]+)@([^/]+)/([^\?]+)(?:\?(.+))?'
    match = re.match(pattern, connection_string)
    
    if not match:
        return False, "Invalid connection string format", None
    
    user, password, host, database, params = match.groups()
    
    # Check if it looks like a Neon endpoint
    if not ('neon.tech' in host or 'neon.tech' in connection_string):
        return False, "This doesn't appear to be a Neon database URL (should contain 'neon.tech')", None
    
    # Check for SSL mode (accept various SSL modes that work with Neon)
    valid_ssl_modes = ['sslmode=require', 'sslmode=verify-full', 'sslmode=verify-ca']
    has_ssl = any(mode in params for mode in valid_ssl_modes) if params else False
    
    if not has_ssl:
        return False, "Missing required SSL parameter. Add ?sslmode=require to your connection string", None
    
    parsed_info = {
        'user': user,
        'host': host,
        'database': database,
        'pooled': '-pooler' in host
    }
    
    return True, "Valid Neon connection string", parsed_info


def test_connection(connection_string: str) -> Tuple[bool, str]:
    """
    Test the database connection.
    
    Returns:
        Tuple of (success, message)
    """
    try:
        import asyncpg
        import asyncio
        
        async def test():
            # Convert asyncpg format to pure PostgreSQL for asyncpg
            conn_str = connection_string.replace('postgresql+asyncpg://', 'postgresql://')
            conn_str = conn_str.replace('?sslmode=require', '')
            
            try:
                conn = await asyncio.wait_for(
                    asyncpg.connect(conn_str, ssl='require'),
                    timeout=10.0
                )
                version = await conn.fetchval('SELECT version()')
                await conn.close()
                return True, f"Connected successfully! PostgreSQL version: {version.split(',')[0]}"
            except asyncio.TimeoutError:
                return False, "Connection timeout - database may be inactive or endpoint is incorrect"
            except Exception as e:
                return False, f"Connection failed: {str(e)}"
        
        return asyncio.run(test())
    
    except ImportError:
        return False, "asyncpg not installed. Run: pip install asyncpg"
    except Exception as e:
        return False, f"Unexpected error: {str(e)}"


def generate_secrets() -> dict:
    """Generate secure secrets for the application."""
    return {
        'JWT_SECRET': secrets.token_hex(32),  # 64 hex characters
        'JWT_REFRESH_SECRET': secrets.token_hex(32),  # 64 hex characters
        'EXCHANGE_KEY_ENCRYPTION_KEY': secrets.token_hex(16)  # 32 hex characters (minimum for encryption)
    }


def create_env_file(connection_string: str, secrets_dict: dict, env_path: Path) -> bool:
    """
    Create .env file with proper configuration.
    
    Args:
        connection_string: The Neon database URL
        secrets_dict: Dictionary of generated secrets
        env_path: Path to the .env file
    
    Returns:
        True if successful, False otherwise
    """
    try:
        # Convert to async format for FastAPI
        if not connection_string.startswith('postgresql+asyncpg://'):
            async_conn_str = connection_string.replace('postgresql://', 'postgresql+asyncpg://')
        else:
            async_conn_str = connection_string
        
        # Ensure sslmode=require is present
        if '?' not in async_conn_str:
            async_conn_str += '?sslmode=require'
        elif 'sslmode=' not in async_conn_str:
            async_conn_str += '&sslmode=require'
        
        env_content = f"""# CryptoOrchestrator Environment Configuration
# Generated by setup_neon.py on {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

# ============================================
# Database Configuration (Neon PostgreSQL)
# ============================================
# For async operations (FastAPI app) - use asyncpg driver
DATABASE_URL={async_conn_str}

# ============================================
# Security Secrets
# ============================================
JWT_SECRET={secrets_dict['JWT_SECRET']}
JWT_REFRESH_SECRET={secrets_dict.get('JWT_REFRESH_SECRET', secrets.token_hex(32))}
EXCHANGE_KEY_ENCRYPTION_KEY={secrets_dict['EXCHANGE_KEY_ENCRYPTION_KEY']}

# ============================================
# Redis Cache (Optional)
# ============================================
# Get free Redis from Upstash: https://upstash.com
# REDIS_URL=rediss://default:password@endpoint.upstash.io:6379

# ============================================
# Application Configuration
# ============================================
NODE_ENV=development
ENVIRONMENT=development
PORT=8000
HOST=0.0.0.0

# ============================================
# Database Pool Configuration
# ============================================
# Optimized for Neon's connection pooling
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=10
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=3600

# ============================================
# CORS Configuration
# ============================================
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8000

# ============================================
# Feature Flags
# ============================================
USE_MOCK_KRAKEN=false
ENABLE_DISTRIBUTED_RATE_LIMIT=false

# ============================================
# Logging
# ============================================
LOG_LEVEL=INFO

# ============================================
# Optional: Payment Processing (Stripe)
# ============================================
# STRIPE_SECRET_KEY=sk_test_your_key_here
# STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
# STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here

# ============================================
# Optional: Error Tracking (Sentry)
# ============================================
# SENTRY_DSN=https://your_sentry_dsn_here

# ============================================
# Optional: Exchange API Keys
# ============================================
# Only required for live trading
# KRAKEN_API_KEY=your_api_key
# KRAKEN_SECRET_KEY=your_secret_key
# BINANCE_API_KEY=your_api_key
# BINANCE_SECRET_KEY=your_secret_key
"""
        
        # Write to file
        with open(env_path, 'w') as f:
            f.write(env_content)
        
        return True
    
    except Exception as e:
        print_error(f"Failed to create .env file: {str(e)}")
        return False


def update_alembic_ini(connection_string: str) -> bool:
    """
    Update alembic.ini with the correct connection string.
    
    Args:
        connection_string: The Neon database URL
    
    Returns:
        True if successful, False otherwise
    """
    try:
        alembic_path = Path(__file__).parent.parent / 'alembic.ini'
        
        if not alembic_path.exists():
            print_warning("alembic.ini not found, skipping update")
            return True
        
        # Convert to sync format for Alembic (no asyncpg)
        sync_conn_str = connection_string.replace('postgresql+asyncpg://', 'postgresql://')
        
        # Read current content
        with open(alembic_path, 'r') as f:
            content = f.read()
        
        # Replace the sqlalchemy.url line
        new_content = re.sub(
            r'sqlalchemy\.url = .*',
            f'sqlalchemy.url = {sync_conn_str}',
            content
        )
        
        # Write back
        with open(alembic_path, 'w') as f:
            f.write(new_content)
        
        return True
    
    except Exception as e:
        print_error(f"Failed to update alembic.ini: {str(e)}")
        return False


def main():
    """Main setup function."""
    print_header()
    
    # Check if .env already exists
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        print_warning(".env file already exists!")
        response = input("Do you want to overwrite it? (yes/no): ").lower()
        if response not in ['yes', 'y']:
            print_info("Setup cancelled. Existing .env file preserved.")
            return
        print()
    
    # Step 1: Get Neon connection string
    print(f"{Colors.BOLD}Step 1: Neon Connection String{Colors.END}")
    print_info("You can find this in your Neon console: https://console.neon.tech")
    print_info("Example: postgresql://user:pass@ep-xyz-123.us-east-2.aws.neon.tech/neondb?sslmode=require")
    print()
    
    connection_string = input("Enter your Neon connection string: ").strip()
    print()
    
    if not connection_string:
        print_error("Connection string cannot be empty!")
        sys.exit(1)
    
    # Step 2: Validate format
    print(f"{Colors.BOLD}Step 2: Validating Connection String{Colors.END}")
    is_valid, message, info = validate_neon_connection_string(connection_string)
    
    if not is_valid:
        print_error(message)
        sys.exit(1)
    
    print_success(message)
    if info:
        print_info(f"  Database: {info['database']}")
        print_info(f"  Host: {info['host']}")
        print_info(f"  User: {info['user']}")
        print_info(f"  Connection Pooling: {'Enabled' if info['pooled'] else 'Direct'}")
        
        if not info['pooled']:
            print_warning("  Consider using the pooled endpoint (-pooler) for better performance")
    print()
    
    # Step 3: Test connection
    print(f"{Colors.BOLD}Step 3: Testing Database Connection{Colors.END}")
    print_info("This may take a few seconds if the database is in sleep mode...")
    
    success, conn_message = test_connection(connection_string)
    
    if not success:
        print_error(conn_message)
        print_warning("Connection test failed, but you can still proceed with setup")
        response = input("Continue anyway? (yes/no): ").lower()
        if response not in ['yes', 'y']:
            sys.exit(1)
    else:
        print_success(conn_message)
    print()
    
    # Step 4: Generate secrets
    print(f"{Colors.BOLD}Step 4: Generating Secure Secrets{Colors.END}")
    secrets_dict = generate_secrets()
    print_success(f"JWT Secret: {secrets_dict['JWT_SECRET'][:16]}...")
    print_success(f"JWT Refresh Secret: {secrets_dict['JWT_REFRESH_SECRET'][:16]}...")
    print_success(f"Encryption Key: {secrets_dict['EXCHANGE_KEY_ENCRYPTION_KEY']}")
    print()
    
    # Step 5: Create .env file
    print(f"{Colors.BOLD}Step 5: Creating .env File{Colors.END}")
    if create_env_file(connection_string, secrets_dict, env_path):
        print_success(f"Created .env file at: {env_path}")
    else:
        print_error("Failed to create .env file")
        sys.exit(1)
    print()
    
    # Step 6: Update alembic.ini
    print(f"{Colors.BOLD}Step 6: Updating Alembic Configuration{Colors.END}")
    if update_alembic_ini(connection_string):
        print_success("Updated alembic.ini with Neon connection")
    else:
        print_warning("Could not update alembic.ini - you may need to do this manually")
    print()
    
    # Final steps
    print(f"{Colors.BOLD}{Colors.GREEN}✓ Setup Complete!{Colors.END}\n")
    print(f"{Colors.BOLD}Next Steps:{Colors.END}")
    print(f"  1. Review and update the .env file with any optional settings")
    print(f"  2. Run database migrations: {Colors.BLUE}npm run migrate{Colors.END}")
    print(f"  3. Start the development server: {Colors.BLUE}npm run dev:fastapi{Colors.END}")
    print()
    print(f"{Colors.BOLD}Optional:{Colors.END}")
    print(f"  • Set up Redis cache (Upstash free tier): https://upstash.com")
    print(f"  • Configure Stripe for payments (if needed)")
    print(f"  • Add exchange API keys for live trading")
    print()
    print(f"{Colors.BOLD}Documentation:{Colors.END}")
    print(f"  • Neon Setup Guide: {Colors.BLUE}docs/NEON_SETUP.md{Colors.END}")
    print(f"  • Free Stack Deployment: {Colors.BLUE}docs/FREE_STACK_DEPLOYMENT.md{Colors.END}")
    print()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n{Colors.YELLOW}Setup cancelled by user.{Colors.END}")
        sys.exit(0)
    except Exception as e:
        print_error(f"Unexpected error: {str(e)}")
        sys.exit(1)
