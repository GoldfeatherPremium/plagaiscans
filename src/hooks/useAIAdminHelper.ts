import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  proposedChanges?: ProposedChanges | null;
}

interface ProposedChanges {
  change_type: string;
  description: string;
  affected_areas: string[];
  changes: Array<{
    target: string;
    current_value?: string;
    new_value: string;
    action: string;
  }>;
  requires_code_change: boolean;
  safety_level: 'safe' | 'review_required' | 'not_allowed';
}

interface AISettings {
  is_enabled: boolean;
}

interface ChangeVersion {
  id: string;
  version_number: number;
  change_type: string;
  change_description: string;
  affected_areas: string[];
  changes_json: Record<string, unknown>;
  applied_at: string;
  is_active: boolean;
  rolled_back_at: string | null;
}

interface AuditLog {
  id: string;
  admin_id: string;
  prompt_text: string;
  ai_response: string;
  proposed_changes: Record<string, unknown> | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

export function useAIAdminHelper() {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [settings, setSettings] = useState<AISettings>({ is_enabled: false });
  const [versions, setVersions] = useState<ChangeVersion[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [auditLogsLoading, setAuditLogsLoading] = useState(true);
  const [auditFilter, setAuditFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const isAdmin = role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      fetchSettings();
      fetchVersions();
      fetchAuditLogs();
    }
  }, [isAdmin]);

  const fetchSettings = async () => {
    setSettingsLoading(true);
    const { data, error } = await supabase
      .from('ai_admin_settings')
      .select('is_enabled')
      .single();

    if (!error && data) {
      setSettings({ is_enabled: data.is_enabled });
    }
    setSettingsLoading(false);
  };

  const fetchVersions = async () => {
    const { data, error } = await supabase
      .from('ai_change_versions')
      .select('*')
      .order('version_number', { ascending: false })
      .limit(50);

    if (!error && data) {
      setVersions(data as ChangeVersion[]);
    }
  };

  const fetchAuditLogs = async () => {
    setAuditLogsLoading(true);
    let query = supabase
      .from('ai_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (auditFilter !== 'all') {
      query = query.eq('status', auditFilter);
    }

    const { data, error } = await query;

    if (!error && data) {
      setAuditLogs(data as AuditLog[]);
    }
    setAuditLogsLoading(false);
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAuditLogs();
    }
  }, [auditFilter, isAdmin]);

  const toggleAIHelper = async (enabled: boolean) => {
    const { error } = await supabase
      .from('ai_admin_settings')
      .update({ is_enabled: enabled, updated_at: new Date().toISOString(), updated_by: user?.id })
      .eq('id', (await supabase.from('ai_admin_settings').select('id').single()).data?.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update AI Helper settings',
        variant: 'destructive',
      });
      return;
    }

    setSettings({ is_enabled: enabled });
    toast({
      title: enabled ? 'AI Helper Enabled' : 'AI Helper Disabled',
      description: enabled ? 'You can now use the AI Admin Helper' : 'AI Admin Helper has been disabled',
    });
  };

  const sendMessage = async (prompt: string) => {
    if (!settings.is_enabled) {
      toast({
        title: 'AI Helper Disabled',
        description: 'Please enable the AI Admin Helper first',
        variant: 'destructive',
      });
      return;
    }

    const userMessage: AIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-admin-helper`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ prompt, conversationHistory }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get AI response');
      }

      const data = await response.json();
      
      // Parse proposed changes from response if present
      let proposedChanges: ProposedChanges | null = null;
      const jsonMatch = data.response.match(/```json\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        try {
          proposedChanges = JSON.parse(jsonMatch[1]);
        } catch {
          console.log('Could not parse JSON from response');
        }
      }

      const assistantMessage: AIMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        proposedChanges,
      };

      setMessages(prev => [...prev, assistantMessage]);
      fetchAuditLogs(); // Refresh audit logs
    } catch (error) {
      console.error('AI Helper error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to communicate with AI Helper',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Apply settings changes to the settings table
  const applySettingsChanges = async (changes: ProposedChanges): Promise<boolean> => {
    const settingsChanges = changes.changes.filter(
      c => c.action === 'update' && (c.target.includes('setting') || changes.change_type === 'configuration')
    );

    if (settingsChanges.length === 0) {
      return true; // No settings to apply
    }

    let appliedCount = 0;
    
    for (const change of settingsChanges) {
      // Try to find the setting key from the target
      const settingKey = change.target
        .replace(/\s+/g, '_')
        .toLowerCase()
        .replace(/setting[s]?:?\s*/i, '')
        .trim();

      if (!settingKey) continue;

      // Check if the setting exists
      const { data: existingSetting } = await supabase
        .from('settings')
        .select('id, key, value')
        .eq('key', settingKey)
        .single();

      if (existingSetting) {
        // Update existing setting
        const { error } = await supabase
          .from('settings')
          .update({ 
            value: change.new_value,
            updated_at: new Date().toISOString()
          })
          .eq('key', settingKey);

        if (!error) {
          appliedCount++;
          console.log(`Updated setting: ${settingKey} = ${change.new_value}`);
        } else {
          console.error(`Failed to update setting ${settingKey}:`, error);
        }
      } else {
        // Insert new setting
        const { error } = await supabase
          .from('settings')
          .insert({ 
            key: settingKey,
            value: change.new_value 
          });

        if (!error) {
          appliedCount++;
          console.log(`Created setting: ${settingKey} = ${change.new_value}`);
        } else {
          console.error(`Failed to create setting ${settingKey}:`, error);
        }
      }
    }

    return appliedCount > 0;
  };

  const approveChanges = async (messageId: string, changes: ProposedChanges) => {
    if (changes.safety_level === 'not_allowed') {
      toast({
        title: 'Cannot Apply',
        description: 'This change violates security boundaries',
        variant: 'destructive',
      });
      return;
    }

    setIsApplying(true);

    try {
      // Create a version record - cast changes to JSON
      const changesAsJson = JSON.parse(JSON.stringify(changes));
      
      const { data: versionData, error: versionError } = await supabase
        .from('ai_change_versions')
        .insert({
          change_type: changes.change_type,
          change_description: changes.description,
          affected_areas: changes.affected_areas,
          changes_json: changesAsJson,
          applied_by: user?.id || '',
        })
        .select()
        .single();

      if (versionError) throw versionError;

      // Actually apply the changes to settings table
      const applied = await applySettingsChanges(changes);

      // Update the audit log
      await supabase
        .from('ai_audit_logs')
        .update({
          status: 'approved',
          version_id: versionData.id,
          proposed_changes: changesAsJson,
          resolved_at: new Date().toISOString(),
        })
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      if (applied && !changes.requires_code_change) {
        toast({
          title: 'Changes Applied Successfully',
          description: `Version ${versionData.version_number} created and settings updated.`,
        });
      } else if (changes.requires_code_change) {
        toast({
          title: 'Changes Logged',
          description: `Version ${versionData.version_number} created. Code changes require manual implementation.`,
        });
      } else {
        toast({
          title: 'Changes Approved',
          description: `Version ${versionData.version_number} created. Configuration changes logged.`,
        });
      }

      fetchVersions();
      fetchAuditLogs();
    } catch (error) {
      console.error('Error approving changes:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve changes',
        variant: 'destructive',
      });
    } finally {
      setIsApplying(false);
    }
  };

  const rejectChanges = async (messageId: string) => {
    await supabase
      .from('ai_audit_logs')
      .update({
        status: 'rejected',
        resolved_at: new Date().toISOString(),
      })
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1);

    toast({
      title: 'Changes Rejected',
      description: 'The proposed changes have been rejected',
    });

    fetchAuditLogs();
  };

  const rollbackVersion = async (versionId: string) => {
    const version = versions.find(v => v.id === versionId);
    
    if (!version) {
      toast({
        title: 'Error',
        description: 'Version not found',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Rollback settings changes if they were applied
      const changesJson = version.changes_json as unknown as ProposedChanges;
      if (changesJson?.changes) {
        for (const change of changesJson.changes) {
          if (change.current_value !== undefined) {
            const settingKey = change.target
              .replace(/\s+/g, '_')
              .toLowerCase()
              .replace(/setting[s]?:?\s*/i, '')
              .trim();

            if (settingKey) {
              await supabase
                .from('settings')
                .update({ 
                  value: change.current_value,
                  updated_at: new Date().toISOString()
                })
                .eq('key', settingKey);
            }
          }
        }
      }

      const { error } = await supabase
        .from('ai_change_versions')
        .update({
          is_active: false,
          rolled_back_at: new Date().toISOString(),
          rolled_back_by: user?.id,
        })
        .eq('id', versionId);

      if (error) throw error;

      toast({
        title: 'Version Rolled Back',
        description: 'The changes have been reverted successfully',
      });

      fetchVersions();
    } catch (error) {
      console.error('Rollback error:', error);
      toast({
        title: 'Error',
        description: 'Failed to rollback version',
        variant: 'destructive',
      });
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return {
    isAdmin,
    messages,
    isLoading,
    isApplying,
    settings,
    settingsLoading,
    versions,
    auditLogs,
    auditLogsLoading,
    auditFilter,
    setAuditFilter,
    toggleAIHelper,
    sendMessage,
    approveChanges,
    rejectChanges,
    rollbackVersion,
    clearChat,
    refreshAuditLogs: fetchAuditLogs,
  };
}
