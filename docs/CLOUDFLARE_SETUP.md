# Cloudflare Setup Guide

Complete guide to setting up Cloudflare (free tier) for Crypto-Orchestrator, including DNS, CDN, DDoS protection, and security features.

## Why Cloudflare?

Cloudflare's free tier provides:
- Unlimited bandwidth
- Global CDN with 200+ data centers
- Free SSL certificates (Universal SSL)
- DDoS protection (unmetered)
- Web Application Firewall (WAF)
- DNS management
- Bot protection
- Caching and performance optimization

**Cost: $0/month** (Free tier is sufficient for most projects)

---

## Step 1: Sign Up and Add Your Domain

### Create Cloudflare Account

1. Go to [Cloudflare](https://dash.cloudflare.com/sign-up)
2. Sign up with your email (no credit card required)
3. Verify your email

### Add Your Domain

1. Click "Add site" in the dashboard
2. Enter your domain name (e.g., `cryptoorchestrator.com`)
3. Click "Add site"
4. Select the **Free** plan
5. Click "Continue"

### Update Nameservers

1. Cloudflare will scan your existing DNS records
2. Review the records found
3. Cloudflare will provide two nameservers (e.g., `dave.ns.cloudflare.com`, `edith.ns.cloudflare.com`)
4. Go to your domain registrar (GoDaddy, Namecheap, etc.)
5. Replace your current nameservers with Cloudflare's nameservers
6. Wait for propagation (can take up to 24 hours, usually faster)

### Verify Setup

1. Return to Cloudflare dashboard
2. Click "Check nameservers"
3. Once verified, you'll see "Status: Active"

---

## Step 2: Configure DNS Records

### Add DNS Records

Go to **DNS** → **Records** and add the following:

#### Frontend (Netlify/Cloudflare Pages)

If using Netlify:
```
Type: CNAME
Name: @ (or www)
Content: your-site.netlify.app
Proxy status: Proxied (orange cloud)
TTL: Auto
```

If using Cloudflare Pages:
```
Type: CNAME
Name: @ (or www)
Content: your-project.pages.dev
Proxy status: Proxied (orange cloud)
TTL: Auto
```

#### Backend API Subdomain

```
Type: CNAME
Name: api
Content: your-backend.onrender.com (or .koyeb.app)
Proxy status: Proxied (orange cloud)
TTL: Auto
```

#### WebSocket Subdomain (if needed)

```
Type: CNAME
Name: ws
Content: your-backend.onrender.com
Proxy status: Proxied (orange cloud)
TTL: Auto
```

### DNS Best Practices

- **Use Proxied (Orange Cloud)**: Enables Cloudflare's CDN and security features
- **DNS-only (Grey Cloud)**: Bypasses Cloudflare (not recommended)
- **TTL**: Keep as "Auto" for best performance

---

## Step 3: Configure SSL/TLS

### Enable Full (Strict) SSL

1. Go to **SSL/TLS** → **Overview**
2. Select **Full (strict)** encryption mode
3. This ensures end-to-end encryption

### SSL/TLS Options

- **Off**: Not recommended (no encryption)
- **Flexible**: Encrypts traffic between users and Cloudflare only
- **Full**: Encrypts all traffic, but doesn't validate origin certificate
- **Full (strict)**: Best option - encrypts and validates certificates

### Enable Always Use HTTPS

1. Go to **SSL/TLS** → **Edge Certificates**
2. Enable "Always Use HTTPS"
3. This redirects all HTTP requests to HTTPS

### Enable Automatic HTTPS Rewrites

1. Go to **SSL/TLS** → **Edge Certificates**
2. Enable "Automatic HTTPS Rewrites"
3. Automatically rewrites HTTP URLs to HTTPS

### Enable Certificate Transparency Monitoring

1. Go to **SSL/TLS** → **Edge Certificates**
2. Enable "Certificate Transparency Monitoring"
3. Receive alerts for suspicious certificates

---

## Step 4: Configure Firewall Rules

### Enable WAF Managed Rules

1. Go to **Security** → **WAF**
2. Enable **Cloudflare Managed Ruleset**
3. This protects against OWASP Top 10 vulnerabilities

### Create Custom Firewall Rules

#### Block Bad Bots

1. Go to **Security** → **WAF** → **Custom rules**
2. Click "Create rule"
3. Configure:
   - **Rule name**: Block Bad Bots
   - **Field**: Threat Score
   - **Operator**: Greater than
   - **Value**: 10
   - **Action**: Block

#### Rate Limiting (Login Endpoint)

1. Create another custom rule
2. Configure:
   - **Rule name**: Rate Limit Login
   - **Field**: URI Path
   - **Operator**: equals
   - **Value**: /api/auth/login
   - **Rate**: 5 requests per 1 minute
   - **Action**: Block

#### Geographic Restrictions (Optional)

If you only serve specific countries:

1. Create a custom rule
2. Configure:
   - **Rule name**: Allow Only Specific Countries
   - **Field**: Country
   - **Operator**: is not in
   - **Value**: US, CA, GB, etc.
   - **Action**: Block

---

## Step 5: Configure DDoS Protection

### Automatic DDoS Protection

DDoS protection is automatically enabled on all Cloudflare accounts. No configuration needed!

### Enable Advanced DDoS Alerts (Optional)

1. Go to **Security** → **DDoS**
2. Configure alerts for DDoS attacks
3. Set up email notifications

---

## Step 6: Configure Bot Protection

### Enable Bot Fight Mode (Free)

1. Go to **Security** → **Bots**
2. Enable **Bot Fight Mode**
3. This automatically challenges suspicious bots

### Configure Bot Exceptions

If you have legitimate bots (like monitoring services):

1. Go to **Security** → **WAF** → **Custom rules**
2. Create exception rules for known good bots
3. Example: Allow UptimeRobot monitoring

```
Field: User Agent
Operator: contains
Value: UptimeRobot
Action: Allow
```

---

## Step 7: Configure Caching

### Cache Level

1. Go to **Caching** → **Configuration**
2. Set **Caching Level** to **Standard**
3. This caches static content automatically

### Browser Cache TTL

1. Set **Browser Cache TTL** to **4 hours** (or higher)
2. This tells browsers how long to cache content

### Cache Rules (Page Rules)

Create page rules for optimal caching:

#### Cache Everything (Frontend)

1. Go to **Rules** → **Page Rules**
2. Click "Create Page Rule"
3. Configure:
   - **URL**: `https://cryptoorchestrator.com/*`
   - **Settings**: Cache Level = Cache Everything
   - **Browser Cache TTL**: 4 hours
   - **Edge Cache TTL**: 1 day

#### Bypass Cache (API)

1. Create another page rule
2. Configure:
   - **URL**: `https://api.cryptoorchestrator.com/*`
   - **Settings**: Cache Level = Bypass

#### Cache Static Assets

1. Create another page rule
2. Configure:
   - **URL**: `https://cryptoorchestrator.com/assets/*`
   - **Settings**: Cache Level = Cache Everything
   - **Browser Cache TTL**: 1 month
   - **Edge Cache TTL**: 1 month

---

## Step 8: Configure Speed Optimization

### Enable Auto Minify

1. Go to **Speed** → **Optimization**
2. Enable **Auto Minify** for:
   - JavaScript
   - CSS
   - HTML

### Enable Brotli Compression

1. Go to **Speed** → **Optimization**
2. Enable **Brotli** compression
3. This provides better compression than gzip

### Enable Rocket Loader (Optional)

1. Go to **Speed** → **Optimization**
2. Enable **Rocket Loader**
3. This defers JavaScript loading for faster page loads
4. ⚠️ Test thoroughly - may break some JavaScript functionality

### Enable Early Hints

1. Go to **Speed** → **Optimization**
2. Enable **Early Hints**
3. Improves page load time by preloading resources

---

## Step 9: Configure Security Headers

### Add Security Headers

Go to **Rules** → **Transform Rules** → **Modify Response Header**

#### Add Strict-Transport-Security (HSTS)

```
Header name: Strict-Transport-Security
Value: max-age=31536000; includeSubDomains; preload
```

#### Add X-Frame-Options

```
Header name: X-Frame-Options
Value: DENY
```

#### Add X-Content-Type-Options

```
Header name: X-Content-Type-Options
Value: nosniff
```

#### Add Referrer-Policy

```
Header name: Referrer-Policy
Value: strict-origin-when-cross-origin
```

#### Add Permissions-Policy

```
Header name: Permissions-Policy
Value: camera=(), microphone=(), geolocation=()
```

#### Add Content-Security-Policy

```
Header name: Content-Security-Policy
Value: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.cryptoorchestrator.com wss://api.cryptoorchestrator.com
```

---

## Step 10: Configure Analytics

### Enable Web Analytics

1. Go to **Analytics** → **Web Analytics**
2. Enable analytics for your site
3. Add the analytics script to your frontend (if not using Cloudflare Pages)

### Monitor Traffic

1. Go to **Analytics** → **Traffic**
2. Monitor:
   - Requests
   - Bandwidth
   - Unique visitors
   - Threats blocked

---

## Step 11: Configure Notifications

### Set Up Alerts

1. Go to **Notifications**
2. Add notifications for:
   - **DDoS Attack**: Get notified when under attack
   - **SSL/TLS Certificate**: Expiry alerts
   - **DNS Changes**: Unauthorized changes
   - **Firewall Events**: Security incidents
   - **Health Checks**: Service availability

---

## Step 12: Set Up Health Checks

### Create Health Check

1. Go to **Traffic** → **Health Checks**
2. Click "Create Health Check"
3. Configure:
   - **Name**: Backend API Health
   - **URL**: https://api.cryptoorchestrator.com/health
   - **Interval**: 60 seconds
   - **Method**: GET
   - **Expected Status Code**: 200
4. Add notification channel (email)

---

## Cloudflare Workers (Advanced - Optional)

Cloudflare Workers allow you to run serverless functions on the edge.

### Use Cases

- API rate limiting
- Request/response transformation
- A/B testing
- Geolocation-based routing
- Bot detection

### Example Worker: Rate Limiting

```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const RATE_LIMIT = 100 // requests per minute
  const ip = request.headers.get('CF-Connecting-IP')
  
  // Check rate limit using KV storage
  const key = `rate_limit:${ip}`
  const count = await RATE_LIMIT_STORE.get(key)
  
  if (count && parseInt(count) > RATE_LIMIT) {
    return new Response('Rate limit exceeded', { status: 429 })
  }
  
  // Increment counter
  const newCount = count ? parseInt(count) + 1 : 1
  await RATE_LIMIT_STORE.put(key, newCount.toString(), {
    expirationTtl: 60 // 1 minute
  })
  
  // Forward request
  return fetch(request)
}
```

---

## Configuration Summary

### Free Tier Limits

| Feature | Free Tier |
|---------|-----------|
| Bandwidth | Unlimited |
| DDoS Protection | Unmetered |
| SSL Certificates | Unlimited |
| Firewall Rules | 5 custom rules |
| Page Rules | 3 rules |
| Workers | 100,000 requests/day |
| Health Checks | 1 check |
| Analytics | Basic analytics |

### Best Practices

✅ **Do:**
- Use proxied DNS records (orange cloud)
- Enable Full (strict) SSL mode
- Configure security headers
- Set up health checks
- Enable bot protection
- Use caching for static assets
- Monitor analytics regularly

❌ **Don't:**
- Use Flexible SSL mode (security risk)
- Disable WAF protection
- Cache API responses
- Expose origin server IPs
- Ignore security alerts

---

## Troubleshooting

### Site Not Loading

1. Check nameserver propagation: https://www.whatsmydns.net
2. Verify DNS records are correct
3. Check SSL/TLS mode (should be Full or Full (strict))
4. Disable Cloudflare proxy temporarily to isolate issue

### API Requests Failing

1. Check CORS settings in backend
2. Verify API subdomain DNS record
3. Check firewall rules aren't blocking legitimate requests
4. Disable bot protection temporarily to test

### SSL Certificate Errors

1. Verify SSL/TLS mode is Full (strict)
2. Check origin server has valid SSL certificate
3. Clear browser cache and try again
4. Check certificate transparency logs

### Slow Performance

1. Check cache hit rate in analytics
2. Verify caching rules are configured
3. Enable Auto Minify and Brotli compression
4. Consider enabling Argo Smart Routing (paid feature)

---

## Testing Your Setup

### SSL Test

```bash
curl -I https://cryptoorchestrator.com
```

Check for:
- Status: 200 OK
- `Strict-Transport-Security` header
- `CF-Cache-Status` header

### Security Headers Test

Use [SecurityHeaders.com](https://securityheaders.com) to scan your site.
Goal: A+ rating

### Performance Test

Use [GTmetrix](https://gtmetrix.com) or [Google PageSpeed Insights](https://pagespeed.web.dev) to test performance.
Goal: 90+ score

### DDoS Test

**⚠️ Do NOT perform actual DDoS tests!**

Instead, use Cloudflare's analytics to verify DDoS protection is active.

---

## Monitoring Dashboard

### Key Metrics to Monitor

1. **Traffic Analytics**:
   - Total requests
   - Bandwidth usage
   - Unique visitors
   - Threat insights

2. **Security Events**:
   - Firewall events
   - Bot traffic
   - DDoS attacks blocked

3. **Performance**:
   - Cache hit rate
   - Origin response time
   - SSL/TLS performance

---

## Next Steps

1. ✅ Complete Cloudflare setup
2. Set up monitoring with UptimeRobot (see [FREE_STACK_DEPLOYMENT.md](./FREE_STACK_DEPLOYMENT.md))
3. Configure hCaptcha (see [HCAPTCHA_SETUP.md](./HCAPTCHA_SETUP.md))
4. Deploy backend and frontend
5. Test end-to-end functionality

---

## Resources

- [Cloudflare Documentation](https://developers.cloudflare.com/docs)
- [Cloudflare Learning Center](https://www.cloudflare.com/learning/)
- [Cloudflare Community](https://community.cloudflare.com/)
- [Cloudflare Status](https://www.cloudflarestatus.com/)

---

## Support

If you encounter issues:
1. Check [Cloudflare Status](https://www.cloudflarestatus.com/) for outages
2. Search [Cloudflare Community](https://community.cloudflare.com/)
3. Contact Cloudflare support (even on free plan!)
4. Review audit logs in your dashboard
