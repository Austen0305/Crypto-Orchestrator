from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import os
import sys
from dotenv import load_dotenv
import logging
from contextlib import asynccontextmanager

# Add current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

# Configure logging - enhanced for desktop app usage
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),  # Console logging
        logging.FileHandler('logs/fastapi.log', mode='a') if os.path.exists('logs') else logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Set uvicorn loggers to match our level
uvicorn_logger = logging.getLogger("uvicorn")
uvicorn_logger.setLevel(logging.INFO)
uvicorn_access = logging.getLogger("uvicorn.access")
uvicorn_access.setLevel(logging.INFO)

# Lifespan context manager for startup/shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting FastAPI server...")
    yield
    # Shutdown
    logger.info("Shutting down FastAPI server...")

# Create FastAPI app - optimized for desktop app performance
app = FastAPI(
    title="CryptoOrchestrator API",
    description="Professional AI-Powered Crypto Trading Platform API",
    version="1.0.0",
    lifespan=lifespan,
    # Performance optimizations for desktop app
    debug=False,  # Disable debug mode for production performance
    docs_url="/docs" if os.getenv("NODE_ENV") == "development" else None,  # Hide docs in production
    redoc_url="/redoc" if os.getenv("NODE_ENV") == "development" else None,  # Hide redoc in production
)

# CORS middleware - optimized for desktop app usage
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # React dev server
        "http://localhost:5173",  # Vite dev server
        "http://localhost:8000",  # FastAPI server
        "http://127.0.0.1:3000", # Alternative localhost
        "http://127.0.0.1:5173", # Alternative localhost
        "http://127.0.0.1:8000", # Alternative localhost
        "file://",               # Electron file protocol
        "null",                  # Electron null origin
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    max_age=86400,  # Cache preflight for 24 hours
)

# Trusted host middleware (for production)
if os.getenv("NODE_ENV") == "production":
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1"])

# Global exception handler - enhanced for desktop app
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    # Return more detailed error info in development
    if os.getenv("NODE_ENV") == "development":
        return JSONResponse(
            status_code=500,
            content={
                "message": "Internal server error",
                "error": str(exc),
                "type": type(exc).__name__
            }
        )
    else:
        return JSONResponse(
            status_code=500,
            content={"message": "Internal server error"}
        )

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "CryptoOrchestrator API"}

# Root endpoint
@app.get("/")
async def root():
    return {"message": "CryptoOrchestrator API", "version": "1.0.0"}

# Import and include routers
try:
    # Try to import routes with relative imports
    from routes.auth import router as auth_router
    app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])

    from .routes.markets import router as markets_router
    app.include_router(markets_router, prefix="/api", tags=["Markets"])

    from .routes.bots import router as bots_router
    app.include_router(bots_router, prefix="/api/bots", tags=["Bots"])

    from .routes.analytics import router as analytics_router
    app.include_router(analytics_router, prefix="/api", tags=["Analytics"])

    from .routes.integrations import router as integrations_router
    app.include_router(integrations_router, prefix="/api/integrations", tags=["Integrations"])

    from .routes.portfolio import router as portfolio_router
    app.include_router(portfolio_router, prefix="/api/portfolio", tags=["Portfolio"])

    from .routes.trades import router as trades_router
    app.include_router(trades_router, prefix="/api/trades", tags=["Trades"])

    from .routes.fees import router as fees_router
    app.include_router(fees_router, prefix="/api/fees", tags=["Fees"])

    from .routes.status import router as status_router
    app.include_router(status_router, prefix="/api/status", tags=["Status"])

    from .routes.health import router as health_router
    app.include_router(health_router, prefix="/api/health", tags=["Health"])

    from .routes.recommendations import router as recommendations_router
    app.include_router(recommendations_router, prefix="/api", tags=["Recommendations"])

    from .routes.notifications import router as notifications_router
    app.include_router(notifications_router, prefix="/api", tags=["Notifications"])

    from .routes.ws import router as ws_router
    app.include_router(ws_router, prefix="/api", tags=["WebSocket"])

    from .routes.preferences import router as preferences_router
    app.include_router(preferences_router, prefix="/api", tags=["Preferences"])

    logger.info("All routers loaded successfully")

except ImportError as e:
    logger.error(f"Failed to import routers: {e}")
    # Continue without routers for basic functionality

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "127.0.0.1")
    is_development = os.getenv("NODE_ENV") == "development"

    # Performance optimizations for production
    uvicorn_config = {
        "app": app,
        "host": host,
        "port": port,
        "reload": is_development,
        "log_level": "debug" if is_development else "info",
        "access_log": is_development,  # Disable access logs in production for performance
        "workers": 1,  # Single worker for desktop app (avoid port conflicts)
        "loop": "asyncio",
        "http": "httptools" if not is_development else "auto",  # Use httptools for better performance in production
    }

    uvicorn.run(**uvicorn_config)
