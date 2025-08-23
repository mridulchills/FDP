#!/bin/bash

# Production environment validation script for FDTS
# This script validates the production deployment and configuration

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env.production"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
WARNINGS=0

# Logging functions
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
    ((WARNINGS++))
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    ((TESTS_FAILED++))
}

success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] PASS: $1${NC}"
    ((TESTS_PASSED++))
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Test functions
test_docker_installation() {
    info "Testing Docker installation..."
    
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
        success "Docker installed: $DOCKER_VERSION"
    else
        error "Docker is not installed"
        return 1
    fi
    
    if command -v docker-compose &> /dev/null; then
        COMPOSE_VERSION=$(docker-compose --version | cut -d' ' -f3 | cut -d',' -f1)
        success "Docker Compose installed: $COMPOSE_VERSION"
    else
        error "Docker Compose is not installed"
        return 1
    fi
    
    # Test Docker daemon
    if docker info &> /dev/null; then
        success "Docker daemon is running"
    else
        error "Docker daemon is not running"
        return 1
    fi
}

test_environment_configuration() {
    info "Testing environment configuration..."
    
    if [ -f "$ENV_FILE" ]; then
        success "Environment file exists: $ENV_FILE"
    else
        error "Environment file not found: $ENV_FILE"
        return 1
    fi
    
    # Load environment variables
    source "$ENV_FILE"
    
    # Test required variables
    local required_vars=("JWT_SECRET" "JWT_REFRESH_SECRET" "DATABASE_PATH" "NODE_ENV")
    
    for var in "${required_vars[@]}"; do
        if [ -n "${!var}" ]; then
            success "Environment variable set: $var"
        else
            error "Required environment variable not set: $var"
        fi
    done
    
    # Test JWT secret strength
    if [ ${#JWT_SECRET} -ge 32 ]; then
        success "JWT secret has adequate length"
    else
        warn "JWT secret should be at least 32 characters long"
    fi
    
    if [ ${#JWT_REFRESH_SECRET} -ge 32 ]; then
        success "JWT refresh secret has adequate length"
    else
        warn "JWT refresh secret should be at least 32 characters long"
    fi
}

test_ssl_certificates() {
    info "Testing SSL certificates..."
    
    local ssl_dir="${PROJECT_ROOT}/ssl"
    
    if [ -f "$ssl_dir/cert.pem" ] && [ -f "$ssl_dir/key.pem" ]; then
        success "SSL certificate files exist"
        
        # Test certificate validity
        if openssl x509 -in "$ssl_dir/cert.pem" -noout -checkend 86400 &> /dev/null; then
            success "SSL certificate is valid and not expiring within 24 hours"
        else
            warn "SSL certificate is expiring soon or invalid"
        fi
        
        # Test certificate and key match
        cert_modulus=$(openssl x509 -noout -modulus -in "$ssl_dir/cert.pem" | openssl md5)
        key_modulus=$(openssl rsa -noout -modulus -in "$ssl_dir/key.pem" | openssl md5)
        
        if [ "$cert_modulus" = "$key_modulus" ]; then
            success "SSL certificate and key match"
        else
            error "SSL certificate and key do not match"
        fi
    else
        error "SSL certificate files not found in $ssl_dir"
    fi
}

test_docker_services() {
    info "Testing Docker services..."
    
    cd "$PROJECT_ROOT"
    
    # Check if services are running
    if docker-compose ps | grep -q "Up"; then
        success "Docker services are running"
        
        # Test individual services
        local services=("app" "nginx" "backup" "monitoring" "grafana")
        
        for service in "${services[@]}"; do
            if docker-compose ps "$service" | grep -q "Up"; then
                success "Service running: $service"
            else
                warn "Service not running: $service"
            fi
        done
    else
        error "Docker services are not running"
        return 1
    fi
}

test_application_health() {
    info "Testing application health..."
    
    # Wait for services to be ready
    sleep 10
    
    # Test health endpoint
    if curl -f -s http://localhost:3001/api/health > /dev/null; then
        success "Application health endpoint responding"
        
        # Get health details
        health_response=$(curl -s http://localhost:3001/api/health)
        info "Health response: $health_response"
    else
        error "Application health endpoint not responding"
        return 1
    fi
    
    # Test database connectivity
    if docker-compose exec -T app sqlite3 /app/data/database.sqlite "SELECT 1;" &> /dev/null; then
        success "Database connectivity test passed"
    else
        error "Database connectivity test failed"
    fi
}

test_nginx_configuration() {
    info "Testing Nginx configuration..."
    
    # Test Nginx configuration syntax
    if docker-compose exec -T nginx nginx -t &> /dev/null; then
        success "Nginx configuration syntax is valid"
    else
        error "Nginx configuration syntax error"
        docker-compose exec nginx nginx -t
        return 1
    fi
    
    # Test HTTP to HTTPS redirect
    if curl -s -o /dev/null -w "%{http_code}" http://localhost | grep -q "301"; then
        success "HTTP to HTTPS redirect working"
    else
        warn "HTTP to HTTPS redirect not working"
    fi
    
    # Test HTTPS endpoint (if SSL is properly configured)
    if curl -k -f -s https://localhost/health > /dev/null 2>&1; then
        success "HTTPS endpoint responding"
    else
        warn "HTTPS endpoint not responding (may be expected with self-signed certificates)"
    fi
}

test_backup_system() {
    info "Testing backup system..."
    
    # Test backup script execution
    if docker-compose exec -T backup /app/scripts/backup.sh > /dev/null 2>&1; then
        success "Backup script executed successfully"
        
        # Check if backup file was created
        if docker-compose exec -T backup ls /app/backups/fdts_backup_*.tar.gz > /dev/null 2>&1; then
            success "Backup file created"
        else
            error "Backup file not created"
        fi
    else
        error "Backup script execution failed"
    fi
    
    # Test backup integrity
    latest_backup=$(docker-compose exec -T backup ls -t /app/backups/fdts_backup_*.tar.gz | head -1 | tr -d '\r')
    if [ -n "$latest_backup" ]; then
        if docker-compose exec -T backup tar -tzf "$latest_backup" > /dev/null 2>&1; then
            success "Backup file integrity verified"
        else
            error "Backup file integrity check failed"
        fi
    fi
}

test_monitoring_system() {
    info "Testing monitoring system..."
    
    # Test Prometheus
    if curl -f -s http://localhost:9090/-/healthy > /dev/null; then
        success "Prometheus is healthy"
    else
        warn "Prometheus health check failed"
    fi
    
    # Test Grafana
    if curl -f -s http://localhost:3000/api/health > /dev/null; then
        success "Grafana is healthy"
    else
        warn "Grafana health check failed"
    fi
    
    # Test metrics endpoint
    if curl -f -s http://localhost:3001/api/metrics > /dev/null; then
        success "Application metrics endpoint responding"
    else
        warn "Application metrics endpoint not responding"
    fi
}

test_file_permissions() {
    info "Testing file permissions..."
    
    # Test database file permissions
    db_perms=$(docker-compose exec -T app stat -c "%a" /app/data/database.sqlite 2>/dev/null || echo "000")
    if [ "$db_perms" = "644" ] || [ "$db_perms" = "664" ]; then
        success "Database file permissions are correct: $db_perms"
    else
        warn "Database file permissions may be incorrect: $db_perms"
    fi
    
    # Test upload directory permissions
    upload_perms=$(docker-compose exec -T app stat -c "%a" /app/uploads 2>/dev/null || echo "000")
    if [ "$upload_perms" = "755" ] || [ "$upload_perms" = "775" ]; then
        success "Upload directory permissions are correct: $upload_perms"
    else
        warn "Upload directory permissions may be incorrect: $upload_perms"
    fi
}

test_security_configuration() {
    info "Testing security configuration..."
    
    # Test firewall status (if UFW is available)
    if command -v ufw &> /dev/null; then
        if ufw status | grep -q "Status: active"; then
            success "Firewall is active"
        else
            warn "Firewall is not active"
        fi
    else
        info "UFW not available, skipping firewall check"
    fi
    
    # Test security headers
    security_headers=$(curl -s -I https://localhost 2>/dev/null | grep -i "x-frame-options\|x-content-type-options\|strict-transport-security" | wc -l)
    if [ "$security_headers" -ge 2 ]; then
        success "Security headers are configured"
    else
        warn "Security headers may not be properly configured"
    fi
}

test_disk_space() {
    info "Testing disk space..."
    
    # Check available disk space
    available_space=$(df / | tail -1 | awk '{print $4}')
    available_gb=$((available_space / 1024 / 1024))
    
    if [ "$available_gb" -gt 10 ]; then
        success "Sufficient disk space available: ${available_gb}GB"
    elif [ "$available_gb" -gt 5 ]; then
        warn "Low disk space: ${available_gb}GB available"
    else
        error "Critical disk space: ${available_gb}GB available"
    fi
    
    # Check Docker disk usage
    docker_usage=$(docker system df --format "table {{.Type}}\t{{.TotalCount}}\t{{.Size}}" | tail -n +2)
    info "Docker disk usage:"
    echo "$docker_usage"
}

test_log_configuration() {
    info "Testing log configuration..."
    
    # Check if log files exist and are writable
    if docker-compose exec -T app test -w /app/logs; then
        success "Log directory is writable"
    else
        error "Log directory is not writable"
    fi
    
    # Check log rotation configuration
    if [ -f "/etc/logrotate.d/fdts" ]; then
        success "Log rotation is configured"
    else
        warn "Log rotation is not configured"
    fi
    
    # Check recent log entries
    recent_logs=$(docker-compose logs --since "1h" app 2>/dev/null | wc -l)
    if [ "$recent_logs" -gt 0 ]; then
        success "Application is generating logs: $recent_logs entries in last hour"
    else
        warn "No recent log entries found"
    fi
}

# Main execution
main() {
    log "Starting FDTS production environment validation..."
    echo
    
    # Run all tests
    test_docker_installation
    test_environment_configuration
    test_ssl_certificates
    test_docker_services
    test_application_health
    test_nginx_configuration
    test_backup_system
    test_monitoring_system
    test_file_permissions
    test_security_configuration
    test_disk_space
    test_log_configuration
    
    # Summary
    echo
    log "=== Validation Summary ==="
    echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
    echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
    echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
    echo
    
    if [ "$TESTS_FAILED" -eq 0 ]; then
        if [ "$WARNINGS" -eq 0 ]; then
            log "✅ All validation tests passed! Production environment is ready."
            exit 0
        else
            warn "⚠️  Validation completed with warnings. Review warnings before proceeding."
            exit 0
        fi
    else
        error "❌ Validation failed. Please fix the errors before deploying to production."
        exit 1
    fi
}

# Run main function
main "$@"