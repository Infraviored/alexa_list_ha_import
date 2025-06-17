ARG BUILD_FROM
FROM ${BUILD_FROM}
USER root

# Set environment variables to non-interactive
#ENV DEBIAN_FRONTEND=noninteractive

# Install required packages
#RUN apt-get update && apt-get install -y sudo curl && \
#    curl -fsSL https://deb.nodesource.com/setup_21.x | sudo -E bash - && \
#    apt-get install -y nodejs
RUN apk add --no-cache bash nodejs npm chromium

WORKDIR /app
#COPY package*.json scrapeAmazon.js script.sh updateHA.js ./
#COPY . .
COPY rootfs/app/package.json .
RUN npm install

COPY rootfs/app/ ./

# Install necessary npm packages
RUN chmod a+x /app/script.sh

# Start script
CMD ["/app/script.sh"]
