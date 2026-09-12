FROM node:20-alpine
WORKDIR /app

# Copy package manifests for deterministic install
COPY package.json package-lock.json ./
RUN npm ci

# Copy project source
COPY . .

# Build production Next.js bundle
RUN npm run build

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

EXPOSE 3000

CMD ["npm", "run", "start"]
