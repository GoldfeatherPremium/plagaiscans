import React, { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDocuments, Document } from '@/hooks/useDocuments';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/StatusBadge';
import { DocumentSearchFilters, DocumentFilters, filterDocuments } from '@/components/DocumentSearchFilters';
import { useTranslation } from 'react-i18next';

import { EditCompletedDocumentDialog } from '@/components/EditCompletedDocumentDialog';
import { FileText, Download, Loader2, DownloadCloud, Package, Trash2, Pencil, ChevronDown } from 'lucide-react';
import { PushNotificationBanner } from '@/components/PushNotificationBanner';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Shimmer } from '@/components/ui/shimmer';
import { DocumentsSkeleton } from '@/components/ui/page-skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
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

export default function MyDocuments() {
  const { t } = useTranslation('dashboard');
  const { documents, loading, downloadFile, deleteDocument, fetchDocuments } = useDocuments();
  const { role } = useAuth();
  const { toast } = useToast();
  const isStaffOrAdmin = role === 'staff' || role === 'admin';
  const isAdmin = role === 'admin';
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [documentToEdit, setDocumentToEdit] = useState<Document | null>(null);
  const [filters, setFilters] = useState<DocumentFilters>({
    search: '',
    status: 'all',
    dateFrom: undefined,
    dateTo: undefined
  });
  
  // Load more state - show 200 initially, load 200 more each click
  const INITIAL_LOAD = 200;
  const LOAD_MORE_COUNT = 200;
  const [visibleCount, setVisibleCount] = useState(INITIAL_LOAD);

  const allFilteredDocuments = useMemo(() => {
    return filterDocuments(documents, filters);
  }, [documents, filters]);
  
  // Reset visible count when filters change
  React.useEffect(() => {
    setVisibleCount(INITIAL_LOAD);
  }, [filters]);
  
  // Slice to show only visible documents
  const filteredDocuments = useMemo(() => {
    return allFilteredDocuments.slice(0, visibleCount);
  }, [allFilteredDocuments, visibleCount]);
  
  const hasMoreToLoad = visibleCount < allFilteredDocuments.length;
  const remainingCount = allFilteredDocuments.length - visibleCount;
  
  const handleLoadMore = () => {
    setVisibleCount(prev => prev + LOAD_MORE_COUNT);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  };


  const toggleSelection = (docId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    // Select all completed docs from the FULL filtered list (not just visible)
    const completedDocs = allFilteredDocuments.filter(d => d.status === 'completed');
    setSelectedIds(new Set(completedDocs.map(d => d.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDownload = async () => {
    const selectedDocs = filteredDocuments.filter(d => selectedIds.has(d.id) && d.status === 'completed');
    if (selectedDocs.length === 0) {
      toast({ title: 'No completed documents selected', variant: 'destructive' });
      return;
    }

    setBulkDownloading(true);
    toast({ title: 'Starting downloads...', description: `Downloading ${selectedDocs.length} document(s)` });

    for (let i = 0; i < selectedDocs.length; i++) {
      const doc = selectedDocs[i];
      
      // Download similarity report if exists (use original filename from path)
      if (doc.similarity_report_path) {
        await downloadFile(doc.similarity_report_path, 'reports', doc.similarity_report_path.split('/').pop());
        await new Promise(r => setTimeout(r, 300));
      }
      
      // Download AI report if exists (use original filename from path)
      if (doc.ai_report_path) {
        await downloadFile(doc.ai_report_path, 'reports', doc.ai_report_path.split('/').pop());
        await new Promise(r => setTimeout(r, 300));
      }
    }

    setBulkDownloading(false);
    setSelectedIds(new Set());
    toast({ title: 'Downloads complete!' });
  };

  const handleDeleteClick = (doc: Document) => {
    setDocumentToDelete(doc);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!documentToDelete) return;
    
    setIsDeleting(true);
    await deleteDocument(
      documentToDelete.id,
      documentToDelete.file_path,
      documentToDelete.similarity_report_path,
      documentToDelete.ai_report_path
    );
    setIsDeleting(false);
    setDeleteDialogOpen(false);
    setDocumentToDelete(null);
  };

  // Use full filtered list for counts
  const allCompletedCount = allFilteredDocuments.filter(d => d.status === 'completed').length;
  const selectedCompletedCount = allFilteredDocuments.filter(d => selectedIds.has(d.id) && d.status === 'completed').length;
  const visibleCompletedCount = filteredDocuments.filter(d => d.status === 'completed').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Push Notification Prompt */}
        {role === 'customer' && <PushNotificationBanner />}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">{t('documents.title')}</h1>
            <p className="text-muted-foreground mt-1">
              {t('documents.subtitle')} ({allFilteredDocuments.length} total)
            </p>
          </div>
          
          {/* Bulk actions */}
          {allCompletedCount > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                disabled={selectedIds.size === allCompletedCount}
              >
                <Package className="h-4 w-4 mr-1" />
                Select All ({allCompletedCount})
              </Button>
              {selectedIds.size > 0 && (
                <>
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleBulkDownload}
                    disabled={bulkDownloading}
                  >
                    {bulkDownloading ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <DownloadCloud className="h-4 w-4 mr-1" />
                    )}
                    Download Reports ({selectedCompletedCount})
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Search Filters */}
        <DocumentSearchFilters 
          filters={filters} 
          onFiltersChange={setFilters}
          showStatusFilter={true}
        />

        {loading ? (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {/* Shimmer Table Header */}
              <div className="flex items-center gap-4 p-4 border-b bg-muted/50">
                <Shimmer className="h-4 w-4 rounded" />
                <Shimmer className="h-4 w-4" />
                <Shimmer className="h-4 w-8" />
                <Shimmer className="h-4 w-40" />
                <Shimmer className="h-4 w-16" />
                <Shimmer className="h-4 w-20" />
                <Shimmer className="h-4 w-16" />
                <Shimmer className="h-4 w-12" />
                <Shimmer className="h-4 w-12" />
                <Shimmer className="h-4 w-20" />
                <Shimmer className="h-4 w-20" />
                <Shimmer className="h-4 w-16" />
              </div>
              {/* Shimmer Rows */}
              {Array.from({ length: 8 }).map((_, i) => (
                <div 
                  key={i} 
                  className="flex items-center gap-4 p-4 border-b last:border-b-0"
                  style={{ opacity: 1 - (i * 0.08) }}
                >
                  <Shimmer className="h-4 w-4 rounded" />
                  <Shimmer className="h-4 w-4" />
                  <Shimmer className="h-4 w-8" />
                  <Shimmer className="h-4 w-40" />
                  <Shimmer className="h-6 w-16 rounded-full" />
                  <Shimmer className="h-4 w-20" />
                  <Shimmer className="h-6 w-16 rounded-full" />
                  <Shimmer className="h-4 w-12" />
                  <Shimmer className="h-4 w-12" />
                  <Shimmer className="h-8 w-8 rounded" />
                  <Shimmer className="h-8 w-8 rounded" />
                  <Shimmer className="h-4 w-20" />
                </div>
              ))}
            </CardContent>
          </Card>
        ) : filteredDocuments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold text-lg mb-2">No documents found</h3>
              <p className="text-muted-foreground mb-4">
                {documents.length === 0 ? 'Upload your first document to get started' : 'Try adjusting your filters'}
              </p>
              {documents.length === 0 && (
                <Button asChild>
                  <a href="/dashboard/upload">Upload Document</a>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedIds.size === allCompletedCount && allCompletedCount > 0}
                          onCheckedChange={(checked) => checked ? selectAll() : clearSelection()}
                        />
                      </TableHead>
                      <TableHead className="w-12 text-center">#</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>Upload Time</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Similarity %</TableHead>
                      <TableHead className="text-center">AI %</TableHead>
                      <TableHead className="text-center">Similarity Report</TableHead>
                      <TableHead className="text-center">AI Report</TableHead>
                      <TableHead>Remarks</TableHead>
                      {isAdmin && <TableHead className="text-center">Edit</TableHead>}
                      {!isStaffOrAdmin && <TableHead className="text-center">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocuments.map((doc, index) => {
                      const { date, time } = formatDateTime(doc.uploaded_at);
                      const isSelected = selectedIds.has(doc.id);
                      const canSelect = doc.status === 'completed';

                      return (
                        <TableRow key={doc.id} className={isSelected ? 'bg-primary/5' : ''}>
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              disabled={!canSelect}
                              onCheckedChange={() => toggleSelection(doc.id)}
                            />
                          </TableCell>
                          <TableCell className="text-center font-medium">{index + 1}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                              <div className="flex flex-col">
                                <span className="font-medium truncate max-w-[200px]" title={doc.file_name}>
                                  {doc.file_name}
                                </span>
                                {isStaffOrAdmin && (
                                  <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={doc.customer_profile?.email}>
                                    {doc.customer_profile?.full_name || doc.customer_profile?.email || (doc.magic_link_id ? 'Guest' : '-')}
                                  </span>
                                )}
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
                            {doc.similarity_percentage !== null && doc.similarity_percentage !== undefined ? (
                              <span className="font-medium">{doc.similarity_percentage}%</span>
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {doc.ai_percentage !== null && doc.ai_percentage !== undefined ? (
                              <span className="font-medium">{doc.ai_percentage}%</span>
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {doc.similarity_report_path ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadFile(doc.similarity_report_path!, 'reports', doc.similarity_report_path!.split('/').pop())}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            ) : doc.files_cleaned_at && doc.status === 'completed' ? (
                              <span className="text-xs text-muted-foreground">Expired</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {doc.ai_report_path ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadFile(doc.ai_report_path!, 'reports', doc.ai_report_path!.split('/').pop())}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            ) : doc.files_cleaned_at && doc.status === 'completed' ? (
                              <span className="text-xs text-muted-foreground">Expired</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {doc.remarks ? (
                              <span className="text-sm text-foreground">{doc.remarks}</span>
                            ) : doc.error_message ? (
                              <span className="text-sm text-destructive">{doc.error_message}</span>
                            ) : doc.status === 'pending' ? (
                              <span className="text-sm text-muted-foreground">In queue</span>
                            ) : doc.status === 'in_progress' ? (
                              <span className="text-sm text-muted-foreground">Processing...</span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setDocumentToEdit(doc);
                                  setEditDialogOpen(true);
                                }}
                                title="Edit document"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                          {!isStaffOrAdmin && (
                            <TableCell className="text-center">
                              {doc.status === 'completed' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDeleteClick(doc)}
                                  title="Delete file permanently"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Load More Button */}
        {hasMoreToLoad && !loading && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              onClick={handleLoadMore}
              className="gap-2"
            >
              <ChevronDown className="h-4 w-4" />
              Load More ({Math.min(remainingCount, LOAD_MORE_COUNT)} of {remainingCount} remaining)
            </Button>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete File Permanently?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>Are you sure you want to permanently delete this file?</p>
                {documentToDelete && (
                  <p className="font-medium text-foreground">"{documentToDelete.file_name}"</p>
                )}
                <p className="text-destructive font-medium">This action cannot be undone.</p>
                <p className="text-sm">This will permanently remove:</p>
                <ul className="text-sm list-disc list-inside">
                  <li>The original uploaded file</li>
                  <li>The similarity report</li>
                  <li>The AI detection report</li>
                  <li>All associated data and tags</li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Permanently
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Document Dialog */}
        <EditCompletedDocumentDialog
          document={documentToEdit}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={fetchDocuments}
          downloadFile={downloadFile}
        />
      </div>
    </DashboardLayout>
  );
}
