import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RemarkSelector } from '@/components/RemarkSelector';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDocuments, Document } from '@/hooks/useDocuments';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/StatusBadge';
import { EditCompletedDocumentDialog } from '@/components/EditCompletedDocumentDialog';
import { CancelDocumentDialog } from '@/components/CancelDocumentDialog';
import { BulkUploadPanel } from '@/components/BulkUploadPanel';
import { useStaffPermissions } from '@/hooks/useStaffPermissions';
import { FileText, Download, Upload, Loader2, Lock, Clock, Unlock, CheckSquare, CheckCheck, FolderUp, Pencil, Ban } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DocumentSearchFilters, DocumentFilters, filterDocuments } from '@/components/DocumentSearchFilters';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface StaffSettings {
  time_limit_minutes: number;
  max_concurrent_files: number;
}

interface BatchReportData {
  docId: string;
  fileName: string;
  similarityFile: File | null;
  aiFile: File | null;
  similarityPercentage: string;
  aiPercentage: string;
  remarks: string;
}

export default function DocumentQueue() {
  const { documents, loading, downloadFile, uploadReport, updateDocumentStatus, releaseDocument, fetchDocuments, cancelDocument } = useDocuments();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isAdmin = role === 'admin';
  const { permissions } = useStaffPermissions();
  const [activeTab, setActiveTab] = useState('queue');
  const canAccessBulkUpload = role === 'admin' || permissions.can_batch_process;
  
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode] = useState<'report'>('report');
  const [similarityFile, setSimilarityFile] = useState<File | null>(null);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [similarityPercentage, setSimilarityPercentage] = useState('');
  const [aiPercentage, setAiPercentage] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [globalTimeout, setGlobalTimeout] = useState(30);
  const [mySettings, setMySettings] = useState<StaffSettings>({ time_limit_minutes: 30, max_concurrent_files: 1 });
  const [, setTick] = useState(0);
  
  // Edit dialog state (admin only)
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [documentToEdit, setDocumentToEdit] = useState<Document | null>(null);
  
  // Cancel dialog state (admin only)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [documentToCancel, setDocumentToCancel] = useState<Document | null>(null);
  const [cancelling, setCancelling] = useState(false);
  
  // Batch selection state
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchReportData, setBatchReportData] = useState<BatchReportData[]>([]);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  
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
      // Get global timeout
      const { data: globalData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'processing_timeout_minutes')
        .maybeSingle();
      if (globalData) setGlobalTimeout(parseInt(globalData.value) || 30);

      // Get my personal staff settings (if staff)
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

  // Check if staff can pick more (admins unlimited, staff based on their limit)
  const canPickMore = role === 'admin' || myInProgressCount < mySettings.max_concurrent_files;

  // Filter documents: show pending (not assigned) or assigned to current user
  // Only show FULL SCAN documents (scan_type = 'full' or null)
  // Sort by uploaded_at ascending (oldest first, newest last)
  const availableDocs = useMemo(() => {
    const roleFiltered = documents.filter((d) => {
      // Only show full scan documents in this queue
      const isFullScan = !d.scan_type || d.scan_type === 'full';
      if (!isFullScan) return false;
      
      if (role === 'admin') {
        return d.status === 'pending' || d.status === 'in_progress';
      }
      // Staff can see: unassigned pending docs OR their own in-progress docs
      return (
        (d.status === 'pending' && !d.assigned_staff_id) ||
        (d.assigned_staff_id === user?.id && d.status === 'in_progress')
      );
    });
    
    // Apply search filters
    const filtered = filterDocuments(roleFiltered, filters);
    
    return filtered.sort((a, b) => new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime());
  }, [documents, role, user?.id, filters]);

  const handlePickDocument = async (doc: Document) => {
    if (!canPickMore && doc.assigned_staff_id !== user?.id) {
      toast({
        title: 'Limit Reached',
        description: `You can only process ${mySettings.max_concurrent_files} document(s) at a time. Complete your current work first.`,
        variant: 'destructive',
      });
      return;
    }
    
    // Start download immediately — don't wait for status update
    downloadFile(doc.file_path, doc.magic_link_id ? 'magic-uploads' : 'documents', doc.file_name);
    
    toast({
      title: 'Document Assigned',
      description: 'Document assigned and download started.',
    });

    // Assign to this staff member (optimistic update happens inside)
    updateDocumentStatus(doc.id, 'in_progress');
  };

  // Toggle document selection
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

  // Select all pending documents
  const selectAllPending = () => {
    const pendingIds = availableDocs
      .filter(d => d.status === 'pending' && !d.assigned_staff_id)
      .map(d => d.id);
    setSelectedDocIds(new Set(pendingIds));
  };

  // Select all my in-progress documents
  const selectAllMyInProgress = () => {
    const myDocs = availableDocs
      .filter(d => d.assigned_staff_id === user?.id && d.status === 'in_progress')
      .map(d => d.id);
    setSelectedDocIds(new Set(myDocs));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedDocIds(new Set());
  };

  // Batch pick documents
  const handleBatchPick = async () => {
    const pendingSelected = availableDocs.filter(
      d => selectedDocIds.has(d.id) && d.status === 'pending' && !d.assigned_staff_id
    );
    
    if (pendingSelected.length === 0) {
      toast({
        title: 'No Documents Selected',
        description: 'Please select pending documents to pick.',
        variant: 'destructive',
      });
      return;
    }

    // Check limit for staff
    if (role === 'staff') {
      const available = mySettings.max_concurrent_files - myInProgressCount;
      if (pendingSelected.length > available) {
        toast({
          title: 'Limit Exceeded',
          description: `You can only pick ${available} more document(s). You selected ${pendingSelected.length}.`,
          variant: 'destructive',
        });
        return;
      }
    }

    // Pick all selected documents (no auto-download)
    for (const doc of pendingSelected) {
      await updateDocumentStatus(doc.id, 'in_progress');
    }
    
    toast({
      title: 'Documents Assigned',
      description: `${pendingSelected.length} document(s) assigned. Use "Batch Download" to download files.`,
    });
    setSelectedDocIds(new Set());
  };

  // Batch download picked documents
  const handleBatchDownload = async () => {
    const myInProgressSelected = availableDocs.filter(
      d => selectedDocIds.has(d.id) && d.assigned_staff_id === user?.id && d.status === 'in_progress'
    );
    
    if (myInProgressSelected.length === 0) {
      toast({
        title: 'No Documents Selected',
        description: 'Please select your in-progress documents to download.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Downloads Starting',
      description: `Downloading ${myInProgressSelected.length} file(s)...`,
    });

    // Download files with small delay between each to prevent browser blocking
    for (let i = 0; i < myInProgressSelected.length; i++) {
      const doc = myInProgressSelected[i];
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      downloadFile(doc.file_path, doc.magic_link_id ? 'magic-uploads' : 'documents', doc.file_name);
    }
    
    setSelectedDocIds(new Set());
  };

  // Open batch upload dialog
  const handleOpenBatchUpload = () => {
    const mySelectedDocs = availableDocs.filter(
      d => selectedDocIds.has(d.id) && d.assigned_staff_id === user?.id && d.status === 'in_progress'
    );
    
    if (mySelectedDocs.length === 0) {
      toast({
        title: 'No Documents Selected',
        description: 'Please select your in-progress documents to upload reports.',
        variant: 'destructive',
      });
      return;
    }

    // Initialize batch data
    setBatchReportData(mySelectedDocs.map(doc => ({
      docId: doc.id,
      fileName: doc.file_name,
      similarityFile: null,
      aiFile: null,
      similarityPercentage: '',
      aiPercentage: '',
      remarks: '',
    })));
    setBatchDialogOpen(true);
  };

  // Update batch report data
  const updateBatchData = (index: number, field: keyof BatchReportData, value: string | File | null) => {
    setBatchReportData(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Submit batch reports
  const handleBatchSubmit = async () => {
    // Validate all entries - both staff and admin must upload both reports
    for (const data of batchReportData) {
      if (!data.similarityFile || !data.aiFile) {
        toast({
          title: 'Reports Required',
          description: `Both reports required for ${data.fileName}`,
          variant: 'destructive',
        });
        return;
      }
    }

    setBatchSubmitting(true);
    try {
      for (const data of batchReportData) {
        const doc = documents.find(d => d.id === data.docId);
        if (doc) {
          await uploadReport(
            data.docId,
            doc,
            data.similarityFile,
            data.aiFile,
            data.similarityPercentage ? parseFloat(data.similarityPercentage) : null,
            data.aiPercentage ? parseFloat(data.aiPercentage) : null,
            data.remarks.trim() || null
          );
        }
      }
      toast({
        title: 'Success',
        description: `${batchReportData.length} document(s) completed.`,
      });
      setBatchDialogOpen(false);
      setBatchReportData([]);
      setSelectedDocIds(new Set());
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit some reports',
        variant: 'destructive',
      });
    } finally {
      setBatchSubmitting(false);
    }
  };

  // Process All - Admin only: mark all pending/in-progress as completed
  const [processingAll, setProcessingAll] = useState(false);
  const [processAllDialogOpen, setProcessAllDialogOpen] = useState(false);
  
  const handleProcessAllConfirm = async () => {
    if (role !== 'admin') return;
    
    const docsToProcess = availableDocs.filter(
      d => d.status === 'pending' || d.status === 'in_progress'
    );
    
    if (docsToProcess.length === 0) {
      toast({
        title: 'No Documents',
        description: 'No pending or in-progress documents to process.',
        variant: 'destructive',
      });
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

      toast({
        title: 'Success',
        description: `${docsToProcess.length} document(s) marked as completed.`,
      });
    } catch (error) {
      console.error('Error processing all:', error);
      toast({
        title: 'Error',
        description: 'Failed to process documents',
        variant: 'destructive',
      });
    } finally {
      setProcessingAll(false);
    }
  };

  const handleOpenDialog = (doc: Document) => {
    setSelectedDoc(doc);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedDoc(null);
    setSimilarityFile(null);
    setAiFile(null);
    setSimilarityPercentage('');
    setAiPercentage('');
    setRemarks('');
  };

  const handleSubmitReport = async () => {
    if (!selectedDoc) return;
    setSubmitting(true);
    await uploadReport(
      selectedDoc.id,
      selectedDoc,
      similarityFile,
      aiFile,
      similarityPercentage ? parseFloat(similarityPercentage) : null,
      aiPercentage ? parseFloat(aiPercentage) : null,
      remarks.trim() || null
    );
    setSubmitting(false);
    handleCloseDialog();
  };

  const handleSimilarityFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setSimilarityFile(e.target.files?.[0] || null);
  };

  const handleAiFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setAiFile(e.target.files?.[0] || null);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  };

  const getElapsedTime = (assignedAt: string | null) => {
    if (!assignedAt) return null;
    const elapsed = Math.floor((Date.now() - new Date(assignedAt).getTime()) / 60000);
    const hours = Math.floor(elapsed / 60);
    const minutes = elapsed % 60;
    return { elapsed, display: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m` };
  };

  // Use personal timeout for staff, global for admin
  const effectiveTimeout = role === 'staff' ? mySettings.time_limit_minutes : globalTimeout;

  const isOverdue = (assignedAt: string | null) => {
    if (!assignedAt) return false;
    const elapsed = Math.floor((Date.now() - new Date(assignedAt).getTime()) / 60000);
    return elapsed >= effectiveTimeout;
  };

  const handleReleaseDocument = async (doc: Document) => {
    await releaseDocument(doc.id);
  };

  const renderQueueContent = () => (
    <>
      {/* Search Filters */}
      <DocumentSearchFilters 
        filters={filters} 
        onFiltersChange={setFilters}
        showStatusFilter={role === 'admin'}
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : availableDocs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No pending documents</p>
          </CardContent>
        </Card>
      ) : (
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
            <CardContent className="p-0">
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
                      <TableHead>Upload Time</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Exclusions</TableHead>
                      <TableHead className="text-center">Processing By</TableHead>
                      <TableHead className="text-center">Time Elapsed</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availableDocs.map((doc, index) => {
                      const isAssignedToMe = doc.assigned_staff_id === user?.id;
                      const { date, time } = formatDateTime(doc.uploaded_at);
                      const elapsedInfo = getElapsedTime(doc.assigned_at);
                      const overdue = isOverdue(doc.assigned_at);
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
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                              <div className="flex flex-col">
                                <span className="font-medium truncate max-w-[200px]" title={doc.file_name}>
                                  {doc.file_name}
                                </span>
                                <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={doc.customer_profile?.email}>
                                  {doc.customer_profile?.full_name || doc.customer_profile?.email || (doc.magic_link_id ? 'Guest' : '-')}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{date}</div>
                              <div className="text-muted-foreground">{time}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <StatusBadge status={doc.status} />
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2 text-xs">
                              {doc.exclude_bibliography && (
                                <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground" title="Exclude bibliography">Bib</span>
                              )}
                              {doc.exclude_quotes && (
                                <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground" title="Exclude quotes">Quotes</span>
                              )}
                              {doc.exclude_small_sources && (
                                <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground" title="Exclude small sources">Small</span>
                              )}
                              {!doc.exclude_bibliography && !doc.exclude_quotes && !doc.exclude_small_sources && (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {isAssignedToMe ? (
                              <span className="text-xs text-primary font-medium">You</span>
                            ) : doc.staff_profile ? (
                              <span className="text-xs text-muted-foreground" title={doc.staff_profile.email}>
                                {doc.staff_profile.full_name || doc.staff_profile.email}
                              </span>
                            ) : doc.assigned_staff_id ? (
                              <span className="text-xs text-muted-foreground">Staff</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {elapsedInfo ? (
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
                            <div className="flex items-center justify-center gap-1">
                              {doc.status === 'pending' && !isAssignedToMe && (
                                <Button 
                                  size="sm" 
                                  onClick={() => handlePickDocument(doc)}
                                  disabled={!canPickMore}
                                >
                                  Pick
                                </Button>
                              )}
                              
                              {isAssignedToMe && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      downloadFile(
                                        doc.file_path,
                                        doc.magic_link_id ? 'magic-uploads' : 'documents',
                                        doc.file_name
                                      )
                                    }
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" onClick={() => handleOpenDialog(doc)}>
                                    <Upload className="h-4 w-4" />
                                  </Button>
                                </>
                              )}

                              {role === 'admin' && !isAssignedToMe && doc.status === 'in_progress' && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      downloadFile(
                                        doc.file_path,
                                        doc.magic_link_id ? 'magic-uploads' : 'documents',
                                        doc.file_name
                                      )
                                    }
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-amber-600 border-amber-600/30"
                                    onClick={() => handleReleaseDocument(doc)}
                                    title="Release document (make available to other staff)"
                                  >
                                    <Unlock className="h-4 w-4" />
                                  </Button>
                                </>
                              )}

                              {/* Admin Edit Button */}
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setDocumentToEdit(doc);
                                    setEditDialogOpen(true);
                                  }}
                                  title="Edit document"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}

                              {/* Admin Cancel Button */}
                              {isAdmin && (doc.status === 'pending' || doc.status === 'in_progress') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => {
                                    setDocumentToCancel(doc);
                                    setCancelDialogOpen(true);
                                  }}
                                  title="Cancel document and refund credit"
                                >
                                  <Ban className="h-4 w-4" />
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
            </CardContent>
          </Card>
        </>
      )}
    </>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">AI Scan Queue</h1>
            <p className="text-muted-foreground mt-1">Process AI scan documents (Similarity + AI Detection)</p>
            {role === 'staff' && (
              <p className="text-sm text-muted-foreground mt-2">
                Your limits: {mySettings.max_concurrent_files} file(s) at a time, {mySettings.time_limit_minutes} min per document
              </p>
            )}
            {!canPickMore && (
              <p className="text-sm text-amber-600 mt-2 flex items-center gap-2">
                <Lock className="h-4 w-4" />
                You have {myInProgressCount}/{mySettings.max_concurrent_files} documents in progress. Complete them to pick more.
              </p>
            )}
          </div>
          
          {/* Admin Action Buttons */}
          {role === 'admin' && (
            <div className="flex items-center gap-2">
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

        {/* Tabs for Queue and Bulk Upload */}
        {canAccessBulkUpload ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="queue">Queue</TabsTrigger>
              <TabsTrigger value="bulk-upload">Bulk Upload</TabsTrigger>
            </TabsList>
            
            <TabsContent value="queue" className="mt-4 space-y-4">
              {renderQueueContent()}
            </TabsContent>
            
            <TabsContent value="bulk-upload" className="mt-4">
              <BulkUploadPanel scanType="full" compact />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4">
            {renderQueueContent()}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
          <DialogContent onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Upload Reports for {selectedDoc?.file_name}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Similarity % *</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="e.g., 15.5"
                    value={similarityPercentage}
                    onChange={(e) => setSimilarityPercentage(e.target.value)}
                  />
                </div>
                <div>
                  <Label>AI % *</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="e.g., 8.2"
                    value={aiPercentage}
                    onChange={(e) => setAiPercentage(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Similarity Report (PDF)</Label>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={handleSimilarityFileChange}
                  onClick={(e) => e.stopPropagation()}
                />
                {similarityFile && (
                  <p className="text-sm text-muted-foreground mt-1">Selected: {similarityFile.name}</p>
                )}
              </div>
              <div>
                <Label>AI Report (PDF)</Label>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={handleAiFileChange}
                  onClick={(e) => e.stopPropagation()}
                />
                {aiFile && (
                  <p className="text-sm text-muted-foreground mt-1">Selected: {aiFile.name}</p>
                )}
              </div>
              <div>
                <RemarkSelector
                  value={remarks}
                  onChange={setRemarks}
                />
              </div>
              
              {/* All staff/admin must upload both reports warning */}
              {(!similarityFile || !aiFile) && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <span className="font-medium">Required:</span> Both Similarity and AI reports must be uploaded
                </p>
              )}
              
              <Button 
                className="w-full" 
                onClick={handleSubmitReport} 
                disabled={submitting || !similarityFile || !aiFile}
              >
                {submitting ? 'Submitting...' : 'Complete & Submit'}
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
                      <Label className="text-xs">Similarity %</Label>
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
                      <Label className="text-xs">AI %</Label>
                      <Input 
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="e.g., 8.2"
                        value={data.aiPercentage}
                        onChange={(e) => updateBatchData(index, 'aiPercentage', e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Similarity Report (PDF)</Label>
                      <Input 
                        type="file" 
                        accept=".pdf" 
                        onChange={(e) => updateBatchData(index, 'similarityFile', e.target.files?.[0] || null)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      {data.similarityFile && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{data.similarityFile.name}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs">AI Report (PDF)</Label>
                      <Input 
                        type="file" 
                        accept=".pdf" 
                        onChange={(e) => updateBatchData(index, 'aiFile', e.target.files?.[0] || null)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      {data.aiFile && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{data.aiFile.name}</p>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <RemarkSelector
                      value={data.remarks}
                      onChange={(val) => updateBatchData(index, 'remarks', val)}
                      label="Remarks (Optional)"
                      labelClassName="text-xs"
                      compact
                    />
                  </div>
                  
                  {(!data.similarityFile || !data.aiFile) && (
                    <p className="text-xs text-destructive">Both reports required</p>
                  )}
                </div>
              ))}
              
              <Button 
                className="w-full" 
                onClick={handleBatchSubmit}
                disabled={batchSubmitting || batchReportData.some(d => !d.similarityFile || !d.aiFile)}
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

        {/* Process All Confirmation Dialog */}
        <AlertDialog open={processAllDialogOpen} onOpenChange={setProcessAllDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Process All Documents?</AlertDialogTitle>
              <AlertDialogDescription>
                This will mark <strong>{availableDocs.length} document(s)</strong> as completed. 
                This action cannot be undone. Documents will be marked as completed without reports.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleProcessAllConfirm}
                className="bg-green-600 hover:bg-green-700"
              >
                Yes, Process All
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Document Dialog (Admin only) */}
        <EditCompletedDocumentDialog
          document={documentToEdit}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={fetchDocuments}
          downloadFile={downloadFile}
        />

        {/* Cancel Document Dialog (Admin only) */}
        <CancelDocumentDialog
          open={cancelDialogOpen}
          onOpenChange={setCancelDialogOpen}
          document={documentToCancel}
          cancelling={cancelling}
          onConfirm={async (reason) => {
            if (!documentToCancel || !user) return;
            setCancelling(true);
            try {
              await cancelDocument(documentToCancel.id, reason, user.id);
              setCancelDialogOpen(false);
              setDocumentToCancel(null);
            } finally {
              setCancelling(false);
            }
          }}
        />
      </div>
    </DashboardLayout>
  );
}