

## Plan: Honor Paddle Quantity Changes in Credit Allocation

### Problem
When a customer buys the "1 Credit Pack" via Paddle and changes the quantity to 5 in the checkout UI, they pay for 5 but only receive 1 credit. This happens because:

1. **Checkout function** (`create-paddle-checkout`) hardcodes `quantity: 1` and stores `credits: "1"` in `custom_data`
2. **Webhook** (`paddle-webhook`) reads credits from `custom_data.credits` (always "1") and ignores the actual quantity purchased

### Fix (2 files)

#### 1. `supabase/functions/paddle-webhook/index.ts`
In the `transaction.completed` handler (~line 159-161), after extracting `custom_data`, also read the actual quantity from the Paddle transaction items and multiply:

```
const itemQuantity = eventData?.items?.[0]?.quantity || 1;
const baseCredits = parseInt(customData.credits || "0", 10);
const credits = baseCredits * itemQuantity;
```

This way, if `custom_data.credits` = "1" but the customer purchased quantity 5, `credits` becomes 5. All downstream logic (balance update, credit_validity, invoices, receipts, notifications) already uses the `credits` variable, so they'll automatically reflect the correct amount.

#### 2. `supabase/functions/create-paddle-checkout/index.ts`  
No changes needed to the checkout creation — Paddle naturally allows quantity changes on its checkout UI. The fix is entirely in the webhook.

### What stays the same
- Idempotency checks, credit validity creation, invoice/receipt generation, notifications — all already use the `credits` variable, so they'll automatically pick up the corrected value.
- No database migration needed.
- No frontend changes needed.

### Testing
After deployment, test by selecting the 1-credit Paddle package, changing quantity to 2+ in checkout, completing payment, and verifying the correct number of credits appears in the account.

