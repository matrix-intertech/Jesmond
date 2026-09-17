# Jesmond 2.0 Production VPS Deployment Runbook

## Overview
This runbook provides step-by-step instructions to securely deploy the Jesmond 2.0 application and seed production demo data. 
**CRITICAL: Execute all commands explicitly.**

## Phase 3: Git Deployment

1. **SSH into the VPS**
   ```bash
   ssh user@your-vps-ip
   ```

2. **Navigate to the Jesmond project directory**
   ```bash
   cd /path/to/jesmond
   ```

3. **Check Git Status and Identify Branch**
   ```bash
   git status
   git branch --show-current
   ```
   *Safety check: If there are uncommitted changes, resolve them before pulling. Identify the exact branch name returned.*

4. **Fetch and Pull the Latest Code**
   Replace `[branch-name]` with the branch identified in step 3.
   ```bash
   git fetch origin
   git pull origin [branch-name]
   ```
   *Do not guess or hardcode "main". If unsure, stop and verify.*

5. **Verify the Current Commit**
   ```bash
   git rev-parse HEAD
   ```

6. **Verify Environment Variables**
   Ensure `.env.production` is untouched and contains correct credentials.

## Phase 5: Database Backup

**CRITICAL:** Before running any migrations or cleanup, create a database backup. Check `docker-compose.production.yml` to confirm your DB container name (e.g. `jesmond-db` or PostgreSQL port mapping). Assuming standard port exposure:

1. **Create the Backup**
   ```bash
   pg_dump -U postgres -h 127.0.0.1 -p 5432 jesmond2 > jesmond2_backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Verify Backup Exists and is Non-Zero**
   ```bash
   ls -lh jesmond2_backup_*.sql
   ```
   *STOP if the backup file is 0 bytes or failed.*

## Phase 4: Production Build & Migration

1. **Build the Application**
   ```bash
   docker compose -f docker-compose.production.yml build --no-cache
   ```

2. **Run Prisma Migration**
   Execute safely via npm/pnpm on the host (or inside the container):
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```

3. **Restart the Services and Wait for Health**
   ```bash
   docker compose -f docker-compose.production.yml up -d
   ```

## Phase 6-13: Production Scripts Execution Order

**REQUIREMENT:** You must explicitly export `CONFIRM_PRODUCTION=true` to execute mutations.

1. **Inspect Current State (Read Only)**
   ```bash
   node scripts/production_inventory.js
   ```

2. **Run Demo Cleanup (Dry-Run)**
   ```bash
   node scripts/production_cleanup_demo.js --dry-run
   ```
   *Review the exact IDs listed for deletion before proceeding.*

3. **Run Demo Cleanup (Confirm)**
   ```bash
   CONFIRM_PRODUCTION=true node scripts/production_cleanup_demo.js --confirm
   ```

4. **Setup Real Users and Organizations**
   ```bash
   CONFIRM_PRODUCTION=true node scripts/production_setup_users.js
   ```

5. **Seed Retail Demo Data**
   ```bash
   CONFIRM_PRODUCTION=true node scripts/production_seed_retail_demo.js
   ```

6. **Seed Host Demo Properties**
   ```bash
   CONFIRM_PRODUCTION=true node scripts/production_seed_host_demo.js
   ```

7. **Final Verification Check**
   ```bash
   node scripts/production_verify_demo.js
   ```

## Phase 14: API Health Check

Check API, Web endpoints, and Docker container status:
```bash
bash scripts/production_health_check.sh
```

## Phase 15: Manual Browser Testing
Proceed to `production_demo_data_plan.md` to execute manual browser testing for UI validation.
