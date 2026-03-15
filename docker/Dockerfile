# prompts.chat Docker Image
# Packages source code and dependencies; builds on first run with env-var config
#
# Usage:
#   docker build -t prompts-chat -f docker/Dockerfile .
#   docker run -p 4444:3000 -v prompts-data:/data prompts-chat
#   docker run -p 4444:3000 -v prompts-data:/data -e PCHAT_NAME="My App" prompts-chat

# --- Stage 1: Install dependencies ---
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
COPY prompts.config.ts ./
RUN npm ci --include=dev --ignore-scripts

# --- Stage 2: Runtime ---
FROM node:24-bookworm-slim

LABEL org.opencontainers.image.source="https://github.com/f/prompts.chat"
LABEL org.opencontainers.image.description="prompts.chat - Self-hosted AI prompt library"
LABEL org.opencontainers.image.licenses="MIT"

# Install PostgreSQL and utilities (git no longer needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-15 \
    postgresql-contrib-15 \
    supervisor \
    curl \
    vim \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/run/postgresql /var/log/supervisor \
    && chown -R postgres:postgres /var/run/postgresql

WORKDIR /app

# Copy dependencies from build stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Copy bootstrap scripts
COPY docker/bootstrap.sh /bootstrap.sh
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
RUN chmod +x /bootstrap.sh

# Create data directories
RUN mkdir -p /data/postgres && chown -R postgres:postgres /data/postgres

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="postgresql://prompts:prompts@localhost:5432/prompts?schema=public"
ENV DIRECT_URL="postgresql://prompts:prompts@localhost:5432/prompts?schema=public"

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=300s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/bootstrap.sh"]
