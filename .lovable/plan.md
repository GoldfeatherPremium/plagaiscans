
# Replace Company Name: Goldfeather Prem Ltd → Plagaiscans Technologies Ltd

## Summary
Replace all occurrences of "Goldfeather Prem Ltd" with "Plagaiscans Technologies Ltd" throughout the entire application including pages, translations, edge functions, documentation, and configuration files.

---

## Files to Update (23 files total)

### Frontend Pages (8 files)

| File | Changes |
|------|---------|
| `src/pages/TermsAndConditions.tsx` | 4 occurrences - sections 1, 10, 11, 12 |
| `src/pages/PrivacyPolicy.tsx` | 2 occurrences - sections 1 and 5 |
| `src/pages/AboutUs.tsx` | 4 occurrences - SEO meta, company card, description |
| `src/pages/Contact.tsx` | 1 occurrence - company card heading |
| `src/pages/GuestUpload.tsx` | 1 occurrence - footer legal entity |
| `src/pages/AdminInvoices.tsx` | 3 occurrences - dialog descriptions, card info |
| `src/pages/AdminBankStatements.tsx` | 2 occurrences - default account_name values |

### Components (1 file)

| File | Changes |
|------|---------|
| `src/components/Footer.tsx` | 1 occurrence - default value for `footer_company_name` |

### Translation Files (7 files)

| File | Changes |
|------|---------|
| `src/i18n/locales/en/legal.json` | 1 occurrence - section1Desc |
| `src/i18n/locales/de/legal.json` | 1 occurrence - section1Desc |
| `src/i18n/locales/ar/legal.json` | 1 occurrence - section1Desc |
| `src/i18n/locales/zh/legal.json` | 1 occurrence - section1Desc |
| `src/i18n/locales/es/legal.json` | 1 occurrence - section1Desc |
| `src/i18n/locales/fr/legal.json` | 1 occurrence - section1Desc |
| `src/i18n/locales/ru/legal.json` | 1 occurrence - section1Desc |

### Edge Functions (2 files)

| File | Changes |
|------|---------|
| `supabase/functions/generate-invoice-pdf/index.ts` | 1 occurrence - COMPANY.legalName |
| `supabase/functions/generate-receipt-pdf/index.ts` | 1 occurrence - COMPANY.legalName |

### Configuration & Documentation (3 files)

| File | Changes |
|------|---------|
| `index.html` | 1 occurrence - Schema.org provider name |
| `README.md` | 1 occurrence - Legal Entity section |
| `DOCUMENTATION.md` | 1 occurrence - Legal Entity section |

### Database Migration (1 file - Informational Only)

| File | Notes |
|------|-------|
| `supabase/migrations/20251228165243_*.sql` | Contains default "Goldfeather Prem Ltd" - **Cannot edit migrations**. Existing database records will retain old value until manually updated. |

---

## Implementation Steps

### Step 1: Update Frontend Pages
Replace all hardcoded "Goldfeather Prem Ltd" strings with "Plagaiscans Technologies Ltd" in:
- TermsAndConditions.tsx
- PrivacyPolicy.tsx
- AboutUs.tsx (including SEO keywords)
- Contact.tsx
- GuestUpload.tsx
- AdminInvoices.tsx
- AdminBankStatements.tsx

### Step 2: Update Footer Component
Change default fallback value in Footer.tsx line 164:
```text
Before: get('footer_company_name', 'Goldfeather Prem Ltd')
After:  get('footer_company_name', 'Plagaiscans Technologies Ltd')
```

### Step 3: Update All Translation Files
Update `section1Desc` in privacy policy translations for all 7 languages:
- EN, DE, AR, ZH, ES, FR, RU

### Step 4: Update Edge Functions
Update COMPANY.legalName in both PDF generation functions:
- generate-invoice-pdf
- generate-receipt-pdf

### Step 5: Update HTML & Documentation
- index.html Schema.org structured data
- README.md
- DOCUMENTATION.md

### Step 6: Update Database Default (Optional)
For new bank statement records to use the correct company name, run SQL in Cloud View:
```sql
UPDATE bank_statement_settings 
SET account_name = 'Plagaiscans Technologies Ltd' 
WHERE account_name = 'Goldfeather Prem Ltd';
```

---

## Technical Details

### Search Pattern
```text
Find: Goldfeather Prem Ltd
Replace: Plagaiscans Technologies Ltd
```

### Case Variations to Handle
- "Goldfeather Prem Ltd" (standard)
- "Goldfeather Prem Ltd" (in translated text)
- Company references in SEO meta descriptions

### Files That Will NOT Be Modified
- Migration files (immutable)
- Auto-generated files (client.ts, types.ts)

---

## Verification Checklist
After implementation, verify:
1. Footer displays correct company name
2. Privacy Policy shows correct data controller
3. Terms & Conditions shows correct company info
4. Contact page shows correct company card
5. Guest upload page footer is correct
6. Generated invoices/receipts show correct company
7. All language translations are updated
8. Schema.org data in index.html is correct
