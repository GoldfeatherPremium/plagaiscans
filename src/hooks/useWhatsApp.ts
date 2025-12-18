import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useWhatsApp = () => {
  const { user, profile } = useAuth();
  const [whatsappNumber, setWhatsappNumber] = useState<string>('+1234567890');

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

  const openWhatsApp = (credits?: number) => {
    const message = encodeURIComponent(
      `Hello, I want to buy credits.\nUser ID: ${user?.id || 'Not logged in'}\nEmail: ${profile?.email || 'Not logged in'}\nRequested Credits: ${credits || '___'}`
    );
    
    const cleanNumber = whatsappNumber.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanNumber}?text=${message}`;
    window.open(url, '_blank');
  };

  return { whatsappNumber, openWhatsApp };
};