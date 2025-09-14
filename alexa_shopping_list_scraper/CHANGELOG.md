## 1.1.4

- **Startup Debug Prints**
  - Print debug-start context (cookies.json presence/size, webhook set, target URL) before each cycle when Debug_Log is true.
  - Add DEBUG banner at scraper start so users see that verbose logging is active immediately.
## 1.1.3

- **Debug and Stability**
  - Added explicit DEBUG banners and navigation logs so users see when debug is active and where the scraper is going.
  - Clearer cookie error messages; normalized cookie import already in prior release.
  - No screenshots or web server, logs only.
# Changelog

## 1.1.2

- **Cookie-based Authentication (polish)**
  - Cleaned up configuration to only require Cookies_JSON, HA_Webhook_URL, Amazon_Shopping_List_Page, Pooling_Interval, Delete_After_Download, Debug_Log.
  - Removed all legacy login/2FA options from config and env generation.
  - Normalize exported cookies (expirationDate→expires, sameSite) for Puppeteer; persist profile under /data.
  - Removed mini_httpd debug web server.

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
 
