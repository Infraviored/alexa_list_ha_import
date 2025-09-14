require('dotenv').config();

////////////// change to stealth
//const puppeteer = require('puppeteer');

// puppeteer-extra is a drop-in replacement for puppeteer,
// it augments the installed puppeteer with plugin functionality
const puppeteer = require('puppeteer-extra')

// add stealth plugin and use defaults (all evasion techniques)
// const StealthPlugin = require('puppeteer-extra-plugin-stealth')
// puppeteer.use(StealthPlugin())

//////////// end change to stealth

// Cookie-only flow; OTP and email/password login are not supported
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

// Replace this with your actual secret key you get from the amazon add MFA page - and remove the spaces
const secret = getEnvVariable('AMZ_SECRET');
const amz_login = getEnvVariable('AMZ_LOGIN');
const amz_password = getEnvVariable('AMZ_PASS');
const delete_after_download = getEnvVariable('DELETE_AFTER_DOWNLOAD');
const log_level = getEnvVariable('log_level');
const amz_signin_url = getEnvVariable('Amazon_Sign_in_URL');
const amz_shoppinglist_url = getEnvVariable('Amazon_Shopping_List_Page');

(async () => {
    const browser = await puppeteer.launch({
//            headless: true,
            defaultViewport: null,
            userDataDir: './tmp',
            args: [
        '--headless',
        '--no-sandbox',
        '--disable-setuid-sandbox',
//      '--single-process',
        '--disable-extensions',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-features=site-per-process'
                ],
//            args: ['--no-sandbox', '--disable-setuid-sandbox', '--single-process'],
//            product: 'firefox',
            executablePath: '/usr/bin/chromium',
//            executablePath: '/usr/bin/firefox',
//        dumpio: true,
          });

    const page = await browser.newPage();
        page.setDefaultTimeout(60000); // 60 seconds
        try { fs.mkdirSync('www', { recursive: true }); } catch (e) {}

// Try importing cookies to reuse existing session
let skipLogin = false;
let cookiesProvided = false;
try {
    const cookiePath = '/data/cookies.json';
    if (fs.existsSync(cookiePath)) {
        const raw = fs.readFileSync(cookiePath, 'utf8');
        let srcCookies;
        try {
            srcCookies = JSON.parse(raw);
        } catch (_) {
            // If file contains one object, wrap it; if it's raw string, try JSON.parse again after trimming
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
                console.log(`Loaded ${srcCookies.length} cookies from ${cookiePath}`);
            } catch (e) {
                console.error('Failed to set cookies:', e && e.message ? e.message : e);
            }
            const sample = mapped.slice(0, Math.min(5, mapped.length)).map(c => ({ name: c.name, domain: c.domain || '(url)', path: c.path }));
            console.log('Cookie sample:', JSON.stringify(sample));
            // Probe access directly to the shopping list
            // Warn when cookie domains don't match target host
            try {
                const targetHost = new URL(amz_shoppinglist_url).hostname.replace(/^www\./, '');
                const cookieHosts = Array.from(new Set(mapped.map(c => (c.domain || '').replace(/^\./, ''))));
                const hostMismatch = cookieHosts.length > 0 && !cookieHosts.some(h => targetHost.endsWith(h));
                if (hostMismatch) {
                    console.warn(`Warning: cookie domains ${JSON.stringify(cookieHosts)} do not match target host ${targetHost}`);
                }
            } catch (e) {}
            console.log(`Navigating directly to list: ${amz_shoppinglist_url}`);
            const resp = await page.goto(amz_shoppinglist_url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            try {
                console.log(`List navigation: status=${resp ? resp.status() : 'n/a'} url=${resp ? resp.url() : 'n/a'}`);
                if (resp && typeof resp.headers === 'function') {
                    const h = resp.headers();
                    if (h && h['set-cookie']) {
                        const sc = h['set-cookie'];
                        console.log(`Response included set-cookie header (length=${typeof sc === 'string' ? sc.length : Array.isArray(sc) ? sc.join('\n').length : 0})`);
                    }
                }
            } catch (_) {}
            await sleep(500);
            const currentUrl = page.url();
            const isSignin = currentUrl.includes('/ap/signin');
            skipLogin = !isSignin && (await page.$('#ap_email')) === null;
            if (skipLogin) console.log('Using session cookies; skipping login (will NOT use email/password).');
            else {
                console.log('Login form detected after cookie load; session likely invalid.');
                try {
                    const afterCookies = await page.cookies();
                    const important = new Set(['session-token','sess-at-acbde','at-acbde','session-id']);
                    const summary = afterCookies
                        .filter(c => important.has(c.name))
                        .map(c => ({ name: c.name, domain: c.domain, path: c.path, expires: c.expires || null }));
                    console.log('Post-nav cookie presence:', JSON.stringify(summary));
                } catch (e) {}
            }
        }
    }
} catch (e) {
    console.error('Cookie import failed:', e && e.message ? e.message : e);
}

// start loop code
if (!skipLogin) {
    console.error('Session not authenticated via cookies. Email/password login is not supported.');
    console.error('Provide valid Cookies_JSON matching your Amazon region.');
    await browser.close();
    process.exit(12);
}

    // Navigate to Alexa Shopping List page
    console.log(`Navigating to shopping list: ${amz_shoppinglist_url}`);
    await page.goto(amz_shoppinglist_url, { waitUntil: 'networkidle2', timeout: 60000 });
	
    //// DEBUG ////////
    if(log_level == "true"){
        const timestamp = getTimestamp();
        const filename = `www/${timestamp}-05.1-screenshot_shopping_list_page.png`;
        await page.screenshot({ path: filename, fullPage: true });
    }
    //// END DEBUG ////
    
    // Wait for the list to appear
    console.log('Waiting for selector .virtual-list .item-title');
    try {
        await page.waitForSelector('.virtual-list .item-title');
    } catch (e) {
        console.error('Failed waiting for list items:', e && e.message ? e.message : e);
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

  console.log(`Found ${itemTitles.length} items on the Alexa shopping list.`);

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
		console.log("DEBUG: Full list of scraped items ->", jsonFormattedItems);
	}
	//// END DEBUG ////
  

  // Close the browser when done
    await browser.close();
})();
