import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface MagicLink {
  id: string;
  token: string;
  max_uploads: number;
  current_uploads: number;
  expires_at: string | null;
  status: 'active' | 'expired' | 'disabled';
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MagicUploadFile {
  id: string;
  magic_link_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  uploaded_at: string;
}

function generateSecureToken(length: number = 32): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

export function useMagicLinks() {
  const [links, setLinks] = useState<MagicLink[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLinks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('magic_upload_links')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLinks((data as MagicLink[]) || []);
    } catch (error: any) {
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

  const createLink = async (maxUploads: number, expiresInHours?: number) => {
    try {
      const token = generateSecureToken();
      const expiresAt = expiresInHours
        ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
        : null;

      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('magic_upload_links')
        .insert({
          token,
          max_uploads: maxUploads,
          expires_at: expiresAt,
          created_by: userData.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Link Created',
        description: 'Magic upload link has been created successfully',
      });

      await fetchLinks();
      return data as MagicLink;
    } catch (error: any) {
      console.error('Error creating magic link:', error);
      toast({
        title: 'Error',
        description: 'Failed to create magic link',
        variant: 'destructive',
      });
      return null;
    }
  };

  const disableLink = async (id: string) => {
    try {
      const { error } = await supabase
        .from('magic_upload_links')
        .update({ status: 'disabled' })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Link Disabled',
        description: 'Magic upload link has been disabled',
      });

      await fetchLinks();
    } catch (error: any) {
      console.error('Error disabling magic link:', error);
      toast({
        title: 'Error',
        description: 'Failed to disable magic link',
        variant: 'destructive',
      });
    }
  };

  const deleteLink = async (id: string) => {
    try {
      const { error } = await supabase
        .from('magic_upload_links')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Link Deleted',
        description: 'Magic upload link has been deleted',
      });

      await fetchLinks();
    } catch (error: any) {
      console.error('Error deleting magic link:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete magic link',
        variant: 'destructive',
      });
    }
  };

  const getUploadedFiles = async (linkId: string): Promise<MagicUploadFile[]> => {
    try {
      const { data, error } = await supabase
        .from('magic_upload_files')
        .select('*')
        .eq('magic_link_id', linkId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      return (data as MagicUploadFile[]) || [];
    } catch (error: any) {
      console.error('Error fetching uploaded files:', error);
      return [];
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  return {
    links,
    loading,
    fetchLinks,
    createLink,
    disableLink,
    deleteLink,
    getUploadedFiles,
  };
}

export function useMagicLinkUpload(token: string | null) {
  const [linkData, setLinkData] = useState<MagicLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateToken = async () => {
    if (!token) {
      setError('No upload token provided');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('magic_upload_links')
        .select('*')
        .eq('token', token)
        .eq('status', 'active')
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        setError('Invalid or expired upload link');
        setLinkData(null);
        return;
      }

      const link = data as MagicLink;

      // Check expiry
      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        setError('This upload link has expired');
        setLinkData(null);
        return;
      }

      // Check upload limit
      if (link.current_uploads >= link.max_uploads) {
        setError('Upload limit reached for this link');
        setLinkData(null);
        return;
      }

      setLinkData(link);
      setError(null);
    } catch (err: any) {
      console.error('Error validating token:', err);
      setError('Failed to validate upload link');
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File): Promise<boolean> => {
    if (!linkData) {
      toast({
        title: 'Error',
        description: 'Invalid upload link',
        variant: 'destructive',
      });
      return false;
    }

    // Re-validate before upload
    const { data: currentLink } = await supabase
      .from('magic_upload_links')
      .select('*')
      .eq('id', linkData.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!currentLink) {
      setError('Upload link is no longer valid');
      return false;
    }

    const link = currentLink as MagicLink;
    if (link.current_uploads >= link.max_uploads) {
      setError('Upload limit reached');
      return false;
    }

    setUploading(true);
    try {
      const timestamp = Date.now();
      const filePath = `${linkData.id}/${timestamp}_${file.name}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('magic-uploads')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Record file in database
      const { error: recordError } = await supabase
        .from('magic_upload_files')
        .insert({
          magic_link_id: linkData.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
        });

      if (recordError) throw recordError;

      // Increment upload count
      const { error: updateError } = await supabase
        .from('magic_upload_links')
        .update({ current_uploads: link.current_uploads + 1 })
        .eq('id', linkData.id);

      if (updateError) throw updateError;

      // Update local state
      setLinkData({
        ...linkData,
        current_uploads: link.current_uploads + 1,
      });

      // Check if limit reached after this upload
      if (link.current_uploads + 1 >= link.max_uploads) {
        setError('Upload limit reached');
      }

      toast({
        title: 'Success',
        description: 'File uploaded successfully',
      });

      return true;
    } catch (err: any) {
      console.error('Error uploading file:', err);
      toast({
        title: 'Error',
        description: 'Failed to upload file',
        variant: 'destructive',
      });
      return false;
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    validateToken();
  }, [token]);

  return {
    linkData,
    loading,
    uploading,
    error,
    uploadFile,
    remainingUploads: linkData ? linkData.max_uploads - linkData.current_uploads : 0,
  };
}
