#!/bin/bash

# Backup daemon script that runs scheduled backups using cron
# This script sets up the cron job and keeps the container running

set -e

# Configuration
BACKUP_SCHEDULE="${BACKUP_SCHEDULE:-0 2 * * *}"  # Default: 2 AM daily
CLEANUP_SCHEDULE="${CLEANUP_SCHEDULE:-0 4 * * 0}"  # Default: 4 AM weekly

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting backup daemon..."
log "Backup schedule: ${BACKUP_SCHEDULE}"
log "Cleanup schedule: ${CLEANUP_SCHEDULE}"

# Create crontab
cat > /tmp/crontab << EOF
# FDTS Backup and Maintenance Schedule
${BACKUP_SCHEDULE} /app/scripts/backup.sh >> /app/logs/backup.log 2>&1
${CLEANUP_SCHEDULE} /app/scripts/cleanup.sh >> /app/logs/cleanup.log 2>&1

# Health check every 5 minutes
*/5 * * * * echo "$(date): Backup daemon running" >> /app/logs/daemon.log
EOF

# Install crontab
crontab /tmp/crontab
log "Crontab installed"

# Create log directory
mkdir -p /app/logs

# Start cron daemon
crond -f -l 2 &
CRON_PID=$!

log "Cron daemon started (PID: ${CRON_PID})"

# Function to handle shutdown
shutdown() {
    log "Shutting down backup daemon..."
    kill $CRON_PID 2>/dev/null || true
    wait $CRON_PID 2>/dev/null || true
    log "Backup daemon stopped"
    exit 0
}

# Set up signal handlers
trap shutdown SIGTERM SIGINT

# Keep the script running and monitor cron
while true; do
    if ! kill -0 $CRON_PID 2>/dev/null; then
        log "ERROR: Cron daemon died, restarting..."
        crond -f -l 2 &
        CRON_PID=$!
        log "Cron daemon restarted (PID: ${CRON_PID})"
    fi
    
    sleep 60
done