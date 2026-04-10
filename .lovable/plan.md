

## Plan: Save & Reuse Paddle Payment Methods

### How It Works

Paddle automatically saves payment methods for known customers. The current code already searches for existing Paddle customers by email and passes `customer_id` when creating transactions. However, two things are missing:

1. **The `paddle_customer_id` is not cached on the user profile** — so every checkout does an API call to search Paddle customers by email. This should be stored on `profiles` for efficiency and reliability.
2. **Paddle checkout doesn't enable saved payment method reuse** — the checkout settings need `allowedPaymentMethods` or the Paddle `customer_id` with saved payment method display enabled.

### Changes

#### 1. Database migration — Add `paddle_customer_id` to `profiles`

```sql
ALTER TABLE public.profiles ADD COLUMN paddle_customer_id TEXT;
```

#### 2. `supabase/functions/paddle-webhook/index.ts` — Save customer ID to profile

After a successful `transaction.completed`, save the `paddle_customer_id` to the user's profile:

```typescript
// After credits are added successfully
await supabaseAdmin
  .from("profiles")
  .update({ paddle_customer_id: paddleCustomerId })
  .eq("id", userId);
```

#### 3. `supabase/functions/create-paddle-checkout/index.ts` — Use cached customer ID

Before searching Paddle API for existing customers, first check if the user already has a `paddle_customer_id` stored in their profile. Skip the API search if found:

```typescript
// Check profile for cached paddle_customer_id
const { data: profile } = await supabaseClient
  .from("profiles")
  .select("paddle_customer_id")
  .eq("id", user.id)
  .single();

if (profile?.paddle_customer_id) {
  paddleCustomerId = profile.paddle_customer_id;
} else {
  // Existing customer search/create logic...
  // After creating/finding customer, save to profile
  if (paddleCustomerId) {
    await supabaseClient
      .from("profiles")
      .update({ paddle_customer_id: paddleCustomerId })
      .eq("id", user.id);
  }
}
```

#### 4. `src/pages/Checkout.tsx` — Enable saved payment methods in checkout settings

Update the `Paddle.Checkout.open` call to allow saved payment methods:

```typescript
Paddle.Checkout.open({
  transactionId: data.transactionId,
  settings: {
    successUrl: `${window.location.origin}/dashboard/payment-success?provider=paddle`,
    allowLogout: false,
  },
});
```

The `allowLogout: false` ensures the customer stays linked, and Paddle will automatically show their saved payment methods since we pass the `customer_id` in the transaction.

### Files Modified
1. **Database migration** — Add `paddle_customer_id` column to `profiles`
2. **`supabase/functions/paddle-webhook/index.ts`** — Save Paddle customer ID to profile on payment
3. **`supabase/functions/create-paddle-checkout/index.ts`** — Use cached customer ID, save on first use
4. **`src/pages/Checkout.tsx`** — Configure checkout to show saved payment methods

### Result
When a customer pays via Paddle for the first time, their Paddle customer ID is saved to their profile. On subsequent purchases, the checkout automatically shows their previously used payment method for one-click reuse.

