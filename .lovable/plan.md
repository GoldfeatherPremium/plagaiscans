

## Remark Presets Management in Admin Settings

### What will be built

A new "Remark Presets" section in Admin Settings where you can:
1. See all the existing remarks from the database listed out
2. Toggle each one on/off to include it in the staff remarks selector
3. Edit the text of any remark
4. Add new custom remarks
5. Delete remarks you don't want

Then in the Document Queue and Similarity Queue, the remarks text area will be replaced with a dropdown selector of the enabled presets (with an option to type a custom remark).

### Step 1 - Database: Create a `remark_presets` table

A new table to store configurable remark presets:

```text
remark_presets
- id (uuid, PK)
- remark_text (text, not null)
- is_active (boolean, default true)
- sort_order (integer, default 0)
- created_at (timestamp)
- updated_at (timestamp)
```

RLS: Admin can manage (ALL), Staff can view active presets (SELECT where is_active = true).

### Step 2 - Seed the table with all existing remarks

Insert all 49 unique remarks from the database into `remark_presets` with `is_active = false` so you can review and enable the ones you want.

### Step 3 - Admin Settings UI: "Remark Presets" section

Add a new card in `AdminSettings.tsx` with:
- A list of all remark presets showing the text, an active/inactive toggle, and edit/delete buttons
- An "Add New Remark" button to create custom ones
- Edit mode: inline text editing with save/cancel
- Each preset can be toggled on/off individually

### Step 4 - Update Document Queue remarks input

In `DocumentQueue.tsx` and `SimilarityQueue.tsx`:
- Replace the plain `Textarea` for remarks with a combo approach:
  - A `Select` dropdown listing all active remark presets
  - An "Other / Custom" option that reveals a text input for free-form remarks
- Same treatment for the batch upload dialog remarks fields

### Step 5 - Update EditCompletedDocumentDialog

Same combo selector approach for the remarks field in the edit dialog.

### Technical Details

- The `remark_presets` table uses standard RLS with the existing `has_role()` function
- Presets are fetched client-side and cached; staff see only active ones
- The remarks selector will use the existing `Select` component from the UI library
- When "Custom" is selected, a textarea appears for free-form input
- The final remark value stored in `documents.remarks` remains a plain text string (no schema change to documents table)

