import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Upload, Clock, CheckCircle, User, Loader2, Download, AlertCircle, Trash2, Lock, Unlock, CheckSquare, CheckCheck, FileStack } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DashboardLayout } from '@/components/DashboardLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { DocumentSearchFilters, DocumentFilters, filterDocuments } from '@/components/DocumentSearchFilters';
import { useAuth } from '@/contexts/AuthContext';
import { useSimilarityDocuments, SimilarityDocument } from '@/hooks/useSimilarityDocuments';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { SEO } from '@/components/SEO';
import { format } from 'date-fns';

interface StaffSettings {
  time_limit_minutes: number;
  max_concurrent_files: number;
}

interface BatchReportData {
  docId: string;
  fileName: string;
  similarityFile: File | null;
  similarityPercentage: string;
  remarks: string;
}

const SimilarityQueue: React.FC = () => {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { documents, loading, fetchDocuments, uploadSimilarityReport, deleteSimilarityDocument } = useSimilarityDocuments();
  
  // Dialog states
  const [selectedDoc, setSelectedDoc] = useState<SimilarityDocument | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [similarityReport, setSimilarityReport] = useState<File | null>(null);
  const [similarityPercentage, setSimilarityPercentage] = useState('');
  const [remarks, setRemarks] = useState('');
  const [uploading, setUploading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<SimilarityDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState('queue');
  
  // Batch selection state
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchReportData, setBatchReportData] = useState<BatchReportData[]>([]);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  
  // Staff settings
  const [globalTimeout, setGlobalTimeout] = useState(30);
  const [mySettings, setMySettings] = useState<StaffSettings>({ time_limit_minutes: 30, max_concurrent_files: 1 });
  const [, setTick] = useState(0);
  
  // Process All state
  const [processingAll, setProcessingAll] = useState(false);
  const [processAllDialogOpen, setProcessAllDialogOpen] = useState(false);
  
  // Search filters state
  const [filters, setFilters] = useState<DocumentFilters>({
    search: '',
    status: 'all',
    dateFrom: undefined,
    dateTo: undefined
  });

  // Fetch settings
  useEffect(() => {
    const fetchSettings = async () => {
      const { data: globalData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'processing_timeout_minutes')
        .maybeSingle();
      if (globalData) setGlobalTimeout(parseInt(globalData.value) || 30);

      if (user && role === 'staff') {
        const { data: staffData } = await supabase
          .from('staff_settings')
          .select('time_limit_minutes, max_concurrent_files')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (staffData) {
          setMySettings({
            time_limit_minutes: staffData.time_limit_minutes,
            max_concurrent_files: staffData.max_concurrent_files,
          });
        }
      }
    };
    fetchSettings();
  }, [user, role]);

  // Update elapsed time every minute
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // Count how many documents staff currently has in progress
  const myInProgressCount = documents.filter(
    (d) => d.assigned_staff_id === user?.id && d.status === 'in_progress'
  ).length;

  // Check if staff can pick more
  const canPickMore = role === 'admin' || myInProgressCount < mySettings.max_concurrent_files;

  // Filter documents based on status and role
  const availableDocs = useMemo(() => {
    const roleFiltered = documents.filter((d) => {
      if (role === 'customer') {
        return d.status === 'pending' || d.status === 'in_progress';
      }
      if (role === 'admin') {
        return d.status === 'pending' || d.status === 'in_progress';
      }
      // Staff can see: unassigned pending docs OR their own in-progress docs
      return (
        (d.status === 'pending' && !d.assigned_staff_id) ||
        (d.assigned_staff_id === user?.id && d.status === 'in_progress')
      );
    });
    
    const filtered = filterDocuments(roleFiltered, filters);
    return filtered.sort((a, b) => new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime());
  }, [documents, role, user?.id, filters]);
  
  // Completed documents for customers
  const completedDocuments = useMemo(() => {
    if (role !== 'customer') return [];
    const completed = documents.filter((doc) => doc.status === 'completed');
    return filterDocuments(completed, { ...filters, status: 'all' });
  }, [documents, role, filters]);

  const handleAssignToMe = async (docId: string) => {
    if (!user) return;
    if (!canPickMore) {
      toast({
        title: 'Limit Reached',
        description: `You can only process ${mySettings.max_concurrent_files} document(s) at a time.`,
        variant: 'destructive',
      });
      return;
    }
    
    setAssigning(docId);

    try {
      const { error } = await supabase
        .from('documents')
        .update({
          assigned_staff_id: user.id,
          assigned_at: new Date().toISOString(),
          status: 'in_progress',
        })
        .eq('id', docId);

      if (error) throw error;

      await supabase.from('activity_logs').insert({
        staff_id: user.id,
        document_id: docId,
        action: 'assigned_similarity',
      });

      // Auto-download the file
      const doc = documents.find(d => d.id === docId);
      if (doc) {
        handleDownloadOriginal(doc.file_path, doc.file_name);
      }

      toast({ title: 'Document assigned', description: 'Document assigned and download started.' });
      await fetchDocuments();
    } catch (error) {
      console.error('Error assigning document:', error);
      toast({ title: 'Error', description: 'Failed to assign document', variant: 'destructive' });
    } finally {
      setAssigning(null);
    }
  };

  const handleDownloadOriginal = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 300);

      if (error) throw error;

      const response = await fetch(data.signedUrl);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({ title: 'Error', description: 'Failed to download file', variant: 'destructive' });
    }
  };

  const handleDownloadReport = async (reportPath: string, originalFileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('reports')
        .createSignedUrl(reportPath, 300);

      if (error) throw error;

      const response = await fetch(data.signedUrl);
      const blob = await response.blob();
      
      // Use the original report filename from the path
      const reportFileName = reportPath.split('/').pop() || `Similarity_Report_${originalFileName.replace(/\.[^/.]+$/, '')}.pdf`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = reportFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading report:', error);
      toast({ title: 'Error', description: 'Failed to download report', variant: 'destructive' });
    }
  };

  const handleUploadReport = async () => {
    if (!selectedDoc || !similarityReport) {
      toast({ title: 'Error', description: 'Please upload a similarity report', variant: 'destructive' });
      return;
    }

    setUploading(true);

    try {
      await uploadSimilarityReport(
        selectedDoc.id,
        similarityReport,
        similarityPercentage ? parseFloat(similarityPercentage) : null,
        remarks
      );

      setUploadDialogOpen(false);
      setSelectedDoc(null);
      setSimilarityReport(null);
      setSimilarityPercentage('');
      setRemarks('');
    } catch (error: any) {
      console.error('Error uploading report:', error);
      const errorMessage = error?.message || error?.error_description || 'Failed to upload report';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!documentToDelete) return;
    
    setDeleting(true);
    try {
      await deleteSimilarityDocument(
        documentToDelete.id,
        documentToDelete.file_path,
        documentToDelete.similarity_report_path
      );
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({ title: 'Error', description: 'Failed to delete document', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const handleReleaseDocument = async (doc: SimilarityDocument) => {
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          assigned_staff_id: null,
          assigned_at: null,
          status: 'pending',
        })
        .eq('id', doc.id);

      if (error) throw error;
      toast({ title: 'Document released', description: 'Document is now available for others.' });
      await fetchDocuments();
    } catch (error) {
      console.error('Error releasing document:', error);
      toast({ title: 'Error', description: 'Failed to release document', variant: 'destructive' });
    }
  };

  // Batch operations
  const toggleDocSelection = (docId: string) => {
    setSelectedDocIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  const selectAllPending = () => {
    const pendingIds = availableDocs
      .filter(d => d.status === 'pending' && !d.assigned_staff_id)
      .map(d => d.id);
    setSelectedDocIds(new Set(pendingIds));
  };

  const selectAllMyInProgress = () => {
    const myDocs = availableDocs
      .filter(d => d.assigned_staff_id === user?.id && d.status === 'in_progress')
      .map(d => d.id);
    setSelectedDocIds(new Set(myDocs));
  };

  const clearSelection = () => {
    setSelectedDocIds(new Set());
  };

  const handleBatchPick = async () => {
    const pendingSelected = availableDocs.filter(
      d => selectedDocIds.has(d.id) && d.status === 'pending' && !d.assigned_staff_id
    );
    
    if (pendingSelected.length === 0) {
      toast({ title: 'No Documents Selected', description: 'Please select pending documents to pick.', variant: 'destructive' });
      return;
    }

    if (role === 'staff') {
      const available = mySettings.max_concurrent_files - myInProgressCount;
      if (pendingSelected.length > available) {
        toast({
          title: 'Limit Exceeded',
          description: `You can only pick ${available} more document(s).`,
          variant: 'destructive',
        });
        return;
      }
    }

    for (const doc of pendingSelected) {
      await supabase
        .from('documents')
        .update({
          assigned_staff_id: user?.id,
          assigned_at: new Date().toISOString(),
          status: 'in_progress',
        })
        .eq('id', doc.id);
    }
    
    toast({ title: 'Documents Assigned', description: `${pendingSelected.length} document(s) assigned. Use "Batch Download" to download files.` });
    setSelectedDocIds(new Set());
    await fetchDocuments();
  };

  const handleBatchDownload = async () => {
    const myInProgressSelected = availableDocs.filter(
      d => selectedDocIds.has(d.id) && d.assigned_staff_id === user?.id && d.status === 'in_progress'
    );
    
    if (myInProgressSelected.length === 0) {
      toast({ title: 'No Documents Selected', description: 'Please select your in-progress documents to download.', variant: 'destructive' });
      return;
    }

    toast({ title: 'Downloads Starting', description: `Downloading ${myInProgressSelected.length} file(s)...` });

    for (let i = 0; i < myInProgressSelected.length; i++) {
      const doc = myInProgressSelected[i];
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      handleDownloadOriginal(doc.file_path, doc.file_name);
    }
    
    setSelectedDocIds(new Set());
  };

  const handleOpenBatchUpload = () => {
    const mySelectedDocs = availableDocs.filter(
      d => selectedDocIds.has(d.id) && d.assigned_staff_id === user?.id && d.status === 'in_progress'
    );
    
    if (mySelectedDocs.length === 0) {
      toast({ title: 'No Documents Selected', description: 'Please select your in-progress documents to upload reports.', variant: 'destructive' });
      return;
    }

    setBatchReportData(mySelectedDocs.map(doc => ({
      docId: doc.id,
      fileName: doc.file_name,
      similarityFile: null,
      similarityPercentage: '',
      remarks: '',
    })));
    setBatchDialogOpen(true);
  };

  const updateBatchData = (index: number, field: keyof BatchReportData, value: string | File | null) => {
    setBatchReportData(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleBatchSubmit = async () => {
    for (const data of batchReportData) {
      if (!data.similarityFile) {
        toast({ title: 'Report Required', description: `Similarity report required for ${data.fileName}`, variant: 'destructive' });
        return;
      }
    }

    setBatchSubmitting(true);
    try {
      for (const data of batchReportData) {
        await uploadSimilarityReport(
          data.docId,
          data.similarityFile!,
          parseFloat(data.similarityPercentage) || null,
          data.remarks.trim() || undefined
        );
      }
      toast({ title: 'Success', description: `${batchReportData.length} document(s) completed.` });
      setBatchDialogOpen(false);
      setBatchReportData([]);
      setSelectedDocIds(new Set());
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to submit some reports', variant: 'destructive' });
    } finally {
      setBatchSubmitting(false);
    }
  };

  // Process All - Admin only
  const handleProcessAllConfirm = async () => {
    if (role !== 'admin') return;
    
    const docsToProcess = availableDocs.filter(
      d => d.status === 'pending' || d.status === 'in_progress'
    );
    
    if (docsToProcess.length === 0) {
      toast({ title: 'No Documents', description: 'No pending or in-progress documents to process.', variant: 'destructive' });
      return;
    }

    setProcessingAll(true);
    setProcessAllDialogOpen(false);
    try {
      const { error } = await supabase
        .from('documents')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          assigned_staff_id: user?.id,
          assigned_at: new Date().toISOString(),
        })
        .in('id', docsToProcess.map(d => d.id));

      if (error) throw error;

      toast({ title: 'Success', description: `${docsToProcess.length} document(s) marked as completed.` });
      await fetchDocuments();
    } catch (error) {
      console.error('Error processing all:', error);
      toast({ title: 'Error', description: 'Failed to process documents', variant: 'destructive' });
    } finally {
      setProcessingAll(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy HH:mm');
  };

  const getElapsedTime = (assignedAt: string | null) => {
    if (!assignedAt) return null;
    const elapsed = Math.floor((Date.now() - new Date(assignedAt).getTime()) / 60000);
    const hours = Math.floor(elapsed / 60);
    const minutes = elapsed % 60;
    return { elapsed, display: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m` };
  };

  const effectiveTimeout = role === 'staff' ? mySettings.time_limit_minutes : globalTimeout;

  const isOverdue = (assignedAt: string | null) => {
    if (!assignedAt) return false;
    const elapsed = Math.floor((Date.now() - new Date(assignedAt).getTime()) / 60000);
    return elapsed >= effectiveTimeout;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <SEO 
        title="Similarity Queue" 
        description="Process similarity-only document checks"
      />
      
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Search className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-display font-bold">
                {role === 'customer' ? 'My Similarity Documents' : 'Similarity Queue'}
              </h1>
            </div>
            <p className="text-muted-foreground mt-1">
              {role === 'customer' 
                ? 'View your similarity-only document checks' 
                : 'Process similarity-only documents (no AI detection required)'}
            </p>
            {role === 'staff' && (
              <p className="text-sm text-muted-foreground mt-2">
                Your limits: {mySettings.max_concurrent_files} file(s) at a time, {mySettings.time_limit_minutes} min per document
              </p>
            )}
            {!canPickMore && role !== 'customer' && (
              <p className="text-sm text-amber-600 mt-2 flex items-center gap-2">
                <Lock className="h-4 w-4" />
                You have {myInProgressCount}/{mySettings.max_concurrent_files} documents in progress.
              </p>
            )}
          </div>
          
          {/* Action Buttons - Admin Only */}
          {role === 'admin' && (
            <div className="flex gap-2">
              <Button 
                onClick={() => navigate('/dashboard/similarity-bulk-upload')}
                variant="outline"
              >
                <FileStack className="h-4 w-4 mr-2" />
                Bulk Upload
              </Button>
              {availableDocs.length > 0 && (
                <Button 
                  onClick={() => setProcessAllDialogOpen(true)}
                  disabled={processingAll}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {processingAll ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCheck className="h-4 w-4 mr-2" />
                      Process All ({availableDocs.length})
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">
                    {documents.filter((d) => d.status === 'pending').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold">
                    {documents.filter((d) => d.status === 'in_progress').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {role === 'customer' ? 'Completed' : 'Completed Today'}
                  </p>
                  <p className="text-2xl font-bold">
                    {role === 'customer' 
                      ? completedDocuments.length
                      : documents.filter(
                          (d) =>
                            d.status === 'completed' &&
                            d.completed_at &&
                            new Date(d.completed_at).toDateString() === new Date().toDateString()
                        ).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search Filters */}
        <DocumentSearchFilters 
          filters={filters} 
          onFiltersChange={setFilters}
          showStatusFilter={role === 'admin'}
        />

        {/* Customer view with tabs */}
        {role === 'customer' ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="queue">
                In Progress ({availableDocs.length})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({completedDocuments.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="queue" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Documents Being Processed</CardTitle>
                  <CardDescription>
                    Your documents awaiting similarity check
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {availableDocs.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No documents in progress</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Document</TableHead>
                          <TableHead>Uploaded</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {availableDocs.map((doc) => (
                          <TableRow key={doc.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-muted-foreground" />
                                <div>
                                  <p className="font-medium truncate max-w-[200px]">{doc.file_name}</p>
                                  <Badge variant="secondary" className="text-xs mt-1">
                                    <Search className="h-3 w-3 mr-1" />
                                    Similarity Only
                                  </Badge>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDateTime(doc.uploaded_at)}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={doc.status} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="completed" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Completed Documents</CardTitle>
                  <CardDescription>
                    Download your similarity reports or delete documents
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {completedDocuments.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No completed documents</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Document</TableHead>
                          <TableHead>Similarity %</TableHead>
                          <TableHead>Completed</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {completedDocuments.map((doc) => (
                          <TableRow key={doc.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-muted-foreground" />
                                <p className="font-medium truncate max-w-[200px]">{doc.file_name}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {doc.similarity_percentage !== null && doc.similarity_percentage !== undefined ? (
                                <Badge variant={doc.similarity_percentage > 20 ? 'destructive' : 'secondary'}>
                                  {doc.similarity_percentage}%
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">N/A</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {doc.completed_at ? formatDateTime(doc.completed_at) : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {doc.similarity_report_path && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDownloadReport(doc.similarity_report_path!, doc.file_name)}
                                  >
                                    <Download className="h-4 w-4 mr-2" />
                                    Report
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => {
                                    setDocumentToDelete(doc);
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          /* Staff/Admin view with batch operations */
          <>
            {/* Batch Action Buttons */}
            {selectedDocIds.size > 0 && (
              <div className="flex items-center gap-2 flex-wrap bg-muted/50 p-3 rounded-lg">
                <span className="text-sm font-medium">{selectedDocIds.size} selected</span>
                <Button size="sm" variant="outline" onClick={clearSelection}>
                  Clear
                </Button>
                <Button size="sm" onClick={handleBatchPick}>
                  <CheckSquare className="h-4 w-4 mr-1" />
                  Batch Pick
                </Button>
                <Button size="sm" variant="secondary" onClick={handleBatchDownload}>
                  <Download className="h-4 w-4 mr-1" />
                  Batch Download
                </Button>
                <Button size="sm" variant="default" onClick={handleOpenBatchUpload}>
                  <Upload className="h-4 w-4 mr-1" />
                  Batch Upload Reports
                </Button>
              </div>
            )}
            
            {/* Quick Select Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Quick Select:</span>
              <Button size="sm" variant="ghost" onClick={selectAllPending}>
                All Pending
              </Button>
              <Button size="sm" variant="ghost" onClick={selectAllMyInProgress}>
                My In-Progress
              </Button>
              {selectedDocIds.size > 0 && (
                <Button size="sm" variant="ghost" onClick={clearSelection}>
                  Clear All
                </Button>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Documents Awaiting Similarity Check</CardTitle>
                <CardDescription>
                  Only similarity report is required for these documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                {availableDocs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No documents in the similarity queue</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10 text-center">
                            <Checkbox 
                              checked={selectedDocIds.size === availableDocs.length && availableDocs.length > 0}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedDocIds(new Set(availableDocs.map(d => d.id)));
                                } else {
                                  setSelectedDocIds(new Set());
                                }
                              }}
                            />
                          </TableHead>
                          <TableHead className="w-12 text-center">#</TableHead>
                          <TableHead>Document</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Uploaded</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="text-center">Assigned To</TableHead>
                          <TableHead className="text-center">Time Elapsed</TableHead>
                          <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {availableDocs.map((doc, index) => {
                          const isAssignedToMe = doc.assigned_staff_id === user?.id;
                          const elapsedInfo = getElapsedTime(doc.assigned_staff_id ? doc.uploaded_at : null);
                          const overdue = isOverdue(doc.assigned_staff_id ? doc.uploaded_at : null);
                          const isSelected = selectedDocIds.has(doc.id);

                          return (
                            <TableRow key={doc.id} className={`${isSelected ? 'bg-primary/10' : ''} ${isAssignedToMe ? 'bg-primary/5' : ''} ${overdue ? 'bg-destructive/5' : ''}`}>
                              <TableCell className="text-center">
                                <Checkbox 
                                  checked={isSelected}
                                  onCheckedChange={() => toggleDocSelection(doc.id)}
                                />
                              </TableCell>
                              <TableCell className="text-center font-medium">
                                {index + 1}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <FileText className="h-5 w-5 text-muted-foreground" />
                                  <div>
                                    <p className="font-medium truncate max-w-[200px]">{doc.file_name}</p>
                                    <Badge variant="secondary" className="text-xs mt-1">
                                      <Search className="h-3 w-3 mr-1" />
                                      Similarity Only
                                    </Badge>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm truncate max-w-[150px]">
                                    {doc.profile?.full_name || doc.profile?.email || 'Unknown'}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDateTime(doc.uploaded_at)}
                              </TableCell>
                              <TableCell className="text-center">
                                <StatusBadge status={doc.status} />
                              </TableCell>
                              <TableCell className="text-center">
                                {isAssignedToMe ? (
                                  <span className="text-xs text-primary font-medium">You</span>
                                ) : doc.staff_profile ? (
                                  <span className="text-xs text-muted-foreground">
                                    {doc.staff_profile.full_name || doc.staff_profile.email}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {doc.status === 'in_progress' && elapsedInfo ? (
                                  <div className={`flex items-center justify-center gap-1 text-xs ${overdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                    <Clock className="h-3 w-3" />
                                    {elapsedInfo.display}
                                    {overdue && <span className="text-destructive">(overdue)</span>}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-center gap-2 flex-wrap">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDownloadOriginal(doc.file_path, doc.file_name)}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>

                                  {doc.status === 'pending' && !doc.assigned_staff_id && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleAssignToMe(doc.id)}
                                      disabled={assigning === doc.id || !canPickMore}
                                    >
                                      {assigning === doc.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        'Pick'
                                      )}
                                    </Button>
                                  )}

                                  {isAssignedToMe && doc.status === 'in_progress' && (
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setSelectedDoc(doc);
                                        setUploadDialogOpen(true);
                                      }}
                                    >
                                      <Upload className="h-4 w-4" />
                                    </Button>
                                  )}

                                  {role === 'admin' && !isAssignedToMe && doc.status === 'in_progress' && (
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="text-amber-600 border-amber-600/30"
                                      onClick={() => handleReleaseDocument(doc)}
                                      title="Release document"
                                    >
                                      <Unlock className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Info Card */}
        <Card className="bg-muted/50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Similarity-Only Documents</p>
                <p className="text-muted-foreground mt-1">
                  {role === 'customer'
                    ? 'These documents are checked for similarity only. You can delete completed documents after downloading the report.'
                    : 'These documents only require a similarity report. No AI detection report is needed.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Single Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
        setUploadDialogOpen(open);
        if (!open) {
          setSelectedDoc(null);
          setSimilarityReport(null);
          setSimilarityPercentage('');
          setRemarks('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Similarity Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Document</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedDoc?.file_name}
              </p>
            </div>

            <div>
              <Label>Similarity Report (PDF)</Label>
              <Input
                type="file"
                accept=".pdf"
                onChange={(e) => setSimilarityReport(e.target.files?.[0] || null)}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Similarity Percentage (%) - Optional</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={similarityPercentage}
                onChange={(e) => setSimilarityPercentage(e.target.value)}
                placeholder="e.g., 15.5"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Remarks (Optional)</Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Any additional notes..."
                className="mt-1"
              />
            </div>

            <Button
              className="w-full"
              onClick={handleUploadReport}
              disabled={uploading || !similarityReport}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Complete Upload
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Upload Dialog */}
      <Dialog open={batchDialogOpen} onOpenChange={(open) => !open && setBatchDialogOpen(false)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Batch Upload Reports ({batchReportData.length} documents)</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {batchReportData.map((data, index) => (
              <div key={data.docId} className="border rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  {data.fileName}
                </h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Similarity % (Optional)</Label>
                    <Input 
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder="e.g., 15.5"
                      value={data.similarityPercentage}
                      onChange={(e) => updateBatchData(index, 'similarityPercentage', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Similarity Report (PDF) *</Label>
                    <Input 
                      type="file" 
                      accept=".pdf" 
                      onChange={(e) => updateBatchData(index, 'similarityFile', e.target.files?.[0] || null)}
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-xs">Remarks (Optional)</Label>
                  <Textarea 
                    placeholder="Add notes..."
                    value={data.remarks}
                    onChange={(e) => updateBatchData(index, 'remarks', e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            ))}
            
            <Button 
              className="w-full" 
              onClick={handleBatchSubmit} 
              disabled={batchSubmitting}
            >
              {batchSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                `Complete All ${batchReportData.length} Documents`
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{documentToDelete?.file_name}"? This will permanently remove the document and its similarity report. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDocument}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Process All Confirmation Dialog */}
      <AlertDialog open={processAllDialogOpen} onOpenChange={setProcessAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Process All Documents</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark all {availableDocs.length} document(s) as completed? This is typically used for bulk processing where reports are uploaded separately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleProcessAllConfirm}>
              Process All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default SimilarityQueue;
