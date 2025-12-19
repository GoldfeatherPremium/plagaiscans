import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type DocumentStatus = 'pending' | 'in_progress' | 'completed' | 'error';

export interface Document {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  status: DocumentStatus;
  assigned_staff_id: string | null;
  assigned_at: string | null;
  similarity_percentage: number | null;
  ai_percentage: number | null;
  similarity_report_path: string | null;
  ai_report_path: string | null;
  remarks: string | null;
  error_message: string | null;
  uploaded_at: string;
  completed_at: string | null;
  updated_at: string;
  profiles?: {
    email: string;
    full_name: string | null;
  };
  staff_profile?: {
    email: string;
    full_name: string | null;
  };
  customer_profile?: {
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

      // Fetch staff profiles for assigned documents
      const staffIds = [...new Set((data || []).filter(d => d.assigned_staff_id).map(d => d.assigned_staff_id))];
      let staffProfiles: Record<string, { email: string; full_name: string | null }> = {};
      
      if (staffIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', staffIds);
        
        if (profiles) {
          staffProfiles = profiles.reduce((acc, p) => {
            acc[p.id] = { email: p.email, full_name: p.full_name };
            return acc;
          }, {} as Record<string, { email: string; full_name: string | null }>);
        }
      }

      // Fetch customer profiles (document owners)
      const customerIds = [...new Set((data || []).map(d => d.user_id))];
      let customerProfiles: Record<string, { email: string; full_name: string | null }> = {};
      
      if (customerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', customerIds);
        
        if (profiles) {
          customerProfiles = profiles.reduce((acc, p) => {
            acc[p.id] = { email: p.email, full_name: p.full_name };
            return acc;
          }, {} as Record<string, { email: string; full_name: string | null }>);
        }
      }

      const docsWithProfiles = (data || []).map(doc => ({
        ...doc,
        staff_profile: doc.assigned_staff_id ? staffProfiles[doc.assigned_staff_id] : undefined,
        customer_profile: customerProfiles[doc.user_id] || undefined
      }));

      setDocuments(docsWithProfiles as Document[]);
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

  const releaseDocument = async (documentId: string) => {
    try {
      const { error } = await supabase
        .from('documents')
        .update({ 
          status: 'pending', 
          assigned_staff_id: null, 
          assigned_at: null 
        })
        .eq('id', documentId);

      if (error) throw error;

      await fetchDocuments();
      toast({
        title: 'Document Released',
        description: 'Document is now available for other staff members',
      });
    } catch (error) {
      console.error('Error releasing document:', error);
      toast({
        title: 'Error',
        description: 'Failed to release document',
        variant: 'destructive',
      });
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

  const downloadFile = async (path: string, bucket: string = 'documents', originalFileName?: string) => {
    try {
      // Use signed URL for faster direct download instead of downloading blob first
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60, {
          download: originalFileName || path.split('/').pop() || 'download',
        });

      if (error) throw error;

      // Open the signed URL directly - browser handles the download
      window.open(data.signedUrl, '_blank');
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
    status: DocumentStatus,
    updates?: {
      similarity_percentage?: number;
      ai_percentage?: number;
      similarity_report_path?: string;
      ai_report_path?: string;
      error_message?: string;
    },
    documentUserId?: string,
    fileName?: string
  ) => {
    try {
      // Staff (not admin) must upload both reports to complete a document
      if (status === 'completed' && role === 'staff') {
        const hasSimReport = updates?.similarity_report_path;
        const hasAiReport = updates?.ai_report_path;
        
        if (!hasSimReport || !hasAiReport) {
          toast({
            title: 'Reports Required',
            description: 'You must upload both Similarity and AI reports before completing this document.',
            variant: 'destructive',
          });
          return;
        }
      }

      const updateData: Record<string, unknown> = { status, ...updates };
      
      if (status === 'in_progress' && user) {
        updateData.assigned_staff_id = user.id;
        updateData.assigned_at = new Date().toISOString();
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

      // Create personal notification for the document owner when completed
      if (status === 'completed' && documentUserId && fileName) {
        try {
          const { error: notifError } = await supabase.from('user_notifications').insert({
            user_id: documentUserId,
            title: 'Document Completed! 🎉',
            message: `Your document "${fileName}" has been processed. Similarity: ${updates?.similarity_percentage || 0}%, AI Detection: ${updates?.ai_percentage || 0}%. View your results in My Documents.`,
            created_by: user?.id,
          });
          
          if (notifError) {
            console.error('Error creating notification:', notifError);
          } else {
            console.log('Personal notification created for document completion');
          }
        } catch (notifError) {
          console.error('Exception creating notification:', notifError);
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
    aiPercentage: number,
    remarks?: string | null
  ) => {
    if (!user) return;

    // Staff (not admin) MUST upload both reports to complete a document
    if (role === 'staff') {
      if (!similarityReport || !aiReport) {
        toast({
          title: 'Reports Required',
          description: 'You must upload both Similarity Report and AI Report before completing this document.',
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      const updates: Record<string, unknown> = {
        similarity_percentage: similarityPercentage,
        ai_percentage: aiPercentage,
        remarks: remarks || null,
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
    releaseDocument,
  };
};