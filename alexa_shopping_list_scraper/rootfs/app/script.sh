#!/usr/bin/with-contenv bashio

# Create .env file from add-on options
cat > .env <<- EOT
AMZ_LOGIN=$(bashio::config 'Amazon_Login')
AMZ_PASS=$(bashio::config 'Amazon_Pass')
AMZ_SECRET=$(bashio::config 'Amazon_Secret')
HA_WEBHOOK_URL=$(bashio::config 'HA_Webhook_URL')
log_level=$(bashio::config 'Debug_Log')
Amazon_Sign_in_URL=$(bashio::config 'Amazon_Sign_in_URL')
Amazon_Shopping_List_Page=$(bashio::config 'Amazon_Shopping_List_Page')
DELETE_AFTER_DOWNLOAD=$(bashio::config 'Delete_After_Download')
Pooling_Interval=$(bashio::config 'Pooling_Interval')
EOT

Pooling_Interval=$(bashio::config 'Pooling_Interval')

if [ "$(bashio::config 'Debug_Log')" == "true" ]; then
        echo "Debug mode is enabled. Starting web server for screenshots."
        mkdir -p /app/www
        mini_httpd -p 8888 -d /app/www -r "Alexa_Scraper" &
fi

# Infinite loop
while true; do
  
  bashio::log.info "Starting scrape and update cycle..."

  # Group commands in a subshell to run them sequentially
  (
    cd /app/ || exit
    rm -rf tmp/
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
