# Use Node 22 as specified in package.json
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY --chown=nextjs:nodejs src/ ./src/
COPY --chown=nextjs:nodejs tsconfig.json ./

# Switch to non-root user
USER nextjs

# Expose the API port
EXPOSE 3051

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node --version || exit 1

# Default to running the API server (without --env-file since Docker handles env vars)
CMD ["npm", "run", "api:docker"]
