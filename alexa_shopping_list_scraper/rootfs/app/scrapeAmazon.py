#!/usr/bin/env python3
"""
Amazon Alexa Shopping List Scraper - Using undetected-chromedriver
This bypasses bot detection much better than puppeteer-extra
"""

import os
import sys
import json
import time
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import pyotp  # For OTP if needed
from dotenv import load_dotenv

# Load .env file
load_dotenv()

def log(message, prefix="[scrape]"):
    """Print with timestamp"""
    print(f"{prefix} {message}", flush=True)

def get_env(key, default=None):
    """Get environment variable"""
    return os.environ.get(key, default)

class AmazonShoppingListScraper:
    def __init__(self):
        self.region = get_env('Amazon_Region', 'de')
        self.email = get_env('Amazon_Login')
        self.password = get_env('Amazon_Pass')
        self.otp_secret = get_env('Amazon_Secret')
        self.debug = get_env('log_level', '').lower() == 'true'
        self.force_headless = get_env('FORCE_HEADLESS', '').lower() == 'true'
        
        self.base_url = f"https://www.amazon.{self.region}"
        self.signin_url = self._build_signin_url()
        self.shopping_list_url = f"{self.base_url}/alexaquantum/sp/alexaShoppingList?ref_=list_d_wl_ys_list_1"
        
        self.driver = None
        self.temp_profile_dir = None  # Track temp dir for cleanup
        
    def _build_signin_url(self):
        """Build Amazon sign-in URL"""
        params = (
            "openid.pape.max_auth_age=3600"
            f"&openid.return_to=https%3A%2F%2Fwww.amazon.{self.region}%2Falexaquantum%2Fsp%2FalexaShoppingList%3Fref_%3Dlist_d_wl_ys_list_1"
            "&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select"
            f"&openid.assoc_handle=amzn_alexa_quantum_{self.region}"
            "&openid.mode=checkid_setup"
            "&openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select"
            "&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0"
        )
        return f"{self.base_url}/ap/signin?{params}"
    
    def init_driver(self):
        """Initialize undetected Chrome driver"""
        log("Initializing undetected Chrome driver...")
        
        options = uc.ChromeOptions()
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--window-size=1920,1080')
        options.add_argument('--lang=de-DE')
        options.add_argument('--disable-software-rasterizer')
        options.add_argument('--disable-extensions')
        
        # Determine if running in Docker or local dev environment
        is_docker = os.path.exists('/.dockerenv') or os.path.exists('/data')
        
        # STATELESS: Use temp directory that gets cleaned up
        # No persistent user-data-dir = fresh session every run
        import tempfile
        self.temp_profile_dir = tempfile.mkdtemp(prefix='chrome_temp_')
        options.add_argument(f'--user-data-dir={self.temp_profile_dir}')
        log(f"🔄 Using temporary profile (stateless): {self.temp_profile_dir}")
        
        if is_docker:
            # Docker/Home Assistant environment - always headless
            options.add_argument('--disable-gpu')
            options.add_argument('--headless=new')
            # Alpine Linux paths
            options.binary_location = '/usr/bin/chromium-browser'
            driver_path = '/usr/bin/chromedriver'
        else:
            # Local development environment
            # Headful for debugging when log_level=true
            if self.debug and not self.force_headless:
                log("🖥️  Running in HEADFUL mode (you'll see the browser)")
            else:
                log("🔇 Running in HEADLESS mode")
                options.add_argument('--headless=new')
            driver_path = None  # Let undetected-chromedriver find it
        
        try:
            # undetected_chromedriver automatically handles detection bypasses
            # Let it auto-download the correct chromedriver version for our Chrome
            if is_docker:
                # In Docker, use the system chromedriver
                self.driver = uc.Chrome(
                    options=options,
                    version_main=None,
                    use_subprocess=True,
                    driver_executable_path=driver_path
                )
            else:
                # In local dev, let undetected-chromedriver handle everything
                self.driver = uc.Chrome(
                    options=options,
                    version_main=140,  # Force Chrome 140 driver
                    use_subprocess=False  # Don't use subprocess for better compatibility
                )
            
            self.driver.set_page_load_timeout(60)
            log("✅ Driver initialized successfully")
            if not is_docker and self.debug:
                log("💡 Browser window is visible - watch the magic happen!")
            return True
        except Exception as e:
            log(f"❌ Failed to initialize driver: {e}")
            if not is_docker:
                log("💡 Make sure Chrome/Chromium is installed on your system")
                log("💡 undetected-chromedriver will auto-download the correct driver version")
            return False
    
    def login_with_email_password(self):
        """Login using email and password"""
        log("🔐 Attempting email/password authentication...")
        
        try:
            # Navigate to signin page
            log("📍 Navigating to sign-in page...")
            self.driver.get(self.signin_url)
            time.sleep(0.6)
            
            # Check for cookie warning
            try:
                warning = self.driver.find_element(By.ID, 'auth-cookie-warning-message')
                if warning.is_displayed():
                    log("⚠️  Amazon cookie warning detected - this shouldn't happen with undetected-chromedriver!")
            except:
                pass  # No warning, good!
            
            # Enter email
            log("📧 Entering email...")
            try:
                email_field = WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.ID, 'ap_email'))
                )
                email_field.clear()
                email_field.send_keys(self.email)
                time.sleep(0.2)
                
                # Click continue
                continue_btn = self.driver.find_element(By.ID, 'continue')
                continue_btn.click()
                time.sleep(0.6)
            except Exception as e:
                import traceback
                log(f"❌ Failed to enter email: {e}")
                log(f"   Current URL: {self.driver.current_url}")
                log(f"   Page title: {self.driver.title}")
                log(f"   Full traceback:\n{traceback.format_exc()}")
                try:
                    screenshot_path = f"error_screenshot_{int(time.time())}.png"
                    self.driver.save_screenshot(screenshot_path)
                    log(f"   Screenshot saved: {screenshot_path}")
                except Exception as ss_err:
                    log(f"   Could not save screenshot: {ss_err}")
                return False
            
            # Enter password
            log("🔑 Entering password...")
            try:
                password_field = WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.ID, 'ap_password'))
                )
                password_field.clear()
                password_field.send_keys(self.password)
                time.sleep(0.2)
                
                # Click sign in
                signin_btn = self.driver.find_element(By.ID, 'signInSubmit')
                signin_btn.click()
                time.sleep(1)
            except Exception as e:
                log(f"❌ Failed to enter password: {e}")
                return False
            
            # Check for OTP
            if self.otp_secret and ('cvf' in self.driver.current_url or 'ap/mfa' in self.driver.current_url):
                log("🔐 OTP required...")
                if not self.handle_otp():
                    return False
                # After OTP, Amazon redirects - no need for additional sleep
            else:
                # No OTP, wait a bit for redirect after password
                time.sleep(0.8)
            
            # Verify login success
            if '/ap/signin' in self.driver.current_url or '/ap/cvf' in self.driver.current_url:
                log("❌ Still on login page - authentication failed")
                return False
            
            log("✅ Login successful!")
            # No need to manually save cookies - undetected-chromedriver handles session persistence
            return True
            
        except Exception as e:
            log(f"❌ Login failed: {e}")
            return False
    
    def handle_otp(self):
        """Handle OTP/2FA"""
        try:
            totp = pyotp.TOTP(self.otp_secret)
            otp_code = totp.now()
            log(f"🔢 Submitting OTP...")
            
            # Find OTP input field
            otp_field = WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.ID, 'auth-mfa-otpcode'))
            )
            otp_field.clear()
            otp_field.send_keys(otp_code)
            time.sleep(0.1)
            
            # Submit OTP
            submit_btn = self.driver.find_element(By.ID, 'auth-signin-button')
            submit_btn.click()
            
            # Wait for redirect (Amazon will redirect to return URL)
            time.sleep(1.5)
            
            log("✅ OTP submitted, waiting for redirect...")
            return True
        except Exception as e:
            log(f"❌ OTP handling failed: {e}")
            return False
    
    def scrape_shopping_list(self):
        """Scrape the shopping list items"""
        log("📋 Scraping shopping list...")
        
        try:
            # Check if we're already on the shopping list page (after OTP redirect)
            if 'alexaShoppingList' not in self.driver.current_url:
                log("🔄 Navigating to shopping list...")
                self.driver.get(self.shopping_list_url)
                time.sleep(0.8)
            else:
                log("✅ Already on shopping list page")
            
            # Wait for list container to load
            WebDriverWait(self.driver, 15).until(
                EC.presence_of_element_located((By.CLASS_NAME, 'virtual-list'))
            )
            
            items = []
            
            # Find all item containers (each item is in a div with class containing pattern)
            # Look for all checkboxes (one per item)
            checkboxes = self.driver.find_elements(By.CSS_SELECTOR, 'input.custom-control-input[type="checkbox"]')
            
            log(f"🔍 Found {len(checkboxes)} items")
            
            for checkbox in checkboxes:
                try:
                    # Get checkbox state
                    is_completed = checkbox.is_selected()
                    
                    # Find the item title in the same parent container
                    # Navigate to parent and find the p.item-title
                    parent = checkbox
                    item_text = None
                    
                    # Go up to find the row container, then find title
                    for _ in range(15):  # Max 15 levels up
                        try:
                            parent = parent.find_element(By.XPATH, '..')
                            title_elem = parent.find_element(By.CSS_SELECTOR, 'p.item-title')
                            item_text = title_elem.text.strip()
                            break
                        except:
                            continue
                    
                    if item_text:
                        items.append({
                            'name': item_text,
                            'completed': is_completed
                        })
                        log(f"  ✓ {item_text} {'(✅ completed)' if is_completed else ''}")
                    else:
                        log(f"  ⚠️  Found checkbox but no title")
                
                except Exception as e:
                    if self.debug:
                        log(f"⚠️  Error parsing item: {e}")
                    continue
            
            log(f"✅ Found {len(items)} items total")
            
            # Save to file
            with open('list_of_items.json', 'w', encoding='utf-8') as f:
                json.dump(items, f, indent=2, ensure_ascii=False)
            
            log("💾 Saved to list_of_items.json")
            return True
            
        except Exception as e:
            log(f"❌ Failed to scrape shopping list: {e}")
            if self.debug:
                import traceback
                log(f"   Full traceback:\n{traceback.format_exc()}")
                try:
                    # Save page source for debugging
                    with open('error_page_source.html', 'w', encoding='utf-8') as f:
                        f.write(self.driver.page_source)
                    log("   Page source saved to error_page_source.html")
                except:
                    pass
            return False
    
    def run(self):
        """Main execution flow"""
        log("═══════════════════════════════════════════════════════════")
        log(f"Amazon Region: {self.region}")
        log(f"Authentication: Email/Password + OTP")
        log(f"Shopping List URL: {self.shopping_list_url}")
        log("═══════════════════════════════════════════════════════════")
        log("")
        
        try:
            # Initialize driver
            if not self.init_driver():
                return False
            
            # STATELESS: Always authenticate fresh (no cookies)
            # Email/password authentication with OTP
            if not self.login_with_email_password():
                log("❌ Authentication failed!")
                return False
            
            # Scrape the list
            return self.scrape_shopping_list()
            
        except Exception as e:
            log(f"❌ Unexpected error: {e}")
            return False
        finally:
            if self.driver:
                self.driver.quit()
            
            # Cleanup temporary profile directory (stateless)
            if self.temp_profile_dir and os.path.exists(self.temp_profile_dir):
                try:
                    import shutil
                    shutil.rmtree(self.temp_profile_dir)
                    log(f"🧹 Cleaned up temporary profile: {self.temp_profile_dir}")
                except Exception:
                    pass  # Silently ignore cleanup errors

if __name__ == '__main__':
    scraper = AmazonShoppingListScraper()
    success = scraper.run()
    sys.exit(0 if success else 12)

