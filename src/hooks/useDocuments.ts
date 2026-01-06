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
  scan_type: 'full' | 'similarity_only';
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
    if (!user) return { success: false };

    const fail = (title: string, description: string, error?: unknown) => {
      if (error) console.error('Upload (single) failed:', { title, description, error });
      toast({ title, description, variant: 'destructive' });
      return { success: false };
    };

    try {
      // Always fetch fresh balance from backend (do NOT depend on client profile state)
      const { data: freshProfile, error: profileError } = await supabase
        .from('profiles')
        .select('credit_balance')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        return fail('Upload blocked', 'Could not verify your credits (profile read failed).', profileError);
      }
      if (!freshProfile) {
        return fail('Upload blocked', 'Your account profile is not ready yet. Please sign out and sign in again.', null);
      }

      const currentBalance = freshProfile.credit_balance;
      const requiredCredits = 1;

      if (currentBalance < requiredCredits) {
        return fail('Insufficient Credits', `You need ${requiredCredits} credit to upload this document.`, null);
      }

      const fileExt = file.name.split('.').pop();
      const safeExt = fileExt ? fileExt : 'bin';
      const fileName = `${Date.now()}.${safeExt}`;
      const filePath = `${user.id}/${fileName}`;

      // 1) Upload file to storage
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
      if (uploadError) {
        return fail('Upload failed', `Storage upload failed: ${uploadError.message}`, uploadError);
      }

      // 2) Create document record
      const { data: docData, error: insertError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError || !docData) {
        // Cleanup storage if DB insert fails
        await supabase.storage.from('documents').remove([filePath]);
        return fail('Upload failed', `Could not create document record: ${insertError?.message ?? 'Unknown error'}`, insertError);
      }

      // 3) Deduct credit AFTER successful upload + insert
      const newBalance = currentBalance - 1;
      const { data: updateData, error: updateError } = await supabase
        .from('profiles')
        .update({ credit_balance: newBalance })
        .eq('id', user.id)
        .eq('credit_balance', currentBalance) // optimistic lock
        .select('credit_balance')
        .maybeSingle();

      if (updateError || !updateData) {
        // Roll back the document + storage if we couldn't deduct credits safely
        await supabase.from('documents').delete().eq('id', docData.id);
        await supabase.storage.from('documents').remove([filePath]);
        return fail('Upload failed', 'Could not deduct credits (balance changed). Please try again.', updateError);
      }

      const { error: txError } = await supabase.from('credit_transactions').insert({
        user_id: user.id,
        amount: -1,
        balance_before: currentBalance,
        balance_after: newBalance,
        transaction_type: 'deduction',
        description: `Document upload: ${file.name}`,
        performed_by: user.id,
      });

      if (txError) {
        // Log internally but don't alarm user - upload was successful
        console.error('Credit transaction logging failed (non-critical):', txError);
      }

      toast({ title: 'Success', description: 'Document uploaded successfully' });

      await refreshProfile();
      await fetchDocuments();

      // Trigger push notifications to staff/admin (non-critical)
      try {
        await supabase.functions.invoke('notify-document-upload');
      } catch (err) {
        console.log('Push notification trigger failed (non-critical):', err);
      }

      return { success: true };
    } catch (error) {
      return fail('Upload failed', 'Unexpected error while uploading. Please try again.', error);
    }
  };

  const uploadDocuments = async (
    files: File[],
    onProgress?: (current: number, total: number) => void,
    options?: { uploadType?: 'single' | 'bulk' }
  ): Promise<{ success: number; failed: number }> => {
    if (!user) return { success: 0, failed: files.length };

    const uploadType = options?.uploadType ?? 'single';

    const failToast = (title: string, description: string, error?: unknown) => {
      if (error) console.error(`Upload (${uploadType}) failed:`, { title, description, error });
      toast({ title, description, variant: 'destructive' });
    };

    // Validate credits up-front: requiredCredits = number of files
    const { data: freshProfile, error: profileError } = await supabase
      .from('profiles')
      .select('credit_balance')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      failToast('Upload blocked', 'Could not verify your credits (profile read failed).', profileError);
      return { success: 0, failed: files.length };
    }

    if (!freshProfile) {
      failToast('Upload blocked', 'Your account profile is not ready yet. Please sign out and sign in again.');
      return { success: 0, failed: files.length };
    }

    const availableCredits = freshProfile.credit_balance;
    const requiredCredits = files.length;

    if (availableCredits < requiredCredits) {
      failToast('Insufficient Credits', `You need ${requiredCredits} credits but only have ${availableCredits}.`);
      return { success: 0, failed: files.length };
    }

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      onProgress?.(i + 1, files.length);

      try {
        // Fetch current balance fresh per-file (race-safe)
        const { data: currentProfile, error: balanceError } = await supabase
          .from('profiles')
          .select('credit_balance')
          .eq('id', user.id)
          .maybeSingle();

        if (balanceError) throw balanceError;
        if (!currentProfile) throw new Error('Profile missing');

        const currentBalance = currentProfile.credit_balance;
        if (currentBalance < 1) {
          failToast('Insufficient Credits', `Stopped at file ${i + 1}. No more credits available.`);
          failedCount += files.length - i;
          break;
        }

        const fileExt = file.name.split('.').pop();
        const safeExt = fileExt ? fileExt : 'bin';
        const fileName = `${Date.now()}_${i}.${safeExt}`;
        const filePath = `${user.id}/${fileName}`;

        // 1) Upload to storage
        const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
        if (uploadError) throw uploadError;

        // 2) Create document record
        const { data: docData, error: insertError } = await supabase
          .from('documents')
          .insert({
            user_id: user.id,
            file_name: file.name,
            file_path: filePath,
            status: 'pending',
          })
          .select()
          .single();

        if (insertError || !docData) {
          await supabase.storage.from('documents').remove([filePath]);
          throw insertError ?? new Error('Failed to create document record');
        }

        // 3) Deduct credit AFTER successful upload + insert
        const newBalance = currentBalance - 1;
        const { data: updateData, error: updateError } = await supabase
          .from('profiles')
          .update({ credit_balance: newBalance })
          .eq('id', user.id)
          .eq('credit_balance', currentBalance)
          .select('credit_balance')
          .maybeSingle();

        if (updateError || !updateData) {
          // Roll back this file if we couldn't deduct credits safely
          await supabase.from('documents').delete().eq('id', docData.id);
          await supabase.storage.from('documents').remove([filePath]);
          throw updateError ?? new Error('Credit deduction failed');
        }

        const { error: txError } = await supabase.from('credit_transactions').insert({
          user_id: user.id,
          amount: -1,
          balance_before: currentBalance,
          balance_after: newBalance,
          transaction_type: 'deduction',
          description: `Document upload: ${file.name}`,
          performed_by: user.id,
        });

        if (txError) {
          // Log internally but don't alarm user - upload was successful
          console.error('Credit transaction logging failed (non-critical):', txError);
        }

        successCount++;
      } catch (error: any) {
        const message = error?.message ?? 'Unknown error';
        console.error(`Error uploading file ${file.name}:`, error);
        toast({
          title: 'Upload failed',
          description: `"${file.name}": ${message}`,
          variant: 'destructive',
        });
        failedCount++;
      }
    }

    await refreshProfile();
    await fetchDocuments();

    if (successCount > 0) {
      try {
        await supabase.functions.invoke('notify-document-upload');
      } catch (err) {
        console.log('Push notification trigger failed (non-critical):', err);
      }

      toast({
        title: 'Upload Complete',
        description: `${successCount} uploaded${failedCount > 0 ? `, ${failedCount} failed` : ''}.`,
      });
    } else {
      failToast('Upload Failed', 'No documents were uploaded. Please review the error details above.');
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

  const deleteDocument = async (documentId: string, filePath: string, similarityReportPath?: string | null, aiReportPath?: string | null) => {
    try {
      // 0. Fetch document details BEFORE deleting for logging
      const { data: docData } = await supabase
        .from('documents')
        .select('*, profiles:user_id(email, full_name)')
        .eq('id', documentId)
        .single();

      // 1. Delete tag assignments first (foreign key constraint)
      const { error: tagError } = await supabase
        .from('document_tag_assignments')
        .delete()
        .eq('document_id', documentId);
      
      if (tagError) {
        console.error('Error deleting tag assignments:', tagError);
      }

      // 2. Delete the original uploaded file from storage
      const { error: fileDeleteError } = await supabase.storage
        .from('documents')
        .remove([filePath]);
      
      if (fileDeleteError) {
        console.error('Error deleting original file:', fileDeleteError);
      }

      // 3. Delete similarity report if exists
      if (similarityReportPath) {
        const { error: simReportError } = await supabase.storage
          .from('reports')
          .remove([similarityReportPath]);
        
        if (simReportError) {
          console.error('Error deleting similarity report:', simReportError);
        }
      }

      // 4. Delete AI report if exists
      if (aiReportPath) {
        const { error: aiReportError } = await supabase.storage
          .from('reports')
          .remove([aiReportPath]);
        
        if (aiReportError) {
          console.error('Error deleting AI report:', aiReportError);
        }
      }

      // 5. Delete the document record from database
      const { error: docDeleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (docDeleteError) throw docDeleteError;

      // 6. Log the deletion for admin tracking (NO credit refund)
      if (docData) {
        const profileData = docData.profiles as { email?: string; full_name?: string } | null;
        await supabase.from('deleted_documents_log').insert({
          original_document_id: documentId,
          user_id: docData.user_id,
          magic_link_id: docData.magic_link_id,
          file_name: docData.file_name,
          file_path: filePath,
          scan_type: docData.scan_type || 'full',
          similarity_percentage: docData.similarity_percentage,
          ai_percentage: docData.ai_percentage,
          similarity_report_path: similarityReportPath,
          ai_report_path: aiReportPath,
          remarks: docData.remarks,
          uploaded_at: docData.uploaded_at,
          completed_at: docData.completed_at,
          deleted_by_type: 'customer',
          customer_email: profileData?.email || null,
          customer_name: profileData?.full_name || null,
        });
      }

      // 7. Refresh documents list
      await fetchDocuments();

      toast({
        title: 'File deleted successfully',
        description: 'The document and all associated reports have been permanently removed.',
      });

      return { success: true };
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete document. Please try again.',
        variant: 'destructive',
      });
      return { success: false };
    }
  };

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
    deleteDocument,
  };
};