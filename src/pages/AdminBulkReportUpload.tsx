import { useState, useCallback, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  Upload, 
  FileText, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Archive,
  Loader2,
  Brain,
  FileSearch,
  HelpCircle
} from 'lucide-react';
import JSZip from 'jszip';

interface ReportFile {
  file: File;
  fileName: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'classifying' | 'error';
  filePath?: string;
  error?: string;
}

interface MappingResult {
  documentId: string;
  fileName: string;
  reportType: 'similarity' | 'ai' | 'unknown';
  percentage: number | null;
  success: boolean;
  message?: string;
}

interface ProcessingResult {
  success: boolean;
  mapped: MappingResult[];
  unmatched: { fileName: string; documentKey: string; filePath: string; reportType: string }[];
  needsReview: { documentId: string; reason: string }[];
  completedDocuments: string[];
  stats: {
    totalReports: number;
    mappedCount: number;
    unmatchedCount: number;
    completedCount: number;
    needsReviewCount: number;
    classifiedAsSimilarity: number;
    classifiedAsAI: number;
    classifiedAsUnknown: number;
  };
}

/**
 * Extract document_key from filename for preview
 * 
 * Rules:
 * 1. Remove file extension
 * 2. Remove trailing numbers in round brackets: (1), (2), (45)
 * 3. Remove surrounding brackets if present: (), []
 * 4. Normalize casing and spaces
 */
function extractDocumentKey(filename: string): string {
  let result = filename;
  
  // Remove file extension
  result = result.replace(/\.[^.]+$/, '');
  
  // Remove ALL trailing "(number)" patterns
  while (/\s*\(\d+\)\s*$/.test(result)) {
    result = result.replace(/\s*\(\d+\)\s*$/, '');
  }
  
  // Remove leading/trailing brackets
  result = result.replace(/^\[([^\]]*)\]$/, '$1');
  result = result.replace(/^\(([^)]*)\)$/, '$1');
  result = result.replace(/^\[Guest\]\s*/i, '');
  
  // Normalize
  result = result.toLowerCase();
  result = result.replace(/\s+/g, ' ').trim();
  
  return result;
}

export default function AdminBulkReportUpload() {
  const [files, setFiles] = useState<ReportFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState<'uploading' | 'classifying' | 'mapping'>('uploading');
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const extractZipFiles = async (zipFile: File): Promise<File[]> => {
    const zip = new JSZip();
    const contents = await zip.loadAsync(zipFile);
    const pdfFiles: File[] = [];

    for (const [filename, file] of Object.entries(contents.files)) {
      if (!file.dir && filename.toLowerCase().endsWith('.pdf')) {
        const blob = await file.async('blob');
        const extractedFile = new File([blob], filename.split('/').pop() || filename, { type: 'application/pdf' });
        pdfFiles.push(extractedFile);
      }
    }

    return pdfFiles;
  };

  const processFiles = async (incomingFiles: FileList | File[]) => {
    const newFiles: ReportFile[] = [];

    for (const file of Array.from(incomingFiles)) {
      if (file.type === 'application/zip' || file.name.toLowerCase().endsWith('.zip')) {
        try {
          const extractedFiles = await extractZipFiles(file);
          for (const extractedFile of extractedFiles) {
            newFiles.push({
              file: extractedFile,
              fileName: extractedFile.name,
              status: 'pending',
            });
          }
          toast.success(`Extracted ${extractedFiles.length} PDF files from ${file.name}`);
        } catch (error) {
          console.error('Error extracting ZIP:', error);
          toast.error(`Failed to extract ${file.name}`);
        }
      } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        newFiles.push({
          file,
          fileName: file.name,
          status: 'pending',
        });
      } else {
        toast.error(`Unsupported file type: ${file.name}`);
      }
    }

    setFiles(prev => [...prev, ...newFiles]);
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files);
    }
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(e.target.files);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setFiles([]);
    setProcessingResult(null);
    setUploadProgress(0);
  };

  const uploadAndProcess = async () => {
    if (files.length === 0) {
      toast.error('No files to process');
      return;
    }

    setProcessing(true);
    setUploadProgress(0);
    setProcessingResult(null);
    setProcessingStage('uploading');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in to upload reports');
        setProcessing(false);
        return;
      }

      const uploadedReports: { fileName: string; filePath: string }[] = [];
      const totalFiles = files.length;

      // Stage 1: Upload files to storage
      for (let i = 0; i < files.length; i++) {
        const reportFile = files[i];
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'uploading' } : f
        ));

        const timestamp = Date.now();
        const sanitizedName = reportFile.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `bulk-reports/${timestamp}_${sanitizedName}`;

        const { error: uploadError } = await supabase.storage
          .from('reports')
          .upload(filePath, reportFile.file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? { ...f, status: 'error', error: uploadError.message } : f
          ));
          continue;
        }

        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'uploaded', filePath } : f
        ));

        uploadedReports.push({
          fileName: reportFile.fileName,
          filePath,
        });

        setUploadProgress(Math.round(((i + 1) / totalFiles) * 40));
      }

      if (uploadedReports.length === 0) {
        toast.error('No files were uploaded successfully');
        setProcessing(false);
        return;
      }

      // Stage 2: Call edge function for classification and mapping
      setProcessingStage('classifying');
      setUploadProgress(50);
      
      // Update file statuses to classifying
      setFiles(prev => prev.map(f => 
        f.status === 'uploaded' ? { ...f, status: 'classifying' } : f
      ));

      toast.info('Analyzing PDF content for classification...', {
        duration: 5000,
      });

      const { data, error } = await supabase.functions.invoke('bulk-report-upload', {
        body: { reports: uploadedReports },
      });

      if (error) {
        console.error('Processing error:', error);
        toast.error('Failed to process reports: ' + error.message);
        setProcessing(false);
        return;
      }

      setProcessingStage('mapping');
      setUploadProgress(100);
      setProcessingResult(data as ProcessingResult);

      const stats = data.stats;
      
      // Show detailed results
      if (stats.completedCount > 0) {
        toast.success(`Completed ${stats.completedCount} documents with both reports!`);
      }
      if (stats.mappedCount > 0 && stats.mappedCount > stats.completedCount * 2) {
        toast.success(`Mapped ${stats.mappedCount} reports to documents`);
      }
      if (stats.classifiedAsSimilarity > 0 || stats.classifiedAsAI > 0) {
        toast.info(`Classified: ${stats.classifiedAsSimilarity} Similarity, ${stats.classifiedAsAI} AI reports`);
      }
      if (stats.classifiedAsUnknown > 0) {
        toast.warning(`${stats.classifiedAsUnknown} reports could not be classified`);
      }
      if (stats.unmatchedCount > 0) {
        toast.warning(`${stats.unmatchedCount} reports could not be matched`);
      }
      if (stats.needsReviewCount > 0) {
        toast.warning(`${stats.needsReviewCount} documents need manual review`);
      }

    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred during processing');
    } finally {
      setProcessing(false);
    }
  };

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const uploadedCount = files.filter(f => f.status === 'uploaded' || f.status === 'classifying').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case 'similarity':
        return <FileSearch className="h-3 w-3" />;
      case 'ai':
        return <Brain className="h-3 w-3" />;
      default:
        return <HelpCircle className="h-3 w-3" />;
    }
  };

  const getReportTypeBadge = (type: string, percentage?: number | null) => {
    const percentText = percentage !== null && percentage !== undefined ? ` (${percentage}%)` : '';
    
    switch (type) {
      case 'similarity':
        return (
          <Badge variant="default" className="bg-blue-600">
            <FileSearch className="h-3 w-3 mr-1" />
            Similarity{percentText}
          </Badge>
        );
      case 'ai':
        return (
          <Badge variant="default" className="bg-purple-600">
            <Brain className="h-3 w-3 mr-1" />
            AI{percentText}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <HelpCircle className="h-3 w-3 mr-1" />
            Unknown
          </Badge>
        );
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Bulk Report Upload</h1>
          <p className="text-muted-foreground">
            Upload PDF reports for automatic grouping by filename and classification by content analysis
          </p>
        </div>

        {/* Info Card */}
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="pt-4">
            <div className="flex gap-3">
              <Brain className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">Two-Stage Processing</p>
                <p className="text-muted-foreground">
                  <strong>Stage 1:</strong> Reports are grouped with documents using filename matching (removes extensions and trailing numbers like "(1)").
                  <br />
                  <strong>Stage 2:</strong> Each PDF is analyzed using AI to classify it as Similarity or AI report and extract percentages.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upload Area */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Reports
            </CardTitle>
            <CardDescription>
              Drag and drop PDF files or ZIP archives. Reports will be automatically matched and classified.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.zip"
                className="hidden"
                onChange={handleFileSelect}
              />
              
              <div className="flex flex-col items-center gap-3">
                <div className="p-4 bg-muted rounded-full">
                  <Archive className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Drop PDF files or ZIP archives here</p>
                  <p className="text-sm text-muted-foreground">
                    or click to browse
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={processing}
                >
                  Select Files
                </Button>
              </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">
                    Files ({files.length})
                    {uploadedCount > 0 && (
                      <span className="text-muted-foreground ml-2">
                        • {uploadedCount} uploaded
                      </span>
                    )}
                    {errorCount > 0 && (
                      <span className="text-destructive ml-2">
                        • {errorCount} failed
                      </span>
                    )}
                  </h4>
                  <Button variant="ghost" size="sm" onClick={clearAll} disabled={processing}>
                    Clear All
                  </Button>
                </div>
                
                <ScrollArea className="h-[200px] border rounded-lg">
                  <div className="p-3 space-y-2">
                    {files.map((file, index) => (
                      <div 
                        key={index}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{file.fileName}</p>
                            <p className="text-xs text-muted-foreground">
                              Key: <span className="font-mono">{extractDocumentKey(file.fileName)}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {file.status === 'pending' && (
                            <Badge variant="secondary">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                          {file.status === 'uploading' && (
                            <Badge variant="secondary">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Uploading
                            </Badge>
                          )}
                          {file.status === 'uploaded' && (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Uploaded
                            </Badge>
                          )}
                          {file.status === 'classifying' && (
                            <Badge variant="secondary" className="bg-purple-600 text-white">
                              <Brain className="h-3 w-3 mr-1 animate-pulse" />
                              Classifying
                            </Badge>
                          )}
                          {file.status === 'error' && (
                            <Badge variant="destructive">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Error
                            </Badge>
                          )}
                          {!processing && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeFile(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Progress */}
                {processing && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        {processingStage === 'uploading' && 'Uploading files...'}
                        {processingStage === 'classifying' && 'Analyzing PDFs with AI...'}
                        {processingStage === 'mapping' && 'Mapping reports to documents...'}
                      </span>
                      <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} />
                  </div>
                )}

                {/* Action Button */}
                <div className="mt-4 flex justify-end">
                  <Button 
                    onClick={uploadAndProcess}
                    disabled={processing || pendingCount === 0}
                    size="lg"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload & Classify ({pendingCount} files)
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Processing Results */}
        {processingResult && (
          <Card>
            <CardHeader>
              <CardTitle>Processing Results</CardTitle>
              <CardDescription>
                Summary of the auto-mapping and classification process
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{processingResult.stats.totalReports}</p>
                  <p className="text-sm text-muted-foreground">Total Reports</p>
                </div>
                <div className="text-center p-4 bg-green-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{processingResult.stats.mappedCount}</p>
                  <p className="text-sm text-muted-foreground">Mapped</p>
                </div>
                <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{processingResult.stats.completedCount}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
                <div className="text-center p-4 bg-yellow-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">{processingResult.stats.unmatchedCount}</p>
                  <p className="text-sm text-muted-foreground">Unmatched</p>
                </div>
              </div>

              {/* Classification Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="flex items-center gap-2 p-3 bg-blue-500/10 rounded-lg">
                  <FileSearch className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-lg font-bold text-blue-600">{processingResult.stats.classifiedAsSimilarity}</p>
                    <p className="text-xs text-muted-foreground">Similarity Reports</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-purple-500/10 rounded-lg">
                  <Brain className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-lg font-bold text-purple-600">{processingResult.stats.classifiedAsAI}</p>
                    <p className="text-xs text-muted-foreground">AI Reports</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-gray-500/10 rounded-lg">
                  <HelpCircle className="h-5 w-5 text-gray-600" />
                  <div>
                    <p className="text-lg font-bold text-gray-600">{processingResult.stats.classifiedAsUnknown}</p>
                    <p className="text-xs text-muted-foreground">Unknown</p>
                  </div>
                </div>
              </div>

              {/* Mapped Reports */}
              {processingResult.mapped.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Successfully Mapped ({processingResult.mapped.length})
                  </h4>
                  <ScrollArea className="h-[150px] border rounded-lg">
                    <div className="p-3 space-y-2">
                      {processingResult.mapped.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-2 rounded bg-green-500/10">
                          <span className="text-sm truncate flex-1">{item.fileName}</span>
                          {getReportTypeBadge(item.reportType, item.percentage)}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Unmatched Reports */}
              {processingResult.unmatched.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    Unmatched Reports ({processingResult.unmatched.length})
                  </h4>
                  <ScrollArea className="h-[150px] border rounded-lg">
                    <div className="p-3 space-y-2">
                      {processingResult.unmatched.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-2 rounded bg-yellow-500/10">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm truncate block">{item.fileName}</span>
                            <span className="text-xs text-muted-foreground">Key: {item.documentKey}</span>
                          </div>
                          {getReportTypeBadge(item.reportType)}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Needs Review */}
              {processingResult.needsReview.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    Needs Manual Review ({processingResult.needsReview.length})
                  </h4>
                  <ScrollArea className="h-[150px] border rounded-lg">
                    <div className="p-3 space-y-2">
                      {processingResult.needsReview.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-2 rounded bg-red-500/10">
                          <span className="text-sm text-red-700">{item.reason}</span>
                          <Badge variant="outline" className="text-xs">
                            {item.documentId.slice(0, 8)}...
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
