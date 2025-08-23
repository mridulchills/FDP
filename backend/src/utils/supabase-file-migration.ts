import { promises as fs } from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import { logger } from './logger.js';
import { fileStorageManager } from './file-storage.js';
import { submissionRepository } from '../repositories/index.js';

export interface SupabaseFileRecord {
  id: string;
  name: string;
  bucket_id: string;
  owner: string;
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
  metadata: {
    eTag: string;
    size: number;
    mimetype: string;
    cacheControl: string;
    lastModified: string;
    contentLength: number;
    httpStatusCode: number;
  };
}

export interface MigrationResult {
  success: boolean;
  totalFiles: number;
  migratedFiles: number;
  failedFiles: number;
  errors: string[];
}

export class SupabaseFileMigration {
  private supabaseUrl: string;
  private supabaseKey: string;
  private bucketName: string;

  constructor(supabaseUrl: string, supabaseKey: string, bucketName: string = 'submissions') {
    this.supabaseUrl = supabaseUrl;
    this.supabaseKey = supabaseKey;
    this.bucketName = bucketName;
  }

  /**
   * Get list of files from Supabase storage
   */
  async getSupabaseFiles(): Promise<SupabaseFileRecord[]> {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/storage/v1/object/list/${this.bucketName}`,
        {
          headers: {
            'Authorization': `Bearer ${this.supabaseKey}`,
            'apikey': this.supabaseKey
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.statusText}`);
      }

      const files = await response.json() as SupabaseFileRecord[];
      logger.info(`Found ${files.length} files in Supabase storage`);
      
      return files;
    } catch (error) {
      logger.error('Failed to get Supabase files:', error);
      throw error;
    }
  }

  /**
   * Download a file from Supabase storage
   */
  async downloadSupabaseFile(fileName: string): Promise<Buffer> {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/storage/v1/object/${this.bucketName}/${fileName}`,
        {
          headers: {
            'Authorization': `Bearer ${this.supabaseKey}`,
            'apikey': this.supabaseKey
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to download file ${fileName}: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      logger.debug(`Downloaded file: ${fileName} (${buffer.length} bytes)`);
      
      return buffer;
    } catch (error) {
      logger.error(`Failed to download file ${fileName}:`, error);
      throw error;
    }
  }

  /**
   * Parse file path to extract user ID and submission ID
   */
  parseFilePath(filePath: string): { userId: string; submissionId: string; filename: string } | null {
    try {
      // Expected format: submissions/{userId}/{submissionId}/{filename}
      // or: {userId}/{submissionId}/{filename}
      const parts = filePath.split('/');
      
      let userId: string;
      let submissionId: string;
      let filename: string;

      if (parts.length === 4 && parts[0] === 'submissions') {
        // Format: submissions/{userId}/{submissionId}/{filename}
        userId = parts[1] || '';
        submissionId = parts[2] || '';
        filename = parts[3] || '';
      } else if (parts.length === 3) {
        // Format: {userId}/{submissionId}/{filename}
        userId = parts[0] || '';
        submissionId = parts[1] || '';
        filename = parts[2] || '';
      } else {
        logger.warn(`Unexpected file path format: ${filePath}`);
        return null;
      }

      return { userId, submissionId, filename };
    } catch (error) {
      logger.error(`Failed to parse file path ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Migrate a single file from Supabase to local storage
   */
  async migrateFile(file: SupabaseFileRecord): Promise<boolean> {
    try {
      const pathInfo = this.parseFilePath(file.name);
      if (!pathInfo) {
        logger.warn(`Skipping file with invalid path: ${file.name}`);
        return false;
      }

      const { userId, submissionId, filename } = pathInfo;

      // Verify submission exists
      const submission = await submissionRepository.findById(submissionId);
      if (!submission) {
        logger.warn(`Submission not found for file: ${file.name}`);
        return false;
      }

      // Download file from Supabase
      const fileBuffer = await this.downloadSupabaseFile(file.name);

      // Create local directory structure
      const localDir = fileStorageManager.getSubmissionPath(userId, submissionId);
      await fs.mkdir(localDir, { recursive: true });

      // Write file to local storage
      const localFilePath = path.join(localDir, filename);
      await fs.writeFile(localFilePath, fileBuffer);

      // Verify file was written correctly
      const stats = await fs.stat(localFilePath);
      if (stats.size !== file.metadata.size) {
        logger.error(`File size mismatch for ${file.name}: expected ${file.metadata.size}, got ${stats.size}`);
        await fs.unlink(localFilePath); // Clean up
        return false;
      }

      logger.info(`Successfully migrated file: ${file.name} -> ${localFilePath}`);
      return true;

    } catch (error) {
      logger.error(`Failed to migrate file ${file.name}:`, error);
      return false;
    }
  }

  /**
   * Migrate all files from Supabase to local storage
   */
  async migrateAllFiles(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      totalFiles: 0,
      migratedFiles: 0,
      failedFiles: 0,
      errors: []
    };

    try {
      // Initialize local storage directories
      await fileStorageManager.initializeDirectories();

      // Get all files from Supabase
      const files = await this.getSupabaseFiles();
      result.totalFiles = files.length;

      if (files.length === 0) {
        logger.info('No files found in Supabase storage');
        result.success = true;
        return result;
      }

      logger.info(`Starting migration of ${files.length} files...`);

      // Migrate files in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (file) => {
          try {
            const success = await this.migrateFile(file);
            if (success) {
              result.migratedFiles++;
            } else {
              result.failedFiles++;
              result.errors.push(`Failed to migrate: ${file.name}`);
            }
          } catch (error) {
            result.failedFiles++;
            const errorMsg = `Error migrating ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            result.errors.push(errorMsg);
            logger.error(errorMsg);
          }
        });

        await Promise.all(batchPromises);
        
        logger.info(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(files.length / batchSize)}`);
      }

      result.success = result.failedFiles === 0;
      
      logger.info(`Migration completed: ${result.migratedFiles}/${result.totalFiles} files migrated successfully`);
      
      if (result.errors.length > 0) {
        logger.warn(`Migration errors (${result.errors.length}):`);
        result.errors.forEach(error => logger.warn(`  - ${error}`));
      }

      return result;

    } catch (error) {
      const errorMsg = `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
      logger.error(errorMsg);
      return result;
    }
  }

  /**
   * Verify migration integrity by comparing file counts and sizes
   */
  async verifyMigration(): Promise<{
    isValid: boolean;
    supabaseFileCount: number;
    localFileCount: number;
    sizeMismatches: string[];
  }> {
    try {
      const supabaseFiles = await this.getSupabaseFiles();
      const localStats = await fileStorageManager.getStorageStats();
      
      const sizeMismatches: string[] = [];
      
      // Check each Supabase file has a corresponding local file
      for (const file of supabaseFiles) {
        const pathInfo = this.parseFilePath(file.name);
        if (!pathInfo) continue;

        const localPath = path.join(
          fileStorageManager.getSubmissionPath(pathInfo.userId, pathInfo.submissionId),
          pathInfo.filename
        );

        try {
          const localStats = await fs.stat(localPath);
          if (localStats.size !== file.metadata.size) {
            sizeMismatches.push(`${file.name}: expected ${file.metadata.size}, got ${localStats.size}`);
          }
        } catch (error) {
          sizeMismatches.push(`${file.name}: file not found locally`);
        }
      }

      return {
        isValid: sizeMismatches.length === 0,
        supabaseFileCount: supabaseFiles.length,
        localFileCount: localStats.submissionFiles,
        sizeMismatches
      };

    } catch (error) {
      logger.error('Failed to verify migration:', error);
      return {
        isValid: false,
        supabaseFileCount: 0,
        localFileCount: 0,
        sizeMismatches: [`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Create a backup of current local files before migration
   */
  async createBackup(): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(fileStorageManager.config.baseUploadPath, 'system', 'backups', `pre-migration-${timestamp}`);
      
      await fs.mkdir(backupDir, { recursive: true });
      
      // Copy current submissions directory to backup
      const submissionsDir = path.join(fileStorageManager.config.baseUploadPath, 'submissions');
      
      try {
        await fs.access(submissionsDir);
        // Directory exists, create backup
        const backupSubmissionsDir = path.join(backupDir, 'submissions');
        await this.copyDirectory(submissionsDir, backupSubmissionsDir);
        logger.info(`Backup created: ${backupDir}`);
      } catch (error) {
        // Directory doesn't exist, no backup needed
        logger.info('No existing submissions directory found, skipping backup');
      }
      
      return backupDir;
    } catch (error) {
      logger.error('Failed to create backup:', error);
      throw error;
    }
  }

  /**
   * Recursively copy directory
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
}

// Export utility function to create migration instance
export function createSupabaseFileMigration(
  supabaseUrl: string,
  supabaseKey: string,
  bucketName?: string
): SupabaseFileMigration {
  return new SupabaseFileMigration(supabaseUrl, supabaseKey, bucketName);
}