# Jesmond 2.0 Production Demo Refresh Runbook

## Safety & Scope
This runbook replaces outdated, unsafe seed scripts. It performs a targeted, verified refresh of the Jesmond canonical demo dataset inside the production VPS. 

**Protected Accounts:**
- `shikharshaurya.01@gmail.com`
- `allienshaurya@gmail.com`
- `ssmnvi012@gmail.com`

*No passwords will be changed.*

---

## Prerequisites
SSH into the production VPS:
```bash
ssh user@your-vps-ip
cd /var/www/jesmond
git pull origin main
```

Identify the API container and set up the interactive bash session:
```bash
docker ps
# Identify the ID for jesmond-api
API_CONTAINER=$(docker ps -qf "name=jesmond-api")
```

---

## 1. Run Preflight Inventory
Execute the preflight check inside the API container to generate the explicit deletion targets. This uses the correct Prisma client path automatically resolved by Node.

```bash
docker exec -it $API_CONTAINER node scripts/production_demo_refresh_preflight.js
```
*Review the output carefully. Ensure canonical properties are marked KEEP and obsolete properties are marked DELETE.*

---

## 2. Review Cleanup Targets
The previous step generated `scripts/production_demo_refresh_targets.json`.
Inspect it to confirm only disposable UUIDs are targeted.
```bash
cat scripts/production_demo_refresh_targets.json
```

---

## 3. Fresh Production Backup
Run the VPS backup helper. It dynamically detects the `jesmond-postgres` container and extracts the credentials.
```bash
bash scripts/production_demo_refresh_backup.sh
```
*DO NOT PROCEED if the backup fails or the SQL dump is 0 bytes.*

---

## 4. Execute Protected Refresh
Execute the main refresh. This will execute the strict deletion, patch the roles of the 3 protected accounts without touching their passwords, and idempotently seed the 8 canonical properties and 8 retail products.

It strictly requires `CONFIRM_PRODUCTION=true` and `--confirm`.

```bash
docker exec -it -e CONFIRM_PRODUCTION=true $API_CONTAINER node scripts/production_demo_refresh.js --confirm
```

---

## 5. Verify & Validate
Run the canonical verify script to confirm all protected data remains secure, exactly 8 canonical properties exist, and hashes match exactly.

```bash
docker exec -it $API_CONTAINER node scripts/production_demo_refresh_verify.js
```
*If this fails, STOP and report the error.*

---

## 6. Health Check
Run your standard API health check scripts or curl the endpoints to confirm the web service is responsive.
```bash
curl -I https://your-jesmond-domain.com/api/health
```
