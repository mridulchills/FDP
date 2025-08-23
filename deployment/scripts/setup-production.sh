#!/bin/bash

# Production environment setup script for FDTS
# This script prepares the production environment and deploys the application

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env.production"
DOCKER_COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        error "This script must be run as root for production setup"
        exit 1
    fi
}

# Check system requirements
check_requirements() {
    log "Checking system requirements..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check available disk space (minimum 10GB)
    AVAILABLE_SPACE=$(df / | tail -1 | awk '{print $4}')
    REQUIRED_SPACE=10485760  # 10GB in KB
    
    if [ "$AVAILABLE_SPACE" -lt "$REQUIRED_SPACE" ]; then
        error "Insufficient disk space. At least 10GB required."
        exit 1
    fi
    
    log "System requirements check passed"
}

# Generate SSL certificates
generate_ssl_certificates() {
    log "Generating SSL certificates..."
    
    SSL_DIR="${PROJECT_ROOT}/ssl"
    mkdir -p "${SSL_DIR}"
    
    if [ ! -f "${SSL_DIR}/cert.pem" ] || [ ! -f "${SSL_DIR}/key.pem" ]; then
        # Generate self-signed certificate for development/testing
        # In production, replace with proper SSL certificates
        openssl req -x509 -newkey rsa:4096 -keyout "${SSL_DIR}/key.pem" -out "${SSL_DIR}/cert.pem" \
                    -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
        
        chmod 600 "${SSL_DIR}/key.pem"
        chmod 644 "${SSL_DIR}/cert.pem"
        
        warn "Self-signed SSL certificate generated. Replace with proper certificates for production."
    else
        log "SSL certificates already exist"
    fi
}

# Create production environment file
create_env_file() {
    log "Creating production environment file..."
    
    if [ ! -f "${ENV_FILE}" ]; then
        # Generate secure random secrets
        JWT_SECRET=$(openssl rand -base64 64)
        JWT_REFRESH_SECRET=$(openssl rand -base64 64)
        GRAFANA_PASSWORD=$(openssl rand -base64 32)
        
        cat > "${ENV_FILE}" << EOF
# FDTS Production Environment Configuration
NODE_ENV=production
PORT=3001

# Database Configuration
DATABASE_PATH=/app/data/database.sqlite
UPLOAD_DIR=/app/uploads
LOG_DIR=/app/logs
BACKUP_DIR=/app/backups

# Security Configuration
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
BCRYPT_ROUNDS=12

# Backup Configuration
BACKUP_SCHEDULE=0 2 * * *
RETENTION_DAYS=30
CLEANUP_SCHEDULE=0 4 * * 0
LOG_RETENTION_DAYS=7
TEMP_RETENTION_HOURS=24

# Monitoring Configuration
GRAFANA_PASSWORD=${GRAFANA_PASSWORD}

# Optional: Webhook URLs for notifications
# BACKUP_WEBHOOK_URL=https://your-webhook-url
# RESTORE_WEBHOOK_URL=https://your-webhook-url
# CLEANUP_WEBHOOK_URL=https://your-webhook-url

# Optional: External backup location
# EXTERNAL_BACKUP_DIR=/external_backups
EOF
        
        chmod 600 "${ENV_FILE}"
        log "Production environment file created: ${ENV_FILE}"
        warn "Please review and update the environment variables as needed"
    else
        log "Production environment file already exists"
    fi
}

# Set up directories and permissions
setup_directories() {
    log "Setting up directories and permissions..."
    
    # Create data directories
    mkdir -p /opt/fdts/{data,uploads,logs,backups}
    
    # Set proper ownership (assuming docker user exists)
    if id "docker" &>/dev/null; then
        chown -R docker:docker /opt/fdts
    else
        warn "Docker user not found. Please set proper ownership for /opt/fdts"
    fi
    
    # Set proper permissions
    chmod 755 /opt/fdts
    chmod 755 /opt/fdts/{data,uploads,logs,backups}
    
    log "Directories created and permissions set"
}

# Configure firewall
configure_firewall() {
    log "Configuring firewall..."
    
    if command -v ufw &> /dev/null; then
        # Allow SSH
        ufw allow ssh
        
        # Allow HTTP and HTTPS
        ufw allow 80/tcp
        ufw allow 443/tcp
        
        # Allow monitoring (optional, restrict as needed)
        ufw allow 3000/tcp  # Grafana
        ufw allow 9090/tcp  # Prometheus
        
        # Enable firewall
        ufw --force enable
        
        log "Firewall configured"
    else
        warn "UFW not found. Please configure firewall manually"
    fi
}

# Set up log rotation
setup_log_rotation() {
    log "Setting up log rotation..."
    
    cat > /etc/logrotate.d/fdts << EOF
/opt/fdts/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 docker docker
    postrotate
        docker-compose -f ${DOCKER_COMPOSE_FILE} exec app kill -USR1 1 2>/dev/null || true
    endscript
}
EOF
    
    log "Log rotation configured"
}

# Create systemd service
create_systemd_service() {
    log "Creating systemd service..."
    
    cat > /etc/systemd/system/fdts.service << EOF
[Unit]
Description=Faculty Development Tracking System
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${PROJECT_ROOT}
ExecStart=/usr/bin/docker-compose -f ${DOCKER_COMPOSE_FILE} up -d
ExecStop=/usr/bin/docker-compose -f ${DOCKER_COMPOSE_FILE} down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable fdts.service
    
    log "Systemd service created and enabled"
}

# Build and start services
deploy_application() {
    log "Building and deploying application..."
    
    cd "${PROJECT_ROOT}"
    
    # Load environment variables
    set -a
    source "${ENV_FILE}"
    set +a
    
    # Build images
    docker-compose build --no-cache
    
    # Start services
    docker-compose up -d
    
    # Wait for services to be ready
    log "Waiting for services to start..."
    sleep 30
    
    # Check service health
    if docker-compose ps | grep -q "Up"; then
        log "Services started successfully"
    else
        error "Some services failed to start"
        docker-compose logs
        exit 1
    fi
}

# Run initial database migration
run_initial_migration() {
    log "Running initial database migration..."
    
    # Wait for database to be ready
    sleep 10
    
    # Run migration
    docker-compose exec app node backend/scripts/migrate.js
    
    log "Initial migration completed"
}

# Create initial admin user
create_admin_user() {
    log "Creating initial admin user..."
    
    # This should be customized based on your user creation script
    docker-compose exec app node backend/scripts/create-admin-user.js
    
    log "Initial admin user created"
}

# Display deployment information
show_deployment_info() {
    log "Deployment completed successfully!"
    echo
    echo "=== FDTS Production Deployment Information ==="
    echo "Application URL: https://$(hostname -I | awk '{print $1}')"
    echo "Grafana Dashboard: http://$(hostname -I | awk '{print $1}'):3000"
    echo "Prometheus: http://$(hostname -I | awk '{print $1}'):9090"
    echo
    echo "Environment file: ${ENV_FILE}"
    echo "Data directory: /opt/fdts"
    echo "Docker Compose file: ${DOCKER_COMPOSE_FILE}"
    echo
    echo "=== Important Notes ==="
    echo "1. Review and update SSL certificates for production use"
    echo "2. Configure proper backup storage location"
    echo "3. Set up monitoring alerts and notifications"
    echo "4. Review firewall settings and security configurations"
    echo "5. Test backup and restore procedures"
    echo
    echo "=== Management Commands ==="
    echo "Start services: systemctl start fdts"
    echo "Stop services: systemctl stop fdts"
    echo "View logs: docker-compose logs -f"
    echo "Backup: docker-compose exec backup /app/scripts/backup.sh"
    echo
}

# Main execution
main() {
    log "Starting FDTS production deployment..."
    
    check_root
    check_requirements
    generate_ssl_certificates
    create_env_file
    setup_directories
    configure_firewall
    setup_log_rotation
    create_systemd_service
    deploy_application
    run_initial_migration
    create_admin_user
    show_deployment_info
    
    log "Production deployment completed successfully!"
}

# Run main function
main "$@"