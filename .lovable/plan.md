

## USDT Manual Transfer (TRC20) Payment Method

### Overview
Add a new semi-manual "USDT Transfer" payment option on the Checkout page. The admin provides a fixed TRC20 wallet address (configured in settings). The customer sends USDT to that address, then submits the transaction hash. The admin verifies the hash manually and approves the payment, which credits the customer's account with expiry validity.

### User Flow
1. Customer clicks "USDT Transfer" on the Checkout page
2. A dialog opens showing the admin's fixed TRC20 wallet address (from settings) and the amount to pay
3. Customer copies the address, sends USDT externally
4. Customer pastes their transaction hash into the form and submits
5. A record is created in `manual_payments` with `payment_method = 'usdt_manual'`
6. Admin gets notified, reviews the hash, and approves/rejects from the existing Manual Payments admin page
7. On approval, credits are added with expiry validity (existing flow in `AdminManualPayments`)

### Technical Details

**1. Admin Settings (`src/pages/AdminSettings.tsx`)**
- Add two new settings:
  - `payment_usdt_manual_enabled` (toggle on/off)
  - `usdt_manual_wallet_address` (TRC20 wallet address input)
- These are stored in the existing `settings` table

**2. Checkout Page (`src/pages/Checkout.tsx`)**
- Fetch `payment_usdt_manual_enabled` and `usdt_manual_wallet_address` from settings
- Add a new "USDT Transfer (TRC20)" payment card (distinct from the existing NOWPayments-based USDT option)
- Dialog shows:
  - The fixed wallet address with copy button
  - The exact USD amount to send
  - A transaction hash input field (validated: 64-char hex string starting with optional `0x`)
- On submit: insert into `manual_payments` table with `payment_method: 'usdt_manual'` and `transaction_id: <hash>`
- Notify admins via `user_notifications`
- Redirect to payment history

**3. Admin Manual Payments Page (`src/pages/AdminManualPayments.tsx`)**
- Update the "Method" column display to show "USDT Transfer" with a distinct icon when `payment_method === 'usdt_manual'`
- Update the description text from "Binance Pay" to be generic ("Binance Pay, USDT Transfer, and other manual payments")
- The existing verify/reject flow already handles credit assignment with validity -- no changes needed there beyond displaying the method name and transaction hash

**4. No database changes needed**
- The existing `manual_payments` table already has all required columns (`payment_method`, `transaction_id`, `amount_usd`, `credits`, `status`, etc.)

