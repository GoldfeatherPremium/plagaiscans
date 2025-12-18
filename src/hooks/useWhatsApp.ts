import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useWhatsApp = () => {
  const { user, profile } = useAuth();
  const [whatsappNumber, setWhatsappNumber] = useState<string>('');

  useEffect(() => {
    const fetchWhatsAppNumber = async () => {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'whatsapp_number')
        .maybeSingle();
      
      if (data?.value) {
        setWhatsappNumber(data.value);
      }
    };

    fetchWhatsAppNumber();
  }, []);

  const openWhatsApp = useCallback((credits?: number) => {
    const numberToUse = whatsappNumber || '+447360536649';
    const message = encodeURIComponent(
      `Hello, I want to buy credits.\nUser ID: ${user?.id || 'Not logged in'}\nEmail: ${profile?.email || 'Not logged in'}\nRequested Credits: ${credits || '___'}`
    );
    
    const cleanNumber = numberToUse.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanNumber}?text=${message}`;
    
    // Use window.location.href as fallback if window.open is blocked
    const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      window.location.href = url;
    }
  }, [whatsappNumber, user?.id, profile?.email]);

  return { whatsappNumber, openWhatsApp };
};