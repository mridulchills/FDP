import multer from 'multer';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';
import { fileStorageManager, defaultFileStorageConfig } from './file-storage.js';
import { logger } from './logger.js';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      // Store files in temp directory initially
      const tempPath = fileStorageManager.getTempPath();
      await fileStorageManager.initializeDirectories();
      cb(null, tempPath);
    } catch (error) {
      logger.error('Failed to set upload destination:', error);
      cb(error as Error, '');
    }
  },
  filename: (_req, file, cb) => {
    // Generate unique filename with timestamp and UUID
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${uuidv4()}${ext}`;
    cb(null, uniqueName);
  }
});

// File filter function
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const validation = fileStorageManager.validateFile(file);
  
  if (validation.isValid) {
    cb(null, true);
  } else {
    logger.warn(`File upload rejected: ${validation.error}`, {
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    cb(new Error(validation.error || 'Invalid file'));
  }
};

// Create multer instance with configuration
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: defaultFileStorageConfig.maxFileSize,
    files: 5, // Maximum 5 files per request
    fields: 10, // Maximum 10 non-file fields
    fieldSize: 1024 * 1024 // 1MB max field size
  }
});

// Middleware for single file upload
export const uploadSingle = (fieldName: string) => {
  return upload.single(fieldName);
};

// Middleware for multiple file upload
export const uploadMultiple = (fieldName: string, maxCount: number = 5) => {
  return upload.array(fieldName, maxCount);
};

// Middleware for mixed file upload (multiple fields)
export const uploadFields = (fields: { name: string; maxCount?: number }[]) => {
  return upload.fields(fields);
};

// Error handling middleware for multer errors
export const handleUploadError = (error: any, _req: Request, res: Response, next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    logger.error('Multer error:', error);
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          error: 'File too large',
          details: `Maximum file size is ${defaultFileStorageConfig.maxFileSize} bytes`
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          error: 'Too many files',
          details: 'Maximum 5 files allowed per request'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          error: 'Unexpected file field',
          details: 'File field not expected'
        });
      default:
        return res.status(400).json({
          success: false,
          error: 'File upload error',
          details: error.message
        });
    }
  }
  
  if (error.message && error.message.includes('Invalid file')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid file',
      details: error.message
    });
  }
  
  return next(error);
};

// Utility function to clean up uploaded files on error
export const cleanupUploadedFiles = async (files: Express.Multer.File | Express.Multer.File[] | undefined) => {
  if (!files) return;
  
  const fileArray = Array.isArray(files) ? files : [files];
  
  for (const file of fileArray) {
    try {
      await fileStorageManager.deleteFile(file.path);
    } catch (error) {
      logger.error('Failed to cleanup uploaded file:', error);
    }
  }
};

export default upload;