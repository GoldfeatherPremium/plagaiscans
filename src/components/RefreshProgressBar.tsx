import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export const RefreshProgressBar = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const location = useLocation();

  useEffect(() => {
    // Start loading on route change
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

    // Complete loading after a short delay
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

  if (!isLoading && progress === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
      {/* Dynamic Island Container */}
      <div 
        className="relative bg-black/90 backdrop-blur-xl rounded-full overflow-hidden shadow-2xl shadow-primary/20 transition-all duration-500 ease-out"
        style={{
          width: isLoading ? '180px' : '120px',
          height: '32px',
          opacity: isLoading || progress > 0 ? 1 : 0,
          transform: `scale(${isLoading || progress > 0 ? 1 : 0.8})`,
        }}
      >
        {/* Inner glow effect */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/10 to-transparent" />
        
        {/* Progress bar track */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          {/* Progress bar fill */}
          <div 
            className="h-full bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 transition-all duration-200 ease-out"
            style={{ 
              width: `${Math.min(progress, 100)}%`,
              boxShadow: '0 0 10px rgba(59, 130, 246, 0.8), 0 0 20px rgba(59, 130, 246, 0.4)'
            }}
          />
        </div>

        {/* Loading text/indicator */}
        <div className="flex items-center justify-center h-full px-4 gap-2">
          {/* Animated dots */}
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
          
          {/* Progress percentage */}
          <span className="text-xs font-medium text-white/80 tabular-nums min-w-[32px] text-right">
            {Math.round(Math.min(progress, 100))}%
          </span>
        </div>
      </div>
    </div>
  );
};
