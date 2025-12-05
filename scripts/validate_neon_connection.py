#!/usr/bin/env python3
"""
Neon Connection Validation Script

This script validates your Neon database connection and provides diagnostic information.
Run this after setting up your .env file to ensure everything is configured correctly.
"""

import os
import sys
import asyncio
from pathlib import Path
from typing import Tuple, Optional
import re

# Add parent directory to path to import from server_fastapi
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("Warning: python-dotenv not installed, using environment variables only")


# Constants
SSL_PARAM_PATTERN = r'[?&]sslmode=[^&]*(&|$)'
TRAILING_SEPARATOR_PATTERN = r'[?&]$'


# Color codes
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'


def print_header():
    """Print script header."""
    print(f"\n{Colors.BOLD}{Colors.BLUE}╔══════════════════════════════════════════════════════╗{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}║  Neon Database Connection Validator                ║{Colors.END}")
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


def remove_ssl_params(connection_string: str) -> str:
    """
    Remove SSL parameters from connection string for asyncpg.
    
    AsyncPg requires SSL to be set programmatically, not via URL parameters.
    This helper removes sslmode parameters while preserving URL structure.
    
    Args:
        connection_string: PostgreSQL connection string
        
    Returns:
        Connection string with SSL parameters removed
    """
    # Remove SSL parameter (handles both ? and & separators)
    cleaned = re.sub(SSL_PARAM_PATTERN, r'\1', connection_string)
    # Clean up trailing ? or & if they exist
    cleaned = re.sub(TRAILING_SEPARATOR_PATTERN, '', cleaned)
    return cleaned


async def validate_connection() -> Tuple[bool, dict]:
    """
    Validate the Neon database connection and gather diagnostic info.
    
    Returns:
        Tuple of (success, info_dict)
    """
    try:
        import asyncpg
    except ImportError:
        print_error("asyncpg is not installed!")
        print_info("Install it with: pip install asyncpg")
        return False, {}
    
    # Get DATABASE_URL from environment
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        print_error("DATABASE_URL not found in environment!")
        print_info("Make sure you have a .env file with DATABASE_URL set")
        return False, {}
    
    # Parse and validate URL format
    if not database_url.startswith(('postgresql://', 'postgresql+asyncpg://')):
        print_error("DATABASE_URL doesn't start with postgresql:// or postgresql+asyncpg://")
        return False, {}
    
    # Convert to asyncpg format
    conn_str = database_url.replace('postgresql+asyncpg://', 'postgresql://')
    
    # Check for SSL requirement
    has_ssl = 'sslmode=' in conn_str
    if not has_ssl:
        print_warning("SSL mode not found in connection string")
        print_info("Neon requires SSL. Add ?sslmode=require to your DATABASE_URL")
    
    # Remove SSL parameters for asyncpg (we'll set it programmatically)
    conn_str = remove_ssl_params(conn_str)
    
    info = {
        'url': database_url,
        'has_ssl': has_ssl,
        'pooled': '-pooler' in database_url
    }
    
    try:
        print_info("Attempting to connect to database...")
        
        # Try to connect with timeout
        conn = await asyncio.wait_for(
            asyncpg.connect(conn_str, ssl='require'),
            timeout=15.0
        )
        
        # Gather database information
        info['connected'] = True
        
        # Get PostgreSQL version
        version = await conn.fetchval('SELECT version()')
        info['version'] = version.split(',')[0]
        
        # Get database name
        db_name = await conn.fetchval('SELECT current_database()')
        info['database'] = db_name
        
        # Get current user
        user = await conn.fetchval('SELECT current_user')
        info['user'] = user
        
        # Check database size
        size_query = "SELECT pg_size_pretty(pg_database_size(current_database()))"
        size = await conn.fetchval(size_query)
        info['size'] = size
        
        # Check permissions
        has_create = await conn.fetchval(
            "SELECT has_database_privilege(current_database(), 'CREATE')"
        )
        info['can_create'] = has_create
        
        has_connect = await conn.fetchval(
            "SELECT has_database_privilege(current_database(), 'CONNECT')"
        )
        info['can_connect'] = has_connect
        
        # Get server timezone
        timezone = await conn.fetchval('SHOW timezone')
        info['timezone'] = timezone
        
        # Get connection info
        server_version = await conn.fetchval('SHOW server_version')
        info['server_version'] = server_version
        
        await conn.close()
        
        return True, info
    
    except asyncio.TimeoutError:
        print_error("Connection timeout!")
        print_info("The database may be inactive (sleeping) or the endpoint is incorrect")
        print_info("Neon databases on free tier may take 5-10 seconds to wake up")
        return False, info
    
    except asyncpg.InvalidPasswordError:
        print_error("Invalid password!")
        print_info("Check your DATABASE_URL credentials")
        return False, info
    
    except asyncpg.InvalidCatalogNameError:
        print_error("Database not found!")
        print_info("Check the database name in your DATABASE_URL")
        return False, info
    
    except Exception as e:
        print_error(f"Connection failed: {str(e)}")
        return False, info


async def check_tables():
    """Check if any tables exist in the database."""
    try:
        import asyncpg
        
        database_url = os.getenv('DATABASE_URL', '')
        conn_str = database_url.replace('postgresql+asyncpg://', 'postgresql://')
        # Remove SSL parameters using helper function
        conn_str = remove_ssl_params(conn_str)
        
        conn = await asyncio.wait_for(
            asyncpg.connect(conn_str, ssl='require'),
            timeout=10.0
        )
        
        # Get list of tables
        tables = await conn.fetch("""
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        """)
        
        await conn.close()
        
        return [row['tablename'] for row in tables]
    
    except Exception as e:
        print_warning(f"Could not check tables: {str(e)}")
        return []


def print_diagnostics(info: dict):
    """Print diagnostic information."""
    print(f"\n{Colors.BOLD}Connection Details:{Colors.END}")
    
    if info.get('connected'):
        print_success(f"PostgreSQL Version: {info.get('version', 'Unknown')}")
        print_success(f"Database: {info.get('database', 'Unknown')}")
        print_success(f"User: {info.get('user', 'Unknown')}")
        print_success(f"Database Size: {info.get('size', 'Unknown')}")
        print_success(f"Server Version: {info.get('server_version', 'Unknown')}")
        print_success(f"Timezone: {info.get('timezone', 'Unknown')}")
        
        print(f"\n{Colors.BOLD}Permissions:{Colors.END}")
        if info.get('can_create'):
            print_success("CREATE privilege: Yes")
        else:
            print_error("CREATE privilege: No")
            print_warning("You may not be able to run migrations!")
        
        if info.get('can_connect'):
            print_success("CONNECT privilege: Yes")
        else:
            print_error("CONNECT privilege: No")
    
    print(f"\n{Colors.BOLD}Configuration:{Colors.END}")
    
    if info.get('has_ssl'):
        print_success("SSL: Enabled (required for Neon)")
    else:
        print_error("SSL: Not configured")
        print_info("Add ?sslmode=require to your DATABASE_URL")
    
    if info.get('pooled'):
        print_success("Connection Pooling: Enabled (-pooler endpoint)")
        print_info("This is recommended for web applications")
    else:
        print_warning("Connection Pooling: Not enabled")
        print_info("Consider using the pooled endpoint for better performance")
        print_info("Replace your endpoint with [endpoint]-pooler in DATABASE_URL")


async def main():
    """Main validation function."""
    print_header()
    
    # Check if .env file exists
    env_path = Path('.env')
    if not env_path.exists():
        print_error(".env file not found!")
        print_info("Run the setup script first: python scripts/setup_neon.py")
        sys.exit(1)
    
    print_info("Found .env file")
    
    # Check DATABASE_URL
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print_error("DATABASE_URL not set in .env file!")
        sys.exit(1)
    
    print_success("DATABASE_URL is set")
    
    # Mask the password in the URL for display
    masked_url = database_url
    if '@' in masked_url:
        parts = masked_url.split('@')
        if ':' in parts[0]:
            user_pass = parts[0].split(':')
            masked_url = f"{user_pass[0]}:****@{parts[1]}"
    
    print_info(f"URL: {masked_url}")
    
    # Validate connection
    print(f"\n{Colors.BOLD}Testing Connection:{Colors.END}")
    success, info = await validate_connection()
    
    if success:
        print_success("Connection successful!")
        
        # Print diagnostics
        print_diagnostics(info)
        
        # Check for existing tables
        print(f"\n{Colors.BOLD}Database Tables:{Colors.END}")
        tables = await check_tables()
        
        if tables:
            print_success(f"Found {len(tables)} table(s):")
            for table in tables:
                print(f"  • {table}")
        else:
            print_info("No tables found (database is empty)")
            print_info("Run migrations to create tables: npm run migrate")
        
        # Final recommendations
        print(f"\n{Colors.BOLD}Recommendations:{Colors.END}")
        if not info.get('pooled'):
            print_info("• Enable connection pooling for better performance")
        if not info.get('can_create'):
            print_warning("• Check user permissions (CREATE required for migrations)")
        if not tables:
            print_info("• Run database migrations: npm run migrate")
        
        print(f"\n{Colors.GREEN}{Colors.BOLD}✓ Your Neon database is ready to use!{Colors.END}\n")
        sys.exit(0)
    
    else:
        print(f"\n{Colors.RED}{Colors.BOLD}✗ Connection validation failed{Colors.END}")
        print(f"\n{Colors.BOLD}Troubleshooting Steps:{Colors.END}")
        print("1. Check if your Neon project is active (may be sleeping)")
        print("2. Verify your DATABASE_URL in .env file")
        print("3. Ensure you have internet connectivity")
        print("4. Check Neon status: https://neonstatus.com")
        print("5. Review the Neon setup guide: docs/NEON_SETUP.md")
        print()
        sys.exit(1)


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Validation cancelled by user.{Colors.END}")
        sys.exit(0)
    except Exception as e:
        print_error(f"Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
