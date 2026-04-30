import { useState, useCallback, useRef, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useStaffPermissions } from '@/hooks/useStaffPermissions';
import { useQuery } from '@tanstack/react-query';
import {
  Upload, FileText, X, CheckCircle2, AlertCircle, Clock, Archive,
  Loader2, FileCheck, FileWarning, Zap, ShieldX, ScanLine, ArrowRight,
  Eye, ChevronDown, ChevronUp, AlertTriangle, XCircle,
} from 'lucide-react';
import JSZip from 'jszip';

interface ReportFile {
  file: File;
  fileName: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  filePath?: string;
  error?: string;
}

interface MatchSuggestion {
  documentId: string;
  fileName: string;
  normalizedFilename: string;
  confidence: number;
  hasSimilarityReport: boolean;
  hasAIReport: boolean;
  filePath?: string | null;
}

interface AnalysisItem {
  fileName: string;
  filePath: string;
  extractedCoverName: string | null;
  extractionSource: string | null;
  matchKey: string;
  matchSource: 'cover_page' | 'filename_fallback';
  reportType: 'similarity' | 'ai' | 'unknown';
  percentage: number | null;
  bestMatch: MatchSuggestion | null;
  suggestions: MatchSuggestion[];
  autoStatus: 'auto_matched' | 'ambiguous' | 'unmatched' | 'error';
  reason?: string;
  // UI override
  selectedDocId?: string | null; // 'unmatched' = leave unmatched
}

interface MappingResult {
  documentId: string;
  fileName: string;
  reportType: 'similarity' | 'ai';
  percentage: number | null;
  success: boolean;
  message?: string;
  extractedCoverName?: string | null;
}

interface ApplyResult {
  success: boolean;
  mapped: MappingResult[];
  unmatched: { fileName: string; filePath: string; reason: string; extractedCoverName?: string | null }[];
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

const UNMATCHED_VALUE = '__unmatched__';

export default function AdminBulkReportUploadV2() {
  const { role } = useAuth();
  const { permissions, loading: permissionsLoading } = useStaffPermissions();
  const [files, setFiles] = useState<ReportFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisItems, setAnalysisItems] = useState<AnalysisItem[] | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Pending AI-scan queue documents (mirrors V1)
  const { data: pendingDocuments = [], isLoading: loadingDocuments } = useQuery({
    queryKey: ['v2-pending-full-scan-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('id, file_name, file_path, normalized_filename, status, similarity_report_path, ai_report_path')
        .in('status', ['pending', 'in_progress'])
        .neq('scan_type', 'similarity_only')
        .eq('needs_review', false)
        .is('deleted_at', null)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const toggleRow = (index: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  const previewReport = async (filePath: string) => {
    const { data, error } = await supabase.storage.from('reports').createSignedUrl(filePath, 300);
    if (error || !data?.signedUrl) {
      toast.error('Could not open report preview');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const previewQueueDocument = async (filePath: string | null | undefined) => {
    if (!filePath) {
      toast.error('Original document file is unavailable');
      return;
    }
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(filePath, 300);
    if (error || !data?.signedUrl) {
      toast.error('Could not open document preview');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
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
            newFiles.push({ file: extractedFile, fileName: extractedFile.name, status: 'pending' });
          }
          toast.success(`Extracted ${extractedFiles.length} PDF files from ${file.name}`);
        } catch (error) {
          console.error('Error extracting ZIP:', error);
          toast.error(`Failed to extract ${file.name}`);
        }
      } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        newFiles.push({ file, fileName: file.name, status: 'pending' });
      } else {
        toast.error(`Unsupported file type: ${file.name}`);
      }
    }
    setFiles((prev) => [...prev, ...newFiles]);
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
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setFiles([]);
    setAnalysisItems(null);
    setApplyResult(null);
    setUploadProgress(0);
  };

  // Step 1: Upload + analyze (scan cover pages, return matches without committing)
  const uploadAndAnalyze = async () => {
    if (files.length === 0) {
      toast.error('No files to process');
      return;
    }
    setUploading(true);
    setAnalyzing(false);
    setUploadProgress(0);
    setAnalysisItems(null);
    setApplyResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in to upload reports');
        setUploading(false);
        return;
      }

      const uploadedReports: { fileName: string; filePath: string }[] = [];
      const totalFiles = files.length;

      for (let i = 0; i < files.length; i++) {
        const reportFile = files[i];
        if (reportFile.status === 'uploaded' && reportFile.filePath) {
          uploadedReports.push({ fileName: reportFile.fileName, filePath: reportFile.filePath });
          setUploadProgress(Math.round(((i + 1) / totalFiles) * 50));
          continue;
        }

        setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: 'uploading' } : f));
        const timestamp = Date.now();
        const sanitizedName = reportFile.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `bulk-reports-v2/${timestamp}_${sanitizedName}`;

        const { error: uploadError } = await supabase.storage
          .from('reports').upload(filePath, reportFile.file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          setFiles((prev) => prev.map((f, idx) =>
            idx === i ? { ...f, status: 'error', error: uploadError.message } : f
          ));
          continue;
        }
        setFiles((prev) => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'uploaded', filePath } : f
        ));
        uploadedReports.push({ fileName: reportFile.fileName, filePath });
        setUploadProgress(Math.round(((i + 1) / totalFiles) * 50));
      }

      if (uploadedReports.length === 0) {
        toast.error('No files were uploaded successfully');
        setUploading(false);
        return;
      }

      setUploading(false);
      setAnalyzing(true);
      setUploadProgress(60);

      const { data, error } = await supabase.functions.invoke('process-bulk-reports-v2', {
        body: { reports: uploadedReports, phase: 'analyze' },
      });

      if (error) {
        console.error('Analyze error:', error);
        toast.error('Failed to analyze reports: ' + error.message);
        setAnalyzing(false);
        return;
      }

      setUploadProgress(100);
      const items = (data.items as AnalysisItem[]).map((it) => ({
        ...it,
        selectedDocId: it.bestMatch && it.autoStatus === 'auto_matched'
          ? it.bestMatch.documentId
          : (it.autoStatus === 'ambiguous' ? null : (it.bestMatch?.documentId ?? null)),
      }));
      setAnalysisItems(items);

      const auto = items.filter((i) => i.autoStatus === 'auto_matched').length;
      const ambiguous = items.filter((i) => i.autoStatus === 'ambiguous').length;
      const unmatched = items.filter((i) => i.autoStatus === 'unmatched' || i.autoStatus === 'error').length;
      toast.success(`Scan complete: ${auto} auto-matched, ${ambiguous} ambiguous, ${unmatched} need attention`);
    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred during upload/analysis');
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  // Step 2: Apply confirmed matches
  const applyMatches = async () => {
    if (!analysisItems) return;
    setApplying(true);
    try {
      const payload = analysisItems.map((it) => ({
        fileName: it.fileName,
        filePath: it.filePath,
        reportType: it.reportType,
        percentage: it.percentage,
        extractedCoverName: it.extractedCoverName,
        documentId: it.selectedDocId && it.selectedDocId !== UNMATCHED_VALUE ? it.selectedDocId : null,
      }));

      const { data, error } = await supabase.functions.invoke('process-bulk-reports-v2', {
        body: { reports: payload, phase: 'apply' },
      });

      if (error) {
        console.error('Apply error:', error);
        toast.error('Failed to apply matches: ' + error.message);
        return;
      }

      setApplyResult(data as ApplyResult);
      const stats = data.stats;
      if (stats.completedCount > 0) toast.success(`Completed ${stats.completedCount} documents!`);
      if (stats.mappedCount > 0 && stats.completedCount === 0) toast.success(`Mapped ${stats.mappedCount} reports`);
      if (stats.unmatchedCount > 0) toast.warning(`${stats.unmatchedCount} reports left unmatched`);
    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred while applying matches');
    } finally {
      setApplying(false);
    }
  };

  const updateSelection = (index: number, value: string) => {
    setAnalysisItems((prev) => prev ? prev.map((it, i) =>
      i === index ? { ...it, selectedDocId: value === UNMATCHED_VALUE ? UNMATCHED_VALUE : value } : it
    ) : prev);
  };

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const uploadedCount = files.filter((f) => f.status === 'uploaded').length;
  const errorCount = files.filter((f) => f.status === 'error').length;
  const processing = uploading || analyzing || applying;

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
            {role === 'admin' ? 'Bulk Report Upload V2' : 'AI Reports Bulk Upload V2'}
          </h1>
          <p className="text-muted-foreground">
            Reports are matched after upload by reading each PDF's cover page. Review matches and adjust manually before confirming.
          </p>
        </div>

        {/* Upload Area */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Step 1 — Upload &amp; Scan
            </CardTitle>
            <CardDescription>
              Drag and drop PDF files or ZIP archives. Each PDF's cover page is scanned to detect the original document name.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
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
                  <p className="text-sm text-muted-foreground">or click to browse</p>
                </div>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={processing}>
                  Select Files
                </Button>
              </div>
            </div>

            {files.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">
                    Files ({files.length})
                    {uploadedCount > 0 && <span className="text-muted-foreground ml-2">• {uploadedCount} uploaded</span>}
                    {errorCount > 0 && <span className="text-destructive ml-2">• {errorCount} failed</span>}
                  </h4>
                  <Button variant="ghost" size="sm" onClick={clearAll} disabled={processing}>
                    Clear All
                  </Button>
                </div>

                <ScrollArea className="h-[200px] border rounded-lg">
                  <div className="p-3 space-y-2">
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{file.fileName}</p>
                            <p className="text-xs text-muted-foreground">Match key extracted from PDF cover page after upload</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {file.status === 'pending' && <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>}
                          {file.status === 'uploading' && <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Uploading</Badge>}
                          {file.status === 'uploaded' && <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Uploaded</Badge>}
                          {file.status === 'error' && <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Error</Badge>}
                          {!processing && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(index)}>
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {(uploading || analyzing) && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        {uploading ? 'Uploading files...' : 'Scanning PDF cover pages...'}
                      </span>
                      <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} />
                  </div>
                )}

                <div className="mt-4 flex justify-end gap-3">
                  <Button onClick={uploadAndAnalyze} disabled={processing || (pendingCount === 0 && uploadedCount === 0)} size="lg">
                    {uploading || analyzing ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{uploading ? 'Uploading...' : 'Scanning...'}</>
                    ) : (
                      <><ScanLine className="h-4 w-4 mr-2" />Upload &amp; Scan ({files.length} files)</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2 — Audit & Manual Match */}
        {analysisItems && analysisItems.length > 0 && !applyResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                Step 2 — Review Matches
              </CardTitle>
              <CardDescription>
                Each row shows the extracted cover-page name, the auto-matched queue document, and the confidence score. Adjust any incorrect matches before applying.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{analysisItems.length}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="text-center p-3 bg-green-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {analysisItems.filter((i) => i.autoStatus === 'auto_matched').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Auto-matched</p>
                </div>
                <div className="text-center p-3 bg-yellow-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">
                    {analysisItems.filter((i) => i.autoStatus === 'ambiguous').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Ambiguous</p>
                </div>
                <div className="text-center p-3 bg-orange-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">
                    {analysisItems.filter((i) => i.autoStatus === 'unmatched' || i.autoStatus === 'error').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Need Attention</p>
                </div>
              </div>

              <ScrollArea className="max-h-[600px] border rounded-lg">
                <div className="p-3 space-y-3">
                  {analysisItems.map((item, index) => {
                    const statusColor =
                      item.autoStatus === 'auto_matched' ? 'bg-green-500/5 border-green-500/30'
                        : item.autoStatus === 'ambiguous' ? 'bg-yellow-500/5 border-yellow-500/30'
                        : 'bg-orange-500/5 border-orange-500/30';
                    return (
                      <div key={index} className={`p-3 rounded-lg border ${statusColor}`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Left: report info */}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                              <p className="text-sm font-medium truncate" title={item.fileName}>{item.fileName}</p>
                            </div>
                            <div className="text-xs space-y-1 pl-6">
                              <div>
                                <span className="text-muted-foreground">Cover-page name: </span>
                                {item.extractedCoverName ? (
                                  <span className="font-mono">{item.extractedCoverName}</span>
                                ) : (
                                  <span className="italic text-muted-foreground">(not detected — using filename)</span>
                                )}
                                {item.extractionSource && (
                                  <Badge variant="outline" className="ml-2 text-[10px] py-0">
                                    {item.extractionSource === 'modern_second_line' ? 'modern (line 2)' :
                                     item.extractionSource === 'classic_large_heading' ? 'classic (heading)' :
                                     item.extractionSource === 'label_fallback' ? 'label' :
                                     item.extractionSource === 'extension_fallback' ? 'ext' : item.extractionSource}
                                  </Badge>
                                )}
                              </div>
                              <div>
                                <span className="text-muted-foreground">Match key: </span>
                                <span className="font-mono">{item.matchKey}</span>
                                <Badge variant="outline" className="ml-2 text-[10px] py-0">
                                  {item.matchSource === 'cover_page' ? 'cover' : 'filename'}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Detected:</span>
                                <Badge variant={item.reportType === 'similarity' ? 'default' : item.reportType === 'ai' ? 'secondary' : 'outline'} className="text-[10px]">
                                  {item.reportType}
                                </Badge>
                                {item.percentage !== null && <Badge variant="outline" className="text-[10px]">{item.percentage}%</Badge>}
                              </div>
                            </div>
                          </div>

                          {/* Right: match selection */}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="text-sm font-medium">Matched queue document</span>
                              {item.bestMatch && (
                                <Badge
                                  variant={item.bestMatch.confidence >= 95 ? 'default' : item.bestMatch.confidence >= 85 ? 'secondary' : 'outline'}
                                  className="text-[10px]"
                                >
                                  {item.bestMatch.confidence}% confidence
                                </Badge>
                              )}
                            </div>
                            <Select
                              value={item.selectedDocId ?? ''}
                              onValueChange={(v) => updateSelection(index, v)}
                            >
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder="Select queue document..." />
                              </SelectTrigger>
                              <SelectContent>
                                {item.suggestions.length === 0 && (
                                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No candidates found</div>
                                )}
                                {item.suggestions.map((s) => (
                                  <SelectItem key={s.documentId} value={s.documentId}>
                                    <div className="flex items-center gap-2">
                                      <span className="truncate max-w-[300px]">{s.fileName}</span>
                                      <Badge variant="outline" className="text-[10px]">{s.confidence}%</Badge>
                                      {s.hasSimilarityReport && <Badge variant="secondary" className="text-[10px]">SIM</Badge>}
                                      {s.hasAIReport && <Badge variant="secondary" className="text-[10px]">AI</Badge>}
                                    </div>
                                  </SelectItem>
                                ))}
                                <SelectItem value={UNMATCHED_VALUE}>
                                  <span className="text-muted-foreground italic">Leave unmatched</span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            {item.reason && (
                              <p className="text-xs text-muted-foreground pl-6">{item.reason}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="mt-4 flex justify-end gap-3">
                <Button variant="outline" onClick={clearAll} disabled={applying}>Cancel</Button>
                <Button onClick={applyMatches} disabled={applying} size="lg">
                  {applying ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Applying...</>
                  ) : (
                    <><Zap className="h-4 w-4 mr-2" />Confirm &amp; Apply Matches</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Apply Results */}
        {applyResult && (
          <Card>
            <CardHeader>
              <CardTitle>Processing Results</CardTitle>
              <CardDescription>Final mapping summary after applying confirmed matches.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{applyResult.stats.totalReports}</p>
                  <p className="text-sm text-muted-foreground">Total Reports</p>
                </div>
                <div className="text-center p-4 bg-green-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{applyResult.stats.mappedCount}</p>
                  <p className="text-sm text-muted-foreground">Mapped</p>
                </div>
                <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{applyResult.stats.completedCount}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
                <div className="text-center p-4 bg-yellow-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">{applyResult.stats.unmatchedCount}</p>
                  <p className="text-sm text-muted-foreground">Unmatched</p>
                </div>
                <div className="text-center p-4 bg-orange-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">{applyResult.stats.needsReviewCount}</p>
                  <p className="text-sm text-muted-foreground">Needs Review</p>
                </div>
              </div>

              {applyResult.mapped.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-green-600" />
                    Mapped Reports ({applyResult.mapped.length})
                  </h4>
                  <ScrollArea className="h-[150px] border rounded-lg">
                    <div className="p-3 space-y-2">
                      {applyResult.mapped.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-green-500/5 rounded-lg">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate">{item.fileName}</p>
                            {item.extractedCoverName && (
                              <p className="text-xs text-muted-foreground truncate">Cover: {item.extractedCoverName}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={item.reportType === 'similarity' ? 'default' : 'secondary'}>{item.reportType}</Badge>
                            {item.percentage !== null && <Badge variant="outline">{item.percentage}%</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {applyResult.unmatched.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <FileWarning className="h-4 w-4 text-yellow-600" />
                    Unmatched Reports ({applyResult.unmatched.length})
                  </h4>
                  <ScrollArea className="h-[150px] border rounded-lg">
                    <div className="p-3 space-y-2">
                      {applyResult.unmatched.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-yellow-500/5 rounded-lg">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate">{item.fileName}</p>
                            {item.extractedCoverName && (
                              <p className="text-xs text-muted-foreground truncate">Cover: {item.extractedCoverName}</p>
                            )}
                            <p className="text-xs text-muted-foreground">{item.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {applyResult.completedDocuments.length > 0 && (
                <div className="p-4 bg-green-500/10 rounded-lg">
                  <p className="text-sm font-medium text-green-700">
                    ✓ {applyResult.completedDocuments.length} document(s) completed with both reports attached. Customers have been notified.
                  </p>
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <Button variant="outline" onClick={clearAll}>Start New Batch</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
