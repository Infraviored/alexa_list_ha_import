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

const OTPAuth = require('otpauth');  // For handling OTP
const fs = require('fs');

function getTimestamp() {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-');
}

function getEnvVariable(key) {
    return process.env[key];
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

// start loop code
let elementExists = false;
do {
//    Navigate to Amazon login page
//    await page.goto('https://www.amazon.com/ap/signin?openid.pape.max_auth_age=3600&openid.return_to=https%3A%2F%2Fwww.amazon.com%2Falex>

//// Get teh main amaozn page ////
const url = amz_signin_url;
const parts = url.split('/');
const result = parts.slice(0, 3).join('/');
//console.log(result); 

//// END Get teh main amaozn page ////
	
    await page.goto(result, { waitUntil: 'load', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 1500));
	//// DEBUG ////////
        if(log_level == "true"){
	const timestamp = getTimestamp();
    	const filename = `www/${timestamp}-01-screenshot_main_page.png`;
        await page.screenshot({ path: filename, fullPage: true });
        }
        //// END DEBUG ////

    //await page.goto('https://www.amazon.com/ap/signin?openid.pape.max_auth_age=3600&openid.return_to=https%3A%2F%2Fwww.amazon.com%2Falex')};
    //await page.goto(amz_signin_url, { waitUntil: 'load', timeout: 60000 });
	await page.goto(amz_signin_url, { waitUntil: 'networkidle2', timeout: 0 });
    elementExists = await page.$('#ap_email') !== null;
} while (!elementExists);

	//// DEBUG ////////
	if(log_level == "true"){
	const timestamp = getTimestamp();
    	const filename = `www/${timestamp}-02-screenshot_login_page.png`;
	await page.screenshot({ path: filename, fullPage: true });	
	}
	//// END DEBUG ////
	
	
/// end loop code

	if (await page.$('#ap_password')) {
            await page.type('#ap_email', amz_login);
            await page.type('#ap_password', amz_password);
	    	//// DEBUG ////////
		if(log_level == "true"){
		const timestamp = getTimestamp();
    		const filename = `www/${timestamp}-03.1-screenshot_login_user_and_pass_page.png`;
      		await page.screenshot({ path: filename, fullPage: true });
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
    		const filename = `www/${timestamp}-03.2-screenshot_login_only_and_pass_page.png`;
		await page.screenshot({ path: filename, fullPage: true });
		}
		//// END DEBUG ////
            await page.click('#continue');
            //await page.waitForNavigation();
	    await page.waitForNavigation({waitUntil: 'networkidle0',timeout: 0,});
		//// DEBUG ////////
		if(log_level == "true"){
		const timestamp = getTimestamp();
    		const filename = `www/${timestamp}-03.3-screenshot_pass_only_before_page.png`;
		await page.screenshot({ path: filename, fullPage: true });
		}
		//// END DEBUG ////
                await page.type('#ap_password', amz_password);
		//// DEBUG ////////
		if(log_level == "true"){
		const timestamp = getTimestamp();
    		const filename = `www/${timestamp}-03.4-screenshot_pass_only_after_page.png`;
		await page.screenshot({ path: filename, fullPage: true });
		// Extract all IDs
    		const ids = await page.evaluate(() => {
        	const elements = document.querySelectorAll('[id]');
        	return Array.from(elements).map(element => element.id);
    		});
		// Print the IDs
    		console.log(ids);
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
    	const filename = `www/${timestamp}-04-screenshot_otp_page.png`;
	await page.screenshot({ path: filename, fullPage: true });
	}
	//// END DEBUG ////
        await page.click('#auth-signin-button');
        //await page.waitForNavigation();
	await page.waitForNavigation({waitUntil: 'networkidle0',timeout: 0,});
    }

    // Navigate to Alexa Shopping List page
    await page.goto(amz_shoppinglist_url, { waitUntil: 'networkidle2', timeout: 60000 });
	
    //// DEBUG ////////
    if(log_level == "true"){
        const timestamp = getTimestamp();
        const filename = `www/${timestamp}-05.1-screenshot_shopping_list_page.png`;
        await page.screenshot({ path: filename, fullPage: true });
    }
    //// END DEBUG ////
    
    // Wait for the list to appear
    await page.waitForSelector('.virtual-list .item-title');

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
	console.log(jsonFormattedItems);
        }
        //// END DEBUG ////
  

  // Close the browser when done
    await browser.close();
})();
