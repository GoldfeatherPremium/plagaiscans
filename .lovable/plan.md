

## Plan: Block `.doc` Format Uploads (Allow `.docx`)

### Problem
Customers and guests can currently upload `.doc` files (legacy Word format). Only `.docx` should be allowed. Need to reject `.doc` files with a clear error message across all upload pages.

### Changes

**3 files modified:**

1. **`src/pages/UploadDocument.tsx`**
   - Remove `.doc` from the `accept` attribute on the file input
   - Add validation in `addFiles()` to filter out `.doc` files and show a toast: "`.doc` format is not supported. Please convert to `.docx` and try again."

2. **`src/pages/UploadSimilarity.tsx`**
   - Remove `.doc` from the `accept` attribute
   - Update the existing file extension validation to exclude `doc` (keep `docx`)
   - Show toast when `.doc` files are rejected

3. **`src/pages/GuestUpload.tsx`**
   - Remove `.doc` from the `accept` attribute
   - Add validation in `handleChange()` and `handleDrop()` to reject `.doc` files with a toast message

No database or backend changes needed.

