

## Plan: Support Classical View Reports in AI Scan Bulk Upload

### Problem
The bulk report processor (`process-bulk-reports`) only reads page 2 of PDFs to detect report type and extract percentages. This works for Modern View reports but fails for Classical View similarity reports where the similarity index appears in the last pages (as shown in the screenshot: "ORIGINALITY REPORT" section with "SIMILARITY INDEX" percentage).

### What Changes

**File: `supabase/functions/process-bulk-reports/index.ts`**

Upgrade the `analyzePdfPage2` function to a smarter `analyzePdf` function that:

1. **Try page 2 first** (Modern View detection) -- keep existing logic
2. **If page 2 returns `unknown` or no percentage found**, fall back to scanning the last 10 pages backwards (Classical View detection)
3. In the classical view pages, look for keywords like:
   - `originality report`
   - `similarity index` followed by a percentage
   - `internet sources`, `publications`, `student papers`
4. Extract the similarity percentage from patterns like `N% SIMILARITY INDEX` or `SIMILARITY INDEX ... N%`
5. Classify as `similarity` report type when classical view markers are found

### Detection Logic (Classical View)

From the screenshot reference, classical view reports contain:
- Header: document filename
- "ORIGINALITY REPORT" label
- Percentage values for: SIMILARITY INDEX, INTERNET SOURCES, PUBLICATIONS, STUDENT PAPERS
- "PRIMARY SOURCES" section with source details

The function will scan last 10 pages for these patterns and extract the main similarity index percentage.

### Technical Details

- Rename `analyzePdfPage2` to `analyzePdf`
- Add backward page scanning when page 2 analysis is inconclusive
- Add regex patterns for classical view format: `/(\d+)\s*%\s*similarity\s*index/`, `/similarity\s*index\s*(\d+)\s*%/`
- Classical view keywords: `originality report`, `similarity index`, `primary sources`
- No database or UI changes needed -- only the edge function logic

### Deployment
- Redeploy `process-bulk-reports` edge function

