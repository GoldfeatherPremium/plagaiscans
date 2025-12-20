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
}

export interface MagicUploadFile {
  id: string;
  magic_link_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  uploaded_at: string;
  // Status and results from processing
  status?: 'pending' | 'in_progress' | 'completed';
  similarity_percentage?: number | null;
  ai_percentage?: number | null;
  similarity_report_path?: string | null;
  ai_report_path?: string | null;
  remarks?: string | null;
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
        .order('created_at', { ascending: false });

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

  const validateMagicLink = async (token: string): Promise<MagicUploadLink | null> => {
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

      // Check if upload limit reached
      if (data.current_uploads >= data.max_uploads) {
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error validating magic link:', error);
      return null;
    }
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
          status: doc.status as 'pending' | 'in_progress' | 'completed',
          similarity_percentage: doc.similarity_percentage,
          ai_percentage: doc.ai_percentage,
          similarity_report_path: doc.similarity_report_path,
          ai_report_path: doc.ai_report_path,
          remarks: doc.remarks,
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

      // Open in new window for faster download experience
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
    uploadFileWithMagicLink,
    getMagicLinkFiles,
    getFilesByToken,
    downloadMagicFile,
  };
};
