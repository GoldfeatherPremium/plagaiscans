

## Plan: Send Completion Email & Push Notification on Manual Report Upload

### Problem
When an admin manually edits a document via the `EditCompletedDocumentDialog` (e.g., uploading reports and setting status to "completed"), the component directly updates the database without triggering the completion email or push notification. The `updateDocumentStatus` function in `useDocuments.ts` handles these notifications, but this dialog bypasses it.

### Changes

**`src/components/EditCompletedDocumentDialog.tsx`** — single file change:

After the successful document update and activity log insert (around line 138), add completion email and push notification logic when:
1. The status is being changed TO `completed`
2. AND the document was NOT already `completed` (i.e., `document.status !== 'completed'`)
3. AND the document has a `user_id` (registered user, not guest)

Add the following after the activity log insert:
- Call `send-completion-email` edge function with `userId`, `documentId`, `fileName`, `similarityPercentage`, and `aiPercentage`
- Call `send-push-notification` edge function with the same pattern used in `useDocuments.ts`
- For guest documents (magic_link_id), call `send-guest-completion-email`
- All calls wrapped in try/catch so failures don't block the save

### What stays the same
- The existing `updateDocumentStatus` flow in `useDocuments.ts` remains unchanged
- Bulk upload notification logic remains unchanged
- Error handling and activity logging remain unchanged

