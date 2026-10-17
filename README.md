# MAHAKU CORPORATION PVT. LTD.
## STUDENT SAFETY TRACKING SYSTEM — ADMIN PWA

A production-oriented, mobile-first Progressive Web App (PWA) built with **React, TypeScript, Vite, and Supabase** for multi-school student tracking, safety QR ID badge administration, and parent/guard/teacher account provisioning.

---

## 🌟 Key Architecture & Features

1. **Super Admin Dashboard**:
   - High-level system overview: Total registered schools, active/inactive breakdown, total enrolled students, total school administrators, and storage footprint.
   - School onboarding, editing, and activation/deactivation.
   - Assign and provision authorized School Administrators.
   - Storage quota monitor tracking the strict ≤50 KB compression policy.

2. **School Admin Campus Portal**:
   - Multi-tenant school isolation enforced at database level via Postgres Row Level Security (RLS).
   - Student Admission with client-side canvas photo compression (Strict ≤50 KB limit).
   - Dynamic, collision-resistant opaque QR token generation (`mhk_sec_<random-hex>`).
   - High-resolution printable Student Safety ID Cards (Dual portrait badge & landscape credit card format).
   - WhatsApp dispatching of login instructions to Parents, Guards, and Teachers.
   - Parent-Student linking (`student_guardians`) enabling guardian child access.
   - Academic Classes and Sections manager with 1-click K-12 standard grade seeder.
   - RFC-4180 compliant CSV export with UTF-8 BOM for Microsoft Excel.

3. **Progressive Web App (PWA)**:
   - Modern Service Worker with offline caching for fonts and static assets.
   - Custom in-app Install Button handling browser `beforeinstallprompt` and iOS Safari "Add to Home Screen" guided instructions.
   - Compliant `192x192`, `512x512`, and `maskable` home-screen icons.

4. **Security & Storage Integrity**:
   - **Never exposes the Supabase service_role key to the browser.**
   - Only the public `anon` key is used with database-level RLS policies.
   - Photos are saved in a **private** Supabase bucket (`student-photos`) and viewed strictly through 1-hour short-lived signed URLs.
   - Base64 images and photo URLs are never stored in the database.

---

## 🚀 Beginner-Friendly Setup Guide (Step-by-Step)

### Step 1: Create a Free Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and create an account.
2. Click **New Project**, choose an organization, set a project name (e.g., `mahaku-safety-system`), and select a database region close to your users (e.g., `South Asia - Mumbai` for India).
3. Wait ~2 minutes for the database to provision.

### Step 2: Run the SQL Schema Migration
1. In your Supabase Dashboard, click on **SQL Editor** in the left sidebar.
2. Click **New Query**.
3. Open the file `supabase/migrations/001_initial_schema.sql` from this project.
4. Copy its entire content, paste it into the Supabase SQL Editor, and click **Run**.
5. This creates all 7 tables (`schools`, `profiles`, `user_school_roles`, `students`, `student_photos`, `student_guardians`, `school_classes`), RLS policies, indexes, and sets up the private `student-photos` storage bucket with its 50 KB cap.

### Step 3: Create your First Super Admin User
1. In Supabase Dashboard, go to **Authentication** -> **Users** -> click **Add User** -> **Create User**.
2. Enter an email (e.g. `admin@mahaku.in`) and a secure password.
3. Once created, go back to the **SQL Editor** and run this command:
   ```sql
   UPDATE public.profiles
   SET is_super_admin = true
   WHERE email = 'admin@mahaku.in';
   ```
4. This user is now authorized as a **Super Administrator**!

### Step 4: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Open `.env` and fill in your Supabase credentials (found in Supabase Dashboard -> **Project Settings** -> **API**):
```env
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsIn..."
VITE_APP_URL="http://localhost:3000"
```
*(Note: You can also enter and test these credentials directly inside the app UI by clicking the "Database" button in the top navigation bar!)*

### Step 5: Deploy the Server-Side Edge Function (Account Provisioning)
To allow Super Admins and School Admins to create accounts for other users safely without exposing the service_role key to the browser:
```bash
# 1. Install Supabase CLI
npm install -g supabase

# 2. Login to Supabase CLI
supabase login

# 3. Link your project
supabase link --project-ref <your-supabase-project-id>

# 4. Deploy the provision-user function
supabase functions deploy provision-user --no-verify-jwt
```
In Supabase Dashboard -> **Edge Functions** -> **Secrets**, verify that `SUPABASE_SERVICE_ROLE_KEY` is present.

---

## 💻 Running the Application Locally

```bash
# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 📱 Progressive Web App (PWA) Testing
- **Chrome / Edge on Desktop**: Look for the "Install App" button in the header or the address bar install icon.
- **Android**: Tap the "Install App" button in the header to add the app directly to your device home screen with standalone native window display.
- **iPhone / Safari**: Tap "Install on iOS" to follow the step-by-step visual guide (Share -> Add to Home Screen).

---

## 🔒 Security Checklist
- [x] **No Service Role in Browser**: Only publishable anon key is used in frontend code.
- [x] **RLS on All Tables**: Row Level Security enabled on all 7 tables.
- [x] **Data Isolation**: A School Admin from School A can never query or modify records of School B.
- [x] **Deactivation Enforcement**: Deactivated schools are blocked both in the client and by database RLS helper functions.
- [x] **Private Photo Storage**: Photos cannot be fetched through public URLs; only temporary 1-hour signed URLs are issued to verified users.
- [x] **Strict 50 KB Limit**: Client-side canvas compression downscales and verifies file size before upload; storage bucket rules enforce 51,200 bytes limit.
- [x] **Opaque QR Tokens**: QR code contains an opaque random string (`mhk_sec_...`), never exposing student personal PII to public camera scanners.

---

## 🌐 Deploying to Vercel
1. Push this repository to GitHub or GitLab.
2. Sign in to [Vercel](https://vercel.com) and click **Add New Project**.
3. Import your repository.
4. In the **Environment Variables** section, add:
   - `VITE_SUPABASE_URL`: Your Supabase URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Key
   - `VITE_APP_URL`: Your Vercel deployment URL (e.g. `https://mahaku-safety.vercel.app`)
5. Click **Deploy**. Vercel will build the Vite React application and deploy the PWA globally with automatic SSL.
