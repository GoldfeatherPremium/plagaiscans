import { useEffect, useState, useRef, useCallback } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => void | Promise<void>;
  threshold?: number;
  maxPull?: number;
  enableHaptics?: boolean;
}

export const usePullToRefresh = ({
  onRefresh,
  threshold = 80,
  maxPull = 120,
  enableHaptics = true,
}: UsePullToRefreshOptions) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [showBounce, setShowBounce] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);
  const hasTriggeredHaptic = useRef(false);

  // Trigger haptic feedback
  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' = 'medium') => {
    if (!enableHaptics) return;
    
    // Check for Vibration API support
    if ('vibrate' in navigator) {
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [30, 10, 30],
      };
      navigator.vibrate(patterns[type]);
    }
  }, [enableHaptics]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Only enable pull-to-refresh when at the top of the page
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
      hasTriggeredHaptic.current = false;
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling || isRefreshing) return;
    
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    
    // Only allow pulling down
    if (diff > 0 && window.scrollY === 0) {
      // Apply resistance as user pulls further
      const resistance = 0.4;
      const pull = Math.min(diff * resistance, maxPull);
      setPullDistance(pull);
      
      // Trigger haptic when crossing threshold
      if (pull >= threshold && !hasTriggeredHaptic.current) {
        hasTriggeredHaptic.current = true;
        triggerHaptic('medium');
      } else if (pull < threshold && hasTriggeredHaptic.current) {
        hasTriggeredHaptic.current = false;
      }
      
      // Prevent default scrolling when pulling
      if (pull > 10) {
        e.preventDefault();
      }
    }
  }, [isPulling, isRefreshing, maxPull, threshold, triggerHaptic]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;
    
    setIsPulling(false);
    
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold); // Lock at threshold during refresh
      triggerHaptic('heavy'); // Strong haptic on refresh start
      
      try {
        await onRefresh();
      } finally {
        // Trigger bounce animation
        setShowBounce(true);
        triggerHaptic('light'); // Light haptic on complete
        
        // Animate out with bounce
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
          setTimeout(() => setShowBounce(false), 400);
        }, 300);
      }
    } else {
      // Snap back
      setPullDistance(0);
    }
  }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh, triggerHaptic]);

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    pullDistance,
    isRefreshing,
    isPulling,
    showBounce,
    pullProgress: Math.min((pullDistance / threshold) * 100, 100),
  };
};
