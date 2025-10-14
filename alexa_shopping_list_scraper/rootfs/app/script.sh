#!/usr/bin/with-contenv bashio

# Create .env file from add-on options
cat > .env <<- EOT
HA_WEBHOOK_URL=$(bashio::config 'HA_Webhook_URL')
log_level=$(bashio::config 'Debug_Log')
CHECK_AFTER_IMPORT=$(bashio::config 'Check_after_import')
Pooling_Interval=$(bashio::config 'Pooling_Interval')
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
  
  # Authentication via email/password with OTP (stateless, no cookies)
  set +e
  /usr/bin/python3 /app/scrapeAmazon.py 2>&1 | while IFS= read -r line; do printf '[scrape] %s\n' "$line"; done
  scrape_ec=${PIPESTATUS[0]:-0}
  /usr/bin/node /app/updateHA.js 2>&1 | while IFS= read -r line; do printf '[update] %s\n' "$line"; done
  update_ec=${PIPESTATUS[0]:-0}
  set -e

  # Check if Polling_Interval is zero and exit the loop if so
  if [ "$Pooling_Interval" -eq 0 ]; then
    bashio::log.info "Pooling_Interval is 0. Exiting after single run."
    break
  fi

  bashio::log.info "Cycle finished. Sleeping for ${Pooling_Interval} seconds..."
  sleep "$Pooling_Interval"
done
