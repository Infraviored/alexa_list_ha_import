#!/usr/bin/env python3
"""
Amazon Alexa Shopping List Scraper - Using undetected-chromedriver
This bypasses bot detection much better than puppeteer-extra
"""

import os
import sys
import json
import time
import re
import shutil
import subprocess
import tempfile
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import pyotp  # For OTP if needed
from dotenv import load_dotenv

# Load .env file
load_dotenv()

def log(message):
    """Simple logging helper"""
    print(f"[scrape] {message}", flush=True)

def get_config():
    """Load configuration from /data/options.json (HA) or environment variables (Dev)"""
    config = {}
    options_path = "/data/options.json"
    
    if os.path.exists(options_path):
        try:
            with open(options_path, "r") as f:
                config = json.load(f)
        except Exception as e:
            print(f"Error loading {options_path}: {e}")

    # Helper to get value from config or env
    def get_val(key, default=None):
        # HA options are usually ExactMatch, but env might be UPPERCASE
        val = config.get(key)
        if val is None:
            val = os.environ.get(key)
        if val is None:
            val = os.environ.get(key.upper())
        return val if val is not None else default

    # Build normalized config object
    return {
        "region": get_val("Amazon_Region", "de"),
        "email": get_val("Amazon_Login"),
        "password": get_val("Amazon_Pass"),
        "otp_secret": get_val("Amazon_Secret"),
        "debug": str(get_val("Debug_Log", "false")).lower() == "true",
        "check_after_import": str(get_val("Check_after_import", "false")).lower() == "true",
        "headful": str(get_val("HEAD", "false")).lower() == "true",
        "force_headless": str(get_val("FORCE_HEADLESS", "false")).lower() == "true",
        "assoc_handle": get_val("Amazon_Assoc_Handle"),
        "language": get_val("Amazon_Language"),
    }

from marketplace_auth import get_marketplace_auth

class AmazonShoppingListScraper:
    def __init__(self):
        config = get_config()
        self.region = config["region"]
        self.email = config["email"]
        self.password = config["password"]
        self.otp_secret = config["otp_secret"]
        self.debug = config["debug"]
        
        # VISIBILITY: Default Headless. Use HEAD=True for headful development.
        self.headful = config["headful"]
        self.force_headless = config["force_headless"]
        self.check_after_import = config["check_after_import"]
        
        # MARKETPLACE-SPECIFIC AUTH
        auth = get_marketplace_auth(
            region=self.region,
            assoc_override=config["assoc_handle"],
            lang_override=config["language"]
        )
        
        self.assoc_handle = auth["assoc_handle"]
        self.language = auth.get("language")
        self.signin_url = auth["signin_url"]
        
        self.base_url = f"https://www.amazon.{self.region}"
        self.shopping_list_url = f"{self.base_url}/alexaquantum/sp/alexaShoppingList?ref_=list_d_wl_ys_list_1"
        
        self.driver = None
        self.temp_profile_dir = None
        self.browser_binary = None
        self.chrome_major = None

    def _detect_browser_binary(self):
        if self.browser_binary and os.path.exists(self.browser_binary):
            return self.browser_binary

        candidates = [
            "/usr/bin/chromium-browser",
            "/usr/bin/chromium",
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/google-chrome-beta",
        ]
        for path in candidates:
            if os.path.exists(path):
                self.browser_binary = path
                return path
        return None

    def _detect_chrome_major(self):
        browser = self._detect_browser_binary()
        if not browser:
            return None
        try:
            out = subprocess.check_output(
                [browser, "--version"],
                stderr=subprocess.STDOUT,
                text=True
            ).strip()
            match = re.search(r"(\d+)\.", out)
            if match:
                self.chrome_major = int(match.group(1))
                return self.chrome_major
        except Exception as e:
            log(f"⚠️ Failed to detect browser version from {browser}: {e}")
        return None

    def _log_runtime_versions(self):
        commands = [
            ["/usr/bin/chromedriver", "--version"],
            ["/usr/bin/chromium-browser", "--version"],
            ["/usr/bin/chromium", "--version"],
        ]
        for cmd in commands:
            try:
                out = subprocess.check_output(
                    cmd,
                    stderr=subprocess.STDOUT,
                    text=True
                ).strip()
                log(f"ℹ️ {out}")
            except Exception:
                pass

    def _kill_stale_processes(self):
        for binary in ("/usr/bin/pkill", "/bin/pkill"):
            if not os.path.exists(binary):
                continue
            for pattern in ("chromedriver", "chromium", "chrome"):
                try:
                    subprocess.run(
                        [binary, "-f", pattern],
                        check=False,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL
                    )
                except Exception:
                    pass
            time.sleep(1)
            return

    def _create_fresh_profile_dir(self):
        self.temp_profile_dir = tempfile.mkdtemp(prefix="amazon_chrome_")
        return self.temp_profile_dir

    def _cleanup_profile_runtime_artifacts(self, profile_dir):
        if not profile_dir or not os.path.isdir(profile_dir):
            return
        for name in (
            "SingletonLock",
            "SingletonCookie",
            "SingletonSocket",
            "DevToolsActivePort",
            "chrome_debug.log",
        ):
            path = os.path.join(profile_dir, name)
            try:
                if os.path.exists(path):
                    os.remove(path)
            except Exception as e:
                log(f"⚠️ Could not remove runtime artifact {path}: {e}")

    def _cleanup_profile_dir(self):
        if self.temp_profile_dir and os.path.isdir(self.temp_profile_dir):
            try:
                shutil.rmtree(self.temp_profile_dir, ignore_errors=True)
            except Exception as e:
                log(f"⚠️ Could not remove temp profile dir {self.temp_profile_dir}: {e}")
            finally:
                self.temp_profile_dir = None
        
    
    def _install_webauthn_killer(self):
        """
        Block WebAuthn in the page context before JavaScript runs.
        This prevents the native passkey/QR popup.
        """
        try:
            self.driver.execute_cdp_cmd(
                "Page.addScriptToEvaluateOnNewDocument",
                {
                    "source": r"""
        (() => {
          const fail = async () => {
            throw new DOMException('WebAuthn disabled for automation', 'NotSupportedError');
          };

          try {
            Object.defineProperty(window, 'PublicKeyCredential', {
              get: () => undefined,
              configurable: false
            });
          } catch (e) {}

          try {
            if (navigator.credentials) {
              const origGet = navigator.credentials.get
                ? navigator.credentials.get.bind(navigator.credentials)
                : null;
              const origCreate = navigator.credentials.create
                ? navigator.credentials.create.bind(navigator.credentials)
                : null;

              if (origGet) {
                navigator.credentials.get = async function(options) {
                  if (options && options.publicKey) return fail();
                  return origGet(options);
                };
              }

              if (origCreate) {
                navigator.credentials.create = async function(options) {
                  if (options && options.publicKey) return fail();
                  return origCreate(options);
                };
              }
            }
          } catch (e) {}
        })();
        """
                },
            )
        except:
            pass

    def init_driver(self, max_retries=3):
        """Initialize undetected Chrome driver with retry logic"""
        is_docker = os.path.exists('/.dockerenv') or os.path.exists('/data')

        self.browser_binary = self._detect_browser_binary()
        if not self.browser_binary:
            log("❌ Could not find a Chromium/Chrome browser binary")
            return False

        self.chrome_major = self._detect_chrome_major()
        if not self.chrome_major:
            log("❌ Could not detect Chromium major version")
            return False

        if self.debug:
            self._log_runtime_versions()
            log(f"ℹ️ Using browser binary: {self.browser_binary}")
            log(f"ℹ️ Using Chromium major version: {self.chrome_major}")

        for attempt in range(1, max_retries + 1):
            try:
                if self.debug:
                    log(f"Initializing undetected Chrome driver (Attempt {attempt}/{max_retries})...")

                self._kill_stale_processes()
                self._cleanup_profile_dir()

                options = uc.ChromeOptions()
                options.add_argument('--no-sandbox')
                options.add_argument('--disable-dev-shm-usage')
                options.add_argument('--disable-gpu')
                options.add_argument('--disable-software-rasterizer')
                options.add_argument('--disable-extensions')
                options.add_argument('--disable-background-networking')
                options.add_argument('--disable-sync')
                options.add_argument('--metrics-recording-only')
                options.add_argument('--no-first-run')
                options.add_argument('--password-store=basic')
                options.add_argument('--use-mock-keychain')

                # Disable native credential prompts via flags (though CDP script is more reliable)
                options.add_argument('--disable-features=WebAuthentication,WebAuthenticationCustomUI,Bluetooth,FileSelectionDialogs')
                options.add_argument('--disable-blink-features=WebAuthentication')

                # Additional preferences to keep the browser quiet
                options.add_experimental_option("prefs", {
                    "credentials_enable_service": False,
                    "profile.password_manager_enabled": False,
                    "profile.default_content_setting_values.notifications": 2,
                    "autofill.profile_enabled": False,
                    "autofill.credit_card_enabled": False
                })
                options.add_argument('--window-size=1920,1080')

                # Use detected language or fallback to region-based
                browser_lang = self.language or ("de-DE" if self.region == "de" else "en-US")
                options.add_argument(f'--lang={browser_lang}')

                # Use a fresh profile each run to avoid stale Chromium lock state
                self.temp_profile_dir = self._create_fresh_profile_dir()
                self._cleanup_profile_runtime_artifacts(self.temp_profile_dir)
                options.add_argument(f'--user-data-dir={self.temp_profile_dir}')
                options.binary_location = self.browser_binary

                if is_docker:
                    # Docker/Home Assistant environment - always headless
                    options.add_argument('--headless=new')
                    driver_path = '/usr/bin/chromedriver'
                    if not os.path.exists(driver_path):
                        log(f"❌ Chromedriver not found at {driver_path}")
                        return False
                    self.driver = uc.Chrome(
                        options=options,
                        driver_executable_path=driver_path,
                        browser_executable_path=self.browser_binary,
                        version_main=self.chrome_major
                    )
                else:
                    if self.headful and not self.force_headless:
                        log("🗣️ Running in HEADFUL mode (browser window visible)")
                    else:
                        options.add_argument('--headless=new')

                    self.driver = uc.Chrome(
                        options=options,
                        browser_executable_path=self.browser_binary,
                        version_main=self.chrome_major,
                        use_subprocess=False
                    )

                # Install the WebAuthn killer immediately after driver creation
                self._install_webauthn_killer()
                self.driver.set_page_load_timeout(60)

                log("✅ Driver initialized successfully")
                return True

            except Exception as e:
                log(f"⚠️ Driver initialization attempt {attempt} failed: {e}")
                try:
                    if self.driver:
                        self.driver.quit()
                except Exception:
                    pass
                self.driver = None
                self._cleanup_profile_dir()
                if attempt < max_retries:
                    time.sleep(5) # Wait before retrying
                else:
                    log("❌ All driver initialization attempts failed.")
                    if not is_docker:
                        log("Make sure Chrome/Chromium is installed on your system")
                    return False
    
    def log_page_diagnostics(self):
        """Log detailed page diagnostics on failure"""
        if not self.debug:
            return
        try:
            log("🔍 Diagnostic Dump:")
            log(f"   URL: {self.driver.current_url}")
            log(f"   Title: {self.driver.title}")
            # Get a list of all IDs for buttons and inputs
            diag_js = """
            let diag = {
                ids: [], 
                names: [],
                captcha: !!document.querySelector('img[src*="captcha"], #auth-captcha-image')
            };
            document.querySelectorAll('input, button, a').forEach(el => {
                if (el.id) diag.ids.push(el.id);
                if (el.name) diag.names.push(el.name);
            });
            return diag;
            """
            diag = self.driver.execute_script(diag_js)
            if diag['captcha']:
                log("🚨 CAPTCHA DETECTED! Amazon is blocking the automated login.")
            log(f"   Visible IDs: {', '.join(diag['ids'][:25])}")
            log(f"   Visible Names: {', '.join(diag['names'][:25])}")
        except Exception as e:
            log(f"   (Could not retrieve diagnostics: {e})")

    def login_with_email_password(self):
        """Login using email and password"""
        log("🔐 Checking authentication state...")
        
        # 1. First, check if we are already logged in via persistent cookies
        try:
            log("📍 Navigating to shopping list to check session...")
            self.driver.get(self.shopping_list_url)
            time.sleep(5)  # Increased wait time for session check (esp. for headless)
            
            # Check for the list element
            try:
                self.driver.find_element(By.CLASS_NAME, 'virtual-list')
                log("✅ Session restored! Already logged in.")
                return True
            except:
                log("ℹ️  No active session found, proceeding to login...")
        except Exception as e:
            log(f"⚠️  Session check failed: {e}")

        log("🔐 Attempting fresh email/password authentication...")
        
        try:
            # Navigate to signin page
            log("📍 Navigating to sign-in page...")
            self.driver.get(self.signin_url)
            time.sleep(3)
            
            # Check for cookie warning
            try:
                warning = self.driver.find_element(By.ID, 'sp-cc-accept')
                if warning.is_displayed():
                    log("⚠️  Amazon cookie warning detected - this shouldn't happen with undetected-chromedriver!")
            except:
                pass  # No warning, good!
            
            # Enter email
            log("📧 Entering email...")
            try:
                # Accept both standard (ap_email) and unified (ap_email_login) IDs
                email_field = WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, '#ap_email, #ap_email_login'))
                )
                email_field.clear()
                email_field.send_keys(self.email)
                time.sleep(0.2)
                
                # Click continue
                continue_btn = self.driver.find_element(By.ID, 'continue')
                
                # If password field is already visible, we don't need to click continue
                # (This happens on combined login pages)
                try:
                    pw_visible = self.driver.find_element(By.ID, 'ap_password').is_displayed()
                except:
                    pw_visible = False
                
                if not pw_visible:
                    continue_btn.click()
                    time.sleep(0.8)
                else:
                    log("ℹ️ Combined login page detected, skipping 'Continue' click.")
            except Exception as e:
                import traceback
                log(f"❌ Failed to enter email: {e}")
                self.log_page_diagnostics()
                if self.debug:
                    log(f"   Full traceback:\n{traceback.format_exc()}")
                return False
            
            # Enter password
            log("🔑 Entering password...")
            try:
                # IMPORTANT: In some regions/challenges, Email and Password are on the same page.
                # If we're already on a combined page, we don't need to wait for redirect.
                password_field = WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.ID, 'ap_password'))
                )
                password_field.clear()
                password_field.send_keys(self.password)
                time.sleep(0.5)
                
                # Check for "Keep me signed in" checkbox
                try:
                    remember_me = self.driver.find_element(By.NAME, 'rememberMe')
                    if not remember_me.is_selected():
                        remember_me.click()
                except:
                    pass

                # Click sign in - Use JS to be sure it triggers
                log("🖱️ Clicking Sign-In...")
                self.driver.execute_script("document.getElementById('signInSubmit').click();")
            except Exception as e:
                log(f"❌ Failed to submit password: {e}")
                
                # Check for explicit error message on page
                try:
                    error_box = self.driver.find_element(By.ID, 'auth-error-message-box')
                    if error_box.is_displayed():
                        log(f"⚠️  Amazon error detected: {error_box.text.strip()}")
                except:
                    pass

                self.log_page_diagnostics()
                return False

            # Wait for redirect or challenge
            time.sleep(3.5)
            
            # Diagnostic log
            current_url = self.driver.current_url.lower()
            log(f"📍 Transitioned to: {current_url}")

            # Comprehensive check for OTP / MFA
            # We look for the OTP field specifically, but can also trigger based on URL or choice pages
            otp_present = False
            try:
                # Be more patient for OTP to appear
                otp_field = WebDriverWait(self.driver, 5).until(
                    EC.presence_of_element_located((By.ID, 'auth-mfa-otpcode'))
                )
                otp_present = True
                log("🔢 OTP field detected")
            except:
                pass

            if self.otp_secret and (otp_present or '/mfa' in current_url or '/cvf' in current_url or 'auth-mfa-mfaChoice' in self.driver.page_source):
                log("🔐 OTP Required - Challenge detected")
                if not self.handle_otp():
                    log(f"❌ OTP failed. Current URL: {self.driver.current_url}")
                    return False
                # After OTP, Amazon redirects - wait a bit for landing page
                time.sleep(5)
            else:
                log("ℹ️  No OTP challenge detected (already logged in or list redirecting)...")
                time.sleep(2)
            
            # Verify login success
            # If we are STILL on a page containing signin, cvf, mfa, or claim, we failed.
            # But we must be patient as redirects can take several steps.
            # Define success: Must NOT be an auth page AND must have the list element
            def is_actually_logged_in():
                url = self.driver.current_url.lower()
                auth_identifiers = ['/ap/signin', '/ap/cvf', '/ap/mfa', '/ax/claim']
                is_stuck_on_auth = any(auth_id in url for auth_id in auth_identifiers)
                if is_stuck_on_auth:
                    return False
                
                # Check for actual shopping list elements
                try:
                    # Look for the virtual list or any list item
                    self.driver.find_element(By.CLASS_NAME, 'virtual-list')
                    return True
                except:
                    # Also consider a success if we are on the right URL and NOT on an auth page,
                    # but give it a moment to render.
                    return 'alexashoppinglist' in url and not is_stuck_on_auth

            log("⏳ Waiting for final redirect to shopping list...")
            max_check_retries = 5
            auth_identifiers = ['/ap/signin', '/ap/cvf', '/ap/mfa', '/ax/claim']
            for i in range(max_check_retries):
                current_url = self.driver.current_url.lower()
                
                # 1. Check for MFA/OTP explicitly first
                if 'auth-mfa-otpcode' in self.driver.page_source or '/ap/mfa' in current_url or '/ap/cvf' in current_url:
                    log("🔢 OTP/2FA challenge detected!")
                    if self.handle_otp():
                        time.sleep(3) # Wait for MFA redirect
                        continue
                    else:
                        return False
                
                # 2. Dismiss Passkey/Phone prompts if they appear
                try:
                    # Generic Amazon "Skip for now" links
                    skip_selectors = [
                        (By.ID, 'ap-account-fixup-phone-skip-link'),
                        (By.ID, 'passkey-cancel-button'),
                        (By.ID, 'auth-skip-link'),
                        (By.XPATH, "//a[contains(text(), 'Not now')]"),
                        (By.XPATH, "//a[contains(text(), 'Skip')]"),
                        (By.XPATH, "//button[contains(text(), 'Not now')]")
                    ]
                    for by_type, slctr in skip_selectors:
                        try:
                            el = self.driver.find_element(by_type, slctr)
                            if el and el.is_displayed():
                                log(f"🚫 Dismissing prompt: {slctr}")
                                self.driver.execute_script("arguments[0].click();", el)
                                time.sleep(2)
                        except:
                            pass
                except:
                    pass
                
                # 3. Check for actual success (Element based)
                if is_actually_logged_in():
                    log("✅ Successfully reached the Shopping List page!")
                    break
                
                # 3. Handle being stuck on an auth page
                is_on_auth = any(auth_id in current_url for auth_id in auth_identifiers)
                if is_on_auth:
                    if i < max_check_retries - 1:
                        # ACTIVE STATE MAINTENANCE: Re-fill if Amazon cleared the fields
                        try:
                            # Check email field
                            try:
                                email_f = self.driver.find_element(By.ID, 'ap_email')
                                if email_f.is_displayed() and not email_f.get_attribute('value'):
                                    log("📧 Email field cleared by Amazon, re-filling...")
                                    email_f.send_keys(self.email)
                            except: pass

                            # Check password field
                            pass_f = self.driver.find_element(By.ID, 'ap_password')
                            if pass_f.is_displayed():
                                if not pass_f.get_attribute('value'):
                                    log("🔑 Password field cleared by Amazon, re-filling...")
                                    pass_f.send_keys(self.password)
                                
                                log("⚠️  Login form still visible, re-submitting...")
                                # Try both possible submit buttons in one JS call
                                self.driver.execute_script("""
                                    let btn = document.getElementById('signInSubmit') || document.getElementById('continue');
                                    if (btn) btn.click();
                                """)
                        except:
                            pass
                            
                        log(f"⏳ Still on auth page ({current_url}). Waiting... ({i+1}/{max_check_retries})")
                        time.sleep(5) # Increased wait time for backend processing
                        continue
                    else:
                        log(f"❌ Stuck on authentication page: {current_url}")
                        self.log_page_diagnostics()
                        return False
                else:
                    # Not an auth page, not the list page yet. Let's force it.
                    if i > 1: # After a couple of tries, just force navigate
                        log(f"🔄 Forcing navigation to list URL... ({current_url})")
                        self.driver.get(self.shopping_list_url)
                        time.sleep(3)
                    else:
                        # We are on a new page that isn't an auth page and isn't the list page yet
                        # Could be a redirector or a different Amazon page.
                        if i < max_check_retries - 1:
                            time.sleep(2)
                            continue
                        else:
                            log(f"✅ Escaped auth pages. Final URL: {current_url}")
                            break
            
            log("✅ Login flow complete!")
            return True
            
        except Exception as e:
            log(f"❌ Login failed: {e}")
            return False
    
    def handle_otp(self):
        """Handle OTP input and submission"""
        try:
            # Clean spaces from OTP secret as suggested by community feedback
            if not self.otp_secret or not isinstance(self.otp_secret, str):
                log("❌ OTP secret is missing or not a string. Cannot handle OTP.")
                return False
                
            clean_secret = self.otp_secret.replace(" ", "")
            totp = pyotp.TOTP(clean_secret)
            otp_code = totp.now()
            log(f"🔢 Submitting OTP... (Code generated)")
            initial_url = self.driver.current_url

            def find_clickable(selectors, timeout=4):
                for by_type, slctr in selectors:
                    try:
                        el = WebDriverWait(self.driver, timeout).until(
                            EC.element_to_be_clickable((by_type, slctr))
                        )
                        if el and el.is_displayed():
                            return el, slctr
                    except:
                        pass
                return None, None

            def find_visible(selectors, timeout=4):
                for by_type, slctr in selectors:
                    try:
                        el = WebDriverWait(self.driver, timeout).until(
                            EC.visibility_of_element_located((by_type, slctr))
                        )
                        if el and el.is_displayed():
                            return el, slctr
                    except:
                        pass
                return None, None

            # 1) Handle MFA choice screens first
            switch_selectors = [
                (By.ID, 'auth-mfa-mfaChoice-enter-totp'),
                (By.CSS_SELECTOR, 'input[value="totp"]'),
                (By.CSS_SELECTOR, 'input[value="authenticatorApp"]'),
                (By.XPATH, "//a[contains(@id,'totp')]"),
            ]
            switch_el, switch_sel = find_clickable(switch_selectors, timeout=3)
            if switch_el:
                log(f"🔄 Found MFA choice selector: {switch_sel}")
                self.driver.execute_script("arguments[0].click();", switch_el)
                time.sleep(2)

                # Some variants need an explicit continue/submit after selecting TOTP
                continue_el, continue_sel = find_clickable([
                    (By.ID, 'auth-mfa-submit-button'),
                    (By.CSS_SELECTOR, 'input[type="submit"]'),
                    (By.CSS_SELECTOR, 'button[type="submit"]'),
                ], timeout=2)
                if continue_el:
                    log(f"🖱️ Confirming MFA choice using: {continue_sel}")
                    self.driver.execute_script("arguments[0].click();", continue_el)
                    time.sleep(2)

            # 2) Find the OTP input field with fallbacks
            otp_selectors = [
                (By.ID, 'auth-mfa-otpcode'),
                (By.ID, 'ap_mfa_code'),
                (By.NAME, 'otpCode'),
                (By.CSS_SELECTOR, 'input[autocomplete="one-time-code"]'),
                (By.XPATH, "//input[contains(@name,'otp') or contains(@id,'otp')]"),
                (By.CSS_SELECTOR, 'input[type="tel"][maxlength="6"]'),
            ]
            otp_field, otp_selector = find_visible(otp_selectors, timeout=5)
            if not otp_field:
                self.log_page_diagnostics()
                raise Exception("Could not find the OTP input field on the page")

            log(f"✅ Found OTP field using: {otp_selector}")
            otp_field.clear()
            otp_field.send_keys(otp_code)

            # 3) Click "Don't require code on this browser" if present
            try:
                remember_btn, remember_sel = find_clickable([
                    (By.NAME, 'rememberDevice'),
                    (By.ID, 'rememberDevice'),
                    (By.CSS_SELECTOR, 'input[name="rememberDevice"]'),
                ], timeout=2)
                if remember_btn and not remember_btn.is_selected():
                    log("💾 Selecting 'Don't require code on this browser'...")
                    self.driver.execute_script("arguments[0].click();", remember_btn)
            except:
                pass

            time.sleep(0.5)

            # 4) Submit OTP using several known button types
            submitted = False
            submit_btn, submit_sel = find_clickable([
                (By.ID, 'auth-signin-button'),
                (By.ID, 'auth-mfa-submit-button'),
                (By.CSS_SELECTOR, 'input[type="submit"]'),
                (By.CSS_SELECTOR, 'button[type="submit"]'),
            ], timeout=3)

            if submit_btn:
                log(f"🖱️ Clicking Submit using: {submit_sel}")
                self.driver.execute_script("arguments[0].click();", submit_btn)
                submitted = True
            else:
                log("🖱️ No submit button found, submitting via RETURN key...")
                otp_field.send_keys(Keys.RETURN)
                submitted = True

            if not submitted:
                raise Exception("Failed to submit OTP")

            # 5) Wait for either URL movement, page change, or explicit error
            try:
                WebDriverWait(self.driver, 12).until(
                    lambda d: (
                        d.current_url != initial_url or
                        ('/ap/mfa' not in d.current_url.lower() and '/ap/cvf' not in d.current_url.lower()) or
                        len(d.find_elements(By.ID, 'auth-error-message-box')) > 0
                    )
                )
            except TimeoutException:
                pass

            time.sleep(2)
            current_url = self.driver.current_url.lower()

            # 6) Surface explicit Amazon-side auth errors if they exist
            try:
                error_box = self.driver.find_element(By.ID, 'auth-error-message-box')
                if error_box.is_displayed() and error_box.text.strip():
                    raise Exception(f"Amazon OTP error: {error_box.text.strip()}")
            except NoSuchElementException:
                pass

            # 7) Still stuck on MFA means the submit did not actually complete
            if '/ap/mfa' in current_url or '/ap/cvf' in current_url:
                self.log_page_diagnostics()
                raise Exception(f"Still on MFA page after OTP submit: {self.driver.current_url}")

            log("✅ OTP submitted, awaiting completion...")
            return True
        except Exception as e:
            log(f"❌ OTP handling failed: {e}")
            self.log_page_diagnostics()
            return False
    
    def scrape_shopping_list(self):
        """Scrape the shopping list items"""
        log("📋 Scraping shopping list...")
        
        try:
            # Re-verify we are on the correct page (not an auth challenge)
            url = self.driver.current_url.lower()
            auth_identifiers = ['/ap/signin', '/ap/cvf', '/ap/mfa', '/ax/claim']
            is_on_auth = any(auth_id in url for auth_id in auth_identifiers)
            
            if is_on_auth or 'alexashoppinglist' not in url:
                log(f"🔄 Not on list page ({url}), forcing navigation...")
                self.driver.get(self.shopping_list_url)
                time.sleep(4) # Give it plenty of time to load
            else:
                log("✅ Confirmed: Browser is on list page")
            
            if self.debug:
                log(f"   Current URL: {self.driver.current_url}")
                log(f"   Page title: {self.driver.title}")
            
            # Wait for list container to load
            WebDriverWait(self.driver, 25).until(
                EC.presence_of_element_located((By.CLASS_NAME, 'virtual-list'))
            )
            
            # CRITICAL: Scroll through the ENTIRE virtual list to load all items into DOM
            # Virtual scrolling only renders visible items, so we need to scroll to ensure all items are in the DOM
            log("📜 Scrolling to load all items...")
            self.driver.execute_script("""
                let virtualList = document.querySelector('.virtual-list');
                if (virtualList) {
                    // Scroll to the very bottom to load all items
                    virtualList.scrollTop = virtualList.scrollHeight;
                }
            """)
            time.sleep(1)  # Wait for all items to render after scrolling
            
            # Scroll back to top to start fresh
            self.driver.execute_script("""
                let virtualList = document.querySelector('.virtual-list');
                if (virtualList) {
                    virtualList.scrollTop = 0;
                }
            """)
            time.sleep(0.5)
            
            items = []
            
            # Use JavaScript to extract ALL items at once (no stale reference issues)
            items_data = self.driver.execute_script("""
                let items = [];
                let checkboxes = document.querySelectorAll('input.custom-control-input[type="checkbox"]');
                checkboxes.forEach(checkbox => {
                    let parent = checkbox.closest('.sc-bXCLTC');
                    if (parent) {
                        let titleElem = parent.querySelector('p.item-title');
                        if (titleElem) {
                            items.push({
                                'name': titleElem.textContent.trim(),
                                'completed': checkbox.checked
                            });
                        }
                    }
                });
                return items;
            """)
            
            items = items_data if items_data else []
            
            log(f"🔍 Found {len(items)} items")
            
            # Save to file for IPC
            with open('list_of_items.json', 'w', encoding='utf-8') as f:
                json.dump(items, f, indent=2, ensure_ascii=False)
            
            # Mark items as completed on Amazon if enabled
            if self.check_after_import:
                items_clicked = 0
                max_attempts = 100  # Safety limit to prevent infinite loops
                
                while items_clicked < max_attempts:
                    try:
                        # Get all unchecked checkboxes
                        checkboxes = self.driver.find_elements(By.CSS_SELECTOR, 'input.custom-control-input[type="checkbox"]:not(:checked)')
                        
                        if not checkboxes:
                            log("✅ All items checked!")
                            break
                        
                        # Get the LAST checkbox (bottom-most unchecked item) to avoid stale references
                        # Working from bottom to top prevents DOM shifts from affecting elements we haven't clicked yet
                        last_checkbox = checkboxes[-1]
                        
                        # Use JavaScript to extract the item title BEFORE scrolling/clicking
                        # This avoids stale element references that occur after DOM re-renders
                        item_text = self.driver.execute_script("""
                            let checkbox = document.querySelector('input.custom-control-input[type="checkbox"]:not(:checked):last-of-type');
                            if (checkbox) {
                                let parent = checkbox.closest('.sc-bXCLTC');
                                if (parent) {
                                    let titleElem = parent.querySelector('p.item-title');
                                    if (titleElem) {
                                        return titleElem.textContent.trim();
                                    }
                                }
                            }
                            return 'item';
                        """)
                        
                        # Use JavaScript to avoid stale element issues:
                        # - Scroll into view
                        # - Wait a bit for animations
                        # - Click the checkbox
                        self.driver.execute_script("""
                            let checkbox = document.querySelector('input.custom-control-input[type="checkbox"]:not(:checked):last-of-type');
                            if (checkbox) {
                                checkbox.scrollIntoView({behavior: 'smooth', block: 'center'});
                            }
                        """)
                        time.sleep(0.5)  # Wait for scroll animation to complete
                        
                        # Now click the checkbox using JavaScript (more reliable than Selenium click)
                        self.driver.execute_script("""
                            let checkbox = document.querySelector('input.custom-control-input[type="checkbox"]:not(:checked):last-of-type');
                            if (checkbox) {
                                checkbox.click();
                            }
                        """)
                        
                        time.sleep(0.5)  # Wait for the item to disappear/be marked as completed
                        
                        items_clicked += 1
                        log(f"✅ Checked item #{items_clicked}: {item_text}")
                        
                        # Check if all items are now completed
                        try:
                            unchecked_count = len(self.driver.find_elements(By.CSS_SELECTOR, 'input.custom-control-input[type="checkbox"]:not(:checked)'))
                            if unchecked_count == 0:
                                log("✅ All items are now checked!")
                                break
                        except Exception:
                            pass  # Continue if we can't check
                        
                    except Exception as e:
                        log(f"⚠️  Failed to click checkbox: {e}")
                        if self.debug:
                            import traceback
                            log(f"   Full traceback:\n{traceback.format_exc()}")
                        break
                
                if items_clicked >= max_attempts:
                    log(f"⚠️  Reached maximum attempts ({max_attempts}) - stopping")
                else:
                    log(f"✅ Successfully marked {items_clicked} items as completed")
                    
                    # Verify counts match
                    unchecked_count = len([item for item in items if not item['completed']])
                    if items_clicked == unchecked_count:
                        log(f"✅ VERIFIED: Clicked {items_clicked} items = Initial unchecked items ({unchecked_count})")
                    else:
                        log(f"⚠️  Count mismatch: Clicked {items_clicked} but found {unchecked_count} unchecked items initially")
            
            return True
            
        except Exception as e:
            log(f"❌ Failed to scrape shopping list: {e}")
            if self.debug:
                import traceback
                log(f"   Full traceback:\n{traceback.format_exc()}")
                log(f"   Current URL: {self.driver.current_url}")
                log(f"   Page title: {self.driver.title}")
                try:
                    # Save screenshot for debugging
                    screenshot_path = f"error_screenshot_{int(time.time())}.png"
                    self.driver.save_screenshot(screenshot_path)
                    log(f"   Screenshot saved: {screenshot_path}")
                except Exception as ss_err:
                    log(f"   Could not save screenshot: {ss_err}")
            return False
    
    def run(self):
        """Main execution flow"""
        log("═══════════════════════════════════════════════════════════")
        log(f"Amazon Region: {self.region}")
        log(f"Authentication: Email/Password + OTP")
        log(f"Shopping List URL: {self.shopping_list_url}")
        log("═══════════════════════════════════════════════════════════")
        
        # Initialize driver
        if not self.init_driver():
            return False

        # Fresh authentication each run
        if not self.login_with_email_password():
            log("❌ Authentication failed!")
            return False
            
        # Scrape the list
        return self.scrape_shopping_list()

    def __del__(self):
        """Cleanup on object destruction"""
        self._cleanup_profile_dir()

if __name__ == '__main__':
    try:
        scraper = AmazonShoppingListScraper()
        success = scraper.run()
        
        if success:
            log("Cycle finished successfully.")
            sys.exit(0)
        else:
            log("Cycle failed.")
            sys.exit(1)
            
    except Exception as e:
        log(f"Unhandled exception: {e}")
        sys.exit(1)
    finally:
        # Final cleanup attempt
        if 'scraper' in locals():
            if scraper.driver:
                try:
                    scraper.driver.quit()
                except:
                    pass
            scraper._cleanup_profile_dir()

