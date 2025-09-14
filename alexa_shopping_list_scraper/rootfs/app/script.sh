#!/usr/bin/with-contenv bashio

# Create .env file from add-on options
cat > .env <<- EOT
HA_WEBHOOK_URL=$(bashio::config 'HA_Webhook_URL')
log_level=$(bashio::config 'Debug_Log')
Amazon_Shopping_List_Page=$(bashio::config 'Amazon_Shopping_List_Page')
DELETE_AFTER_DOWNLOAD=$(bashio::config 'Delete_After_Download')
Pooling_Interval=$(bashio::config 'Pooling_Interval')
Cookies_JSON=$(bashio::config 'Cookies_JSON')
EOT

Pooling_Interval=$(bashio::config 'Pooling_Interval')

# No screenshot webserver; Debug_Log only prints to container logs
if [ "$(bashio::config 'Debug_Log')" == "true" ]; then
  echo "Debug mode is enabled. Verbose logs will be printed to the add-on logs."
fi

# Infinite loop
while true; do
  
  # If Cookies_JSON is provided, write it to /data/cookies.json for the scraper to import (do this before debug prints)
  if [ -n "$(bashio::config 'Cookies_JSON')" ]; then
    echo "Writing cookies to /data/cookies.json"
    mkdir -p /data
    bashio::config 'Cookies_JSON' > /data/cookies.json
  fi

  if [ "$(bashio::config 'Debug_Log')" == "true" ]; then
    echo "DEBUG: Starting scrape cycle; Debug_Log=true"
    if [ -f /data/cookies.json ]; then
      echo "DEBUG: cookies.json present (size: $(wc -c < /data/cookies.json) bytes)"
    else
      echo "DEBUG: cookies.json not found at /data/cookies.json"
    fi
    if [ -n "$(bashio::config 'HA_Webhook_URL')" ]; then
      echo "DEBUG: HA_Webhook_URL is set"
    else
      echo "DEBUG: HA_Webhook_URL is NOT set"
    fi
    echo "DEBUG: Amazon_Shopping_List_Page=$(bashio::config 'Amazon_Shopping_List_Page')"
  fi

  bashio::log.info "Starting scrape and update cycle..."

  # Group commands in a subshell to run them sequentially
  (
    cd /app/ || exit
    # rm -rf tmp/
    # Announce environment when debug is enabled
    if [ "$(bashio::config 'Debug_Log')" == "true" ]; then
      echo "Running scrapeAmazon.js with DEBUG enabled"
    fi
    /usr/bin/node /app/scrapeAmazon.js
    SCRAPE_RC=$?
    if [ $SCRAPE_RC -ne 0 ]; then
      echo "ERROR: scrapeAmazon.js exited with code $SCRAPE_RC"
      exit $SCRAPE_RC
    fi
    /usr/bin/node /app/updateHA.js
    UPDATE_RC=$?
    if [ $UPDATE_RC -ne 0 ]; then
      echo "ERROR: updateHA.js exited with code $UPDATE_RC"
      exit $UPDATE_RC
    fi
  )

  # Check if Polling_Interval is zero and exit the loop if so
  if [ "$Pooling_Interval" -eq 0 ]; then
    bashio::log.info "Pooling_Interval is 0. Exiting after single run."
    break
  fi

  bashio::log.info "Cycle finished. Sleeping for ${Pooling_Interval} seconds..."
  sleep "$Pooling_Interval"
done
