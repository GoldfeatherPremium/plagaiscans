import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MaintenanceSettings {
  isEnabled: boolean;
  message: string;
}

export const MaintenanceBanner: React.FC = () => {
  const [settings, setSettings] = useState<MaintenanceSettings | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetchMaintenanceSettings();
  }, []);

  const fetchMaintenanceSettings = async () => {
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['maintenance_mode_enabled', 'maintenance_message']);

    if (data) {
      const enabled = data.find(s => s.key === 'maintenance_mode_enabled');
      const message = data.find(s => s.key === 'maintenance_message');
      
      setSettings({
        isEnabled: enabled?.value === 'true',
        message: message?.value || 'We are currently under maintenance. Some features may be unavailable.'
      });
    }
  };

  if (!settings?.isEnabled || dismissed) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3">
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            {settings.message}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-amber-500 hover:text-amber-700"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
