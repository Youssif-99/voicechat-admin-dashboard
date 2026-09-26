# syntax=docker/dockerfile:1

# Base stage
FROM node:22.21.1-slim AS base
WORKDIR /app

# Install OpenSSL (required by Prisma)
FROM base AS stage-2
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y openssl && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Build stage
FROM stage-2 AS build

# Install build dependencies for native modules (including sharp)
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    build-essential \
    node-gyp \
    openssl \
    pkg-config \
    python-is-python3 && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Copy package files
COPY package-lock.json package.json ./

# Copy Prisma schema
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN npm ci --include=dev

# Generate Prisma Client
RUN npx prisma generate

# Copy application code
COPY . .

# Build Next.js application
RUN npx next build

# Production stage
FROM stage-2

# Set production environment
ENV NODE_ENV=production

# Copy package files
COPY package-lock.json package.json ./

# Copy Prisma schema
COPY prisma ./prisma/

# Install production dependencies only (sharp will be rebuilt for production arch)
RUN npm ci --omit=dev && \
    npx prisma generate

# Copy built application from build stage
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set hostname
ENV HOSTNAME="0.0.0.0"
ENV PORT="3000"

# Start the application
CMD ["node", "server.js"]
