ARG BUILD_FROM=alpine:3.19
FROM ${BUILD_FROM}
USER root

# Install required packages - Node.js for updateHA, Python for scraping
RUN apk add --no-cache \
    bash \
    nodejs \
    npm \
    chromium \
    chromium-chromedriver \
    python3 \
    py3-pip \
    py3-setuptools \
    mini_httpd

WORKDIR /app

# Install Node.js dependencies (for updateHA.js)
COPY rootfs/app/package.json .
RUN npm install

# Install Python dependencies (for scrapeAmazon.py)
COPY rootfs/app/requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# Copy application files
COPY rootfs/app/ ./

# Make scripts executable
RUN chmod a+x /app/script.sh /app/scrapeAmazon.py

# Start script
CMD ["/app/script.sh"]
