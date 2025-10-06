# Alexa Shopping List Scraper
Scrapes your Amazon Alexa Shopping List page and adds items into Home Assistant's Shopping List every 3 minutes.

- One-way sync (Amazon → Home Assistant)
- Region-aware (set the URL for your region)
- **Two authentication methods** with automatic fallback

## Authentication Methods

This add-on supports **two authentication methods** with intelligent fallback:

### Method 1: Cookie-based (Recommended) 🍪
**Pros:** Easy to set up, no 2FA code needed, more reliable  
**Cons:** Cookies expire after ~1 year, need to be refreshed

### Method 2: Email/Password + OTP (Legacy) 🔑
**Pros:** Works when cookies expire or fail  
**Cons:** Requires 2FA setup, more complex configuration

### Auth_Method Setting
- **`cookies`** (default): Use cookies only
- **`email_password`**: Use email/password/OTP only
- **`auto`**: Try cookies first, fall back to email/password if cookies fail

---

## Setup - Method 1: Cookies (Recommended)

### 1) Export cookies from browser
- Use Chrome/Edge/Brave
- Log into your Amazon region (e.g., `www.amazon.de`)
- Install [Cookie-Editor extension](https://cookie-editor.cgagnier.ca/)
- Cookie-Editor → Export → JSON
- Copy the JSON (single object `{}` or array `[]`)

### 2) Configure the add-on
- Paste JSON into `Cookies_JSON`
- Set `Auth_Method` to `cookies`
- Set `Amazon_Shopping_List_Page` to your region URL (see below)
- Set `HA_Webhook_URL` (see webhook setup below)
- **Leave email/password fields empty**
- Save, then Stop and Start the add-on

### Cookie Expiration
Your cookies will be valid for approximately **1 year**. When they expire:
1. The add-on will log authentication failures
2. Simply re-export fresh cookies and update `Cookies_JSON`
3. OR set `Auth_Method` to `auto` to automatically fall back to email/password

---

## Setup - Method 2: Email/Password/OTP

### 1) Get your OTP App Secret from Amazon

**If you don't have 2-step verification enabled:**

1. Login to Amazon (https://www.amazon.com/ or your region)
2. Go to **Your Account** → **Login & Security**
3. Click on **"Turn On"** under **2-Step Verification**
4. Select the **Authenticator App** option
5. Amazon will show you a QR code and a text key
6. Click on **"Can't scan the barcode?"** (or "Barcode kann nicht gescannt werden?") to reveal the full secret key
7. You'll see a key with spaces (e.g., `ASDF QWER ZXCV HJKL ...`)
8. **Copy this entire key** - you can copy it with spaces, the add-on will remove them automatically
   - Example with spaces: `ASDF QWER ZXCV HJKL MNOP ASDF QWER ZXCV HJKL MNOP ASDF QWER ZXCV`
   - Or remove spaces yourself: `ASDMASDFMSKDMKSFMKLASDDADABB6JNRNF7WFEHQW23H238R7843`
   - This is your `Amazon_Secret` - save it for the add-on configuration
9. **Now complete the Amazon setup:**
   - Open your Authenticator App (e.g., [Google Authenticator](https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2))
   - In the app, tap "+" to add a new account
   - Scan the QR code that Amazon is showing
   - Your app will now generate a 6-digit code that changes every 30 seconds
10. **Verify on Amazon:**
    - Enter the 6-digit code from your authenticator app into the field on Amazon
    - Click "Verify OTP and Continue" (or "Verifizieren Sie das OTP und fahren Sie fort")
    - Amazon will confirm that 2FA is now enabled
11. ✅ Done! You now have your `Amazon_Secret` saved and 2FA is active

**If you already have 2-step verification enabled:**

1. Login to Amazon
2. Go to **Your Account** → **Login & Security**
3. Click on **"Manage"** under **2-Step Verification**
4. Under **Authenticator App**, click on **"Add New App"**
5. Click on **"Can't scan the barcode?"** to reveal the secret key
6. Copy the entire key (with or without spaces - the add-on handles both)
7. **Complete the setup:**
   - Open your authenticator app and scan the QR code
   - Enter the 6-digit code from your app into Amazon
   - Click "Verify OTP and Continue"
8. ✅ Save the secret key as your `Amazon_Secret`

### 2) Configure the add-on
- Set `Auth_Method` to `email_password` (or `auto` for fallback)
- Set `Amazon_Login` to your Amazon email
- Set `Amazon_Pass` to your Amazon password
- Set `Amazon_Secret` to your 2FA secret key (remove spaces)
- Set `Amazon_Sign_in_URL` to your region's sign-in URL (see below)
- Set `Amazon_Shopping_List_Page` to your region URL
- Set `HA_Webhook_URL` (see webhook setup below)
- **Leave `Cookies_JSON` empty** (unless using `auto` mode)
- Save, then Stop and Start the add-on

### Sign-in URLs by Region
- **US**: `https://www.amazon.com/ap/signin?openid.pape.max_auth_age=3600&openid.return_to=https%3A%2F%2Fwww.amazon.com%2Falexaquantum%2Fsp%2FalexaShoppingList%3Fref_%3Dlist_d_wl_ys_list_1&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.assoc_handle=amzn_alexa_quantum_us&openid.mode=checkid_setup&language=en_US&openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0`
- **DE**: Replace `.com` with `.de` in the URL above
- **IT**: Replace `.com` with `.it` in the URL above
- **UK**: Replace `.com` with `.co.uk` in the URL above

---

## Region Shopping List URLs
- **US**: `https://www.amazon.com/alexaquantum/sp/alexaShoppingList?ref_=list_d_wl_ys_list_1`
- **DE**: `https://www.amazon.de/alexaquantum/sp/alexaShoppingList?ref_=list_d_wl_ys_list_1`
- **IT**: `https://www.amazon.it/alexaquantum/sp/alexaShoppingList?ref_=list_d_wl_ys_list_1`
- **UK**: `https://www.amazon.co.uk/alexaquantum/sp/alexaShoppingList?ref_=list_d_wl_ys_list_1`

---

## Configuration Options

### Required Settings
- **`HA_Webhook_URL`**: Home Assistant webhook URL (see setup below)
- **`Amazon_Shopping_List_Page`**: Your region's shopping list URL

### Authentication Settings
- **`Auth_Method`**: `cookies` (default), `email_password`, or `auto`

**For Cookie Auth:**
- **`Cookies_JSON`**: JSON array/object exported from browser

**For Email/Password Auth:**
- **`Amazon_Login`**: Your Amazon email address
- **`Amazon_Pass`**: Your Amazon password
- **`Amazon_Secret`**: Your 2FA secret key
- **`Amazon_Sign_in_URL`**: Your region's sign-in URL

### Optional Settings
- **`Pooling_Interval`**: Seconds between checks (default: 180)
- **`Delete_After_Download`**: Delete items from Amazon after sync (default: false)
- **`Debug_Log`**: Enable verbose logging and screenshots (default: false)

---

## How to get the Home Assistant Webhook URL

1. Import this blueprint: [Blueprint](/alexa_shopping_list_scraper%2FBlueprint_Import-Alexa-Shoppinglist.yaml)  
   [![Open your Home Assistant instance and show the blueprint import dialog with a specific blueprint pre-filled.](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A//github.com/Infraviored/alexa_list_ha_import/blob/main/alexa_shopping_list_scraper/Blueprint_Import-Alexa-Shoppinglist.yaml)

2. Create a webhook trigger inside the blueprint

3. Click on the copy symbol on the right to get the URL and save it  
   Example: `http://homeassistant.local:8123/api/webhook/-hA_THs-Yr5dfasnnkjfsdfsa`

4. Select which Home Assistant shopping list should be used

5. Click on Save and give a name to the Automation

**Note:** External HTTPS URLs (like `https://assistant.yourdomain.com/api/webhook/...`) are fully supported!

---

## Recommended Setup: Auto Fallback

For **maximum reliability**, use the `auto` authentication method:

```yaml
Auth_Method: auto
Cookies_JSON: "<your cookies here>"
Amazon_Login: "your-email@example.com"
Amazon_Pass: "your-password"
Amazon_Secret: "YOUR2FASECRET"
```

This configuration will:
1. ✅ Try cookie authentication first (fast, reliable)
2. ✅ Automatically fall back to email/password if cookies fail
3. ✅ Continue working even when cookies expire
4. ✅ Provide detailed logs showing which method succeeded

---

## Troubleshooting

### "401 Unauthorized" error
- If using external HTTPS webhook URL, this is now fixed in v1.1.1+
- Verify your webhook URL is correct and the automation is enabled

### Cookie authentication failed
- Cookies may have expired (valid ~1 year)
- Re-export fresh cookies from your browser
- Ensure cookies are from the correct Amazon region (`.de`, `.com`, etc.)
- Try setting `Auth_Method: auto` to fall back to email/password

### Email/password authentication failed
- Verify your email, password, and 2FA secret are correct
- Ensure 2FA is enabled on your Amazon account
- Check that `Amazon_Sign_in_URL` matches your region
- Remove any spaces from the `Amazon_Secret` field

### No items found
- Verify the `Amazon_Shopping_List_Page` URL is correct for your region
- Check that you have items in your Alexa shopping list
- Enable `Debug_Log: true` and check screenshots at `http://homeassistant.local:8888`

---

## Extra - Clear Alexa Shopping List

Because this is a one-way sync (from Amazon Shopping List to Home Assistant), I have an automation that clears the Amazon Shopping list every night at midnight.

Here is the Automation in YAML:

```yaml
description: ""
mode: single
trigger:
  - platform: time
    at: "00:00:00"
condition: []
action:
  - service: media_player.volume_set
    data:
      volume_level: 0.01
    target:
      entity_id: media_player.my_alexa
  - delay:
      hours: 0
      minutes: 0
      seconds: 3
      milliseconds: 0
  - service: media_player.play_media
    data:
      media_content_type: custom
      media_content_id: "clear my shopping list"
      enqueue: play
    target:
      entity_id: media_player.my_alexa
    enabled: true
  - delay:
      hours: 0
      minutes: 0
      seconds: 3
      milliseconds: 0
    enabled: true
  - service: media_player.play_media
    data:
      media_content_type: custom
      media_content_id: "yes"
      enqueue: play
    target:
      entity_id: media_player.my_alexa
    enabled: true
```

---

## Extra - Debug Option

Enable the option `Debug_Log: true`

It will generate verbose logs for several calls inside the script.

Once the Add-On completes a full cycle of running → error → running again, some screenshots of the process internally can be found at `http://homeassistant.local:8888`
