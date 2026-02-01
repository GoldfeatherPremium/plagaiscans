
# Plan: Display Cancellation Reason to Customers

## Overview
When an admin cancels a document and provides a reason, that reason should be visible to customers in both their account's My Documents page and on the Guest Upload page.

## Changes Required

### 1. Update Document Interface (src/hooks/useDocuments.ts)
Add the missing cancellation fields to the `Document` interface:
- `cancellation_reason: string | null`
- `cancelled_at: string | null`
- `cancelled_by: string | null`

### 2. Update MagicUploadFile Interface (src/hooks/useMagicLinks.ts)
Add cancellation fields to the `MagicUploadFile` interface:
- `cancellation_reason?: string | null`
- `cancelled_at?: string | null`

Update the `getFilesByToken` function to map these fields from the documents query.

### 3. Update My Documents Page (src/pages/MyDocuments.tsx)
Modify the remarks column display logic to show cancellation reason when status is cancelled:
- If `status === 'cancelled'` and `cancellation_reason` exists, display the reason with a red/warning style
- Show a default message like "Cancelled by admin" if no reason is provided

### 4. Update Guest Upload Page (src/pages/GuestUpload.tsx)
Similar updates to the documents table in the "My Documents" tab:
- Handle `cancelled` status in the status column (will use StatusBadge style)
- Show cancellation reason in the remarks column when applicable

## Technical Details

### Document Type Updates
```typescript
// In useDocuments.ts - Document interface
cancellation_reason: string | null;
cancelled_at: string | null;
cancelled_by: string | null;
```

### MagicUploadFile Type Updates
```typescript
// In useMagicLinks.ts - MagicUploadFile interface
cancellation_reason?: string | null;
cancelled_at?: string | null;
```

### Remarks Column Logic (both pages)
```tsx
// Priority order for remarks display:
1. If cancelled && cancellation_reason → Show "Cancelled: {reason}" in red
2. If cancelled && no reason → Show "Cancelled by admin" in red
3. If has remarks → Show remarks
4. If has error_message → Show error in red
5. Default status messages (In queue, Processing, etc.)
```

## Files to Modify
1. `src/hooks/useDocuments.ts` - Add cancellation fields to Document interface
2. `src/hooks/useMagicLinks.ts` - Add cancellation fields and mapping
3. `src/pages/MyDocuments.tsx` - Update remarks column display
4. `src/pages/GuestUpload.tsx` - Update status badge and remarks display

## User Experience
- Customers will see a "Cancelled" status badge (red) for cancelled documents
- The remarks column will show the admin's cancellation reason if provided
- This helps customers understand why their document was cancelled
