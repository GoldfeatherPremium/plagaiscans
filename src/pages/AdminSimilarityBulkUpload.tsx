import React, { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, X, Archive, RefreshCw } from 'lucide-react';
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
  status: 'pending' | 'uploading' | 'queued' | 'error';
  message?: string;
  queueId?: string;
}

interface QueueSummary {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
}

const AdminSimilarityBulkUpload: React.FC = () => {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [queueSummary, setQueueSummary] = useState<QueueSummary>({ queued: 0, processing: 0, completed: 0, failed: 0 });
  const [loadingQueue, setLoadingQueue] = useState(false);

  // Fetch queue summary
  const fetchQueueSummary = async () => {
    setLoadingQueue(true);
    try {
      const { data, error } = await supabase
        .from('similarity_queue')
        .select('queue_status');

      if (error) throw error;

      const summary: QueueSummary = { queued: 0, processing: 0, completed: 0, failed: 0 };
      data?.forEach((item: { queue_status: string }) => {
        if (item.queue_status === 'queued') summary.queued++;
        else if (item.queue_status === 'processing') summary.processing++;
        else if (item.queue_status === 'completed') summary.completed++;
        else if (item.queue_status === 'failed') summary.failed++;
      });
      setQueueSummary(summary);
    } catch (err) {
      console.error('Failed to fetch queue summary:', err);
    } finally {
      setLoadingQueue(false);
    }
  };

  useEffect(() => {
    fetchQueueSummary();
  }, []);

  // Normalize filename
  const normalizeFilename = (filename: string): string => {
    let result = filename.toLowerCase().trim();
    const exts = [".pdf", ".docx", ".doc", ".txt"];
    let changed = true;
    while (changed) {
      changed = false;
      for (const ext of exts) {
        if (result.endsWith(ext)) {
          result = result.slice(0, -ext.length);
          changed = true;
        }
      }
    }
    result = result.replace(/\s*\(\d+\)\s*$/, "");
    result = result.replace(/[_-]+/g, " ");
    result = result.replace(/\s+/g, " ").trim();
    return result;
  };

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
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setFiles([]);
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

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Error', description: 'Not authenticated', variant: 'destructive' });
        setProcessing(false);
        return;
      }

      const userId = session.user.id;
      const uploadPrefix = `bulk/${userId}/${Date.now()}`;

      // Step 1: Upload files to storage
      const uploaded: { fileName: string; filePath: string }[] = [];
      const total = files.length;
      let done = 0;

      setFiles(prev => prev.map(f => ({ ...f, status: 'uploading' as const, message: 'Uploading...' })));

      const concurrency = 3;
      const queue = Array.from({ length: total }, (_, i) => i);

      const uploadOne = async (i: number) => {
        const { file } = files[i];
        const filePath = `${uploadPrefix}/${file.name}`;

        try {
          const { error: uploadError } = await supabase.storage
            .from('similarity-reports')
            .upload(filePath, file, {
              contentType: file.type || 'application/pdf',
              upsert: false,
            });

          if (uploadError) throw uploadError;

          uploaded.push({ fileName: file.name, filePath });
          setFiles(prev => {
            const next = [...prev];
            if (next[i]) next[i] = { ...next[i], message: 'Uploaded' };
            return next;
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Upload failed';
          setFiles(prev => {
            const next = [...prev];
            if (next[i]) next[i] = { ...next[i], status: 'error', message };
            return next;
          });
        } finally {
          done++;
          setProgress(Math.min(70, Math.round((done / total) * 70)));
        }
      };

      const workers = Array.from({ length: Math.min(concurrency, total) }, async () => {
        while (queue.length) {
          const i = queue.shift();
          if (i === undefined) return;
          await uploadOne(i);
        }
      });
      await Promise.all(workers);

      if (uploaded.length === 0) {
        throw new Error('All uploads failed');
      }

      setProgress(75);

      // Step 2: Create queue entries via edge function
      const response = await supabase.functions.invoke('process-similarity-bulk', {
        body: { action: 'upload', files: uploaded },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const { results, summary } = response.data as {
        results: { fileName: string; status: string; queueId?: string; error?: string }[];
        summary: { total: number; queued: number; errors: number };
      };

      // Update file statuses
      setFiles(prev => prev.map(fileStatus => {
        const result = results.find(r => r.fileName === fileStatus.file.name);
        if (!result) return fileStatus;
        return {
          ...fileStatus,
          status: result.status === 'queued' ? 'queued' : 'error',
          message: result.error || (result.status === 'queued' ? 'Added to queue' : 'Error'),
          queueId: result.queueId,
        };
      }));

      setProgress(100);

      toast({
        title: 'Upload Complete',
        description: `${summary.queued} file(s) added to queue`,
      });

      // Refresh queue summary
      await fetchQueueSummary();

    } catch (error) {
      console.error('Processing error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to process files',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const processQueuedItems = async () => {
    try {
      toast({ title: 'Processing', description: 'Starting queue processing...' });
      
      const response = await supabase.functions.invoke('process-similarity-bulk', {
        body: { action: 'process', limit: 20 },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const { processed, completed, failed } = response.data;
      
      toast({
        title: 'Processing Complete',
        description: `Processed ${processed} items: ${completed} completed, ${failed} failed`,
      });

      await fetchQueueSummary();
    } catch (error) {
      console.error('Queue processing error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to process queue',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: FileStatus['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'uploading':
        return <Badge variant="outline" className="animate-pulse">Uploading...</Badge>;
      case 'queued':
        return <Badge className="bg-green-500">Queued</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
    }
  };

  const pendingCount = files.filter(f => f.status === 'pending').length;

  return (
    <DashboardLayout>
      <SEO
        title="Bulk Similarity Report Upload"
        description="Upload multiple similarity reports to the queue"
      />

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Similarity Queue - Bulk Upload</h1>
          <p className="text-muted-foreground">
            Upload PDF similarity reports. Files are added to the processing queue.
          </p>
        </div>

        {/* Queue Summary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Queue Status</CardTitle>
              <CardDescription>Current similarity queue statistics</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchQueueSummary} disabled={loadingQueue}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loadingQueue ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {queueSummary.queued > 0 && (
                <Button size="sm" onClick={processQueuedItems}>
                  Process Queue
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-amber-500/10 rounded-lg">
                <div className="text-2xl font-bold text-amber-600">{queueSummary.queued}</div>
                <div className="text-sm text-muted-foreground">Queued</div>
              </div>
              <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{queueSummary.processing}</div>
                <div className="text-sm text-muted-foreground">Processing</div>
              </div>
              <div className="text-center p-4 bg-green-500/10 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{queueSummary.completed}</div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </div>
              <div className="text-center p-4 bg-destructive/10 rounded-lg">
                <div className="text-2xl font-bold text-destructive">{queueSummary.failed}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
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
                          Upload {pendingCount} File(s)
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

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. Upload PDF similarity reports (or ZIP files containing PDFs)</p>
            <p>2. Files are stored and added to the processing queue</p>
            <p>3. Click "Process Queue" to analyze reports and extract similarity percentages</p>
            <p>4. Reports needing manual review are flagged automatically</p>
            <p>5. View and manage all queue items in the Queue Management page</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminSimilarityBulkUpload;
