import React, { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useDocuments, Document } from '@/hooks/useDocuments';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/StatusBadge';
import { FileText, Download, Upload, Loader2, Lock, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

export default function DocumentQueue() {
  const { documents, loading, downloadFile, uploadReport, updateDocumentStatus } = useDocuments();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'report' | 'error'>('report');
  const [similarityFile, setSimilarityFile] = useState<File | null>(null);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [similarityPercent, setSimilarityPercent] = useState('');
  const [aiPercent, setAiPercent] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Check if staff already has a document in progress
  const hasDocumentInProgress = documents.some(
    (d) => d.assigned_staff_id === user?.id && d.status === 'in_progress'
  );

  // Filter documents: show pending (not assigned) or assigned to current user
  const availableDocs = documents.filter((d) => {
    if (role === 'admin') {
      return d.status === 'pending' || d.status === 'in_progress';
    }
    // Staff can see: unassigned pending docs OR their own in-progress docs
    return (
      (d.status === 'pending' && !d.assigned_staff_id) ||
      (d.assigned_staff_id === user?.id && d.status === 'in_progress')
    );
  });

  const handlePickDocument = async (doc: Document) => {
    if (hasDocumentInProgress && doc.assigned_staff_id !== user?.id) {
      toast({
        title: 'Already Processing',
        description: 'Complete your current document before picking another.',
        variant: 'destructive',
      });
      return;
    }
    
    // Assign to this staff member
    await updateDocumentStatus(doc.id, 'in_progress');
    toast({
      title: 'Document Assigned',
      description: 'This document is now assigned to you.',
    });
  };

  const handleOpenDialog = (doc: Document, mode: 'report' | 'error') => {
    setSelectedDoc(doc);
    setDialogMode(mode);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedDoc(null);
    setSimilarityFile(null);
    setAiFile(null);
    setSimilarityPercent('');
    setAiPercent('');
    setErrorMessage('');
  };

  const handleSubmitReport = async () => {
    if (!selectedDoc) return;
    setSubmitting(true);
    await uploadReport(
      selectedDoc.id,
      selectedDoc,
      similarityFile,
      aiFile,
      parseFloat(similarityPercent) || 0,
      parseFloat(aiPercent) || 0
    );
    setSubmitting(false);
    handleCloseDialog();
  };

  const handleSubmitError = async () => {
    if (!selectedDoc || !errorMessage.trim()) return;
    setSubmitting(true);
    await updateDocumentStatus(
      selectedDoc.id,
      'error',
      { error_message: errorMessage.trim() },
      selectedDoc.user_id,
      selectedDoc.file_name
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Document Queue</h1>
          <p className="text-muted-foreground mt-1">Process pending documents</p>
          {role === 'staff' && hasDocumentInProgress && (
            <p className="text-sm text-amber-600 mt-2 flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Complete your current document before picking another
            </p>
          )}
        </div>

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
          <div className="space-y-4">
            {availableDocs.map((doc) => {
              const isAssignedToMe = doc.assigned_staff_id === user?.id;
              const canPick = !hasDocumentInProgress || isAssignedToMe;
              
              return (
                <Card key={doc.id} className={isAssignedToMe ? 'border-primary' : ''}>
                  <CardContent className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <FileText className="h-10 w-10 text-primary" />
                      <div>
                        <h3 className="font-semibold">{doc.file_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {new Date(doc.uploaded_at).toLocaleString()}
                        </p>
                        {isAssignedToMe && (
                          <p className="text-xs text-primary font-medium mt-1">Assigned to you</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={doc.status} />
                      
                      {doc.status === 'pending' && !isAssignedToMe && (
                        <Button 
                          size="sm" 
                          onClick={() => handlePickDocument(doc)}
                          disabled={!canPick}
                        >
                          Pick Document
                        </Button>
                      )}
                      
                      {isAssignedToMe && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => downloadFile(doc.file_path)}>
                            <Download className="h-4 w-4 mr-2" /> Download
                          </Button>
                          <Button size="sm" onClick={() => handleOpenDialog(doc, 'report')}>
                            <Upload className="h-4 w-4 mr-2" /> Upload Report
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-destructive border-destructive/30"
                            onClick={() => handleOpenDialog(doc, 'error')}
                          >
                            <AlertTriangle className="h-4 w-4 mr-2" /> Report Error
                          </Button>
                        </>
                      )}
                      
                      {role === 'admin' && !isAssignedToMe && doc.status === 'in_progress' && (
                        <Button variant="outline" size="sm" onClick={() => downloadFile(doc.file_path)}>
                          <Download className="h-4 w-4 mr-2" /> Download
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
          <DialogContent onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>
                {dialogMode === 'report' 
                  ? `Upload Reports for ${selectedDoc?.file_name}`
                  : `Report Error for ${selectedDoc?.file_name}`
                }
              </DialogTitle>
            </DialogHeader>
            
            {dialogMode === 'report' ? (
              <div className="space-y-4">
                <div>
                  <Label>Similarity %</Label>
                  <Input 
                    type="number" 
                    min="0" 
                    max="100" 
                    value={similarityPercent} 
                    onChange={(e) => setSimilarityPercent(e.target.value)} 
                  />
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
                  <Label>AI Detection %</Label>
                  <Input 
                    type="number" 
                    min="0" 
                    max="100" 
                    value={aiPercent} 
                    onChange={(e) => setAiPercent(e.target.value)} 
                  />
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
                <Button className="w-full" onClick={handleSubmitReport} disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Complete & Submit'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>Error Description</Label>
                  <Textarea 
                    placeholder="Describe the error with this document..."
                    value={errorMessage}
                    onChange={(e) => setErrorMessage(e.target.value)}
                    rows={4}
                  />
                </div>
                <Button 
                  className="w-full" 
                  variant="destructive"
                  onClick={handleSubmitError} 
                  disabled={submitting || !errorMessage.trim()}
                >
                  {submitting ? 'Submitting...' : 'Submit Error Report'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}