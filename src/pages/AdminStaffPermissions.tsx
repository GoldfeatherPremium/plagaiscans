import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Shield, Loader2, Save, Info } from 'lucide-react';

interface StaffPermission {
  id: string;
  permission_key: string;
  permission_name: string;
  description: string | null;
  is_enabled: boolean;
}

export default function AdminStaffPermissions() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState<StaffPermission[]>([]);
  const [changes, setChanges] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    const { data, error } = await supabase
      .from('staff_permissions')
      .select('*')
      .order('permission_name');

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch permissions',
        variant: 'destructive',
      });
    } else {
      setPermissions(data || []);
    }
    setLoading(false);
  };

  const handleToggle = (permissionKey: string, currentValue: boolean) => {
    setChanges(prev => ({
      ...prev,
      [permissionKey]: !currentValue,
    }));
    
    setPermissions(prev => prev.map(p => 
      p.permission_key === permissionKey 
        ? { ...p, is_enabled: !currentValue }
        : p
    ));
  };

  const hasChanges = Object.keys(changes).length > 0;

  const saveChanges = async () => {
    if (!hasChanges) return;

    setSaving(true);
    try {
      for (const [permissionKey, isEnabled] of Object.entries(changes)) {
        const { error } = await supabase
          .from('staff_permissions')
          .update({ is_enabled: isEnabled })
          .eq('permission_key', permissionKey);

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: 'Staff permissions updated',
      });
      setChanges({});
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save permissions',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Staff Permissions</h1>
            <p className="text-muted-foreground mt-1">
              Control what actions staff members can perform
            </p>
          </div>
          {hasChanges && (
            <Button onClick={saveChanges} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Permission Settings
            </CardTitle>
            <CardDescription>
              Toggle permissions on or off for all staff members
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {permissions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No permissions configured</p>
              </div>
            ) : (
              permissions.map((permission) => (
                <div 
                  key={permission.id}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                    permission.permission_key in changes 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{permission.permission_name}</p>
                      {permission.permission_key in changes && (
                        <span className="text-xs text-primary">(unsaved)</span>
                      )}
                    </div>
                    {permission.description && (
                      <p className="text-sm text-muted-foreground flex items-start gap-1">
                        <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        {permission.description}
                      </p>
                    )}
                  </div>
                  <Switch
                    checked={permission.is_enabled}
                    onCheckedChange={() => handleToggle(permission.permission_key, permission.is_enabled)}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-amber-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-700 dark:text-amber-400">About Permissions</p>
                <p className="text-muted-foreground mt-1">
                  These settings apply to all staff members. Admins always have full access regardless of these settings.
                  Changes take effect immediately after saving.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
