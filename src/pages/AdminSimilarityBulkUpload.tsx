import React, { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, X, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DashboardLayout } from '@/components/DashboardLayout';
import { SEO } from '@/components/SEO';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import JSZip from 'jszip';

interface FileStatus {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'mapped' | 'unmatched';
  message?: string;
  percentage?: number;
}

interface ProcessResult {
  fileName: string;
  status: 'mapped' | 'unmatched' | 'error';
  documentId?: string;
  percentage?: number;
  error?: string;
}

const AdminSimilarityBulkUpload: React.FC = () => {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<{
    total: number;
    mapped: number;
    unmatched: number;
    completed: number;
  } | null>(null);

  const extractZipFiles = async (zipFile: File): Promise<File[]> => {
    const zip = new JSZip();
    const contents = await zip.loadAsync(zipFile);
    const extractedFiles: File[] = [];

    for (const [filename, zipEntry] of Object.entries(contents.files)) {
      if (!zipEntry.dir && filename.toLowerCase().endsWith('.pdf')) {
        const blob = await zipEntry.async('blob');
        const file = new File([blob], filename.split('/').pop() || filename, {
          type: 'application/pdf',
        });
        extractedFiles.push(file);
      }
    }

    return extractedFiles;
  };

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    await processDroppedFiles(droppedFiles);
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      await processDroppedFiles(selectedFiles);
    }
  };

  const processDroppedFiles = async (droppedFiles: File[]) => {
    const allFiles: File[] = [];

    for (const file of droppedFiles) {
      if (file.name.toLowerCase().endsWith('.zip')) {
        try {
          const extracted = await extractZipFiles(file);
          allFiles.push(...extracted);
          toast({
            title: 'ZIP Extracted',
            description: `Extracted ${extracted.length} PDF file(s) from ${file.name}`,
          });
        } catch (error) {
          toast({
            title: 'ZIP Error',
            description: `Failed to extract ${file.name}`,
            variant: 'destructive',
          });
        }
      } else if (file.name.toLowerCase().endsWith('.pdf')) {
        allFiles.push(file);
      }
    }

    setFiles(prev => [
      ...prev,
      ...allFiles.map(file => ({ file, status: 'pending' as const })),
    ]);
    setSummary(null);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setFiles([]);
    setSummary(null);
    setProgress(0);
  };

  const processFiles = async () => {
    if (files.length === 0) {
      toast({
        title: 'No Files',
        description: 'Please add PDF files to upload',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);
    setProgress(0);
    setSummary(null);

    // Update all files to uploading status
    setFiles(prev => prev.map(f => ({ ...f, status: 'uploading' as const })));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Error', description: 'Not authenticated', variant: 'destructive' });
        setProcessing(false);
        return;
      }

      const formData = new FormData();
      files.forEach(({ file }) => {
        formData.append('files', file);
      });

      // Use fetch directly for FormData - supabase.functions.invoke doesn't handle it properly
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/process-similarity-bulk-reports`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      const { results, summary: resultSummary } = data as {
        results: ProcessResult[];
        summary: { total: number; mapped: number; unmatched: number; completed: number };
      };

      // Update file statuses based on results
      setFiles(prev => prev.map(fileStatus => {
        const result = results.find(r => r.fileName === fileStatus.file.name);
        if (result) {
          return {
            ...fileStatus,
            status: result.status === 'error' ? 'error' : result.status,
            message: result.error || (result.status === 'mapped' 
              ? `Mapped${result.percentage !== undefined ? ` (${result.percentage}%)` : ''}`
              : 'No matching document'),
            percentage: result.percentage,
          };
        }
        return fileStatus;
      }));

      setSummary(resultSummary);
      setProgress(100);

      toast({
        title: 'Processing Complete',
        description: `${resultSummary.mapped} mapped, ${resultSummary.unmatched} unmatched`,
      });
    } catch (error) {
      console.error('Processing error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to process files',
        variant: 'destructive',
      });
      setFiles(prev => prev.map(f => ({ ...f, status: 'error' as const })));
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: FileStatus['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'uploading':
        return <Badge variant="outline" className="animate-pulse">Uploading...</Badge>;
      case 'success':
      case 'mapped':
        return <Badge className="bg-green-500">Mapped</Badge>;
      case 'unmatched':
        return <Badge variant="destructive">Unmatched</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
    }
  };

  const pendingCount = files.filter(f => f.status === 'pending').length;

  return (
    <DashboardLayout>
      <SEO
        title="Bulk Similarity Report Upload"
        description="Upload multiple similarity reports at once"
      />

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Bulk Similarity Report Upload</h1>
          <p className="text-muted-foreground">
            Upload multiple similarity reports for the similarity queue. Reports will auto-match to documents by filename.
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
              Drag & drop PDF files or ZIP archives containing similarity reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
            >
              <input
                type="file"
                id="file-upload"
                className="hidden"
                multiple
                accept=".pdf,.zip"
                onChange={handleFileSelect}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-2">
                  <div className="flex gap-2">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <Archive className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="font-medium">Drop PDF files or ZIP archives here</p>
                  <p className="text-sm text-muted-foreground">or click to browse</p>
                </div>
              </label>
            </div>

            {files.length > 0 && (
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{files.length} file(s) selected</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={clearAll} disabled={processing}>
                      Clear All
                    </Button>
                    <Button onClick={processFiles} disabled={processing || pendingCount === 0}>
                      {processing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Process {pendingCount} File(s)
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {processing && (
                  <Progress value={progress} className="h-2" />
                )}

                <div className="max-h-64 overflow-y-auto space-y-2">
                  {files.map((fileStatus, index) => (
                    <div
                      key={`${fileStatus.file.name}-${index}`}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="truncate text-sm">{fileStatus.file.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {fileStatus.message && (
                          <span className="text-xs text-muted-foreground max-w-32 truncate">
                            {fileStatus.message}
                          </span>
                        )}
                        {getStatusBadge(fileStatus.status)}
                        {!processing && fileStatus.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeFile(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary */}
        {summary && (
          <Card>
            <CardHeader>
              <CardTitle>Processing Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">{summary.total}</div>
                  <div className="text-sm text-muted-foreground">Total Files</div>
                </div>
                <div className="text-center p-4 bg-green-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{summary.mapped}</div>
                  <div className="text-sm text-muted-foreground">Mapped</div>
                </div>
                <div className="text-center p-4 bg-green-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{summary.completed}</div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                </div>
                <div className="text-center p-4 bg-destructive/10 rounded-lg">
                  <div className="text-2xl font-bold text-destructive">{summary.unmatched}</div>
                  <div className="text-sm text-muted-foreground">Unmatched</div>
                </div>
              </div>

              {summary.unmatched > 0 && (
                <div className="mt-4 p-4 bg-amber-500/10 rounded-lg flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-600">Unmatched Reports</p>
                    <p className="text-sm text-muted-foreground">
                      {summary.unmatched} report(s) could not be matched to documents. 
                      Check the Unmatched Reports page to manually assign them.
                    </p>
                  </div>
                </div>
              )}

              {summary.completed > 0 && (
                <div className="mt-4 p-4 bg-green-500/10 rounded-lg flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-600">Documents Completed</p>
                    <p className="text-sm text-muted-foreground">
                      {summary.completed} document(s) have been marked as completed.
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
            <p>1. Upload PDF similarity reports (or ZIP files containing PDFs)</p>
            <p>2. Reports are matched to similarity queue documents by normalized filename</p>
            <p>3. Page 2 of each PDF is analyzed to extract similarity percentage</p>
            <p>4. Matched documents are automatically marked as completed</p>
            <p>5. Unmatched reports are stored for manual assignment</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminSimilarityBulkUpload;
