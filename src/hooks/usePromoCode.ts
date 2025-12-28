import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface PromoCodeResult {
  isValid: boolean;
  creditsBonus: number;
  discountPercentage: number;
  code: string;
  promoId: string;
}

export const usePromoCode = () => {
  const { user } = useAuth();
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<PromoCodeResult | null>(null);

  const validatePromoCode = async (code: string): Promise<PromoCodeResult | null> => {
    if (!code.trim()) {
      toast.error('Please enter a promo code');
      return null;
    }

    if (!user) {
      toast.error('Please login to use promo codes');
      return null;
    }

    setValidatingPromo(true);
    try {
      // Check if promo code exists and is valid
      const { data: promo, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', code.toUpperCase().trim())
        .eq('is_active', true)
        .single();

      if (error || !promo) {
        toast.error('Invalid promo code');
        return null;
      }

      // Check validity dates
      const now = new Date();
      if (promo.valid_from && new Date(promo.valid_from) > now) {
        toast.error('This promo code is not yet active');
        return null;
      }
      if (promo.valid_until && new Date(promo.valid_until) < now) {
        toast.error('This promo code has expired');
        return null;
      }

      // Check max uses
      if (promo.max_uses && promo.current_uses >= promo.max_uses) {
        toast.error('This promo code has reached its usage limit');
        return null;
      }

      // Check if user has already used this code
      const { data: existingUse } = await supabase
        .from('promo_code_uses')
        .select('id')
        .eq('promo_code_id', promo.id)
        .eq('user_id', user.id)
        .single();

      if (existingUse) {
        toast.error('You have already used this promo code');
        return null;
      }

      const result: PromoCodeResult = {
        isValid: true,
        creditsBonus: promo.credits_bonus || 0,
        discountPercentage: promo.discount_percentage || 0,
        code: promo.code,
        promoId: promo.id,
      };

      setAppliedPromo(result);
      toast.success(`Promo code applied! ${result.discountPercentage > 0 ? `${result.discountPercentage}% discount` : ''} ${result.creditsBonus > 0 ? `+${result.creditsBonus} bonus credits` : ''}`);
      return result;
    } catch (err) {
      console.error('Promo validation error:', err);
      toast.error('Failed to validate promo code');
      return null;
    } finally {
      setValidatingPromo(false);
    }
  };

  const recordPromoUse = async (creditsGiven: number) => {
    if (!appliedPromo || !user) return;

    try {
      // Record the promo usage
      await supabase.from('promo_code_uses').insert({
        promo_code_id: appliedPromo.promoId,
        user_id: user.id,
        credits_given: creditsGiven,
      });

      // Increment current uses
      await supabase.rpc('increment_promo_uses', { promo_id: appliedPromo.promoId });
    } catch (err) {
      console.error('Failed to record promo use:', err);
    }
  };

  const clearPromo = () => {
    setAppliedPromo(null);
  };

  const calculateDiscountedTotal = (baseTotal: number): number => {
    if (!appliedPromo || appliedPromo.discountPercentage <= 0) return baseTotal;
    const discount = baseTotal * (appliedPromo.discountPercentage / 100);
    return Math.round((baseTotal - discount) * 100) / 100;
  };

  const getTotalBonusCredits = (): number => {
    return appliedPromo?.creditsBonus || 0;
  };

  return {
    validatingPromo,
    appliedPromo,
    validatePromoCode,
    recordPromoUse,
    clearPromo,
    calculateDiscountedTotal,
    getTotalBonusCredits,
  };
};
