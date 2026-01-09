import { useState, useCallback, useRef, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SEO } from '@/components/SEO';
import { useQuery } from '@tanstack/react-query';
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
  Eye
} from 'lucide-react';
import JSZip from 'jszip';
import { MatchPreviewDialog } from '@/components/MatchPreviewDialog';
import { normalizeFilename as normalize, previewMatches } from '@/utils/filenameMatching';

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
  percentage: number | null;
  success: boolean;
  message?: string;
}

interface ProcessingResult {
  success: boolean;
  mapped: MappingResult[];
  unmatched: { fileName: string; normalizedFilename: string; filePath: string; reason: string }[];
  completedDocuments: string[];
  stats: {
    totalReports: number;
    mappedCount: number;
    unmatchedCount: number;
    completedCount: number;
  };
}

/**
 * Normalize filename for display:
 * - Remove extension
 * - Remove trailing (number) patterns
 * - Lowercase and trim
 */
function normalizeFilename(filename: string): string {
  return normalize(filename);
}

export default function AdminSimilarityBulkUpload() {
  const [files, setFiles] = useState<ReportFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch pending documents for preview matching
  const { data: pendingDocuments = [] } = useQuery({
    queryKey: ['similarity-pending-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('id, file_name, normalized_filename, status')
        .eq('scan_type', 'similarity_only')
        .in('status', ['pending', 'in_progress'])
        .is('similarity_report_path', null);
      if (error) throw error;
      return data || [];
    },
  });

  // Preview stats
  const previewStats = useMemo(() => {
    if (files.length === 0 || pendingDocuments.length === 0) {
      return { exact: 0, partial: 0, none: 0 };
    }
    const previews = previewMatches(
      files.map((f) => f.fileName),
      pendingDocuments.map((d) => ({
        id: d.id,
        file_name: d.file_name,
        normalized_filename: d.normalized_filename,
        status: d.status,
      }))
    );
    return {
      exact: previews.filter((p) => p.status === 'exact').length,
      partial: previews.filter((p) => p.status === 'partial').length,
      none: previews.filter((p) => p.status === 'none').length,
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

      const uploadedReports: { fileName: string; filePath: string }[] = [];
      const totalFiles = files.length;

      // Upload each file to storage
      for (let i = 0; i < files.length; i++) {
        const reportFile = files[i];
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'uploading' } : f
        ));

        const timestamp = Date.now();
        const sanitizedName = reportFile.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `similarity-bulk-reports/${timestamp}_${sanitizedName}`;

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

        setUploadProgress(Math.round(((i + 1) / totalFiles) * 50));
      }

      if (uploadedReports.length === 0) {
        toast.error('No files were uploaded successfully');
        setProcessing(false);
        return;
      }

      // Call edge function for PDF analysis and auto-mapping
      setUploadProgress(60);
      
      const { data, error } = await supabase.functions.invoke('process-similarity-bulk-reports', {
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

  return (
    <DashboardLayout>
      <SEO
        title="Bulk Similarity Report Upload"
        description="Upload multiple similarity reports at once for the similarity queue"
      />
      
      <div className="space-y-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Bulk Similarity Report Upload</h1>
          <p className="text-muted-foreground">
            Upload PDF reports for similarity-only documents. Reports are auto-matched by filename and analyzed for percentage.
          </p>
        </div>

        {/* Upload Area */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Similarity Reports
            </CardTitle>
            <CardDescription>
              Drag and drop PDF files or ZIP archives. Each PDF's page 2 is analyzed to extract similarity percentage.
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

                {/* Preview Stats */}
                {pendingDocuments.length > 0 && !processing && (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-800 dark:text-green-300">{previewStats.exact}</p>
                        <p className="text-xs text-green-600 dark:text-green-400">Exact</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-900">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">{previewStats.partial}</p>
                        <p className="text-xs text-yellow-600 dark:text-yellow-400">Partial</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <div>
                        <p className="text-sm font-medium text-red-800 dark:text-red-300">{previewStats.none}</p>
                        <p className="text-xs text-red-600 dark:text-red-400">No Match</p>
                      </div>
                    </div>
                  </div>
                )}

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

                {/* Action Buttons */}
                <div className="mt-4 flex justify-end gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => setShowPreview(true)}
                    disabled={processing || pendingCount === 0 || pendingDocuments.length === 0}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview Matches
                  </Button>
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
                        Upload & Process ({pendingCount} files)
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
          reportFilenames={files.map((f) => f.fileName)}
          documents={pendingDocuments.map((d) => ({
            id: d.id,
            file_name: d.file_name,
            normalized_filename: d.normalized_filename,
            status: d.status,
          }))}
          onConfirm={(assignments) => {
            setShowPreview(false);
            // The assignments can be used for future enhancement
            // For now, just proceed with upload
            uploadAndProcess();
          }}
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
                        <div key={index} className="flex items-center justify-between p-2 bg-green-500/10 rounded-lg">
                          <span className="text-sm truncate flex-1">{item.fileName}</span>
                          {item.percentage !== null && (
                            <Badge variant="outline" className="ml-2">
                              {item.percentage}%
                            </Badge>
                          )}
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
                        <div key={index} className="flex items-center justify-between p-2 bg-yellow-500/10 rounded-lg">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate">{item.fileName}</p>
                            <p className="text-xs text-muted-foreground">{item.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground mt-2">
                    Unmatched reports are stored and can be manually assigned from the Unmatched Reports page.
                  </p>
                </div>
              )}

              {/* Completed Documents Success Message */}
              {processingResult.completedDocuments.length > 0 && (
                <div className="p-4 bg-green-500/10 rounded-lg flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-600">Documents Completed</p>
                    <p className="text-sm text-muted-foreground">
                      {processingResult.completedDocuments.length} document(s) have been marked as completed. Customers have been notified.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. <strong>Upload:</strong> Drag & drop PDF similarity reports or ZIP archives containing PDFs</p>
            <p>2. <strong>Storage:</strong> Files are uploaded to secure storage before processing</p>
            <p>3. <strong>Analysis:</strong> Page 2 of each PDF is analyzed to extract similarity percentage</p>
            <p>4. <strong>Matching:</strong> Reports are matched to similarity queue documents by normalized filename</p>
            <p>5. <strong>Completion:</strong> Matched documents are marked complete and customers are notified</p>
            <p>6. <strong>Unmatched:</strong> Reports without matches are stored for manual assignment</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
