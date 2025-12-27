import { useState, useCallback, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  Upload, 
  FileText, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  FileWarning,
  Archive,
  Loader2,
  Brain,
  FileSearch
} from 'lucide-react';
import JSZip from 'jszip';

interface ReportFile {
  file: File;
  fileName: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  filePath?: string;
  error?: string;
}

interface ReportClassification {
  type: 'ai' | 'similarity' | 'unknown';
  percentage: number | null;
}

interface MappingResult {
  documentId: string;
  fileName: string;
  reportType: 'similarity' | 'ai';
  percentage: number | null;
  success: boolean;
  message?: string;
}

interface ProcessingResult {
  success: boolean;
  mapped: MappingResult[];
  unmatched: { fileName: string; normalizedFilename: string; filePath: string; classification?: ReportClassification }[];
  needsReview: { documentId: string; reason: string }[];
  completedDocuments: string[];
  stats: {
    totalReports: number;
    mappedCount: number;
    unmatchedCount: number;
    completedCount: number;
    needsReviewCount: number;
  };
}

/**
 * Normalize REPORT filename (removes extension + trailing report suffixes).
 */
function normalizeReportFilename(filename: string): string {
  let result = filename.toLowerCase();
  result = result.replace(/\.[^.]+$/, '');
  result = result.replace(/\.+$/, '.');
  result = result.replace(/_-?\d+$/, '');
  result = result.replace(/\s*\(\d+\)$/, '');
  result = result.replace(/\.+$/, '');
  return result.trim();
}

function normalizeFilename(filename: string): string {
  return normalizeReportFilename(filename);
}

export default function AdminBulkReportUpload() {
  const [files, setFiles] = useState<ReportFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in to upload reports');
        setProcessing(false);
        return;
      }

      const uploadedReports: { fileName: string; filePath: string; normalizedFilename: string }[] = [];
      const totalFiles = files.length;

      // Upload each file to storage
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
          normalizedFilename: normalizeFilename(reportFile.fileName),
        });

        setUploadProgress(Math.round(((i + 1) / totalFiles) * 50));
      }

      if (uploadedReports.length === 0) {
        toast.error('No files were uploaded successfully');
        setProcessing(false);
        return;
      }

      // Call edge function for auto-mapping with classification
      setUploadProgress(60);
      
      const { data, error } = await supabase.functions.invoke('bulk-report-upload', {
        body: { reports: uploadedReports },
      });

      if (error) {
        console.error('Processing error:', error);
        toast.error('Failed to process reports: ' + error.message);
        setProcessing(false);
        return;
      }

      setUploadProgress(100);
      setProcessingResult(data as ProcessingResult);

      const stats = data.stats;
      if (stats.completedCount > 0) {
        toast.success(`Successfully completed ${stats.completedCount} documents with auto-extracted percentages!`);
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
  const uploadedCount = files.filter(f => f.status === 'uploaded').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  const getReportTypeIcon = (type: 'similarity' | 'ai') => {
    return type === 'ai' ? (
      <Brain className="h-3 w-3" />
    ) : (
      <FileSearch className="h-3 w-3" />
    );
  };

  const getReportTypeBadge = (type: 'similarity' | 'ai', percentage: number | null) => {
    const isAI = type === 'ai';
    return (
      <Badge 
        variant="outline" 
        className={isAI ? 'border-purple-500 text-purple-600 bg-purple-50' : 'border-blue-500 text-blue-600 bg-blue-50'}
      >
        {getReportTypeIcon(type)}
        <span className="ml-1">
          {isAI ? 'AI' : 'Similarity'}
          {percentage !== null && `: ${percentage}%`}
        </span>
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Bulk Report Upload</h1>
          <p className="text-muted-foreground">
            Upload PDF reports for automatic classification, percentage extraction, and document matching
          </p>
        </div>

        {/* Upload Area */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Reports
            </CardTitle>
            <CardDescription>
              Drag and drop PDF files or ZIP archives. Reports will be automatically classified (AI/Similarity) 
              and percentages extracted from page 2.
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
                    Auto-classifies AI vs Similarity reports and extracts percentages
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
                              Normalized: {normalizeFilename(file.fileName)}
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
                        {uploadProgress < 60 ? 'Uploading files...' : 'Classifying & extracting percentages...'}
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
                        Upload & Auto-Classify ({pendingCount} files)
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
                Reports classified, percentages extracted, and documents updated
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
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
                <div className="text-center p-4 bg-red-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{processingResult.stats.needsReviewCount}</p>
                  <p className="text-sm text-muted-foreground">Needs Review</p>
                </div>
              </div>

              {/* Mapped Reports */}
              {processingResult.mapped.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Successfully Mapped ({processingResult.mapped.length})
                  </h4>
                  <ScrollArea className="h-[200px] border rounded-lg">
                    <div className="p-3 space-y-2">
                      {processingResult.mapped.map((result, index) => (
                        <div 
                          key={index}
                          className="flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/20"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="h-4 w-4 shrink-0 text-green-600" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{result.fileName}</p>
                              {result.message && (
                                <p className="text-xs text-muted-foreground">{result.message}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getReportTypeBadge(result.reportType, result.percentage)}
                          </div>
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
                    <FileWarning className="h-4 w-4 text-yellow-600" />
                    Unmatched Reports ({processingResult.unmatched.length})
                  </h4>
                  <ScrollArea className="h-[150px] border rounded-lg">
                    <div className="p-3 space-y-2">
                      {processingResult.unmatched.map((report, index) => (
                        <div 
                          key={index}
                          className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="h-4 w-4 shrink-0 text-yellow-600" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{report.fileName}</p>
                              <p className="text-xs text-muted-foreground">
                                Normalized: {report.normalizedFilename}
                              </p>
                            </div>
                          </div>
                          {report.classification && report.classification.type !== 'unknown' && (
                            <div className="flex items-center gap-2">
                              {getReportTypeBadge(
                                report.classification.type as 'similarity' | 'ai', 
                                report.classification.percentage
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground mt-2">
                    These reports have been saved and can be manually assigned from the Unmatched Reports page.
                  </p>
                </div>
              )}

              {/* Needs Review */}
              {processingResult.needsReview.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    Needs Manual Review ({processingResult.needsReview.length})
                  </h4>
                  <ScrollArea className="h-[100px] border rounded-lg">
                    <div className="p-3 space-y-2">
                      {processingResult.needsReview.map((item, index) => (
                        <div 
                          key={index}
                          className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/20"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">Document ID: {item.documentId.slice(0, 8)}...</p>
                            <p className="text-xs text-muted-foreground">{item.reason}</p>
                          </div>
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
