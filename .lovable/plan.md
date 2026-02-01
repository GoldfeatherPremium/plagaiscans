
# Airwallex Compliance Updates

## Summary
Update website legal pages to meet Airwallex payment integration requirements. Airwallex requires: business details display, clear terms & conditions, refund policy, privacy policy, and consistent company information throughout.

## Issues Found

### 1. Missing "Goldfeather Prem Ltd" Reference
The Refund Policy page still contains "Goldfeather Prem Ltd" at line 276 - this was missed in the previous update.

### 2. Missing Airwallex-Required Business Details
According to Airwallex documentation, the following must be clearly displayed:
- Company registration number (missing)
- Physical business address (missing)
- Phone number (optional but recommended)

### 3. Payment Processor Not Disclosed
Privacy Policy should disclose Airwallex as a payment processor under "Third-Party Services"

### 4. Service Delivery Terms Missing
Terms & Conditions should clarify digital service delivery (no physical shipping)

---

## Files to Update

| File | Changes |
|------|---------|
| `src/pages/RefundPolicy.tsx` | Fix remaining "Goldfeather Prem Ltd" reference |
| `src/pages/TermsAndConditions.tsx` | Add company registration number, add service delivery section |
| `src/pages/PrivacyPolicy.tsx` | Add Airwallex as payment processor, add registration details |
| `src/pages/AboutUs.tsx` | Add company registration number |
| `src/pages/Contact.tsx` | Add company registration number and address |
| `src/components/Footer.tsx` | Add registration number to footer |

---

## Implementation Details

### 1. RefundPolicy.tsx (Line 276)
Replace "Goldfeather Prem Ltd" with "Plagaiscans Technologies Ltd"

### 2. TermsAndConditions.tsx
Add new section "Service Delivery":
- Credits are delivered instantly upon payment confirmation
- Digital service - no physical shipping required
- Service available 24/7 through our online platform

Add to Introduction section:
- Company Registration Number: [Your UK Company Number]

### 3. PrivacyPolicy.tsx
Update "Third-Party Services" section to include:
- Airwallex for secure payment processing
- Card details handled directly by payment providers

Add to "Data Controller" section:
- Company Registration Number

### 4. AboutUs.tsx
Add to "Company Information" card:
- Company Registration Number
- Registered Address (if available)

### 5. Contact.tsx
Add to company info card:
- Company Registration Number
- Registered Address

### 6. Footer.tsx
Update footer bottom section to include:
- Company Registration Number

---

## Sample Changes Preview

### Terms & Conditions - New Section
```text
Service Delivery

Our services are delivered digitally:
- Credits are added to your account instantly upon successful payment
- Analysis reports are generated within minutes of document submission
- All services are accessible through our web platform 24/7
- No physical shipping is involved in our service delivery
```

### Privacy Policy - Payment Processor Update
```text
Payment Processors: We use trusted payment processors including 
Airwallex to securely process payments. Card details are handled 
directly by these payment providers and are not stored on our servers.
```

### Contact Information Format
```text
Company: Plagaiscans Technologies Ltd
Registration No: [Your UK Company Number]
Address: [Your Registered Address]
Country: United Kingdom
Email: support@plagaiscans.com
```

---

## Important Note

You will need to provide the following information that I cannot generate:
1. **UK Company Registration Number** (Companies House number, format: 8-digit number)
2. **Registered Business Address** (required by Airwallex)

These are legally required for payment processor compliance and cannot be made up.

---

## Verification Checklist (Post-Implementation)

After changes are made, verify:
1. All pages show consistent company name "Plagaiscans Technologies Ltd"
2. Company registration number appears on Terms, Privacy, About, Contact, and Footer
3. Airwallex is mentioned as a payment processor in Privacy Policy
4. Service delivery terms are clear in Terms & Conditions
5. Refund policy clearly states 14-day window and process
6. Contact information is complete with all required details

This ensures Airwallex compliance for:
- Business details displayed requirement
- Website terms & conditions requirement
- Clear refund/shipping policy requirement
