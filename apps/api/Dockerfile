# apps/api/Dockerfile
# Build stage
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

RUN corepack enable pnpm

# Copy root workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/ ./packages/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
RUN pnpm --filter @jesmond/db run db:generate

# Build the api
RUN pnpm --filter api build

# Production runtime stage
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl
ENV NODE_ENV=production

RUN corepack enable pnpm

# We need to install production dependencies and the workspace packages.
# The easiest robust way for monorepos is to copy the whole project and install prod only, 
# or copy from builder and prune. We will prune.
COPY --from=builder /app ./

# Prune devDependencies
RUN pnpm install --prod --frozen-lockfile

USER node

EXPOSE 3001
ENV PORT=3001
ENV HOST=0.0.0.0

# The entrypoint is the built dist file for the api
CMD ["node", "apps/api/dist/main"]
