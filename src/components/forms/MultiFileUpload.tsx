import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, File, X, Loader2, Eye } from 'lucide-react';
import { useFileUpload } from '@/hooks/useFileUpload';

interface FileData {
  url: string;
  path: string;
  name: string;
}

interface MultiFileUploadProps {
  onFilesChange: (files: FileData[]) => void;
  currentFiles?: FileData[];
  label?: string;
  description?: string;
  accept?: string;
  submissionId?: string;
  maxFiles?: number;
}

export const MultiFileUpload: React.FC<MultiFileUploadProps> = ({
  onFilesChange,
  currentFiles = [],
  label = "Upload Additional Documents",
  description = "Upload PDF, DOC, DOCX, JPG, or PNG files (max 10MB each)",
  accept = ".pdf,.doc,.docx,.jpg,.jpeg,.png",
  submissionId,
  maxFiles = 5
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, deleteFile, getSignedUrl, uploading } = useFileUpload();
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = async (files: FileList) => {
    if (currentFiles.length + files.length > maxFiles) {
      alert(`You can only upload up to ${maxFiles} files`);
      return;
    }

    const newFiles: FileData[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = await uploadFile(file, submissionId);
      if (result) {
        newFiles.push({
          url: result.url,
          path: result.path,
          name: file.name
        });
      }
    }

    if (newFiles.length > 0) {
      onFilesChange([...currentFiles, ...newFiles]);
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files);
    }
    // Reset input value to allow selecting the same file again
    event.target.value = '';
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
    const success = await deleteFile(fileToRemove.path);
    if (success) {
      const updatedFiles = currentFiles.filter((_, i) => i !== index);
      onFilesChange(updatedFiles);
    }
  };

  const handleViewFile = async (filePath: string) => {
    const signedUrl = await getSignedUrl(filePath);
    if (signedUrl) {
      window.open(signedUrl, '_blank');
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      
      {/* Display uploaded files */}
      {currentFiles.length > 0 && (
        <div className="space-y-2 mb-4">
          {currentFiles.map((file, index) => (
            <Card key={index}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                    <File className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-xs sm:text-sm truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">File uploaded</p>
                    </div>
                  </div>
                  <div className="flex space-x-1 sm:space-x-2 flex-shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewFile(file.path)}
                      className="h-8 w-8 p-0"
                    >
                      <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveFile(index)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload area */}
      {currentFiles.length < maxFiles && (
        <Card
          className={`border-2 border-dashed transition-colors cursor-pointer ${
            dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <CardContent className="p-6 text-center">
            {uploading ? (
              <div className="flex flex-col items-center space-y-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Uploading...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-2">
                <Upload className="w-8 h-8 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    Drop files here or <span className="text-primary">browse</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
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
