# Multi-stage build for production deployment
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force
RUN cd backend && npm ci --only=production && npm cache clean --force

# Build the application
FROM base AS builder
WORKDIR /app

# Copy package files and install all dependencies (including dev)
COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm ci
RUN cd backend && npm ci

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Build backend
RUN cd backend && npm run build

# Production image
FROM node:18-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/dist ./frontend
COPY --from=builder --chown=nextjs:nodejs /app/backend/dist ./backend
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nextjs:nodejs /app/backend/node_modules ./backend/node_modules

# Copy necessary files
COPY --chown=nextjs:nodejs backend/src/migrations ./backend/migrations
COPY --chown=nextjs:nodejs backend/src/scripts ./backend/scripts
COPY --chown=nextjs:nodejs package.json ./

# Create directories for data and uploads
RUN mkdir -p /app/data /app/uploads /app/logs /app/backups
RUN chown -R nextjs:nodejs /app/data /app/uploads /app/logs /app/backups

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_PATH=/app/data/database.sqlite
ENV UPLOAD_DIR=/app/uploads
ENV LOG_DIR=/app/logs
ENV BACKUP_DIR=/app/backups

# Expose port
EXPOSE 3001

# Switch to non-root user
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "backend/server.js"]