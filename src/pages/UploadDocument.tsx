import React, { useState, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDocuments } from '@/hooks/useDocuments';
import { useAuth } from '@/contexts/AuthContext';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function UploadDocument() {
  const { profile } = useAuth();
  const { uploadDocument } = useDocuments();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setUploadSuccess(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadSuccess(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    const { success } = await uploadDocument(selectedFile);
    setUploading(false);
    
    if (success) {
      setUploadSuccess(true);
      setSelectedFile(null);
    }
  };

  const hasCredits = (profile?.credit_balance || 0) >= 1;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Upload Document</h1>
          <p className="text-muted-foreground mt-1">
            Submit a document for plagiarism and AI detection
          </p>
        </div>

        {/* Credit Check */}
        {!hasCredits && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div className="flex-1">
                <p className="font-medium text-destructive">Insufficient Credits</p>
                <p className="text-sm text-muted-foreground">
                  You need at least 1 credit to upload a document
                </p>
              </div>
              <Button asChild>
                <Link to="/dashboard/credits">Buy Credits</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Upload Success */}
        {uploadSuccess && (
          <Card className="border-secondary bg-secondary/5">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-secondary" />
              <div className="flex-1">
                <p className="font-medium text-secondary">Document Uploaded Successfully!</p>
                <p className="text-sm text-muted-foreground">
                  Your document is now in the queue and will be processed soon.
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link to="/dashboard/documents">View Documents</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Upload Area */}
        <Card>
          <CardHeader>
            <CardTitle>Upload File</CardTitle>
            <CardDescription>
              Supported formats: PDF, DOC, DOCX, TXT
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                dragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              } ${!hasCredits ? 'opacity-50 pointer-events-none' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleChange}
                disabled={!hasCredits}
              />
              
              {selectedFile ? (
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-3 px-4 py-3 rounded-lg bg-muted">
                    <FileText className="h-8 w-8 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 justify-center">
                    <Button
                      variant="outline"
                      onClick={() => setSelectedFile(null)}
                      disabled={uploading}
                    >
                      Remove
                    </Button>
                    <Button onClick={handleUpload} disabled={uploading}>
                      {uploading ? 'Uploading...' : 'Upload Document'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-lg">Drag and drop your file here</p>
                    <p className="text-muted-foreground">or</p>
                  </div>
                  <Button onClick={() => inputRef.current?.click()}>
                    Browse Files
                  </Button>
                </div>
              )}
            </div>

            <div className="mt-6 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Cost per document</p>
                  <p className="text-xs text-muted-foreground">Includes similarity + AI detection</p>
                </div>
                <p className="text-2xl font-bold">1 Credit</p>
              </div>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                <p className="text-sm">Your balance</p>
                <p className="font-semibold">{profile?.credit_balance || 0} Credits</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}