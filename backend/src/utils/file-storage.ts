import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger.js';
import { fileValidator } from './file-validation.js';

export interface FileStorageConfig {
  baseUploadPath: string;
  maxFileSize: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
}

export interface StoredFile {
  id: string;
  originalName: string;
  filename: string;
  path: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
}

export class FileStorageManager {
  public config: FileStorageConfig;

  constructor(config: FileStorageConfig) {
    this.config = config;
  }

  /**
   * Initialize the directory structure for file storage
   */
  async initializeDirectories(): Promise<void> {
    try {
      const directories = [
        this.config.baseUploadPath,
        path.join(this.config.baseUploadPath, 'submissions'),
        path.join(this.config.baseUploadPath, 'temp'),
        path.join(this.config.baseUploadPath, 'system', 'backups'),
        path.join(this.config.baseUploadPath, 'system', 'logs')
      ];

      for (const dir of directories) {
        await fs.mkdir(dir, { recursive: true });
        logger.info(`Created directory: ${dir}`);
      }
    } catch (error) {
      logger.error('Failed to initialize directories:', error);
      throw new Error('Failed to initialize file storage directories');
    }
  }

  /**
   * Generate a unique filename while preserving the extension
   */
  generateUniqueFilename(originalName: string): string {
    const ext = path.extname(originalName);
    const uuid = uuidv4();
    return `${uuid}${ext}`;
  }

  /**
   * Get the storage path for a specific user and submission
   */
  getSubmissionPath(userId: string, submissionId: string): string {
    return path.join(this.config.baseUploadPath, 'submissions', userId, submissionId);
  }

  /**
   * Get the temporary storage path
   */
  getTempPath(): string {
    return path.join(this.config.baseUploadPath, 'temp');
  }

  /**
   * Validate file type and size
   */
  validateFile(file: Express.Multer.File): { isValid: boolean; error?: string } {
    const validation = fileValidator.validateFile(file);
    
    if (!validation.isValid) {
      return {
        isValid: false,
        error: validation.errors.join('; ')
      };
    }

    return { isValid: true };
  }

  /**
   * Store a file in the organized directory structure
   */
  async storeFile(
    file: Express.Multer.File,
    userId: string,
    submissionId: string
  ): Promise<StoredFile> {
    try {
      // Validate the file
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Create the directory structure
      const storagePath = this.getSubmissionPath(userId, submissionId);
      await fs.mkdir(storagePath, { recursive: true });

      // Generate unique filename
      const uniqueFilename = this.generateUniqueFilename(file.originalname);
      const filePath = path.join(storagePath, uniqueFilename);

      // Move file from temp location to final location
      await fs.copyFile(file.path, filePath);
      await fs.unlink(file.path); // Remove temp file

      const storedFile: StoredFile = {
        id: uuidv4(),
        originalName: file.originalname,
        filename: uniqueFilename,
        path: filePath,
        size: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date()
      };

      logger.info(`File stored successfully: ${filePath}`);
      return storedFile;
    } catch (error) {
      logger.error('Failed to store file:', error);
      throw new Error('Failed to store file');
    }
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      logger.info(`File deleted: ${filePath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error('Failed to delete file:', error);
        throw new Error('Failed to delete file');
      }
      // File doesn't exist, which is fine
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file information
   */
  async getFileInfo(filePath: string): Promise<{ size: number; mtime: Date } | null> {
    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        mtime: stats.mtime
      };
    } catch {
      return null;
    }
  }

  /**
   * Clean up orphaned files in temp directory
   */
  async cleanupTempFiles(maxAgeHours: number = 24): Promise<void> {
    try {
      const tempPath = this.getTempPath();
      const files = await fs.readdir(tempPath);
      const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

      let deletedCount = 0;
      for (const file of files) {
        const filePath = path.join(tempPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffTime) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }

      logger.info(`Cleaned up ${deletedCount} temporary files`);
    } catch (error) {
      logger.error('Failed to cleanup temp files:', error);
    }
  }

  /**
   * Find and clean up orphaned files (files not referenced in database)
   */
  async cleanupOrphanedFiles(referencedFiles: string[]): Promise<void> {
    try {
      const submissionsPath = path.join(this.config.baseUploadPath, 'submissions');
      const allFiles = await this.getAllFiles(submissionsPath);
      
      let deletedCount = 0;
      for (const filePath of allFiles) {
        const relativePath = path.relative(this.config.baseUploadPath, filePath);
        if (!referencedFiles.includes(relativePath)) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }

      logger.info(`Cleaned up ${deletedCount} orphaned files`);
    } catch (error) {
      logger.error('Failed to cleanup orphaned files:', error);
    }
  }

  /**
   * Recursively get all files in a directory
   */
  private async getAllFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          const subFiles = await this.getAllFiles(fullPath);
          files.push(...subFiles);
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory might not exist, which is fine
    }
    
    return files;
  }

  /**
   * Get file stream for download
   */
  async getFileStream(filePath: string): Promise<import('fs').ReadStream> {
    const fullPath = path.join(this.config.baseUploadPath, filePath);
    
    // Check if file exists first
    if (!(await this.fileExists(fullPath))) {
      throw new Error('File not found');
    }
    
    const fs = await import('fs');
    return fs.createReadStream(fullPath);
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    submissionFiles: number;
    tempFiles: number;
  }> {
    try {
      const submissionsPath = path.join(this.config.baseUploadPath, 'submissions');
      const tempPath = this.getTempPath();

      const submissionFiles = await this.getAllFiles(submissionsPath);
      const tempFiles = await this.getAllFiles(tempPath);

      let totalSize = 0;
      for (const filePath of [...submissionFiles, ...tempFiles]) {
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      }

      return {
        totalFiles: submissionFiles.length + tempFiles.length,
        totalSize,
        submissionFiles: submissionFiles.length,
        tempFiles: tempFiles.length
      };
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
}

// Default configuration
export const defaultFileStorageConfig: FileStorageConfig = {
  baseUploadPath: path.join(process.cwd(), 'uploads'),
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ],
  allowedExtensions: [
    '.pdf',
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx'
  ]
};

// Create default instance
export const fileStorageManager = new FileStorageManager(defaultFileStorageConfig);