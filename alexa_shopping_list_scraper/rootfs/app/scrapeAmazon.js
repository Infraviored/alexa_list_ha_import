require('dotenv').config();

const puppeteer = require('puppeteer-extra')
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
    const browser = await puppeteer.launch({
            defaultViewport: null,
            userDataDir: './tmp',
            args: [
        '--headless',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-extensions',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-features=site-per-process'
                ],
            executablePath: '/usr/bin/chromium',
          });

    const page = await browser.newPage();
        page.setDefaultTimeout(60000); // 60 seconds
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
                const mapped = srcCookies.map(c => {
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
                try {
                    await page.setCookie(...mapped);
                    console.log(`[scrape] Loaded ${srcCookies.length} cookies from ${cookiePath}`);
                } catch (e) {
                    console.error('[scrape] Failed to set cookies:', e && e.message ? e.message : e);
                }
                const sample = mapped.slice(0, Math.min(5, mapped.length)).map(c => ({ name: c.name, domain: c.domain || '(url)', path: c.path }));
                console.log('[scrape] Cookie sample:', JSON.stringify(sample));
                
                // Validate cookie domain matches selected region
                const validation = validateCookieDomain(srcCookies, amazonUrls.domain);
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
                
                console.log(`[scrape] Navigating directly to list: ${amz_shoppinglist_url}`);
                const resp = await page.goto(amz_shoppinglist_url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                console.log(`[scrape] List navigation: status=${resp ? resp.status() : 'n/a'} url=${resp ? resp.url() : 'n/a'}`);
                
                await sleep(500);
                const currentUrl = page.url();
                const isSignin = currentUrl.includes('/ap/signin');
                skipLogin = !isSignin && (await page.$('#ap_email')) === null;
                
                if (skipLogin) {
                    console.log('[scrape] ✓ Cookie authentication successful');
                } else {
                    console.log('[scrape] ✗ Cookie authentication failed (login form detected)');
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
            // Get the main Amazon page
            const url = amz_signin_url;
            const parts = url.split('/');
            const result = parts.slice(0, 3).join('/');
            
            await page.goto(result, { waitUntil: 'load', timeout: 60000 });
            await sleep(1500);
            
            if(log_level == "true"){
                const timestamp = getTimestamp();
                const filename = `www/${timestamp}-01-screenshot_main_page.png`;
                await page.screenshot({ path: filename, fullPage: true });
            }
            
            // Navigate to sign-in page
            await page.goto(amz_signin_url, { waitUntil: 'networkidle2', timeout: 0 });
            
            // Wait for email field
            let elementExists = false;
            let attempts = 0;
            while (!elementExists && attempts < 5) {
                elementExists = await page.$('#ap_email') !== null;
                if (!elementExists) {
                    await sleep(1000);
                    attempts++;
                }
            }
            
            if (!elementExists) {
                throw new Error('Login form not found after multiple attempts');
            }
            
            if(log_level == "true"){
                const timestamp = getTimestamp();
                const filename = `www/${timestamp}-02-screenshot_login_page.png`;
                await page.screenshot({ path: filename, fullPage: true });
            }
            
            // Handle login (email+password on same page OR separate pages)
            if (await page.$('#ap_password')) {
                await page.type('#ap_email', amz_login);
                await page.type('#ap_password', amz_password);
                if(log_level == "true"){
                    const timestamp = getTimestamp();
                    const filename = `www/${timestamp}-03.1-screenshot_login_user_and_pass_page.png`;
                    await page.screenshot({ path: filename, fullPage: true });
                }
                await page.click('#signInSubmit');
                await page.waitForNavigation({waitUntil: 'networkidle0',timeout: 0,});
            } else {
                await sleep(1000);
                await page.type('#ap_email', amz_login);
                if(log_level == "true"){
                    const timestamp = getTimestamp();
                    const filename = `www/${timestamp}-03.2-screenshot_login_only_page.png`;
                    await page.screenshot({ path: filename, fullPage: true });
                }
                await page.click('#continue');
                await page.waitForNavigation({waitUntil: 'networkidle0',timeout: 0,});
                
                if(log_level == "true"){
                    const timestamp = getTimestamp();
                    const filename = `www/${timestamp}-03.3-screenshot_pass_only_before_page.png`;
                    await page.screenshot({ path: filename, fullPage: true });
                }
                
                await page.type('#ap_password', amz_password);
                
                if(log_level == "true"){
                    const timestamp = getTimestamp();
                    const filename = `www/${timestamp}-03.4-screenshot_pass_only_after_page.png`;
                    await page.screenshot({ path: filename, fullPage: true });
                }
                
                await page.click('#signInSubmit');
                await page.waitForNavigation({waitUntil: 'networkidle0',timeout: 0,});
            }
            
            // Handle OTP (if required)
            if (await page.$('#auth-mfa-otpcode')) {
                if (!secret) {
                    console.error('[scrape] OTP required but Amazon_Secret not provided');
                    throw new Error('OTP required but Amazon_Secret not configured');
                }
                
                const totp = new OTPAuth.TOTP({
                    issuer: 'Amazon',
                    label: amz_login,
                    algorithm: 'SHA1',
                    digits: 6,
                    period: 30,
                    secret: OTPAuth.Secret.fromBase32(secret)
                });
                const token = totp.generate();
                await page.type('#auth-mfa-otpcode', token);
                
                if(log_level == "true"){
                    const timestamp = getTimestamp();
                    const filename = `www/${timestamp}-04-screenshot_otp_page.png`;
                    await page.screenshot({ path: filename, fullPage: true });
                }
                
                await page.click('#auth-signin-button');
                await page.waitForNavigation({waitUntil: 'networkidle0',timeout: 0,});
                
                if(log_level == "true"){
                    const timestamp = getTimestamp();
                    const filename = `www/${timestamp}-04.1-screenshot_after_otp.png`;
                    await page.screenshot({ path: filename, fullPage: true });
                    console.log(`[scrape] After OTP - URL: ${page.url()}`);
                }
            }
            
            skipLogin = true;
            console.log('[scrape] ✓ Email/password authentication successful');
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
