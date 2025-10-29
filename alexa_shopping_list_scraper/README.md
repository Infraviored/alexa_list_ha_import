<div align="center">
  <img src="logo.png" alt="Alexa Shopping List Scraper" width="400" height="400">
</div>

# Alexa Shopping List Scraper
Scrapes your Amazon Alexa Shopping List page and adds items into Home Assistant's Shopping List every 3 minutes.

- One-way sync (Amazon → Home Assistant)
- Region-aware (automatically configures for your region)
- **Python-based with superior bot detection bypass**
- **Email/Password + OTP authentication**

## ⚠️ Version 2.0.0 Breaking Changes

**v2.0.0 removes cookie-based authentication entirely.** Only email/password + OTP is supported.

If upgrading from v1.x:
- Remove `Auth_Method`, `Cookies_JSON` settings from your configuration
- Configure `Amazon_Login`, `Amazon_Pass`, and `Amazon_Secret` (see setup below)

---

## Setup: Email/Password + OTP Authentication

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
- Set `Amazon_Region` to your region code (e.g., `com`, `de`, `co.uk`, `it`)
- Set `Amazon_Login` to your Amazon email
- Set `Amazon_Pass` to your Amazon password
- Set `Amazon_Secret` to your 2FA secret key (with or without spaces)
- Set `HA_Webhook_URL` (see webhook setup below)
- Save, then Stop and Start the add-on

**Note:** Sign-in URL and shopping list URL are automatically built from your region!

### Supported Regions
The add-on automatically builds the correct sign-in URL based on your `Amazon_Region`:
- **com** - United States (amazon.com)
- **de** - Germany (amazon.de)
- **co.uk** - United Kingdom (amazon.co.uk)
- **it** - Italy (amazon.it)
- **fr** - France (amazon.fr)
- **es** - Spain (amazon.es)
- **ca** - Canada (amazon.ca)
- **com.au** - Australia (amazon.com.au)
- **co.jp** - Japan (amazon.co.jp)
- **com.mx** - Mexico (amazon.com.mx)
- **com.br** - Brazil (amazon.com.br)
- **in** - India (amazon.in)
- **nl** - Netherlands (amazon.nl)
- **se** - Sweden (amazon.se)
- **pl** - Poland (amazon.pl)
- **com.tr** - Turkey (amazon.com.tr)
- **ae** - UAE (amazon.ae)
- **sa** - Saudi Arabia (amazon.sa)
- **sg** - Singapore (amazon.sg)
---

## Configuration Options

### Required Settings
- **`HA_Webhook_URL`**: Home Assistant webhook URL (see setup below)
- **`Amazon_Region`**: Your Amazon region code (e.g., `com`, `de`, `co.uk`, `it`)
- **`Amazon_Login`**: Your Amazon email address
- **`Amazon_Pass`**: Your Amazon password
- **`Amazon_Secret`**: Your 2FA secret key (spaces are automatically removed)

### Optional Settings
- **`Pooling_Interval`**: Seconds between checks (default: 180)
- **`Check_after_import`**: Mark items as completed on Amazon's Alexa list after importing to Home Assistant (default: false)
- **`Debug_Log`**: Enable verbose logging (default: false)

---

## How to get the Home Assistant Webhook URL

1. Import this blueprint from your local add-on:  
   Path: `/addon_configs/local_alexa_shopping_list_scraper/Blueprint_Import-Alexa-Shoppinglist.yaml`  
   
   Or use the blueprint importer with GitHub URL:  
   [![Open your Home Assistant instance and show the blueprint import dialog with a specific blueprint pre-filled.](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A//github.com/Infraviored/alexa_list_ha_import/blob/main/alexa_shopping_list_scraper/Blueprint_Import-Alexa-Shoppinglist.yaml)

2. Create a webhook trigger inside the blueprint

3. Select which Home Assistant shopping list should be used (e.g., `todo.shopping_list`)

4. Click on Save and give a name to the Automation

5. **Important:** Configure the webhook URL in the add-on settings:

### For Local/Internal Access (RECOMMENDED):
- Click the copy symbol in the webhook trigger to get the URL
- You'll get something like: `http://homeassistant.local:8123/api/webhook/import-alexa-shoppinglist-XxXxXxXx`
- **Use the FULL URL** in the `HA_Webhook_URL` setting (including `http://homeassistant.local:8123`)
- Keep `local_only: true` in your automation ✅

**Example:**
```
HA_Webhook_URL: http://homeassistant.local:8123/api/webhook/import-alexa-shoppinglist-FPzzP2frQYE9PL7mBfQudEQf
```

### For External HTTPS Access:
- Use your external Home Assistant URL: `https://assistant.yourdomain.com/api/webhook/import-alexa-shoppinglist-XxXxXxXx`
- **IMPORTANT:** You MUST change `local_only: true` to `local_only: false` in your automation configuration
- Otherwise the webhook will reject external requests (401 Unauthorized)

**Example:**
```
HA_Webhook_URL: https://assistant.yourdomain.com/api/webhook/import-alexa-shoppinglist-FPzzP2frQYE9PL7mBfQudEQf
```
```yaml
# In your automation YAML:
webhook_trigger:
  - trigger: webhook
    allowed_methods:
      - POST
      - PUT
    local_only: false  # ← Must be false for external URLs!
    webhook_id: import-alexa-shoppinglist-FPzzP2frQYE9PL7mBfQudEQf
```

⚠️ **Do NOT just use the webhook ID alone** - this will not work. Always use the full URL!

---

## Troubleshooting

### "401 Unauthorized" error
- Verify your webhook URL is correct and the automation is enabled
- Check that Home Assistant is accessible at the webhook URL

### Authentication failed
- Verify your email, password, and 2FA secret are correct
- Ensure 2FA/2-step verification is enabled on your Amazon account
- The `Amazon_Secret` can have spaces (they're automatically removed)
- Check that `Amazon_Region` matches your Amazon account's region

### Amazon blocks login / bot detection
- v2.0.0 uses undetected-chromedriver which bypasses most detection
- If still failing, enable `Debug_Log: true` to see detailed error messages
- Each run uses a fresh browser session (stateless design)

### No items found
- Verify the `Amazon_Region` is correctly set for your account
- Check that you have items in your Alexa shopping list
- Enable `Debug_Log: true` for detailed scraping logs

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

When debugging is enabled:
- Detailed step-by-step logging of the authentication and scraping process
- Error screenshots saved to `/app/error_screenshot_*.png` on failures
- Page source dumps saved to `/app/error_page_source.html` for inspection
- Browser runs in headful mode during local development (visible window)
