import * as cron from 'node-cron';
import { fileService } from '../services/file-service.js';
import { logger } from './logger.js';

export class FileCleanupManager {
  private tempCleanupJob: cron.ScheduledTask | null = null;
  private orphanCleanupJob: cron.ScheduledTask | null = null;

  /**
   * Start automated cleanup jobs
   */
  startCleanupJobs(): void {
    // Clean up temporary files every hour
    this.tempCleanupJob = cron.schedule('0 * * * *', async () => {
      logger.info('Starting scheduled temporary files cleanup');
      try {
        await fileService.cleanupTempFiles(24); // Clean files older than 24 hours
        logger.info('Scheduled temporary files cleanup completed');
      } catch (error) {
        logger.error('Scheduled temporary files cleanup failed:', error);
      }
    });

    // Clean up orphaned files daily at 2 AM
    this.orphanCleanupJob = cron.schedule('0 2 * * *', async () => {
      logger.info('Starting scheduled orphaned files cleanup');
      try {
        await fileService.cleanupOrphanedFiles();
        logger.info('Scheduled orphaned files cleanup completed');
      } catch (error) {
        logger.error('Scheduled orphaned files cleanup failed:', error);
      }
    });

    logger.info('File cleanup jobs started');
  }

  /**
   * Stop automated cleanup jobs
   */
  stopCleanupJobs(): void {
    if (this.tempCleanupJob) {
      this.tempCleanupJob.stop();
      this.tempCleanupJob = null;
    }

    if (this.orphanCleanupJob) {
      this.orphanCleanupJob.stop();
      this.orphanCleanupJob = null;
    }

    logger.info('File cleanup jobs stopped');
  }

  /**
   * Run manual cleanup of temporary files
   */
  async runTempCleanup(maxAgeHours: number = 24): Promise<void> {
    logger.info(`Starting manual temporary files cleanup (max age: ${maxAgeHours} hours)`);
    try {
      await fileService.cleanupTempFiles(maxAgeHours);
      logger.info('Manual temporary files cleanup completed');
    } catch (error) {
      logger.error('Manual temporary files cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Run manual cleanup of orphaned files
   */
  async runOrphanCleanup(): Promise<void> {
    logger.info('Starting manual orphaned files cleanup');
    try {
      await fileService.cleanupOrphanedFiles();
      logger.info('Manual orphaned files cleanup completed');
    } catch (error) {
      logger.error('Manual orphaned files cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats(): Promise<{
    isRunning: boolean;
    tempJobActive: boolean;
    orphanJobActive: boolean;
    storageStats: any;
  }> {
    const storageStats = await fileService.getStorageStats();
    
    return {
      isRunning: this.tempCleanupJob !== null || this.orphanCleanupJob !== null,
      tempJobActive: this.tempCleanupJob !== null,
      orphanJobActive: this.orphanCleanupJob !== null,
      storageStats
    };
  }
}

// Create and export default instance
export const fileCleanupManager = new FileCleanupManager();

// Graceful shutdown handler
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, stopping file cleanup jobs');
  fileCleanupManager.stopCleanupJobs();
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, stopping file cleanup jobs');
  fileCleanupManager.stopCleanupJobs();
});