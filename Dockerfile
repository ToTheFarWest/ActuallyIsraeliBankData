# Use Puppeteer's official image (includes Chromium + compatible runtime libraries)
FROM ghcr.io/puppeteer/puppeteer:22.15.0

# Create app directory
WORKDIR /usr/src/app

# Copy package files and install deps
COPY package.json package-lock.json ./
RUN npm ci --production

# Copy source files
COPY tsconfig.json .
COPY src ./src

# Run the app (expects config.json to be mounted or provided)
CMD ["npm", "start"]
