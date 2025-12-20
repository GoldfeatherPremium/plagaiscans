import React, { useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useMagicLinkUpload } from '@/hooks/useMagicLinks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Upload,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  File,
  X,
  Loader2,
} from 'lucide-react';

const GuestUpload: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { linkData, loading, uploading, error, uploadFile, remainingUploads } = useMagicLinkUpload(token);

  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setUploadSuccess(false);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadSuccess(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const success = await uploadFile(selectedFile);
    if (success) {
      setSelectedFile(null);
      setUploadSuccess(true);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setUploadSuccess(false);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mb-4" />
            <p className="text-muted-foreground">Validating upload link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error && !linkData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-destructive">Upload Not Available</CardTitle>
            <CardDescription className="text-base">{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              This upload link may have expired, reached its limit, or been disabled.
            </p>
            <Link to="/">
              <Button variant="outline">Go to Homepage</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Limit reached after upload
  if (error === 'Upload limit reached' && linkData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-accent" />
            </div>
            <CardTitle>Upload Limit Reached</CardTitle>
            <CardDescription className="text-base">
              You have successfully uploaded {linkData.max_uploads} file(s).
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Thank you! Your files have been submitted for processing.
            </p>
            <Link to="/">
              <Button variant="outline">Go to Homepage</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
              <FileCheck className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-2xl">PlagaiScans</span>
          </Link>
          <h1 className="text-2xl font-bold">Guest Upload</h1>
          <p className="text-muted-foreground mt-2">
            Upload your document for plagiarism checking
          </p>
        </div>

        {/* Upload Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Upload Document</CardTitle>
                <CardDescription>
                  {remainingUploads} upload{remainingUploads !== 1 ? 's' : ''} remaining
                </CardDescription>
              </div>
              <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                Guest Upload
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Progress indicator */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Upload progress</span>
                <span className="font-medium">
                  {linkData?.current_uploads || 0} / {linkData?.max_uploads || 0}
                </span>
              </div>
              <Progress
                value={
                  linkData
                    ? (linkData.current_uploads / linkData.max_uploads) * 100
                    : 0
                }
                className="h-2"
              />
            </div>

            {/* Success message */}
            {uploadSuccess && (
              <div className="bg-secondary/10 border border-secondary/30 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-secondary" />
                <div>
                  <p className="font-medium text-secondary">Upload Successful!</p>
                  <p className="text-sm text-muted-foreground">
                    Your file has been submitted for processing.
                  </p>
                </div>
              </div>
            )}

            {/* Drop zone */}
            <div
              className={`relative border-2 border-dashed rounded-xl p-8 transition-all ${
                dragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id="file-upload"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleFileChange}
                accept=".doc,.docx,.pdf,.txt,.rtf"
                disabled={uploading}
              />

              {selectedFile ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <File className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium truncate max-w-[200px]">
                        {selectedFile.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearFile}
                    disabled={uploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="font-medium">
                    Drag and drop your file here
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground mt-4">
                    Supported: DOC, DOCX, PDF, TXT, RTF
                  </p>
                </div>
              )}
            </div>

            {/* Upload button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </>
              )}
            </Button>

            {/* Info */}
            <p className="text-xs text-muted-foreground text-center">
              By uploading, you agree that your document will be processed for plagiarism checking.
              Files are stored securely and handled confidentially.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GuestUpload;
