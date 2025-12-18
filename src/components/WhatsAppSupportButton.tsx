import React from 'react';
import { Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWhatsApp } from '@/hooks/useWhatsApp';

interface WhatsAppSupportButtonProps {
  className?: string;
}

export const WhatsAppSupportButton: React.FC<WhatsAppSupportButtonProps> = ({ className }) => {
  const { openWhatsAppSupport } = useWhatsApp();

  return (
    <Button
      onClick={() => openWhatsAppSupport()}
      className={`fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-[#25D366] hover:bg-[#128C7E] shadow-lg hover:shadow-xl transition-all duration-300 ${className}`}
      size="icon"
    >
      <Headphones className="h-6 w-6 text-white" />
    </Button>
  );
};
