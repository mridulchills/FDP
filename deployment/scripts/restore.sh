#!/bin/bash

# Production restore script for FDTS SQLite database and files
# This script restores from compressed backup archives

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/app/backups}"
DATABASE_PATH="${DATABASE_PATH:-/app/data/database.sqlite}"
UPLOAD_DIR="${UPLOAD_DIR:-/app/uploads}"
RESTORE_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Usage function
usage() {
    echo "Usage: $0 <backup_file> [--force]"
    echo "  backup_file: Path to the backup archive (.tar.gz)"
    echo "  --force: Skip confirmation prompt"
    exit 1
}

# Check arguments
if [ $# -lt 1 ]; then
    usage
fi

BACKUP_FILE="$1"
FORCE_RESTORE="$2"

# Validate backup file
if [ ! -f "${BACKUP_FILE}" ]; then
    log "ERROR: Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

# Verify backup archive
if ! tar -tzf "${BACKUP_FILE}" >/dev/null 2>&1; then
    log "ERROR: Invalid backup archive: ${BACKUP_FILE}"
    exit 1
fi

log "Starting restore process from: ${BACKUP_FILE}"

# Show backup information
TEMP_INFO_DIR="/tmp/backup_info_${RESTORE_TIMESTAMP}"
mkdir -p "${TEMP_INFO_DIR}"
tar -xzf "${BACKUP_FILE}" -C "${TEMP_INFO_DIR}" backup_info.txt 2>/dev/null || {
    log "WARNING: Backup info not found in archive"
}

if [ -f "${TEMP_INFO_DIR}/backup_info.txt" ]; then
    log "Backup Information:"
    cat "${TEMP_INFO_DIR}/backup_info.txt"
fi

# Confirmation prompt
if [ "${FORCE_RESTORE}" != "--force" ]; then
    echo
    read -p "This will overwrite existing data. Continue? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log "Restore cancelled by user"
        rm -rf "${TEMP_INFO_DIR}"
        exit 0
    fi
fi

# Create backup of current data before restore
log "Creating backup of current data before restore..."
CURRENT_BACKUP_DIR="/tmp/pre_restore_backup_${RESTORE_TIMESTAMP}"
mkdir -p "${CURRENT_BACKUP_DIR}"

if [ -f "${DATABASE_PATH}" ]; then
    cp "${DATABASE_PATH}" "${CURRENT_BACKUP_DIR}/database.sqlite.backup"
    log "Current database backed up"
fi

if [ -d "${UPLOAD_DIR}" ]; then
    tar -czf "${CURRENT_BACKUP_DIR}/uploads.tar.gz" -C "${UPLOAD_DIR}" . 2>/dev/null || true
    log "Current uploads backed up"
fi

# Extract backup to temporary location
TEMP_RESTORE_DIR="/tmp/restore_${RESTORE_TIMESTAMP}"
mkdir -p "${TEMP_RESTORE_DIR}"

log "Extracting backup archive..."
tar -xzf "${BACKUP_FILE}" -C "${TEMP_RESTORE_DIR}"

# Verify extracted files
if [ ! -f "${TEMP_RESTORE_DIR}/database.sqlite" ]; then
    log "ERROR: Database file not found in backup"
    rm -rf "${TEMP_RESTORE_DIR}" "${TEMP_INFO_DIR}"
    exit 1
fi

# Verify database integrity
log "Verifying database integrity..."
sqlite3 "${TEMP_RESTORE_DIR}/database.sqlite" "PRAGMA integrity_check;" > "${TEMP_RESTORE_DIR}/restore_integrity_check.txt"

if ! grep -q "ok" "${TEMP_RESTORE_DIR}/restore_integrity_check.txt"; then
    log "ERROR: Restored database failed integrity check"
    cat "${TEMP_RESTORE_DIR}/restore_integrity_check.txt"
    rm -rf "${TEMP_RESTORE_DIR}" "${TEMP_INFO_DIR}"
    exit 1
fi

log "Database integrity verified"

# Stop application (if running in container, this should be handled externally)
log "Note: Ensure application is stopped before proceeding with file replacement"

# Restore database
log "Restoring database..."
mkdir -p "$(dirname "${DATABASE_PATH}")"
cp "${TEMP_RESTORE_DIR}/database.sqlite" "${DATABASE_PATH}"

# Set proper permissions
chmod 644 "${DATABASE_PATH}"
log "Database restored successfully"

# Restore uploaded files
log "Restoring uploaded files..."
if [ -f "${TEMP_RESTORE_DIR}/uploads.tar.gz" ]; then
    # Remove existing uploads
    rm -rf "${UPLOAD_DIR}"
    mkdir -p "${UPLOAD_DIR}"
    
    # Extract uploads
    tar -xzf "${TEMP_RESTORE_DIR}/uploads.tar.gz" -C "${UPLOAD_DIR}" 2>/dev/null || {
        log "WARNING: No files to restore or extraction failed"
    }
    
    # Set proper permissions
    find "${UPLOAD_DIR}" -type f -exec chmod 644 {} \;
    find "${UPLOAD_DIR}" -type d -exec chmod 755 {} \;
    
    log "Files restored successfully"
else
    log "WARNING: No upload files found in backup"
fi

# Cleanup temporary directories
rm -rf "${TEMP_RESTORE_DIR}" "${TEMP_INFO_DIR}"

# Verify restore
log "Verifying restored database..."
sqlite3 "${DATABASE_PATH}" "SELECT COUNT(*) FROM users;" > /dev/null 2>&1 && {
    USER_COUNT=$(sqlite3 "${DATABASE_PATH}" "SELECT COUNT(*) FROM users;")
    log "Database verification successful - Users: ${USER_COUNT}"
} || {
    log "ERROR: Database verification failed"
    
    # Restore from pre-restore backup
    if [ -f "${CURRENT_BACKUP_DIR}/database.sqlite.backup" ]; then
        log "Restoring previous database..."
        cp "${CURRENT_BACKUP_DIR}/database.sqlite.backup" "${DATABASE_PATH}"
    fi
    
    rm -rf "${CURRENT_BACKUP_DIR}"
    exit 1
}

# Cleanup pre-restore backup
rm -rf "${CURRENT_BACKUP_DIR}"

log "Restore completed successfully"
log "Note: Restart the application to ensure all changes take effect"

# Send notification (if configured)
if [ -n "${RESTORE_WEBHOOK_URL}" ]; then
    curl -X POST "${RESTORE_WEBHOOK_URL}" \
         -H "Content-Type: application/json" \
         -d "{\"message\": \"FDTS restore completed from: $(basename ${BACKUP_FILE})\"}" \
         2>/dev/null || log "WARNING: Failed to send restore notification"
fi