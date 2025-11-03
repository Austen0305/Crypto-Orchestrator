from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
import bcrypt
import jwt
import speakeasy
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
import logging

# Import shared schemas (we'll need to convert them to Pydantic)
from shared.schema import RegisterRequest, LoginRequest

logger = logging.getLogger(__name__)

router = APIRouter()
security = HTTPBearer()

# Environment variables
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")

# Pydantic models (using shared schemas)

class MFATokenRequest(BaseModel):
    userId: int
    token: str

class EnableMFARequest(BaseModel):
    token: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    newPassword: str

class UpdateProfileRequest(BaseModel):
    name: str

class RefreshTokenRequest(BaseModel):
    refreshToken: str

class LogoutRequest(BaseModel):
    refreshToken: Optional[str] = None

class VerifyEmailRequest(BaseModel):
    token: str

class ResendVerificationRequest(BaseModel):
    email: EmailStr

# Mock email service for development
class MockEmailService:
    def __init__(self, smtp_host: str = None, smtp_user: str = None, smtp_pass: str = None):
        self.smtp_host = smtp_host
        self.smtp_user = smtp_user
        self.smtp_pass = smtp_pass
        logger.info("MockEmailService initialized - no real emails will be sent")

    def send_verification_email(self, email: str, token: str):
        """Mock sending verification email - logs instead of sending"""
        logger.info(f"[MOCK EMAIL] Verification email would be sent to {email}")
        logger.info(f"[MOCK EMAIL] Token: {token}")
        logger.info(f"[MOCK EMAIL] Link: http://localhost:3000/verify-email?token={token}")
        return True

    def send_password_reset_email(self, email: str, token: str):
        """Mock sending password reset email - logs instead of sending"""
        logger.info(f"[MOCK EMAIL] Password reset email would be sent to {email}")
        logger.info(f"[MOCK EMAIL] Token: {token}")
        logger.info(f"[MOCK EMAIL] Link: http://localhost:3000/reset-password?token={token}")
        return True

# Mock storage - replace with actual database implementation
class MockStorage:
    def __init__(self):
        self.users = {}
        self.refresh_tokens = {}
        # Seed with default user for testing
        self._seed_default_user()

    def _seed_default_user(self):
        """Seed the storage with a default user for testing purposes."""
        hashed_password = bcrypt.hashpw("password123".encode(), bcrypt.gensalt()).decode()
        default_user = {
            'id': 1,
            'email': 'test@example.com',
            'name': 'Test User',
            'passwordHash': hashed_password,
            'emailVerified': True,
            'mfaEnabled': False,
            'mfaSecret': None,
            'createdAt': datetime.now(timezone.utc).isoformat()
        }
        self.users[1] = default_user

    def getUserByEmail(self, email: str):
        return next((user for user in self.users.values() if user.get('email') == email), None)

    def getUserByUsername(self, username: str):
        return next((user for user in self.users.values() if user.get('username') == username), None)

    def getUserById(self, user_id: int):
        return self.users.get(user_id)

    def createUser(self, user_data):
        user_id = len(self.users) + 1
        user = {
            'id': user_id,
            'email': user_data['email'],
            'name': user_data['name'],
            'passwordHash': user_data['passwordHash'],
            'emailVerified': False,
            'mfaEnabled': False,
            'mfaSecret': None,
            'createdAt': datetime.now(timezone.utc).isoformat()
        }
        self.users[user_id] = user
        return user

    def updateUser(self, user_id: int, updates: dict):
        if user_id in self.users:
            self.users[user_id].update(updates)
            return True
        return False

    def storeRefreshToken(self, user_id: int, token: str):
        if user_id not in self.refresh_tokens:
            self.refresh_tokens[user_id] = []
        self.refresh_tokens[user_id].append(token)

    def getRefreshToken(self, user_id: int, token: str):
        return token in self.refresh_tokens.get(user_id, [])

    def updateRefreshToken(self, user_id: int, old_token: str, new_token: str):
        if user_id in self.refresh_tokens:
            tokens = self.refresh_tokens[user_id]
            if old_token in tokens:
                tokens.remove(old_token)
                tokens.append(new_token)

    def removeRefreshToken(self, user_id: int, token: str):
        if user_id in self.refresh_tokens:
            tokens = self.refresh_tokens[user_id]
            if token in tokens:
                tokens.remove(token)

storage = MockStorage()

# Initialize mock email service
email_service = MockEmailService(SMTP_HOST, SMTP_USER, SMTP_PASS)

# Mock auth service - replace with actual implementation
class MockAuthService:
    def register(self, data):
        # Check if user exists
        existing = storage.getUserByEmail(data['email'])
        if existing:
            raise HTTPException(status_code=400, detail="User already exists")

        # Hash password
        hashed = bcrypt.hashpw(data['password'].encode(), bcrypt.gensalt()).decode()

        # Create user
        user = storage.createUser({
            'email': data['email'],
            'name': data['name'],
            'passwordHash': hashed
        })

        return {
            'message': 'User registered successfully',
            'user': user
        }

    def verifyEmail(self, token: str):
        try:
            decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            if decoded.get('type') != 'email_verification':
                return {'success': False, 'message': 'Invalid token type'}

            user = storage.getUserById(decoded['id'])
            if not user:
                return {'success': False, 'message': 'User not found'}

            # Check if already verified
            if user.get('emailVerified'):
                return {'success': False, 'message': 'Email already verified'}

            storage.updateUser(user['id'], {'emailVerified': True})
            return {'success': True, 'message': 'Email verified successfully', 'user_id': user['id']}
        except jwt.ExpiredSignatureError:
            return {'success': False, 'message': 'Verification token expired'}
        except jwt.InvalidTokenError:
            return {'success': False, 'message': 'Invalid verification token'}

    def resendVerificationEmail(self, email: str):
        user = storage.getUserByEmail(email)
        if not user:
            return {'success': False, 'message': 'User not found'}

        # Check if email is already verified
        if user.get('emailVerified'):
            return {'success': False, 'message': 'Email already verified'}

        # Generate verification token with expiration
        token = jwt.encode(
            {'id': user['id'], 'type': 'email_verification', 'exp': datetime.now(timezone.utc) + timedelta(hours=24)},
            JWT_SECRET,
            algorithm="HS256"
        )

        # Send verification email using mock service
        email_service.send_verification_email(email, token)

        return {'success': True, 'message': 'Verification email sent'}

# Initialize services
auth_service = MockAuthService()

# Helper functions
def generate_token(user: dict) -> str:
    return jwt.encode(
        {
            'id': user['id'],
            'email': user['email'],
            'exp': datetime.now(timezone.utc) + timedelta(minutes=15)
        },
        JWT_SECRET,
        algorithm="HS256"
    )

def generate_refresh_token(user: dict) -> str:
    return jwt.encode(
        {
            'id': user['id'],
            'type': 'refresh',
            'exp': datetime.now(timezone.utc) + timedelta(days=7)
        },
        JWT_SECRET,
        algorithm="HS256"
    )

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user = storage.getUserById(payload['id'])
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Routes
@router.post("/register")
async def register(request: RegisterRequest):
    logger.info(f"Registration request received for email: {request.email}")
    try:
        result = auth_service.register({
            'email': request.email,
            'password': request.password,
            'name': request.name
        })

        # Generate verification token for email verification
        user = result['user']
        verification_token = jwt.encode(
            {'id': user['id'], 'type': 'email_verification', 'exp': datetime.now(timezone.utc) + timedelta(hours=24)},
            JWT_SECRET,
            algorithm="HS256"
        )

        # Send verification email
        email_service.send_verification_email(user['email'], verification_token)

        # Generate temporary token (expires in 15 minutes, pending email verification)
        token = generate_token(user)

        logger.info(f"Registration successful for user ID: {user['id']}")

        return {
            "data": {
                "user": {
                    "id": user['id'],
                    "email": user['email'],
                    "name": user['name'],
                    "emailVerified": user['emailVerified']
                },
                "token": token,
                "message": "Please check your email to verify your account"
            }
        }
    except HTTPException:
        logger.warning(f"Registration failed for email {request.email}: HTTPException")
        raise
    except Exception as e:
        logger.error(f"Registration failed for email {request.email}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login")
async def login(request: LoginRequest):
    logger.info(f"Login request received for email/username: {request.email or request.username}")

    # Find user
    user = None
    if request.email:
        user = storage.getUserByEmail(request.email)
    elif request.username:
        user = storage.getUserByUsername(request.username)

    if not user or not user.get('passwordHash'):
        logger.warning(f"Login failed: Invalid credentials for {request.email or request.username}")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Verify password
    if not bcrypt.checkpw(request.password.encode(), user['passwordHash'].encode()):
        logger.warning(f"Login failed: Invalid password for user {user['id']}")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Check MFA
    if user.get('mfaEnabled') and user.get('mfaSecret'):
        logger.info(f"MFA required for user {user['id']}")
        return {
            "requiresMfa": True,
            "userId": user['id']
        }

    # Generate tokens
    token = generate_token(user)
    refresh_token = generate_refresh_token(user)

    # Store refresh token
    storage.storeRefreshToken(user['id'], refresh_token)

    logger.info(f"Login successful for user {user['id']}")

    return {
        "data": {
            "user": {
                "id": user['id'],
                "email": user['email'],
                "name": user['name']
            },
            "token": token,
            "refreshToken": refresh_token
        }
    }

@router.post("/verify-mfa")
async def verify_mfa(request: MFATokenRequest):
    user = storage.getUserById(request.userId)
    if not user or not user.get('mfaSecret'):
        raise HTTPException(status_code=400, detail="Invalid user or MFA not enabled")

    verified = speakeasy.totp.verify({
        'secret': user['mfaSecret'],
        'encoding': 'base32',
        'token': request.token,
        'window': 2
    })

    if not verified:
        raise HTTPException(status_code=401, detail="Invalid MFA token")

    token = generate_token(user)
    refresh_token = generate_refresh_token(user)
    storage.storeRefreshToken(user['id'], refresh_token)

    return {
        "data": {
            "user": {
                "id": user['id'],
                "email": user['email'],
                "name": user['name']
            },
            "token": token,
            "refreshToken": refresh_token
        }
    }

@router.post("/setup-mfa")
async def setup_mfa(current_user: dict = Depends(get_current_user)):
    secret = speakeasy.generate_secret({
        'name': f"CryptoOrchestrator ({current_user['email']})",
        'issuer': 'CryptoOrchestrator'
    })

    storage.updateUser(current_user['id'], {
        'mfaSecret': secret['base32'],
        'mfaEnabled': False
    })

    return {
        "secret": secret['base32'],
        "otpauthUrl": secret['otpauth_url']
    }

@router.post("/enable-mfa")
async def enable_mfa(request: EnableMFARequest, current_user: dict = Depends(get_current_user)):
    db_user = storage.getUserById(current_user['id'])
    if not db_user or not db_user.get('mfaSecret'):
        raise HTTPException(status_code=400, detail="MFA not set up")

    verified = speakeasy.totp.verify({
        'secret': db_user['mfaSecret'],
        'encoding': 'base32',
        'token': request.token,
        'window': 2
    })

    if not verified:
        raise HTTPException(status_code=401, detail="Invalid MFA token")

    storage.updateUser(current_user['id'], {'mfaEnabled': True})
    return {"message": "MFA enabled successfully"}

@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    user = storage.getUserByEmail(request.email)
    if not user:
        # Don't reveal if user exists
        return {"message": "If the email exists, a reset link has been sent"}

    # Check if email is verified
    if not user.get('emailVerified'):
        return {"message": "Please verify your email first before resetting password"}

    # Generate reset token with expiration
    reset_token = jwt.encode(
        {'id': user['id'], 'type': 'password_reset', 'exp': datetime.now(timezone.utc) + timedelta(hours=1)},
        JWT_SECRET,
        algorithm="HS256"
    )

    # Send password reset email using mock service
    email_service.send_password_reset_email(request.email, reset_token)

    return {"message": "If the email exists, a reset link has been sent"}

@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    try:
        decoded = jwt.decode(request.token, JWT_SECRET, algorithms=["HS256"])
        if decoded.get('type') != 'password_reset':
            raise HTTPException(status_code=400, detail="Invalid reset token")

        hashed_password = bcrypt.hashpw(request.newPassword.encode(), bcrypt.gensalt()).decode()
        storage.updateUser(decoded['id'], {'passwordHash': hashed_password})

        return {"message": "Password reset successfully"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Invalid token")

@router.get("/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user['id'],
        "email": current_user['email'],
        "name": current_user['name'],
        "createdAt": current_user['createdAt'],
        "mfaEnabled": current_user.get('mfaEnabled', False)
    }

@router.patch("/profile")
async def update_profile(request: UpdateProfileRequest, current_user: dict = Depends(get_current_user)):
    storage.updateUser(current_user['id'], {'name': request.name})
    return {"message": "Profile updated successfully"}

@router.post("/refresh")
async def refresh_token(request: RefreshTokenRequest):
    try:
        decoded = jwt.decode(request.refreshToken, JWT_SECRET, algorithms=["HS256"])
        if decoded.get('type') != 'refresh':
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        # Check if refresh token exists
        if not storage.getRefreshToken(decoded['id'], request.refreshToken):
            raise HTTPException(status_code=401, detail="Refresh token not found")

        user = storage.getUserById(decoded['id'])
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        # Generate new tokens
        new_access_token = generate_token(user)
        new_refresh_token = generate_refresh_token(user)

        # Update refresh token
        storage.updateRefreshToken(decoded['id'], request.refreshToken, new_refresh_token)

        return {
            "accessToken": new_access_token,
            "refreshToken": new_refresh_token
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

@router.post("/logout")
async def logout(request: LogoutRequest, current_user: dict = Depends(get_current_user)):
    if request.refreshToken:
        storage.removeRefreshToken(current_user['id'], request.refreshToken)
    return {"message": "Logged out successfully"}

@router.post("/verify-email")
async def verify_email(request: VerifyEmailRequest):
    result = auth_service.verifyEmail(request.token)
    if not result['success']:
        raise HTTPException(status_code=400, detail=result['message'])

    # Generate full access token after email verification
    user = storage.getUserById(result['user_id']) if 'user_id' in result else None
    if user:
        token = generate_token(user)
        return {
            "message": result['message'],
            "token": token,
            "emailVerified": True
        }
    return {"message": result['message']}

@router.post("/resend-verification")
async def resend_verification(request: ResendVerificationRequest):
    result = auth_service.resendVerificationEmail(request.email)
    if not result['success']:
        raise HTTPException(status_code=400, detail=result['message'])
    return {"message": result['message']}
