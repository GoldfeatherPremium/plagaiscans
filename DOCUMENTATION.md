# PlagaiScans - Complete Platform Documentation

## Overview

PlagaiScans is a comprehensive document similarity and AI content detection platform. The platform enables customers to submit documents for analysis, with staff members processing documents and administrators managing the entire system.

**Disclaimer**: This service is provided for informational and research purposes only.

---

## Table of Contents

1. [Architecture](#architecture)
2. [User Roles & Permissions](#user-roles--permissions)
3. [Features by Role](#features-by-role)
4. [Database Schema](#database-schema)
5. [Edge Functions](#edge-functions)
6. [Security & RLS Policies](#security--rls-policies)
7. [Integrations](#integrations)
8. [UI Components](#ui-components)

---

## Architecture

### Frontend Stack
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **Routing**: React Router v6
- **State Management**: React Context (AuthContext)
- **Data Fetching**: TanStack Query
- **Charts**: Recharts

### Backend (Lovable Cloud)
- **Database**: PostgreSQL
- **Authentication**: Email/Password authentication
- **Storage**: Two buckets - `documents` (uploads) and `reports` (processed results)
- **Edge Functions**: Serverless functions for email and automation

---

## User Roles & Permissions

### Role Hierarchy

| Role | Description | Access Level |
|------|-------------|--------------|
| **Customer** | End users who upload documents | Basic dashboard, upload, view own documents |
| **Staff** | Process documents and upload reports | Document queue, processing tools |
| **Admin** | Full system management | All features + user/pricing/settings management |

### Key Restrictions

- **Staff**: Can only pick ONE document at a time for processing
- **Admin**: Can pick MULTIPLE documents simultaneously
- **Customers**: Cannot access staff/admin features
- **All roles**: Authenticated access only (no anonymous users)

---

## Features by Role

### 🏠 Landing Page (`/`)
- Hero section with platform introduction
- Services overview (Similarity Detection, AI Detection)
- Pricing section
- About section
- Contact information
- WhatsApp support button

### 👤 Customer Features

#### Dashboard (`/dashboard`)
- Welcome message with user's name
- Credit balance display
- Document statistics cards:
  - Total Documents
  - Pending
  - In Progress
  - Completed
- Quick action buttons (Upload, Buy Credits)

#### Upload Document (`/upload`)
- Drag-and-drop file upload
- Supported formats display
- Credit cost indicator (1 credit per document)
- Exclusion options:
  - Exclude Bibliography
  - Exclude Quotes
  - Exclude Small Matches (with word count)
- Remarks/instructions field
- Real-time upload progress

#### My Documents (`/my-documents`)
- Table view of all submitted documents
- Columns: File Name, Status, Uploaded, Completed, Actions
- Status badges (Pending, In Progress, Completed)
- Download buttons for:
  - Original document
  - Similarity report (when available)
  - AI detection report (when available)
- Percentage display for similarity and AI detection

#### Buy Credits (`/buy-credits`)
- Current credit balance display
- Dynamic pricing packages from database
- Package cards showing:
  - Credit amount
  - Price
  - Features included
- "Buy via WhatsApp" integration
- Step-by-step purchase instructions

#### Profile (`/profile`)
- View/edit personal information:
  - Full Name
  - Email (read-only)
  - Phone Number
- Change password functionality
- Account creation date

### 👷 Staff Features

#### Document Queue (`/document-queue`)
- List of pending documents to process
- Document cards showing:
  - File name
  - Customer name
  - Upload date
  - Time in queue
  - Exclusion settings
  - Customer remarks
- **Pick Document** button (disabled if already processing one)
- Lock indicator for documents being processed by others
- Overdue indicator (based on processing timeout setting)

#### Process Document (in queue)
- Download original document
- Upload similarity report (PDF)
- Upload AI detection report (PDF)
- Enter percentages:
  - Similarity percentage (0-100%)
  - AI detection percentage (0-100%)
- Mark as complete
- Release document (return to queue)

#### My Processed (`/staff-processed`)
- History of documents processed by current staff
- Table with completion dates
- Performance metrics

#### My Stats (`/staff-stats`)
- Personal processing statistics
- Daily/weekly processing charts
- Performance trends

### 🔧 Admin Features

#### All Customer/Staff Features
- Admins have access to all features above
- Can pick multiple documents (no single-document limit)

#### User Management (`/admin/users`)
- Search users by name/email
- User table with:
  - Name, Email, Phone
  - Credit Balance
  - Account creation date
- Credit management:
  - Add credits to user
  - Deduct credits from user
- Real-time balance updates

#### Analytics (`/admin/analytics`)
- Overview cards:
  - Total Users
  - Total Documents
  - Pending Documents
  - Completed Documents
- Processing trends:
  - Daily chart (bar graph)
  - Weekly chart (bar graph)
- Document status distribution (pie chart)
- Staff performance ranking:
  - Documents processed count
  - Visual progress bars

#### Pricing Management (`/admin/pricing`)
- View all pricing packages
- Add new package:
  - Credit amount
  - Price
- Edit existing packages
- Toggle package active/inactive status
- Delete packages

#### Settings (`/admin/settings`)
- **WhatsApp Configuration**:
  - Set WhatsApp number for credit purchases
- **Processing Timeout**:
  - Set minutes before documents become "overdue"
  - Affects auto-release function
- **User Role Assignment**:
  - Search and select user
  - Assign role (Admin/Staff/Customer)
- **Broadcast Notifications**:
  - Send notifications to all users
  - Title and message fields

#### Staff Work Monitor (`/admin/staff-work`)
- Real-time staff activity monitoring
- Summary cards:
  - Today's processing count
  - This week's count
  - Active staff count
- Daily/weekly processing charts
- Staff performance table by day
- Recent processed documents list
- Filter by specific staff member

---

## Database Schema

### Tables

#### `profiles`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | User ID (matches auth.users) |
| email | TEXT | User email |
| full_name | TEXT | User's full name |
| phone | TEXT | Phone number |
| credit_balance | INTEGER | Available credits (default: 0) |
| created_at | TIMESTAMP | Account creation date |
| updated_at | TIMESTAMP | Last update date |

#### `documents`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Document ID |
| user_id | UUID (FK) | Owner's user ID |
| file_name | TEXT | Original file name |
| file_path | TEXT | Storage path |
| status | ENUM | pending/in_progress/completed |
| assigned_staff_id | UUID | Currently assigned staff |
| assigned_at | TIMESTAMP | When assigned |
| completed_at | TIMESTAMP | When completed |
| similarity_percentage | DECIMAL | Result (0-100) |
| ai_percentage | DECIMAL | AI detection result (0-100) |
| similarity_report_path | TEXT | Report storage path |
| ai_report_path | TEXT | AI report storage path |
| remarks | TEXT | Customer instructions |
| error_message | TEXT | Any processing errors |
| uploaded_at | TIMESTAMP | Upload date |
| updated_at | TIMESTAMP | Last update |

#### `user_roles`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Role assignment ID |
| user_id | UUID (FK) | User ID |
| role | ENUM | admin/staff/customer |
| created_at | TIMESTAMP | Assignment date |

#### `activity_logs`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Log entry ID |
| staff_id | UUID (FK) | Staff who performed action |
| document_id | UUID (FK) | Related document |
| action | TEXT | Action type (picked/completed/released) |
| created_at | TIMESTAMP | Action timestamp |

#### `notifications`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Notification ID |
| title | TEXT | Notification title |
| message | TEXT | Notification content |
| created_by | UUID | Admin who created it |
| is_active | BOOLEAN | Currently active |
| created_at | TIMESTAMP | Creation date |

#### `notification_reads`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Read record ID |
| notification_id | UUID (FK) | Notification reference |
| user_id | UUID (FK) | User who read it |
| read_at | TIMESTAMP | When read |

#### `pricing_packages`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Package ID |
| credits | INTEGER | Number of credits |
| price | DECIMAL | Price in currency |
| is_active | BOOLEAN | Available for purchase |
| created_at | TIMESTAMP | Creation date |
| updated_at | TIMESTAMP | Last update |

#### `settings`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Setting ID |
| key | TEXT | Setting name |
| value | TEXT | Setting value |
| updated_at | TIMESTAMP | Last update |

### Enums

```sql
-- User roles
CREATE TYPE app_role AS ENUM ('admin', 'staff', 'customer');

-- Document status
CREATE TYPE document_status AS ENUM ('pending', 'in_progress', 'completed');
```

---

## Edge Functions

### `send-completion-email`
**Trigger**: Called when document processing is completed

**Functionality**:
- Fetches user email from profiles
- Sends formatted email with:
  - Document name
  - Similarity percentage
  - AI detection percentage
  - Instructions to download reports

**Integration**: Resend API

### `send-password-reset`
**Trigger**: Called when user requests password reset

**Functionality**:
- Validates email exists in system
- Generates secure reset link
- Sends branded reset email

**Integration**: Resend API + Supabase Auth

### `auto-release-documents`
**Trigger**: Scheduled cron job

**Functionality**:
- Checks for documents with `in_progress` status
- Compares `assigned_at` against `processing_timeout_minutes` setting
- Automatically releases overdue documents back to queue
- Logs release actions

**Configuration**: Timeout configurable in Admin Settings

---

## Security & RLS Policies

### Authentication
- Email/password authentication only
- Auto-confirm email enabled
- No anonymous sign-ups
- Session-based authentication

### Row Level Security

#### Profiles Table
- Users can view and update their own profile
- Admins can view all profiles
- Staff can view customer profiles (for document processing)

#### Documents Table
- Customers can view/create their own documents
- Staff can view pending documents and their assigned documents
- Admins can view all documents

#### User Roles Table
- Only admins can modify roles
- Users can view their own role

#### Activity Logs
- Staff can create logs for their actions
- Admins can view all logs

#### Notifications
- All authenticated users can read notifications
- Only admins can create notifications

#### Pricing Packages
- All users can view active packages
- Only admins can create/update/delete packages

#### Settings
- Only admins can view/modify settings

### Database Functions

```sql
-- Check if user has specific role
has_role(user_id UUID, role app_role) RETURNS BOOLEAN

-- Get user's role
get_user_role(user_id UUID) RETURNS app_role
```

---

## Integrations

### WhatsApp
- **Support Button**: Fixed bottom-right corner on landing page
- **Credit Purchase**: Opens WhatsApp with pre-filled message
- **Number Configuration**: Set in Admin Settings

### Email (Resend)
- Document completion notifications
- Password reset emails
- Branded HTML templates

---

## UI Components

### Layout Components
- `DashboardLayout`: Main authenticated layout wrapper
- `DashboardSidebar`: Navigation with role-based menu items
- `Navigation`: Landing page navigation
- `Footer`: Site footer

### Common Components
- `StatusBadge`: Document status indicator
- `CreditBalanceHeader`: Shows current credit balance
- `NotificationBell`: Real-time notification dropdown
- `WhatsAppButton`: Fixed support button
- `WhatsAppSupportButton`: Alternative WhatsApp trigger

### Design System
- **Primary Color**: Blue (#2563eb)
- **Font**: System default with custom display font
- **Theme**: Light/Dark mode support via CSS variables

### Responsive Design
- Mobile-first approach
- Collapsible sidebar on mobile
- Responsive tables and cards
- Touch-friendly interactions

---

## Storage Buckets

### `documents` (Private)
- Stores uploaded customer documents
- Path format: `{user_id}/{document_id}/{filename}`
- Access: Owner + Staff + Admin

### `reports` (Private)
- Stores processed reports (similarity + AI)
- Path format: `{document_id}/{report_type}/{filename}`
- Access: Document owner + Staff + Admin

---

## Environment Variables

```env
VITE_SUPABASE_URL=<project_url>
VITE_SUPABASE_PUBLISHABLE_KEY=<anon_key>
VITE_SUPABASE_PROJECT_ID=<project_id>
```

### Secrets (Edge Functions)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`

---

## Routes Summary

| Route | Access | Description |
|-------|--------|-------------|
| `/` | Public | Landing page |
| `/auth` | Public | Login/Register |
| `/pricing` | Public | Pricing page |
| `/about-us` | Public | About page |
| `/privacy-policy` | Public | Privacy policy |
| `/terms-and-conditions` | Public | Terms of service |
| `/refund-policy` | Public | Refund policy |
| `/contact` | Public | Contact page |
| `/dashboard` | Authenticated | User dashboard |
| `/upload` | Customer/Admin | Upload documents |
| `/my-documents` | Customer/Admin | View own documents |
| `/buy-credits` | Customer/Admin | Purchase credits |
| `/profile` | Authenticated | User profile |
| `/document-queue` | Staff/Admin | Process documents |
| `/staff-processed` | Staff/Admin | Processed documents |
| `/staff-stats` | Staff/Admin | Personal stats |
| `/admin/users` | Admin | User management |
| `/admin/analytics` | Admin | Platform analytics |
| `/admin/pricing` | Admin | Pricing management |
| `/admin/settings` | Admin | System settings |
| `/admin/staff-work` | Admin | Staff monitoring |

---

## Legal Information

**Trading Name**: PlagaiScans  
**Legal Entity**: Goldfeather Prem Ltd  
**Country**: United Kingdom

**Disclaimer**: This service is provided for informational and research purposes only.

---

**Platform**: PlagaiScans v1.0  
**Last Updated**: December 2024  
**Built with**: Lovable Cloud