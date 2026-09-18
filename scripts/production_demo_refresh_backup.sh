#!/bin/bash
set -e

echo "=== VPS BACKUP SCRIPT ==="

# Find the exact PostgreSQL container ID
DB_CONTAINER=$(docker ps -qf "name=jesmond-postgres")

if [ -z "$DB_CONTAINER" ]; then
    echo "ERROR: jesmond-postgres container not found!"
    exit 1
fi

# Extract DB user from environment (assuming POSTGRES_USER is defined, fallback to jesmond)
DB_USER=$(docker exec "$DB_CONTAINER" env | grep POSTGRES_USER | cut -d '=' -f2)
if [ -z "$DB_USER" ]; then
    DB_USER="jesmond"
fi

# Extract DB name from environment
DB_NAME=$(docker exec "$DB_CONTAINER" env | grep POSTGRES_DB | cut -d '=' -f2)
if [ -z "$DB_NAME" ]; then
    DB_NAME="jesmond2"
fi

echo "Using DB_USER=$DB_USER and DB_NAME=$DB_NAME"

BACKUP_DIR="/var/backups/jesmond"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/jesmond_before_demo_refresh_$TIMESTAMP.sql"

echo "Running pg_dump..."
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"

if [ -s "$BACKUP_FILE" ]; then
    echo "Backup successful! Size: $(stat -c%s "$BACKUP_FILE") bytes"
    echo "Backup saved to: $BACKUP_FILE"
    
    # Check valid header
    if head -n 5 "$BACKUP_FILE" | grep -q "PostgreSQL database dump"; then
        echo "Valid PostgreSQL dump header verified."
    else
        echo "ERROR: Invalid PostgreSQL dump header."
        rm "$BACKUP_FILE"
        exit 1
    fi
else
    echo "ERROR: Backup failed or file is empty!"
    rm -f "$BACKUP_FILE"
    exit 1
fi
