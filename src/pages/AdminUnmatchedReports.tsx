import React, { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { FileQuestion, Search, Link2, Trash2, RefreshCw, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface UnmatchedReport {
  id: string;
  file_name: string;
  file_path: string;
  normalized_filename: string;
  report_type: string | null;
  uploaded_at: string | null;
  uploaded_by: string | null;
  resolved: boolean | null;
  resolved_at: string | null;
  resolved_by: string | null;
  matched_document_id: string | null;
}

interface PendingDocument {
  id: string;
  file_name: string;
  normalized_filename: string | null;
  user_id: string | null;
  status: string;
  uploaded_at: string;
}

const AdminUnmatchedReports: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterResolved, setFilterResolved] = useState<'all' | 'pending' | 'resolved'>('pending');
  const [selectedReport, setSelectedReport] = useState<UnmatchedReport | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');

  // Fetch unmatched reports
  const { data: reports, isLoading: reportsLoading } = useQuery({
    queryKey: ['unmatched-reports', filterResolved],
    queryFn: async () => {
      let query = supabase
        .from('unmatched_reports')
        .select('*')
        .order('uploaded_at', { ascending: false });

      if (filterResolved === 'pending') {
        query = query.or('resolved.is.null,resolved.eq.false');
      } else if (filterResolved === 'resolved') {
        query = query.eq('resolved', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as UnmatchedReport[];
    },
  });

  // Fetch pending documents for assignment
  const { data: pendingDocuments } = useQuery({
    queryKey: ['pending-documents-for-assignment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('id, file_name, normalized_filename, user_id, status, uploaded_at')
        .in('status', ['pending', 'in_progress'])
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return data as PendingDocument[];
    },
  });

  // Assign report to document
  const assignMutation = useMutation({
    mutationFn: async ({ reportId, documentId, reportType }: { reportId: string; documentId: string; reportType: 'similarity' | 'ai' }) => {
      const report = reports?.find(r => r.id === reportId);
      if (!report) throw new Error('Report not found');

      // Update the document with the report
      const updateField = reportType === 'similarity' ? 'similarity_report_path' : 'ai_report_path';
      const { error: docError } = await supabase
        .from('documents')
        .update({ [updateField]: report.file_path })
        .eq('id', documentId);
      
      if (docError) throw docError;

      // Mark the unmatched report as resolved
      const { error: resolveError } = await supabase
        .from('unmatched_reports')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          matched_document_id: documentId,
          report_type: reportType,
        })
        .eq('id', reportId);

      if (resolveError) throw resolveError;

      // Check if document now has both reports
      const { data: doc } = await supabase
        .from('documents')
        .select('similarity_report_path, ai_report_path')
        .eq('id', documentId)
        .single();

      if (doc?.similarity_report_path && doc?.ai_report_path) {
        await supabase
          .from('documents')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', documentId);
      }
    },
    onSuccess: () => {
      toast.success('Report assigned successfully');
      queryClient.invalidateQueries({ queryKey: ['unmatched-reports'] });
      queryClient.invalidateQueries({ queryKey: ['pending-documents-for-assignment'] });
      setIsAssignDialogOpen(false);
      setSelectedReport(null);
      setSelectedDocumentId('');
    },
    onError: (error) => {
      toast.error('Failed to assign report: ' + error.message);
    },
  });

  // Delete unmatched report
  const deleteMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const report = reports?.find(r => r.id === reportId);
      if (!report) throw new Error('Report not found');

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('reports')
        .remove([report.file_path]);
      
      if (storageError) console.warn('Storage delete failed:', storageError);

      // Delete record
      const { error } = await supabase
        .from('unmatched_reports')
        .delete()
        .eq('id', reportId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Report deleted');
      queryClient.invalidateQueries({ queryKey: ['unmatched-reports'] });
    },
    onError: (error) => {
      toast.error('Failed to delete report: ' + error.message);
    },
  });

  const filteredReports = reports?.filter(report =>
    report.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    report.normalized_filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDownload = async (report: UnmatchedReport) => {
    const { data, error } = await supabase.storage
      .from('reports')
      .createSignedUrl(report.file_path, 60);
    
    if (error) {
      toast.error('Failed to generate download link');
      return;
    }
    
    // Use blob download to preserve filename
    const response = await fetch(data.signedUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = report.file_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const openAssignDialog = (report: UnmatchedReport) => {
    setSelectedReport(report);
    setIsAssignDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Unmatched Reports</h1>
            <p className="text-muted-foreground">
              Manage reports that couldn't be auto-mapped to documents
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['unmatched-reports'] })}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by filename..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterResolved} onValueChange={(v) => setFilterResolved(v as typeof filterResolved)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {reportsLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !filteredReports?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileQuestion className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No unmatched reports</h3>
                <p className="text-muted-foreground">All reports have been matched or resolved</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File Name</TableHead>
                      <TableHead>Normalized Key</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {report.file_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {report.normalized_filename}
                        </TableCell>
                        <TableCell>
                          {report.report_type ? (
                            <Badge variant={report.report_type === 'similarity' ? 'default' : 'secondary'}>
                              {report.report_type}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Unknown</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {report.uploaded_at
                            ? format(new Date(report.uploaded_at), 'MMM d, yyyy HH:mm')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={report.resolved ? 'default' : 'secondary'}>
                            {report.resolved ? 'Resolved' : 'Pending'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownload(report)}
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            {!report.resolved && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openAssignDialog(report)}
                                  title="Assign to document"
                                >
                                  <Link2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteMutation.mutate(report.id)}
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
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

        {/* Assign Dialog */}
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Assign Report to Document</DialogTitle>
              <DialogDescription>
                Select a document and report type to assign "{selectedReport?.file_name}"
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Select Document</label>
                <Select value={selectedDocumentId} onValueChange={setSelectedDocumentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a document..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pendingDocuments?.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        <div className="flex flex-col">
                          <span>{doc.file_name}</span>
                          <span className="text-xs text-muted-foreground">
                            Key: {doc.normalized_filename}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedDocumentId && (
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => selectedReport && assignMutation.mutate({
                      reportId: selectedReport.id,
                      documentId: selectedDocumentId,
                      reportType: 'similarity',
                    })}
                    disabled={assignMutation.isPending}
                  >
                    Assign as Similarity Report
                  </Button>
                  <Button
                    className="flex-1"
                    variant="secondary"
                    onClick={() => selectedReport && assignMutation.mutate({
                      reportId: selectedReport.id,
                      documentId: selectedDocumentId,
                      reportType: 'ai',
                    })}
                    disabled={assignMutation.isPending}
                  >
                    Assign as AI Report
                  </Button>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminUnmatchedReports;
