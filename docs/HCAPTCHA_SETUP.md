# hCaptcha Integration Guide

Complete guide to integrating hCaptcha (free tier) for bot protection in Crypto-Orchestrator.

## Why hCaptcha?

hCaptcha is a privacy-focused alternative to Google reCAPTCHA with several advantages:

- **Privacy-First**: GDPR compliant, doesn't track users across sites
- **Better User Experience**: More accessible, easier challenges
- **Free Tier**: 100K requests/month (no credit card required)
- **Earn Revenue**: Optional - earn money from solving challenges
- **Open Source Friendly**: Better terms for open-source projects

**Cost: $0/month** (Free tier is sufficient for most projects)

---

## Step 1: Create hCaptcha Account

### Sign Up

1. Go to [hCaptcha](https://www.hcaptcha.com)
2. Click "Sign Up"
3. Register with your email (no credit card required)
4. Verify your email address

### Dashboard Access

After verification, you'll have access to the hCaptcha dashboard:
- https://dashboard.hcaptcha.com

---

## Step 2: Create a New Site

### Add Your Site

1. Log in to [hCaptcha Dashboard](https://dashboard.hcaptcha.com)
2. Click "New Site" (or "Sites" → "Add Site")
3. Configure:
   - **Site Name**: Crypto-Orchestrator
   - **Hostnames**: Add your domains:
     - `localhost` (for development)
     - `cryptoorchestrator.com`
     - `www.cryptoorchestrator.com`
     - `*.netlify.app` (if using Netlify)
     - `*.pages.dev` (if using Cloudflare Pages)
4. Click "Save"

### Get Your Keys

After creating the site, you'll receive:

1. **Site Key** (Public): Use in frontend HTML/JavaScript
   - Format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - Safe to expose in client-side code

2. **Secret Key** (Private): Use in backend for verification
   - Format: `0xXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
   - **Never expose in frontend code!**

Save both keys securely.

---

## Step 3: Configure Backend Integration

### Add Environment Variables

Add to your `.env` file (or hosting platform):

```bash
# hCaptcha Configuration
HCAPTCHA_SITE_KEY=your_site_key_here
HCAPTCHA_SECRET_KEY=your_secret_key_here
HCAPTCHA_VERIFY_URL=https://api.hcaptcha.com/siteverify
```

### Install Python Dependencies

hCaptcha verification requires HTTP requests. We already have `httpx` in requirements.txt.

### Create hCaptcha Verification Service

Create: `server_fastapi/services/captcha_service.py`

```python
"""
hCaptcha verification service
"""
import httpx
import logging
from typing import Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class CaptchaVerificationResult(BaseModel):
    """Result of captcha verification"""
    success: bool
    error_codes: list[str] = []
    hostname: Optional[str] = None
    challenge_ts: Optional[str] = None


class CaptchaService:
    """Service for verifying hCaptcha responses"""
    
    def __init__(self, secret_key: str, verify_url: str = "https://api.hcaptcha.com/siteverify"):
        self.secret_key = secret_key
        self.verify_url = verify_url
    
    async def verify(
        self,
        captcha_response: str,
        remote_ip: Optional[str] = None
    ) -> CaptchaVerificationResult:
        """
        Verify hCaptcha response
        
        Args:
            captcha_response: The h-captcha-response from the form
            remote_ip: User's IP address (optional but recommended)
        
        Returns:
            CaptchaVerificationResult with success status
        """
        try:
            # Prepare verification data
            data = {
                "secret": self.secret_key,
                "response": captcha_response,
            }
            
            if remote_ip:
                data["remoteip"] = remote_ip
            
            # Send verification request
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.verify_url,
                    data=data,
                    timeout=10.0
                )
                
                if response.status_code != 200:
                    logger.error(f"hCaptcha verification failed: {response.status_code}")
                    return CaptchaVerificationResult(
                        success=False,
                        error_codes=["api-error"]
                    )
                
                result = response.json()
                
                # Parse response
                return CaptchaVerificationResult(
                    success=result.get("success", False),
                    error_codes=result.get("error-codes", []),
                    hostname=result.get("hostname"),
                    challenge_ts=result.get("challenge_ts")
                )
        
        except httpx.TimeoutException:
            logger.error("hCaptcha verification timeout")
            return CaptchaVerificationResult(
                success=False,
                error_codes=["timeout-or-duplicate"]
            )
        
        except Exception as e:
            logger.error(f"hCaptcha verification error: {str(e)}")
            return CaptchaVerificationResult(
                success=False,
                error_codes=["internal-error"]
            )
```

### Update Main Application

Update `server_fastapi/main.py`:

```python
import os
from .services.captcha_service import CaptchaService

# Initialize hCaptcha service
captcha_service = None
if os.getenv("HCAPTCHA_SECRET_KEY"):
    captcha_service = CaptchaService(
        secret_key=os.getenv("HCAPTCHA_SECRET_KEY"),
        verify_url=os.getenv("HCAPTCHA_VERIFY_URL", "https://api.hcaptcha.com/siteverify")
    )

# Dependency for captcha verification
def get_captcha_service() -> CaptchaService:
    if not captcha_service:
        raise HTTPException(status_code=500, detail="Captcha service not configured")
    return captcha_service
```

### Add Captcha Verification to Auth Routes

Update `server_fastapi/routes/auth.py`:

```python
from fastapi import Depends, Request
from ..services.captcha_service import CaptchaService
from ..main import get_captcha_service


class LoginRequest(BaseModel):
    email: str
    password: str
    captcha_response: str  # Add this field


@router.post("/login")
async def login(
    request: Request,
    data: LoginRequest,
    captcha_service: CaptchaService = Depends(get_captcha_service)
):
    """Login with captcha verification"""
    
    # Verify captcha first
    client_ip = request.client.host
    captcha_result = await captcha_service.verify(
        captcha_response=data.captcha_response,
        remote_ip=client_ip
    )
    
    if not captcha_result.success:
        logger.warning(f"Captcha verification failed: {captcha_result.error_codes}")
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Captcha verification failed",
                "errors": captcha_result.error_codes
            }
        )
    
    # Continue with login logic...
    # ... existing login code ...
```

### Apply to Other Protected Routes

Add captcha verification to:
- Registration (`/api/auth/register`)
- Password reset (`/api/auth/reset-password`)
- Contact form (if applicable)
- Any other public forms

---

## Step 4: Configure Frontend Integration

### Install hCaptcha React Component

```bash
npm install @hcaptcha/react-hcaptcha --legacy-peer-deps
```

### Create Environment Variable

Add to `.env` (frontend):

```bash
VITE_HCAPTCHA_SITE_KEY=your_site_key_here
```

### Create hCaptcha Component

Create: `client/src/components/HCaptcha.tsx`

```typescript
import React, { useRef } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';

interface HCaptchaComponentProps {
  onVerify: (token: string) => void;
  onError?: (error: string) => void;
  onExpire?: () => void;
}

export const HCaptchaComponent: React.FC<HCaptchaComponentProps> = ({
  onVerify,
  onError,
  onExpire,
}) => {
  const captchaRef = useRef<HCaptcha>(null);
  const siteKey = import.meta.env.VITE_HCAPTCHA_SITE_KEY;

  if (!siteKey) {
    console.error('hCaptcha site key not configured');
    return null;
  }

  return (
    <HCaptcha
      ref={captchaRef}
      sitekey={siteKey}
      onVerify={onVerify}
      onError={onError}
      onExpire={onExpire}
    />
  );
};
```

### Update Login Form

Update `client/src/pages/auth/Login.tsx`:

```typescript
import { HCaptchaComponent } from '@/components/HCaptcha';
import { useState } from 'react';

export default function Login() {
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const handleCaptchaVerify = (token: string) => {
    setCaptchaToken(token);
  };

  const handleCaptchaError = (error: string) => {
    console.error('Captcha error:', error);
    setCaptchaToken(null);
  };

  const handleCaptchaExpire = () => {
    console.warn('Captcha expired');
    setCaptchaToken(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!captchaToken) {
      alert('Please complete the captcha');
      return;
    }

    // Send login request with captcha token
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        captcha_response: captchaToken,
      }),
    });

    // Handle response...
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Email and password fields */}
      
      {/* Add hCaptcha */}
      <HCaptchaComponent
        onVerify={handleCaptchaVerify}
        onError={handleCaptchaError}
        onExpire={handleCaptchaExpire}
      />
      
      <button type="submit" disabled={!captchaToken}>
        Login
      </button>
    </form>
  );
}
```

### Apply to Other Forms

Add HCaptchaComponent to:
- Registration form
- Password reset form
- Contact form

---

## Step 5: Styling and Customization

### Theme Configuration

hCaptcha supports light and dark themes:

```typescript
<HCaptcha
  sitekey={siteKey}
  theme="dark"  // or "light"
  size="normal"  // or "compact", "invisible"
  onVerify={onVerify}
/>
```

### Size Options

- **normal**: Standard size (default)
- **compact**: Smaller size for mobile
- **invisible**: No visible widget (triggers automatically)

### Custom Styling

Wrap in a styled container:

```tsx
<div className="captcha-container">
  <HCaptcha sitekey={siteKey} onVerify={onVerify} />
</div>
```

```css
.captcha-container {
  display: flex;
  justify-content: center;
  margin: 1rem 0;
}
```

---

## Step 6: Testing

### Test in Development

1. Start your backend:
   ```bash
   npm run dev:fastapi
   ```

2. Start your frontend:
   ```bash
   npm run dev
   ```

3. Navigate to login page
4. Complete the captcha challenge
5. Submit the form
6. Check backend logs for verification success

### Test Error Handling

1. **Missing Token**: Try submitting without captcha
2. **Invalid Token**: Manually set an invalid token
3. **Expired Token**: Wait for token to expire (120 seconds)
4. **Network Error**: Disconnect network and try

### Monitor Dashboard

Check [hCaptcha Dashboard](https://dashboard.hcaptcha.com):
- View request counts
- Check success rate
- Monitor errors
- Analyze traffic patterns

---

## Step 7: Production Deployment

### Update Environment Variables

#### Backend (Render/Koyeb)

Add to your hosting platform:
```bash
HCAPTCHA_SECRET_KEY=0xXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
HCAPTCHA_SITE_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

#### Frontend (Netlify/Cloudflare Pages)

Add to your hosting platform:
```bash
VITE_HCAPTCHA_SITE_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Verify Hostnames

In [hCaptcha Dashboard](https://dashboard.hcaptcha.com):
1. Go to your site settings
2. Add production domains:
   - `cryptoorchestrator.com`
   - `www.cryptoorchestrator.com`
   - Your actual frontend URL

---

## Step 8: Advanced Configuration

### Invisible Captcha

For a seamless experience, use invisible captcha:

```typescript
<HCaptcha
  sitekey={siteKey}
  size="invisible"
  onVerify={onVerify}
  ref={captchaRef}
/>

// Trigger programmatically
const handleSubmit = () => {
  captchaRef.current?.execute();
};
```

### Custom Language

Support multiple languages:

```typescript
<HCaptcha
  sitekey={siteKey}
  languageOverride="es"  // Spanish
  onVerify={onVerify}
/>
```

Supported languages: en, de, fr, es, it, pt, ru, zh-CN, zh-TW, ja, ko, and more.

### Custom Callback URL

For advanced use cases:

```typescript
<HCaptcha
  sitekey={siteKey}
  endpoint="https://api.hcaptcha.com/getcaptcha"
  onVerify={onVerify}
/>
```

---

## Error Codes Reference

Common hCaptcha error codes:

| Code | Meaning | Action |
|------|---------|--------|
| `missing-input-secret` | Secret key missing | Check environment variables |
| `invalid-input-secret` | Secret key invalid | Verify secret key |
| `missing-input-response` | No captcha response | User didn't complete captcha |
| `invalid-input-response` | Invalid response | Token expired or tampered |
| `bad-request` | Malformed request | Check API call format |
| `invalid-or-already-seen-response` | Token reused | User submitted twice |
| `not-using-dummy-passcode` | Test mode issue | Only in development |
| `sitekey-secret-mismatch` | Keys don't match | Check site/secret key pair |

---

## Monitoring and Analytics

### Dashboard Metrics

Monitor in [hCaptcha Dashboard](https://dashboard.hcaptcha.com):

1. **Request Volume**: Total captcha requests
2. **Success Rate**: Percentage of successful verifications
3. **Error Rate**: Failed verification attempts
4. **Bot Detection**: Suspected bot traffic blocked
5. **Geographic Distribution**: Where requests come from

### Set Up Alerts

1. Go to Dashboard → Settings → Notifications
2. Enable alerts for:
   - High error rates
   - Unusual traffic patterns
   - Quota approaching (if on paid plan)

---

## Best Practices

### Security

✅ **Do:**
- Always verify on backend (never trust frontend)
- Use HTTPS for all requests
- Store secret key securely (environment variables)
- Log verification failures for analysis
- Implement rate limiting alongside captcha

❌ **Don't:**
- Expose secret key in frontend code
- Skip backend verification
- Reuse captcha tokens
- Disable for testing in production
- Trust client-side validation alone

### User Experience

✅ **Do:**
- Show captcha only on sensitive actions (login, register)
- Use invisible captcha when possible
- Provide clear error messages
- Support keyboard navigation
- Test accessibility

❌ **Don't:**
- Show captcha on every page
- Block users after one failed captcha
- Use captcha on read-only pages
- Ignore accessibility concerns
- Make captcha too difficult

### Performance

✅ **Do:**
- Load hCaptcha script asynchronously
- Cache verification results (short TTL)
- Set reasonable timeouts
- Monitor verification latency

❌ **Don't:**
- Block page load waiting for captcha
- Verify every request (use sessions)
- Set very long timeouts
- Ignore performance metrics

---

## Troubleshooting

### Captcha Not Loading

1. Check site key is correct
2. Verify domain is whitelisted
3. Check browser console for errors
4. Try disabling ad blockers
5. Check network connectivity

### Verification Always Failing

1. Verify secret key is correct
2. Check backend logs for errors
3. Ensure captcha response is sent
4. Test with curl:
   ```bash
   curl -X POST https://api.hcaptcha.com/siteverify \
     -d "secret=YOUR_SECRET" \
     -d "response=USER_RESPONSE"
   ```

### High Error Rate

1. Check for token expiration (120 seconds)
2. Verify tokens aren't being reused
3. Check for bot traffic patterns
4. Review firewall/proxy settings

---

## Free Tier Limits

| Metric | Free Tier | Notes |
|--------|-----------|-------|
| Requests | 100,000/month | More than enough for most sites |
| Domains | Unlimited | Add as many as needed |
| Support | Community | Email support available |
| Analytics | Basic | Request counts and errors |
| Customization | Full | All features available |

### When to Upgrade

Consider upgrading to paid plans if:
- You exceed 100K requests/month
- You need priority support
- You want advanced analytics
- You require SLA guarantees
- You need custom solutions

---

## Testing Checklist

- [ ] hCaptcha loads correctly on all forms
- [ ] Verification succeeds with valid token
- [ ] Verification fails with invalid token
- [ ] Expired tokens are rejected
- [ ] Error messages are user-friendly
- [ ] Backend logging works correctly
- [ ] Rate limiting works alongside captcha
- [ ] Accessibility features work (keyboard, screen reader)
- [ ] Mobile responsive design
- [ ] Dark mode support (if applicable)

---

## Resources

- [hCaptcha Documentation](https://docs.hcaptcha.com/)
- [hCaptcha React Component](https://github.com/hCaptcha/react-hcaptcha)
- [hCaptcha Dashboard](https://dashboard.hcaptcha.com)
- [hCaptcha Status](https://status.hcaptcha.com/)
- [Privacy Policy](https://www.hcaptcha.com/privacy)

---

## Support

If you encounter issues:
1. Check [hCaptcha Documentation](https://docs.hcaptcha.com/)
2. Search [GitHub Issues](https://github.com/hCaptcha/hcaptcha-issues)
3. Contact [hCaptcha Support](https://www.hcaptcha.com/contact)
4. Ask in [Community Forum](https://community.hcaptcha.com/)

---

## Next Steps

1. ✅ Complete hCaptcha integration
2. Test thoroughly in development
3. Deploy to production
4. Monitor dashboard for analytics
5. Set up alerts for unusual activity
6. Consider invisible captcha for better UX
