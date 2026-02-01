import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface MagicUploadLink {
  id: string;
  token: string;
  max_uploads: number;
  current_uploads: number;
  expires_at: string | null;
  status: string;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  guest_email?: string | null;
  guest_name?: string | null;
}

export interface MagicUploadFile {
  id: string;
  magic_link_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  uploaded_at: string;
  // Status and results from processing
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  similarity_percentage?: number | null;
  ai_percentage?: number | null;
  similarity_report_path?: string | null;
  ai_report_path?: string | null;
  remarks?: string | null;
  // Cancellation fields
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  // Soft delete tracking
  deleted_by_user?: boolean;
  deleted_at?: string | null;
}

const generateSecureToken = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let token = '';
  const randomValues = new Uint8Array(32);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < 32; i++) {
    token += chars[randomValues[i] % chars.length];
  }
  return token;
};

export const useMagicLinks = () => {
  const { toast } = useToast();
  const [magicLinks, setMagicLinks] = useState<MagicUploadLink[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMagicLinks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('magic_upload_links')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50000);

      if (error) throw error;
      setMagicLinks(data || []);
    } catch (error) {
      console.error('Error fetching magic links:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch magic links',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createMagicLink = async (maxUploads: number, expiresInHours?: number) => {
    try {
      const token = generateSecureToken();
      
      // Default expiry: 1 month from now
      const expiresAt = expiresInHours 
        ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 1 month

      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('magic_upload_links')
        .insert({
          token,
          max_uploads: maxUploads,
          current_uploads: 0,
          expires_at: expiresAt,
          status: 'active',
          created_by: userData.user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchMagicLinks();
      
      toast({
        title: 'Success',
        description: 'Magic link created successfully',
      });

      return data;
    } catch (error) {
      console.error('Error creating magic link:', error);
      toast({
        title: 'Error',
        description: 'Failed to create magic link',
        variant: 'destructive',
      });
      return null;
    }
  };

  const disableMagicLink = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from('magic_upload_links')
        .update({ status: 'disabled' })
        .eq('id', linkId);

      if (error) throw error;

      await fetchMagicLinks();
      
      toast({
        title: 'Success',
        description: 'Magic link disabled',
      });
    } catch (error) {
      console.error('Error disabling magic link:', error);
      toast({
        title: 'Error',
        description: 'Failed to disable magic link',
        variant: 'destructive',
      });
    }
  };

  const deleteMagicLink = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from('magic_upload_links')
        .delete()
        .eq('id', linkId);

      if (error) throw error;

      await fetchMagicLinks();
      
      toast({
        title: 'Success',
        description: 'Magic link deleted',
      });
    } catch (error) {
      console.error('Error deleting magic link:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete magic link',
        variant: 'destructive',
      });
    }
  };

  // Validates magic link for access (viewing/downloading) - doesn't check upload limits
  const validateMagicLinkForAccess = async (token: string): Promise<MagicUploadLink | null> => {
    try {
      const { data, error } = await supabase
        .from('magic_upload_links')
        .select('*')
        .eq('token', token)
        .eq('status', 'active')
        .maybeSingle();

      if (error) throw error;
      
      if (!data) return null;

      // Check if expired
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        return null;
      }

      // Access is allowed even if upload limit is reached
      return data;
    } catch (error) {
      console.error('Error validating magic link for access:', error);
      return null;
    }
  };

  // Validates magic link for uploading - checks upload limits
  const validateMagicLink = async (token: string): Promise<MagicUploadLink | null> => {
    const data = await validateMagicLinkForAccess(token);
    
    if (!data) return null;

    // Check if upload limit reached
    if (data.current_uploads >= data.max_uploads) {
      return null;
    }

    return data;
  };

  const uploadFileWithMagicLink = async (token: string, file: File): Promise<boolean> => {
    try {
      // Validate the link first
      const link = await validateMagicLink(token);
      if (!link) {
        toast({
          title: 'Upload Limit Reached',
          description: 'This link has reached its upload limit or has expired',
          variant: 'destructive',
        });
        return false;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `magic/${link.id}/${fileName}`;

      // Upload file to magic-uploads bucket
      const { error: uploadError } = await supabase.storage
        .from('magic-uploads')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create file record in magic_upload_files
      const { error: insertError } = await supabase
        .from('magic_upload_files')
        .insert({
          magic_link_id: link.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
        });

      if (insertError) throw insertError;

      // Also create a document record for staff processing queue
      const { error: docError } = await supabase
        .from('documents')
        .insert({
          file_name: `[Guest] ${file.name}`,
          file_path: filePath,
          magic_link_id: link.id,
          status: 'pending',
        });

      if (docError) {
        console.error('Error creating document record:', docError);
        // Don't fail the upload if document creation fails
      }

      // Increment upload count
      const { error: updateError } = await supabase
        .from('magic_upload_links')
        .update({ current_uploads: link.current_uploads + 1 })
        .eq('id', link.id);

      if (updateError) throw updateError;

      toast({
        title: 'Success',
        description: 'File uploaded successfully',
      });

      return true;
    } catch (error) {
      console.error('Error uploading file with magic link:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload file',
        variant: 'destructive',
      });
      return false;
    }
  };

  const getMagicLinkFiles = async (linkId: string): Promise<MagicUploadFile[]> => {
    try {
      const { data, error } = await supabase
        .from('magic_upload_files')
        .select('*')
        .eq('magic_link_id', linkId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching magic link files:', error);
      return [];
    }
  };

  const getFilesByToken = async (token: string): Promise<MagicUploadFile[]> => {
    try {
      const { data: linkData, error: linkError } = await supabase
        .from('magic_upload_links')
        .select('id')
        .eq('token', token)
        .maybeSingle();

      if (linkError || !linkData) return [];

      // Fetch documents by magic_link_id to get processing results
      const { data: documents, error: docsError } = await supabase
        .from('documents')
        .select('*')
        .eq('magic_link_id', linkData.id)
        .order('uploaded_at', { ascending: false });

      if (docsError) {
        console.error('Error fetching guest documents:', docsError);
        // Fall back to magic_upload_files if documents query fails
        return await getMagicLinkFiles(linkData.id);
      }

      // Map documents to MagicUploadFile format for compatibility
      if (documents && documents.length > 0) {
        return documents.map(doc => ({
          id: doc.id,
          magic_link_id: doc.magic_link_id || linkData.id,
          file_name: doc.file_name.replace('[Guest] ', ''), // Remove [Guest] prefix for display
          file_path: doc.file_path,
          file_size: null,
          uploaded_at: doc.uploaded_at,
          status: doc.status as 'pending' | 'in_progress' | 'completed' | 'cancelled',
          similarity_percentage: doc.similarity_percentage,
          ai_percentage: doc.ai_percentage,
          similarity_report_path: doc.similarity_report_path,
          ai_report_path: doc.ai_report_path,
          remarks: doc.remarks,
          cancellation_reason: doc.cancellation_reason,
          cancelled_at: doc.cancelled_at,
          deleted_by_user: doc.deleted_by_user || false,
          deleted_at: doc.deleted_at,
        }));
      }

      // Fall back to magic_upload_files if no documents found
      return await getMagicLinkFiles(linkData.id);
    } catch (error) {
      console.error('Error fetching files by token:', error);
      return [];
    }
  };

  const downloadMagicFile = async (path: string, originalFileName?: string, bucket: string = 'magic-uploads') => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
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

  const deleteMagicFile = async (fileId: string, filePath: string, magicLinkId: string): Promise<boolean> => {
    try {
      // Fetch document details BEFORE deleting for logging
      const { data: docData } = await supabase
        .from('documents')
        .select('*')
        .eq('file_path', filePath)
        .eq('magic_link_id', magicLinkId)
        .maybeSingle();

      // Get magic upload file info
      const { data: fileData } = await supabase
        .from('magic_upload_files')
        .select('file_name')
        .eq('id', fileId)
        .maybeSingle();

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('magic-uploads')
        .remove([filePath]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
        // Continue with database deletion even if storage fails
      }

      // Delete reports if they exist
      if (docData?.similarity_report_path) {
        await supabase.storage.from('reports').remove([docData.similarity_report_path]);
      }
      if (docData?.ai_report_path) {
        await supabase.storage.from('reports').remove([docData.ai_report_path]);
      }

      // Delete from magic_upload_files table
      const { error: fileError } = await supabase
        .from('magic_upload_files')
        .delete()
        .eq('id', fileId);

      if (fileError) throw fileError;

      // Also delete from documents table if exists
      await supabase
        .from('documents')
        .delete()
        .eq('file_path', filePath)
        .eq('magic_link_id', magicLinkId);

      // Log the deletion for admin tracking
      const fileName = docData?.file_name || fileData?.file_name || 'Unknown file';
      await supabase.from('deleted_documents_log').insert({
        original_document_id: docData?.id || fileId,
        user_id: null,
        magic_link_id: magicLinkId,
        file_name: fileName,
        file_path: filePath,
        scan_type: docData?.scan_type || 'full',
        similarity_percentage: docData?.similarity_percentage,
        ai_percentage: docData?.ai_percentage,
        similarity_report_path: docData?.similarity_report_path,
        ai_report_path: docData?.ai_report_path,
        uploaded_at: docData?.uploaded_at,
        completed_at: docData?.completed_at,
        deleted_by_type: 'guest',
        customer_email: null,
        customer_name: null,
        remarks: docData?.remarks,
      });

      // NOTE: We intentionally do NOT decrement upload count
      // This prevents users from reusing credits after deleting files

      await fetchMagicLinks();

      toast({
        title: 'Success',
        description: 'File deleted successfully',
      });

      return true;
    } catch (error) {
      console.error('Error deleting magic file:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete file',
        variant: 'destructive',
      });
      return false;
    }
  };

  // Soft delete a completed document for guests (customer-facing)
  // This preserves the record but marks it as deleted
  const deleteGuestDocument = async (
    documentId: string, 
    filePath: string, 
    magicLinkId: string,
    similarityReportPath?: string | null,
    aiReportPath?: string | null
  ): Promise<boolean> => {
    try {
      // Fetch document details BEFORE updating for logging
      const { data: docData, error: fetchError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching document for logging:', fetchError);
      }

      // Delete original file from storage
      const { error: storageError } = await supabase.storage
        .from('magic-uploads')
        .remove([filePath]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
      }

      // Delete similarity report if exists
      if (similarityReportPath) {
        const { error: simError } = await supabase.storage
          .from('reports')
          .remove([similarityReportPath]);
        if (simError) console.error('Error deleting similarity report:', simError);
      }

      // Delete AI report if exists
      if (aiReportPath) {
        const { error: aiError } = await supabase.storage
          .from('reports')
          .remove([aiReportPath]);
        if (aiError) console.error('Error deleting AI report:', aiError);
      }

      // Soft delete from magic_upload_files table
      await supabase
        .from('magic_upload_files')
        .update({ 
          deleted_by_user: true, 
          deleted_at: new Date().toISOString() 
        })
        .eq('file_path', filePath);

      // SOFT DELETE document record instead of hard delete
      const { error: docError } = await supabase
        .from('documents')
        .update({ 
          deleted_by_user: true, 
          deleted_at: new Date().toISOString(),
          // Clear report paths since files are deleted
          similarity_report_path: null,
          ai_report_path: null,
        })
        .eq('id', documentId);

      if (docError) {
        console.error('Error soft-deleting document:', docError);
      }

      // Log the deletion for admin tracking (NO credit refund for guests)
      const { error: logError } = await supabase.from('deleted_documents_log').insert({
        original_document_id: documentId,
        user_id: null,
        magic_link_id: magicLinkId,
        file_name: docData?.file_name || 'Unknown file',
        file_path: filePath,
        scan_type: docData?.scan_type || 'full',
        similarity_percentage: docData?.similarity_percentage,
        ai_percentage: docData?.ai_percentage,
        similarity_report_path: similarityReportPath,
        ai_report_path: aiReportPath,
        remarks: docData?.remarks,
        uploaded_at: docData?.uploaded_at,
        completed_at: docData?.completed_at,
        deleted_by_type: 'guest',
        customer_email: null,
        customer_name: null,
      });

      if (logError) {
        console.error('Error logging deletion:', logError);
      }

      // NOTE: We intentionally do NOT decrement upload count
      // This prevents users from reusing credits after deleting files

      toast({
        title: 'File deleted',
        description: 'Document and reports have been removed. Record preserved.',
      });

      return true;
    } catch (error) {
      console.error('Error deleting guest document:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete file',
        variant: 'destructive',
      });
      return false;
    }
  };

  useEffect(() => {
    fetchMagicLinks();
  }, []);

  return {
    magicLinks,
    loading,
    fetchMagicLinks,
    createMagicLink,
    disableMagicLink,
    deleteMagicLink,
    validateMagicLink,
    validateMagicLinkForAccess,
    uploadFileWithMagicLink,
    getMagicLinkFiles,
    getFilesByToken,
    downloadMagicFile,
    deleteMagicFile,
    deleteGuestDocument,
  };
};
