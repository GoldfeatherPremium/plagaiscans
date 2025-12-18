import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useWhatsApp = () => {
  const { user, profile } = useAuth();
  const [whatsappNumber, setWhatsappNumber] = useState<string>('+447360536649');

  useEffect(() => {
    const fetchWhatsAppNumber = async () => {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'whatsapp_number')
        .maybeSingle();
      
      if (data?.value) {
        setWhatsappNumber(data.value.trim());
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
    
    // Create a temporary anchor element to bypass iframe restrictions
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return { whatsappNumber, openWhatsApp };
};
