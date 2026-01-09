/**
 * Filename matching utilities for bulk report processing
 * Provides fuzzy matching with confidence scores
 */

export interface MatchCandidate {
  id: string;
  fileName: string;
  normalizedFilename: string;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'none';
}

export interface MatchPreview {
  reportName: string;
  normalizedKey: string;
  matchedDocument: MatchCandidate | null;
  suggestions: MatchCandidate[];
  status: 'exact' | 'partial' | 'none';
}

export interface PendingDocument {
  id: string;
  file_name: string;
  normalized_filename: string | null;
  status: string;
}

/**
 * Normalize filename for matching:
 * - Remove extension
 * - Remove trailing (1), (2), etc.
 * - Lowercase and trim
 */
export function normalizeFilename(filename: string): string {
  let result = filename.toLowerCase();
  result = result.replace(/\.[^.]+$/, ''); // Remove extension
  result = result.replace(/\s*\(\d+\)$/, ''); // Remove trailing (1), (2)
  result = result.replace(/\s+/g, ' ').trim(); // Normalize whitespace
  return result;
}

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity percentage between two strings (0-100)
 */
export function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 100;
  if (a.length === 0 || b.length === 0) return 0;
  
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  const similarity = ((maxLength - distance) / maxLength) * 100;
  
  return Math.round(similarity);
}

/**
 * Find matching candidates for a report filename from a list of documents
 */
export function findMatchCandidates(
  reportFilename: string,
  documents: PendingDocument[],
  minConfidence: number = 60
): MatchCandidate[] {
  const normalizedReport = normalizeFilename(reportFilename);
  const candidates: MatchCandidate[] = [];

  for (const doc of documents) {
    const docNormalized = doc.normalized_filename || normalizeFilename(doc.file_name);
    const similarity = calculateSimilarity(normalizedReport, docNormalized);

    if (similarity >= minConfidence) {
      candidates.push({
        id: doc.id,
        fileName: doc.file_name,
        normalizedFilename: docNormalized,
        confidence: similarity,
        matchType: similarity === 100 ? 'exact' : 'fuzzy',
      });
    }
  }

  // Sort by confidence descending
  return candidates.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Preview matches for multiple reports against a list of documents
 */
export function previewMatches(
  reportFilenames: string[],
  documents: PendingDocument[]
): MatchPreview[] {
  return reportFilenames.map((reportName) => {
    const normalizedKey = normalizeFilename(reportName);
    const candidates = findMatchCandidates(reportName, documents, 50);

    // Exact match
    const exactMatch = candidates.find((c) => c.confidence === 100);
    if (exactMatch) {
      return {
        reportName,
        normalizedKey,
        matchedDocument: exactMatch,
        suggestions: candidates.filter((c) => c.id !== exactMatch.id).slice(0, 4),
        status: 'exact' as const,
      };
    }

    // Partial match (high confidence fuzzy)
    const partialMatch = candidates.find((c) => c.confidence >= 80);
    if (partialMatch) {
      return {
        reportName,
        normalizedKey,
        matchedDocument: partialMatch,
        suggestions: candidates.filter((c) => c.id !== partialMatch.id).slice(0, 4),
        status: 'partial' as const,
      };
    }

    // No confident match
    return {
      reportName,
      normalizedKey,
      matchedDocument: null,
      suggestions: candidates.slice(0, 5),
      status: 'none' as const,
    };
  });
}

/**
 * Get match status color class
 */
export function getMatchStatusColor(status: 'exact' | 'partial' | 'none'): string {
  switch (status) {
    case 'exact':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'partial':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'none':
      return 'text-red-600 bg-red-50 border-red-200';
  }
}

/**
 * Get confidence badge variant
 */
export function getConfidenceBadgeVariant(confidence: number): 'default' | 'secondary' | 'destructive' {
  if (confidence >= 90) return 'default';
  if (confidence >= 70) return 'secondary';
  return 'destructive';
}
