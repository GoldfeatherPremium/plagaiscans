import React, { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Search, RefreshCw, FileText, CheckCircle2, Download, Eye, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface NeedsReviewDocument {
  id: string;
  file_name: string;
  file_path: string;
  normalized_filename: string | null;
  user_id: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  uploaded_at: string;
  needs_review: boolean | null;
  review_reason: string | null;
  similarity_report_path: string | null;
  ai_report_path: string | null;
  profiles?: {
    email: string;
    full_name: string | null;
  } | null;
}

interface UnmatchedReport {
  id: string;
  file_name: string;
  file_path: string;
  normalized_filename: string;
  resolved: boolean | null;
}

const AdminNeedsReview: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<NeedsReviewDocument | null>(null);
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string>('');
  const [reportType, setReportType] = useState<'similarity' | 'ai'>('similarity');

  // Fetch documents needing review
  const { data: documents, isLoading } = useQuery({
    queryKey: ['needs-review-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('id, file_name, file_path, normalized_filename, user_id, status, uploaded_at, needs_review, review_reason, similarity_report_path, ai_report_path')
        .eq('needs_review', true)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;

      // Fetch user emails separately
      const userIds = [...new Set(data.filter(d => d.user_id).map(d => d.user_id as string))];
      let profiles: Record<string, { email: string; full_name: string | null }> = {};
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds);
        
        if (profilesData) {
          profiles = Object.fromEntries(profilesData.map(p => [p.id, { email: p.email, full_name: p.full_name }]));
        }
      }

      return data.map(doc => ({
        ...doc,
        profiles: doc.user_id ? profiles[doc.user_id] || null : null,
      })) as NeedsReviewDocument[];
    },
  });

  // Fetch matching unmatched reports for selected document
  const { data: matchingReports } = useQuery({
    queryKey: ['matching-reports', selectedDoc?.normalized_filename],
    queryFn: async () => {
      if (!selectedDoc?.normalized_filename) return [];
      const { data, error } = await supabase
        .from('unmatched_reports')
        .select('*')
        .eq('normalized_filename', selectedDoc.normalized_filename)
        .or('resolved.is.null,resolved.eq.false');
      if (error) throw error;
      return data as UnmatchedReport[];
    },
    enabled: !!selectedDoc?.normalized_filename,
  });

  // Resolve document - assign report
  const resolveMutation = useMutation({
    mutationFn: async ({ documentId, reportId, type }: { documentId: string; reportId: string; type: 'similarity' | 'ai' }) => {
      const report = matchingReports?.find(r => r.id === reportId);
      if (!report) throw new Error('Report not found');

      // Update document with the report
      const updateField = type === 'similarity' ? 'similarity_report_path' : 'ai_report_path';
      const { error: docError } = await supabase
        .from('documents')
        .update({ [updateField]: report.file_path })
        .eq('id', documentId);
      
      if (docError) throw docError;

      // Mark report as resolved
      const { error: reportError } = await supabase
        .from('unmatched_reports')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          matched_document_id: documentId,
          report_type: type,
        })
        .eq('id', reportId);

      if (reportError) throw reportError;

      // Check if document now has both reports, if so complete and clear review
      const { data: doc } = await supabase
        .from('documents')
        .select('similarity_report_path, ai_report_path')
        .eq('id', documentId)
        .single();

      if (doc?.similarity_report_path && doc?.ai_report_path) {
        await supabase
          .from('documents')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            needs_review: false,
            review_reason: null,
          })
          .eq('id', documentId);
      }
    },
    onSuccess: () => {
      toast({ title: 'Report assigned successfully' });
      queryClient.invalidateQueries({ queryKey: ['needs-review-documents'] });
      queryClient.invalidateQueries({ queryKey: ['matching-reports'] });
      setSelectedReportId('');
    },
    onError: (error) => {
      toast({ title: 'Failed to assign report', description: error.message, variant: 'destructive' });
    },
  });

  // Clear review flag without resolving
  const clearReviewMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const { error } = await supabase
        .from('documents')
        .update({ needs_review: false, review_reason: null })
        .eq('id', documentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Review cleared' });
      queryClient.invalidateQueries({ queryKey: ['needs-review-documents'] });
      setIsResolveDialogOpen(false);
      setSelectedDoc(null);
    },
    onError: (error) => {
      toast({ title: 'Failed to clear review', description: error.message, variant: 'destructive' });
    },
  });

  // Remove extra reports (delete from unmatched)
  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const report = matchingReports?.find(r => r.id === reportId);
      if (!report) throw new Error('Report not found');

      // Delete from storage
      await supabase.storage.from('reports').remove([report.file_path]);

      // Delete record
      const { error } = await supabase
        .from('unmatched_reports')
        .delete()
        .eq('id', reportId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Report deleted' });
      queryClient.invalidateQueries({ queryKey: ['matching-reports'] });
    },
    onError: (error) => {
      toast({ title: 'Failed to delete report', description: error.message, variant: 'destructive' });
    },
  });

  const filteredDocuments = documents?.filter(doc =>
    doc.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (doc.normalized_filename?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (doc.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleDownloadReport = async (path: string) => {
    const { data, error } = await supabase.storage
      .from('reports')
      .createSignedUrl(path, 60);
    
    if (error) {
      toast({ title: 'Failed to generate download link', variant: 'destructive' });
      return;
    }
    
    window.open(data.signedUrl, '_blank');
  };

  const openResolveDialog = (doc: NeedsReviewDocument) => {
    setSelectedDoc(doc);
    setIsResolveDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Needs Review</h1>
            <p className="text-muted-foreground">
              Documents with mapping conflicts requiring manual resolution
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['needs-review-documents'] })}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by filename or user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !filteredDocuments?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-medium">All clear!</h3>
                <p className="text-muted-foreground">No documents require review</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Review Reason</TableHead>
                      <TableHead>Reports</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocuments.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium max-w-[200px] truncate">{doc.file_name}</span>
                            <span className="text-xs text-muted-foreground">{doc.normalized_filename}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {doc.profiles?.email || 'Guest'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="max-w-[200px] truncate">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {doc.review_reason || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {doc.similarity_report_path && (
                              <Badge variant="secondary" className="text-xs">Similarity</Badge>
                            )}
                            {doc.ai_report_path && (
                              <Badge variant="secondary" className="text-xs">AI</Badge>
                            )}
                            {!doc.similarity_report_path && !doc.ai_report_path && (
                              <span className="text-muted-foreground text-sm">None</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(doc.uploaded_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openResolveDialog(doc)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Resolve
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resolve Dialog */}
        <Dialog open={isResolveDialogOpen} onOpenChange={setIsResolveDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Resolve Document</DialogTitle>
              <DialogDescription>
                Review and assign reports for "{selectedDoc?.file_name}"
              </DialogDescription>
            </DialogHeader>

            {selectedDoc && (
              <div className="space-y-6">
                {/* Document Info */}
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Normalized:</span>
                      <span className="ml-2 font-medium">{selectedDoc.normalized_filename}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">User:</span>
                      <span className="ml-2">{selectedDoc.profiles?.email || 'Guest'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Reason:</span>
                      <span className="ml-2">{selectedDoc.review_reason}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant="outline" className="ml-2">{selectedDoc.status}</Badge>
                    </div>
                  </div>
                </div>

                {/* Current Reports */}
                <div>
                  <h4 className="font-medium mb-2">Assigned Reports</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>Similarity Report</span>
                      </div>
                      {selectedDoc.similarity_report_path ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadReport(selectedDoc.similarity_report_path!)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      ) : (
                        <Badge variant="outline">Not assigned</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>AI Report</span>
                      </div>
                      {selectedDoc.ai_report_path ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadReport(selectedDoc.ai_report_path!)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      ) : (
                        <Badge variant="outline">Not assigned</Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Matching Unmatched Reports */}
                <div>
                  <h4 className="font-medium mb-2">
                    Available Reports ({matchingReports?.length || 0})
                  </h4>
                  {matchingReports?.length ? (
                    <div className="space-y-2">
                      {matchingReports.map((report) => (
                        <div
                          key={report.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{report.file_name}</p>
                            <p className="text-xs text-muted-foreground">{report.normalized_filename}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadReport(report.file_path)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            {!selectedDoc.similarity_report_path && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => resolveMutation.mutate({
                                  documentId: selectedDoc.id,
                                  reportId: report.id,
                                  type: 'similarity',
                                })}
                                disabled={resolveMutation.isPending}
                              >
                                Assign Similarity
                              </Button>
                            )}
                            {!selectedDoc.ai_report_path && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => resolveMutation.mutate({
                                  documentId: selectedDoc.id,
                                  reportId: report.id,
                                  type: 'ai',
                                })}
                                disabled={resolveMutation.isPending}
                              >
                                Assign AI
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteReportMutation.mutate(report.id)}
                              disabled={deleteReportMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm p-4 text-center border rounded-lg">
                      No matching unmatched reports found
                    </p>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => selectedDoc && clearReviewMutation.mutate(selectedDoc.id)}
                disabled={clearReviewMutation.isPending}
              >
                Clear Review Flag
              </Button>
              <Button onClick={() => setIsResolveDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminNeedsReview;
