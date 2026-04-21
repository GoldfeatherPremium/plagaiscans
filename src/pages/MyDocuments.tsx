import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDocuments, Document } from '@/hooks/useDocuments';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/StatusBadge';
import { DocumentSearchFilters, DocumentFilters, filterDocuments } from '@/components/DocumentSearchFilters';
import { useTranslation } from 'react-i18next';

import { EditCompletedDocumentDialog } from '@/components/EditCompletedDocumentDialog';
import { FileText, Download, Loader2, DownloadCloud, Package, Trash2, Pencil, ChevronDown, ChevronLeft, ChevronRight, Info, MessageSquare, Sparkles } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  const { role, profile } = useAuth();
  const { toast } = useToast();
  const isStaffOrAdmin = role === 'staff' || role === 'admin';
  const isAdmin = role === 'admin';
  const hasZeroCredits = (profile?.credit_balance ?? 0) === 0 && (profile?.similarity_credit_balance ?? 0) === 0;
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
    scanType: 'all',
    dateFrom: undefined,
    dateTo: undefined
  });
  
  // Pagination state
  const DOCS_PER_PAGE = 50;
  const [currentPage, setCurrentPage] = useState(1);

  const allFilteredDocuments = useMemo(() => {
    return filterDocuments(documents, filters);
  }, [documents, filters]);
  
  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filters]);
  
  const totalPages = Math.ceil(allFilteredDocuments.length / DOCS_PER_PAGE);
  
  // Slice to show only current page documents
  const filteredDocuments = useMemo(() => {
    const start = (currentPage - 1) * DOCS_PER_PAGE;
    return allFilteredDocuments.slice(start, start + DOCS_PER_PAGE);
  }, [allFilteredDocuments, currentPage]);

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
    // Select all completed docs from the FULL filtered list (not just visible) — exclude sample
    const completedDocs = allFilteredDocuments.filter(d => d.status === 'completed' && !d.is_sample);
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

  // Use full filtered list for counts — exclude sample (no checkbox)
  const allCompletedCount = allFilteredDocuments.filter(d => d.status === 'completed' && !d.is_sample).length;
  const selectedCompletedCount = allFilteredDocuments.filter(d => selectedIds.has(d.id) && d.status === 'completed').length;
  const visibleCompletedCount = filteredDocuments.filter(d => d.status === 'completed' && !d.is_sample).length;
  const onlySampleVisible = documents.length === 1 && documents[0]?.is_sample === true;

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

        {/* Thesis Elite — research support nudge for customers */}
        {role === 'customer' && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm sm:text-base font-semibold text-foreground mb-1">
                    Got a high AI or similarity score?
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Reduce AI-generated content and improve originality with{' '}
                    <a
                      href="https://thesiselite.com"
                      target="_blank"
                      rel="noopener"
                      className="text-primary hover:underline font-medium"
                    >
                      research support for PhD scholars
                    </a>{' '}
                    from Thesis Elite — covering thesis editing, paraphrasing assistance, and journal-ready revisions.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sample document helper nudge for customers */}
        {role === 'customer' && documents.some(d => d.is_sample) && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-3 sm:p-4">
              <p className="text-sm text-muted-foreground">
                {t('sample.helperText')}
                {hasZeroCredits && onlySampleVisible && (
                  <>
                    {' '}{t('sample.readyForReal')}{' '}
                    <Link to="/dashboard/buy-credits" className="text-primary hover:underline font-medium">
                      {t('sample.buyCreditsCta')}
                    </Link>
                  </>
                )}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Search Filters */}
        <DocumentSearchFilters 
          filters={filters} 
          onFiltersChange={setFilters}
          showStatusFilter={true}
          showScanTypeFilter={isAdmin}
        />

        {/* AI Humanizer CTA - Top */}

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
                    {(() => {
                      // Compute real-document index (excluding sample) so row numbering ignores sample
                      let realIdx = 0;
                      const baseOffset = (currentPage - 1) * DOCS_PER_PAGE;
                      // Count any sample docs in earlier pages doesn't apply — sample is always first row of page 1
                      return filteredDocuments.map((doc, index) => {
                        const { date, time } = formatDateTime(doc.uploaded_at);
                        const isSelected = selectedIds.has(doc.id);
                        const isSample = !!doc.is_sample;
                        const canSelect = doc.status === 'completed' && !isSample;
                        if (!isSample) realIdx += 1;
                        const rowNumber = isSample ? '★' : String(baseOffset + realIdx);

                      return (
                        <TableRow key={doc.id} className={isSelected ? 'bg-primary/5' : (isSample ? 'bg-primary/5' : '')}>
                          <TableCell>
                            {isSample ? (
                              <span className="inline-block w-4" />
                            ) : (
                              <Checkbox
                                checked={isSelected}
                                disabled={!canSelect}
                                onCheckedChange={() => toggleSelection(doc.id)}
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-center font-medium">
                            {isSample ? <span className="text-primary text-lg" title={t('sample.badge')}>★</span> : rowNumber}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium truncate max-w-[200px]" title={doc.file_name}>
                                    {doc.file_name}
                                  </span>
                                  {isSample && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 uppercase tracking-wide">
                                      {t('sample.badge')}
                                    </Badge>
                                  )}
                                </div>
                                {isStaffOrAdmin && !isSample && (
                                  <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={doc.customer_profile?.email}>
                                    {doc.customer_profile?.full_name || doc.customer_profile?.email || (doc.magic_link_id ? 'Guest' : '-')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {isSample ? (
                              <span className="text-sm text-muted-foreground">—</span>
                            ) : (
                              <div className="text-sm">
                                <div>{date}</div>
                                <div className="text-muted-foreground">{time}</div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <StatusBadge status={doc.status} />
                          </TableCell>
                          <TableCell className="text-center">
                            {doc.similarity_percentage !== null && doc.similarity_percentage !== undefined ? (
                              <span className="font-medium">{doc.similarity_percentage}%</span>
                            ) : (
                              <span className="text-muted-foreground">•</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {doc.scan_type === 'similarity_only' ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                    <Info className="h-4 w-4 text-primary" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72 text-sm">
                                  <p>If you want to get AI report of your document, purchase AI Scan credits from our website or contact admins to purchase AI credits.</p>
                                </PopoverContent>
                              </Popover>
                            ) : doc.ai_percentage !== null && doc.ai_percentage !== undefined ? (
                              <span className="font-medium">{doc.ai_percentage}%</span>
                            ) : (
                              <span className="font-medium">*</span>
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
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {doc.status === 'cancelled' ? (
                                <span className="text-sm text-destructive font-medium">
                                  {doc.cancellation_reason || 'Cancelled by admin'}
                                </span>
                              ) : doc.remarks ? (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <MessageSquare className="h-4 w-4" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80">
                                    <p className="text-sm whitespace-pre-wrap">{doc.remarks}</p>
                                  </PopoverContent>
                                </Popover>
                              ) : doc.error_message ? (
                                <span className="text-sm text-destructive">{doc.error_message}</span>
                              ) : doc.status === 'pending' ? (
                                <span className="text-sm text-muted-foreground">In queue</span>
                              ) : doc.status === 'in_progress' ? (
                                <span className="text-sm text-muted-foreground">Processing...</span>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                              {doc.status === 'completed' && (doc.ai_percentage === null || doc.ai_percentage === undefined) && doc.scan_type === 'full' && doc.similarity_report_path && doc.ai_report_path && (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full flex-shrink-0">
                                      <Info className="h-3.5 w-3.5 text-primary" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80 text-sm" side="top">
                                    <p className="font-medium mb-1">AI % Note</p>
                                    <p className="text-muted-foreground text-xs leading-relaxed">
                                      AI % is in range between 1 to 19%. AI detection scores below 20% have a higher likelihood of false positives. In the updated version of the report, we no longer surface scores when the signal is below the 20% threshold to meet Turnitin's AI detection standards.
                                    </p>
                                  </PopoverContent>
                                </Popover>
                              )}
                            </div>
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-center">
                              {!isSample && (
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
                              )}
                            </TableCell>
                          )}
                          {!isStaffOrAdmin && (
                            <TableCell className="text-center">
                              {!isSample && doc.status === 'completed' && (
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
                      });
                    })()}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {totalPages > 1 && !loading && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * DOCS_PER_PAGE + 1}–{Math.min(currentPage * DOCS_PER_PAGE, allFilteredDocuments.length)} of {allFilteredDocuments.length} documents
            </p>
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let page: number;
                if (totalPages <= 5) {
                  page = i + 1;
                } else if (currentPage <= 3) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i;
                } else {
                  page = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    className="w-9"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* AI Humanizer CTA - Bottom */}

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
                  <li>The content analysis report</li>
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
