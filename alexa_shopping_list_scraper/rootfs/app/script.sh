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

# Infinite loop
while true; do
  
  bashio::log.info "Starting scrape and update cycle..."

  # Group commands in a subshell to run them sequentially
  (
    cd /app/ || exit
    # rm -rf tmp/
    # If Cookies_JSON is provided, write it to /data/cookies.json for the scraper to import
    if [ -n "$(bashio::config 'Cookies_JSON')" ]; then
      echo "Writing cookies to /data/cookies.json"
      mkdir -p /data
      bashio::config 'Cookies_JSON' > /data/cookies.json
    fi
    /usr/bin/node /app/scrapeAmazon.js
    /usr/bin/node /app/updateHA.js
  )

  # Check if Polling_Interval is zero and exit the loop if so
  if [ "$Pooling_Interval" -eq 0 ]; then
    bashio::log.info "Pooling_Interval is 0. Exiting after single run."
    break
  fi

  bashio::log.info "Cycle finished. Sleeping for ${Pooling_Interval} seconds..."
  sleep "$Pooling_Interval"
done
