## 1.2.2

- **Fix bot detection issues with comprehensive diagnostics**
  - Aggressive cookie/storage overrides to bypass Amazon's JavaScript checks
  - Comprehensive testing of `navigator.cookieEnabled`, `document.cookie`, localStorage, sessionStorage
  - Intelligent error diagnosis distinguishes cookie vs credential failures
  - Automatic cookie warning workaround with page reload
  - Full HTML dumps on error (debug mode)
  - Cookie file only written for cookie-based/auto authentication methods

## 1.2.1

- **improved scraping error logging and automatic retries**: no longer aborts on scrape failure but sleeps and retries; better error logging for item extraction

## 1.2.0

- **Dropped `Cookies_Path`; only use `Cookies_JSON`**: The Home Assistant add-on now accepts cookies only via the `Cookies_JSON` parameter. This simplifies configuration and avoids file path issues in containerized environments.
- **Removed `Cookies_Path` from config**: The option to use `Cookies_Path` is no longer available in the add-on configuration.

## 1.1.7

- **Bugfix for the case when website redirects to the login-page**: Added logic to detect whether the scraper is on the sign-in page after loading the shopping list URL. If so, authentication likely failed (cookies expired or invalid), and the script exits with an informative error message.

## 1.1.6

- **Added scraper user agent header and debugging improvements**: The scraper now sets a consistent user agent string (`'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36'`) to mimic a real browser. This helps avoid potential detection or issues with Amazon's server. Debug logging also includes more details about the HTTP requests, page navigation, and the final list of items found, making troubleshooting easier.

## 1.1.5

- **Enhanced debugging and dynamic wait**: Introduced an optional `Debug_Log` parameter (default: `false`). When enabled, the script runs in non-headless mode, takes screenshots at each login/navigation step, and enables verbose console/network logging in Chrome. Additionally, the scraper now waits for the shopping list items to appear on the page (using `waitForSelector`) instead of relying solely on a fixed timeout, improving reliability.

## 1.1.4

- **Interactive Login and OTP support**: The scraper now supports logging into your Amazon account using email and password (with optional OTP).  
  If no valid cookies are provided, it navigates to the Amazon sign-in page, prompts you to enter credentials (and OTP if required), and then proceeds to scrape the shopping list. This makes the add-on more flexible and easier to use without having to manually extract cookies every time they expire.

## 1.1.3

- **Multiple Ways to Provide Cookies & Automatic Fallback**: You can now use either `Cookies_Path` or `Cookies_JSON` in the add-on configuration. If both are set, `Cookies_JSON` takes precedence. This gives you more flexibility in how you manage session cookies.

## 1.1.2

- **Automatic Retry on Cookies Expired**: No longer crashes if cookies expire. Instead, the script logs an error and waits for the next polling cycle, allowing you time to update the cookies without restarting the add-on.

## 1.1.1

- **Added CHANGELOG**: Introduced this file to keep track of changes across versions.

## 1.1.0

- **Initial stable release with cookie-based authentication**: Uses Puppeteer to navigate to the Amazon Alexa Shopping List page with cookies exported from the user's browser. Scrapes list items and sends them to a Home Assistant webhook.
