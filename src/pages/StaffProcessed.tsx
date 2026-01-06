import React, { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useDocuments, Document } from '@/hooks/useDocuments';
import { StatusBadge } from '@/components/StatusBadge';
import { FileText, Download, Loader2, Edit, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useStaffPermissions } from '@/hooks/useStaffPermissions';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function StaffProcessed() {
  const { documents, loading, downloadFile, uploadReport } = useDocuments();
  const { user, role } = useAuth();
  const { permissions } = useStaffPermissions();
  
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [similarityFile, setSimilarityFile] = useState<File | null>(null);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [similarityPercentage, setSimilarityPercentage] = useState('');
  const [aiPercentage, setAiPercentage] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const myProcessedDocs = documents.filter(
    (d) => d.assigned_staff_id === user?.id && d.status === 'completed'
  );

  // Both staff and admin can edit their completed documents
  const canEdit = role === 'admin' || role === 'staff';

  const handleDownloadDocument = (doc: Document) => {
    downloadFile(doc.file_path, doc.magic_link_id ? 'magic-uploads' : 'documents', doc.file_name);
  };

  const handleEditClick = (doc: Document) => {
    setEditingDoc(doc);
    setRemarks(doc.remarks || '');
    setSimilarityPercentage(doc.similarity_percentage?.toString() || '');
    setAiPercentage(doc.ai_percentage?.toString() || '');
    setSimilarityFile(null);
    setAiFile(null);
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setEditingDoc(null);
    setSimilarityFile(null);
    setAiFile(null);
    setSimilarityPercentage('');
    setAiPercentage('');
    setRemarks('');
  };

  const handleUpdateDocument = async () => {
    if (!editingDoc) return;
    
    setSubmitting(true);
    try {
      const newSimilarity = similarityPercentage ? parseFloat(similarityPercentage) : null;
      const newAi = aiPercentage ? parseFloat(aiPercentage) : null;
      
      // If new files are provided, upload them
      if (similarityFile || aiFile) {
        await uploadReport(
          editingDoc.id,
          editingDoc,
          similarityFile,
          aiFile,
          newSimilarity,
          newAi,
          remarks.trim() || null
        );
      } else {
        // Just update remarks and percentages
        const { error } = await supabase
          .from('documents')
          .update({ 
            remarks: remarks.trim() || null,
            similarity_percentage: newSimilarity,
            ai_percentage: newAi,
          })
          .eq('id', editingDoc.id);
        
        if (error) throw error;
      }
      
      toast.success('Document updated successfully');
      handleCloseEditDialog();
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Failed to update document');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">My Processed Documents</h1>
          <p className="text-muted-foreground mt-1">
            Documents you have completed processing
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : myProcessedDocs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold text-lg mb-2">No processed documents</h3>
              <p className="text-muted-foreground">
                Documents you complete will appear here
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">#</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>Completed At</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Similarity %</TableHead>
                      <TableHead className="text-center">AI %</TableHead>
                      <TableHead className="text-center">Document</TableHead>
                      <TableHead className="text-center">Similarity Report</TableHead>
                      <TableHead className="text-center">AI Report</TableHead>
                      <TableHead>Remarks</TableHead>
                      {canEdit && <TableHead className="text-center">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myProcessedDocs.map((doc, index) => {
                      const { date, time } = formatDateTime(doc.completed_at || doc.uploaded_at);
                      const baseName = doc.file_name.replace(/\.[^/.]+$/, '');
                      return (
                        <TableRow key={doc.id}>
                          <TableCell className="text-center font-medium">{index + 1}</TableCell>
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
                            {doc.similarity_percentage !== null && doc.similarity_percentage !== undefined ? (
                              <span className="font-medium">{doc.similarity_percentage}%</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {doc.ai_percentage !== null && doc.ai_percentage !== undefined ? (
                              <span className="font-medium">{doc.ai_percentage}%</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button variant="outline" size="sm" onClick={() => handleDownloadDocument(doc)}>
                              <Download className="h-4 w-4" />
                            </Button>
                          </TableCell>
                          <TableCell className="text-center">
                            {doc.similarity_report_path ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadFile(doc.similarity_report_path!, 'reports', `${baseName}_similarity.pdf`)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {doc.ai_report_path ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadFile(doc.ai_report_path!, 'reports', `${baseName}_ai.pdf`)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {doc.remarks ? (
                              <span className="text-sm">{doc.remarks}</span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          {canEdit && (
                            <TableCell className="text-center">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditClick(doc)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
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
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => !open && handleCloseEditDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Document: {editingDoc?.file_name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Similarity %</Label>
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
                <Label>AI %</Label>
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
              <Label>Replace Similarity Report (PDF)</Label>
              <Input
                type="file"
                accept=".pdf"
                onChange={(e) => setSimilarityFile(e.target.files?.[0] || null)}
              />
              {similarityFile && (
                <p className="text-sm text-muted-foreground mt-1">New: {similarityFile.name}</p>
              )}
              {!similarityFile && editingDoc?.similarity_report_path && (
                <p className="text-sm text-secondary mt-1">Current file will be kept</p>
              )}
            </div>
            
            <div>
              <Label>Replace AI Report (PDF)</Label>
              <Input
                type="file"
                accept=".pdf"
                onChange={(e) => setAiFile(e.target.files?.[0] || null)}
              />
              {aiFile && (
                <p className="text-sm text-muted-foreground mt-1">New: {aiFile.name}</p>
              )}
              {!aiFile && editingDoc?.ai_report_path && (
                <p className="text-sm text-secondary mt-1">Current file will be kept</p>
              )}
            </div>
            
            <div>
              <Label>Remarks</Label>
              <Textarea 
                placeholder="Add remarks..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
              />
            </div>
            
            <Button 
              className="w-full" 
              onClick={handleUpdateDocument} 
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Update Document
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
