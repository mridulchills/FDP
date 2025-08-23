#!/bin/bash

# Make all deployment scripts executable
# Run this script on Unix/Linux systems to set proper permissions

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Making deployment scripts executable..."

chmod +x "${SCRIPT_DIR}/scripts/backup.sh"
chmod +x "${SCRIPT_DIR}/scripts/restore.sh"
chmod +x "${SCRIPT_DIR}/scripts/cleanup.sh"
chmod +x "${SCRIPT_DIR}/scripts/backup-daemon.sh"
chmod +x "${SCRIPT_DIR}/scripts/setup-production.sh"
chmod +x "${SCRIPT_DIR}/scripts/validate-production.sh"
chmod +x "${SCRIPT_DIR}/make-scripts-executable.sh"

echo "All scripts are now executable."
echo "You can now run the production setup:"
echo "  sudo ./deployment/scripts/setup-production.sh"