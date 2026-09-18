#!/bin/bash
set -e
echo "Run this script inside the VPS or container. It orchestrates the refresh flow."
echo "Please refer to docs/production_demo_refresh_runbook.md for the full procedure."
echo "If you wish to execute the refresh automatically:"
echo ""
echo "node scripts/production_demo_refresh_preflight.js"
echo "# Verify scripts/production_demo_refresh_targets.json"
echo "bash scripts/production_demo_refresh_backup.sh"
echo "CONFIRM_PRODUCTION=true node scripts/production_demo_refresh.js --confirm"
echo "node scripts/production_demo_refresh_verify.js"
