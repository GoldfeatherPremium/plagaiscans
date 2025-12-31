import React, { useState, useEffect } from 'react';
import { Search, FileText, Upload, Clock, CheckCircle, User, Loader2, Download, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DashboardLayout } from '@/components/DashboardLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import { useSimilarityDocuments, SimilarityDocument } from '@/hooks/useSimilarityDocuments';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { SEO } from '@/components/SEO';
import { format } from 'date-fns';

const SimilarityQueue: React.FC = () => {
  const { user, role } = useAuth();
  const { documents, loading, fetchDocuments, uploadSimilarityReport } = useSimilarityDocuments();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<SimilarityDocument | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [similarityReport, setSimilarityReport] = useState<File | null>(null);
  const [similarityPercentage, setSimilarityPercentage] = useState('');
  const [remarks, setRemarks] = useState('');
  const [uploading, setUploading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);

  // Filter only pending and in_progress documents for the queue
  const queueDocuments = documents.filter(
    (doc) => doc.status === 'pending' || doc.status === 'in_progress'
  );

  const filteredDocs = queueDocuments.filter((doc) =>
    doc.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.profile?.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAssignToMe = async (docId: string) => {
    if (!user) return;
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

      toast({ title: 'Document assigned', description: 'Document has been assigned to you' });
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

      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({ title: 'Error', description: 'Failed to download file', variant: 'destructive' });
    }
  };

  const handleUploadReport = async () => {
    if (!selectedDoc || !similarityReport || !similarityPercentage) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    setUploading(true);

    try {
      await uploadSimilarityReport(
        selectedDoc.id,
        similarityReport,
        parseFloat(similarityPercentage),
        remarks
      );

      setUploadDialogOpen(false);
      setSelectedDoc(null);
      setSimilarityReport(null);
      setSimilarityPercentage('');
      setRemarks('');
    } catch (error) {
      console.error('Error uploading report:', error);
      toast({ title: 'Error', description: 'Failed to upload report', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy HH:mm');
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
        <div>
          <div className="flex items-center gap-2">
            <Search className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-display font-bold">Similarity Queue</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Process similarity-only documents (no AI detection required)
          </p>
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
                    {queueDocuments.filter((d) => d.status === 'pending').length}
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
                    {queueDocuments.filter((d) => d.status === 'in_progress').length}
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
                  <p className="text-sm text-muted-foreground">Completed Today</p>
                  <p className="text-2xl font-bold">
                    {documents.filter(
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

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by filename or customer email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Document Table */}
        <Card>
          <CardHeader>
            <CardTitle>Documents Awaiting Similarity Check</CardTitle>
            <CardDescription>
              Only similarity report is required for these documents
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredDocs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No documents in the similarity queue</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocs.map((doc) => (
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
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {doc.profile?.full_name || doc.profile?.email || 'Unknown'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(doc.uploaded_at)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={doc.status} />
                      </TableCell>
                      <TableCell>
                        {doc.staff_profile ? (
                          <span className="text-sm">
                            {doc.staff_profile.full_name || doc.staff_profile.email}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadOriginal(doc.file_path, doc.file_name)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>

                          {!doc.assigned_staff_id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAssignToMe(doc.id)}
                              disabled={assigning === doc.id}
                            >
                              {assigning === doc.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Assign to Me'
                              )}
                            </Button>
                          )}

                          {doc.assigned_staff_id === user?.id && doc.status === 'in_progress' && (
                            <Dialog open={uploadDialogOpen && selectedDoc?.id === doc.id} onOpenChange={(open) => {
                              setUploadDialogOpen(open);
                              if (!open) {
                                setSelectedDoc(null);
                                setSimilarityReport(null);
                                setSimilarityPercentage('');
                                setRemarks('');
                              }
                            }}>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  onClick={() => setSelectedDoc(doc)}
                                >
                                  <Upload className="h-4 w-4 mr-2" />
                                  Upload Report
                                </Button>
                              </DialogTrigger>
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
                                    <Label>Similarity Percentage (%)</Label>
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
                                    disabled={uploading || !similarityReport || !similarityPercentage}
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
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-muted/50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Similarity-Only Documents</p>
                <p className="text-muted-foreground mt-1">
                  These documents only require a similarity report. No AI detection report is needed.
                  The customer purchased similarity-only credits for these checks.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SimilarityQueue;
