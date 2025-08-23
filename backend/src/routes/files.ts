import express from 'express';
import * as path from 'path';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { FileService } from '../services/file-service.js';
import { AuditService } from '../services/audit-service.js';
import { upload } from '../utils/multer-config.js';
import { logger } from '../utils/logger.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { createSupabaseFileMigration } from '../utils/supabase-file-migration.js';


const router = express.Router();
const fileService = new FileService();
const auditService = new AuditService();

// Upload single file
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json(errorResponse('No file provided'));
    }

    const submissionId = req.body.submissionId;
    if (!submissionId) {
      return res.status(400).json(errorResponse('Submission ID is required'));
    }

    const result = await fileService.processUpload(req.file, req.user!.userId, submissionId);
    
    await auditService.logAction(
      req.user!.userId,
      'file_upload',
      'file',
      result.file?.filename || 'unknown',
      { 
        filename: req.file.originalname, 
        size: req.file.size,
        submissionId,
        path: result.file?.path
      }
    );

    return res.json(successResponse(result, 'File uploaded successfully'));
  } catch (error) {
    logger.error('File upload error:', error);
    return res.status(500).json(errorResponse('Failed to upload file'));
  }
});

// Upload multiple files
router.post('/upload-multiple', authenticateToken, upload.array('files', 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json(errorResponse('No files provided'));
    }

    const submissionId = req.body.submissionId;
    if (!submissionId) {
      return res.status(400).json(errorResponse('Submission ID is required'));
    }

    const results = await fileService.processMultipleUploads(files, req.user!.userId, submissionId);
    
    // Log each file upload
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const file = files[i];
      
      if (result && file) {
        await auditService.logAction(
          req.user!.userId,
          'file_upload',
          'file',
          result.file?.filename || 'unknown',
          { 
            filename: file.originalname, 
            size: file.size,
            submissionId,
            success: result.success,
            path: result.file?.path
          }
        );
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    return res.json(successResponse({
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount
      }
    }, `${successCount} files uploaded successfully${failureCount > 0 ? `, ${failureCount} failed` : ''}`));
  } catch (error) {
    logger.error('Multiple file upload error:', error);
    return res.status(500).json(errorResponse('Failed to upload files'));
  }
});

// Download file with access control
router.get('/download/:filePath(*)', authenticateToken, async (req, res): Promise<void> => {
  try {
    const filePath = req.params['filePath'];
    if (!filePath) {
      res.status(400).json(errorResponse('File path is required'));
      return;
    }

    // Check if user has access to this file
    const hasAccess = await fileService.checkFileAccess(filePath, req.user!.userId, req.user!.role);
    if (!hasAccess) {
      res.status(403).json(errorResponse('Access denied to this file'));
      return;
    }

    // Get file metadata for proper headers
    const metadata = await fileService.getFileMetadata(filePath);
    if (!metadata) {
      res.status(404).json(errorResponse('File not found'));
      return;
    }

    // Get file stream
    const fileStream = await fileService.downloadFile(filePath);

    // Set appropriate headers
    res.setHeader('Content-Type', metadata.mimeType);
    res.setHeader('Content-Length', metadata.size);
    res.setHeader('Content-Disposition', `attachment; filename="${metadata.originalName}"`);
    res.setHeader('Cache-Control', 'private, no-cache');

    // Log file download
    await auditService.logAction(
      req.user!.userId,
      'file_download',
      'file',
      metadata.filename,
      { 
        filePath,
        originalName: metadata.originalName,
        size: metadata.size,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    );

    // Stream the file
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      logger.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json(errorResponse('Error streaming file'));
      }
    });

  } catch (error) {
    logger.error('File download error:', error);
    if (!res.headersSent) {
      res.status(500).json(errorResponse('Failed to download file'));
    }
  }
});

// Get file metadata
router.get('/metadata/:filePath(*)', authenticateToken, async (req, res) => {
  try {
    const filePath = req.params['filePath'];
    if (!filePath) {
      return res.status(400).json(errorResponse('File path is required'));
    }

    // Check if user has access to this file
    const hasAccess = await fileService.checkFileAccess(filePath, req.user!.userId, req.user!.role);
    if (!hasAccess) {
      return res.status(403).json(errorResponse('Access denied to this file'));
    }

    const metadata = await fileService.getFileMetadata(filePath);
    if (!metadata) {
      return res.status(404).json(errorResponse('File not found'));
    }

    return res.json(successResponse(metadata, 'File metadata retrieved successfully'));
  } catch (error) {
    logger.error('Get file metadata error:', error);
    return res.status(500).json(errorResponse('Failed to get file metadata'));
  }
});

// Delete file
router.delete('/:filePath(*)', authenticateToken, async (req, res) => {
  try {
    const filePath = req.params['filePath'];
    if (!filePath) {
      return res.status(400).json(errorResponse('File path is required'));
    }

    // Check if user has access to delete this file
    const hasAccess = await fileService.checkFileAccess(filePath, req.user!.userId, req.user!.role);
    if (!hasAccess) {
      return res.status(403).json(errorResponse('Access denied to delete this file'));
    }

    // Get metadata before deletion for logging
    const metadata = await fileService.getFileMetadata(filePath);
    
    const success = await fileService.deleteFile(filePath);
    if (!success) {
      return res.status(500).json(errorResponse('Failed to delete file'));
    }

    // Log file deletion
    await auditService.logAction(
      req.user!.userId,
      'file_delete',
      'file',
      metadata?.filename || path.basename(filePath),
      { 
        filePath,
        originalName: metadata?.originalName,
        size: metadata?.size
      }
    );

    return res.json(successResponse(null, 'File deleted successfully'));
  } catch (error) {
    logger.error('File deletion error:', error);
    return res.status(500).json(errorResponse('Failed to delete file'));
  }
});

// Get storage statistics (Admin only)
router.get('/stats', authenticateToken, requireRole('admin'), async (_req, res) => {
  try {
    const stats = await fileService.getStorageStats();
    return res.json(successResponse(stats, 'Storage statistics retrieved successfully'));
  } catch (error) {
    logger.error('Get storage stats error:', error);
    return res.status(500).json(errorResponse('Failed to get storage statistics'));
  }
});

// Clean up orphaned files (Admin only)
router.post('/cleanup/orphaned', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    await fileService.cleanupOrphanedFiles();
    
    await auditService.logAction(
      req.user!.userId,
      'cleanup_orphaned_files',
      'system',
      'file_cleanup',
      { action: 'orphaned_files_cleanup' }
    );

    return res.json(successResponse(null, 'Orphaned files cleanup completed'));
  } catch (error) {
    logger.error('Orphaned files cleanup error:', error);
    return res.status(500).json(errorResponse('Failed to cleanup orphaned files'));
  }
});

// Clean up temporary files (Admin only)
router.post('/cleanup/temp', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const maxAgeHours = parseInt(req.body.maxAgeHours) || 24;
    await fileService.cleanupTempFiles(maxAgeHours);
    
    await auditService.logAction(
      req.user!.userId,
      'cleanup_temp_files',
      'system',
      'file_cleanup',
      { action: 'temp_files_cleanup', maxAgeHours }
    );

    return res.json(successResponse(null, `Temporary files cleanup completed (older than ${maxAgeHours} hours)`));
  } catch (error) {
    logger.error('Temporary files cleanup error:', error);
    return res.status(500).json(errorResponse('Failed to cleanup temporary files'));
  }
});

// Migrate files from Supabase (Admin only)
router.post('/migrate/supabase', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { supabaseUrl, supabaseKey, bucketName } = req.body;
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(400).json(errorResponse('Supabase URL and key are required'));
    }

    const migration = createSupabaseFileMigration(supabaseUrl, supabaseKey, bucketName);
    
    // Create backup before migration
    const backupPath = await migration.createBackup();
    logger.info(`Backup created at: ${backupPath}`);

    // Perform migration
    const result = await migration.migrateAllFiles();
    
    await auditService.logAction(
      req.user!.userId,
      'supabase_file_migration',
      'system',
      'file_migration',
      { 
        result,
        backupPath,
        supabaseUrl: supabaseUrl.replace(/\/\/.*@/, '//***@') // Hide credentials in logs
      }
    );

    return res.json(successResponse({
      ...result,
      backupPath
    }, `Migration completed: ${result.migratedFiles}/${result.totalFiles} files migrated`));
  } catch (error) {
    logger.error('Supabase migration error:', error);
    return res.status(500).json(errorResponse('Failed to migrate files from Supabase'));
  }
});

// Verify migration integrity (Admin only)
router.post('/migrate/verify', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { supabaseUrl, supabaseKey, bucketName } = req.body;
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(400).json(errorResponse('Supabase URL and key are required'));
    }

    const migration = createSupabaseFileMigration(supabaseUrl, supabaseKey, bucketName);
    const verification = await migration.verifyMigration();
    
    await auditService.logAction(
      req.user!.userId,
      'verify_migration_integrity',
      'system',
      'file_migration',
      { 
        verification,
        supabaseUrl: supabaseUrl.replace(/\/\/.*@/, '//***@') // Hide credentials in logs
      }
    );

    return res.json(successResponse(verification, 
      verification.isValid 
        ? 'Migration integrity verified successfully' 
        : `Migration integrity issues found: ${verification.sizeMismatches.length} mismatches`
    ));
  } catch (error) {
    logger.error('Migration verification error:', error);
    return res.status(500).json(errorResponse('Failed to verify migration integrity'));
  }
});

export default router;