import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type DocumentStatus = 'pending' | 'in_progress' | 'completed' | 'error';

export interface Document {
  id: string;
  user_id: string | null;
  magic_link_id?: string | null;
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
  is_favorite?: boolean | null;
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

      // Fetch customer profiles (document owners) - filter out null user_ids
      const customerIds = [...new Set((data || []).filter(d => d.user_id).map(d => d.user_id as string))];
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
        customer_profile: doc.user_id ? customerProfiles[doc.user_id] : undefined
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
      const currentBalance = profile.credit_balance;
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create document record
      const { data: docData, error: insertError } = await supabase.from('documents').insert({
        user_id: user.id,
        file_name: file.name,
        file_path: filePath,
        status: 'pending',
      }).select().single();

      if (insertError) throw insertError;

      // Deduct credit
      const newBalance = currentBalance - 1;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ credit_balance: newBalance })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Log credit transaction
      await supabase.from('credit_transactions').insert({
        user_id: user.id,
        amount: -1,
        balance_before: currentBalance,
        balance_after: newBalance,
        transaction_type: 'deduction',
        description: `Document upload: ${file.name}`,
        performed_by: user.id,
      });

      await refreshProfile();
      await fetchDocuments();

      // Trigger push notifications to staff/admin
      try {
        await supabase.functions.invoke('notify-document-upload');
      } catch (err) {
        console.log('Push notification trigger failed (non-critical):', err);
      }

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

  const uploadDocuments = async (
    files: File[],
    onProgress?: (current: number, total: number) => void
  ): Promise<{ success: number; failed: number }> => {
    if (!user || !profile) return { success: 0, failed: files.length };

    const availableCredits = profile.credit_balance;
    if (availableCredits < files.length) {
      toast({
        title: 'Insufficient Credits',
        description: `You need ${files.length} credits but only have ${availableCredits}`,
        variant: 'destructive',
      });
      return { success: 0, failed: files.length };
    }

    let successCount = 0;
    let failedCount = 0;
    let currentBalance = availableCredits;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      onProgress?.(i + 1, files.length);

      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${i}.${fileExt}`;
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
        const newBalance = currentBalance - 1;
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ credit_balance: newBalance })
          .eq('id', user.id);

        if (updateError) throw updateError;

        // Log credit transaction
        await supabase.from('credit_transactions').insert({
          user_id: user.id,
          amount: -1,
          balance_before: currentBalance,
          balance_after: newBalance,
          transaction_type: 'deduction',
          description: `Document upload: ${file.name}`,
          performed_by: user.id,
        });

        currentBalance = newBalance;
        successCount++;
      } catch (error) {
        console.error(`Error uploading file ${file.name}:`, error);
        failedCount++;
      }
    }

    await refreshProfile();
    await fetchDocuments();

    // Trigger push notifications to staff/admin for new uploads
    if (successCount > 0) {
      try {
        await supabase.functions.invoke('notify-document-upload');
      } catch (err) {
        console.log('Push notification trigger failed (non-critical):', err);
      }
    }

    if (successCount > 0) {
      toast({
        title: 'Upload Complete',
        description: `${successCount} document${successCount !== 1 ? 's' : ''} uploaded successfully${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
      });
    } else {
      toast({
        title: 'Upload Failed',
        description: 'Failed to upload documents',
        variant: 'destructive',
      });
    }

    return { success: successCount, failed: failedCount };
  };

  const downloadFile = async (path: string, bucket: string = 'documents', originalFileName?: string) => {
    try {
      // Auto-detect bucket for guest/magic-link uploads
      const effectiveBucket = bucket === 'documents' && path.startsWith('magic/') ? 'magic-uploads' : bucket;

      const { data, error } = await supabase.storage
        .from(effectiveBucket)
        .createSignedUrl(path, 300);

      if (error) throw error;

      // Fetch the file as blob to force download
      const response = await fetch(data.signedUrl);
      if (!response.ok) throw new Error('Failed to fetch file');
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      // Create anchor and force download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = originalFileName || path.split('/').pop() || 'download';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }, 100);
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
      // Staff AND Admin must upload both reports to complete a document
      if (status === 'completed' && (role === 'staff' || role === 'admin')) {
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
        // Create in-app notification
        try {
          const { error: notifError } = await supabase.from('user_notifications').insert({
            user_id: documentUserId,
            title: 'Document Completed',
            message: `Your document "${fileName}" has been processed. View your results in My Documents.`,
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

        // Send completion email
        try {
          console.log('Sending completion email for document:', documentId);
          const { error: emailError } = await supabase.functions.invoke('send-completion-email', {
            body: {
              userId: documentUserId,
              documentId: documentId,
              fileName: fileName,
              similarityPercentage: updates?.similarity_percentage ?? 0,
              aiPercentage: updates?.ai_percentage ?? 0,
            },
          });
          
          if (emailError) {
            console.error('Error sending completion email:', emailError);
          } else {
            console.log('Completion email sent successfully');
          }
        } catch (emailError) {
          console.error('Exception sending completion email:', emailError);
        }

        // Send push notification
        try {
          console.log('Sending push notification for document:', documentId);
          const { error: pushError } = await supabase.functions.invoke('send-push-notification', {
            body: {
              userId: documentUserId,
              title: 'Document Completed! 📄',
              body: `Your document "${fileName}" has been processed and is ready for download.`,
              data: {
                type: 'document_completed',
                documentId: documentId,
                url: '/dashboard/documents',
              },
            },
          });
          
          if (pushError) {
            console.error('Error sending push notification:', pushError);
          } else {
            console.log('Push notification sent successfully');
          }
        } catch (pushError) {
          console.error('Exception sending push notification:', pushError);
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

    // Staff AND Admin MUST upload both reports to complete a document
    if (role === 'staff' || role === 'admin') {
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

      // Determine folder path - use user_id for regular users, 'guest' folder for magic link uploads
      const folderPath = document.user_id || 'guest';

      // Upload similarity report
      if (similarityReport) {
        const simPath = `${folderPath}/${documentId}_similarity.pdf`;
        const { error: simError } = await supabase.storage
          .from('reports')
          .upload(simPath, similarityReport, { upsert: true });

        if (simError) throw simError;
        updates.similarity_report_path = simPath;
      }

      // Upload AI report
      if (aiReport) {
        const aiPath = `${folderPath}/${documentId}_ai.pdf`;
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
    uploadDocuments,
    downloadFile,
    updateDocumentStatus,
    uploadReport,
    fetchDocuments,
    releaseDocument,
  };
};