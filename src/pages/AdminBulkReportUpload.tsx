import { useState, useCallback, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  FileCheck,
  Scan,
  AlertTriangle,
  Eye,
  Percent
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
  reportType: 'similarity' | 'ai' | 'unknown';
  percentage: number | null;
  ocrText: string;
  isUnreadable: boolean;
}

interface DryRunReport {
  fileName: string;
  filePath: string;
  classification: ReportClassification;
  action: 'assign_similarity' | 'assign_ai' | 'skip_duplicate' | 'unmatched' | 'needs_review';
  reason?: string;
}

interface DryRunResult {
  documentId: string;
  documentFileName: string;
  reports: DryRunReport[];
  willComplete: boolean;
  hasConflict: boolean;
  conflictReason?: string;
}

interface CommittedResult {
  documentId: string;
  similarityAssigned: boolean;
  aiAssigned: boolean;
  newStatus: string;
}

interface ProcessingResult {
  success: boolean;
  dryRun: DryRunResult[];
  committed: CommittedResult[];
  unmatched: { fileName: string; normalizedFilename: string; filePath: string; reason: string }[];
  needsReview: { documentId: string; reason: string }[];
  stats: {
    totalReports: number;
    similarityDetected: number;
    aiDetected: number;
    unknownType: number;
    unreadable: number;
    mappedCount: number;
    unmatchedCount: number;
    completedCount: number;
    needsReviewCount: number;
  };
}

/**
 * Normalize filename:
 * - Remove file extension
 * - Remove trailing (number) patterns
 * - Remove leading brackets
 * - Normalize spaces and casing
 */
function normalizeFilename(filename: string): string {
  let result = filename.toLowerCase();
  result = result.replace(/\.[^.]+$/, '');
  result = result.replace(/\s*\(\d+\)\s*$/g, '');
  if (result.startsWith('(') && result.includes(')')) {
    result = result.replace(/^\(([^)]+)\)/, '$1');
  }
  if (result.startsWith('[') && result.includes(']')) {
    result = result.replace(/^\[([^\]]+)\]/, '$1');
  }
  result = result.replace(/\s+/g, ' ');
  result = result.trim();
  return result;
}

export default function AdminBulkReportUpload() {
  const [files, setFiles] = useState<ReportFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState<string>('');
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
    setProcessingStage('');
  };

  const uploadAndProcess = async () => {
    if (files.length === 0) {
      toast.error('No files to process');
      return;
    }

    setProcessing(true);
    setUploadProgress(0);
    setProcessingResult(null);
    setProcessingStage('Uploading files...');

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
        setProcessingStage(`Uploading ${i + 1}/${totalFiles}: ${reportFile.fileName}`);
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

        setUploadProgress(Math.round(((i + 1) / totalFiles) * 30));
      }

      if (uploadedReports.length === 0) {
        toast.error('No files were uploaded successfully');
        setProcessing(false);
        return;
      }

      // Call edge function for OCR-based processing
      setProcessingStage('Running OCR on page 2 of each report...');
      setUploadProgress(35);
      
      const { data, error } = await supabase.functions.invoke('bulk-report-upload', {
        body: { reports: uploadedReports },
      });

      if (error) {
        console.error('Processing error:', error);
        toast.error('Failed to process reports: ' + error.message);
        setProcessing(false);
        return;
      }

      setProcessingStage('Processing complete!');
      setUploadProgress(100);
      setProcessingResult(data as ProcessingResult);

      const stats = data.stats;
      if (stats.completedCount > 0) {
        toast.success(`Successfully completed ${stats.completedCount} documents!`);
      }
      if (stats.unmatchedCount > 0) {
        toast.warning(`${stats.unmatchedCount} reports could not be matched`);
      }
      if (stats.needsReviewCount > 0) {
        toast.warning(`${stats.needsReviewCount} documents need manual review`);
      }
      if (stats.unknownType > 0) {
        toast.warning(`${stats.unknownType} reports could not be classified`);
      }
      if (stats.unreadable > 0) {
        toast.error(`${stats.unreadable} reports were unreadable (OCR failed)`);
      }

    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred during processing');
    } finally {
      setProcessing(false);
      setProcessingStage('');
    }
  };

  const getReportTypeBadge = (reportType: string) => {
    switch (reportType) {
      case 'similarity':
        return <Badge className="bg-blue-600">Similarity</Badge>;
      case 'ai':
        return <Badge className="bg-purple-600">AI</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'assign_similarity':
        return <Badge className="bg-green-600">→ Similarity</Badge>;
      case 'assign_ai':
        return <Badge className="bg-green-600">→ AI</Badge>;
      case 'skip_duplicate':
        return <Badge variant="destructive">Duplicate</Badge>;
      case 'needs_review':
        return <Badge variant="outline" className="border-amber-500 text-amber-600">Needs Review</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const uploadedCount = files.filter(f => f.status === 'uploaded').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Bulk Report Upload</h1>
          <p className="text-muted-foreground">Upload PDF reports with OCR-based automatic classification and matching</p>
        </div>

        {/* Upload Area */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Reports
            </CardTitle>
            <CardDescription>
              Drag and drop PDF files or ZIP archives. Page 2 of each PDF will be OCR-scanned to detect report type (Similarity/AI) and extract percentages.
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
                      <span className="text-sm font-medium flex items-center gap-2">
                        <Scan className="h-4 w-4 animate-pulse" />
                        {processingStage}
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
                        <Scan className="h-4 w-4 mr-2" />
                        Upload & OCR Process ({pendingCount} files)
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
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                Processing Results
              </CardTitle>
              <CardDescription>
                OCR-based classification and dry-run validation results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{processingResult.stats.totalReports}</p>
                  <p className="text-sm text-muted-foreground">Total Reports</p>
                </div>
                <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{processingResult.stats.similarityDetected}</p>
                  <p className="text-sm text-muted-foreground">Similarity</p>
                </div>
                <div className="text-center p-4 bg-purple-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">{processingResult.stats.aiDetected}</p>
                  <p className="text-sm text-muted-foreground">AI Reports</p>
                </div>
                <div className="text-center p-4 bg-green-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{processingResult.stats.completedCount}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
                <div className="text-center p-4 bg-amber-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-amber-600">{processingResult.stats.needsReviewCount}</p>
                  <p className="text-sm text-muted-foreground">Needs Review</p>
                </div>
              </div>

              {/* Additional Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-lg font-bold">{processingResult.stats.mappedCount}</p>
                  <p className="text-xs text-muted-foreground">Reports Mapped</p>
                </div>
                <div className="text-center p-3 bg-yellow-500/10 rounded-lg">
                  <p className="text-lg font-bold text-yellow-600">{processingResult.stats.unmatchedCount}</p>
                  <p className="text-xs text-muted-foreground">Unmatched</p>
                </div>
                <div className="text-center p-3 bg-orange-500/10 rounded-lg">
                  <p className="text-lg font-bold text-orange-600">{processingResult.stats.unknownType}</p>
                  <p className="text-xs text-muted-foreground">Unknown Type</p>
                </div>
                <div className="text-center p-3 bg-red-500/10 rounded-lg">
                  <p className="text-lg font-bold text-red-600">{processingResult.stats.unreadable}</p>
                  <p className="text-xs text-muted-foreground">OCR Failed</p>
                </div>
              </div>

              <Separator className="my-6" />

              {/* Detailed Results Tabs */}
              <Tabs defaultValue="dryrun" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="dryrun" className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    Dry Run ({processingResult.dryRun.length})
                  </TabsTrigger>
                  <TabsTrigger value="committed" className="flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    Committed ({processingResult.committed.length})
                  </TabsTrigger>
                  <TabsTrigger value="unmatched" className="flex items-center gap-1">
                    <FileWarning className="h-4 w-4" />
                    Unmatched ({processingResult.unmatched.length})
                  </TabsTrigger>
                  <TabsTrigger value="review" className="flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    Review ({processingResult.needsReview.length})
                  </TabsTrigger>
                </TabsList>

                {/* Dry Run Results */}
                <TabsContent value="dryrun">
                  <ScrollArea className="h-[400px]">
                    {processingResult.dryRun.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No dry run results</p>
                    ) : (
                      <div className="space-y-4 p-2">
                        {processingResult.dryRun.map((item, index) => (
                          <div key={index} className={`border rounded-lg p-4 ${item.hasConflict ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20' : 'border-border'}`}>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-primary" />
                                <span className="font-medium">{item.documentFileName}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {item.willComplete ? (
                                  <Badge className="bg-green-600">Will Complete</Badge>
                                ) : item.hasConflict ? (
                                  <Badge variant="outline" className="border-amber-500 text-amber-600">Has Conflict</Badge>
                                ) : (
                                  <Badge variant="secondary">Partial</Badge>
                                )}
                              </div>
                            </div>
                            
                            {item.conflictReason && (
                              <div className="mb-3 p-2 bg-amber-100 dark:bg-amber-900/30 rounded text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                {item.conflictReason}
                              </div>
                            )}
                            
                            <div className="space-y-2">
                              {item.reports.map((report, rIndex) => (
                                <div key={rIndex} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="truncate">{report.fileName}</span>
                                    {getReportTypeBadge(report.classification.reportType)}
                                    {report.classification.percentage !== null && (
                                      <Badge variant="outline" className="flex items-center gap-1">
                                        <Percent className="h-3 w-3" />
                                        {report.classification.percentage}%
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {getActionBadge(report.action)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                {/* Committed Results */}
                <TabsContent value="committed">
                  <ScrollArea className="h-[400px]">
                    {processingResult.committed.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No documents were updated</p>
                    ) : (
                      <div className="space-y-2 p-2">
                        {processingResult.committed.map((item, index) => (
                          <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <span className="text-sm font-mono">{item.documentId.substring(0, 8)}...</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {item.similarityAssigned && <Badge className="bg-blue-600">+Similarity</Badge>}
                              {item.aiAssigned && <Badge className="bg-purple-600">+AI</Badge>}
                              <Badge variant={item.newStatus === 'completed' ? 'default' : 'secondary'}>
                                {item.newStatus}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                {/* Unmatched Reports */}
                <TabsContent value="unmatched">
                  <ScrollArea className="h-[400px]">
                    {processingResult.unmatched.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">All reports were matched!</p>
                    ) : (
                      <div className="space-y-2 p-2">
                        {processingResult.unmatched.map((item, index) => (
                          <div key={index} className="flex items-center justify-between p-3 border rounded-lg border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <FileWarning className="h-4 w-4 text-yellow-600 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{item.fileName}</p>
                                <p className="text-xs text-muted-foreground">Normalized: {item.normalizedFilename}</p>
                              </div>
                            </div>
                            <div className="text-sm text-yellow-600">{item.reason}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                {/* Needs Review */}
                <TabsContent value="review">
                  <ScrollArea className="h-[400px]">
                    {processingResult.needsReview.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No documents need review</p>
                    ) : (
                      <div className="space-y-2 p-2">
                        {processingResult.needsReview.map((item, index) => (
                          <div key={index} className="flex items-center justify-between p-3 border rounded-lg border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
                            <div className="flex items-center gap-3">
                              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                              <span className="text-sm font-mono">{item.documentId.substring(0, 8)}...</span>
                            </div>
                            <div className="text-sm text-amber-600">{item.reason}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Processing Stages</h4>
                <ol className="space-y-3 text-sm">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                    <div>
                      <p className="font-medium">Document Grouping</p>
                      <p className="text-muted-foreground">Filenames are normalized (remove extensions, trailing numbers, brackets)</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                    <div>
                      <p className="font-medium">OCR Extraction</p>
                      <p className="text-muted-foreground">Page 2 of each PDF is converted to image and OCR-scanned</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                    <div>
                      <p className="font-medium">Report Type Detection</p>
                      <p className="text-muted-foreground">OCR text is analyzed for keywords (similarity vs AI report)</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</span>
                    <div>
                      <p className="font-medium">Percentage Extraction</p>
                      <p className="text-muted-foreground">Percentages are extracted from OCR text using patterns</p>
                    </div>
                  </li>
                </ol>
              </div>
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Detection Keywords</h4>
                <div className="space-y-3 text-sm">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">Similarity Report</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1">
                      <li>"overall similarity"</li>
                      <li>"match groups"</li>
                      <li>"integrity overview"</li>
                    </ul>
                  </div>
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                    <p className="font-medium text-purple-700 dark:text-purple-300 mb-1">AI Report</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1">
                      <li>"detected as ai"</li>
                      <li>"ai writing overview"</li>
                      <li>"detection groups"</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
