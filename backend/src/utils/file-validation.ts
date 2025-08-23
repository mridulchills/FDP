import * as path from 'path';

export interface FileValidationConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  maxFilenameLength: number;
  blockedFilenames: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class FileValidator {
  private config: FileValidationConfig;

  constructor(config: FileValidationConfig) {
    this.config = config;
  }

  /**
   * Validate a single file
   */
  validateFile(file: Express.Multer.File): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Validate file size
    if (file.size > this.config.maxFileSize) {
      result.errors.push(
        `File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size (${this.formatFileSize(this.config.maxFileSize)})`
      );
      result.isValid = false;
    }

    // Validate MIME type
    if (!this.config.allowedMimeTypes.includes(file.mimetype)) {
      result.errors.push(`File type '${file.mimetype}' is not allowed`);
      result.isValid = false;
    }

    // Validate file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!this.config.allowedExtensions.includes(ext)) {
      result.errors.push(`File extension '${ext}' is not allowed`);
      result.isValid = false;
    }

    // Validate filename length
    if (file.originalname.length > this.config.maxFilenameLength) {
      result.errors.push(
        `Filename is too long (${file.originalname.length} characters). Maximum allowed is ${this.config.maxFilenameLength} characters`
      );
      result.isValid = false;
    }

    // Check for blocked filenames
    const filename = path.basename(file.originalname, ext).toLowerCase();
    if (this.config.blockedFilenames.includes(filename)) {
      result.errors.push(`Filename '${filename}' is not allowed`);
      result.isValid = false;
    }

    // Security checks
    this.performSecurityChecks(file, result);

    // Performance warnings
    this.performPerformanceChecks(file, result);

    return result;
  }

  /**
   * Validate multiple files
   */
  validateFiles(files: Express.Multer.File[]): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    if (files.length === 0) {
      result.errors.push('No files provided');
      result.isValid = false;
      return result;
    }

    // Validate each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;
      
      const fileResult = this.validateFile(file);
      
      if (!fileResult.isValid) {
        result.isValid = false;
        result.errors.push(`File ${i + 1} (${file.originalname}): ${fileResult.errors.join(', ')}`);
      }
      
      if (fileResult.warnings.length > 0) {
        result.warnings.push(`File ${i + 1} (${file.originalname}): ${fileResult.warnings.join(', ')}`);
      }
    }

    // Check for duplicate filenames
    const filenames = files.map(f => f.originalname.toLowerCase());
    const duplicates = filenames.filter((name, index) => filenames.indexOf(name) !== index);
    
    if (duplicates.length > 0) {
      result.warnings.push(`Duplicate filenames detected: ${Array.from(new Set(duplicates)).join(', ')}`);
    }

    return result;
  }

  /**
   * Perform security checks on file
   */
  private performSecurityChecks(file: Express.Multer.File, result: ValidationResult): void {
    // Check for suspicious file extensions
    const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (suspiciousExtensions.includes(ext)) {
      result.errors.push(`Potentially dangerous file extension: ${ext}`);
      result.isValid = false;
    }

    // Check for double extensions (e.g., file.pdf.exe)
    const filename = file.originalname.toLowerCase();
    const doubleExtPattern = /\.(pdf|doc|docx|xls|xlsx|jpg|jpeg|png|gif)\.(exe|bat|cmd|com|pif|scr|vbs|js)$/;
    
    if (doubleExtPattern.test(filename)) {
      result.errors.push('File appears to have a double extension, which may indicate malicious content');
      result.isValid = false;
    }

    // Check for null bytes in filename
    if (file.originalname.includes('\0')) {
      result.errors.push('Filename contains null bytes');
      result.isValid = false;
    }

    // Check for path traversal attempts
    if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
      result.errors.push('Filename contains path traversal characters');
      result.isValid = false;
    }

    // Check for control characters
    const controlCharPattern = /[\x00-\x1f\x7f-\x9f]/;
    if (controlCharPattern.test(file.originalname)) {
      result.errors.push('Filename contains control characters');
      result.isValid = false;
    }
  }

  /**
   * Perform performance checks on file
   */
  private performPerformanceChecks(file: Express.Multer.File, result: ValidationResult): void {
    // Warn about large files (but don't fail validation)
    const warningSize = this.config.maxFileSize * 0.8; // 80% of max size
    if (file.size > warningSize) {
      result.warnings.push(
        `Large file detected (${this.formatFileSize(file.size)}). Consider compressing the file for better performance`
      );
    }

    // Warn about uncompressed image formats
    if (file.mimetype === 'image/bmp' || file.mimetype === 'image/tiff') {
      result.warnings.push('Uncompressed image format detected. Consider using JPEG or PNG for better performance');
    }
  }

  /**
   * Format file size for human readability
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Sanitize filename for safe storage
   */
  sanitizeFilename(filename: string): string {
    // Remove or replace dangerous characters
    let sanitized = filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // Replace dangerous characters with underscore
      .replace(/\.+/g, '.') // Replace multiple dots with single dot
      .replace(/^\.+|\.+$/g, '') // Remove leading/trailing dots
      .trim();

    // Ensure filename is not empty
    if (!sanitized) {
      sanitized = 'unnamed_file';
    }

    // Limit filename length
    if (sanitized.length > this.config.maxFilenameLength) {
      const ext = path.extname(sanitized);
      const name = path.basename(sanitized, ext);
      const maxNameLength = this.config.maxFilenameLength - ext.length;
      sanitized = name.substring(0, maxNameLength) + ext;
    }

    return sanitized;
  }

  /**
   * Check if file type is allowed for specific context
   */
  isFileTypeAllowedForContext(file: Express.Multer.File, context: 'certificate' | 'brochure' | 'document'): boolean {
    const contextAllowedTypes: { [key: string]: string[] } = {
      certificate: ['application/pdf', 'image/jpeg', 'image/png'],
      brochure: ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'],
      document: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ]
    };

    const allowedTypes = contextAllowedTypes[context] || this.config.allowedMimeTypes;
    return allowedTypes.includes(file.mimetype);
  }
}

// Default validation configuration
export const defaultFileValidationConfig: FileValidationConfig = {
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
  ],
  maxFilenameLength: 255,
  blockedFilenames: [
    'con', 'prn', 'aux', 'nul',
    'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
    'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'
  ]
};

// Create and export default instance
export const fileValidator = new FileValidator(defaultFileValidationConfig);