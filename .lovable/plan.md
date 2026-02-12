

## Fix: Footer "AI Content Detection" Translation Key Missing

### Problem
The footer displays the raw translation key `footer.aiContentDetection` instead of proper text because this key does not exist in the translation files. The `en/common.json` file has `footer.contentAnalysis` but the Footer component references `footer.aiContentDetection`.

### Solution
Add the missing `aiContentDetection` key to all language translation files (en, ar, de, es, fr, ru, zh) under the `footer` section in `common.json`.

### Technical Details

**File: `src/i18n/locales/en/common.json`** (and equivalents for ar, de, es, fr, ru, zh)
- Add `"aiContentDetection": "AI Content Detection"` to the `footer` object

This is a one-line fix per language file. The Footer component code (`t('footer.aiContentDetection')`) is correct -- it's just missing the translation entry.

