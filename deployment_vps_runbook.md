# Jesmond Phase 5: Production Deployment & Verification Runbook

## Scope & Deployment Boundaries
- **Project Root**: `/var/www/jesmond` on the production VPS.
- **Compose Specification**: `docker-compose.production.yml`.
- **Target Services**: `jesmond-api` and `jesmond-web` only.
- **Unmodified Services**:
  - `jesmond-redis`: Active cache and queues. **DO NOT RESTART OR TOUCH.**
  - **MatrixCRM**: Runs in isolated containers. **DO NOT TOUCH.**
- **Staging Files**: `.env.staging.example`, `docker-compose.staging.yml`, `staging_runbook.md` must remain untracked and excluded from production.

---

## 1. Git Release SHA Verification & Working Tree Safety

Execute on the VPS host:

```bash
cd /var/www/jesmond

# 1. Guard against uncommitted working-tree drift and untracked files
# Explicitly account for .env.production as the only permitted untracked file on production
DRIFT="$(git status --porcelain | grep -v '^\?\? \.env\.production' || true)"
if [ -n "$DRIFT" ]; then
  echo "STOP: Working tree drift or unexpected untracked files detected on VPS:" >&2
  echo "$DRIFT" >&2
  echo "Aborting. Do not run git reset --hard or git clean; investigate manual changes." >&2
  exit 1
fi

# 2. Fetch origin with tags and prune
git fetch --prune origin

# 3. Target the reviewed Phase 5 Release Commit SHA
# Must be the full 40-character commit hash reviewed and approved for release
TARGET_COMMIT="<FULL_40_CHAR_RELEASE_COMMIT_SHA>"

# Validate format is a full 40-character hex string
if ! echo "$TARGET_COMMIT" | grep -Eq '^[0-9a-fA-F]{40}$'; then
  echo "STOP: TARGET_COMMIT ($TARGET_COMMIT) must be an exact 40-character hexadecimal SHA. Aborting." >&2
  exit 1
fi

# Verify commit exists on the trusted remote tracking branch (origin/main)
if ! git merge-base --is-ancestor "$TARGET_COMMIT" origin/main >/dev/null 2>&1; then
  echo "STOP: Target commit $TARGET_COMMIT is not reachable from trusted origin/main. Aborting." >&2
  exit 1
fi

# 4. Checkout the verified release commit directly in detached HEAD
git checkout "$TARGET_COMMIT"

CURRENT_COMMIT="$(git rev-parse HEAD)"
if [ "$CURRENT_COMMIT" != "$TARGET_COMMIT" ]; then
  echo "STOP: Current checked-out commit ($CURRENT_COMMIT) does not match target ($TARGET_COMMIT). Aborting." >&2
  exit 1
fi

echo "Verified release commit checked out: $CURRENT_COMMIT"
```

---

## 2. In-Container Database Credential Handling & Execution Boundaries

To prevent `DATABASE_URL` from appearing in host process argument tables (`ps aux`, `/proc/[pid]/cmdline`), shell history, or terminal output, use a temporary restricted env file (`chmod 600`) containing **only** `DATABASE_URL`.

> [!IMPORTANT]
> **Command Execution Boundary**:
> Steps 2, 3, 4, and 5 must be executed within the **same interactive shell session** (or wrapped in a dedicated release execution script). If a subshell exits or a new terminal is opened, `$CRED_TMP` is unassigned and the cleanup trap removes the temporary credentials file. Never create `$CRED_TMP` in one shell and expect it to persist in another.

Install the cleanup trap *before* creating the file:

```bash
# 1. Initialize variable and define cleanup trap before file creation
CRED_TMP=""
cleanup_cred() {
  if [ -n "${CRED_TMP:-}" ] && [ -f "$CRED_TMP" ]; then
    rm -f "$CRED_TMP"
  fi
}
trap cleanup_cred EXIT INT TERM

# 2. Extract ONLY DATABASE_URL into a root-only restricted temporary environment file
CRED_TMP="$(mktemp -p /var/backups/jesmond .db_cred_XXXXXX.env)"
chmod 600 "$CRED_TMP"
grep -E '^DATABASE_URL=' /var/www/jesmond/.env.production > "$CRED_TMP"

if [ ! -s "$CRED_TMP" ]; then
  echo "STOP: Failed to extract DATABASE_URL into $CRED_TMP or file is empty. Aborting." >&2
  exit 1
fi
```
*Note: This file contains only `DATABASE_URL`. It avoids mounting the full `.env.production` (which contains JWT secrets, Cloudflare R2 keys, etc.) into ephemeral containers.*

---

## 3. Read-Only Orphan Data Audit (`NOT EXISTS`) & Export

Before applying the Phase 5 migration, inspect existing `StaffTimeOff` records against the exact migration backfill condition:

```bash
# 1. Summary Count Audit Query
docker run --rm --network jesmond-network \
  --env-file "$CRED_TMP" \
  postgres:16-alpine \
  psql "$DATABASE_URL" -c "
    SELECT
      count(*) AS total_time_off,
      count(*) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM \"OrgStaff\" os WHERE os.id = sto.\"staffId\"
        )
      ) AS valid_associated_records,
      count(*) FILTER (
        WHERE NOT EXISTS (
          SELECT 1 FROM \"OrgStaff\" os WHERE os.id = sto.\"staffId\"
        )
      ) AS orphan_records_to_be_deleted
    FROM \"StaffTimeOff\" sto;
  "
```

```bash
# 2. Detailed Diagnostic Query (If orphan_records_to_be_deleted > 0)
docker run --rm --network jesmond-network \
  --env-file "$CRED_TMP" \
  postgres:16-alpine \
  psql "$DATABASE_URL" -c "
    SELECT sto.id, sto.\"staffId\", sto.\"startTime\", sto.\"endTime\", sto.reason, sto.\"createdAt\"
    FROM \"StaffTimeOff\" sto
    WHERE NOT EXISTS (
      SELECT 1 FROM \"OrgStaff\" os WHERE os.id = sto.\"staffId\"
    );
  "
```

### Business Impact & Hard Stop Condition:
- **HARD STOP CONDITION**: If `orphan_records_to_be_deleted > 0`, **DO NOT PROCEED TO MIGRATION**.
- **Explanation**: These records belong to former staff members whose `OrgStaff` records were deleted in past operations. They may contain audit history, historical leave records, or dispute documentation.
- **Required Action Before Migration**:
  1. Export orphan records securely via an atomic, failure-safe CSV process:
     ```bash
     ARCHIVE_FILE="/var/backups/jesmond/orphaned_staff_time_off_$(date +%Y%m%d_%H%M%S).csv"
     TMP_CSV="$(mktemp -p /var/backups/jesmond .orphan_export_XXXXXX.csv)"
     chmod 600 "$TMP_CSV"

     # Fail immediately if docker or psql fails; do not create corrupted CSV
     if ! docker run --rm --network jesmond-network \
       --env-file "$CRED_TMP" \
       postgres:16-alpine \
       psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "\copy (SELECT sto.* FROM \"StaffTimeOff\" sto WHERE NOT EXISTS (SELECT 1 FROM \"OrgStaff\" os WHERE os.id = sto.\"staffId\")) TO STDOUT WITH CSV HEADER" > "$TMP_CSV"; then
       rm -f "$TMP_CSV"
       echo "STOP: Orphan CSV export query failed. Aborting." >&2
       exit 1
     fi

     # Validate exported CSV contains header and data
     if [ ! -s "$TMP_CSV" ] || [ "$(wc -l < "$TMP_CSV")" -lt 2 ]; then
       rm -f "$TMP_CSV"
       echo "STOP: Orphan CSV export produced empty or invalid data. Aborting." >&2
       exit 1
     fi

     mv "$TMP_CSV" "$ARCHIVE_FILE"
     chmod 600 "$ARCHIVE_FILE"
     echo "Orphan records securely archived to: $ARCHIVE_FILE"
     ```
  2. **Obtain explicit written stakeholder authorization** before allowing `20261010094510_enhance_staff_time_off` to delete these records. If authorization is not granted, abort the deployment.

---

## 4. Hardened Production Backup Procedure

Execute the backup script below. It guarantees:
- Strict shell error handling (`set -euo pipefail`).
- Isolated private staging directory (`umask 077`).
- Collision guards on all target filenames.
- Verification of archive TOC (`pg_restore -l`) and SHA-256 checksum integrity.
- Preservation of every existing backup.
- Failure-safe handling of publication: if one file fails during publication, cleanup handles it safely.

```bash
#!/usr/bin/env bash
set -euo pipefail

cd /var/www/jesmond

BACKUP_DIR="/var/backups/jesmond"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FINAL_DUMP="${BACKUP_DIR}/jesmond_prod_phase5_${TIMESTAMP}.dump"
FINAL_SHA="${FINAL_DUMP}.sha256"

# 1. Collision guard: Ensure final target files do not exist
if [ -e "$FINAL_DUMP" ] || [ -e "$FINAL_SHA" ]; then
  echo "STOP: Destination backup ${FINAL_DUMP} or checksum already exists. Aborting." >&2
  exit 1
fi

# 2. Create a private temporary staging directory
STAGE_DIR="$(mktemp -d -p "$BACKUP_DIR" .stage_XXXXXX)"
chmod 700 "$STAGE_DIR"
STAGE_DUMP="${STAGE_DIR}/backup.dump"
STAGE_SHA="${STAGE_DIR}/backup.sha256"

# Clean up temporary staging directory on exit or error
cleanup_backup() {
  rm -rf "$STAGE_DIR"
}
trap cleanup_backup EXIT INT TERM

# 3. Create restricted temporary file
touch "$STAGE_DUMP"
chmod 600 "$STAGE_DUMP"

echo "Streaming custom-format PostgreSQL dump..."
docker run --rm --network jesmond-network \
  --env-file "$CRED_TMP" \
  postgres:16-alpine \
  sh -c 'pg_dump "$DATABASE_URL" -Fc' > "$STAGE_DUMP"

if [ ! -s "$STAGE_DUMP" ]; then
  echo "STOP: pg_dump produced an empty file. Aborting." >&2
  exit 1
fi

# 4. Validate Table of Contents (TOC) structure
echo "Validating archive TOC structure via pg_restore..."
docker run --rm -v "${STAGE_DIR}:/stage:ro" postgres:16-alpine \
  pg_restore -l "/stage/backup.dump" > /dev/null

echo "Archive TOC validation: PASSED."

# 5. Generate and verify SHA-256 checksum in staging
(cd "$STAGE_DIR" && sha256sum "backup.dump" > "backup.sha256")
(cd "$STAGE_DIR" && sha256sum --check --status "backup.sha256")
chmod 600 "$STAGE_SHA"

# 6. Publish final artifacts safely
# Note: In POSIX filesystems, moving two files cannot be performed in a single atomic transaction.
# We publish the dump first, update the filename in the checksum, and publish the checksum.
# Failure Handling:
# - If an interruption occurs after the dump is moved but before the checksum is moved,
#   an already published backup MUST NEVER BE AUTOMATICALLY DELETED.
# - An orphaned dump without its companion checksum file indicates an interrupted publication.
#   It will fail verification and MUST be investigated manually; it is NEVER automatically repaired.
# - If either file move fails, the staging directory is cleaned up by the trap, leaving any pre-existing
#   historical backups completely untouched.
mv "$STAGE_DUMP" "$FINAL_DUMP"
sed -i "s|backup\.dump|$(basename "$FINAL_DUMP")|" "$STAGE_SHA"
mv "$STAGE_SHA" "$FINAL_SHA"

chmod 600 "$FINAL_DUMP" "$FINAL_SHA"

# Verify final published checksum
if ! (cd "$BACKUP_DIR" && sha256sum --check --status "$(basename "$FINAL_SHA")"); then
  echo "STOP: Final published backup checksum verification failed. Do not proceed to migration." >&2
  exit 1
fi

echo "=========================================================="
echo "PRODUCTION BACKUP VERIFIED & PUBLISHED"
echo "Backup File: $FINAL_DUMP ($(du -h "$FINAL_DUMP" | cut -f1))"
echo "Checksum:    $(cat "$FINAL_SHA")"
echo "Important Notice:"
echo "TOC validation confirms archive structure and table catalog readability;"
echo "it is not equivalent to a full restore test on a live staging database."
echo "=========================================================="
```

---

## 5. Migration Execution & Container Deployment

Apply the migration and rebuild application services only after the backup passes.

> [!IMPORTANT]
> **Database Configuration for Prisma**:
> The host shell does not automatically have `.env.production` loaded. To ensure Prisma targets the production database without leaking credentials, run the migration within an inline subshell feeding only `$CRED_TMP`:
> ```bash
> (set -a && . "$CRED_TMP" && set +a && pnpm --filter @jesmond/db run db:migrate:deploy)
> ```
> This loads strictly `DATABASE_URL` for the duration of the Prisma command without exporting other variables, printing credentials, or putting connection strings into command arguments.

```bash
cd /var/www/jesmond

# 1. Apply database migration using repository script with isolated DATABASE_URL
echo "Applying database migration 20261010094510_enhance_staff_time_off..."
if ! (set -a && . "$CRED_TMP" && set +a && pnpm --filter @jesmond/db run db:migrate:deploy); then
  echo "STOP: Migration failed. Do not start application services. Assess state." >&2
  exit 1
fi

# 2. Regenerate Prisma Client
echo "Regenerating Prisma client..."
if ! pnpm --filter @jesmond/db run db:generate; then
  echo "STOP: Prisma client generation failed. Aborting deployment." >&2
  exit 1
fi

# 3. Build only jesmond-api and jesmond-web
# (Preserves .env.production, does not restart Redis or MatrixCRM)
echo "Building jesmond-api and jesmond-web containers..."
if ! docker compose --env-file .env.production -f docker-compose.production.yml build jesmond-api jesmond-web; then
  echo "STOP: Container build failed. Existing running containers remain untouched." >&2
  exit 1
fi

# 4. Recreate containers with zero downtime
echo "Recreating jesmond-api and jesmond-web containers..."
if ! docker compose --env-file .env.production -f docker-compose.production.yml up -d --no-deps jesmond-api jesmond-web; then
  echo "STOP: Container startup failed. Inspect container logs immediately." >&2
  exit 1
fi

# 5. Verify container running status
docker compose --env-file .env.production -f docker-compose.production.yml ps jesmond-api jesmond-web
```

---

## 6. Post-Deployment Verification Probes & Smoke Tests

The NestJS backend mounts feature routes under the global prefix `api/v1` (set in `apps/api/src/main.ts`), with root service info handled by `AppController`.

Execute immediate verification probes:

```bash
# 1. Container Running State Check
RUNNING_API="$(docker compose -f docker-compose.production.yml ps -q jesmond-api)"
RUNNING_WEB="$(docker compose -f docker-compose.production.yml ps -q jesmond-web)"
if [ -z "$RUNNING_API" ] || [ -z "$RUNNING_WEB" ]; then
  echo "STOP: One or more application containers are not running." >&2
  exit 1
fi

# 2. API Root & Global Prefix Health Checks
# Root hello probe (AppController @Get() without prefix)
curl -f http://127.0.0.1:3301/ && echo " -> API Root Response: OK"

# Global Prefix / Public Properties Probe (NestJS api/v1 route)
curl -f http://127.0.0.1:3301/api/v1/properties && echo " -> API Global Prefix Route (/api/v1/properties): OK"

# 3. Web Availability Route Probe
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3300/portal/business/availability | grep -E "200|307" && echo " -> Web Availability Route: OK"

# 4. Prisma Migration History Record
docker run --rm --network jesmond-network \
  --env-file "$CRED_TMP" \
  postgres:16-alpine \
  psql "$DATABASE_URL" -c "
    SELECT migration_name, finished_at, rolled_back_at
    FROM _prisma_migrations
    ORDER BY finished_at DESC LIMIT 3;
  "

# 5. Redacted Container Logs Inspection (Check for unhandled exceptions or boot crashes)
echo "Recent API logs (secrets redacted):"
docker compose -f docker-compose.production.yml logs --tail=50 jesmond-api | sed -E 's/(DATABASE_URL|JWT_SECRET|PASSWORD|SECRET)[^ ]+/[REDACTED]/g'

echo "Recent Web logs (secrets redacted):"
docker compose -f docker-compose.production.yml logs --tail=50 jesmond-web | sed -E 's/(DATABASE_URL|JWT_SECRET|PASSWORD|SECRET)[^ ]+/[REDACTED]/g'

# 6. Functional Smoke Probes (Phase 5 Availability & Appointments)
# A. Public Availability Route: AppointmentsController @Controller('appointments') -> @Get('availability')
# Full Path: /api/v1/appointments/availability
# Probing without required query params should return 400 Bad Request, confirming route is live and validator is active
HTTP_AVAIL_PROBE="$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3301/api/v1/appointments/availability || true)"
if [ "$HTTP_AVAIL_PROBE" = "400" ]; then
  echo " -> API Public Availability Route: OK (HTTP 400 Bad Request as expected for missing query params)"
else
  echo "WARNING: Unexpected HTTP status ($HTTP_AVAIL_PROBE) on /api/v1/appointments/availability" >&2
fi

# B. Authenticated Business Time-Off Route: BusinessAppointmentsController @Controller('business-appointments') -> @Get('time-off')
# Full Path: /api/v1/business-appointments/time-off
# Probing without JWT should return 401 Unauthorized, confirming route and guard are live
HTTP_TIMEOFF_PROBE="$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3301/api/v1/business-appointments/time-off || true)"
if [ "$HTTP_TIMEOFF_PROBE" = "401" ]; then
  echo " -> API Authenticated Business Time-Off Route: OK (HTTP 401 Unauthorized as expected without JWT)"
else
  echo "WARNING: Unexpected HTTP status ($HTTP_TIMEOFF_PROBE) on /api/v1/business-appointments/time-off" >&2
fi

# C. Web Business Appointments Portal Route
HTTP_PORTAL_APPT="$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3300/portal/business/appointments || true)"
if [ "$HTTP_PORTAL_APPT" = "404" ] || [ "$HTTP_PORTAL_APPT" = "500" ]; then
  echo "WARNING: Unexpected HTTP status ($HTTP_PORTAL_APPT) on business appointments portal route." >&2
else
  echo " -> Web Business Appointments Portal Route: OK (HTTP $HTTP_PORTAL_APPT)"
fi
```

---

## 7. Rollback Protocols & Schema Compatibility

### A. Non-Destructive Application Rollback (Primary Procedure)
If application or frontend issues occur:
```bash
cd /var/www/jesmond

# 1. Target the verified previous release commit SHA (Phase 4 release commit)
PREVIOUS_COMMIT="<PREVIOUS_REVIEWED_COMMIT_SHA>"

# Validate format
if ! echo "$PREVIOUS_COMMIT" | grep -Eq '^[0-9a-fA-F]{40}$'; then
  echo "STOP: PREVIOUS_COMMIT must be an exact 40-character hexadecimal SHA. Aborting." >&2
  exit 1
fi

# Verify commit exists on origin
if ! git rev-parse --verify "${PREVIOUS_COMMIT}^{commit}" >/dev/null 2>&1; then
  echo "STOP: Target commit ${PREVIOUS_COMMIT} is not available in local git repository. Aborting." >&2
  exit 1
fi

# 2. Checkout previous commit in detached HEAD without destructive reset
git checkout "$PREVIOUS_COMMIT"

# 3. Regenerate Prisma Client
pnpm --filter @jesmond/db run db:generate

# 4. Rebuild and restart application containers
docker compose --env-file .env.production -f docker-compose.production.yml build jesmond-api jesmond-web
docker compose --env-file .env.production -f docker-compose.production.yml up -d --no-deps jesmond-api jesmond-web
```

### B. Schema Compatibility & Schema Relaxation Warning
- **Compatibility**: The Phase 5 migration adds columns (`organizationId`, `type`, `recurrence`, `timezone`, `createdById`, `deletedAt`). Previous application read queries will continue to function normally.
- **Write Constraint**: If legacy code attempts to *create* a `StaffTimeOff` row without supplying `organizationId`, it will fail because `organizationId` is `NOT NULL`.
- **Schema Relaxation**: If legacy writes must be supported during an extended rollback, `organizationId` can be relaxed:
  ```bash
  docker run --rm --network jesmond-network \
    --env-file "$CRED_TMP" \
    postgres:16-alpine \
    psql "$DATABASE_URL" -c "
      ALTER TABLE \"StaffTimeOff\" ALTER COLUMN \"organizationId\" DROP NOT NULL;
    "
  ```
- **CRITICAL WARNING**:
  - Reverting application code or running `ALTER COLUMN "organizationId" DROP NOT NULL` does **NOT** reverse the migration.
  - The new enum types (`TimeOffType`, `RecurrenceRule`), new columns, and indexes remain in the database.
  - Furthermore, it does not guarantee bidirectional compatibility if users have already created new Phase 5 recurring availability blocks or offline appointments.
  - **Never** attempt to automatically restore a database dump as part of an application rollback.

### C. Separate Disaster Recovery Procedure (Catastrophic Data Corruption Only)
**DO NOT** execute this as a routine rollback. Restoring the dump permanently destroys any orders, accounts, or payments created since the backup was taken.
```bash
# DISASTER RECOVERY ONLY
echo "CRITICAL WARNING: This will overwrite live database state with backup ${FINAL_DUMP}"
docker run --rm --network jesmond-network \
  --env-file "$CRED_TMP" \
  -v "${BACKUP_DIR}:/backup:ro" \
  postgres:16-alpine \
  pg_restore -d "$DATABASE_URL" --clean --if-exists "/backup/$(basename "$FINAL_DUMP")"
```

---

## 8. Explicit Stop Conditions Summary

**ABORT IMMEDIATELY** and stop execution if any of the following occur:
1. `git status` shows uncommitted files or working-tree drift on `/var/www/jesmond` (excluding permitted `.env.production`).
2. The target `<FULL_40_CHAR_RELEASE_COMMIT_SHA>` is invalid in format, missing, or not reachable from `origin/main`.
3. The read-only orphan audit query identifies rows with `organizationId IS NULL` (`orphan_records_to_be_deleted > 0`) that lack explicit written stakeholder authorization to delete.
4. The backup generation fails, produces a 0-byte file, or fails `pg_restore -l` TOC verification.
5. Checksum verification fails in staging or on final publication.
6. `pnpm --filter @jesmond/db run db:migrate:deploy` fails or exits non-zero.
7. `pnpm --filter @jesmond/db run db:generate` fails.
8. `docker compose build` or `docker compose up` fails for `jesmond-api` or `jesmond-web`.
9. Post-deployment probes (`/`, `/api/v1/properties`, `/portal/business/availability`, `/portal/business/appointments`) return non-success or unexpected error codes (500, 404).
10. Unhandled exceptions or database connection errors appear during boot in the container logs.
