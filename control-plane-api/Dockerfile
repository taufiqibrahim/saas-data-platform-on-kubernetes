# ---------- Base Builder ----------
# FROM node:22-alpine AS base-builder
FROM node:22-slim AS base-builder

WORKDIR /app

# Pin pnpm for deterministic builds
ARG PNPM_VERSION=10.10.0
RUN npm install -g pnpm@${PNPM_VERSION}

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---------- API Builder ----------
FROM base-builder AS builder-prisma

WORKDIR /app

# # Install build dependencies
RUN set -eux; \
    apt-get update -qq; \
    apt-get install -y -qq --no-install-recommends \
      ca-certificates \
      openssl \
      ; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/* \
    echo "Build dependencies installed.";

# Copy config and source code for pnpm build
COPY tsconfig.json tsconfig.build.json tsoa-gen.ts ./
COPY prisma ./prisma
COPY src ./src

# Generate prisma client
RUN npx prisma generate

# Generate TSOA spec and routes
RUN npx ts-node tsoa-gen.ts

RUN pnpm build

# Verify the build output exists
RUN ls -la /app/dist && echo "Build completed successfully"

# # ---------- Runtime ----------
FROM node:22-slim

WORKDIR /app

# Add version as build argument and label
ARG VERSION=dev
LABEL version="${VERSION}" \
      maintainer="taufiq.ibrahim@gmail.com" \
      description="SaaS Control Plane - typescript stack"

# Allow build-time toggle for hardening
ARG HARDEN=true

# # Copy docs to dist
# RUN cp -rf src/docs dist/
# RUN cp -rf src/openapi dist/

# Harden the image conditionally (Debian-based)
RUN if [ "$HARDEN" = "true" ]; then \
      groupadd --system appuser && \
      useradd --system --gid appuser --no-create-home --shell /usr/sbin/nologin appuser; \
    fi

# Copy package.json (needed for module resolution)
COPY --from=builder-prisma --chown=1001:1001 /app/package.json ./package.json

# Copy built application
COPY --from=builder-prisma --chown=1001:1001 /app/dist ./dist

# Copy node_modules
COPY --from=builder-prisma --chown=1001:1001 /app/node_modules ./node_modules

# Copy prisma schema and generated client (if needed at runtime)
COPY --from=builder-prisma --chown=1001:1001 /app/prisma ./prisma

# Copy entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Always run as non-root (safe default)
USER 1001

ENTRYPOINT ["/entrypoint.sh"]
CMD []




# -----------------------------------------------------------------

# # ---------- Prisma Builder (with CLI and migrations) ----------
# FROM base-builder AS builder-prisma

# WORKDIR /app

# # Install only runtime dependencies
# RUN set -eux; \
#     apt-get update -qq; \
#     apt-get install -y -qq --no-install-recommends \
#       ca-certificates \
#       openssl \
#       git \
#       netcat-openbsd \
#       curl \
#       dnsutils \
#       iputils-ping \
#       vim-tiny \
#       unzip; \
#     curl -sLS "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"; \
#     unzip -q awscliv2.zip; \
#     ./aws/install; \
#     rm -rf awscliv2.zip aws/; \
#     apt-get clean; \
#     rm -rf /var/lib/apt/lists/*

# COPY tsconfig.json tsconfig.build.json tsoa-gen.ts ./
# COPY prisma ./prisma
# COPY src ./src

# # Generate prisma client
# RUN npx prisma generate

# # Generate TSOA spec and routes
# RUN npx ts-node tsoa-gen.ts

# RUN pnpm build

# # # Copy docs to dist
# # RUN cp -rf src/docs dist/
# RUN cp -rf src/openapi dist/

# # # ---------- Runtime API and Temporal Worker (minimal) ----------
# FROM node:22-slim AS runner

# ARG TARGET=api
# ARG ARCH
# ARG HELM_VERSION=3.19.0
# ARG KUBECTL_VERSION=1.34.0

# # Allow build-time toggle for hardening
# ARG HARDEN=true

# # Add version as build argument and label
# ARG VERSION=dev
# LABEL name="saas-control-plane" \
#       version="${VERSION}" \
#       maintainer="taufiq.ibrahim@gmail.com" \
#       summary="SaaS Control Plane" \
#       description="SaaS Control Plane" 

# # Install only runtime dependencies
# RUN set -eux; \
#     apt-get update -qq; \
#     apt-get install -y -qq --no-install-recommends \
#       ca-certificates \
#       curl \
#       jq \
#       openssl \
#       git \
#       unzip; \
#     # AWS CLI
#     curl -sLS "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"; \
#     unzip -q awscliv2.zip; \
#     ./aws/install; \
#     rm -rf awscliv2.zip aws/; \
#     # Opentofu
#     curl --proto '=https' --tlsv1.2 -fsSL https://get.opentofu.org/install-opentofu.sh -o install-opentofu.sh; \
#     chmod +x install-opentofu.sh; \
#     ./install-opentofu.sh --install-method standalone --skip-verify; \
#     rm -f install-opentofu.sh; \
#     # Clean up
#     apt-get clean; \
#     rm -rf /var/lib/apt/lists/*

# # Install Helm
# RUN ARCH="$(uname -m)" && \
#     case "$ARCH" in \
#         x86_64) ARCH=amd64 ;; \
#         armv7l) ARCH=arm ;; \
#         aarch64) ARCH=arm64 ;; \
#         ppc64le) ARCH=ppc64le ;; \
#         s390x) ARCH=s390x ;; \
#         *) echo "unsupported arch: $ARCH"; exit 1 ;; \
#     esac && \
#     for i in 1 2 3; do \
#         curl -fsSL "https://get.helm.sh/helm-v${HELM_VERSION}-linux-${ARCH}.tar.gz" | tar -xz && break || sleep 3; \
#     done && \
#     mv linux-${ARCH}/helm /usr/local/bin/helm && \
#     chmod +x /usr/local/bin/helm && \
#     rm -rf linux-${ARCH}

# # Install kubectl
# RUN ARCH="$(uname -m)" && \
#     case "$ARCH" in \
#         x86_64) ARCH=amd64 ;; \
#         armv7l) ARCH=arm ;; \
#         aarch64) ARCH=arm64 ;; \
#         ppc64le) ARCH=ppc64le ;; \
#         s390x) ARCH=s390x ;; \
#         *) echo "unsupported arch: $ARCH"; exit 1 ;; \
#     esac && \
#     curl -sLO "https://dl.k8s.io/release/v${KUBECTL_VERSION}/bin/linux/${ARCH}/kubectl" && \
#     mv kubectl /usr/bin/kubectl && \
#     chmod +x /usr/bin/kubectl

# WORKDIR /app

# # Harden the image conditionally (Debian-based)
# RUN if [ "$HARDEN" = "true" ]; then \
#       groupadd --system appuser && \
#       useradd --system --gid appuser --no-create-home --shell /usr/sbin/nologin appuser; \
#     fi

# COPY --from=builder-prisma --chown=1001:1001 /app/dist ./dist
# COPY --from=builder-prisma --chown=1001:1001 /app/node_modules ./node_modules

# # Copy entrypoint
# COPY entrypoint.sh /entrypoint.sh
# RUN chmod +x /entrypoint.sh

# # Always run as non-root (safe default)
# USER 1001

# ENV NODE_ENV=production
# EXPOSE 3000

# ENTRYPOINT ["/entrypoint.sh"]
# CMD []
