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

interface BulkReportUploadV2ContentProps {
  embedded?: boolean;
  provider?: 'turnitin' | 'drillbit';
}

export function BulkReportUploadV2Content({ embedded = false, provider = 'turnitin' }: BulkReportUploadV2ContentProps = {}) {
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

  const targetScanType = provider === 'drillbit' ? 'drillbit_full' : 'full';

  // Pending AI-scan queue documents (mirrors V1)
  const { data: pendingDocuments = [] } = useQuery({
    queryKey: ['v2-pending-full-scan-documents', targetScanType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('id, file_name, file_path, normalized_filename, status, similarity_report_path, ai_report_path')
        .in('status', ['pending', 'in_progress'])
        .eq('scan_type', targetScanType)
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
    const denied = (
      <div className="flex flex-col items-center justify-center py-16">
        <ShieldX className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground text-center max-w-md">
          You don't have permission to access bulk upload. Please contact an administrator.
        </p>
      </div>
    );
    return embedded ? denied : <DashboardLayout>{denied}</DashboardLayout>;
  }

  const inner = (
    <div className="space-y-6">
      {!embedded && (
        <div className="mb-6">
          <h1 className="text-3xl font-bold">
            {role === 'admin' ? 'Bulk Report Upload V2' : 'AI Reports Bulk Upload V2'}
          </h1>
          <p className="text-muted-foreground">
            Reports are matched after upload by reading each PDF's cover page. Review matches and adjust manually before confirming.
          </p>
        </div>
      )}

        {/* Available queue documents card removed per request — the queue list
            is still accessible inside each row's "Assign to Document" dropdown. */}

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

        {/* Step 2 — Audit & Manual Match (V1-style preview) */}
        {analysisItems && analysisItems.length > 0 && !applyResult && (() => {
          const classify = (it: AnalysisItem): 'exact' | 'partial' | 'none' => {
            const conf = it.bestMatch?.confidence ?? 0;
            if (it.autoStatus === 'auto_matched' && conf >= 95) return 'exact';
            if (it.autoStatus === 'unmatched' || it.autoStatus === 'error' || !it.bestMatch) return 'none';
            return 'partial';
          };
          const stats = {
            exact: analysisItems.filter((i) => classify(i) === 'exact').length,
            partial: analysisItems.filter((i) => classify(i) === 'partial').length,
            none: analysisItems.filter((i) => classify(i) === 'none').length,
          };
          const assignedCount = analysisItems.filter((i) => i.selectedDocId && i.selectedDocId !== UNMATCHED_VALUE).length;

          return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5" />
                  Step 2 — Match Preview
                </CardTitle>
                <CardDescription>
                  Review matches before processing. You can manually assign reports and preview both files.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* V1-style stats */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-700 dark:text-green-300">{stats.exact} Exact</p>
                      <p className="text-xs text-green-600/80">Auto-matched</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    <div>
                      <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">{stats.partial} Partial</p>
                      <p className="text-xs text-yellow-600/80">Review suggested</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <div>
                      <p className="text-sm font-medium text-red-700 dark:text-red-300">{stats.none} No Match</p>
                      <p className="text-xs text-red-600/80">Manual assign needed</p>
                    </div>
                  </div>
                </div>

                {/* Match list */}
                <ScrollArea className="h-[480px] border rounded-lg">
                  <div className="p-2 space-y-1">
                    {analysisItems.map((item, index) => {
                      const status = classify(item);
                      const isExpanded = expandedRows.has(index);
                      const currentAssignment = item.selectedDocId && item.selectedDocId !== UNMATCHED_VALUE
                        ? item.selectedDocId
                        : null;
                      const assignedDoc = currentAssignment
                        ? (item.suggestions.find((s) => s.documentId === currentAssignment)
                            || pendingDocuments.find((d) => d.id === currentAssignment))
                        : null;
                      const assignedName = assignedDoc
                        ? ('fileName' in assignedDoc ? assignedDoc.fileName : assignedDoc.file_name)
                        : null;
                      const assignedFilePath: string | null = assignedDoc
                        ? ((assignedDoc as any).filePath ?? (assignedDoc as any).file_path ?? null)
                        : null;
                      const isManual = !!item.selectedDocId
                        && item.bestMatch
                        && item.selectedDocId !== item.bestMatch.documentId;

                      const borderClass = status === 'exact'
                        ? 'border-green-500/30'
                        : status === 'partial' ? 'border-yellow-500/30' : 'border-red-500/30';
                      const bgClass = status === 'exact'
                        ? 'bg-green-500/5'
                        : status === 'partial' ? 'bg-yellow-500/5' : 'bg-red-500/5';

                      return (
                        <div key={index} className={`border rounded-lg overflow-hidden ${borderClass}`}>
                          {/* Main row — stacks on mobile, inline on sm+ */}
                          <div
                            className={`p-3 cursor-pointer hover:bg-muted/30 ${bgClass}`}
                            onClick={() => toggleRow(index)}
                          >
                            <div className="flex items-start gap-2">
                              {status === 'exact' && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />}
                              {status === 'partial' && <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />}
                              {status === 'none' && <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />}

                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium break-words">{item.fileName}</p>
                                <p className="text-xs text-muted-foreground break-words">
                                  Cover: {item.extractedCoverName || <em>(not detected)</em>}
                                </p>
                                <p className="text-xs text-muted-foreground break-all">
                                  Key: <span className="font-mono">{item.matchKey}</span>
                                </p>
                              </div>

                              {isExpanded
                                ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                            </div>

                            {/* Action / assignment row — wraps on mobile */}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Button
                                variant="outline" size="sm" className="h-7 px-2 text-xs"
                                onClick={(e) => { e.stopPropagation(); previewReport(item.filePath); }}
                                title="Preview uploaded report PDF"
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" /> Report
                              </Button>

                              {currentAssignment ? (
                                <>
                                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                  <div className="flex flex-wrap items-center gap-1 min-w-0">
                                    <span className="text-xs sm:text-sm truncate max-w-[180px] sm:max-w-[260px]">
                                      {assignedName || 'Unknown'}
                                    </span>
                                    {item.bestMatch && !isManual && (
                                      <Badge
                                        variant={item.bestMatch.confidence >= 95 ? 'default' : item.bestMatch.confidence >= 85 ? 'secondary' : 'outline'}
                                        className="text-[10px]"
                                      >
                                        {item.bestMatch.confidence}%
                                      </Badge>
                                    )}
                                    {isManual && <Badge variant="secondary" className="text-[10px]">Manual</Badge>}
                                    <Button
                                      variant="outline" size="sm" className="h-7 px-2 text-xs"
                                      onClick={(e) => { e.stopPropagation(); previewQueueDocument(assignedFilePath as any); }}
                                      title="Preview matched original document"
                                    >
                                      <Eye className="h-3.5 w-3.5 mr-1" /> Original
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <span className="text-xs sm:text-sm text-red-600">No assignment — tap to assign</span>
                              )}
                            </div>
                          </div>


                          {/* Expanded content */}
                          {isExpanded && (
                            <div className="p-3 border-t bg-background space-y-3">
                              <div className="flex flex-wrap gap-2 text-xs">
                                {item.extractionSource && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {item.extractionSource === 'modern_second_line' ? 'modern (line 2)' :
                                     item.extractionSource === 'classic_large_heading' ? 'classic (heading)' :
                                     item.extractionSource === 'label_fallback' ? 'label' :
                                     item.extractionSource === 'extension_fallback' ? 'ext' : item.extractionSource}
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-[10px]">
                                  source: {item.matchSource === 'cover_page' ? 'cover' : 'filename'}
                                </Badge>
                                <Badge variant={item.reportType === 'similarity' ? 'default' : item.reportType === 'ai' ? 'secondary' : 'outline'} className="text-[10px]">
                                  {item.reportType}
                                </Badge>
                                {item.percentage !== null && <Badge variant="outline" className="text-[10px]">{item.percentage}%</Badge>}
                                {item.reason && <span className="text-muted-foreground">{item.reason}</span>}
                              </div>

                              <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                  Assign to Document:
                                </label>
                                <Select
                                  value={item.selectedDocId ?? ''}
                                  onValueChange={(v) => updateSelection(index, v)}
                                >
                                  <SelectTrigger className="w-full h-9 text-xs">
                                    <SelectValue placeholder="Select document..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={UNMATCHED_VALUE}>
                                      <span className="text-muted-foreground italic">— Don't assign —</span>
                                    </SelectItem>
                                    {/* Suggestions first (with confidence) */}
                                    {item.suggestions.map((s) => (
                                      <SelectItem key={s.documentId} value={s.documentId}>
                                        <div className="flex items-center gap-2">
                                          <span className="truncate max-w-[260px]">{s.fileName}</span>
                                          <Badge variant="outline" className="text-[10px]">{s.confidence}%</Badge>
                                          {s.hasSimilarityReport && <Badge variant="secondary" className="text-[10px]">SIM</Badge>}
                                          {s.hasAIReport && <Badge variant="secondary" className="text-[10px]">AI</Badge>}
                                        </div>
                                      </SelectItem>
                                    ))}
                                    {/* All other queue documents */}
                                    {pendingDocuments
                                      .filter((d) => !item.suggestions.some((s) => s.documentId === d.id))
                                      .map((d) => (
                                        <SelectItem key={d.id} value={d.id}>
                                          <div className="flex items-center gap-2">
                                            <span className="truncate max-w-[260px]">{d.file_name}</span>
                                            {d.similarity_report_path && <Badge variant="secondary" className="text-[10px]">SIM</Badge>}
                                            {d.ai_report_path && <Badge variant="secondary" className="text-[10px]">AI</Badge>}
                                          </div>
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {item.suggestions.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-2">
                                    Suggestions (click to assign, eye to preview):
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {item.suggestions.map((s) => (
                                      <div key={s.documentId} className="flex items-center gap-1 border rounded-md pl-2 pr-1 py-1">
                                        <button
                                          type="button"
                                          className="text-xs hover:underline truncate max-w-[200px]"
                                          onClick={() => updateSelection(index, s.documentId)}
                                        >
                                          {s.fileName}
                                        </button>
                                        <Badge variant="secondary" className="text-[10px]">{s.confidence}%</Badge>
                                        <Button
                                          variant="ghost" size="icon" className="h-6 w-6"
                                          onClick={() => previewQueueDocument(s.filePath ?? null)}
                                          title="Preview document"
                                        >
                                          <Eye className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {assignedCount} of {analysisItems.length} reports will be processed
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={clearAll} disabled={applying}>Cancel</Button>
                    <Button onClick={applyMatches} disabled={applying || assignedCount === 0} size="lg">
                      {applying ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Applying...</>
                      ) : (
                        <><Zap className="h-4 w-4 mr-2" />Confirm &amp; Apply ({assignedCount})</>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

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
  );

  return embedded ? inner : <DashboardLayout>{inner}</DashboardLayout>;
}

export default function AdminBulkReportUploadV2() {
  return <BulkReportUploadV2Content />;
}
