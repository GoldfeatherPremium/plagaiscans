

## Bank Transfer Payment Option

### Overview
Add a "Bank Transfer" payment method on the Checkout page that appears as a new option alongside existing methods (Stripe, Paddle, etc.). When selected, it opens a form dialog where the customer fills in their details, then gets redirected to WhatsApp to request bank account details. No processing fee is applied.

### Supported Countries
All European countries, United Kingdom, United States, Nigeria, Australia, Canada, Hong Kong, India, Pakistan, Bangladesh, Hungary, New Zealand, Turkey, Singapore.

### User Flow
1. Customer selects a credit package and reaches the Checkout page
2. They see a "Bank Transfer" payment option (with a Building/Landmark icon)
3. Clicking it opens a dialog with a form:
   - Country selector (dropdown filtered to supported countries only)
   - Full name (as it appears on bank account)
   - WhatsApp number (with country dial code auto-selected)
   - Email address (pre-filled from profile)
   - Number of credits (pre-filled from selected package, read-only)
4. On submit, the form data is composed into a WhatsApp message and the user is redirected to WhatsApp to request bank details
5. No fee is added for this method

### Technical Details

**1. New file: `src/data/bankTransferCountries.ts`**
- Export a constant array of country codes eligible for bank transfer: `['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IE', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'CH', 'GB', 'US', 'NG', 'AU', 'CA', 'HK', 'IN', 'PK', 'BD', 'NZ', 'TR', 'SG']`

**2. Modified file: `src/pages/Checkout.tsx`**
- Add a new "Bank Transfer" payment option card in the payment methods section
- Add state for `showBankTransferDialog`
- Add a `Dialog` containing a form with:
  - Country dropdown (filtered to bank transfer countries, using data from `countries.ts`)
  - Full name input (validated, max 100 chars)
  - WhatsApp number input with auto-selected dial code based on country
  - Email input (pre-filled from user profile)
  - Credits display (read-only, from selected package)
- Zod schema for form validation
- On submit: compose a WhatsApp message with all details and redirect using `openWhatsAppCustom` from `useWhatsApp` hook
- No fee calculation needed (0% fee)

**3. Admin toggle (optional enhancement)**
- Add `payment_bank_transfer_enabled` setting key in `AdminSettings.tsx` to allow toggling this method on/off
- Fetch this setting in `Checkout.tsx` alongside other payment method settings
