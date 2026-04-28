import { useState, useCallback, useRef, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useStaffPermissions } from '@/hooks/useStaffPermissions';
import { 
  Upload, 
  FileText, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Archive,
  Loader2,
  FileCheck,
  FileWarning,
  Eye,
  Zap,
  ShieldX
} from 'lucide-react';
import JSZip from 'jszip';
import { MatchPreviewDialog } from '@/components/MatchPreviewDialog';
import { previewMatches } from '@/utils/filenameMatching';

interface ReportFile {
  file: File;
  fileName: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  filePath?: string;
  error?: string;
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
  unmatched: { fileName: string; normalizedFilename: string; filePath: string; reason: string }[];
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
 * Normalize filename for display:
 * - Remove extension
 * - Remove trailing (number) patterns
 * - Lowercase and trim
 */
function normalizeFilename(filename: string): string {
  let result = filename.toLowerCase();
  result = result.replace(/\.[^.]+$/, '');
  result = result.replace(/\s*\(\d+\)$/, '');
  return result.trim();
}

export default function AdminBulkReportUpload() {
  const { role } = useAuth();
  const { permissions, loading: permissionsLoading } = useStaffPermissions();
  const [files, setFiles] = useState<ReportFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [manualMappings, setManualMappings] = useState<Map<string, string>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch pending/in-progress documents for full scan queue
  const { data: pendingDocuments = [], isLoading: loadingDocuments } = useQuery({
    queryKey: ['pending-full-scan-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('id, file_name, normalized_filename, status, similarity_report_path, ai_report_path')
        .in('status', ['pending', 'in_progress'])
        .neq('scan_type', 'similarity_only')
        .eq('needs_review', false)
        .is('deleted_at', null);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate match preview stats
  const matchStats = useMemo(() => {
    if (files.length === 0 || pendingDocuments.length === 0) {
      return { exact: 0, partial: 0, none: 0 };
    }
    
    const reportFilenames = files.map(f => f.fileName);
    const previews = previewMatches(reportFilenames, pendingDocuments.map(doc => ({
      id: doc.id,
      file_name: doc.file_name,
      normalized_filename: doc.normalized_filename,
      status: doc.status,
    })));
    
    return {
      exact: previews.filter(p => p.status === 'exact').length,
      partial: previews.filter(p => p.status === 'partial').length,
      none: previews.filter(p => p.status === 'none').length,
    };
  }, [files, pendingDocuments]);

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

  const handlePreviewConfirm = (assignments: Map<string, string>) => {
    setManualMappings(assignments);
    setShowPreview(false);
    // Auto-start upload after confirmation
    uploadAndProcess(assignments);
  };

  const uploadAndProcess = async (mappingsOverride?: Map<string, string>) => {
    if (files.length === 0) {
      toast.error('No files to process');
      return;
    }

    const mappings = mappingsOverride || manualMappings;

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

      const uploadedReports: { fileName: string; filePath: string; documentId?: string }[] = [];
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

        // Include manual mapping if available
        const manualDocId = mappings.get(reportFile.fileName);
        uploadedReports.push({
          fileName: reportFile.fileName,
          filePath,
          ...(manualDocId && { documentId: manualDocId }),
        });

        setUploadProgress(Math.round(((i + 1) / totalFiles) * 50));
      }

      if (uploadedReports.length === 0) {
        toast.error('No files were uploaded successfully');
        setProcessing(false);
        return;
      }

      // Call edge function for PDF analysis and auto-mapping
      setUploadProgress(60);
      
      const { data, error } = await supabase.functions.invoke('process-bulk-reports', {
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
        toast.success(`Successfully completed ${stats.completedCount} documents!`);
      }
      if (stats.mappedCount > 0 && stats.completedCount === 0) {
        toast.success(`Mapped ${stats.mappedCount} reports`);
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

  // Check if staff has permission
  if (role === 'staff' && !permissionsLoading && !permissions.can_batch_process) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <ShieldX className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground text-center max-w-md">
            You don't have permission to access bulk upload. Please contact an administrator.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">
            {role === 'admin' ? 'Bulk Report Upload' : 'AI Reports Bulk Upload'}
          </h1>
          <p className="text-muted-foreground">
            Upload PDF reports or ZIP archives. Reports are auto-classified using page 2 analysis.
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
              Drag and drop PDF files or ZIP archives. Each PDF's page 2 is analyzed to classify as Similarity or AI report.
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
                              Key: {normalizeFilename(file.fileName)}
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
                      <span className="text-sm font-medium">Processing...</span>
                      <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} />
                  </div>
                )}

                {/* Match Preview Stats */}
                {files.length > 0 && pendingDocuments.length > 0 && !processing && (
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="text-center p-3 bg-green-500/10 rounded-lg border border-green-200">
                      <p className="text-xl font-bold text-green-600">{matchStats.exact}</p>
                      <p className="text-xs text-muted-foreground">Exact Matches</p>
                    </div>
                    <div className="text-center p-3 bg-yellow-500/10 rounded-lg border border-yellow-200">
                      <p className="text-xl font-bold text-yellow-600">{matchStats.partial}</p>
                      <p className="text-xs text-muted-foreground">Partial Matches</p>
                    </div>
                    <div className="text-center p-3 bg-red-500/10 rounded-lg border border-red-200">
                      <p className="text-xl font-bold text-red-600">{matchStats.none}</p>
                      <p className="text-xs text-muted-foreground">No Match</p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-4 flex justify-end gap-3">
                  {files.length > 0 && pendingDocuments.length > 0 && !processing && (
                    <Button 
                      variant="outline"
                      onClick={() => setShowPreview(true)}
                      disabled={loadingDocuments}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Preview Matches
                    </Button>
                  )}
                  <Button 
                    onClick={() => uploadAndProcess()}
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
                        <Zap className="h-4 w-4 mr-2" />
                        Quick Upload ({pendingCount} files)
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Match Preview Dialog */}
        <MatchPreviewDialog
          open={showPreview}
          onOpenChange={setShowPreview}
          reportFilenames={files.map(f => f.fileName)}
          documents={pendingDocuments.map(doc => ({
            id: doc.id,
            file_name: doc.file_name,
            normalized_filename: doc.normalized_filename,
            status: doc.status,
          }))}
          onConfirm={handlePreviewConfirm}
          isProcessing={processing}
        />

        {/* Processing Results */}
        {processingResult && (
          <Card>
            <CardHeader>
              <CardTitle>Processing Results</CardTitle>
              <CardDescription>
                PDF page 2 analysis and auto-mapping summary
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
                <div className="text-center p-4 bg-orange-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">{processingResult.stats.needsReviewCount}</p>
                  <p className="text-sm text-muted-foreground">Needs Review</p>
                </div>
              </div>

              {/* Mapped Reports */}
              {processingResult.mapped.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-green-600" />
                    Mapped Reports ({processingResult.mapped.length})
                  </h4>
                  <ScrollArea className="h-[150px] border rounded-lg">
                    <div className="p-3 space-y-2">
                      {processingResult.mapped.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-green-500/5 rounded-lg">
                          <span className="text-sm truncate flex-1">{item.fileName}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant={item.reportType === 'similarity' ? 'default' : 'secondary'}>
                              {item.reportType}
                            </Badge>
                            {item.percentage !== null && (
                              <Badge variant="outline">{item.percentage}%</Badge>
                            )}
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
                      {processingResult.unmatched.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-yellow-500/5 rounded-lg">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate">{item.fileName}</p>
                            <p className="text-xs text-muted-foreground">{item.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <p className="text-sm text-muted-foreground mt-2">
                    View and manage unmatched reports in the Unmatched Reports page.
                  </p>
                </div>
              )}

              {/* Completed Documents */}
              {processingResult.completedDocuments.length > 0 && (
                <div className="p-4 bg-green-500/10 rounded-lg">
                  <p className="text-sm font-medium text-green-700">
                    ✓ {processingResult.completedDocuments.length} document(s) completed with both reports attached.
                    Customers have been notified.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
