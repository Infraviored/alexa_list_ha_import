#!/usr/bin/with-contenv bashio

# Create .env file from add-on options
cat > .env <<- EOT
HA_WEBHOOK_URL=$(bashio::config 'HA_Webhook_URL')
log_level=$(bashio::config 'Debug_Log')
DELETE_AFTER_DOWNLOAD=$(bashio::config 'Delete_After_Download')
Pooling_Interval=$(bashio::config 'Pooling_Interval')
Auth_Method=$(bashio::config 'Auth_Method')
Amazon_Login=$(bashio::config 'Amazon_Login')
Amazon_Pass=$(bashio::config 'Amazon_Pass')
Amazon_Secret=$(bashio::config 'Amazon_Secret')
Amazon_Region=$(bashio::config 'Amazon_Region')
EOT

Pooling_Interval=$(bashio::config 'Pooling_Interval')

if [ "$(bashio::config 'Debug_Log')" == "true" ]; then
        echo "Debug mode enabled. Detailed scraper diagnostics will be shown."
fi

# Infinite loop
while true; do
  
  bashio::log.info "Starting scrape and update cycle..."
  echo "Debug_Log=$(bashio::config 'Debug_Log'); Pooling_Interval=${Pooling_Interval}"
  WEBHOOK=$(bashio::config 'HA_Webhook_URL')
  if [ -z "$WEBHOOK" ] || ! echo "$WEBHOOK" | grep -qE '^https?://'; then
    echo "ERROR: HA_Webhook_URL is missing or invalid. Set it in the add-on configuration."
  fi

  # Run commands sequentially and log exit codes (avoid silent exits)
  cd /app/ || { echo "ERROR: /app not available; retrying after sleep"; sleep "$Pooling_Interval"; continue; }
  # Keep browser profile persistent; do not delete tmp/
  
  # Only write cookies if using cookie-based or auto authentication
  AUTH_METHOD=$(bashio::config 'Auth_Method')
  if [ "$AUTH_METHOD" == "cookies" ] || [ "$AUTH_METHOD" == "auto" ]; then
    # Cookies handling with xtrace fully silenced to prevent huge logs
    mkdir -p /data
    { set +x; TMP_COOKIES=$(mktemp -p /data cookies.XXXXXX); RAW_COOKIES=$(bashio::config 'Cookies_JSON'); } 2>/dev/null
    COOKIES_LEN=${#RAW_COOKIES}
    echo "Cookies_JSON length: ${COOKIES_LEN}"
    { printf %s "$RAW_COOKIES" > "$TMP_COOKIES"; } 2>/dev/null
    COOKIES_SIZE=$(wc -c < "$TMP_COOKIES" | tr -d ' ')
    if [ "${COOKIES_SIZE:-0}" -gt 2 ]; then
      echo "Writing cookies to /data/cookies.json"
      mv "$TMP_COOKIES" /data/cookies.json
      echo "cookies.json size: ${COOKIES_SIZE} bytes"
    else
      rm -f "$TMP_COOKIES"
      echo "No Cookies_JSON provided in add-on config."
    fi
    if [ -f /data/cookies.json ]; then
      echo "cookies.json present, size $(wc -c < /data/cookies.json) bytes"
    else
      echo "cookies.json missing"
    fi
  else
    echo "Auth method: ${AUTH_METHOD} (skipping cookie file write)"
  fi
  echo "Running scrapeAmazon.js"
  set +e
  /usr/bin/node /app/scrapeAmazon.js 2>&1 | while IFS= read -r line; do printf '[scrape] %s\n' "$line"; done
  scrape_ec=${PIPESTATUS[0]:-0}
  echo "scrapeAmazon.js exited with code ${scrape_ec}"
  echo "Running updateHA.js"
  /usr/bin/node /app/updateHA.js 2>&1 | while IFS= read -r line; do printf '[update] %s\n' "$line"; done
  update_ec=${PIPESTATUS[0]:-0}
  echo "updateHA.js exited with code ${update_ec}"
  set -e

  # Check if Polling_Interval is zero and exit the loop if so
  if [ "$Pooling_Interval" -eq 0 ]; then
    bashio::log.info "Pooling_Interval is 0. Exiting after single run."
    break
  fi

  bashio::log.info "Cycle finished. Sleeping for ${Pooling_Interval} seconds..."
  sleep "$Pooling_Interval"
done
