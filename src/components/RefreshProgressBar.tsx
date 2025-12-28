import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useQueryClient } from '@tanstack/react-query';

export const RefreshProgressBar = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const location = useLocation();
  const queryClient = useQueryClient();

  // Handle page refresh
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    setProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 100);

    // Invalidate all queries to refresh data
    await queryClient.invalidateQueries();

    // Complete the progress
    clearInterval(progressInterval);
    setProgress(100);

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setIsLoading(false);
        setProgress(0);
        resolve();
      }, 300);
    });
  }, [queryClient]);

  // Pull to refresh hook
  const { pullDistance, isRefreshing, pullProgress, showBounce } = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
    maxPull: 120,
    enableHaptics: true,
  });

  // Route change loading
  useEffect(() => {
    setIsLoading(true);
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 100);

    const completeTimeout = setTimeout(() => {
      setProgress(100);
      setTimeout(() => {
        setIsLoading(false);
        setProgress(0);
      }, 300);
    }, 400);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(completeTimeout);
    };
  }, [location.pathname]);

  // Determine what to show
  const showPullIndicator = pullDistance > 0 || isRefreshing;
  const showLoadingBar = isLoading && !showPullIndicator;
  const currentProgress = showPullIndicator ? pullProgress : progress;
  const isActive = showPullIndicator || showLoadingBar;

  if (!isActive) return null;

  return (
    <div 
      className="fixed left-1/2 -translate-x-1/2 z-[100] pointer-events-none transition-all duration-300 ease-out"
      style={{
        top: showPullIndicator ? `${Math.max(16, pullDistance - 40)}px` : '16px',
      }}
    >
      {/* Dynamic Island Container */}
      <div 
        className={`relative bg-black/90 backdrop-blur-xl rounded-full overflow-hidden shadow-2xl shadow-primary/20 transition-all duration-300 ease-out ${showBounce ? 'animate-bounce-success' : ''}`}
        style={{
          width: isActive ? '180px' : '120px',
          height: '32px',
          opacity: isActive ? 1 : 0,
          transform: `scale(${isActive ? 1 : 0.8})`,
        }}
      >
        {/* Success glow effect on bounce */}
        {showBounce && (
          <div className="absolute inset-0 rounded-full bg-green-500/30 animate-pulse" />
        )}
        
        {/* Inner glow effect */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/10 to-transparent" />
        
        {/* Progress bar track */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          {/* Progress bar fill */}
          <div 
            className={`h-full transition-all duration-200 ease-out ${showBounce ? 'bg-gradient-to-r from-green-400 via-green-500 to-green-600' : 'bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600'}`}
            style={{ 
              width: `${Math.min(currentProgress, 100)}%`,
              boxShadow: showBounce 
                ? '0 0 10px rgba(34, 197, 94, 0.8), 0 0 20px rgba(34, 197, 94, 0.4)'
                : '0 0 10px rgba(59, 130, 246, 0.8), 0 0 20px rgba(59, 130, 246, 0.4)'
            }}
          />
        </div>

        {/* Loading/Pull indicator */}
        <div className="flex items-center justify-center h-full px-4 gap-2">
          {showBounce ? (
            <>
              {/* Success checkmark */}
              <svg 
                className="w-4 h-4 text-green-400"
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-xs font-medium text-green-400">
                Refreshed!
              </span>
            </>
          ) : showPullIndicator && !isRefreshing ? (
            <>
              {/* Pull arrow indicator */}
              <svg 
                className="w-4 h-4 text-blue-400 transition-transform duration-200"
                style={{ 
                  transform: `rotate(${pullProgress >= 100 ? 180 : 0}deg)`,
                }}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <span className="text-xs font-medium text-white/80">
                {pullProgress >= 100 ? 'Release' : 'Pull down'}
              </span>
            </>
          ) : (
            <>
              {/* Animated dots */}
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '300ms' }} />
              </div>
              
              {/* Progress percentage */}
              <span className="text-xs font-medium text-white/80 tabular-nums min-w-[32px] text-right">
                {Math.round(Math.min(currentProgress, 100))}%
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
