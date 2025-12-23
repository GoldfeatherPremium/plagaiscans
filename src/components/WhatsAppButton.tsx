import React from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWhatsApp } from '@/hooks/useWhatsApp';

interface WhatsAppButtonProps {
  className?: string;
}

export const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({ className }) => {
  const { openWhatsApp } = useWhatsApp();

  return (
    <Button
      onClick={() => openWhatsApp()}
      className={`fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-[#25D366] hover:bg-[#128C7E] shadow-lg hover:shadow-xl transition-all duration-300 ${className}`}
      size="icon"
      aria-label="Contact us on WhatsApp"
    >
      <MessageCircle className="h-6 w-6 text-white" />
    </Button>
  );
};