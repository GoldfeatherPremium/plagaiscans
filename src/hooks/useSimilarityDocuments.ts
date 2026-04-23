import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();
  const queryKey = ['similarity-documents', user?.id, role] as const;

  const { data: documents = [], isLoading: loading, refetch } = useQuery<SimilarityDocument[]>({
    queryKey,
    enabled: !!user && !!role,
    staleTime: 3 * 60 * 1000, // 3 minutes — matches useDocuments
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from('documents')
        .select('*')
        .eq('scan_type', 'similarity_only')
        .order('uploaded_at', { ascending: false })
        .limit(1000);

      if (role === 'customer') {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const docs = data || [];

      // Batch fetch all profiles (user_id + assigned_staff_id) in ONE query
      const allIds = Array.from(
        new Set(
          docs.flatMap(d => [d.user_id, d.assigned_staff_id]).filter((v): v is string => !!v)
        )
      );

      const profilesMap: Record<string, { email: string; full_name: string | null }> = {};
      if (allIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', allIds);
        profilesData?.forEach(p => {
          profilesMap[p.id] = { email: p.email, full_name: p.full_name };
        });
      }

      return docs.map(doc => ({
        ...doc,
        scan_type: 'similarity_only' as const,
        profile: doc.user_id ? profilesMap[doc.user_id] || null : null,
        staff_profile: doc.assigned_staff_id ? profilesMap[doc.assigned_staff_id] || null : null,
      })) as SimilarityDocument[];
    },
  });

  const fetchDocuments = async () => {
    await refetch();
  };

  // Realtime invalidation — debounced via React Query's request dedup
  useEffect(() => {
    if (!user) return;
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
          queryClient.invalidateQueries({ queryKey: ['similarity-documents'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const uploadSimilarityDocument = async (file: File, exclusions?: { exclude_bibliography?: boolean; exclude_quotes?: boolean; exclude_small_sources?: boolean }): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

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

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const safeExt = fileExt ? fileExt : 'bin';
    const filePath = `${user.id}/${Date.now()}.${safeExt}`;
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

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
      await supabase.storage.from('documents').remove([filePath]);
      throw insertError;
    }

    const { data: creditResultRaw, error: creditError } = await supabase.rpc('consume_user_credit', {
      p_user_id: user.id,
      p_credit_type: 'similarity_only',
      p_description: `Similarity check: ${file.name}`,
    });

    const creditResult = creditResultRaw as { success: boolean; error?: string } | null;

    if (creditError || !creditResult?.success) {
      await supabase.storage.from('documents').remove([filePath]);
      const errMsg = creditError?.message || creditResult?.error || 'Credit deduction failed';
      throw new Error(errMsg);
    }

    await refreshProfile();
    queryClient.invalidateQueries({ queryKey: ['similarity-documents'] });

    try {
      await supabase.functions.invoke('notify-zero-credits', {
        body: { userId: user.id, creditType: 'similarity_only' },
      });
    } catch (err) {
      console.log('Zero credits notification failed (non-critical):', err);
    }
  };

  const uploadSimilarityReport = async (
    documentId: string,
    similarityReport: File,
    similarityPercentage: number | null,
    remarks?: string
  ): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    const reportPath = `${documentId}/similarity_${Date.now()}_${similarityReport.name}`;

    const { error: uploadError } = await supabase.storage
      .from('reports')
      .upload(reportPath, similarityReport);

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

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
      throw new Error(`Document update failed: ${updateError.message}`);
    }

    await supabase.from('activity_logs').insert({
      staff_id: user.id,
      document_id: documentId,
      action: 'completed_similarity',
    });

    toast({
      title: 'Report uploaded',
      description: 'Similarity report has been uploaded successfully',
    });

    queryClient.invalidateQueries({ queryKey: ['similarity-documents'] });
  };

  const deleteSimilarityDocument = async (
    documentId: string,
    filePath: string,
    similarityReportPath?: string | null
  ): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    try {
      await supabase
        .from('document_tag_assignments')
        .delete()
        .eq('document_id', documentId);

      const { error: fileError } = await supabase.storage
        .from('documents')
        .remove([filePath]);

      if (fileError) {
        console.error('Error deleting original file:', fileError);
      }

      if (similarityReportPath) {
        const { error: reportError } = await supabase.storage
          .from('reports')
          .remove([similarityReportPath]);

        if (reportError) {
          console.error('Error deleting similarity report:', reportError);
        }
      }

      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (deleteError) throw deleteError;

      toast({
        title: 'Document deleted',
        description: 'Document has been deleted successfully',
      });

      queryClient.invalidateQueries({ queryKey: ['similarity-documents'] });
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  };

  const cancelSimilarityDocument = async (
    documentId: string,
    cancellationReason: string,
    adminUserId: string
  ) => {
    try {
      const { data: docData, error: fetchError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .maybeSingle();

      if (fetchError || !docData) {
        throw new Error('Document not found');
      }

      let profileInfo: { email?: string; full_name?: string } | null = null;
      if (docData.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', docData.user_id)
          .maybeSingle();
        profileInfo = profile;
      }

      if (docData.status !== 'pending' && docData.status !== 'in_progress') {
        throw new Error('Only pending or in-progress documents can be cancelled');
      }

      if (docData.user_id) {
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

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ similarity_credit_balance: newBalance })
          .eq('id', docData.user_id);

        if (updateError) throw updateError;

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

        await supabase.from('user_notifications').insert({
          user_id: docData.user_id,
          title: 'Document Cancelled',
          message: `Your document "${docData.file_name}" has been cancelled by an administrator. Your similarity credit has been refunded.${cancellationReason ? ` Reason: ${cancellationReason}` : ''}`,
          created_by: adminUserId,
        });
      }

      if (docData.file_path) {
        await supabase.storage.from('documents').remove([docData.file_path]);
      }

      if (docData.similarity_report_path) {
        await supabase.storage.from('reports').remove([docData.similarity_report_path]);
      }

      await supabase
        .from('document_tag_assignments')
        .delete()
        .eq('document_id', documentId);

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

      queryClient.invalidateQueries({ queryKey: ['similarity-documents'] });

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
