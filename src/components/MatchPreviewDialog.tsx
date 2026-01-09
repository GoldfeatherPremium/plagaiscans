import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import {
  MatchPreview,
  PendingDocument,
  previewMatches,
  getConfidenceBadgeVariant,
} from '@/utils/filenameMatching';

interface MatchPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportFilenames: string[];
  documents: PendingDocument[];
  onConfirm: (assignments: Map<string, string>) => void;
  isProcessing?: boolean;
}

export function MatchPreviewDialog({
  open,
  onOpenChange,
  reportFilenames,
  documents,
  onConfirm,
  isProcessing,
}: MatchPreviewDialogProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [manualAssignments, setManualAssignments] = useState<Map<string, string>>(new Map());

  const previews = useMemo(() => {
    return previewMatches(reportFilenames, documents);
  }, [reportFilenames, documents]);

  const stats = useMemo(() => {
    return {
      exact: previews.filter((p) => p.status === 'exact').length,
      partial: previews.filter((p) => p.status === 'partial').length,
      none: previews.filter((p) => p.status === 'none').length,
    };
  }, [previews]);

  const toggleRow = (index: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleManualAssign = (reportName: string, documentId: string) => {
    setManualAssignments((prev) => {
      const next = new Map(prev);
      if (documentId === 'none') {
        next.delete(reportName);
      } else {
        next.set(reportName, documentId);
      }
      return next;
    });
  };

  const getAssignment = (preview: MatchPreview): string | null => {
    // Check manual assignment first
    if (manualAssignments.has(preview.reportName)) {
      return manualAssignments.get(preview.reportName)!;
    }
    // Use auto-matched document
    if (preview.matchedDocument) {
      return preview.matchedDocument.id;
    }
    return null;
  };

  const handleConfirm = () => {
    const assignments = new Map<string, string>();
    for (const preview of previews) {
      const assignment = getAssignment(preview);
      if (assignment) {
        assignments.set(preview.reportName, assignment);
      }
    }
    onConfirm(assignments);
  };

  const assignedCount = previews.filter((p) => getAssignment(p) !== null).length;

  const getStatusIcon = (status: 'exact' | 'partial' | 'none') => {
    switch (status) {
      case 'exact':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'partial':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'none':
        return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Match Preview</DialogTitle>
          <DialogDescription>
            Review matches before processing. You can manually assign unmatched reports.
          </DialogDescription>
        </DialogHeader>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-300">{stats.exact} Exact</p>
              <p className="text-xs text-green-600 dark:text-green-400">Auto-matched</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-900">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">{stats.partial} Partial</p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400">Review suggested</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900">
            <XCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-300">{stats.none} No Match</p>
              <p className="text-xs text-red-600 dark:text-red-400">Manual assign needed</p>
            </div>
          </div>
        </div>

        {/* Match List */}
        <ScrollArea className="h-[400px] border rounded-lg">
          <div className="p-2 space-y-1">
            {previews.map((preview, index) => {
              const isExpanded = expandedRows.has(index);
              const currentAssignment = getAssignment(preview);
              const hasManualOverride = manualAssignments.has(preview.reportName);

              return (
                <div
                  key={index}
                  className={`border rounded-lg overflow-hidden ${
                    preview.status === 'exact'
                      ? 'border-green-200 dark:border-green-900'
                      : preview.status === 'partial'
                      ? 'border-yellow-200 dark:border-yellow-900'
                      : 'border-red-200 dark:border-red-900'
                  }`}
                >
                  {/* Main Row */}
                  <div
                    className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 ${
                      preview.status === 'exact'
                        ? 'bg-green-50/50 dark:bg-green-950/20'
                        : preview.status === 'partial'
                        ? 'bg-yellow-50/50 dark:bg-yellow-950/20'
                        : 'bg-red-50/50 dark:bg-red-950/20'
                    }`}
                    onClick={() => toggleRow(index)}
                  >
                    {getStatusIcon(preview.status)}
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{preview.reportName}</p>
                      <p className="text-xs text-muted-foreground">Key: {preview.normalizedKey}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {currentAssignment ? (
                        <>
                          <span className="text-xs text-muted-foreground">→</span>
                          <div className="text-right">
                            <p className="text-sm truncate max-w-[200px]">
                              {documents.find((d) => d.id === currentAssignment)?.file_name || 'Unknown'}
                            </p>
                            {preview.matchedDocument && !hasManualOverride && (
                              <Badge variant={getConfidenceBadgeVariant(preview.matchedDocument.confidence)} className="text-xs">
                                {preview.matchedDocument.confidence}% match
                              </Badge>
                            )}
                            {hasManualOverride && (
                              <Badge variant="secondary" className="text-xs">
                                Manual
                              </Badge>
                            )}
                          </div>
                        </>
                      ) : (
                        <span className="text-sm text-red-600">No assignment</span>
                      )}

                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="p-3 border-t bg-background space-y-3">
                      {/* Manual Assignment */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          Assign to Document:
                        </label>
                        <Select
                          value={currentAssignment || 'none'}
                          onValueChange={(v) => handleManualAssign(preview.reportName, v)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select document..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Don't assign —</SelectItem>
                            {documents.map((doc) => (
                              <SelectItem key={doc.id} value={doc.id}>
                                <div className="flex flex-col">
                                  <span className="truncate">{doc.file_name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    Key: {doc.normalized_filename}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Suggestions */}
                      {preview.suggestions.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            Other suggestions:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {preview.suggestions.map((suggestion) => (
                              <Button
                                key={suggestion.id}
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={() => handleManualAssign(preview.reportName, suggestion.id)}
                              >
                                {suggestion.fileName.substring(0, 25)}...
                                <Badge variant="secondary" className="ml-1 text-xs">
                                  {suggestion.confidence}%
                                </Badge>
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="text-sm text-muted-foreground">
            {assignedCount} of {previews.length} reports will be processed
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={isProcessing || assignedCount === 0}>
              {isProcessing ? 'Processing...' : `Upload & Process (${assignedCount})`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
