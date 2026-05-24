// Shared credit type definitions for the four product credit pools.
export type CreditType =
  | 'full'                  // Turnitin AI + Similarity
  | 'similarity_only'       // Turnitin Similarity only
  | 'drillbit_full'         // Drillbit AI + Similarity
  | 'drillbit_similarity';  // Drillbit Similarity only

export type Provider = 'turnitin' | 'drillbit';

export const CREDIT_TYPES: CreditType[] = [
  'full',
  'similarity_only',
  'drillbit_full',
  'drillbit_similarity',
];

export function providerOf(ct: CreditType): Provider {
  return ct.startsWith('drillbit') ? 'drillbit' : 'turnitin';
}

export function balanceFieldOf(ct: CreditType):
  | 'credit_balance'
  | 'similarity_credit_balance'
  | 'drillbit_credit_balance'
  | 'drillbit_similarity_credit_balance' {
  switch (ct) {
    case 'similarity_only': return 'similarity_credit_balance';
    case 'drillbit_full': return 'drillbit_credit_balance';
    case 'drillbit_similarity': return 'drillbit_similarity_credit_balance';
    default: return 'credit_balance';
  }
}

export function creditTypeLabel(ct: CreditType): string {
  switch (ct) {
    case 'similarity_only': return 'Turnitin · Similarity';
    case 'drillbit_full': return 'Drillbit · AI + Similarity';
    case 'drillbit_similarity': return 'Drillbit · Similarity';
    default: return 'Turnitin · AI + Similarity';
  }
}

export function creditTypeShort(ct: CreditType): string {
  switch (ct) {
    case 'similarity_only': return 'Similarity';
    case 'drillbit_full': return 'AI + Similarity';
    case 'drillbit_similarity': return 'Similarity';
    default: return 'AI + Similarity';
  }
}

// Build credit_type from provider + plagiarism+ai vs plagiarism-only choice
export function toCreditType(provider: Provider, withAi: boolean): CreditType {
  if (provider === 'drillbit') return withAi ? 'drillbit_full' : 'drillbit_similarity';
  return withAi ? 'full' : 'similarity_only';
}
