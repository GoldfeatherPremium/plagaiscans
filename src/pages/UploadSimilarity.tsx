import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, FileText, AlertCircle, CheckCircle, Loader2, Coins, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useSimilarityDocuments } from '@/hooks/useSimilarityDocuments';
import { toast } from '@/hooks/use-toast';
import { SEO } from '@/components/SEO';

const UploadSimilarity: React.FC = () => {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const { uploadSimilarityDocument } = useSimilarityDocuments();
  
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState<{ success: number; failed: number } | null>(null);

  const similarityCreditBalance = profile?.similarity_credit_balance || 0;
  const maxFilesAllowed = similarityCreditBalance;

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => {
      const ext = file.name.toLowerCase().split('.').pop();
      return ['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext || '');
    });

    if (validFiles.length !== fileArray.length) {
      toast({
        title: 'Invalid files',
        description: 'Only PDF, DOC, DOCX, TXT, RTF files are allowed',
        variant: 'destructive',
      });
    }

    setSelectedFiles(prev => {
      const combined = [...prev, ...validFiles];
      const unique = combined.filter((file, index, arr) =>
        arr.findIndex(f => f.name === file.name && f.size === file.size) === index
      );
      if (unique.length > maxFilesAllowed) {
        toast({
          title: 'File limit reached',
          description: `You can only upload ${maxFilesAllowed} files with your current similarity credits`,
          variant: 'destructive',
        });
        return unique.slice(0, maxFilesAllowed);
      }
      return unique;
    });
  }, [maxFilesAllowed]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
    }
  }, [addFiles]);

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    if (similarityCreditBalance < selectedFiles.length) {
      toast({
        title: 'Insufficient similarity credits',
        description: 'Please purchase more similarity credits to upload documents',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadResults(null);

    let success = 0;
    let failed = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      try {
        await uploadSimilarityDocument(selectedFiles[i]);
        success++;
      } catch (error) {
        failed++;
        console.error('Upload error:', error);
      }
      setUploadProgress(((i + 1) / selectedFiles.length) * 100);
    }

    setUploadResults({ success, failed });
    setUploading(false);
    await refreshProfile();

    if (success > 0) {
      toast({
        title: 'Upload complete',
        description: `${success} document(s) uploaded for similarity check`,
      });
    }
  };

  return (
    <DashboardLayout>
      <SEO 
        title="Upload for Similarity Check" 
        description="Upload documents for similarity detection only"
      />
      
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Similarity Check Only</h1>
          <p className="text-muted-foreground mt-1">Upload documents for plagiarism/similarity detection only (no AI detection)</p>
        </div>

        {/* Credit Balance */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Search className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Similarity Credits</p>
                  <p className="text-2xl font-bold text-primary">{similarityCreditBalance}</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => navigate('/dashboard/credits')}>
                Buy More Credits
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Upload Results */}
        {uploadResults && (
          <Card className={uploadResults.failed > 0 ? 'border-destructive' : 'border-green-500'}>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">Upload Complete</p>
                  <p className="text-sm text-muted-foreground">
                    {uploadResults.success} succeeded, {uploadResults.failed} failed
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  className="ml-auto"
                  onClick={() => navigate('/dashboard/documents')}
                >
                  View Documents
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Insufficient Credits Warning */}
        {similarityCreditBalance === 0 && (
          <Card className="border-destructive">
            <CardContent className="py-4">
              <div className="flex items-center gap-3 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <div>
                  <p className="font-medium">No Similarity Credits</p>
                  <p className="text-sm">You need similarity credits to upload documents for similarity checking</p>
                </div>
                <Button variant="destructive" className="ml-auto" onClick={() => navigate('/dashboard/credits')}>
                  Buy Credits
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Progress */}
        {uploading && (
          <Card>
            <CardContent className="py-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading documents...
                  </span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Drop Zone */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Documents</CardTitle>
            <CardDescription>
              Drop files here or click to browse. Only similarity check will be performed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`
                relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
                ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
                ${similarityCreditBalance === 0 ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-primary/50'}
              `}
            >
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.rtf"
                onChange={handleChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={similarityCreditBalance === 0}
              />
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Drop files here or click to upload</p>
              <p className="text-sm text-muted-foreground mt-1">
                PDF, DOC, DOCX, TXT, RTF • Max {maxFilesAllowed} files
              </p>
              <Badge variant="secondary" className="mt-3">
                <Search className="h-3 w-3 mr-1" />
                Similarity Check Only
              </Badge>
            </div>

            {/* Selected Files */}
            {selectedFiles.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Selected Files ({selectedFiles.length})</p>
                  <Badge variant="outline">{selectedFiles.length} credit(s) will be used</Badge>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(index)}
                        disabled={uploading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || uploading || similarityCreditBalance < selectedFiles.length}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload for Similarity Check
              </>
            )}
          </Button>
        </div>

        {/* Info Card */}
        <Card className="bg-muted/50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Search className="h-5 w-5 text-primary mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Similarity Check Only</p>
                <p className="text-muted-foreground mt-1">
                  This upload uses similarity-only credits and will only check for plagiarism/similarity.
                  No AI content detection will be performed. Each document costs 1 similarity credit.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default UploadSimilarity;
