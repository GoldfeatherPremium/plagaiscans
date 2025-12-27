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
  FileCheck,
  FileX,
  Sparkles
} from 'lucide-react';
import JSZip from 'jszip';

interface ReportFile {
  file: File;
  fileName: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  filePath?: string;
  error?: string;
}

interface MappedReport {
  documentId: string;
  fileName: string;
  reportType: string;
  percentage: number | null;
}

interface UnmatchedReport {
  fileName: string;
  normalizedFilename: string;
  filePath: string;
  reportType: string | null;
  percentage: number | null;
}

interface ProcessingResult {
  success: boolean;
  mapped: MappedReport[];
  unmatched: UnmatchedReport[];
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
 * - Remove trailing (number) suffix
 */
function normalizeFilename(filename: string): string {
  let result = filename.toLowerCase();
  result = result.replace(/\.[^.]+$/, '');
  result = result.replace(/\s*\(\d+\)$/, '');
  result = result.replace(/^\[.*?\]\s*/, '');
  result = result.replace(/^\(.*?\)\s*/, '');
  return result.trim();
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

        setUploadProgress(Math.round(((i + 1) / totalFiles) * 50));
      }

      if (uploadedReports.length === 0) {
        toast.error('No files were uploaded successfully');
        setProcessing(false);
        return;
      }

      // Call edge function for processing with PDF extraction
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
      if (stats.mappedCount > 0) {
        toast.success(`Mapped ${stats.mappedCount} reports with auto-extracted percentages`);
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
      <div className="space-y-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Bulk Report Upload</h1>
          <p className="text-muted-foreground">
            Upload PDF reports for automatic matching, classification, and percentage extraction
          </p>
        </div>

        {/* Features Info */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium">Smart Auto-Processing</h4>
                <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                  <li>• Automatically matches reports to documents by filename</li>
                  <li>• Reads PDF page 2 to classify as Similarity or AI report</li>
                  <li>• Extracts percentages automatically (e.g., "45% overall similarity")</li>
                  <li>• Auto-completes documents when both reports are attached</li>
                  <li>• Supports ZIP file extraction</li>
                </ul>
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
              Drag and drop PDF files or ZIP archives containing reports
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
                      <span className="text-sm font-medium">
                        {uploadProgress < 50 ? 'Uploading files...' : 'Analyzing PDFs & mapping...'}
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
                        Upload & Auto-Process ({pendingCount} files)
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
                Auto-classification and percentage extraction complete
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
                  <ScrollArea className="h-[200px] border rounded-lg">
                    <div className="p-3 space-y-2">
                      {processingResult.mapped.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-green-500/5 rounded-lg">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-green-600" />
                            <span className="text-sm truncate max-w-[300px]">{item.fileName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={item.reportType === 'similarity' ? 'default' : 'secondary'}>
                              {item.reportType === 'similarity' ? 'Similarity' : 'AI'}
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
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <FileX className="h-4 w-4 text-yellow-600" />
                    Unmatched Reports ({processingResult.unmatched.length})
                  </h4>
                  <ScrollArea className="h-[200px] border rounded-lg">
                    <div className="p-3 space-y-2">
                      {processingResult.unmatched.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-yellow-500/5 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.fileName}</p>
                            <p className="text-xs text-muted-foreground">Key: {item.normalizedFilename}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.reportType && (
                              <Badge variant="outline">{item.reportType}</Badge>
                            )}
                            {item.percentage !== null && (
                              <Badge variant="outline">{item.percentage}%</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <p className="text-sm text-muted-foreground mt-2">
                    These reports have been saved. Go to Admin → Unmatched Reports to manually assign them.
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
