# Changelog

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
 
