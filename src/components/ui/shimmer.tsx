import * as React from "react";
import { cn } from "@/lib/utils";

interface ShimmerProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const Shimmer = React.forwardRef<HTMLDivElement, ShimmerProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-md bg-muted",
          "before:absolute before:inset-0",
          "before:-translate-x-full before:animate-shimmer",
          "before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent",
          className
        )}
        {...props}
      />
    );
  }
);
Shimmer.displayName = "Shimmer";

interface ShimmerCardProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number;
  showAvatar?: boolean;
  showImage?: boolean;
}

const ShimmerCard = React.forwardRef<HTMLDivElement, ShimmerCardProps>(
  ({ className, lines = 3, showAvatar = false, showImage = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border bg-card p-4 space-y-4",
          className
        )}
        {...props}
      >
        {showImage && (
          <Shimmer className="h-40 w-full rounded-lg" />
        )}
        
        <div className="flex items-center gap-3">
          {showAvatar && (
            <Shimmer className="h-10 w-10 rounded-full flex-shrink-0" />
          )}
          <div className="flex-1 space-y-2">
            <Shimmer className="h-4 w-3/4" />
            <Shimmer className="h-3 w-1/2" />
          </div>
        </div>
        
        <div className="space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <Shimmer 
              key={i} 
              className="h-3" 
              style={{ width: `${100 - (i * 15)}%` }}
            />
          ))}
        </div>
      </div>
    );
  }
);
ShimmerCard.displayName = "ShimmerCard";

interface ShimmerTextProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string;
  height?: string;
}

const ShimmerText = React.forwardRef<HTMLDivElement, ShimmerTextProps>(
  ({ className, width = "100%", height = "1rem", style, ...props }, ref) => {
    return (
      <Shimmer
        ref={ref}
        className={cn("rounded", className)}
        style={{ width, height, ...style }}
        {...props}
      />
    );
  }
);
ShimmerText.displayName = "ShimmerText";

interface ShimmerTableProps extends React.HTMLAttributes<HTMLDivElement> {
  rows?: number;
  columns?: number;
}

const ShimmerTable = React.forwardRef<HTMLDivElement, ShimmerTableProps>(
  ({ className, rows = 5, columns = 4, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("rounded-lg border bg-card overflow-hidden", className)}
        {...props}
      >
        {/* Header */}
        <div className="flex gap-4 p-4 border-b bg-muted/50">
          {Array.from({ length: columns }).map((_, i) => (
            <Shimmer key={i} className="h-4 flex-1" />
          ))}
        </div>
        
        {/* Rows */}
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div 
            key={rowIndex} 
            className="flex gap-4 p-4 border-b last:border-b-0"
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Shimmer 
                key={colIndex} 
                className="h-4 flex-1"
                style={{ opacity: 1 - (rowIndex * 0.1) }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }
);
ShimmerTable.displayName = "ShimmerTable";

interface ShimmerListProps extends React.HTMLAttributes<HTMLDivElement> {
  items?: number;
  showIcon?: boolean;
}

const ShimmerList = React.forwardRef<HTMLDivElement, ShimmerListProps>(
  ({ className, items = 5, showIcon = true, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("space-y-3", className)}
        {...props}
      >
        {Array.from({ length: items }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
            {showIcon && (
              <Shimmer className="h-8 w-8 rounded-full flex-shrink-0" />
            )}
            <div className="flex-1 space-y-2">
              <Shimmer className="h-4 w-2/3" />
              <Shimmer className="h-3 w-1/2" />
            </div>
            <Shimmer className="h-8 w-16 rounded" />
          </div>
        ))}
      </div>
    );
  }
);
ShimmerList.displayName = "ShimmerList";

export { Shimmer, ShimmerCard, ShimmerText, ShimmerTable, ShimmerList };
