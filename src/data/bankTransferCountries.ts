export const BANK_TRANSFER_COUNTRY_CODES = [
  // European countries
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IS', 'IE', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'NL', 'NO', 'PL',
  'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'CH',
  // Non-European
  'GB', 'US', 'NG', 'AU', 'CA', 'HK', 'IN', 'PK', 'BD', 'NZ', 'TR', 'SG',
] as const;

export type BankTransferCountryCode = typeof BANK_TRANSFER_COUNTRY_CODES[number];
