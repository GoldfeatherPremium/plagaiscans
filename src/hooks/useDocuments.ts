import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Document {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  status: 'pending' | 'in_progress' | 'completed';
  assigned_staff_id: string | null;
  similarity_percentage: number | null;
  ai_percentage: number | null;
  similarity_report_path: string | null;
  ai_report_path: string | null;
  uploaded_at: string;
  completed_at: string | null;
  updated_at: string;
  profiles?: {
    email: string;
    full_name: string | null;
  };
}

export const useDocuments = () => {
  const { user, role, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = async () => {
    if (!user) return;

    setLoading(true);
    try {
      let query = supabase.from('documents').select('*');

      if (role === 'customer') {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query.order('uploaded_at', { ascending: false });

      if (error) throw error;
      setDocuments((data || []) as Document[]);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch documents',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadDocument = async (file: File) => {
    if (!user || !profile) return { success: false };

    if (profile.credit_balance < 1) {
      toast({
        title: 'Insufficient Credits',
        description: 'You need at least 1 credit to upload a document',
        variant: 'destructive',
      });
      return { success: false };
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create document record
      const { error: insertError } = await supabase.from('documents').insert({
        user_id: user.id,
        file_name: file.name,
        file_path: filePath,
        status: 'pending',
      });

      if (insertError) throw insertError;

      // Deduct credit
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ credit_balance: profile.credit_balance - 1 })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      await fetchDocuments();

      toast({
        title: 'Success',
        description: 'Document uploaded successfully',
      });

      return { success: true };
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload document',
        variant: 'destructive',
      });
      return { success: false };
    }
  };

  const downloadFile = async (path: string, bucket: string = 'documents') => {
    try {
      const { data, error } = await supabase.storage.from(bucket).download(path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = path.split('/').pop() || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: 'Error',
        description: 'Failed to download file',
        variant: 'destructive',
      });
    }
  };

  const updateDocumentStatus = async (
    documentId: string,
    status: 'pending' | 'in_progress' | 'completed',
    updates?: {
      similarity_percentage?: number;
      ai_percentage?: number;
      similarity_report_path?: string;
      ai_report_path?: string;
    },
    documentUserId?: string,
    fileName?: string
  ) => {
    try {
      const updateData: Record<string, unknown> = { status, ...updates };
      
      if (status === 'in_progress' && user) {
        updateData.assigned_staff_id = user.id;
      }
      
      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('documents')
        .update(updateData)
        .eq('id', documentId);

      if (error) throw error;

      // Log activity
      if (user) {
        await supabase.from('activity_logs').insert({
          staff_id: user.id,
          document_id: documentId,
          action: `Changed status to ${status}`,
        });
      }

      // Send email notification when document is completed
      if (status === 'completed' && documentUserId && fileName) {
        try {
          await supabase.functions.invoke('send-completion-email', {
            body: {
              documentId,
              userId: documentUserId,
              fileName,
              similarityPercentage: updates?.similarity_percentage || 0,
              aiPercentage: updates?.ai_percentage || 0,
            },
          });
          console.log('Completion email sent successfully');
        } catch (emailError) {
          console.error('Error sending completion email:', emailError);
          // Don't fail the whole operation if email fails
        }
      }

      await fetchDocuments();

      toast({
        title: 'Success',
        description: 'Document updated successfully',
      });
    } catch (error) {
      console.error('Error updating document:', error);
      toast({
        title: 'Error',
        description: 'Failed to update document',
        variant: 'destructive',
      });
    }
  };

  const uploadReport = async (
    documentId: string,
    document: Document,
    similarityReport: File | null,
    aiReport: File | null,
    similarityPercentage: number,
    aiPercentage: number
  ) => {
    if (!user) return;

    try {
      const updates: Record<string, unknown> = {
        similarity_percentage: similarityPercentage,
        ai_percentage: aiPercentage,
      };

      // Upload similarity report
      if (similarityReport) {
        const simPath = `${document.user_id}/${documentId}_similarity.pdf`;
        const { error: simError } = await supabase.storage
          .from('reports')
          .upload(simPath, similarityReport, { upsert: true });

        if (simError) throw simError;
        updates.similarity_report_path = simPath;
      }

      // Upload AI report
      if (aiReport) {
        const aiPath = `${document.user_id}/${documentId}_ai.pdf`;
        const { error: aiError } = await supabase.storage
          .from('reports')
          .upload(aiPath, aiReport, { upsert: true });

        if (aiError) throw aiError;
        updates.ai_report_path = aiPath;
      }

      await updateDocumentStatus(documentId, 'completed', updates, document.user_id, document.file_name);
    } catch (error) {
      console.error('Error uploading reports:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload reports',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [user, role]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('documents-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
        },
        () => {
          fetchDocuments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    documents,
    loading,
    uploadDocument,
    downloadFile,
    updateDocumentStatus,
    uploadReport,
    fetchDocuments,
  };
};