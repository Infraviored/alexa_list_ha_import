require('dotenv').config();

const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())
const OTPAuth = require('otpauth');  // For handling OTP
const fs = require('fs');

function getTimestamp() {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-');
}

function getEnvVariable(key) {
    return process.env[key];
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Random delay to simulate human behavior
async function randomDelay(min = 100, max = 300) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return sleep(delay);
}

// Human-like typing with random delays between keystrokes
async function humanType(page, selector, text) {
    await page.click(selector);
    for (const char of text) {
        await page.keyboard.type(char);
        await randomDelay(50, 150); // Random delay between keystrokes
    }
}

// Simulate mouse movement to appear more human
async function simulateMouseMovement(page) {
    try {
        await page.evaluate(() => {
            // Dispatch random mouse movements
            const event = new MouseEvent('mousemove', {
                clientX: Math.random() * window.innerWidth,
                clientY: Math.random() * window.innerHeight,
                bubbles: true
            });
            document.dispatchEvent(event);
        });
    } catch (e) {
        // Ignore errors
    }
}

// Comprehensive cookie and storage test
async function testCookieAndStorage(page, log_level) {
    const results = await page.evaluate(() => {
        const tests = {};
        
        // Test 1: navigator.cookieEnabled
        tests.navigatorCookieEnabled = navigator.cookieEnabled;
        
        // Test 2: document.cookie read/write
        try {
            const testValue = 'test_' + Date.now();
            document.cookie = `puppeteer_test=${testValue}; path=/`;
            const cookieRead = document.cookie;
            tests.cookieWriteRead = cookieRead.includes(testValue);
            tests.cookieValue = cookieRead;
            // Clean up
            document.cookie = 'puppeteer_test=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
        } catch (e) {
            tests.cookieWriteRead = false;
            tests.cookieError = e.message;
        }
        
        // Test 3: localStorage
        try {
            const testKey = 'puppeteer_test_' + Date.now();
            localStorage.setItem(testKey, 'test_value');
            const retrieved = localStorage.getItem(testKey);
            tests.localStorage = retrieved === 'test_value';
            localStorage.removeItem(testKey);
        } catch (e) {
            tests.localStorage = false;
            tests.localStorageError = e.message;
        }
        
        // Test 4: sessionStorage
        try {
            const testKey = 'puppeteer_test_' + Date.now();
            sessionStorage.setItem(testKey, 'test_value');
            const retrieved = sessionStorage.getItem(testKey);
            tests.sessionStorage = retrieved === 'test_value';
            sessionStorage.removeItem(testKey);
        } catch (e) {
            tests.sessionStorage = false;
            tests.sessionStorageError = e.message;
        }
        
        // Test 5: Check for Amazon's cookie warning
        const cookieWarning = document.querySelector('#auth-cookie-warning-message');
        tests.amazonCookieWarning = cookieWarning !== null;
        if (cookieWarning) {
            tests.amazonCookieWarningText = cookieWarning.textContent.trim().substring(0, 100);
        }
        
        return tests;
    });
    
    // Log results
    console.log('[scrape] ═══ Cookie & Storage Test Results ═══');
    console.log(`[scrape]   navigator.cookieEnabled: ${results.navigatorCookieEnabled ? '✓' : '✗'}`);
    console.log(`[scrape]   document.cookie r/w: ${results.cookieWriteRead ? '✓' : '✗'}`);
    console.log(`[scrape]   localStorage: ${results.localStorage ? '✓' : '✗'}`);
    console.log(`[scrape]   sessionStorage: ${results.sessionStorage ? '✓' : '✗'}`);
    console.log(`[scrape]   Amazon cookie warning: ${results.amazonCookieWarning ? '✗ DETECTED!' : '✓ Not present'}`);
    
    if (log_level === "true") {
        console.log(`[scrape]   Current document.cookie value: "${results.cookieValue || '(empty)'}"`);
        if (results.cookieError) console.log(`[scrape]   Cookie error: ${results.cookieError}`);
        if (results.localStorageError) console.log(`[scrape]   localStorage error: ${results.localStorageError}`);
        if (results.sessionStorageError) console.log(`[scrape]   sessionStorage error: ${results.sessionStorageError}`);
        if (results.amazonCookieWarning) {
            console.log(`[scrape]   Amazon warning text: "${results.amazonCookieWarningText}"`);
        }
    }
    
    console.log('[scrape] ═══════════════════════════════════════');
    
    return results;
}

// Region configuration - simplified
const REGION_CONFIG = {
    'com': { domain: 'com', handle: 'amzn_alexa_quantum_us' },
    'de': { domain: 'de', handle: 'amzn_alexa_quantum_de' },
    'co.uk': { domain: 'co.uk', handle: 'amzn_alexa_quantum_uk' },
    'it': { domain: 'it', handle: 'amzn_alexa_quantum_it' },
    'fr': { domain: 'fr', handle: 'amzn_alexa_quantum_fr' },
    'es': { domain: 'es', handle: 'amzn_alexa_quantum_es' },
    'ca': { domain: 'ca', handle: 'amzn_alexa_quantum_ca' },
    'com.au': { domain: 'com.au', handle: 'amzn_alexa_quantum_au' },
    'co.jp': { domain: 'co.jp', handle: 'amzn_alexa_quantum_jp' },
    'com.mx': { domain: 'com.mx', handle: 'amzn_alexa_quantum_mx' },
    'com.br': { domain: 'com.br', handle: 'amzn_alexa_quantum_br' },
    'in': { domain: 'in', handle: 'amzn_alexa_quantum_in' },
    'nl': { domain: 'nl', handle: 'amzn_alexa_quantum_nl' },
    'se': { domain: 'se', handle: 'amzn_alexa_quantum_se' },
    'pl': { domain: 'pl', handle: 'amzn_alexa_quantum_pl' },
    'com.tr': { domain: 'com.tr', handle: 'amzn_alexa_quantum_tr' },
    'ae': { domain: 'ae', handle: 'amzn_alexa_quantum_ae' },
    'sa': { domain: 'sa', handle: 'amzn_alexa_quantum_sa' },
    'sg': { domain: 'sg', handle: 'amzn_alexa_quantum_sg' }
};

// Build Amazon URLs from region
function buildAmazonUrls(region) {
    const config = REGION_CONFIG[region] || REGION_CONFIG['com'];
    const domain = config.domain;
    const handle = config.handle;
    
    return {
        signInUrl: `https://www.amazon.${domain}/ap/signin?openid.pape.max_auth_age=3600&openid.return_to=https%3A%2F%2Fwww.amazon.${domain}%2Falexaquantum%2Fsp%2FalexaShoppingList%3Fref_%3Dlist_d_wl_ys_list_1&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.assoc_handle=${handle}&openid.mode=checkid_setup&openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0`,
        shoppingListUrl: `https://www.amazon.${domain}/alexaquantum/sp/alexaShoppingList?ref_=list_d_wl_ys_list_1`,
        domain: domain
    };
}

// Validate cookies match selected region
function validateCookieDomain(cookies, expectedDomain) {
    if (!cookies || cookies.length === 0) return { valid: true, message: '' };
    
    const cookieDomains = cookies.map(c => c.domain).filter(d => d);
    const mainDomains = cookieDomains.filter(d => d.includes('amazon'));
    
    if (mainDomains.length === 0) return { valid: true, message: '' };
    
    const mismatch = mainDomains.find(d => !d.includes(`.amazon.${expectedDomain}`) && !d.includes(`amazon.${expectedDomain}`));
    
    if (mismatch) {
        return {
            valid: false,
            message: `⚠️  Cookie domain mismatch! Your cookies are for "${mismatch}" but Amazon_Region is set to "${expectedDomain}". Please export cookies from the correct Amazon region or update Amazon_Region.`
        };
    }
    
    return { valid: true, message: '' };
}

// Authentication configuration
const auth_method = getEnvVariable('Auth_Method') || 'cookies';  // cookies, email_password, or auto
const secret = getEnvVariable('Amazon_Secret') ? getEnvVariable('Amazon_Secret').replace(/\s/g, '') : null;  // Remove all whitespace
const amz_login = getEnvVariable('Amazon_Login');
const amz_password = getEnvVariable('Amazon_Pass');
const amz_region = getEnvVariable('Amazon_Region') || 'com';
const amazonUrls = buildAmazonUrls(amz_region);
const amz_signin_url = amazonUrls.signInUrl;
const amz_shoppinglist_url = amazonUrls.shoppingListUrl;  // Auto-generated from region
const delete_after_download = getEnvVariable('DELETE_AFTER_DOWNLOAD');
const log_level = getEnvVariable('log_level');

// Log configuration at startup
console.log('[scrape] ═══════════════════════════════════════════════════════════');
console.log(`[scrape] Amazon Region: ${amz_region}`);
console.log(`[scrape] Authentication method: ${auth_method}`);
console.log(`[scrape] Sign-in URL: ${amz_signin_url}`);
console.log(`[scrape] Shopping List URL: ${amz_shoppinglist_url}`);
console.log('[scrape] ═══════════════════════════════════════════════════════════');
console.log('');

(async () => {
    // Use headful mode for better detection evasion (set headless: false for debugging)
    const useHeadless = getEnvVariable('HEADLESS_MODE') !== 'false';
    
    const browser = await puppeteer.launch({
            defaultViewport: null,
            userDataDir: './tmp',
            headless: useHeadless ? 'new' : false,
            args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-features=site-per-process,IsolateOrigins',
        '--enable-features=NetworkService,NetworkServiceInProcess',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--enable-cookies',
        '--disable-infobars',
        '--window-size=1920,1080',
        '--start-maximized',
        '--disable-notifications',
        '--disable-popup-blocking',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--password-store=basic',
        '--use-mock-keychain',
        '--disable-sync'
                ],
            executablePath: '/usr/bin/chromium',
          });

    const page = await browser.newPage();
        page.setDefaultTimeout(60000); // 60 seconds
        
        // Set realistic Chrome user agent to avoid detection
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Advanced anti-detection measures
        await page.evaluateOnNewDocument(() => {
            // Override navigator properties to hide automation
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
            
            // Remove automation indicators
            delete navigator.__proto__.webdriver;
            
            // AGGRESSIVE: Force cookies to be enabled at every level
            Object.defineProperty(navigator, 'cookieEnabled', {
                get: () => true,
                configurable: false
            });
            
            // Force document.cookie to work properly
            const cookieStore = {};
            let documentCookieValue = '';
            
            Object.defineProperty(document, 'cookie', {
                get: function() {
                    return documentCookieValue;
                },
                set: function(val) {
                    // Parse and store the cookie
                    const parts = val.split(';')[0].split('=');
                    if (parts.length === 2) {
                        cookieStore[parts[0].trim()] = parts[1].trim();
                        // Rebuild cookie string
                        documentCookieValue = Object.entries(cookieStore)
                            .map(([k, v]) => `${k}=${v}`)
                            .join('; ');
                    }
                    return true;
                },
                configurable: false
            });
            
            // Ensure localStorage works
            try {
                if (!window.localStorage) {
                    const localStorageMock = {};
                    Object.defineProperty(window, 'localStorage', {
                        get: () => ({
                            getItem: (key) => localStorageMock[key] || null,
                            setItem: (key, value) => { localStorageMock[key] = String(value); },
                            removeItem: (key) => { delete localStorageMock[key]; },
                            clear: () => { for (let k in localStorageMock) delete localStorageMock[k]; },
                            key: (index) => Object.keys(localStorageMock)[index] || null,
                            get length() { return Object.keys(localStorageMock).length; }
                        }),
                        configurable: false
                    });
                }
            } catch (e) {}
            
            // Ensure sessionStorage works
            try {
                if (!window.sessionStorage) {
                    const sessionStorageMock = {};
                    Object.defineProperty(window, 'sessionStorage', {
                        get: () => ({
                            getItem: (key) => sessionStorageMock[key] || null,
                            setItem: (key, value) => { sessionStorageMock[key] = String(value); },
                            removeItem: (key) => { delete sessionStorageMock[key]; },
                            clear: () => { for (let k in sessionStorageMock) delete sessionStorageMock[k]; },
                            key: (index) => Object.keys(sessionStorageMock)[index] || null,
                            get length() { return Object.keys(sessionStorageMock).length; }
                        }),
                        configurable: false
                    });
                }
            } catch (e) {}
            
            // Mock realistic plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => {
                    return [
                        {name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format'},
                        {name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: ''},
                        {name: 'Native Client', filename: 'internal-nacl-plugin', description: ''}
                    ];
                },
            });
            
            // Mock realistic navigator.platform
            Object.defineProperty(navigator, 'platform', {
                get: () => 'Win32',
            });
            
            // Set realistic languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['de-DE', 'de', 'en-US', 'en'],
            });
            
            // Mock hardware concurrency
            Object.defineProperty(navigator, 'hardwareConcurrency', {
                get: () => 8,
            });
            
            // Mock device memory
            Object.defineProperty(navigator, 'deviceMemory', {
                get: () => 8,
            });
            
            // Override permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
            
            // Mock chrome runtime
            window.chrome = {
                runtime: {},
                loadTimes: function() {},
                csi: function() {},
                app: {}
            };
            
            // Add realistic screen properties
            Object.defineProperty(screen, 'availWidth', {get: () => 1920});
            Object.defineProperty(screen, 'availHeight', {get: () => 1040});
            Object.defineProperty(screen, 'width', {get: () => 1920});
            Object.defineProperty(screen, 'height', {get: () => 1080});
            
            // Override the Notification API to appear granted
            try {
                Object.defineProperty(Notification, 'permission', {
                    get: () => 'granted'
                });
            } catch (e) {}
        });
        
        // Set extra HTTP headers to look more like a real browser
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        });
        
        // Set viewport with slight randomization to look more human
        const viewportWidth = 1920 + Math.floor(Math.random() * 100);
        const viewportHeight = 1080 + Math.floor(Math.random() * 100);
        await page.setViewport({
            width: viewportWidth,
            height: viewportHeight,
            deviceScaleFactor: 1,
            hasTouch: false,
            isLandscape: true,
            isMobile: false,
        });
        
        try { fs.mkdirSync('www', { recursive: true }); } catch (e) {}

// Try cookie authentication first if method is 'cookies' or 'auto'
let skipLogin = false;
let cookiesProvided = false;

if (auth_method === 'cookies' || auth_method === 'auto') {
    console.log('[scrape] Attempting cookie-based authentication...');
    try {
        const cookiePath = '/data/cookies.json';
        if (fs.existsSync(cookiePath)) {
            const raw = fs.readFileSync(cookiePath, 'utf8');
            let srcCookies;
            try {
                srcCookies = JSON.parse(raw);
            } catch (_) {
                const trimmed = raw.trim();
                if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                    srcCookies = [JSON.parse(trimmed)];
                } else if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                    throw new Error('Invalid cookies.json JSON array');
                } else {
                    throw new Error('Invalid cookies.json content');
                }
            }
            const allowedSameSite = new Set(['Strict','Lax','None']);
            if (Array.isArray(srcCookies) && srcCookies.length > 0) {
                cookiesProvided = true;
                
                // Enhanced cookie diagnostics with expiration dates
                const now = Date.now() / 1000; // Current time in seconds
                let validCount = 0;
                let expiredCount = 0;
                
                if (log_level == "true") {
                    console.log('[scrape] Cookie details:');
                }
                
                // Filter out expired cookies and count them
                const validCookies = [];
                srcCookies.forEach(c => {
                    const expirationDate = c.expirationDate || c.expires;
                    if (expirationDate) {
                        const expiresAt = new Date(expirationDate * 1000);
                        const daysUntilExpiry = Math.floor((expirationDate - now) / 86400);
                        const isExpired = expirationDate < now;
                        
                        if (isExpired) {
                            expiredCount++;
                            if (log_level == "true") {
                                const daysAgo = Math.abs(daysUntilExpiry);
                                console.log(`[scrape]   ✗ ${c.name} (${c.domain}) EXPIRED ${daysAgo} days ago - SKIPPED`);
                            }
                        } else {
                            validCount++;
                            validCookies.push(c);
                            if (log_level == "true") {
                                console.log(`[scrape]   ✓ ${c.name} (${c.domain}) expires ${expiresAt.toISOString().split('T')[0]} (valid for ${daysUntilExpiry} days)`);
                            }
                        }
                    } else {
                        validCount++;
                        validCookies.push(c);
                        if (log_level == "true") {
                            console.log(`[scrape]   ✓ ${c.name} (${c.domain}) session cookie (no expiration)`);
                        }
                    }
                });
                
                console.log(`[scrape] Cookies loaded: ${validCount} valid${expiredCount > 0 ? `, ${expiredCount} expired (filtered out)` : ''}`);
                
                // First visit Amazon to establish session, then set cookies (better detection evasion)
                if (log_level == "true") {
                    console.log('[scrape] Visiting Amazon homepage first to establish session...');
                }
                await page.goto(`https://www.amazon.${regionConfig.domain}`, {waitUntil: 'domcontentloaded', timeout: 60000});
                await randomDelay(1000, 2000);
                
                // Test cookie functionality BEFORE setting Amazon cookies
                if (log_level == "true") {
                    console.log('[scrape] Testing cookie/storage functionality before setting cookies...');
                    await testCookieAndStorage(page, log_level);
                }
                
                // Set cookies in the browser after initial visit
                const mapped = validCookies.map(c => {
                    const out = { name: c.name, value: String(c.value) };
                    if (c.domain) out.domain = c.domain;
                    out.path = c.path || '/';
                    if (typeof c.httpOnly === 'boolean') out.httpOnly = c.httpOnly;
                    if (typeof c.secure === 'boolean') out.secure = c.secure;
                    if (c.sameSite && allowedSameSite.has(c.sameSite)) out.sameSite = c.sameSite;
                    if (typeof c.expires === 'number') out.expires = Math.floor(c.expires);
                    if (typeof c.expirationDate === 'number') out.expires = Math.floor(c.expirationDate);
                    return out;
                });
                if (log_level == "true") {
                    console.log('[scrape] Setting cookies after initial visit...');
                }
                try {
                    await page.setCookie(...mapped);
                    await randomDelay(500, 1000);
                } catch (e) {
                    console.error('[scrape] Failed to set cookies:', e && e.message ? e.message : e);
                }
                
                // Validate cookie domain matches selected region
                const validation = validateCookieDomain(validCookies, amazonUrls.domain);
                if (!validation.valid) {
                    console.error(`[scrape] ${validation.message}`);
                    throw new Error(validation.message);
                }
                
                // Test if cookies work
                try {
                    const targetHost = new URL(amz_shoppinglist_url).hostname.replace(/^www\./, '');
                    const cookieHosts = Array.from(new Set(mapped.map(c => (c.domain || '').replace(/^\./, ''))));
                    const hostMismatch = cookieHosts.length > 0 && !cookieHosts.some(h => targetHost.endsWith(h));
                    if (hostMismatch) {
                        console.warn(`[scrape] Warning: cookie domains ${JSON.stringify(cookieHosts)} do not match target host ${targetHost}`);
                    }
                } catch (e) {}
                
                if (log_level == "true") {
                    console.log(`[scrape] Navigating directly to list: ${amz_shoppinglist_url}`);
                }
                await randomDelay(1000, 2000);
                await simulateMouseMovement(page);
                const resp = await page.goto(amz_shoppinglist_url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                if (log_level == "true") {
                    console.log(`[scrape] List navigation: status=${resp ? resp.status() : 'n/a'} url=${resp ? resp.url() : 'n/a'}`);
                }
                
                await sleep(500);
                const currentUrl = page.url();
                
                // Test cookie functionality after navigation
                console.log('[scrape] Testing cookie/storage functionality after navigation...');
                const cookieTest = await testCookieAndStorage(page, log_level);
                const isSignin = currentUrl.includes('/ap/signin');
                skipLogin = !isSignin && (await page.$('#ap_email')) === null;
                
                if (skipLogin) {
                    console.log('[scrape] ✓ Cookie authentication successful');
                    if (log_level == "true") {
                        console.log(`[scrape]   Final URL: ${currentUrl}`);
                        console.log(`[scrape]   Page title: "${await page.title()}"`);
                    }
                } else {
                    console.log('[scrape] ✗ Cookie authentication failed (login form detected)');
                    
                    // If cookie test shows Amazon warning, log it prominently
                    if (cookieTest.amazonCookieWarning) {
                        console.log('[scrape]   ⚠️  CRITICAL: Amazon cookie warning detected!');
                        console.log('[scrape]   Amazon\'s JavaScript cookie check is failing.');
                        console.log(`[scrape]   This is NOT an expired cookie issue - Amazon detects cookies aren't working properly in the browser.`);
                    }
                    
                    // Enhanced diagnostics for cookie auth failure
                    try {
                        const pageTitle = await page.title();
                        console.log(`[scrape]   Current page title: "${pageTitle}"`);
                        console.log(`[scrape]   Current URL: ${currentUrl}`);
                        
                        // Check for Amazon cookie warning
                        const cookieWarning = await page.$('#auth-cookie-warning-message');
                        if (cookieWarning) {
                            const warningText = await page.evaluate(el => el?.textContent?.trim() || '', cookieWarning);
                            console.log('[scrape]   ⚠️ Amazon cookie warning detected!');
                            console.log(`[scrape]   Warning text: "${warningText}"`);
                            
                            // Try to manually trigger cookie acceptance
                            if (log_level == "true") {
                                console.log('[scrape]   Attempting to work around cookie warning...');
                            }
                            try {
                                await page.evaluate(() => {
                                    // Try to force set a test cookie
                                    document.cookie = 'amazon_test=1; path=/; domain=.amazon.' + window.location.hostname.split('.').slice(-1)[0];
                                    // Trigger storage event
                                    window.localStorage.setItem('amazon_test', '1');
                                });
                                await randomDelay(1000, 2000);
                            } catch (e) {
                                if (log_level == "true") {
                                    console.log(`[scrape]   Cookie workaround failed: ${e.message}`);
                                }
                            }
                        }
                        
                        // Check for common Amazon anti-bot indicators
                        const hasCaptcha = await page.$('form[action*="validateCaptcha"]') !== null || 
                                         await page.$('#captchacharacters') !== null ||
                                         (await page.content()).includes('Robot Check');
                        if (hasCaptcha) {
                            console.log('[scrape]   ⚠️  CAPTCHA/bot detection page detected!');
                        }
                        
                        // Save diagnostic screenshot
                        const timestamp = getTimestamp();
                        const filename = `www/${timestamp}-COOKIE_AUTH_FAILED.png`;
                        await page.screenshot({ path: filename, fullPage: true });
                        console.log(`[scrape]   Diagnostic screenshot saved: ${filename}`);
                        
                        // In debug mode, dump the full HTML
                        if (log_level == "true") {
                            const fullHTML = await page.content();
                            console.log('[scrape]   ========== FULL PAGE HTML (Cookie Auth Failed) ==========');
                            console.log(fullHTML);
                            console.log('[scrape]   ========== END FULL PAGE HTML ==========');
                        }
                    } catch (diagError) {
                        console.error('[scrape]   Could not gather diagnostics:', diagError.message);
                    }
                }
            }
        } else {
            console.log('[scrape] No cookies.json found at /data/cookies.json');
        }
    } catch (e) {
        console.error('[scrape] Cookie import failed:', e && e.message ? e.message : e);
    }
}

// If cookies failed and method is 'auto' or 'email_password', try email/password/OTP
if (!skipLogin && (auth_method === 'email_password' || auth_method === 'auto')) {
    console.log('[scrape] Attempting email/password authentication...');
    
    // Validate credentials are provided
    if (!amz_login || !amz_password) {
        console.error('[scrape] Email/password authentication requires Amazon_Login and Amazon_Pass');
        if (auth_method === 'email_password') {
            await browser.close();
            process.exit(12);
        }
    } else {
        try {
            // Get the main Amazon page FIRST to establish cookie context
            const url = amz_signin_url;
            const parts = url.split('/');
            const result = parts.slice(0, 3).join('/');
            
            if (log_level == "true") {
                console.log('[scrape] Visiting Amazon main page to establish cookies...');
            }
            await simulateMouseMovement(page);
            await page.goto(result, { waitUntil: 'load', timeout: 60000 });
            await randomDelay(2000, 3000); // Wait longer to appear more human
            
            // Simulate some browsing activity
            if (log_level == "true") {
                console.log('[scrape] Simulating browsing activity...');
            }
            await simulateMouseMovement(page);
            await page.evaluate(() => {
                window.scrollTo(0, Math.random() * 500);
            });
            await randomDelay(1000, 2000);
            
            // Comprehensive cookie and storage test
            console.log('[scrape] Testing cookie/storage functionality on main page...');
            await testCookieAndStorage(page, log_level);
            
            if(log_level == "true"){
                const timestamp = getTimestamp();
                const filename = `www/${timestamp}-01-screenshot_main_page.png`;
                await page.screenshot({ path: filename, fullPage: true });
            }
            
            // Navigate to sign-in page
            if (log_level == "true") {
                console.log('[scrape] Navigating to sign-in page...');
            }
            await randomDelay(1000, 2000);
            await simulateMouseMovement(page);
            await page.goto(amz_signin_url, { waitUntil: 'networkidle2', timeout: 0 });
            await randomDelay(2000, 3000);
            
            // Test cookie functionality on login page
            console.log('[scrape] Testing cookie/storage functionality on login page...');
            const loginPageTest = await testCookieAndStorage(page, log_level);
            
            // If Amazon cookie warning is already present, try to work around it
            if (loginPageTest.amazonCookieWarning) {
                console.log('[scrape] ⚠️  Amazon cookie warning detected on login page!');
                console.log('[scrape] Attempting aggressive cookie/storage workaround...');
                
                try {
                    await page.evaluate(() => {
                        // Force multiple cookies
                        document.cookie = 'amazon_fix_1=1; path=/';
                        document.cookie = 'amazon_fix_2=1; path=/';
                        document.cookie = 'session-id-time=' + Date.now() + '; path=/';
                        
                        // Force localStorage
                        try {
                            localStorage.setItem('amazon_fix', '1');
                            sessionStorage.setItem('amazon_fix', '1');
                        } catch (e) {}
                        
                        // Try to remove the warning element
                        const warning = document.querySelector('#auth-cookie-warning-message');
                        if (warning) {
                            warning.style.display = 'none';
                        }
                    });
                    await randomDelay(1000, 2000);
                    
                    // Reload the page to see if workaround helped
                    console.log('[scrape] Reloading page after workaround...');
                    await page.reload({waitUntil: 'domcontentloaded', timeout: 60000});
                    await randomDelay(2000, 3000);
                    
                    // Test again
                    const retestResults = await testCookieAndStorage(page, log_level);
                    if (retestResults.amazonCookieWarning) {
                        console.log('[scrape] ✗ Workaround failed, warning still present');
                    } else {
                        console.log('[scrape] ✓ Workaround successful, warning removed!');
                    }
                } catch (e) {
                    console.log(`[scrape] Workaround error: ${e.message}`);
                }
            }
            
            // Give Amazon's JavaScript time to fully load and render
            await sleep(3000);
            
            // Wait for email field with enhanced diagnostics
            let elementExists = false;
            let attempts = 0;
            const maxAttempts = 10;
            
            while (!elementExists && attempts < maxAttempts) {
                // Check if element exists in DOM
                const emailField = await page.$('#ap_email');
                
                // Also check if it's visible (not hidden)
                const isVisible = emailField !== null && await page.evaluate(el => {
                    if (!el) return false;
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && 
                           style.visibility !== 'hidden' && 
                           style.opacity !== '0' &&
                           el.offsetParent !== null;
                }, emailField);
                
                elementExists = isVisible;
                
                if (!elementExists) {
                    if (log_level == "true") {
                        console.log(`[scrape] Waiting for login form... (attempt ${attempts + 1}/${maxAttempts})`);
                    }
                    
                    // Check what we're actually seeing (debug mode only)
                    if (log_level == "true" && attempts === 2) {
                        const currentUrl = page.url();
                        const pageTitle = await page.title();
                        console.log(`[scrape]   Current URL: ${currentUrl}`);
                        console.log(`[scrape]   Page title: "${pageTitle}"`);
                        
                        // Check for cookie warning
                        const hasCookieWarning = await page.$('#auth-cookie-warning-message') !== null;
                        if (hasCookieWarning) {
                            console.log('[scrape]   ⚠️  Amazon cookie warning detected! ("Bitte aktiviere Cookies")');
                            console.log('[scrape]   This means Amazon thinks cookies are disabled, even though we set them.');
                            
                            // Get the exact warning text
                            const warningText = await page.evaluate(() => {
                                const warning = document.querySelector('#auth-cookie-warning-message');
                                return warning ? warning.textContent.trim().replace(/\s+/g, ' ') : '';
                            });
                            console.log(`[scrape]   Warning text: "${warningText}"`);
                        }
                        
                        // Check if email field exists but is hidden
                        const emailFieldInDOM = await page.$('#ap_email') !== null;
                        if (emailFieldInDOM) {
                            const fieldInfo = await page.evaluate(() => {
                                const field = document.querySelector('#ap_email');
                                if (!field) return null;
                                const style = window.getComputedStyle(field);
                                const rect = field.getBoundingClientRect();
                                return {
                                    display: style.display,
                                    visibility: style.visibility,
                                    opacity: style.opacity,
                                    disabled: field.disabled,
                                    readOnly: field.readOnly,
                                    type: field.type,
                                    width: rect.width,
                                    height: rect.height,
                                    hasOffsetParent: field.offsetParent !== null
                                };
                            });
                            console.log('[scrape]   Email field (#ap_email) found in DOM:');
                            console.log(`[scrape]     Display: ${fieldInfo.display}, Visibility: ${fieldInfo.visibility}, Opacity: ${fieldInfo.opacity}`);
                            console.log(`[scrape]     Disabled: ${fieldInfo.disabled}, ReadOnly: ${fieldInfo.readOnly}, Type: ${fieldInfo.type}`);
                            console.log(`[scrape]     Size: ${fieldInfo.width}x${fieldInfo.height}px, HasOffsetParent: ${fieldInfo.hasOffsetParent}`);
                            
                            if (!isVisible) {
                                console.log('[scrape]   ⚠️  Email field exists but is NOT VISIBLE/USABLE!');
                            }
                        } else {
                            console.log('[scrape]   ✗ Email field (#ap_email) NOT found in DOM at all!');
                        }
                        
                        // Print relevant HTML snippet around the login area
                        const loginAreaHTML = await page.evaluate(() => {
                            const container = document.querySelector('#authportal-main-section') || 
                                            document.querySelector('.auth-pagelet-container') ||
                                            document.body;
                            if (!container) return 'Could not find login area';
                            
                            // Get first 2000 chars of the login area
                            const html = container.innerHTML;
                            return html.substring(0, 2000).replace(/\s+/g, ' ');
                        });
                        console.log('[scrape]   === Login area HTML (first 2000 chars) ===');
                        console.log(`[scrape]   ${loginAreaHTML}`);
                        console.log('[scrape]   === End HTML snippet ===');
                        
                        // Check for CAPTCHA or bot detection
                        const hasCaptcha = await page.$('form[action*="validateCaptcha"]') !== null || 
                                         await page.$('#captchacharacters') !== null ||
                                         (await page.content()).includes('Robot Check');
                        if (hasCaptcha) {
                            console.log('[scrape]   ⚠️  CAPTCHA/bot detection page detected!');
                            
                            // Save screenshot for diagnosis
                            const timestamp = getTimestamp();
                            const filename = `www/${timestamp}-CAPTCHA_DETECTED.png`;
                            await page.screenshot({ path: filename, fullPage: true });
                            console.log(`[scrape]   Screenshot saved: ${filename}`);
                        }
                        
                        // Test document.cookie access
                        const cookieTest = await page.evaluate(() => {
                            try {
                                const canRead = document.cookie !== undefined;
                                const canWrite = (() => {
                                    try {
                                        document.cookie = "test123=value; path=/";
                                        return document.cookie.includes("test123");
                                    } catch (e) {
                                        return false;
                                    }
                                })();
                                return {
                                    canRead,
                                    canWrite,
                                    cookieCount: document.cookie ? document.cookie.split(';').length : 0,
                                    cookiePreview: document.cookie ? document.cookie.substring(0, 100) + '...' : '(empty)'
                                };
                            } catch (e) {
                                return { error: e.toString() };
                            }
                        });
                        console.log('[scrape]   Browser cookie test:');
                        console.log(`[scrape]     Can read: ${cookieTest.canRead}, Can write: ${cookieTest.canWrite}`);
                        console.log(`[scrape]     Cookies visible to JS: ${cookieTest.cookieCount}`);
                        console.log(`[scrape]     Cookie preview: ${cookieTest.cookiePreview}`);
                    }
                    
                    await sleep(2000);  // Increased from 1000ms to 2000ms
                    attempts++;
                }
            }
            
            if (!elementExists) {
                // Save final diagnostic screenshot
                const timestamp = getTimestamp();
                const filename = `www/${timestamp}-LOGIN_FORM_NOT_FOUND.png`;
                await page.screenshot({ path: filename, fullPage: true });
                console.log(`[scrape]   Final diagnostic screenshot: ${filename}`);
                console.log(`[scrape]   Final URL: ${page.url()}`);
                
                // In debug mode, dump the full HTML
                if (log_level == "true") {
                    const fullHTML = await page.content();
                    console.log('[scrape]   ========== FULL PAGE HTML (Login Form Not Found) ==========');
                    console.log(fullHTML);
                    console.log('[scrape]   ========== END FULL PAGE HTML ==========');
                }
                
                throw new Error('Login form not found after multiple attempts');
            }
            
            console.log('[scrape] Login form found, proceeding with authentication...');
            
            if(log_level == "true"){
                const timestamp = getTimestamp();
                const filename = `www/${timestamp}-02-screenshot_login_page.png`;
                await page.screenshot({ path: filename, fullPage: true });
            }
            
            // Handle login (email+password on same page OR separate pages)
            const hasPasswordField = await page.$('#ap_password') !== null;
            if (log_level == "true") {
                console.log('[scrape] Checking login page type (single page vs split)...');
                console.log(`[scrape] Password field present: ${hasPasswordField ? 'Yes (single-page login)' : 'No (split login)'}`);
            }
            
            if (hasPasswordField) {
                if (log_level == "true") {
                    console.log('[scrape] Entering email and password on single page...');
                }
                // Human-like typing with random delays
                await simulateMouseMovement(page);
                await randomDelay(500, 1000);
                await humanType(page, '#ap_email', amz_login);
                if (log_level == "true") {
                    console.log('[scrape] Email entered');
                }
                await randomDelay(300, 700);
                await simulateMouseMovement(page);
                await humanType(page, '#ap_password', amz_password);
                if (log_level == "true") {
                    console.log('[scrape] Password entered');
                }
                await randomDelay(500, 1000);
                
                if(log_level == "true"){
                    const timestamp = getTimestamp();
                    const filename = `www/${timestamp}-03.1-screenshot_login_user_and_pass_page.png`;
                    await page.screenshot({ path: filename, fullPage: true });
                }
                
                console.log('[scrape] Submitting login credentials...');
                await simulateMouseMovement(page);
                await randomDelay(300, 700);
                await page.click('#signInSubmit');
                // Don't wait for navigation - Amazon might show intermediate pages
                // Just wait a bit and then navigate directly to shopping list
                await randomDelay(4000, 6000);
            } else {
                if (log_level == "true") {
                    console.log('[scrape] Entering email on first page...');
                }
                await randomDelay(800, 1500);
                await simulateMouseMovement(page);
                await humanType(page, '#ap_email', amz_login);
                if (log_level == "true") {
                    console.log('[scrape] Email entered');
                }
                await randomDelay(500, 1000);
                
                if(log_level == "true"){
                    const timestamp = getTimestamp();
                    const filename = `www/${timestamp}-03.2-screenshot_login_only_page.png`;
                    await page.screenshot({ path: filename, fullPage: true });
                }
                
                if (log_level == "true") {
                    console.log('[scrape] Clicking continue button...');
                    console.log('[scrape] Waiting for password page...');
                }
                await simulateMouseMovement(page);
                await randomDelay(300, 700);
                await page.click('#continue');
                await page.waitForNavigation({waitUntil: 'domcontentloaded', timeout: 60000});
                if (log_level == "true") {
                    console.log('[scrape] Password page loaded');
                }
                
                if(log_level == "true"){
                    const timestamp = getTimestamp();
                    const filename = `www/${timestamp}-03.3-screenshot_pass_only_before_page.png`;
                    await page.screenshot({ path: filename, fullPage: true });
                }
                
                if (log_level == "true") {
                    console.log('[scrape] Entering password on second page...');
                }
                await randomDelay(500, 1000);
                await simulateMouseMovement(page);
                await humanType(page, '#ap_password', amz_password);
                if (log_level == "true") {
                    console.log('[scrape] Password entered');
                }
                await randomDelay(500, 1000);
                
                if(log_level == "true"){
                    const timestamp = getTimestamp();
                    const filename = `www/${timestamp}-03.4-screenshot_pass_only_after_page.png`;
                    await page.screenshot({ path: filename, fullPage: true });
                }
                
                console.log('[scrape] Submitting login credentials...');
                await simulateMouseMovement(page);
                await randomDelay(300, 700);
                await page.click('#signInSubmit');
                // Don't wait for navigation - just wait a bit with human-like delay
                await randomDelay(4000, 6000);
            }
            
            // Check if we need OTP
            await sleep(1000);
            const needsOTP = await page.$('#auth-mfa-otpcode') !== null;
            if (log_level == "true") {
                console.log('[scrape] Checking if OTP is required...');
                console.log(`[scrape] OTP required: ${needsOTP ? 'Yes' : 'No'}`);
            }
            
            if (needsOTP) {
                if (!secret) {
                    console.error('[scrape] ✗ OTP required but Amazon_Secret not provided');
                    throw new Error('OTP required but Amazon_Secret not configured');
                }
                
                console.log('[scrape] OTP verification required, generating token...');
                const totp = new OTPAuth.TOTP({
                    issuer: 'Amazon',
                    label: amz_login,
                    algorithm: 'SHA1',
                    digits: 6,
                    period: 30,
                    secret: OTPAuth.Secret.fromBase32(secret)
                });
                const token = totp.generate();
                if (log_level == "true") {
                    console.log(`[scrape] OTP token generated (${token.length} digits)`);
                    console.log('[scrape] Entering OTP code...');
                }
                await randomDelay(500, 1000);
                await simulateMouseMovement(page);
                await humanType(page, '#auth-mfa-otpcode', token);
                if (log_level == "true") {
                    console.log('[scrape] OTP entered');
                }
                await randomDelay(500, 1000);
                
                if(log_level == "true"){
                    const timestamp = getTimestamp();
                    const filename = `www/${timestamp}-04-screenshot_otp_page.png`;
                    await page.screenshot({ path: filename, fullPage: true });
                }
                
                console.log('[scrape] Submitting OTP...');
                await simulateMouseMovement(page);
                await randomDelay(500, 1000);
                await page.click('#auth-signin-button');
                // Don't wait for navigation - just wait a bit with human-like delay
                await randomDelay(3000, 5000);
                console.log('[scrape] ✓ OTP submitted');
                
                if(log_level == "true"){
                    const timestamp = getTimestamp();
                    const filename = `www/${timestamp}-04.1-screenshot_after_otp.png`;
                    await page.screenshot({ path: filename, fullPage: true });
                    console.log(`[scrape] After OTP - URL: ${page.url()}`);
                }
            }
            
            // After auth, navigate directly to shopping list to check if we have access
            console.log('[scrape] Authentication steps completed, checking access to shopping list...');
            await page.goto(amz_shoppinglist_url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await sleep(1000);
            
            // Check if we actually have access (not redirected back to login)
            const currentUrl = page.url();
            const stillOnLogin = currentUrl.includes('/ap/signin') || await page.$('#ap_email') !== null;
            
            // Test cookie functionality after login attempt
            console.log('[scrape] Testing cookie/storage functionality after login submission...');
            const postLoginTest = await testCookieAndStorage(page, log_level);
            
            if (!stillOnLogin) {
                skipLogin = true;
                console.log('[scrape] ✓ Email/password authentication successful');
            } else {
                console.log('[scrape] ✗ Still on login page after authentication');
                console.log(`[scrape]   Current URL: ${currentUrl}`);
                console.log(`[scrape]   Page title: "${await page.title()}"`);
                
                // Diagnose WHY we're still on login page
                if (postLoginTest.amazonCookieWarning) {
                    console.log('[scrape]   ⚠️  ROOT CAUSE: Amazon cookie warning detected!');
                    console.log('[scrape]   Amazon rejected the login because cookies don\'t work properly.');
                    console.log('[scrape]   This is NOT a credential issue - it\'s Amazon\'s JavaScript detecting automation.');
                } else {
                    console.log('[scrape]   Possible causes: Incorrect credentials, CAPTCHA, or 2FA required');
                }
                
                // In debug mode, dump the full HTML
                if (log_level == "true") {
                    const fullHTML = await page.content();
                    const pageTitle = await page.title();
                    console.log(`[scrape]   Page title: "${pageTitle}"`);
                    console.log('[scrape]   ========== FULL PAGE HTML (Still on Login After Auth) ==========');
                    console.log(fullHTML);
                    console.log('[scrape]   ========== END FULL PAGE HTML ==========');
                }
                
                throw new Error('Authentication failed - still on login page');
            }
        } catch (e) {
            console.error('[scrape] ✗ Email/password authentication failed:', e && e.message ? e.message : e);
            skipLogin = false;
        }
    }
}

// If all authentication methods failed, exit
if (!skipLogin) {
    console.error('[scrape] ===============================================');
    console.error('[scrape] Authentication failed with all methods!');
    console.error('[scrape] ===============================================');
    console.error(`[scrape] Auth method: ${auth_method}`);
    if (auth_method === 'cookies' || auth_method === 'auto') {
        console.error('[scrape] - Cookie auth: FAILED (provide valid Cookies_JSON)');
    }
    if (auth_method === 'email_password' || auth_method === 'auto') {
        console.error('[scrape] - Email/password auth: FAILED (check Amazon_Login, Amazon_Pass, Amazon_Secret)');
    }
    console.error('[scrape] ===============================================');
    await browser.close();
    process.exit(12);
}

    // Navigate to Alexa Shopping List page
    console.log(`[scrape] Navigating to shopping list: ${amz_shoppinglist_url}`);
    await page.goto(amz_shoppinglist_url, { waitUntil: 'networkidle2', timeout: 60000 });
	
    //// DEBUG ////////
    if(log_level == "true"){
        const timestamp = getTimestamp();
        const filename = `www/${timestamp}-05.1-screenshot_shopping_list_page.png`;
        await page.screenshot({ path: filename, fullPage: true });
        console.log(`[scrape] Shopping list page - URL: ${page.url()}`);
    }
    //// END DEBUG ////
    
    // Wait for the list to appear
    console.log('[scrape] Waiting for selector .virtual-list .item-title');
    try {
        await page.waitForSelector('.virtual-list .item-title', { timeout: 60000 });
    } catch (e) {
        console.error('[scrape] Failed waiting for list items:', e && e.message ? e.message : e);
        console.error(`[scrape] Current URL: ${page.url()}`);
        
        // Take emergency screenshot to debug
        try {
            const timestamp = getTimestamp();
            const filename = `www/${timestamp}-ERROR-shopping_list_timeout.png`;
            await page.screenshot({ path: filename, fullPage: true });
            console.error(`[scrape] Error screenshot saved: ${filename}`);
            
            // In debug mode, dump the full HTML
            if (log_level == "true") {
                const fullHTML = await page.content();
                const pageTitle = await page.title();
                console.error(`[scrape] Page title: "${pageTitle}"`);
                console.error('[scrape] ========== FULL PAGE HTML (Shopping List Timeout) ==========');
                console.error(fullHTML);
                console.error('[scrape] ========== END FULL PAGE HTML ==========');
            }
        } catch (_) {}
        
        throw e;
    }

    // Scroll through the list to load all items
    await page.evaluate(async () => {
        const scrollable_list = document.querySelector('.virtual-list');
        let last_height = scrollable_list.scrollHeight;
        while (true) {
            scrollable_list.scrollTo(0, last_height);
            await new Promise(resolve => setTimeout(resolve, 2000)); // wait for new items to load
            let new_height = scrollable_list.scrollHeight;
            if (new_height === last_height) {
                break;
            }
            last_height = new_height;
        }
    });

    //// DEBUG ////////
    if(log_level == "true"){
	const timestamp = getTimestamp();
    	const filename = `www/${timestamp}-05.2-screenshot_shopping_list_page_scrolled.png`;
	await page.screenshot({ path: filename, fullPage: true });
    }
    //// END DEBUG ////

  let itemTitles = await page.$$eval(".virtual-list .item-title", items =>
    items.map(item => item.textContent.trim())
  );

  console.log(`[scrape] Found ${itemTitles.length} items on the Alexa shopping list.`);

  // Format each item as <listItem>
  let formattedItems = itemTitles.map(item => `${item}`);

  // Convert the array to JSON format
  let jsonFormattedItems = JSON.stringify(formattedItems, null, 2);

  if(delete_after_download == "true") {
      let delete_buttons = await page.$$eval(".item-actions-2 button", buttons =>
          buttons.forEach(button => button.click())
      );
  }

  
  // Save the JSON formatted list to default.htm
  const outputDir = '.';
  if (!fs.existsSync(outputDir)){
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(`${outputDir}/list_of_items.json`, jsonFormattedItems);
	

	//// DEBUG ////////
	// Display the JSON formatted list
	if(log_level == "true"){
		console.log("[scrape] DEBUG: Full list of scraped items ->", jsonFormattedItems);
	}
	//// END DEBUG ////
  

  // Close the browser when done
    await browser.close();
})();
