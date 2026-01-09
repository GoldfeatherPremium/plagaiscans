import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';
import {
  findMatchCandidates,
  MatchCandidate,
  getConfidenceBadgeVariant,
} from '@/utils/filenameMatching';

interface DocumentSuggestionsProps {
  reportFilename: string;
  reportNormalizedKey: string;
  documents: Array<{
    id: string;
    file_name: string;
    normalized_filename: string | null;
  }>;
  onAssign: (documentId: string) => void;
  isLoading?: boolean;
  maxSuggestions?: number;
}

export function DocumentSuggestions({
  reportFilename,
  reportNormalizedKey,
  documents,
  onAssign,
  isLoading,
  maxSuggestions = 5,
}: DocumentSuggestionsProps) {
  const candidates = React.useMemo(() => {
    const pendingDocs = documents.map((d) => ({
      id: d.id,
      file_name: d.file_name,
      normalized_filename: d.normalized_filename,
      status: 'pending',
    }));
    return findMatchCandidates(reportFilename, pendingDocs, 40).slice(0, maxSuggestions);
  }, [reportFilename, documents, maxSuggestions]);

  if (candidates.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        No similar documents found for "{reportNormalizedKey}"
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Suggested matches for: <span className="font-mono">{reportNormalizedKey}</span>
      </p>
      <div className="space-y-1">
        {candidates.map((candidate) => (
          <div
            key={candidate.id}
            className={`flex items-center justify-between p-2 rounded-lg border ${
              candidate.matchType === 'exact'
                ? 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/30'
                : 'border-border'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {candidate.matchType === 'exact' && (
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm truncate">{candidate.fileName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  Key: {candidate.normalizedFilename}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={getConfidenceBadgeVariant(candidate.confidence)}>
                {candidate.confidence}%
              </Badge>
              <Button
                size="sm"
                variant={candidate.matchType === 'exact' ? 'default' : 'outline'}
                onClick={() => onAssign(candidate.id)}
                disabled={isLoading}
              >
                Assign
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
