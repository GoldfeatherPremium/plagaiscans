

## Pre-Register and Add Credits to New Accounts by Email

This feature allows admins to create user accounts that don't exist yet, auto-generate a password, add credits, and send a welcome email with login credentials -- all from the Admin Users page.

### How It Will Work

1. Admin enters an email address on the User Management page
2. If the email is not yet registered, the system creates the account with an auto-generated password
3. Credits are added (with optional expiry) and a credit validity record is created
4. A branded email is sent to the customer containing: email, generated password, login link, number of credits, and validity period
5. The user list refreshes to show the new user

### Implementation Details

#### 1. New Edge Function: `create-user-with-credits`

A new backend function that handles the entire flow server-side:

- Accepts: `email`, `creditAmount`, `creditType` (full/similarity_only), `expiryDays` (optional)
- Checks if email already exists in profiles -- if so, returns an error asking admin to use the existing credit management
- Generates a secure random password (12 characters, mixed case + digits + special chars)
- Uses `supabase.auth.admin.createUser()` to create the account with email confirmed
- Inserts a profile record and assigns the "customer" role
- Updates the credit balance on the profile
- Creates a `credit_transaction` record
- If expiry is set, creates a `credit_validity` record
- Sends a branded email via Sender.net with login credentials, credit info, and a login link
- Returns success/failure to the admin UI

Config: `verify_jwt = false` in `supabase/config.toml` (auth validated in code)

#### 2. New UI Component: `PreRegisterCreditDialog`

A dialog component with the following fields:

- **Email** (required) -- the customer's email address
- **Credit Type** toggle -- Full Credits / Similarity Credits
- **Credit Amount** (required) -- number of credits to add
- **Expiry Date** (optional) -- calendar picker with quick presets (30d, 60d, 90d)

The dialog shows a confirmation summary before submitting. On success, it shows a toast with the generated password for admin reference.

#### 3. AdminUsers Page Update

- Add a new "Pre-Register User" button at the top of the Users tab (next to the search bar)
- Clicking it opens the `PreRegisterCreditDialog`
- On success, the user list is refreshed

#### 4. Email Template

The email sent to the new user will include:

- A welcome header with the Plagaiscans branding
- Login credentials: email and generated password
- A prominent "Login Now" button linking to the auth page
- Credit details: number of credits and type (Full/Similarity)
- Validity period (if set)
- A note to change password after first login
- Standard Plagaiscans footer

### Technical Notes

- The edge function uses `SUPABASE_SERVICE_ROLE_KEY` to create users via the admin API
- Password generation uses `crypto.getRandomValues()` for security
- The function validates admin authorization before proceeding
- Email delivery uses the existing Sender.net integration with logging to `transactional_email_logs`
- No new database tables needed -- uses existing `profiles`, `credit_transactions`, `credit_validity`, and `user_roles` tables

