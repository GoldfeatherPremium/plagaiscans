

## Comprehensive Translation Coverage — All 7 Languages, Site-Wide

The site already has i18n scaffolding with 7 languages (English, Arabic, Chinese, French, Spanish, German, Russian) loaded across 6 namespaces (`common`, `landing`, `auth`, `dashboard`, `pages`, `legal`). However, coverage has gaps:
- Existing dictionaries are partially translated and missing many keys customer pages already reference
- Several customer pages (`Checkout`, `GuestUpload`, `Index`, `SubscriptionManagement`) are still hardcoded English
- New pages built recently (Buy Credits hero/FAQ, Referral, Pricing detail sections) need their strings catalogued
- `BuyCredits.tsx` references translation keys but only some are defined

I'll do a full translation sweep so every visible string the customer/guest can encounter is keyed and available in all 7 languages.

### Scope

**Customer-facing surfaces (full coverage):**
- Navigation, footer, language switcher, theme toggle
- Landing page (hero, services, about, contact, testimonials)
- Pricing page (all sections, plan cards, FAQ, trust banners, badges)
- Buy Credits page (balance card, hero, no-repository card, FAQ, "Most Popular", "Best Value", validity labels)
- Checkout page (quantity selector, payment methods, totals, fees, error messages, success states)
- Guest Upload (upload form, pricing tab, no-repository card, magic link UI)
- Dashboard overview, Quick Actions, recent docs, low-credit nudges, credit expiry display
- Upload Document + Upload Similarity (form labels, exclusions, file format help, errors, deduplication warnings)
- My Documents (table headers, status badges, filters, search, tag manager, cancellation remarks)
- My Invoices, My Receipts, Payment History (tables, status, actions)
- Profile, Complete Profile, phone validation messages
- Subscription Management (plan summary, cancel/resume, billing info)
- Referral Program (code share, rewards, eligibility, fraud notices, tabs, dashboard widget)
- Auth pages (login, signup, reset, OTP, password strength)
- Legal pages (Privacy, Terms, Refund, Academic Integrity)
- Resource/blog pages (FAQ, How It Works, Use Cases, About Us, Contact)
- Common UI: buttons, table headers, status badges, toasts, loading/error states, pagination, empty states
- PWA install banner, announcement banner, maintenance banner, WhatsApp button labels
- Notification preferences, push prompts, sound settings labels

**Out of scope (kept English):**
- Admin pages and admin-only components (admin is internal — staff/admin already operate in English per existing memory)
- Database content (announcements, remarks, package names — these are admin-edited content, not UI chrome)
- Brand name "Plagaiscans", currency symbols, country names

### Approach

```text
1. Audit pass    → grep every customer page/component for hardcoded user-visible strings,
                   compile a master English key map per namespace
2. Expand EN     → add all missing keys to en/{common,landing,dashboard,pages,legal,auth}.json
                   add new namespace files where useful: en/checkout.json, en/referral.json,
                   en/pricing.json, en/buyCredits.json, en/guest.json, en/notifications.json
3. Translate     → produce ar/zh/fr/es/de/ru versions of every namespace, mirroring keys 1:1.
                   Use native, idiomatic phrasing per locale. Arabic written RTL-ready.
4. Wire i18n     → register new namespaces in src/i18n/config.ts (imports + resources + ns array)
5. Refactor pages → replace hardcoded strings with t('namespace:key') calls in:
                    Checkout.tsx, GuestUpload.tsx, Index.tsx, SubscriptionManagement.tsx,
                    BuyCredits.tsx (fill gaps), Pricing.tsx (fill gaps), ReferralProgram.tsx (fill gaps),
                    plus shared components: Navigation, Footer, DashboardSidebar, DashboardHeader,
                    CreditBalanceHeader, UpgradeNudge, AnnouncementBanner, GuestEmailBanner,
                    StatusBadge, NotificationPreferences, RemarkSelector public labels
6. RTL polish   → ensure Arabic gets correct dir="rtl" body class (already handled in config) and
                  verify icons/spacing on a couple of key pages don't break under RTL
7. Smoke check  → load preview, switch each language from the LanguageSwitcher, confirm:
                    • Pricing, Buy Credits, Checkout, Referral, Guest Upload all render translated
                    • Dashboard sidebar + header translate
                    • No raw "translation_key" strings appear (i18n returnEmptyString=false fallback to EN)
```

### Translation quality notes

- Use neutral, professional terminology consistent with existing memory: "Similarity Review" / "Content Analysis" (not Plagiarism / AI Humanizer). All locales follow this.
- Money, dates, and numbers stay in their existing formats (locale-aware formatting is a separate concern, not part of this pass).
- Brand "Plagaiscans" remains untranslated everywhere.
- Plural and interpolation tokens (`{{name}}`, `{{count}}`) preserved across all locales.
- Arabic uses MSA (Modern Standard Arabic). Chinese uses Simplified. German uses formal "Sie". French uses formal "vous". Spanish uses formal "usted". Russian uses formal "вы".

### Files to be created

```
src/i18n/locales/{en,ar,zh,fr,es,de,ru}/checkout.json     (new)
src/i18n/locales/{en,ar,zh,fr,es,de,ru}/buyCredits.json   (new)
src/i18n/locales/{en,ar,zh,fr,es,de,ru}/pricing.json      (new)
src/i18n/locales/{en,ar,zh,fr,es,de,ru}/referral.json     (new)
src/i18n/locales/{en,ar,zh,fr,es,de,ru}/guest.json        (new)
src/i18n/locales/{en,ar,zh,fr,es,de,ru}/notifications.json (new)
```
= 42 new JSON files

### Files to be edited

```
src/i18n/locales/{en,ar,zh,fr,es,de,ru}/common.json       (expand)
src/i18n/locales/{en,ar,zh,fr,es,de,ru}/landing.json      (expand)
src/i18n/locales/{en,ar,zh,fr,es,de,ru}/dashboard.json    (expand)
src/i18n/locales/{en,ar,zh,fr,es,de,ru}/pages.json        (expand)
src/i18n/locales/{en,ar,zh,fr,es,de,ru}/auth.json         (expand)
src/i18n/locales/{en,ar,zh,fr,es,de,ru}/legal.json        (expand)
src/i18n/config.ts                                         (register new namespaces)

src/pages/Checkout.tsx                  → wire t() calls
src/pages/GuestUpload.tsx               → wire t() calls
src/pages/Index.tsx                     → wire t() calls
src/pages/SubscriptionManagement.tsx    → wire t() calls
src/pages/BuyCredits.tsx                → fill missing t() keys
src/pages/Pricing.tsx                   → fill missing t() keys
src/pages/ReferralProgram.tsx           → fill missing t() keys
src/components/Navigation.tsx           → ensure all menu items use t()
src/components/Footer.tsx               → ensure all links/text use t()
src/components/DashboardSidebar.tsx     → all menu labels
src/components/DashboardHeader.tsx      → greeting + role badge
src/components/CreditBalanceHeader.tsx  → balance labels
src/components/StatusBadge.tsx          → status names
src/components/AnnouncementBanner.tsx   → dismiss/CTA labels (not the announcement body)
```

### Verification

- Switch language to Arabic: page flips to RTL, all chrome translates, no English stragglers on Pricing / Buy Credits / Checkout / Referral / Guest pricing.
- Switch to Chinese, French, Spanish, German, Russian: every visible label in customer flows is in the target language.
- Admin pages remain in English (intentional).
- No console warnings about missing translation keys for the customer flows.

