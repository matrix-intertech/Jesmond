#!/bin/bash
echo "=== PRODUCTION HEALTH CHECK ==="

echo "[1] Checking Docker Containers..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E 'jesmond-api|jesmond-web|jesmond-redis'

echo -e "\n[2] Checking Database Connection..."
# Use Prisma to safely check connection instead of db pull
docker exec jesmond-api node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.\$connect().then(() => { console.log('Database connected successfully.'); process.exit(0); }).catch(err => { console.error('Database connection failed:', err); process.exit(1); })"

echo -e "\n[3] Checking Redis Connectivity..."
docker exec jesmond-redis redis-cli ping || echo "Redis check failed."

echo -e "\n[4] Checking API Health Endpoint..."
API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health)
if [ "$API_HEALTH" -eq 200 ] || [ "$API_HEALTH" -eq 404 ]; then
  echo "API responded (HTTP $API_HEALTH)"
else
  echo "Failed to reach API (HTTP $API_HEALTH)"
fi

echo -e "\n[5] Checking Public Property API..."
PROP_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/v1/properties)
if [ "$PROP_HEALTH" -eq 200 ] || [ "$PROP_HEALTH" -eq 404 ]; then
  echo "Public properties endpoint responded (HTTP $PROP_HEALTH)"
else
  echo "Failed to reach public properties endpoint (HTTP $PROP_HEALTH)"
fi

echo -e "\nDone."
