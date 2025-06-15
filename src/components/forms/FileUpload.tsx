
import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, File, X, Loader2 } from 'lucide-react';
import { useFileUpload } from '@/hooks/useFileUpload';

interface FileUploadProps {
  onFileUpload: (url: string, path: string) => void;
  currentFileUrl?: string;
  currentFilePath?: string;
  onFileRemoved?: () => void;
  label?: string;
  description?: string;
  accept?: string;
  submissionId?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileUpload,
  currentFileUrl,
  currentFilePath,
  onFileRemoved,
  label = "Upload Document",
  description = "Upload PDF, DOC, DOCX, JPG, or PNG files (max 10MB)",
  accept = ".pdf,.doc,.docx,.jpg,.jpeg,.png",
  submissionId
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, deleteFile, getSignedUrl, uploading } = useFileUpload();
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = async (file: File) => {
    const result = await uploadFile(file, submissionId);
    if (result) {
      onFileUpload(result.url, result.path);
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemoveFile = async () => {
    if (currentFilePath && onFileRemoved) {
      const success = await deleteFile(currentFilePath);
      if (success) {
        onFileRemoved();
      }
    } else if (onFileRemoved) {
      onFileRemoved();
    }
  };

  const handleViewFile = async () => {
    if (currentFilePath) {
      const signedUrl = await getSignedUrl(currentFilePath);
      if (signedUrl) {
        window.open(signedUrl, '_blank');
      }
    } else if (currentFileUrl) {
      // Fallback for existing URLs
      window.open(currentFileUrl, '_blank');
    }
  };

  const getFileName = (path?: string) => {
    if (!path) return 'Document';
    const parts = path.split('/');
    return parts[parts.length - 1] || 'Document';
  };

  if (currentFileUrl || currentFilePath) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <File className="w-8 h-8 text-blue-500" />
              <div>
                <p className="font-medium">{getFileName(currentFilePath)}</p>
                <p className="text-sm text-gray-500">File uploaded successfully</p>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleViewFile}
              >
                View
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemoveFile}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <Card
        className={`border-2 border-dashed transition-colors cursor-pointer ${
          dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <CardContent className="p-8 text-center">
          {uploading ? (
            <div className="flex flex-col items-center space-y-2">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm font-medium">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-2">
              <Upload className="w-8 h-8 text-gray-400" />
              <div>
                <p className="text-sm font-medium">
                  Drop files here or <span className="text-blue-500">browse</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">{description}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileInputChange}
        disabled={uploading}
      />
    </div>
  );
};
