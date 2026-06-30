#!/bin/bash
# Daily SimplyClik PostgreSQL backup
export PATH="/home/aiagent/pg/usr/lib/postgresql/16/bin:$PATH"
export LD_LIBRARY_PATH="/home/aiagent/pg/usr/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH"
export PGHOST=/home/aiagent/pg_socket

BACKUP_DIR="/home/aiagent/pg_data/backups"
mkdir -p "$BACKUP_DIR"

DATE=$(date +%Y%m%d-%H%M%S)
pg_dump -U aiagent -d simplyclik --no-owner --no-acl -f "$BACKUP_DIR/simplyclik-$DATE.sql"
gzip "$BACKUP_DIR/simplyclik-$DATE.sql"

# Keep only last 14 backups
ls -t "$BACKUP_DIR"/simplyclik-*.sql.gz | tail -n +15 | xargs -r rm

echo "Backup: simplyclik-$DATE.sql.gz ($(wc -c < "$BACKUP_DIR/simplyclik-$DATE.sql.gz") bytes)"
