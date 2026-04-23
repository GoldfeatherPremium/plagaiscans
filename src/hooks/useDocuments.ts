import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export type DocumentStatus = 'pending' | 'in_progress' | 'completed' | 'error' | 'cancelled';

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
  files_cleaned_at?: string | null;
  is_sample?: boolean;
  // Cancellation fields
  cancellation_reason: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  // Automation fields
  automation_status?: string | null;
  automation_error?: string | null;
  automation_started_at?: string | null;
  automation_attempt_count?: number;
  // Exclusion options
  exclude_bibliography?: boolean;
  exclude_quotes?: boolean;
  exclude_small_sources?: boolean;
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

// Cap on rows fetched per query. Most users have far fewer docs; staff/admin views
// rarely need more than the most recent 1k entries to drive their dashboards.
const MAX_ROWS = 1000;

// Shared query key used by every page that calls useDocuments(). Keeping the same
// shape ensures navigating between Dashboard / MyDocuments / Queue / etc. hits the
// React Query cache instead of re-fetching from Supabase.
const documentsKey = (userId: string | undefined, role: string | null | undefined) =>
  ['documents', userId ?? 'anon', role ?? 'unknown'] as const;

async function fetchDocumentsCore(
  userId: string,
  role: string | null | undefined,
): Promise<Document[]> {
  // Single bounded query (no more 100k pagination loop)
  let query = supabase
    .from('documents')
    .select('*')
    .order('uploaded_at', { ascending: false })
    .limit(MAX_ROWS);

  if (role !== 'staff' && role !== 'admin') {
    query = query.eq('user_id', userId).or('deleted_by_user.is.null,deleted_by_user.eq.false');
  }

  const { data, error } = await query;
  if (error) throw error;

  const allDocs = data ?? [];

  // ---- Single batched profile lookup ----
  // Combine staff + customer IDs into one .in() query, halving round-trips.
  const profileIds = new Set<string>();
  for (const d of allDocs) {
    if (d.assigned_staff_id) profileIds.add(d.assigned_staff_id);
    if (d.user_id) profileIds.add(d.user_id);
  }

  const profileMap: Record<string, { email: string; full_name: string | null }> = {};
  if (profileIds.size > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', Array.from(profileIds));

    if (profiles) {
      for (const p of profiles) {
        profileMap[p.id] = { email: p.email, full_name: p.full_name };
      }
    }
  }

  const docsWithProfiles: Document[] = allDocs.map((doc: any) => ({
    ...doc,
    staff_profile: doc.assigned_staff_id ? profileMap[doc.assigned_staff_id] : undefined,
    customer_profile: doc.user_id ? profileMap[doc.user_id] : undefined,
  }));

  // Prepend virtual sample document for new customers without any completed docs
  const hasCompletedRealDoc = docsWithProfiles.some(d => d.status === 'completed');
  if ((role === 'customer' || (!role && userId)) && !hasCompletedRealDoc) {
    try {
      const { data: sampleSettings } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', [
          'sample_enabled',
          'sample_file_name',
          'sample_file_path',
          'sample_sim_path',
          'sample_ai_path',
          'sample_sim_percentage',
          'sample_ai_percentage',
          'sample_remarks',
        ]);

      if (sampleSettings) {
        const map: Record<string, string> = {};
        sampleSettings.forEach((r: any) => { map[r.key] = r.value; });

        if (
          map.sample_enabled === 'true' &&
          map.sample_file_path &&
          map.sample_sim_path &&
          map.sample_ai_path
        ) {
          const sample: Document = {
            id: 'sample',
            user_id: null,
            file_name: map.sample_file_name || 'Sample.docx',
            file_path: map.sample_file_path,
            status: 'completed',
            scan_type: 'full',
            assigned_staff_id: null,
            assigned_at: null,
            similarity_percentage: map.sample_sim_percentage ? Number(map.sample_sim_percentage) : null,
            ai_percentage: map.sample_ai_percentage ? Number(map.sample_ai_percentage) : null,
            similarity_report_path: map.sample_sim_path,
            ai_report_path: map.sample_ai_path,
            remarks: map.sample_remarks || null,
            error_message: null,
            uploaded_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            cancellation_reason: null,
            cancelled_at: null,
            cancelled_by: null,
            is_sample: true,
          };
          return [sample, ...docsWithProfiles];
        }
      }
    } catch (err) {
      console.log('Sample doc fetch failed (non-critical):', err);
    }
  }

  return docsWithProfiles;
}

export const useDocuments = () => {
  const { user, role, refreshProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = documentsKey(user?.id, role);

  const {
    data: documents = [],
    isLoading,
    refetch,
  } = useQuery<Document[]>({
    queryKey,
    queryFn: () => fetchDocumentsCore(user!.id, role),
    enabled: !!user,
    staleTime: 3 * 60 * 1000,   // 3 minutes — switching between dashboard pages serves from cache
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Optimistic helper writes directly into the React Query cache so every page
  // sharing this key sees the change instantly.
  const optimisticUpdate = (documentId: string, updates: Partial<Document>) => {
    queryClient.setQueryData<Document[]>(queryKey, prev =>
      (prev ?? []).map(doc => doc.id === documentId ? { ...doc, ...updates } : doc)
    );
  };

  // `background` is kept for API compat — React Query handles the loading flag itself.
  const fetchDocuments = async (_background = false) => {
    await refetch();
  };

  const releaseDocument = async (documentId: string) => {
    try {
      optimisticUpdate(documentId, {
        status: 'pending' as DocumentStatus,
        assigned_staff_id: null,
        assigned_at: null,
      });

      const { error } = await supabase
        .from('documents')
        .update({
          status: 'pending',
          assigned_staff_id: null,
          assigned_at: null,
        })
        .eq('id', documentId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({
        title: 'Document Released',
        description: 'Document is now available for other staff members',
      });
    } catch (error) {
      console.error('Error releasing document:', error);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
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

      const { data: validCredits } = await supabase
        .from('credit_validity')
        .select('remaining_credits')
        .eq('user_id', user.id)
        .eq('expired', false)
        .eq('credit_type', 'full')
        .gt('expires_at', new Date().toISOString())
        .gt('remaining_credits', 0);

      const totalValidCredits = validCredits?.reduce((sum, v) => sum + v.remaining_credits, 0) ?? 0;

      if (totalValidCredits < requiredCredits && (validCredits?.length ?? 0) > 0) {
        return fail('Credits Expired', 'Your credits have expired. Please purchase new credits to continue.', null);
      }

      const fileExt = file.name.split('.').pop();
      const safeExt = fileExt ? fileExt : 'bin';
      const fileName = `${Date.now()}.${safeExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
      if (uploadError) {
        return fail('Upload failed', `Storage upload failed: ${uploadError.message}`, uploadError);
      }

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
        return fail('Upload failed', `Could not create document record: ${insertError?.message ?? 'Unknown error'}`, insertError);
      }

      const { data: creditResultRaw, error: creditError } = await supabase.rpc('consume_user_credit', {
        p_user_id: user.id,
        p_credit_type: 'full',
        p_description: `Document upload: ${file.name}`,
      });

      const creditResult = creditResultRaw as { success: boolean; error?: string } | null;

      if (creditError || !creditResult?.success) {
        await supabase.from('documents').delete().eq('id', docData.id);
        await supabase.storage.from('documents').remove([filePath]);
        const errMsg = creditError?.message || creditResult?.error || 'Credit deduction failed';
        return fail('Upload failed', errMsg, creditError);
      }

      toast({ title: 'Success', description: 'Document uploaded successfully' });

      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['documents'] });

      try {
        await supabase.functions.invoke('notify-document-upload');
      } catch (err) {
        console.log('Push notification trigger failed (non-critical):', err);
      }

      try {
        await supabase.functions.invoke('notify-zero-credits', {
          body: { userId: user.id, creditType: 'full' },
        });
      } catch (err) {
        console.log('Zero credits notification failed (non-critical):', err);
      }

      return { success: true };
    } catch (error) {
      return fail('Upload failed', 'Unexpected error while uploading. Please try again.', error);
    }
  };

  const uploadDocuments = async (
    files: File[],
    onProgress?: (current: number, total: number) => void,
    options?: { uploadType?: 'single' | 'bulk'; exclusions?: { exclude_bibliography?: boolean; exclude_quotes?: boolean; exclude_small_sources?: boolean } }
  ): Promise<{ success: number; failed: number }> => {
    if (!user) return { success: 0, failed: files.length };

    const uploadType = options?.uploadType ?? 'single';

    const failToast = (title: string, description: string, error?: unknown) => {
      if (error) console.error(`Upload (${uploadType}) failed:`, { title, description, error });
      toast({ title, description, variant: 'destructive' });
    };

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

        const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: docData, error: insertError } = await supabase
          .from('documents')
          .insert({
            user_id: user.id,
            file_name: file.name,
            file_path: filePath,
            status: 'pending',
            exclude_bibliography: options?.exclusions?.exclude_bibliography ?? true,
            exclude_quotes: options?.exclusions?.exclude_quotes ?? false,
            exclude_small_sources: options?.exclusions?.exclude_small_sources ?? false,
          })
          .select()
          .single();

        if (insertError || !docData) {
          await supabase.storage.from('documents').remove([filePath]);
          throw insertError ?? new Error('Failed to create document record');
        }

        const { data: creditResultRaw, error: creditError } = await supabase.rpc('consume_user_credit', {
          p_user_id: user.id,
          p_credit_type: 'full',
          p_description: `Document upload: ${file.name}`,
        });

        const creditResult = creditResultRaw as { success: boolean; error?: string } | null;

        if (creditError || !creditResult?.success) {
          await supabase.from('documents').delete().eq('id', docData.id);
          await supabase.storage.from('documents').remove([filePath]);
          throw creditError ?? new Error(creditResult?.error || 'Credit deduction failed');
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
    queryClient.invalidateQueries({ queryKey: ['documents'] });

    if (successCount > 0) {
      try {
        await supabase.functions.invoke('notify-document-upload');
      } catch (err) {
        console.log('Push notification trigger failed (non-critical):', err);
      }

      try {
        await supabase.functions.invoke('notify-zero-credits', {
          body: { userId: user.id, creditType: 'full' },
        });
      } catch (err) {
        console.log('Zero credits notification failed (non-critical):', err);
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

  const downloadFile = async (path: string | null | undefined, bucket: string = 'documents', originalFileName?: string) => {
    if (!path) {
      toast({
        title: 'File Unavailable',
        description: 'This file has been removed after the retention period and is no longer available for download.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const effectiveBucket = bucket === 'documents' && path.startsWith('magic/') ? 'magic-uploads' : bucket;

      const { data, error } = await supabase.storage
        .from(effectiveBucket)
        .createSignedUrl(path, 300);

      if (error) throw error;

      const response = await fetch(data.signedUrl);
      if (!response.ok) throw new Error('Failed to fetch file');

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = originalFileName || path.split('/').pop() || 'download';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (error: any) {
      console.error('Error downloading file:', error, 'Path:', path, 'Bucket:', bucket);
      toast({
        title: 'Download Failed',
        description: error?.message || 'Failed to download file. The file may not exist or you may not have permission.',
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

      optimisticUpdate(documentId, updateData as Partial<Document>);

      const { error } = await supabase
        .from('documents')
        .update(updateData)
        .eq('id', documentId);

      if (error) throw error;

      if (user) {
        await supabase.from('activity_logs').insert({
          staff_id: user.id,
          document_id: documentId,
          action: `Changed status to ${status}`,
        });
      }

      if (status === 'completed' && documentUserId && fileName) {
        try {
          const { error: notifError } = await supabase.from('user_notifications').insert({
            user_id: documentUserId,
            title: 'Document Completed',
            message: `Your document "${fileName}" has been processed. View your results in My Documents.`,
            created_by: user?.id,
          });

          if (notifError) {
            console.error('Error creating notification:', notifError);
          }
        } catch (notifError) {
          console.error('Exception creating notification:', notifError);
        }

        try {
          const { error: emailError } = await supabase.functions.invoke('send-completion-email', {
            body: {
              userId: documentUserId,
              documentId: documentId,
              fileName: fileName,
              similarityPercentage: updates?.similarity_percentage ?? null,
              aiPercentage: updates?.ai_percentage ?? null,
            },
          });

          if (emailError) console.error('Error sending completion email:', emailError);
        } catch (emailError) {
          console.error('Exception sending completion email:', emailError);
        }

        try {
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

          if (pushError) console.error('Error sending push notification:', pushError);
        } catch (pushError) {
          console.error('Exception sending push notification:', pushError);
        }
      }

      if (status === 'completed') {
        const { data: docData } = await supabase
          .from('documents')
          .select('magic_link_id')
          .eq('id', documentId)
          .maybeSingle();

        if (docData?.magic_link_id) {
          try {
            const { error: guestEmailError } = await supabase.functions.invoke('send-guest-completion-email', {
              body: {
                documentId: documentId,
                magicLinkId: docData.magic_link_id,
                fileName: fileName || 'Document',
                similarityPercentage: updates?.similarity_percentage ?? null,
                aiPercentage: updates?.ai_percentage ?? null,
              },
            });

            if (guestEmailError) console.error('Error sending guest completion email:', guestEmailError);
          } catch (guestEmailError) {
            console.error('Exception sending guest completion email:', guestEmailError);
          }
        }
      }

      // Background revalidation — don't block UI
      queryClient.invalidateQueries({ queryKey: ['documents'] });

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
    similarityPercentage: number | null,
    aiPercentage: number | null,
    remarks?: string | null
  ) => {
    if (!user) return;

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

      const folderPath = document.user_id || 'guest';

      if (similarityReport) {
        const simPath = `${folderPath}/${documentId}_similarity.pdf`;
        const { error: simError } = await supabase.storage
          .from('reports')
          .upload(simPath, similarityReport, { upsert: true });

        if (simError) throw simError;
        updates.similarity_report_path = simPath;
      }

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

  // Real-time subscription — invalidates the shared cache so all subscribed pages refresh.
  // Channel name MUST be unique per subscriber instance, otherwise Supabase JS rejects
  // duplicate channels when the hook is mounted by multiple components simultaneously
  // (e.g., DocumentQueue + NotificationBell), causing realtime events to silently drop.
  useEffect(() => {
    if (!user) return;

    const channelName = `documents-changes-${user.id}-${Math.random().toString(36).slice(2, 10)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['documents'] });
          queryClient.invalidateQueries({ queryKey: ['similarity-documents'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const deleteDocument = async (documentId: string, _filePath: string, _similarityReportPath?: string | null, _aiReportPath?: string | null) => {
    if (documentId === 'sample') return { success: false };
    try {
      const { error: updateError } = await supabase
        .from('documents')
        .update({
          deleted_by_user: true,
          deleted_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      if (updateError) throw updateError;

      // Optimistic remove from cache
      queryClient.setQueryData<Document[]>(queryKey, prev =>
        (prev ?? []).filter(doc => doc.id !== documentId)
      );

      toast({
        title: 'Document deleted',
        description: 'The document has been removed from your view.',
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

  const cancelDocument = async (
    documentId: string,
    cancellationReason: string,
    adminUserId: string
  ) => {
    if (documentId === 'sample') return { success: false };
    try {
      const { data: docData, error: fetchError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching document:', fetchError);
        throw new Error(`Failed to fetch document: ${fetchError.message}`);
      }

      if (!docData) {
        throw new Error('Document not found');
      }

      let profileData: { email?: string; full_name?: string } | null = null;
      if (docData.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', docData.user_id)
          .maybeSingle();
        profileData = profile;
      }

      if (docData.status !== 'pending' && docData.status !== 'in_progress') {
        throw new Error('Only pending or in-progress documents can be cancelled');
      }

      const isGuestUpload = !!docData.magic_link_id;
      const scanType = docData.scan_type || 'full';

      if (docData.user_id) {
        const balanceField = scanType === 'full' ? 'credit_balance' : 'similarity_credit_balance';

        const { data: balanceData, error: balanceError } = await supabase
          .from('profiles')
          .select(balanceField)
          .eq('id', docData.user_id)
          .single();

        if (balanceError || !balanceData) {
          throw new Error('Failed to fetch user profile');
        }

        const currentBalance = (balanceData as Record<string, number>)[balanceField];
        const newBalance = currentBalance + 1;

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ [balanceField]: newBalance })
          .eq('id', docData.user_id);

        if (updateError) throw updateError;

        await supabase.from('credit_transactions').insert({
          user_id: docData.user_id,
          amount: 1,
          balance_before: currentBalance,
          balance_after: newBalance,
          transaction_type: 'refund',
          credit_type: scanType === 'full' ? 'full' : 'similarity_only',
          description: `Credit refunded - Document cancelled by admin: ${docData.file_name}`,
          performed_by: adminUserId,
        });

        await supabase.from('user_notifications').insert({
          user_id: docData.user_id,
          title: 'Document Cancelled',
          message: `Your document "${docData.file_name}" has been cancelled by an administrator. Your credit has been refunded.${cancellationReason ? ` Reason: ${cancellationReason}` : ''}`,
          created_by: adminUserId,
        });
      } else if (isGuestUpload && docData.magic_link_id) {
        const { data: magicLink, error: mlError } = await supabase
          .from('magic_upload_links')
          .select('current_uploads')
          .eq('id', docData.magic_link_id)
          .single();

        if (!mlError && magicLink) {
          await supabase
            .from('magic_upload_links')
            .update({ current_uploads: Math.max(0, magicLink.current_uploads - 1) })
            .eq('id', docData.magic_link_id);
        }
      }

      const bucket = isGuestUpload ? 'magic-uploads' : 'documents';
      await supabase.storage.from(bucket).remove([docData.file_path]);

      if (docData.similarity_report_path) {
        await supabase.storage.from('reports').remove([docData.similarity_report_path]);
      }
      if (docData.ai_report_path) {
        await supabase.storage.from('reports').remove([docData.ai_report_path]);
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
        magic_link_id: docData.magic_link_id,
        file_name: docData.file_name,
        file_path: docData.file_path,
        scan_type: scanType,
        similarity_percentage: docData.similarity_percentage,
        ai_percentage: docData.ai_percentage,
        similarity_report_path: docData.similarity_report_path,
        ai_report_path: docData.ai_report_path,
        remarks: docData.remarks,
        uploaded_at: docData.uploaded_at,
        completed_at: docData.completed_at,
        deleted_by_type: 'admin_cancelled',
        customer_email: profileData?.email || null,
        customer_name: profileData?.full_name || null,
      });

      queryClient.invalidateQueries({ queryKey: ['documents'] });

      toast({
        title: 'Document Cancelled',
        description: `Document has been cancelled and credit refunded.`,
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error cancelling document:', error);
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
    loading: isLoading,
    uploadDocument,
    uploadDocuments,
    downloadFile,
    updateDocumentStatus,
    uploadReport,
    fetchDocuments,
    releaseDocument,
    deleteDocument,
    cancelDocument,
  };
};
