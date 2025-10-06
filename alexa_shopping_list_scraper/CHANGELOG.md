## 1.1.1

- **Fix external webhook URL authentication**
  - Fixed 401 Unauthorized error when using external HTTPS webhook URLs
  - External URLs (starting with http:// or https://) now bypass supervisor routing and Bearer token authentication
  - Webhooks are accessed directly as intended, secured only by their unique webhook ID

## 1.1.0

- **Cookie-only overhaul**
  - Remove legacy email/password/OTP and sign-in URL options
  - Enforce cookie-only authentication in scraper (no fallback)
  - Early validation for HA_Webhook_URL and cookies presence on startup
  - README rewritten for cookie export/setup; config cleaned
  - Remove otpauth dependency
- **Reliable webhook posting under Supervisor**
  - If SUPERVISOR_TOKEN is present and a webhook id can be parsed, post to `http://supervisor/core/api/webhook/<id>` with Authorization header
  - Still accepts full external URLs if preferred
- **Revert to direct webhook URL posting**
  - Mirror older working behavior by posting directly to `HA_Webhook_URL`

## 1.0.45

- **Fix ENOENT for debug screenshots**
  - Ensure `www/` is created before any screenshot writes on the stable branch.
# Changelog

## 1.0.44

- **Cookie Import & Verbose Logging**
  - Add Cookies_JSON write to /data/cookies.json and import cookies in scraper to skip login when valid.
  - Add step-by-step logs: cookie sample, navigation steps, login flow, selector waits.
  - Keep legacy login/OTP as fallback when cookies are missing/invalid.

## 1.0.42

- **Critical Performance Fix**
  - Refactored main execution loop to eliminate a "busy-wait" bug that caused high, persistent CPU usage while the add-on was supposed to be sleeping.

## 1.0.41

- **Major Logging Overhaul**
  - Cleaned up noisy debug logs by removing redundant package installations and system error messages.
  - Added clear, concise logging for normal operation (e.g., "Found 5 items", "Transferred item: 'Milk'").
  - Re-formatted debug output to be clean and human-readable.
- **Fix Scraper Reliability**
  - Resolves a race condition where items were missed by implementing a scrolling mechanism to ensure the entire virtual list is loaded before scraping.
  - Fixes a latent bug causing intermittent 2FA failures by generating the OTP token just-in-time, preventing the use of a stale token during login.

## 1.0.39

- Patched puppeteer chromium dependency conflict to fix add-on startup.
- Refactored Dockerfile for build stability and improved caching.

## 1.0.38

- If Pooling_Internal is set to Zero, the AddOn will start, run and then stop.

## 1.0.32

- Fixed timeout issues for non US URLs (i.e. https://www.amazon.de)

## 1.0.31

- Added Home Assistant Blueprint to Repository (Thanks to [N1c093](https://github.com/N1c093))

## 1.0.30

- Fix issues with the Browser and ARM Platform

## 1.0.29

- Added "Delete_After_Download" option to delete items<br>after they were pulled from Amazon List and added to Home Assistant<br>  (Thanks to [stefangries](https://github.com/stefangries))
 
