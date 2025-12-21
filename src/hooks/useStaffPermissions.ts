import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface StaffPermissions {
  can_edit_completed_documents: boolean;
  can_view_customer_info: boolean;
  can_add_remarks: boolean;
  can_batch_process: boolean;
  can_release_documents: boolean;
}

const defaultPermissions: StaffPermissions = {
  can_edit_completed_documents: false,
  can_view_customer_info: true,
  can_add_remarks: true,
  can_batch_process: true,
  can_release_documents: true,
};

export function useStaffPermissions() {
  const { role } = useAuth();
  const [permissions, setPermissions] = useState<StaffPermissions>(defaultPermissions);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      // Admins have all permissions
      if (role === 'admin') {
        setPermissions({
          can_edit_completed_documents: true,
          can_view_customer_info: true,
          can_add_remarks: true,
          can_batch_process: true,
          can_release_documents: true,
        });
        setLoading(false);
        return;
      }

      // Staff gets permissions from database
      if (role === 'staff') {
        const { data, error } = await supabase
          .from('staff_permissions')
          .select('permission_key, is_enabled');

        if (!error && data) {
          const perms: StaffPermissions = { ...defaultPermissions };
          data.forEach(p => {
            const key = p.permission_key as keyof StaffPermissions;
            if (key in perms) {
              perms[key] = p.is_enabled;
            }
          });
          setPermissions(perms);
        }
      }
      
      setLoading(false);
    };

    fetchPermissions();
  }, [role]);

  return { permissions, loading };
}
