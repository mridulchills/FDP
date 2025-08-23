# FDTS Production Deployment Checklist

Use this checklist to ensure all steps are completed for a successful production deployment.

## Pre-Deployment Checklist

### System Preparation
- [ ] Server meets minimum requirements (4GB RAM, 50GB storage, 2 CPU cores)
- [ ] Operating system is updated (Ubuntu 20.04+ or CentOS 8+)
- [ ] Docker and Docker Compose are installed
- [ ] Firewall is configured (UFW or similar)
- [ ] Domain name is configured (if applicable)
- [ ] SSL certificates are obtained (replace self-signed for production)

### Environment Configuration
- [ ] `.env.production` file is created with secure values
- [ ] JWT secrets are generated (64+ characters)
- [ ] Database path is configured
- [ ] Upload and backup directories are configured
- [ ] Backup schedule is set
- [ ] Monitoring credentials are configured

### Security Setup
- [ ] Strong passwords/secrets are generated
- [ ] SSL certificates are properly configured
- [ ] Firewall rules are applied
- [ ] Security headers are configured in Nginx
- [ ] File permissions are set correctly

## Deployment Steps

### 1. Code Deployment
- [ ] Repository is cloned to production server
- [ ] Latest stable version is checked out
- [ ] Environment file is configured
- [ ] SSL certificates are in place

### 2. Docker Deployment
- [ ] Docker images are built successfully
- [ ] All services start without errors
- [ ] Health checks pass for all services
- [ ] Container logs show no critical errors

### 3. Database Setup
- [ ] Database migrations run successfully
- [ ] Initial admin user is created
- [ ] Database integrity check passes
- [ ] Sample data is loaded (if needed)

### 4. Application Testing
- [ ] Health endpoint responds correctly
- [ ] User authentication works
- [ ] File upload functionality works
- [ ] API endpoints respond correctly
- [ ] Frontend loads and functions properly

### 5. Backup System
- [ ] Backup service is running
- [ ] Manual backup completes successfully
- [ ] Backup files are created and valid
- [ ] Restore procedure is tested
- [ ] External backup storage is configured (if applicable)

### 6. Monitoring Setup
- [ ] Prometheus is collecting metrics
- [ ] Grafana dashboards are accessible
- [ ] Alert rules are configured
- [ ] Notification channels are set up
- [ ] Log aggregation is working

## Post-Deployment Checklist

### Immediate Verification (0-1 hours)
- [ ] All services are running and healthy
- [ ] Application is accessible via web browser
- [ ] User login functionality works
- [ ] File upload/download works
- [ ] Database operations are functioning
- [ ] Monitoring dashboards show green status

### Short-term Verification (1-24 hours)
- [ ] No critical errors in logs
- [ ] Performance metrics are within acceptable ranges
- [ ] Backup job runs successfully
- [ ] SSL certificates are working properly
- [ ] Security scans show no critical vulnerabilities

### Medium-term Verification (1-7 days)
- [ ] System stability is maintained
- [ ] No memory leaks or resource issues
- [ ] Backup retention policy is working
- [ ] Log rotation is functioning
- [ ] Monitoring alerts are properly configured

## Rollback Plan

### Preparation
- [ ] Pre-deployment backup is created
- [ ] Rollback procedure is documented
- [ ] Previous version images are available
- [ ] Database rollback scripts are prepared

### Rollback Triggers
- [ ] Critical application errors
- [ ] Database corruption
- [ ] Security vulnerabilities
- [ ] Performance degradation
- [ ] User-reported issues

### Rollback Steps
- [ ] Stop current services
- [ ] Restore from backup
- [ ] Deploy previous version
- [ ] Verify functionality
- [ ] Update DNS/load balancer (if applicable)

## Documentation and Handover

### Technical Documentation
- [ ] Deployment guide is updated
- [ ] Configuration changes are documented
- [ ] Troubleshooting guide is available
- [ ] Monitoring runbook is complete
- [ ] Backup/restore procedures are documented

### Operational Handover
- [ ] Operations team is trained
- [ ] Access credentials are shared securely
- [ ] Escalation procedures are defined
- [ ] Maintenance schedules are established
- [ ] Support contacts are updated

## Validation Commands

Run these commands to validate the deployment:

```bash
# System validation
./deployment/scripts/validate-production.sh

# Service status
docker-compose ps

# Health checks
curl -f http://localhost:3001/api/health
curl -f http://localhost:9090/-/healthy
curl -f http://localhost:3000/api/health

# Database check
docker-compose exec app sqlite3 /app/data/database.sqlite "PRAGMA integrity_check;"

# Backup test
docker-compose exec backup /app/scripts/backup.sh

# Log check
docker-compose logs --tail=50 app
```

## Emergency Contacts

- **System Administrator**: [Name] - [Phone] - [Email]
- **Database Administrator**: [Name] - [Phone] - [Email]
- **Security Team**: [Name] - [Phone] - [Email]
- **Development Team**: [Name] - [Phone] - [Email]
- **Management**: [Name] - [Phone] - [Email]

## Sign-off

### Technical Sign-off
- [ ] **System Administrator**: _________________ Date: _________
- [ ] **Database Administrator**: _________________ Date: _________
- [ ] **Security Officer**: _________________ Date: _________
- [ ] **Development Lead**: _________________ Date: _________

### Business Sign-off
- [ ] **Project Manager**: _________________ Date: _________
- [ ] **Business Owner**: _________________ Date: _________
- [ ] **Quality Assurance**: _________________ Date: _________

## Notes

_Use this space for deployment-specific notes, issues encountered, or deviations from the standard process._

---

**Deployment Date**: _______________
**Deployed Version**: _______________
**Deployed By**: _______________
**Deployment Duration**: _______________