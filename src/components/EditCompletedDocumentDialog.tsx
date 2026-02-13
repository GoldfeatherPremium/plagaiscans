import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RemarkSelector } from '@/components/RemarkSelector';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Trash2, Loader2, Upload, FileText } from 'lucide-react';
import { Document, DocumentStatus } from '@/hooks/useDocuments';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface EditCompletedDocumentDialogProps {
  document: Document | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  downloadFile: (path: string, bucket: string, fileName?: string) => Promise<void>;
}

export const EditCompletedDocumentDialog: React.FC<EditCompletedDocumentDialogProps> = ({
  document,
  open,
  onOpenChange,
  onSuccess,
  downloadFile,
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [status, setStatus] = useState<DocumentStatus>('completed');
  const [similarityPercentage, setSimilarityPercentage] = useState('');
  const [aiPercentage, setAiPercentage] = useState('');
  const [remarks, setRemarks] = useState('');
  const [newSimilarityReport, setNewSimilarityReport] = useState<File | null>(null);
  const [newAiReport, setNewAiReport] = useState<File | null>(null);
  const [clearSimilarityReport, setClearSimilarityReport] = useState(false);
  const [clearAiReport, setClearAiReport] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset form when document changes
  useEffect(() => {
    if (document) {
      setStatus(document.status);
      setSimilarityPercentage(document.similarity_percentage?.toString() || '');
      setAiPercentage(document.ai_percentage?.toString() || '');
      setRemarks(document.remarks || '');
      setNewSimilarityReport(null);
      setNewAiReport(null);
      setClearSimilarityReport(false);
      setClearAiReport(false);
    }
  }, [document]);

  const handleSubmit = async () => {
    if (!document || !user) return;
    
    setSubmitting(true);
    try {
      const updates: Record<string, unknown> = {
        status,
        similarity_percentage: similarityPercentage ? parseFloat(similarityPercentage) : null,
        ai_percentage: aiPercentage ? parseFloat(aiPercentage) : null,
        remarks: remarks.trim() || null,
        updated_at: new Date().toISOString(),
      };

      // Handle status changes
      if (status === 'pending') {
        updates.assigned_staff_id = null;
        updates.assigned_at = null;
        updates.completed_at = null;
      } else if (status === 'in_progress') {
        updates.completed_at = null;
      } else if (status === 'completed' && !document.completed_at) {
        updates.completed_at = new Date().toISOString();
      }

      const folderPath = document.user_id || 'guest';

      // Handle similarity report
      if (clearSimilarityReport && document.similarity_report_path) {
        // Delete from storage
        await supabase.storage.from('reports').remove([document.similarity_report_path]);
        updates.similarity_report_path = null;
      } else if (newSimilarityReport) {
        // Upload new report (upsert)
        const simPath = `${folderPath}/${document.id}_similarity.pdf`;
        const { error: simError } = await supabase.storage
          .from('reports')
          .upload(simPath, newSimilarityReport, { upsert: true });
        if (simError) throw simError;
        updates.similarity_report_path = simPath;
      }

      // Handle AI report
      if (clearAiReport && document.ai_report_path) {
        // Delete from storage
        await supabase.storage.from('reports').remove([document.ai_report_path]);
        updates.ai_report_path = null;
      } else if (newAiReport) {
        // Upload new report (upsert)
        const aiPath = `${folderPath}/${document.id}_ai.pdf`;
        const { error: aiError } = await supabase.storage
          .from('reports')
          .upload(aiPath, newAiReport, { upsert: true });
        if (aiError) throw aiError;
        updates.ai_report_path = aiPath;
      }

      // Update document
      const { error } = await supabase
        .from('documents')
        .update(updates)
        .eq('id', document.id);

      if (error) throw error;

      // Log activity
      const changesDescription: string[] = [];
      if (status !== document.status) changesDescription.push(`status → ${status}`);
      if (newSimilarityReport) changesDescription.push('replaced similarity report');
      if (newAiReport) changesDescription.push('replaced AI report');
      if (clearSimilarityReport) changesDescription.push('cleared similarity report');
      if (clearAiReport) changesDescription.push('cleared AI report');
      if (parseFloat(similarityPercentage) !== document.similarity_percentage) {
        changesDescription.push(`similarity ${document.similarity_percentage ?? 'N/A'}% → ${similarityPercentage || 'N/A'}%`);
      }
      if (parseFloat(aiPercentage) !== document.ai_percentage) {
        changesDescription.push(`AI ${document.ai_percentage ?? 'N/A'}% → ${aiPercentage || 'N/A'}%`);
      }

      await supabase.from('activity_logs').insert({
        staff_id: user.id,
        document_id: document.id,
        action: `Edited document: ${changesDescription.join(', ') || 'updated remarks'}`,
      });

      toast({
        title: 'Document Updated',
        description: 'Changes saved successfully.',
      });
      
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error updating document:', error);
      toast({
        title: 'Error',
        description: 'Failed to update document',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Edit Document
          </DialogTitle>
          <p className="text-sm text-muted-foreground truncate" title={document.file_name}>
            {document.file_name}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as DocumentStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            {status === 'pending' && document.status !== 'pending' && (
              <p className="text-xs text-amber-600">
                Changing to pending will unassign the document and clear completion time.
              </p>
            )}
          </div>

          {/* Current Reports Section */}
          <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
            <Label className="text-sm font-medium">Current Reports</Label>
            
            {/* Similarity Report */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm">Similarity:</span>
                {document.similarity_report_path && !clearSimilarityReport ? (
                  <span className="text-xs text-muted-foreground truncate">
                    {document.similarity_report_path.split('/').pop()}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">None</span>
                )}
              </div>
              {document.similarity_report_path && !clearSimilarityReport && (
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadFile(document.similarity_report_path!, 'reports', document.similarity_report_path!.split('/').pop())}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setClearSimilarityReport(true)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
              {clearSimilarityReport && (
                <Button variant="ghost" size="sm" onClick={() => setClearSimilarityReport(false)}>
                  Undo
                </Button>
              )}
            </div>

            {/* AI Report */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm">AI Report:</span>
                {document.ai_report_path && !clearAiReport ? (
                  <span className="text-xs text-muted-foreground truncate">
                    {document.ai_report_path.split('/').pop()}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">None</span>
                )}
              </div>
              {document.ai_report_path && !clearAiReport && (
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadFile(document.ai_report_path!, 'reports', document.ai_report_path!.split('/').pop())}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setClearAiReport(true)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
              {clearAiReport && (
                <Button variant="ghost" size="sm" onClick={() => setClearAiReport(false)}>
                  Undo
                </Button>
              )}
            </div>
          </div>

          {/* New Reports Upload */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Replace Reports</Label>
            
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">New Similarity Report</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setNewSimilarityReport(e.target.files?.[0] || null)}
                  className="text-sm"
                />
                {newSimilarityReport && (
                  <Button variant="ghost" size="sm" onClick={() => setNewSimilarityReport(null)}>
                    Clear
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">New AI Report</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setNewAiReport(e.target.files?.[0] || null)}
                  className="text-sm"
                />
                {newAiReport && (
                  <Button variant="ghost" size="sm" onClick={() => setNewAiReport(null)}>
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Percentages */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Similarity %</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="e.g. 15"
                value={similarityPercentage}
                onChange={(e) => setSimilarityPercentage(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>AI %</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="e.g. 5"
                value={aiPercentage}
                onChange={(e) => setAiPercentage(e.target.value)}
              />
            </div>
          </div>

          {/* Remarks */}
          <div className="space-y-2">
            <RemarkSelector
              value={remarks}
              onChange={setRemarks}
              label="Remarks"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
