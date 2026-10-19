# Jesmond 2.0 Local Staging Environment Runbook

## Overview
This runbook provides step-by-step instructions to safely initialize, back up, migrate, deploy, and verify the Jesmond Phase 4 service categories feature in a dedicated local staging environment isolated from production.

---

## 1. Prerequisites & Isolation Guarantees

- **Target Staging Resources**:
  - PostgreSQL container: `jesmond-staging-db` on port `127.0.0.1:5433` (DB: `jesmond_staging`).
  - Redis container: `jesmond-staging-redis` on port `127.0.0.1:6380`.
  - API container: `jesmond-staging-api` on port `127.0.0.1:3303`.
  - Web container: `jesmond-staging-web` on port `127.0.0.1:3302`.
- **Production & MatrixCRM Isolation**:
  - Production (port 5432 / `jesmond-db`) and MatrixCRM are completely isolated on separate Docker networks.
  - Never run staging commands against port `5432`.

---

## 2. Configuration Setup

Create `.env.staging` based on `.env.staging.example` (make sure it remains untracked by git):
```bash
cp .env.staging.example .env.staging
```
Ensure required mock secrets (e.g., `JWT_SECRET`, database passwords) are populated inside `.env.staging`. **Never commit or display secret values.**

---

## 3. Staging Service Startup

Start the backing services (Database and Redis) first:
```bash
docker compose -f docker-compose.staging.yml up -d jesmond-staging-db jesmond-staging-redis
```

Verify service status:
```bash
docker compose -f docker-compose.staging.yml ps jesmond-staging-db jesmond-staging-redis
```

---

## 4. Pre-Migration Target Verification & Backup

### 4.1 Verify Target Database & User
Before initiating a backup or migration, verify connectivity to the staging database container without hardcoding credentials:
```bash
# Verify container is running and inspect target database name and user inside container
docker exec jesmond-staging-db psql -U jesmond_app -d jesmond_staging -c "SELECT current_database(), current_user, inet_server_port();"
```
Ensure output explicitly shows database `jesmond_staging` and user `jesmond_app`.

### 4.2 Secure Timestamped Backup (Directory / Custom Format)
Run `pg_dump` inside the container using container-internal environment variables to prevent credentials from leaking into shell history:
```bash
# 1. Create timestamped backup filename
BACKUP_FILE="staging_backup_$(date +%Y%m%d_%H%M%S).dump"

# 2. Execute pg_dump using custom format (-Fc) inside container
docker exec jesmond-staging-db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "${BACKUP_FILE}"

# 3. IMMEDIATELY capture and verify the exit code
DUMP_STATUS=$?
if [ ${DUMP_STATUS} -ne 0 ]; then
  echo "CRITICAL: pg_dump failed with exit code ${DUMP_STATUS}. Aborting deployment!" >&2
  rm -f "${BACKUP_FILE}"
  exit 1
fi

# 4. Verify backup format integrity using containerized pg_restore
docker exec -i jesmond-staging-db pg_restore -l < "${BACKUP_FILE}" > /dev/null
if [ $? -ne 0 ]; then
  echo "CRITICAL: Backup file is invalid or corrupt. Aborting deployment!" >&2
  exit 1
fi

echo "Verified backup successfully created at: ${BACKUP_FILE}"
```

---

## 5. Staging Database Migration & Demo Data Prerequisites

### 5.1 Check Pending Migrations
Using the host terminal pointing to the staging port (`5433`):
```bash
# Load DATABASE_URL safely from .env.staging or export for staging session:
# (Replace with staging connection pointing to port 5433)
export DATABASE_URL="postgresql://jesmond_app:<STAGING_PASSWORD>@127.0.0.1:5433/jesmond_staging?schema=public"

pnpm --filter @jesmond/db exec prisma migrate status
```

### 5.2 Apply Pending Migrations
```bash
pnpm --filter @jesmond/db run db:migrate:deploy
```

### 5.3 Generate Prisma Client
```bash
pnpm --filter @jesmond/db run db:generate
```

### 5.4 Ensure Staging Demo Accounts Exist (Prerequisite)
Because staging uses a clean or isolated database (`jesmond_staging`), verify if demo accounts exist before running smoke tests. If the staging database is newly initialized, seed the appointment demo accounts safely:
```bash
pnpm --filter @jesmond/db exec tsx prisma/seed-appointments-demo.ts
```
*Note: This script idempotently creates/verifies the demo organizations and staff accounts:*
- `demo.services@jesmond.com.au` (`SERVICES`)
- `demo.mechanics@jesmond.com.au` (`MECHANICS`)

---

## 6. Build and Deploy Staging Containers

Rebuild and launch the staging API and Web services using exact Compose service names:
```bash
# 1. Build staging images
docker compose -f docker-compose.staging.yml build jesmond-staging-api jesmond-staging-web

# 2. Recreate containers with zero downtime on backing services
docker compose -f docker-compose.staging.yml up -d --no-deps jesmond-staging-api jesmond-staging-web
```

---

## 7. Health & Endpoint Verification

Confirm container health:
```bash
# 1. Check container running state
docker compose -f docker-compose.staging.yml ps

# 2. Check API container logs
docker compose -f docker-compose.staging.yml logs --tail=40 jesmond-staging-api

# 3. Check API root response (returns HTTP 200 "Hello World!")
curl -f -s http://127.0.0.1:3303/api/v1 || echo "ERROR: API is not responding on port 3303"

# 4. Check Web frontend accessibility (returns HTTP 200)
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3302
```

---

## 8. Staging Smoke Verification Checklist

1. **Authentication**: Log into `http://localhost:3302/login` as `demo.services@jesmond.com.au`.
2. **Navigation**: Verify immediate redirect to `/portal/business/appointments`.
3. **Services Catalogue**: Navigate to `/portal/business/services`.
   - Confirm existing seeded services appear in the **Uncategorized** filter tab.
4. **Category Creation**:
   - Create category `Electrical` (active).
   - Create category `Plumbing` (active).
   - Confirm category pills render with live count tags.
5. **Service Assignment**:
   - Assign an existing service to `Electrical`. Confirm category tag appears on the card.
   - Click quick unassign (`X`) on the card and confirm the service returns to **Uncategorized**.
6. **Deletion Rejection**:
   - Assign a service to `Plumbing`.
   - Attempt to delete `Plumbing`. Confirm the UI and API reject deletion with: *"Cannot delete category... because it contains active service(s)."*
7. **Safe Deletion**:
   - Unassign the service from `Plumbing`.
   - Delete `Plumbing`. Confirm deletion succeeds.
8. **Customer Booking**:
   - Navigate to the public appointment booking flow on `http://localhost:3302`.
   - Confirm active categories show filter buttons, and appointments can be booked without availability or validation errors.
9. **Retail Isolation**:
   - Confirm appointment accounts cannot access `/portal/retail/pos`.
   - Log in as Retail account (`provider@jesmond.demo`) and confirm standard commerce navigation remains intact.

---

## 9. Rollback & Recovery Procedures

### 9.1 Application Rollback (Without Database Changes)
> [!IMPORTANT]
> **Do not run `git checkout` against your active working directory**, as that could discard uncommitted Phase 3/4 files.
> Because migration `20261010062455_add_service_categories` is **strictly additive** (adds a nullable column and a new table), older application code can run safely against the migrated database.

To roll back the application container to a prior known-good Docker image or commit:
1. Identify the previous image ID or tag via `docker images`.
2. Redeploy the previous image tag or rebuild from a separate deployment clone:
   ```bash
   # Example: Re-tag and launch previous image without touching git working tree
   docker tag jesmond-staging-api:previous jesmond-staging-api:latest
   docker compose -f docker-compose.staging.yml up -d --no-deps jesmond-staging-api jesmond-staging-web
   ```

### 9.2 Safe Database Recovery Procedure
> [!CAUTION]
> Never restore a backup blindly over an active database. Always restore into a separate validation database first, or follow this verified procedure:

1. **Assess Data Loss**: Determine whether schema rollback is actually necessary (since additive schema changes do not break legacy code).
2. **Stop API traffic to prevent partial writes**:
   ```bash
   docker compose -f docker-compose.staging.yml stop jesmond-staging-api
   ```
3. **Preferred: Restore into a Temporary Database for Validation**:
   ```bash
   # Create temporary restore database inside staging container
   docker exec jesmond-staging-db psql -U jesmond_app -d postgres -c "CREATE DATABASE jesmond_staging_recovery;"

   # Restore verified custom-format dump into temporary database
   docker exec -i jesmond-staging-db pg_restore -U jesmond_app -d jesmond_staging_recovery < "${BACKUP_FILE}"

   # Verify tables and counts in recovery database
   docker exec jesmond-staging-db psql -U jesmond_app -d jesmond_staging_recovery -c "\dt"
   ```
4. **Swap or Point Staging to Restored Database**:
   Update `DATABASE_URL` in `.env.staging` to point to `jesmond_staging_recovery`, or complete the controlled rename only after verification.

---

## 10. Cleanup Instructions

To stop the staging environment without deleting data:
```bash
docker compose -f docker-compose.staging.yml down
```

To completely purge staging volumes (reset database/Redis):
```bash
docker compose -f docker-compose.staging.yml down -v
```
