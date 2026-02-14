import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export type DocumentStatus = 'pending' | 'in_progress' | 'completed' | 'error' | 'cancelled';

export interface SimilarityDocument {
  id: string;
  user_id: string | null;
  file_name: string;
  file_path: string;
  status: DocumentStatus;
  similarity_percentage: number | null;
  similarity_report_path: string | null;
  remarks: string | null;
  uploaded_at: string;
  completed_at: string | null;
  assigned_staff_id: string | null;
  scan_type: 'similarity_only';
  is_favorite: boolean;
  exclude_bibliography?: boolean;
  exclude_quotes?: boolean;
  exclude_small_sources?: boolean;
  profile?: {
    email: string;
    full_name: string | null;
  } | null;
  staff_profile?: {
    email: string;
    full_name: string | null;
  } | null;
}

export const useSimilarityDocuments = () => {
  const { user, role, refreshProfile } = useAuth();
  const [documents, setDocuments] = useState<SimilarityDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    if (!user) return;

    try {
      let query = supabase
        .from('documents')
        .select('*')
        .eq('scan_type', 'similarity_only')
        .order('uploaded_at', { ascending: false })
        .limit(50000);

      // Filter based on role
      if (role === 'customer') {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      const docs = data || [];
      
      // Collect all unique user IDs and staff IDs for batch fetch
      const userIds = new Set<string>();
      const staffIds = new Set<string>();
      
      docs.forEach(doc => {
        if (doc.user_id) userIds.add(doc.user_id);
        if (doc.assigned_staff_id) staffIds.add(doc.assigned_staff_id);
      });

      // Combine all unique IDs and fetch profiles in ONE query
      const allIds = [...new Set([...userIds, ...staffIds])];
      
      let profilesMap: Record<string, { email: string; full_name: string | null }> = {};
      
      if (allIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', allIds);
        
        if (profilesData) {
          profilesData.forEach(p => {
            profilesMap[p.id] = { email: p.email, full_name: p.full_name };
          });
        }
      }

      // Map profiles to documents
      const documentsWithProfiles = docs.map(doc => ({
        ...doc,
        scan_type: 'similarity_only' as const,
        profile: doc.user_id ? profilesMap[doc.user_id] || null : null,
        staff_profile: doc.assigned_staff_id ? profilesMap[doc.assigned_staff_id] || null : null,
      }));

      setDocuments(documentsWithProfiles);
    } catch (error) {
      console.error('Error fetching similarity documents:', error);
    } finally {
      setLoading(false);
    }
  }, [user, role]);

  const uploadSimilarityDocument = async (file: File, exclusions?: { exclude_bibliography?: boolean; exclude_quotes?: boolean; exclude_small_sources?: boolean }): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    // Check similarity credits
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('similarity_credit_balance')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Could not fetch profile');
    }

    if (profile.similarity_credit_balance < 1) {
      throw new Error('Insufficient similarity credits');
    }

    // Check if user has non-expired credit validity records with remaining credits
    const { data: validCredits } = await supabase
      .from('credit_validity')
      .select('remaining_credits')
      .eq('user_id', user.id)
      .eq('expired', false)
      .eq('credit_type', 'similarity')
      .gt('expires_at', new Date().toISOString())
      .gt('remaining_credits', 0);

    const totalValidCredits = validCredits?.reduce((sum, v) => sum + v.remaining_credits, 0) ?? 0;

    if (totalValidCredits < 1 && (validCredits?.length ?? 0) > 0) {
      throw new Error('Your similarity credits have expired. Please purchase new credits to continue.');
    }

    // Upload file to storage
    const filePath = `${user.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Create document record with scan_type = 'similarity_only'
    const { error: insertError } = await supabase.from('documents').insert({
      user_id: user.id,
      file_name: file.name,
      file_path: filePath,
      status: 'pending',
      scan_type: 'similarity_only',
      exclude_bibliography: exclusions?.exclude_bibliography ?? true,
      exclude_quotes: exclusions?.exclude_quotes ?? false,
      exclude_small_sources: exclusions?.exclude_small_sources ?? false,
    });

    if (insertError) {
      // Rollback: delete uploaded file
      await supabase.storage.from('documents').remove([filePath]);
      throw insertError;
    }

    // Deduct similarity credit
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        similarity_credit_balance: profile.similarity_credit_balance - 1,
      })
      .eq('id', user.id);

    if (updateError) throw updateError;

    // Log credit transaction
    await supabase.from('credit_transactions').insert({
      user_id: user.id,
      amount: -1,
      balance_before: profile.similarity_credit_balance,
      balance_after: profile.similarity_credit_balance - 1,
      transaction_type: 'deduction',
      description: `Similarity check: ${file.name}`,
      credit_type: 'similarity_only',
    });

    await refreshProfile();
    await fetchDocuments();
  };

  const uploadSimilarityReport = async (
    documentId: string,
    similarityReport: File,
    similarityPercentage: number | null,
    remarks?: string
  ): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    console.log('uploadSimilarityReport called:', { documentId, fileName: similarityReport.name, similarityPercentage });

    // Upload similarity report
    const reportPath = `${documentId}/similarity_${Date.now()}_${similarityReport.name}`;
    console.log('Uploading to path:', reportPath);
    
    const { error: uploadError } = await supabase.storage
      .from('reports')
      .upload(reportPath, similarityReport);

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }
    
    console.log('File uploaded successfully, updating document record...');

    // Update document
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        similarity_report_path: reportPath,
        similarity_percentage: similarityPercentage,
        remarks: remarks || null,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (updateError) {
      console.error('Document update error:', updateError);
      throw new Error(`Document update failed: ${updateError.message}`);
    }

    console.log('Document updated successfully, logging activity...');

    // Log activity
    await supabase.from('activity_logs').insert({
      staff_id: user.id,
      document_id: documentId,
      action: 'completed_similarity',
    });

    toast({
      title: 'Report uploaded',
      description: 'Similarity report has been uploaded successfully',
    });

    await fetchDocuments();
  };

  const deleteSimilarityDocument = async (
    documentId: string,
    filePath: string,
    similarityReportPath?: string | null
  ): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    try {
      // Delete tag assignments first (foreign key constraint)
      await supabase
        .from('document_tag_assignments')
        .delete()
        .eq('document_id', documentId);

      // Delete original file from storage
      const { error: fileError } = await supabase.storage
        .from('documents')
        .remove([filePath]);

      if (fileError) {
        console.error('Error deleting original file:', fileError);
      }

      // Delete similarity report if exists
      if (similarityReportPath) {
        const { error: reportError } = await supabase.storage
          .from('reports')
          .remove([similarityReportPath]);

        if (reportError) {
          console.error('Error deleting similarity report:', reportError);
        }
      }

      // Delete document record
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (deleteError) throw deleteError;

      toast({
        title: 'Document deleted',
        description: 'Document has been deleted successfully',
      });

      await fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  };

  // Cancel similarity document (admin only) - refunds credit to customer
  const cancelSimilarityDocument = async (
    documentId: string,
    cancellationReason: string,
    adminUserId: string
  ) => {
    try {
      // 1. Fetch document details
      const { data: docData, error: fetchError } = await supabase
        .from('documents')
        .select('*, profiles:user_id(email, full_name)')
        .eq('id', documentId)
        .single();

      if (fetchError || !docData) {
        throw new Error('Document not found');
      }

      // Only allow cancellation of pending/in_progress documents
      if (docData.status !== 'pending' && docData.status !== 'in_progress') {
        throw new Error('Only pending or in-progress documents can be cancelled');
      }

      // 2. Handle credit refund for registered user
      if (docData.user_id) {
        // Get current similarity balance
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('similarity_credit_balance')
          .eq('id', docData.user_id)
          .single();

        if (profileError || !profileData) {
          throw new Error('Failed to fetch user profile');
        }

        const currentBalance = profileData.similarity_credit_balance;
        const newBalance = currentBalance + 1;

        // Update balance
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ similarity_credit_balance: newBalance })
          .eq('id', docData.user_id);

        if (updateError) throw updateError;

        // Log credit transaction
        await supabase.from('credit_transactions').insert({
          user_id: docData.user_id,
          amount: 1,
          balance_before: currentBalance,
          balance_after: newBalance,
          transaction_type: 'refund',
          credit_type: 'similarity_only',
          description: `Credit refunded - Document cancelled by admin: ${docData.file_name}`,
          performed_by: adminUserId,
        });

        // Create user notification
        await supabase.from('user_notifications').insert({
          user_id: docData.user_id,
          title: 'Document Cancelled',
          message: `Your document "${docData.file_name}" has been cancelled by an administrator. Your similarity credit has been refunded.${cancellationReason ? ` Reason: ${cancellationReason}` : ''}`,
          created_by: adminUserId,
        });
      }

      // 3. Delete files from storage
      await supabase.storage.from('documents').remove([docData.file_path]);

      // Delete similarity report if exists
      if (docData.similarity_report_path) {
        await supabase.storage.from('reports').remove([docData.similarity_report_path]);
      }

      // 4. Delete tag assignments
      await supabase
        .from('document_tag_assignments')
        .delete()
        .eq('document_id', documentId);

      // 5. Update document status to cancelled
      const { error: cancelError } = await supabase
        .from('documents')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: adminUserId,
          cancellation_reason: cancellationReason || null,
          credit_refunded: true,
        })
        .eq('id', documentId);

      if (cancelError) throw cancelError;

      // 6. Log to deleted_documents_log
      const profileInfo = docData.profiles as { email?: string; full_name?: string } | null;
      await supabase.from('deleted_documents_log').insert({
        original_document_id: documentId,
        user_id: docData.user_id,
        file_name: docData.file_name,
        file_path: docData.file_path,
        scan_type: 'similarity_only',
        similarity_percentage: docData.similarity_percentage,
        similarity_report_path: docData.similarity_report_path,
        remarks: docData.remarks,
        uploaded_at: docData.uploaded_at,
        completed_at: docData.completed_at,
        deleted_by_type: 'admin_cancelled',
        customer_email: profileInfo?.email || null,
        customer_name: profileInfo?.full_name || null,
      });

      await fetchDocuments();

      toast({
        title: 'Document Cancelled',
        description: 'Document has been cancelled and similarity credit refunded.',
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error cancelling similarity document:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel document',
        variant: 'destructive',
      });
      return { success: false };
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('similarity-documents-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: 'scan_type=eq.similarity_only',
        },
        () => {
          fetchDocuments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDocuments]);

  return {
    documents,
    loading,
    fetchDocuments,
    uploadSimilarityDocument,
    uploadSimilarityReport,
    deleteSimilarityDocument,
    cancelSimilarityDocument,
  };
};
