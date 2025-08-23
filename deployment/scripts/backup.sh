#!/bin/bash

# Production backup script for FDTS SQLite database and files
# This script creates compressed backups of the database and uploaded files

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/app/backups}"
EXTERNAL_BACKUP_DIR="${EXTERNAL_BACKUP_DIR:-/external_backups}"
DATABASE_PATH="${DATABASE_PATH:-/app/data/database.sqlite}"
UPLOAD_DIR="${UPLOAD_DIR:-/app/uploads}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="fdts_backup_${TIMESTAMP}"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Create backup directories if they don't exist
mkdir -p "${BACKUP_DIR}" "${EXTERNAL_BACKUP_DIR}"

log "Starting backup process: ${BACKUP_NAME}"

# Create temporary backup directory
TEMP_BACKUP_DIR="${BACKUP_DIR}/temp_${TIMESTAMP}"
mkdir -p "${TEMP_BACKUP_DIR}"

# Backup database
log "Backing up database..."
if [ -f "${DATABASE_PATH}" ]; then
    # Create a consistent backup using SQLite backup API
    sqlite3 "${DATABASE_PATH}" ".backup ${TEMP_BACKUP_DIR}/database.sqlite"
    
    # Verify backup integrity
    sqlite3 "${TEMP_BACKUP_DIR}/database.sqlite" "PRAGMA integrity_check;" > "${TEMP_BACKUP_DIR}/integrity_check.txt"
    
    if grep -q "ok" "${TEMP_BACKUP_DIR}/integrity_check.txt"; then
        log "Database backup completed and verified"
    else
        log "ERROR: Database backup integrity check failed"
        cat "${TEMP_BACKUP_DIR}/integrity_check.txt"
        exit 1
    fi
else
    log "WARNING: Database file not found at ${DATABASE_PATH}"
fi

# Backup uploaded files
log "Backing up uploaded files..."
if [ -d "${UPLOAD_DIR}" ]; then
    tar -czf "${TEMP_BACKUP_DIR}/uploads.tar.gz" -C "${UPLOAD_DIR}" . 2>/dev/null || {
        log "WARNING: No files found in upload directory or backup failed"
        touch "${TEMP_BACKUP_DIR}/uploads.tar.gz"
    }
    log "File backup completed"
else
    log "WARNING: Upload directory not found at ${UPLOAD_DIR}"
    touch "${TEMP_BACKUP_DIR}/uploads.tar.gz"
fi

# Create backup metadata
cat > "${TEMP_BACKUP_DIR}/backup_info.txt" << EOF
Backup Name: ${BACKUP_NAME}
Timestamp: ${TIMESTAMP}
Database Path: ${DATABASE_PATH}
Upload Directory: ${UPLOAD_DIR}
Backup Created: $(date)
Database Size: $(du -h "${DATABASE_PATH}" 2>/dev/null | cut -f1 || echo "N/A")
Upload Size: $(du -sh "${UPLOAD_DIR}" 2>/dev/null | cut -f1 || echo "N/A")
EOF

# Create compressed archive
log "Creating compressed backup archive..."
cd "${BACKUP_DIR}"
tar -czf "${BACKUP_NAME}.tar.gz" -C temp_${TIMESTAMP} .

# Verify archive
if tar -tzf "${BACKUP_NAME}.tar.gz" >/dev/null 2>&1; then
    log "Backup archive created and verified: ${BACKUP_NAME}.tar.gz"
else
    log "ERROR: Backup archive verification failed"
    exit 1
fi

# Copy to external backup location
if [ -d "${EXTERNAL_BACKUP_DIR}" ]; then
    cp "${BACKUP_NAME}.tar.gz" "${EXTERNAL_BACKUP_DIR}/"
    log "Backup copied to external location"
fi

# Cleanup temporary directory
rm -rf "${TEMP_BACKUP_DIR}"

# Cleanup old backups
log "Cleaning up old backups (keeping ${RETENTION_DAYS} days)..."
find "${BACKUP_DIR}" -name "fdts_backup_*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete
find "${EXTERNAL_BACKUP_DIR}" -name "fdts_backup_*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true

# Calculate backup size
BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | cut -f1)
log "Backup completed successfully: ${BACKUP_NAME}.tar.gz (${BACKUP_SIZE})"

# Send notification (if configured)
if [ -n "${BACKUP_WEBHOOK_URL}" ]; then
    curl -X POST "${BACKUP_WEBHOOK_URL}" \
         -H "Content-Type: application/json" \
         -d "{\"message\": \"FDTS backup completed: ${BACKUP_NAME}.tar.gz (${BACKUP_SIZE})\"}" \
         2>/dev/null || log "WARNING: Failed to send backup notification"
fi

log "Backup process completed"