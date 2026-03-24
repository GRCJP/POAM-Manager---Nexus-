# Multi-stage Dockerfile for POAM Nexus API

FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies only
FROM base AS dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production && \
    npm cache clean --force

# Development dependencies
FROM base AS dev-dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Build stage (for Prisma generation)
FROM dev-dependencies AS build
COPY . .
RUN npx prisma generate

# Production stage
FROM base AS production
ENV NODE_ENV=production

# Copy dependencies
COPY --from=dependencies /app/node_modules ./node_modules

# Copy Prisma files and generated client
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

# Copy application code
COPY src ./src
COPY package.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

CMD ["node", "src/index.js"]
