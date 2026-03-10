import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ZoomIn, Shield, Database, Globe } from 'lucide-react';

interface SampleReportPreviewProps {
  compact?: boolean;
  className?: string;
}

const SampleReportPreview: React.FC<SampleReportPreviewProps> = ({ compact = false, className = '' }) => {
  return (
    <div className={className}>
      <Dialog>
        <DialogTrigger asChild>
          <Card className="cursor-pointer group overflow-hidden border-border hover:border-primary/40 transition-all duration-300">
            <CardContent className="p-0 relative">
              <div className="relative overflow-hidden">
                <img
                  src="/sample-report.png"
                  alt="Sample similarity analysis report showing highlighted text matches, AI writing detection, and source breakdown"
                  className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-6">
                  <div className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium">
                    <ZoomIn className="w-4 h-4" />
                    Click to expand
                  </div>
                </div>
              </div>
              {!compact && (
                <div className="p-4 bg-card">
                  <p className="text-sm font-medium text-foreground">Sample Similarity & AI Detection Report</p>
                  <p className="text-xs text-muted-foreground mt-1">Automated analysis with highlighted matches and source references</p>
                </div>
              )}
            </CardContent>
          </Card>
        </DialogTrigger>
        <DialogContent className="max-w-5xl w-[95vw] p-1 sm:p-2">
          <img
            src="/sample-report.png"
            alt="Full sample similarity analysis report"
            className="w-full h-auto rounded-lg"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export const TrustBadges: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex flex-wrap items-center justify-center gap-3 ${className}`}>
    <Badge variant="secondary" className="flex items-center gap-1.5 px-3 py-1.5 text-xs">
      <Database className="w-3.5 h-3.5" />
      Billions of Sources Indexed
    </Badge>
    <Badge variant="secondary" className="flex items-center gap-1.5 px-3 py-1.5 text-xs">
      <Globe className="w-3.5 h-3.5" />
      Industry-Leading Detection
    </Badge>
    <Badge variant="secondary" className="flex items-center gap-1.5 px-3 py-1.5 text-xs">
      <Shield className="w-3.5 h-3.5" />
      AI Writing Analysis
    </Badge>
  </div>
);

export default SampleReportPreview;
