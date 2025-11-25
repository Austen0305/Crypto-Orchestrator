"""
Compression Middleware
Adds Gzip compression for better performance
"""

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from starlette.responses import Response
import gzip
import logging

logger = logging.getLogger(__name__)


class CompressionMiddleware(BaseHTTPMiddleware):
    """
    Compression middleware
    Compresses responses with Gzip for better performance
    """

    def __init__(self, app: ASGIApp, minimum_size: int = 1000):
        super().__init__(app)
        self.minimum_size = minimum_size  # Minimum size to compress (bytes)

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        # Check if response should be compressed
        if not self.should_compress(request, response):
            return response

        # Get response body
        body = b""
        async for chunk in response.body_iterator:
            body += chunk

        # Compress if body is large enough
        if len(body) >= self.minimum_size:
            compressed_body = gzip.compress(body, compresslevel=6)
            
            # Only compress if it actually reduces size
            if len(compressed_body) < len(body):
                response.headers["Content-Encoding"] = "gzip"
                response.headers["Content-Length"] = str(len(compressed_body))
                response.headers["Vary"] = "Accept-Encoding"
                
                return Response(
                    content=compressed_body,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    media_type=response.media_type,
                )

        # Return original response if compression doesn't help
        return Response(
            content=body,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
        )

    def should_compress(self, request: Request, response: Response) -> bool:
        """Check if response should be compressed"""
        # Check if client accepts gzip
        accept_encoding = request.headers.get("Accept-Encoding", "")
        if "gzip" not in accept_encoding:
            return False

        # Don't compress if already compressed
        if response.headers.get("Content-Encoding"):
            return False

        # Only compress text-based content
        content_type = response.headers.get("Content-Type", "")
        compressible_types = [
            "text/",
            "application/json",
            "application/javascript",
            "application/xml",
            "application/xhtml+xml",
        ]

        return any(content_type.startswith(t) for t in compressible_types)

