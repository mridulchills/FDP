# FDTS Production Runbook

This runbook provides step-by-step procedures for common operational tasks in the FDTS production environment.

## Table of Contents

1. [Emergency Procedures](#emergency-procedures)
2. [Routine Operations](#routine-operations)
3. [Backup and Recovery](#backup-and-recovery)
4. [Monitoring and Alerting](#monitoring-and-alerting)
5. [Troubleshooting](#troubleshooting)
6. [Maintenance Procedures](#maintenance-procedures)

## Emergency Procedures

### Application Down - Critical

**Symptoms**: Application not responding, health checks failing, users cannot access system

**Immediate Actions**:

1. **Check service status**:
   ```bash
   docker-compose ps
   systemctl status fdts
   ```

2. **Review recent logs**:
   ```bash
   docker-compose logs --tail=100 app
   journalctl -u fdts.service --since "10 minutes ago"
   ```

3. **Restart services**:
   ```bash
   docker-compose restart app
   # If that fails:
   docker-compose down && docker-compose up -d
   ```

4. **Verify recovery**:
   ```bash
   curl -f http://localhost:3001/api/health
   docker-compose ps
   ```

**Escalation**: If restart doesn't resolve, proceed to database integrity check.

### Database Corruption - Critical

**Symptoms**: Database errors in logs, integrity check failures, data inconsistencies

**Immediate Actions**:

1. **Stop application immediately**:
   ```bash
   docker-compose stop app
   ```

2. **Check database integrity**:
   ```bash
   docker-compose exec app sqlite3 /app/data/database.sqlite "PRAGMA integrity_check;"
   ```

3. **If corruption confirmed, restore from backup**:
   ```bash
   # Find latest backup
   docker-compose exec backup ls -la /app/backups/ | tail -5
   
   # Restore (replace with actual backup filename)
   docker-compose exec backup /app/scripts/restore.sh /app/backups/fdts_backup_YYYYMMDD_HHMMSS.tar.gz --force
   ```

4. **Verify restoration and restart**:
   ```bash
   docker-compose exec app sqlite3 /app/data/database.sqlite "PRAGMA integrity_check;"
   docker-compose start app
   ```

### Security Incident - Critical

**Symptoms**: Unusual login patterns, unauthorized access, suspicious file modifications

**Immediate Actions**:

1. **Isolate the system**:
   ```bash
   # Block external access
   ufw deny 80
   ufw deny 443
   ```

2. **Preserve evidence**:
   ```bash
   # Copy logs
   docker-compose logs app > /tmp/incident_logs_$(date +%Y%m%d_%H%M%S).txt
   
   # Copy audit logs
   docker-compose exec app sqlite3 /app/data/database.sqlite "SELECT * FROM audit_logs WHERE timestamp > datetime('now', '-1 hour');" > /tmp/audit_$(date +%Y%m%d_%H%M%S).txt
   ```

3. **Change all credentials**:
   ```bash
   # Generate new JWT secrets
   NEW_JWT_SECRET=$(openssl rand -base64 64)
   NEW_JWT_REFRESH_SECRET=$(openssl rand -base64 64)
   
   # Update environment file
   sed -i "s/JWT_SECRET=.*/JWT_SECRET=${NEW_JWT_SECRET}/" .env.production
   sed -i "s/JWT_REFRESH_SECRET=.*/JWT_REFRESH_SECRET=${NEW_JWT_REFRESH_SECRET}/" .env.production
   ```

4. **Restart with new credentials**:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

5. **Re-enable access after verification**:
   ```bash
   ufw allow 80
   ufw allow 443
   ```

## Routine Operations

### Daily Health Check

**Schedule**: Every morning at 9 AM

**Procedure**:

1. **Check service status**:
   ```bash
   docker-compose ps
   systemctl status fdts
   ```

2. **Verify application health**:
   ```bash
   curl -f http://localhost:3001/api/health
   ```

3. **Check disk space**:
   ```bash
   df -h
   docker system df
   ```

4. **Review overnight logs**:
   ```bash
   docker-compose logs --since "24h" app | grep -i error
   ```

5. **Check backup status**:
   ```bash
   docker-compose exec backup ls -la /app/backups/ | tail -3
   ```

**Expected Results**:
- All services showing "Up" status
- Health endpoint returns 200 OK
- Disk usage below 80%
- No critical errors in logs
- Recent backup file exists

### Weekly Maintenance

**Schedule**: Every Sunday at 2 AM

**Procedure**:

1. **Update system packages**:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Clean up Docker resources**:
   ```bash
   docker system prune -f
   docker volume prune -f
   ```

3. **Database optimization**:
   ```bash
   docker-compose exec app sqlite3 /app/data/database.sqlite "VACUUM; ANALYZE;"
   ```

4. **Log rotation**:
   ```bash
   logrotate -f /etc/logrotate.d/fdts
   ```

5. **Security scan**:
   ```bash
   # Check for security updates
   sudo apt list --upgradable | grep -i security
   
   # Scan for vulnerabilities
   docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
     -v $(pwd):/tmp aquasec/trivy image fdts_app:latest
   ```

## Backup and Recovery

### Manual Backup Creation

**When**: Before major updates, configuration changes, or on-demand

**Procedure**:

1. **Create backup**:
   ```bash
   docker-compose exec backup /app/scripts/backup.sh
   ```

2. **Verify backup**:
   ```bash
   # Check backup file
   LATEST_BACKUP=$(docker-compose exec backup ls -t /app/backups/fdts_backup_*.tar.gz | head -1)
   docker-compose exec backup tar -tzf "$LATEST_BACKUP" | head -10
   ```

3. **Copy to external storage**:
   ```bash
   docker cp $(docker-compose ps -q backup):/app/backups/$LATEST_BACKUP ./backups/
   ```

### Backup Verification

**Schedule**: Weekly

**Procedure**:

1. **List recent backups**:
   ```bash
   docker-compose exec backup ls -la /app/backups/ | tail -10
   ```

2. **Test backup integrity**:
   ```bash
   BACKUP_FILE="fdts_backup_YYYYMMDD_HHMMSS.tar.gz"  # Replace with actual filename
   docker-compose exec backup tar -tzf /app/backups/$BACKUP_FILE > /dev/null
   echo "Backup integrity: $?"  # Should be 0
   ```

3. **Test database extraction**:
   ```bash
   # Extract to temporary location
   docker-compose exec backup mkdir -p /tmp/backup_test
   docker-compose exec backup tar -xzf /app/backups/$BACKUP_FILE -C /tmp/backup_test
   
   # Verify database
   docker-compose exec backup sqlite3 /tmp/backup_test/database.sqlite "PRAGMA integrity_check;"
   
   # Cleanup
   docker-compose exec backup rm -rf /tmp/backup_test
   ```

### Disaster Recovery

**Scenario**: Complete system failure, need to restore on new hardware

**Procedure**:

1. **Prepare new environment**:
   ```bash
   # Install Docker and Docker Compose
   # Clone repository
   # Copy SSL certificates
   # Copy environment configuration
   ```

2. **Restore data**:
   ```bash
   # Copy backup file to new system
   # Extract backup
   tar -xzf fdts_backup_YYYYMMDD_HHMMSS.tar.gz
   
   # Place database file
   mkdir -p /opt/fdts/data
   cp database.sqlite /opt/fdts/data/
   
   # Restore uploads
   mkdir -p /opt/fdts/uploads
   tar -xzf uploads.tar.gz -C /opt/fdts/uploads/
   ```

3. **Deploy application**:
   ```bash
   docker-compose up -d
   ```

4. **Verify restoration**:
   ```bash
   curl -f http://localhost:3001/api/health
   # Test login functionality
   # Verify data integrity
   ```

## Monitoring and Alerting

### Alert Response Procedures

#### High Error Rate Alert

**Threshold**: >10% error rate for 5 minutes

**Response**:

1. **Check application logs**:
   ```bash
   docker-compose logs --tail=100 app | grep -i error
   ```

2. **Check database connectivity**:
   ```bash
   docker-compose exec app sqlite3 /app/data/database.sqlite "SELECT 1;"
   ```

3. **Check resource usage**:
   ```bash
   docker stats --no-stream
   ```

4. **If database issues, restart application**:
   ```bash
   docker-compose restart app
   ```

#### High Memory Usage Alert

**Threshold**: >90% memory usage for 5 minutes

**Response**:

1. **Check memory usage by container**:
   ```bash
   docker stats --no-stream
   ```

2. **Check for memory leaks**:
   ```bash
   docker-compose logs app | grep -i "memory\|heap\|oom"
   ```

3. **Restart high-memory containers**:
   ```bash
   docker-compose restart app
   ```

4. **If persistent, scale resources**:
   ```bash
   # Update docker-compose.yml with memory limits
   # Restart services
   ```

#### Backup Failure Alert

**Threshold**: No successful backup in 48 hours

**Response**:

1. **Check backup service status**:
   ```bash
   docker-compose ps backup
   docker-compose logs backup
   ```

2. **Check disk space**:
   ```bash
   df -h
   ```

3. **Manual backup attempt**:
   ```bash
   docker-compose exec backup /app/scripts/backup.sh
   ```

4. **If manual backup fails, investigate logs**:
   ```bash
   docker-compose logs backup | tail -50
   ```

### Performance Monitoring

#### Database Performance Check

**Schedule**: Daily

**Procedure**:

1. **Check query performance**:
   ```bash
   # Enable query timing
   docker-compose exec app sqlite3 /app/data/database.sqlite ".timer on" "SELECT COUNT(*) FROM users;"
   ```

2. **Check database size**:
   ```bash
   docker-compose exec app ls -lh /app/data/database.sqlite
   ```

3. **Check slow queries** (if logging enabled):
   ```bash
   docker-compose logs app | grep "slow query" | tail -10
   ```

#### Application Performance Check

**Schedule**: Hourly

**Procedure**:

1. **Check response times**:
   ```bash
   curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3001/api/health
   ```

2. **Check active connections**:
   ```bash
   netstat -an | grep :3001 | wc -l
   ```

3. **Check resource usage**:
   ```bash
   docker stats --no-stream app
   ```

## Troubleshooting

### Common Issues and Solutions

#### Issue: Application Slow Response

**Symptoms**: High response times, timeouts

**Diagnosis**:
```bash
# Check CPU and memory usage
docker stats --no-stream

# Check database locks
docker-compose exec app sqlite3 /app/data/database.sqlite "PRAGMA busy_timeout; PRAGMA journal_mode;"

# Check disk I/O
iostat -x 1 5
```

**Solutions**:
1. Restart application: `docker-compose restart app`
2. Optimize database: `docker-compose exec app sqlite3 /app/data/database.sqlite "VACUUM; ANALYZE;"`
3. Check for long-running queries
4. Scale resources if needed

#### Issue: File Upload Failures

**Symptoms**: Upload errors, file not found errors

**Diagnosis**:
```bash
# Check upload directory
docker-compose exec app ls -la /app/uploads/

# Check disk space
df -h

# Check nginx configuration
docker-compose exec nginx nginx -t

# Check file permissions
docker-compose exec app find /app/uploads -type f -not -perm 644
```

**Solutions**:
1. Fix permissions: `docker-compose exec app chmod -R 644 /app/uploads`
2. Clean up disk space
3. Restart nginx: `docker-compose restart nginx`

#### Issue: Authentication Failures

**Symptoms**: Login failures, token errors

**Diagnosis**:
```bash
# Check JWT configuration
docker-compose exec app env | grep JWT

# Check authentication logs
docker-compose logs app | grep -i "auth\|jwt\|login"

# Check database user table
docker-compose exec app sqlite3 /app/data/database.sqlite "SELECT COUNT(*) FROM users;"
```

**Solutions**:
1. Verify JWT secrets are set
2. Check user credentials in database
3. Clear browser cache/cookies
4. Restart application

## Maintenance Procedures

### Planned Maintenance Window

**Schedule**: Monthly, first Sunday 2-4 AM

**Pre-maintenance Checklist**:
- [ ] Notify users of maintenance window
- [ ] Create full system backup
- [ ] Prepare rollback plan
- [ ] Test procedures in staging environment

**Maintenance Steps**:

1. **Create maintenance backup**:
   ```bash
   docker-compose exec backup /app/scripts/backup.sh
   ```

2. **Stop application**:
   ```bash
   docker-compose stop app nginx
   ```

3. **Update system packages**:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

4. **Update Docker images**:
   ```bash
   docker-compose pull
   docker-compose build --no-cache
   ```

5. **Database maintenance**:
   ```bash
   docker-compose exec app sqlite3 /app/data/database.sqlite "VACUUM; ANALYZE; PRAGMA integrity_check;"
   ```

6. **Start services**:
   ```bash
   docker-compose up -d
   ```

7. **Verify functionality**:
   ```bash
   curl -f http://localhost:3001/api/health
   # Test login functionality
   # Verify file uploads
   ```

**Post-maintenance Checklist**:
- [ ] Verify all services running
- [ ] Test critical functionality
- [ ] Monitor for errors
- [ ] Update documentation
- [ ] Notify users of completion

### Emergency Maintenance

**When**: Critical security updates, urgent bug fixes

**Procedure**:

1. **Assess urgency and impact**
2. **Create emergency backup**
3. **Apply minimal necessary changes**
4. **Test critical functionality**
5. **Monitor closely for issues**
6. **Document changes made**

### Rollback Procedures

**When**: Maintenance causes issues, need to revert changes

**Procedure**:

1. **Stop current services**:
   ```bash
   docker-compose down
   ```

2. **Restore from pre-maintenance backup**:
   ```bash
   docker-compose exec backup /app/scripts/restore.sh /app/backups/pre_maintenance_backup.tar.gz --force
   ```

3. **Revert to previous Docker images**:
   ```bash
   # Use specific image tags
   docker-compose up -d
   ```

4. **Verify rollback success**:
   ```bash
   curl -f http://localhost:3001/api/health
   # Test functionality
   ```

5. **Investigate and document issues**