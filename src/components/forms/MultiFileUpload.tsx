import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, File, X, Loader2, Eye } from 'lucide-react';
import { useFileUpload } from '@/hooks/useFileUpload';

interface UploadedFile {
  url: string;
  path: string;
  name: string;
}

interface MultiFileUploadProps {
  onFilesChange: (files: UploadedFile[]) => void;
  currentFiles?: UploadedFile[];
  label?: string;
  description?: string;
  accept?: string;
  submissionId?: string;
  maxFiles?: number;
}

export const MultiFileUpload: React.FC<MultiFileUploadProps> = ({
  onFilesChange,
  currentFiles = [],
  label = "Upload Documents",
  description = "Upload PDF, DOC, DOCX, JPG, or PNG files (max 10MB each)",
  accept = ".pdf,.doc,.docx,.jpg,.jpeg,.png",
  submissionId,
  maxFiles = 5
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, deleteFile, getSignedUrl, uploading } = useFileUpload();
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = async (files: FileList) => {
    if (currentFiles.length >= maxFiles) {
      return;
    }

    const filesToUpload = Array.from(files).slice(0, maxFiles - currentFiles.length);
    const uploadedFiles: UploadedFile[] = [];

    for (const file of filesToUpload) {
      const result = await uploadFile(file, submissionId);
      if (result) {
        uploadedFiles.push({
          url: result.url,
          path: result.path,
          name: file.name
        });
      }
    }

    if (uploadedFiles.length > 0) {
      onFilesChange([...currentFiles, ...uploadedFiles]);
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
    
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files);
    }
  };

  const handleRemoveFile = async (index: number) => {
    const fileToRemove = currentFiles[index];
    if (fileToRemove.path) {
      await deleteFile(fileToRemove.path);
    }
    const updatedFiles = currentFiles.filter((_, i) => i !== index);
    onFilesChange(updatedFiles);
  };

  const handleViewFile = async (file: UploadedFile) => {
    const pathToUse = file.path || file.url;
    if (pathToUse) {
      const signedUrl = await getSignedUrl(pathToUse);
      if (signedUrl) {
        window.open(signedUrl, '_blank');
      }
    }
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">{label}</label>
      
      {/* Uploaded Files List */}
      {currentFiles.length > 0 && (
        <div className="space-y-2">
          {currentFiles.map((file, index) => (
            <Card key={index}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <File className="w-6 h-6 text-blue-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{file.name}</p>
                      <p className="text-xs text-gray-500">Document {index + 1}</p>
                    </div>
                  </div>
                  <div className="flex space-x-1 flex-shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewFile(file)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFile(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Area */}
      {currentFiles.length < maxFiles && (
        <Card
          className={`border-2 border-dashed transition-colors cursor-pointer ${
            dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <CardContent className="p-6 text-center">
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
                  <p className="text-xs text-gray-500 mt-1">
                    {currentFiles.length} of {maxFiles} files uploaded
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={handleFileInputChange}
        disabled={uploading || currentFiles.length >= maxFiles}
      />
    </div>
  );
};
