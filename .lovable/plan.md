

## Plan: Add Admin Push Notifications for Manual & Paddle Payments

### Current State
- **Manual payments** (Binance Pay, USDT): When submitted, in-app notifications are created in `user_notifications` table for admins, but **no web push notifications** are sent.
- **Paddle payments**: The webhook already sends an admin email notification via `send-admin-payment-notification`, and creates in-app user notifications, but **no admin push notification** is sent.

### Changes

#### 1. `src/pages/Checkout.tsx` — Add push notifications for manual payments

After the existing `user_notifications` insert for Binance Pay (line ~371) and USDT (line ~470), add a call to `send-push-notification` targeting admins:

```typescript
await supabase.functions.invoke('send-push-notification', {
  body: {
    title: '🔔 New Manual Payment',
    body: `$${amount} for ${credits} credits from ${email}. Please verify.`,
    targetAudience: 'admins',
    eventType: 'admin_manual_payment',
    url: '/admin/manual-payments',
  },
});
```

This will be added in both the Binance Pay and USDT Manual submission handlers.

#### 2. `supabase/functions/paddle-webhook/index.ts` — Add admin push notification

After the existing `notifyAdminPayment` call (line ~309), add a push notification to admins:

```typescript
await sendPushNotification(null, 'New Paddle Payment 💳',
  `${credits} credits purchased by ${profile?.email}. Amount: $${amountTotal}`,
  { type: 'admin_paddle_payment', url: '/admin/paddle-payments', targetAudience: 'admins' });
```

Since `sendPushNotification` in this file sends to a single user, we'll instead use a direct fetch call to `send-push-notification` with `targetAudience: 'admins'`.

### Files Modified
1. **`src/pages/Checkout.tsx`** — Add push notification calls in Binance Pay and USDT handlers
2. **`supabase/functions/paddle-webhook/index.ts`** — Add admin push notification after successful payment processing

### No database changes needed

