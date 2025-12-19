import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useDocuments, Document } from '@/hooks/useDocuments';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/StatusBadge';
import { FileText, Download, Upload, Loader2, Lock, Clock, Unlock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

export default function DocumentQueue() {
  const { documents, loading, downloadFile, uploadReport, updateDocumentStatus, releaseDocument } = useDocuments();
  const { user, role } = useAuth();
  const { toast } = useToast();
  
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode] = useState<'report'>('report');
  const [similarityFile, setSimilarityFile] = useState<File | null>(null);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [similarityPercent, setSimilarityPercent] = useState('');
  const [aiPercent, setAiPercent] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [globalTimeout, setGlobalTimeout] = useState(30);
  const [mySettings, setMySettings] = useState<StaffSettings>({ time_limit_minutes: 30, max_concurrent_files: 1 });
  const [, setTick] = useState(0);

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
    if (!canPickMore && doc.assigned_staff_id !== user?.id) {
      toast({
        title: 'Limit Reached',
        description: `You can only process ${mySettings.max_concurrent_files} document(s) at a time. Complete your current work first.`,
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

  const handleOpenDialog = (doc: Document) => {
    setSelectedDoc(doc);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedDoc(null);
    setSimilarityFile(null);
    setAiFile(null);
    setSimilarityPercent('');
    setAiPercent('');
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
      parseFloat(similarityPercent) || 0,
      parseFloat(aiPercent) || 0,
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Document Queue</h1>
          <p className="text-muted-foreground mt-1">Process pending documents</p>
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
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">#</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>Upload Time</TableHead>
                      <TableHead className="text-center">Status</TableHead>
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

                      return (
                        <TableRow key={doc.id} className={`${isAssignedToMe ? 'bg-primary/5' : ''} ${overdue ? 'bg-destructive/5' : ''}`}>
                          <TableCell className="text-center font-medium">
                            {index + 1}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                              <span className="font-medium truncate max-w-[200px]" title={doc.file_name}>
                                {doc.file_name}
                              </span>
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
                            <div className="flex items-center justify-center gap-2 flex-wrap">
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
                                  <Button variant="outline" size="sm" onClick={() => downloadFile(doc.file_path, 'documents', doc.file_name)}>
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" onClick={() => handleOpenDialog(doc)}>
                                    <Upload className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              
                              {role === 'admin' && !isAssignedToMe && doc.status === 'in_progress' && (
                                <>
                                  <Button variant="outline" size="sm" onClick={() => downloadFile(doc.file_path, 'documents', doc.file_name)}>
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
        )}

        <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
          <DialogContent onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Upload Reports for {selectedDoc?.file_name}</DialogTitle>
            </DialogHeader>
            
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
              <div>
                <Label>Remarks (Optional)</Label>
                <Textarea 
                  placeholder="Add any remarks or notes about this document..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                />
              </div>
              
              {/* Staff must upload both reports warning */}
              {role === 'staff' && (!similarityFile || !aiFile) && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <span className="font-medium">Required:</span> Both Similarity and AI reports must be uploaded
                </p>
              )}
              
              <Button 
                className="w-full" 
                onClick={handleSubmitReport} 
                disabled={submitting || (role === 'staff' && (!similarityFile || !aiFile))}
              >
                {submitting ? 'Submitting...' : 'Complete & Submit'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}