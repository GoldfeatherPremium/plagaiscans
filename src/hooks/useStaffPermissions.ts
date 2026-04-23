import { useQuery } from '@tanstack/react-query';
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

const adminPermissions: StaffPermissions = {
  can_edit_completed_documents: true,
  can_view_customer_info: true,
  can_add_remarks: true,
  can_batch_process: true,
  can_release_documents: true,
};

export function useStaffPermissions() {
  const { role } = useAuth();

  const { data: permissions = defaultPermissions, isLoading } = useQuery<StaffPermissions>({
    queryKey: ['staff-permissions', role],
    enabled: !!role,
    staleTime: 10 * 60 * 1000, // 10m — permissions change rarely
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      if (role === 'admin') return adminPermissions;

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
          return perms;
        }
      }
      return defaultPermissions;
    },
  });

  return { permissions, loading: isLoading };
}
