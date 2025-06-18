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
        apk add mini_httpd
        mkdir /app/www
        echo port=8888  >> /etc/mini_httpd/mini_httpd.conf
        echo user=minihttpd   >> /etc/mini_httpd/mini_httpd.conf
        echo dir=/app/www  >> /etc/mini_httpd/mini_httpd.conf
        echo nochroot  >> /etc/mini_httpd/mini_httpd.conf
        apk add openrc  --no-cache
        mkdir -p /run/openrc/exclusive
        touch /run/openrc/softlevel
        rc-service mini_httpd start
fi

COMMANDS=(
    "cd /app/"
    "rm -rf tmp/"
    "/usr/bin/node /app/scrapeAmazon.js"
    "/usr/bin/node /app/updateHA.js"
#     "ls"
)

# Infinite loop
while true; do
  # Run each command
  for cmd in "${COMMANDS[@]}"; do
    $cmd
  done

  # Check if Polling_Interval is zero and exit the loop if so
  if [ "$Pooling_Interval" -eq 0 ]; then
    break
  fi

  # Sleep for the polling interval
  sleep $Pooling_Interval
done
