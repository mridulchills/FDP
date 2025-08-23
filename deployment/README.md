# FDTS Production Deployment Guide

This guide provides comprehensive instructions for deploying the Faculty Development Tracking System (FDTS) in a production environment using Docker containers.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Manual Deployment](#manual-deployment)
4. [Configuration](#configuration)
5. [Backup and Recovery](#backup-and-recovery)
6. [Monitoring](#monitoring)
7. [Maintenance](#maintenance)
8. [Troubleshooting](#troubleshooting)
9. [Security Considerations](#security-considerations)

## Prerequisites

### System Requirements

- **Operating System**: Ubuntu 20.04 LTS or later, CentOS 8+, or similar Linux distribution
- **CPU**: Minimum 2 cores, recommended 4+ cores
- **Memory**: Minimum 4GB RAM, recommended 8GB+ RAM
- **Storage**: Minimum 50GB free space, recommended 100GB+ for production
- **Network**: Static IP address and domain name (recommended)

### Software Requirements

- Docker 20.10+
- Docker Compose 1.29+
- OpenSSL (for SSL certificate generation)
- UFW or similar firewall (recommended)

### Installation Commands

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y docker.io docker-compose openssl ufw

# CentOS/RHEL
sudo yum install -y docker docker-compose openssl firewalld

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker
```

## Quick Start

For a rapid production deployment, use the automated setup script:

```bash
# Clone the repository
git clone <repository-url>
cd fdts

# Make setup script executable
chmod +x deployment/scripts/setup-production.sh

# Run automated setup (requires root)
sudo ./deployment/scripts/setup-production.sh
```

The automated setup will:
- Check system requirements
- Generate SSL certificates
- Create environment configuration
- Set up directories and permissions
- Configure firewall
- Deploy the application
- Create systemd service
- Run initial database migration

## Manual Deployment

### Step 1: Environment Configuration

Create a production environment file:

```bash
cp .env.example .env.production
```

Edit `.env.production` with your production settings:

```bash
# Required: Generate secure secrets
JWT_SECRET=$(openssl rand -base64 64)
JWT_REFRESH_SECRET=$(openssl rand -base64 64)

# Database and file paths
DATABASE_PATH=/app/data/database.sqlite
UPLOAD_DIR=/app/uploads
LOG_DIR=/app/logs
BACKUP_DIR=/app/backups

# Security settings
BCRYPT_ROUNDS=12

# Backup configuration
BACKUP_SCHEDULE="0 2 * * *"  # Daily at 2 AM
RETENTION_DAYS=30
```

### Step 2: SSL Certificates

Generate SSL certificates (replace with proper certificates for production):

```bash
mkdir -p ssl
openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem \
        -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=yourdomain.com"
```

### Step 3: Build and Deploy

```bash
# Load environment variables
source .env.production

# Build the application
docker-compose build

# Start services
docker-compose up -d

# Check service status
docker-compose ps
```

### Step 4: Initialize Database

```bash
# Run database migrations
docker-compose exec app node backend/scripts/migrate.js

# Create initial admin user
docker-compose exec app node backend/scripts/create-admin-user.js
```

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | `production` | Yes |
| `PORT` | Application port | `3001` | Yes |
| `DATABASE_PATH` | SQLite database path | `/app/data/database.sqlite` | Yes |
| `JWT_SECRET` | JWT signing secret | - | Yes |
| `JWT_REFRESH_SECRET` | JWT refresh secret | - | Yes |
| `BCRYPT_ROUNDS` | Password hashing rounds | `12` | No |
| `BACKUP_SCHEDULE` | Cron schedule for backups | `0 2 * * *` | No |
| `RETENTION_DAYS` | Backup retention period | `30` | No |

### Docker Compose Services

The deployment includes the following services:

- **app**: Main FDTS application
- **nginx**: Reverse proxy and static file server
- **backup**: Automated backup service
- **monitoring**: Prometheus metrics collection
- **grafana**: Monitoring dashboard

### Volume Mounts

- `app_data`: Database and application data
- `app_uploads`: User uploaded files
- `app_logs`: Application logs
- `app_backups`: Backup files
- `prometheus_data`: Prometheus metrics data
- `grafana_data`: Grafana configuration and dashboards

## Backup and Recovery

### Automated Backups

Backups are automatically created according to the `BACKUP_SCHEDULE` environment variable. The backup service:

- Creates compressed archives of database and files
- Verifies backup integrity
- Maintains retention policy
- Supports external backup storage

### Manual Backup

```bash
# Create immediate backup
docker-compose exec backup /app/scripts/backup.sh

# List available backups
docker-compose exec backup ls -la /app/backups/

# Copy backup to external location
docker cp $(docker-compose ps -q backup):/app/backups/fdts_backup_YYYYMMDD_HHMMSS.tar.gz ./
```

### Restore from Backup

```bash
# Copy backup file to container
docker cp backup_file.tar.gz $(docker-compose ps -q backup):/app/backups/

# Stop application
docker-compose stop app

# Restore from backup
docker-compose exec backup /app/scripts/restore.sh /app/backups/backup_file.tar.gz --force

# Start application
docker-compose start app
```

### Backup Verification

```bash
# Test backup integrity
docker-compose exec backup tar -tzf /app/backups/fdts_backup_YYYYMMDD_HHMMSS.tar.gz

# Verify database integrity
docker-compose exec app sqlite3 /app/data/database.sqlite "PRAGMA integrity_check;"
```

## Monitoring

### Prometheus Metrics

The application exposes metrics at `/api/metrics`:

- HTTP request metrics
- Database operation metrics
- Authentication metrics
- File operation metrics
- System resource metrics

### Grafana Dashboard

Access Grafana at `http://your-server:3000`:

- Default username: `admin`
- Password: Set in `GRAFANA_PASSWORD` environment variable

### Health Checks

```bash
# Application health
curl -f http://localhost:3001/api/health

# Service status
docker-compose ps

# View logs
docker-compose logs -f app
```

### Alerts

Configure alerts in `monitoring/alert_rules.yml`:

- Application downtime
- High error rates
- Database issues
- Resource usage
- Backup failures

## Maintenance

### Regular Maintenance Tasks

1. **Log Rotation**: Automated via logrotate configuration
2. **Database Optimization**: Run `VACUUM` and `ANALYZE` weekly
3. **File Cleanup**: Remove orphaned files and temporary data
4. **Security Updates**: Keep Docker images and host system updated

### Maintenance Commands

```bash
# Update application
git pull
docker-compose build --no-cache
docker-compose up -d

# Database maintenance
docker-compose exec app sqlite3 /app/data/database.sqlite "VACUUM; ANALYZE;"

# Clean up system
docker system prune -f
docker volume prune -f

# View resource usage
docker stats
```

### Scheduled Maintenance

The cleanup script runs automatically according to `CLEANUP_SCHEDULE`:

```bash
# Manual cleanup
docker-compose exec backup /app/scripts/cleanup.sh
```

## Troubleshooting

### Common Issues

#### Application Won't Start

```bash
# Check logs
docker-compose logs app

# Check database permissions
docker-compose exec app ls -la /app/data/

# Verify environment variables
docker-compose exec app env | grep -E "(JWT|DATABASE|NODE_ENV)"
```

#### Database Connection Issues

```bash
# Check database file
docker-compose exec app sqlite3 /app/data/database.sqlite ".tables"

# Verify database integrity
docker-compose exec app sqlite3 /app/data/database.sqlite "PRAGMA integrity_check;"

# Check file permissions
docker-compose exec app ls -la /app/data/database.sqlite
```

#### File Upload Issues

```bash
# Check upload directory
docker-compose exec app ls -la /app/uploads/

# Verify disk space
docker-compose exec app df -h

# Check nginx configuration
docker-compose exec nginx nginx -t
```

#### SSL Certificate Issues

```bash
# Check certificate validity
openssl x509 -in ssl/cert.pem -text -noout

# Verify certificate and key match
openssl x509 -noout -modulus -in ssl/cert.pem | openssl md5
openssl rsa -noout -modulus -in ssl/key.pem | openssl md5
```

### Performance Issues

```bash
# Monitor resource usage
docker stats

# Check database performance
docker-compose exec app sqlite3 /app/data/database.sqlite ".timer on" ".explain query plan SELECT * FROM users;"

# Analyze slow queries
docker-compose logs app | grep "slow query"
```

### Log Analysis

```bash
# Application logs
docker-compose logs -f app

# Nginx access logs
docker-compose exec nginx tail -f /var/log/nginx/access.log

# System logs
journalctl -u fdts.service -f
```

## Security Considerations

### SSL/TLS Configuration

- Use proper SSL certificates from a trusted CA
- Configure strong cipher suites
- Enable HSTS headers
- Regular certificate renewal

### Database Security

- Regular backups with encryption
- Database file permissions (600)
- Connection encryption
- Query parameterization

### Application Security

- Strong JWT secrets (64+ characters)
- Secure password hashing (bcrypt rounds ≥ 12)
- Input validation and sanitization
- Rate limiting on sensitive endpoints

### Network Security

- Firewall configuration
- VPN access for administration
- Regular security updates
- Intrusion detection system

### Access Control

- Principle of least privilege
- Regular access reviews
- Strong authentication policies
- Audit logging

### Backup Security

- Encrypted backup storage
- Secure backup transmission
- Access control for backup files
- Regular restore testing

## Support and Maintenance

### Regular Tasks Checklist

- [ ] Weekly: Review monitoring alerts and logs
- [ ] Weekly: Check backup integrity and test restore
- [ ] Monthly: Update Docker images and security patches
- [ ] Monthly: Review user access and permissions
- [ ] Quarterly: Performance optimization and capacity planning
- [ ] Quarterly: Security audit and vulnerability assessment

### Emergency Procedures

1. **Application Outage**: Check service status, review logs, restart services
2. **Data Corruption**: Stop application, restore from backup, verify integrity
3. **Security Incident**: Isolate system, review logs, update credentials
4. **Disk Space Full**: Clean up logs and temporary files, expand storage

### Contact Information

- System Administrator: [contact-info]
- Database Administrator: [contact-info]
- Security Team: [contact-info]
- Vendor Support: [contact-info]