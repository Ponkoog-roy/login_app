# ---- Stage 1: Builder ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install all dependencies exactly as locked
RUN npm ci

# Copy source files
COPY . .

# ---- Stage 2: Runtime ----
FROM node:20-alpine AS runtime

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy server file and node_modules from builder
COPY --from=builder /app/server.js ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 8080
CMD ["node", "server.js"]
