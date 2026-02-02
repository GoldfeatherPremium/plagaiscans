
# Complete Website Rebuild Plan for Payment Gateway Compliance

## Current Website Analysis

### Critical Issues Identified

**1. Marketing Language Problems**
- Hero badge: "Trusted by 10,000+ academics & researchers" - unverifiable claim
- "99% Accuracy Rate" - explicit accuracy claim (HIGH RISK)
- "1B+ Sources Checked" - unverifiable claim
- "Advanced algorithms" - AI/tech hype language
- "Comprehensive Document Analysis" - marketing fluff
- "Accurate Results" - direct accuracy claim in benefits section

**2. Academic Positioning Risks**
- Title: "Plagiarism & Similarity Check for Academic Integrity"
- Targeting "students, researchers, and universities"
- "Verify originality" - implies guarantee
- "academic integrity services" - institutional approval signal

**3. Design Issues**
- Gradient text effects (AI-generated appearance)
- Animated trust badges with sparkles
- Floating decorative backgrounds
- Pulsing animations
- "Hero" button variants

**4. Missing/Broken Pages**
- /about returns 404
- /privacy returns 404
- /terms returns 404 (different URL structure)

**5. Legal Page Weaknesses**
- Terms lack strong "informational only" disclaimer
- No explicit "no academic guarantee" clause
- Privacy Policy missing Airwallex disclosure
- Refund Policy acceptable but needs minor tweaks

---

## Rebuild Strategy

### Phase 1: Content & Language Overhaul

#### Home Page (Landing.tsx + landing.json)

**Current Hero:**
```
"Trusted by 10,000+ academics & researchers"
"Plagiarism & Similarity Check for Academic Integrity"
```

**Proposed Replacement:**
```
Title: "Text Similarity Checking and Content Review"
Subtitle: "A document analysis platform that compares your text against indexed sources 
and generates similarity indicators for your review."

- Remove trust badge entirely
- Remove all stats (10K users, 1B sources, 99% accuracy)
- Remove "AI Content Indicators" from hero features
```

**Features Section Rewrite:**
| Current | Proposed |
|---------|----------|
| "Detailed Similarity Reports" | "Similarity Reports" |
| "AI Content Indicators" | "Content Analysis Indicators" |
| "Fast Processing" | "Standard Processing Times" |
| "Privacy-First Architecture" | "Secure Document Handling" |

**Descriptions to Remove:**
- "Comprehensive source checking"
- "Advanced algorithms ensure thorough and reliable similarity detection"
- "Accurate Results"

**Descriptions to Add:**
- "Reports highlight potential text overlap for your manual review"
- "Indicators are provided for informational purposes only"
- "Final responsibility for content review lies with the user"

---

#### How It Works Page (HowItWorks.tsx)

**Current Issues:**
- Animated demo with gradient colors
- "billions of academic sources" claim
- "Accurate Results" in benefits

**Proposed Changes:**
1. Remove ProcessDemo animation component entirely
2. Rewrite steps to emphasize user responsibility:

```
Step 1: "Create Account & Upload"
- "Sign up and upload your document in a supported format (PDF, DOC, DOCX, TXT)."

Step 2: "Content Comparison"
- "Your text is compared against available indexed sources to identify potential overlaps."

Step 3: "Report Generation"  
- "A report is generated showing similarity indicators and matched text segments."

Step 4: "Review & Download"
- "Download and manually review the findings. Interpretation is your responsibility."
```

3. Benefits section rewrite:
   - Remove "Accurate Results"
   - Change to: "Indicator Reports", "Standard Processing", "Privacy Controls"

---

#### Use Cases Page (New Page: UseCases.tsx)

Create a new page with responsibly framed use cases:

**Students:**
```
"Students can use similarity reports to review their own work before submission. 
This tool helps identify areas that may need additional citation or rephrasing. 
Results are advisory and do not guarantee acceptance by any institution."
```

**Freelancers & Content Writers:**
```
"Freelance writers can check client deliverables against indexed web content 
to identify potential overlap before delivery. This is a reference tool, not 
a content approval system."
```

**Content Editors:**
```
"Editorial teams can use similarity indicators as one part of their review process. 
Human review and judgment remain essential."
```

**Agencies:**
```
"Marketing and content agencies can use this tool as part of internal quality checks. 
Results should be combined with manual review."
```

**Disclaimer at bottom:**
```
"This service does not verify, approve, or certify content for any purpose. 
Results are informational indicators only. Users are responsible for final decisions."
```

---

#### Pricing Page (Pricing.tsx + landing.json)

**Current Issues:**
- "Credits Never Expire" (contradicts package terms with validity_days)
- Marketing-style card animations
- "Best Value" badge

**Proposed Changes:**
1. Remove "Credits Never Expire" feature
2. Simplify card styling (remove hover animations, rings)
3. Change "Best Value" to neutral text
4. Add clear disclaimer:

```
"Credit packages have defined validity periods. Unused credits expire as stated. 
No refunds for expired credits. See Terms of Service for details."
```

---

#### About Us Page (AboutUs.tsx)

**Rewrite entirely for compliance:**

```
Title: "About Our Service"

Body:
"PlagaiScans is a text similarity checking platform operated by Plagaiscans Technologies Ltd, 
a company registered in the United Kingdom (Company No. 16998013).

Our service compares submitted documents against indexed web and academic sources to generate 
similarity indicators. These reports are provided for informational purposes only and should 
be used as a reference tool alongside human review.

What We Do:
- Compare text against available indexed sources
- Generate similarity percentage indicators
- Provide reports showing matched text segments
- Process documents in a secure environment

What We Do Not Guarantee:
- Accuracy or completeness of similarity detection
- Acceptance by any academic institution or employer
- Detection of all potential overlaps
- Verification of content originality or authorship

Our reports are advisory tools. Final responsibility for content review, interpretation, 
and any resulting decisions lies entirely with the user."

Company Information:
- Legal Name: Plagaiscans Technologies Ltd
- Trading Name: PlagaiScans
- Country: United Kingdom
- Registration: 16998013
- Contact: support@plagaiscans.com
```

---

### Phase 2: Legal Pages Overhaul

#### Terms of Service (TermsAndConditions.tsx)

**Add new section immediately after Introduction:**

```
"IMPORTANT SERVICE DISCLAIMER

This service is provided for INFORMATIONAL PURPOSES ONLY. PlagaiScans:
- Does NOT guarantee the accuracy, completeness, or reliability of any report
- Does NOT verify, approve, or certify content for academic or professional purposes
- Does NOT provide any guarantee of institutional acceptance
- Is NOT affiliated with or endorsed by any educational institution
- Does NOT constitute legal, academic, or professional advice

Users acknowledge that:
- All reports are advisory indicators only
- Final responsibility for content review lies with the user
- Results depend on currently indexed sources and may not be exhaustive
- No warranty is made regarding detection accuracy

PROHIBITED USES:
Users may NOT use this service to:
- Facilitate academic misconduct or plagiarism
- Represent reports as institutional approvals
- Circumvent academic integrity requirements
- Misrepresent report findings to third parties
"
```

**Update Service Description:**
```
"PlagaiScans provides text similarity checking and content analysis services. 
We compare submitted documents against indexed sources to generate similarity 
indicators. This is a reference tool intended to support, not replace, human review."
```

---

#### Privacy Policy (PrivacyPolicy.tsx)

**Add Document Processing Section:**

```
"DOCUMENT HANDLING

How Your Documents Are Processed:
- Documents are uploaded to our secure servers for analysis
- Content is compared against indexed sources
- Reports are generated based on this comparison
- Documents may be retained for up to 30 days after processing unless deleted earlier by the user

Document Deletion:
- Users may delete their documents at any time after processing
- Deletion removes the document and associated reports from our systems
- We do not retain document content after deletion

Data Retention:
- Account data: Retained until account deletion request
- Document data: Retained until user deletion or 30 days after processing
- Transaction records: Retained as required by law (typically 7 years)
- Analysis reports: Retained until user deletion

Third-Party Disclosure:
- Documents are NOT shared with other users
- Documents are NOT added to any public database
- Analysis may use third-party APIs (no document storage by third parties)
"
```

**Add Payment Processor Disclosure:**
```
"PAYMENT PROCESSING

Payments are processed by third-party payment processors including:
- Stripe (card payments)
- PayPal 
- Airwallex
- Other providers as indicated at checkout

These processors handle payment information directly. We do not store complete 
payment card details on our servers."
```

---

#### Refund Policy (RefundPolicy.tsx)

**Current policy is reasonable. Minor additions:**

```
"SERVICE DELIVERY STATEMENT

Credits and access to document analysis services are delivered instantly upon 
payment confirmation. This is a digital service with immediate delivery.

Refund Eligibility:
- Within 14 days of purchase
- No credits have been used
- Request submitted via support email

Non-Refundable Circumstances:
- Credits have been used (even partially)
- More than 14 days since purchase
- Expired credits
- Account terminated for Terms violation
- Change of mind after service delivery
"
```

---

### Phase 3: Design Simplification

#### Remove From All Pages:
1. Gradient text effects (`gradient-text` class)
2. Animated floating backgrounds
3. Sparkle icons with pulse animations
4. "Hero" button variants (use "default" or "outline")
5. Trust badges
6. Hover scale/translate animations on cards
7. Ring highlights on "popular" cards

#### Navigation Changes:
- Remove "Get Started" CTA button styling
- Use neutral "Sign Up" or "Create Account"
- Add "Use Cases" to navigation

#### Footer Updates:
- Remove "Trusted by X users" if present
- Keep simple business information
- Ensure all legal page links work

---

### Phase 4: Translation Files Update

Update all locale files (en, es, fr, de, ru, zh, ar) with:
- Neutral, professional language
- Removed accuracy claims
- Added disclaimer text
- Updated feature descriptions

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Landing.tsx` | Remove animations, rewrite hero, update features |
| `src/pages/HowItWorks.tsx` | Remove ProcessDemo, rewrite steps/benefits |
| `src/pages/Pricing.tsx` | Simplify design, add disclaimer, fix "never expire" |
| `src/pages/AboutUs.tsx` | Complete rewrite with company info and disclaimers |
| `src/pages/PrivacyPolicy.tsx` | Add document handling, payment processor sections |
| `src/pages/TermsAndConditions.tsx` | Add strong disclaimer section at top |
| `src/pages/RefundPolicy.tsx` | Add service delivery statement |
| `src/pages/Contact.tsx` | Simplify, ensure professional tone |
| `src/i18n/locales/en/landing.json` | Complete content rewrite |
| `src/i18n/locales/*/landing.json` | Update all 6 other languages |
| `src/components/Footer.tsx` | Remove any trust claims |
| `src/App.tsx` | Add route for /use-cases |

## New Files to Create

| File | Purpose |
|------|---------|
| `src/pages/UseCases.tsx` | Responsibly framed use cases page |

---

## Expected Outcomes

After implementation:
1. Website appears clearly human-written and professional
2. No accuracy or guarantee claims anywhere
3. Strong disclaimers on all relevant pages
4. Service positioned as informational tool only
5. User responsibility emphasized throughout
6. Clean, minimal design without AI-generated aesthetics
7. All legal pages accessible and compliant
8. Payment processor disclosure added
9. Academic misconduct clearly prohibited in Terms
10. Suitable for manual review by Stripe, Wise, Mollie, Airwallex, Viva

