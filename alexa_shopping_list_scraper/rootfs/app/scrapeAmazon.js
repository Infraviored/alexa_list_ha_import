require('dotenv').config();

////////////// change to stealth
//const puppeteer = require('puppeteer');

// puppeteer-extra is a drop-in replacement for puppeteer,
// it augments the installed puppeteer with plugin functionality
const puppeteer = require('puppeteer-extra')

// add stealth plugin and use defaults (all evasion techniques)
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

//////////// end change to stealth

const fs = require('fs');

function getTimestamp() {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-');
}

function getEnvVariable(key) {
    return process.env[key];
}

function ensureDirExists(dirPath) {
    try {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    } catch (e) {
        // best-effort; continue even if directory creation fails
    }
}

const delete_after_download = getEnvVariable('DELETE_AFTER_DOWNLOAD');
const log_level = getEnvVariable('log_level');
const amz_shoppinglist_url = getEnvVariable('Amazon_Shopping_List_Page');

(async () => {
    const browser = await puppeteer.launch({
//            headless: true,
            defaultViewport: null,
            userDataDir: '/data/chrome_profile',
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
        // Use a realistic, recent desktop Chrome UA to reduce bot detection
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        // Ensure debug output directory exists if logging enabled
        if (log_level == "true") {
            ensureDirExists('www');
        }

    // Cookie-based authentication only
    let cookiesLoaded = false;
    function normalizeCookies(cookies, baseUrl) {
        const origin = (() => {
            try { const u = new URL(baseUrl); return `${u.protocol}//${u.hostname}`; } catch { return undefined; }
        })();
        const allowedSameSite = new Set(['Strict','Lax','None']);
        return cookies.map((c) => {
            const out = { name: c.name, value: String(c.value) };
            if (c.domain) out.domain = c.domain;
            if (!c.domain && origin) out.url = origin;
            out.path = c.path || '/';
            if (typeof c.httpOnly === 'boolean') out.httpOnly = c.httpOnly;
            if (typeof c.secure === 'boolean') out.secure = c.secure;
            if (c.sameSite && allowedSameSite.has(c.sameSite)) out.sameSite = c.sameSite;
            if (typeof c.expires === 'number') out.expires = Math.floor(c.expires);
            if (typeof c.expirationDate === 'number') out.expires = Math.floor(c.expirationDate);
            return out;
        });
    }
    try {
        const candidates = ['/data/cookies.json', 'cookies.json'];
        for (const p of candidates) {
            if (fs.existsSync(p)) {
                const raw = fs.readFileSync(p, 'utf8');
                const cookies = JSON.parse(raw);
                if (Array.isArray(cookies) && cookies.length > 0) {
                    const sanitized = normalizeCookies(cookies, amz_shoppinglist_url);
                    await page.setCookie(...sanitized);
                    console.log(`Loaded ${cookies.length} cookies from ${p}`);
                    cookiesLoaded = true;
                    break;
                }
            }
        }
    } catch (err) {
        console.error('Failed to load cookies:', err && err.message ? err.message : err);
    }
    if (!cookiesLoaded) {
        console.error('No cookies found. Please paste cookies JSON into Cookies_JSON in add-on options.');
        throw new Error('Missing cookies.json');
    }

	if (await page.$('#ap_password')) {
            await page.type('#ap_email', amz_login);
            await page.type('#ap_password', amz_password);
	    	//// DEBUG ////////
		if(log_level == "true"){
		const timestamp = getTimestamp();
//    			const filename = `www/${timestamp}-03.1-screenshot_login_user_and_pass_page.png`;
//    			await page.screenshot({ path: filename, fullPage: true });
		const html = await page.content();
		console.log(`[DEBUG ${timestamp}] 03.1-login_user_and_pass HTML:\n`, html);
		}
		//// END DEBUG ////
            await page.click('#signInSubmit');
            //await page.waitForNavigation();
	    await page.waitForNavigation({waitUntil: 'networkidle0',timeout: 0,});
	} else {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 30 second delay
            await page.type('#ap_email', amz_login);
		//// DEBUG ////////
		if(log_level == "true"){
		const timestamp = getTimestamp();
//    			const filename = `www/${timestamp}-03.2-screenshot_login_only_and_pass_page.png`;
//		await page.screenshot({ path: filename, fullPage: true });
		const html = await page.content();
		console.log(`[DEBUG ${timestamp}] 03.2-login_only_and_pass HTML:\n`, html);
		}
		//// END DEBUG ////
            await page.click('#continue');
            //await page.waitForNavigation();
	    await page.waitForNavigation({waitUntil: 'networkidle0',timeout: 0,});
		//// DEBUG ////////
		if(log_level == "true"){
		const timestamp = getTimestamp();
//    			const filename = `www/${timestamp}-03.3-screenshot_pass_only_before_page.png`;
//		await page.screenshot({ path: filename, fullPage: true });
		const html = await page.content();
		console.log(`[DEBUG ${timestamp}] 03.3-pass_only_before HTML:\n`, html);
		}
		//// END DEBUG ////
                await page.type('#ap_password', amz_password);
		//// DEBUG ////////
		if(log_level == "true"){
		const timestamp = getTimestamp();
//    			const filename = `www/${timestamp}-03.4-screenshot_pass_only_after_page.png`;
//		await page.screenshot({ path: filename, fullPage: true });
		const html = await page.content();
		console.log(`[DEBUG ${timestamp}] 03.4-pass_only_after HTML:\n`, html);
		}
		//// END DEBUG ////
            await page.click('#signInSubmit');
            //await page.waitForNavigation();
	    await page.waitForNavigation({waitUntil: 'networkidle0',timeout: 0,});
	}

    // Handle OTP (if required)
    if (await page.$('#auth-mfa-otpcode')) {
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
	//// DEBUG ////////
	if(log_level == "true"){
	const timestamp = getTimestamp();
//    	const filename = `www/${timestamp}-04-screenshot_otp_page.png`;
//	await page.screenshot({ path: filename, fullPage: true });
	const html = await page.content();
	console.log(`[DEBUG ${timestamp}] 04-otp_page HTML:\n`, html);
	}
	//// END DEBUG ////
        await page.click('#auth-signin-button');
        //await page.waitForNavigation();
	await page.waitForNavigation({waitUntil: 'networkidle0',timeout: 0,});
    }

    // Navigate to Alexa Shopping List page
    await page.goto(amz_shoppinglist_url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Best-effort: accept cookies/consent if presented (Amazon EU/US variants)
    try {
        const consentSelectors = ['#sp-cc-accept', 'input[name="accept"]', 'button[name="accept"]', 'button#consent-accept-button'];
        for (const sel of consentSelectors) {
            const btn = await page.$(sel);
            if (btn) {
                await btn.click();
                await page.waitForTimeout(1000);
                break;
            }
        }
    } catch (e) {
        // ignore
    }
	
    //// DEBUG ////////
    if(log_level == "true"){
        const timestamp = getTimestamp();
        const html = await page.content();
        console.log(`[DEBUG ${timestamp}] 05.1-shopping_list_page HTML:\n`, html);
    }
    //// END DEBUG ////
    
    // Wait for the list to appear (robust: try multiple candidate selectors)
    async function waitForAnySelector(pageRef, selectors, options = {}) {
        const timeoutPerSelectorMs = Math.max(2000, Math.floor((options.timeout || 60000) / Math.max(1, selectors.length)));
        const waitOptions = { visible: true, timeout: timeoutPerSelectorMs };
        const failures = [];
        for (const selector of selectors) {
            try {
                await pageRef.waitForSelector(selector, waitOptions);
                return selector;
            } catch (err) {
                failures.push({ selector, error: String(err && err.message ? err.message : err) });
            }
        }
        const timestamp = getTimestamp();
        try { ensureDirExists('www'); } catch {}
        // try { await pageRef.screenshot({ path: `www/${timestamp}-ERROR-shopping_list_wait_timeout.png`, fullPage: true }); } catch {}
        try { fs.writeFileSync(`www/${timestamp}-ERROR-shopping_list_dom.html`, await pageRef.content()); } catch {}
        try { console.log(`[DEBUG ${timestamp}] ERROR-shopping_list_dom HTML:\n`, await pageRef.content()); } catch {}
        console.error('Failed waiting for any selector. Attempts:', failures.map(f => f.selector).join(', '));
        throw new Error('Unable to find shopping list items on the page');
    }

    const candidateItemTitleSelectors = [
        '.virtual-list .item-title',              // original
        '.virtualList .itemTitle',                // camelCase variant
        '[data-testid="list-item-title"]',      // test id style
        'div[role="listitem"] .item-title',     // ARIA list items
        '.list-item .item-title',
        '.listItem .title',
        'li .item-title'
    ];

    const matchedItemSelector = await waitForAnySelector(page, candidateItemTitleSelectors, { timeout: 60000 });
    console.log(`Using item selector: ${matchedItemSelector}`);

    // Scroll through the list to load all items
    await page.evaluate(async () => {
        const container = document.querySelector('.virtual-list') || document.scrollingElement || document.documentElement;
        let lastHeight = container.scrollHeight || document.body.scrollHeight;
        for (let i = 0; i < 50; i++) {
            container.scrollTo(0, lastHeight);
            await new Promise(resolve => setTimeout(resolve, 1200));
            const newHeight = container.scrollHeight || document.body.scrollHeight;
            if (newHeight === lastHeight) {
                break;
            }
            lastHeight = newHeight;
        }
    });

    //// DEBUG ////////
    if(log_level == "true"){
	const timestamp = getTimestamp();
	const html = await page.content();
	console.log(`[DEBUG ${timestamp}] 05.2-shopping_list_page_scrolled HTML:\n`, html);
    }
    //// END DEBUG ////

  let itemTitles = await page.$$eval(matchedItemSelector, items =>
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
