

## Hide Sample Helper Nudge After First Completed Document

Once a customer has at least one **completed real document**, automatically suppress the helper text ("👇 Try downloading our sample reports…" + "Ready for the real thing? Buy credits →") on both **My Documents** and **Dashboard → Recent Documents**. The sample row itself stays visible — only the nudge disappears, since they've already experienced a real report.

### Logic

A customer is considered "experienced" when:
```
documents.some(d => !d.is_sample && d.status === 'completed')
```

Helper visibility rule:
- No completed real doc yet → show helper (existing behavior)
- ≥1 completed real doc → hide helper entirely (both nudge line and "Buy credits" CTA)
- Sample row → always visible regardless

### Implementation

**`src/pages/MyDocuments.tsx`**
- Compute `hasCompletedRealDoc = documents.some(d => !d.is_sample && d.status === 'completed')`.
- Wrap the existing helper card render in `{!hasCompletedRealDoc && (...)}`.
- Sample row rendering untouched.

**`src/pages/Dashboard.tsx`**
- Same computation against the recent documents list (which includes the virtual sample).
- Wrap the helper text line in `{!hasCompletedRealDoc && (...)}`.
- Sample row + `[SAMPLE]` badge stay.

### Edge cases

| Scenario | Behavior |
| --- | --- |
| New signup, 0 docs | Helper shows. ✅ |
| Uploaded but still pending/in-progress | Helper still shows (not yet completed). ✅ |
| 1+ completed real doc | Helper hidden on both pages. ✅ |
| Customer deletes their only completed doc | Helper reappears (acceptable — matches data). |
| Cancelled doc (status = 'cancelled') | Doesn't count as completed → helper still shows. ✅ |
| Staff/Admin | Sample never injected anyway → helper never rendered. ✅ |

### Files touched

```text
src/pages/MyDocuments.tsx    wrap helper card in hasCompletedRealDoc guard
src/pages/Dashboard.tsx      wrap helper line in hasCompletedRealDoc guard
```

