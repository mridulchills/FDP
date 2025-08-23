import * as path from 'path';
import { fileStorageManager, StoredFile } from '../utils/file-storage.js';
import { logger } from '../utils/logger.js';
import { submissionRepository } from '../repositories/index.js';
import { FilePerformanceTracker } from '../utils/performance-monitor.js';

export interface FileUploadResult {
  success: boolean;
  file?: StoredFile;
  error?: string;
}

export interface FileMetadata {
  id: string;
  originalName: string;
  filename: string;
  relativePath: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
  userId: string;
  submissionId: string;
}

export class FileService {
  /**
   * Process and store an uploaded file
   */
  async processUpload(
    file: Express.Multer.File,
    userId: string,
    submissionId: string
  ): Promise<FileUploadResult> {
    return FilePerformanceTracker.trackOperation('upload', async () => {
      try {
        // Store the file in organized directory structure
        const storedFile = await fileStorageManager.storeFile(file, userId, submissionId);
        
        logger.info('File processed successfully', {
          userId,
          submissionId,
          filename: storedFile.filename,
          originalName: storedFile.originalName
        });

        return {
          success: true,
          file: storedFile
        };
      } catch (error) {
        logger.error('Failed to process file upload:', error);
      
      // Clean up the temporary file if it still exists
      try {
        await fileStorageManager.deleteFile(file.path);
      } catch (cleanupError) {
        logger.error('Failed to cleanup temp file:', cleanupError);
      }

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    });
  }

  /**
   * Process multiple uploaded files
   */
  async processMultipleUploads(
    files: Express.Multer.File[],
    userId: string,
    submissionId: string
  ): Promise<FileUploadResult[]> {
    const results: FileUploadResult[] = [];
    
    for (const file of files) {
      const result = await this.processUpload(file, userId, submissionId);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Delete a file and clean up storage
   */
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      await fileStorageManager.deleteFile(filePath);
      logger.info('File deleted successfully', { filePath });
      return true;
    } catch (error) {
      logger.error('Failed to delete file:', error);
      return false;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(filePath: string): Promise<FileMetadata | null> {
    try {
      const fileInfo = await fileStorageManager.getFileInfo(filePath);
      if (!fileInfo) {
        return null;
      }

      // Extract information from file path
      const relativePath = path.relative(fileStorageManager.config.baseUploadPath, filePath);
      const pathParts = relativePath.split(path.sep);
      
      if (pathParts.length < 4 || pathParts[0] !== 'submissions') {
        return null;
      }

      const userId = pathParts[1];
      const submissionId = pathParts[2];
      const filename = pathParts[3];
      
      if (!filename) {
        return null;
      }

      return {
        id: path.basename(filename, path.extname(filename)),
        originalName: filename, // This would need to be stored separately for full metadata
        filename,
        relativePath,
        size: fileInfo.size,
        mimeType: this.getMimeTypeFromExtension(path.extname(filename)),
        uploadedAt: fileInfo.mtime,
        userId: userId || '',
        submissionId: submissionId || ''
      };
    } catch (error) {
      logger.error('Failed to get file metadata:', error);
      return null;
    }
  }

  /**
   * Check if user has access to file
   */
  async checkFileAccess(filePath: string, userId: string, userRole: string): Promise<boolean> {
    try {
      const metadata = await this.getFileMetadata(filePath);
      if (!metadata) {
        return false;
      }

      // File owner always has access
      if (metadata.userId === userId) {
        return true;
      }

      // Admin has access to all files
      if (userRole === 'admin') {
        return true;
      }

      // HoD has access to files in their department
      if (userRole === 'hod') {
        try {
          // Get the submission to check department
          const submission = await submissionRepository.findById(metadata.submissionId);
          if (submission) {
            // Get the submission owner's department
            const { userRepository } = await import('../repositories/index.js');
            const submissionOwner = await userRepository.findById(submission.userId);
            const currentUser = await userRepository.findById(userId);
            
            if (submissionOwner && currentUser && submissionOwner.departmentId === currentUser.departmentId) {
              return true;
            }
          }
        } catch (error) {
          logger.error('Error checking department access:', error);
        }
      }

      return false;
    } catch (error) {
      logger.error('Failed to check file access:', error);
      return false;
    }
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeTypeFromExtension(ext: string): string {
    const mimeTypes: { [key: string]: string } = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

    return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * Clean up orphaned files
   */
  async cleanupOrphanedFiles(): Promise<void> {
    try {
      // Get all file references from the database
      const submissions = await submissionRepository.findAll();
      const referencedFiles: string[] = [];

      for (const submission of submissions) {
        if (submission.documentUrl) {
          referencedFiles.push(submission.documentUrl);
        }
      }

      await fileStorageManager.cleanupOrphanedFiles(referencedFiles);
      logger.info('Orphaned files cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup orphaned files:', error);
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanupTempFiles(maxAgeHours: number = 24): Promise<void> {
    try {
      await fileStorageManager.cleanupTempFiles(maxAgeHours);
      logger.info('Temporary files cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup temporary files:', error);
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    try {
      return await fileStorageManager.getStorageStats();
    } catch (error) {
      logger.error('Failed to get storage stats:', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        submissionFiles: 0,
        tempFiles: 0
      };
    }
  }

  /**
   * Download a file and return a stream
   */
  async downloadFile(filePath: string): Promise<import('fs').ReadStream> {
    try {
      return await fileStorageManager.getFileStream(filePath);
    } catch (error) {
      logger.error('Error downloading file:', error);
      throw new Error('Failed to download file');
    }
  }

  /**
   * Migrate files from Supabase using the migration utility
   */
  async migrateFromSupabase(supabaseUrl: string, supabaseKey: string, bucketName?: string): Promise<{ migrated: number; errors: string[] }> {
    try {
      const { createSupabaseFileMigration } = await import('../utils/supabase-file-migration.js');
      const migration = createSupabaseFileMigration(supabaseUrl, supabaseKey, bucketName);
      
      logger.info('Starting Supabase file migration...');
      const result = await migration.migrateAllFiles();
      
      return { 
        migrated: result.migratedFiles, 
        errors: result.errors 
      };
    } catch (error) {
      logger.error('Error migrating from Supabase:', error);
      throw new Error('Failed to migrate files from Supabase');
    }
  }

  /**
   * Verify migration integrity using the migration utility
   */
  async verifyMigrationIntegrity(supabaseUrl: string, supabaseKey: string, bucketName?: string): Promise<{ verified: number; issues: string[] }> {
    try {
      const { createSupabaseFileMigration } = await import('../utils/supabase-file-migration.js');
      const migration = createSupabaseFileMigration(supabaseUrl, supabaseKey, bucketName);
      
      logger.info('Verifying migration integrity...');
      const verification = await migration.verifyMigration();
      
      return { 
        verified: verification.localFileCount, 
        issues: verification.sizeMismatches 
      };
    } catch (error) {
      logger.error('Error verifying migration integrity:', error);
      throw new Error('Failed to verify migration integrity');
    }
  }

  /**
   * Initialize file storage system
   */
  async initialize(): Promise<void> {
    try {
      await fileStorageManager.initializeDirectories();
      logger.info('File storage system initialized');
    } catch (error) {
      logger.error('Failed to initialize file storage system:', error);
      throw error;
    }
  }
}

// Create and export default instance
export const fileService = new FileService();