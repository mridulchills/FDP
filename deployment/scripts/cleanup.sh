#!/bin/bash

# Cleanup script for FDTS production environment
# Handles log rotation, temporary file cleanup, and system maintenance

set -e

# Configuration
LOG_DIR="${LOG_DIR:-/app/logs}"
UPLOAD_DIR="${UPLOAD_DIR:-/app/uploads}"
BACKUP_DIR="${BACKUP_DIR:-/app/backups}"
DATABASE_PATH="${DATABASE_PATH:-/app/data/database.sqlite}"
LOG_RETENTION_DAYS="${LOG_RETENTION_DAYS:-7}"
TEMP_RETENTION_HOURS="${TEMP_RETENTION_HOURS:-24}"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting cleanup process..."

# Rotate and compress log files
log "Rotating log files..."
if [ -d "${LOG_DIR}" ]; then
    # Rotate application logs
    for logfile in "${LOG_DIR}"/*.log; do
        if [ -f "$logfile" ] && [ -s "$logfile" ]; then
            # Compress and rotate
            gzip -c "$logfile" > "${logfile}.$(date +%Y%m%d_%H%M%S).gz"
            > "$logfile"  # Truncate original log file
            log "Rotated: $(basename "$logfile")"
        fi
    done
    
    # Remove old compressed logs
    find "${LOG_DIR}" -name "*.log.*.gz" -type f -mtime +${LOG_RETENTION_DAYS} -delete
    log "Cleaned up old log files (older than ${LOG_RETENTION_DAYS} days)"
else
    log "WARNING: Log directory not found: ${LOG_DIR}"
fi

# Clean up temporary files
log "Cleaning up temporary files..."
if [ -d "${UPLOAD_DIR}/temp" ]; then
    find "${UPLOAD_DIR}/temp" -type f -mmin +$((TEMP_RETENTION_HOURS * 60)) -delete
    find "${UPLOAD_DIR}/temp" -type d -empty -delete
    log "Cleaned up temporary upload files (older than ${TEMP_RETENTION_HOURS} hours)"
fi

# Clean up orphaned files (files not referenced in database)
log "Checking for orphaned files..."
if [ -f "${DATABASE_PATH}" ] && [ -d "${UPLOAD_DIR}" ]; then
    # Create temporary file with database file references
    TEMP_DB_FILES="/tmp/db_files_$(date +%s).txt"
    sqlite3 "${DATABASE_PATH}" "SELECT DISTINCT document_url FROM submissions WHERE document_url IS NOT NULL;" | \
        sed 's|^/uploads/||' > "${TEMP_DB_FILES}" 2>/dev/null || touch "${TEMP_DB_FILES}"
    
    # Find files in upload directory
    TEMP_ACTUAL_FILES="/tmp/actual_files_$(date +%s).txt"
    find "${UPLOAD_DIR}" -type f -not -path "*/temp/*" | \
        sed "s|^${UPLOAD_DIR}/||" > "${TEMP_ACTUAL_FILES}"
    
    # Find orphaned files (in filesystem but not in database)
    ORPHANED_FILES="/tmp/orphaned_files_$(date +%s).txt"
    comm -23 <(sort "${TEMP_ACTUAL_FILES}") <(sort "${TEMP_DB_FILES}") > "${ORPHANED_FILES}"
    
    if [ -s "${ORPHANED_FILES}" ]; then
        ORPHAN_COUNT=$(wc -l < "${ORPHANED_FILES}")
        log "Found ${ORPHAN_COUNT} orphaned files"
        
        # Move orphaned files to quarantine directory
        QUARANTINE_DIR="${UPLOAD_DIR}/.quarantine/$(date +%Y%m%d)"
        mkdir -p "${QUARANTINE_DIR}"
        
        while IFS= read -r file; do
            if [ -f "${UPLOAD_DIR}/${file}" ]; then
                mkdir -p "${QUARANTINE_DIR}/$(dirname "${file}")"
                mv "${UPLOAD_DIR}/${file}" "${QUARANTINE_DIR}/${file}"
            fi
        done < "${ORPHANED_FILES}"
        
        log "Moved ${ORPHAN_COUNT} orphaned files to quarantine: ${QUARANTINE_DIR}"
    else
        log "No orphaned files found"
    fi
    
    # Cleanup temporary files
    rm -f "${TEMP_DB_FILES}" "${TEMP_ACTUAL_FILES}" "${ORPHANED_FILES}"
    
    # Clean up old quarantine directories (older than 30 days)
    find "${UPLOAD_DIR}/.quarantine" -type d -mtime +30 -exec rm -rf {} + 2>/dev/null || true
fi

# Database maintenance
log "Performing database maintenance..."
if [ -f "${DATABASE_PATH}" ]; then
    # Get database size before optimization
    DB_SIZE_BEFORE=$(du -h "${DATABASE_PATH}" | cut -f1)
    
    # Run VACUUM to reclaim space and optimize database
    sqlite3 "${DATABASE_PATH}" "VACUUM;"
    
    # Update statistics
    sqlite3 "${DATABASE_PATH}" "ANALYZE;"
    
    # Get database size after optimization
    DB_SIZE_AFTER=$(du -h "${DATABASE_PATH}" | cut -f1)
    
    log "Database maintenance completed - Size: ${DB_SIZE_BEFORE} -> ${DB_SIZE_AFTER}"
    
    # Check database integrity
    INTEGRITY_CHECK=$(sqlite3 "${DATABASE_PATH}" "PRAGMA integrity_check;")
    if [ "$INTEGRITY_CHECK" = "ok" ]; then
        log "Database integrity check: PASSED"
    else
        log "WARNING: Database integrity check failed: ${INTEGRITY_CHECK}"
    fi
else
    log "WARNING: Database file not found: ${DATABASE_PATH}"
fi

# System resource cleanup
log "Cleaning up system resources..."

# Clear system caches (if running as root)
if [ "$(id -u)" -eq 0 ]; then
    sync
    echo 1 > /proc/sys/vm/drop_caches 2>/dev/null || true
    log "System caches cleared"
fi

# Clean up old backup files (handled by backup script, but double-check)
if [ -d "${BACKUP_DIR}" ]; then
    BACKUP_COUNT_BEFORE=$(find "${BACKUP_DIR}" -name "fdts_backup_*.tar.gz" | wc -l)
    find "${BACKUP_DIR}" -name "fdts_backup_*.tar.gz" -type f -mtime +30 -delete 2>/dev/null || true
    BACKUP_COUNT_AFTER=$(find "${BACKUP_DIR}" -name "fdts_backup_*.tar.gz" | wc -l)
    
    if [ "$BACKUP_COUNT_BEFORE" -ne "$BACKUP_COUNT_AFTER" ]; then
        REMOVED_BACKUPS=$((BACKUP_COUNT_BEFORE - BACKUP_COUNT_AFTER))
        log "Removed ${REMOVED_BACKUPS} old backup files"
    fi
fi

# Generate cleanup report
CLEANUP_REPORT="/tmp/cleanup_report_$(date +%Y%m%d_%H%M%S).txt"
cat > "${CLEANUP_REPORT}" << EOF
FDTS Cleanup Report
==================
Date: $(date)
Log Directory: ${LOG_DIR}
Upload Directory: ${UPLOAD_DIR}
Database Path: ${DATABASE_PATH}
Backup Directory: ${BACKUP_DIR}

Actions Performed:
- Log file rotation and cleanup
- Temporary file cleanup
- Orphaned file detection and quarantine
- Database optimization (VACUUM and ANALYZE)
- Database integrity check
- System cache cleanup
- Old backup cleanup

Current Status:
- Database Size: $(du -h "${DATABASE_PATH}" 2>/dev/null | cut -f1 || echo "N/A")
- Upload Directory Size: $(du -sh "${UPLOAD_DIR}" 2>/dev/null | cut -f1 || echo "N/A")
- Available Disk Space: $(df -h . | tail -1 | awk '{print $4}')
- Active Log Files: $(find "${LOG_DIR}" -name "*.log" -type f 2>/dev/null | wc -l)
- Backup Files: $(find "${BACKUP_DIR}" -name "fdts_backup_*.tar.gz" 2>/dev/null | wc -l)
EOF

log "Cleanup report generated: ${CLEANUP_REPORT}"

# Send cleanup report (if configured)
if [ -n "${CLEANUP_WEBHOOK_URL}" ]; then
    curl -X POST "${CLEANUP_WEBHOOK_URL}" \
         -H "Content-Type: application/json" \
         -d "{\"message\": \"FDTS cleanup completed\", \"report\": \"$(cat ${CLEANUP_REPORT} | base64 -w 0)\"}" \
         2>/dev/null || log "WARNING: Failed to send cleanup report"
fi

log "Cleanup process completed successfully"