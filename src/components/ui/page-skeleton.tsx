import * as React from "react";
import { cn } from "@/lib/utils";
import { Shimmer, ShimmerCard } from "./shimmer";

interface PageSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'dashboard' | 'documents' | 'default';
}

const PageSkeleton = React.forwardRef<HTMLDivElement, PageSkeletonProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("min-h-screen bg-background p-8 pt-24 animate-pulse", className)}
        {...props}
      >
        {variant === 'dashboard' && <DashboardSkeleton />}
        {variant === 'documents' && <DocumentsSkeleton />}
        {variant === 'default' && <DefaultSkeleton />}
      </div>
    );
  }
);
PageSkeleton.displayName = "PageSkeleton";

const DashboardSkeleton = () => (
  <div className="space-y-8 max-w-7xl mx-auto">
    {/* Header */}
    <div className="space-y-2">
      <Shimmer className="h-9 w-64" />
      <Shimmer className="h-5 w-96" />
    </div>

    {/* Stats Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-4">
            <Shimmer className="h-12 w-12 rounded-lg" />
            <div className="space-y-2">
              <Shimmer className="h-4 w-20" />
              <Shimmer className="h-8 w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>

    {/* Quick Actions */}
    <div className="grid md:grid-cols-2 gap-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-4">
            <Shimmer className="h-14 w-14 rounded-xl" />
            <div className="space-y-2">
              <Shimmer className="h-5 w-32" />
              <Shimmer className="h-4 w-48" />
            </div>
          </div>
        </div>
      ))}
    </div>

    {/* Recent Documents Table */}
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Shimmer className="h-6 w-40" />
            <Shimmer className="h-4 w-32" />
          </div>
          <Shimmer className="h-9 w-20 rounded" />
        </div>
      </div>
      <div className="divide-y">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4 flex items-center gap-4">
            <Shimmer className="h-4 w-8" />
            <Shimmer className="h-4 w-4 rounded" />
            <Shimmer className="h-4 flex-1 max-w-[200px]" />
            <Shimmer className="h-4 w-20" />
            <Shimmer className="h-6 w-16 rounded-full" />
            <Shimmer className="h-8 w-8 rounded" />
            <Shimmer className="h-8 w-8 rounded" />
            <Shimmer className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const DocumentsSkeleton = () => (
  <div className="space-y-6 max-w-7xl mx-auto">
    {/* Header */}
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="space-y-2">
        <Shimmer className="h-9 w-48" />
        <Shimmer className="h-5 w-72" />
      </div>
      <div className="flex items-center gap-2">
        <Shimmer className="h-9 w-32 rounded" />
        <Shimmer className="h-9 w-40 rounded" />
      </div>
    </div>

    {/* Search Filters */}
    <div className="flex flex-wrap gap-4">
      <Shimmer className="h-10 w-64 rounded" />
      <Shimmer className="h-10 w-32 rounded" />
      <Shimmer className="h-10 w-36 rounded" />
      <Shimmer className="h-10 w-36 rounded" />
    </div>

    {/* Documents Table */}
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Table Header */}
      <div className="flex items-center gap-4 p-4 border-b bg-muted/50">
        <Shimmer className="h-4 w-4 rounded" />
        <Shimmer className="h-4 w-4" />
        <Shimmer className="h-4 w-8" />
        <Shimmer className="h-4 flex-1" />
        <Shimmer className="h-4 w-16" />
        <Shimmer className="h-4 w-24" />
        <Shimmer className="h-4 w-16" />
        <Shimmer className="h-4 w-20" />
        <Shimmer className="h-4 w-16" />
        <Shimmer className="h-4 w-24" />
        <Shimmer className="h-4 w-24" />
        <Shimmer className="h-4 w-20" />
      </div>
      
      {/* Table Rows */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div 
          key={i} 
          className="flex items-center gap-4 p-4 border-b last:border-b-0"
          style={{ opacity: 1 - (i * 0.08) }}
        >
          <Shimmer className="h-4 w-4 rounded" />
          <Shimmer className="h-4 w-4" />
          <Shimmer className="h-4 w-8" />
          <Shimmer className="h-4 w-40" />
          <Shimmer className="h-6 w-16 rounded-full" />
          <Shimmer className="h-4 w-20" />
          <Shimmer className="h-6 w-16 rounded-full" />
          <Shimmer className="h-4 w-12" />
          <Shimmer className="h-4 w-12" />
          <Shimmer className="h-8 w-8 rounded" />
          <Shimmer className="h-8 w-8 rounded" />
          <Shimmer className="h-4 w-20" />
        </div>
      ))}
    </div>
  </div>
);

const DefaultSkeleton = () => (
  <div className="space-y-6 max-w-7xl mx-auto">
    {/* Header */}
    <div className="space-y-2">
      <Shimmer className="h-9 w-48" />
      <Shimmer className="h-5 w-64" />
    </div>

    {/* Content Cards */}
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <ShimmerCard key={i} lines={3} showAvatar />
      ))}
    </div>
  </div>
);

// Stat Card Skeleton for inline use
const StatCardSkeleton = ({ className }: { className?: string }) => (
  <div className={cn("rounded-lg border bg-card p-6", className)}>
    <div className="flex items-center gap-4">
      <Shimmer className="h-12 w-12 rounded-lg" />
      <div className="space-y-2">
        <Shimmer className="h-4 w-20" />
        <Shimmer className="h-8 w-12" />
      </div>
    </div>
  </div>
);

// Table Row Skeleton for inline use
const TableRowSkeleton = ({ columns = 8, className }: { columns?: number; className?: string }) => (
  <div className={cn("flex items-center gap-4 p-4", className)}>
    {Array.from({ length: columns }).map((_, i) => (
      <Shimmer key={i} className="h-4 flex-1" />
    ))}
  </div>
);

export { PageSkeleton, DashboardSkeleton, DocumentsSkeleton, DefaultSkeleton, StatCardSkeleton, TableRowSkeleton };
