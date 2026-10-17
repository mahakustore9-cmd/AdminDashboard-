-- ==============================================================================
-- MAHAKU CORPORATION PVT. LTD. - STUDENT SAFETY TRACKING SYSTEM
-- Migration: 001_initial_schema.sql
-- Multi-School Student Tracking & QR ID Card System
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. SCHOOLS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_code TEXT NOT NULL UNIQUE,
    school_name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    phone TEXT,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_schools_status ON public.schools(status);
CREATE INDEX IF NOT EXISTS idx_schools_code ON public.schools(school_code);

-- ==============================================================================
-- 2. USER PROFILES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    is_super_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_super_admin ON public.profiles(is_super_admin) WHERE is_super_admin = true;

-- ==============================================================================
-- 3. USER SCHOOL ROLES TABLE
-- Roles: 'school_admin', 'parent', 'guard', 'teacher'
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_school_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('school_admin', 'parent', 'guard', 'teacher')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_user_school_role UNIQUE (user_id, school_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_school_roles_user ON public.user_school_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_school_roles_school ON public.user_school_roles(school_id);
CREATE INDEX IF NOT EXISTS idx_user_school_roles_role ON public.user_school_roles(role);

-- ==============================================================================
-- 4. SCHOOL CLASSES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.school_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    class_name TEXT NOT NULL,
    section TEXT NOT NULL DEFAULT 'A',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_school_class_section UNIQUE (school_id, class_name, section)
);

CREATE INDEX IF NOT EXISTS idx_school_classes_school ON public.school_classes(school_id);

-- ==============================================================================
-- 5. STUDENTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    admission_number TEXT NOT NULL,
    full_name TEXT NOT NULL,
    student_class TEXT NOT NULL,
    section TEXT NOT NULL DEFAULT 'A',
    roll_number TEXT,
    date_of_birth DATE,
    gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
    blood_group TEXT,
    address TEXT,
    qr_token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_school_admission UNIQUE (school_id, admission_number)
);

CREATE INDEX IF NOT EXISTS idx_students_school ON public.students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_admission ON public.students(school_id, admission_number);
CREATE INDEX IF NOT EXISTS idx_students_class_section ON public.students(school_id, student_class, section);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students(school_id, status);
CREATE INDEX IF NOT EXISTS idx_students_qr_token ON public.students(qr_token);
CREATE INDEX IF NOT EXISTS idx_students_name_search ON public.students USING gin (to_tsvector('english', full_name));

-- ==============================================================================
-- 6. STUDENT PHOTOS TABLE (Private Storage Reference)
-- Never store Base64 or raw URLs in students table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.student_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_size_bytes INTEGER,
    mime_type TEXT DEFAULT 'image/webp',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_student_photo UNIQUE (student_id)
);

CREATE INDEX IF NOT EXISTS idx_student_photos_student ON public.student_photos(student_id);
CREATE INDEX IF NOT EXISTS idx_student_photos_school ON public.student_photos(school_id);

-- ==============================================================================
-- 7. STUDENT GUARDIANS TABLE (Parent-Student Link)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.student_guardians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    guardian_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    relationship TEXT NOT NULL DEFAULT 'Parent',
    is_primary BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_student_guardian UNIQUE (student_id, guardian_user_id)
);

CREATE INDEX IF NOT EXISTS idx_student_guardians_student ON public.student_guardians(student_id);
CREATE INDEX IF NOT EXISTS idx_student_guardians_user ON public.student_guardians(guardian_user_id);

-- ==============================================================================
-- 8. HELPER SECURITY DEFINER FUNCTIONS (Prevents RLS Recursion)
-- ==============================================================================

-- Check if current authenticated user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT COALESCE(
        (SELECT is_super_admin FROM public.profiles WHERE id = check_user_id),
        false
    );
$$;

-- Check if a school is currently active
CREATE OR REPLACE FUNCTION public.is_active_school(check_school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.schools
        WHERE id = check_school_id AND status = 'active'
    );
$$;

-- Check if user has active role in school and school itself is active
CREATE OR REPLACE FUNCTION public.has_active_school_role(
    check_school_id UUID,
    required_role TEXT,
    check_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_school_roles usr
        JOIN public.schools s ON s.id = usr.school_id
        WHERE usr.user_id = check_user_id
          AND usr.school_id = check_school_id
          AND usr.role = required_role
          AND usr.status = 'active'
          AND s.status = 'active'
    );
$$;

-- Get list of school IDs the user is authorized for with active status
CREATE OR REPLACE FUNCTION public.get_user_active_school_ids(check_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(school_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT usr.school_id
    FROM public.user_school_roles usr
    JOIN public.schools s ON s.id = usr.school_id
    WHERE usr.user_id = check_user_id
      AND usr.status = 'active'
      AND s.status = 'active';
$$;

-- Check if user is guardian of a student in an active school
CREATE OR REPLACE FUNCTION public.is_guardian_of_student(
    check_student_id UUID,
    check_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.student_guardians sg
        JOIN public.students st ON st.id = sg.student_id
        JOIN public.schools s ON s.id = st.school_id
        WHERE sg.guardian_user_id = check_user_id
          AND sg.student_id = check_student_id
          AND s.status = 'active'
    );
$$;

-- ==============================================================================
-- 9. AUTOMATIC USER PROFILE TRIGGER
-- Sync auth.users into public.profiles
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, phone, is_super_admin)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'User'),
        NEW.raw_user_meta_data->>'phone',
        COALESCE((NEW.raw_user_meta_data->>'is_super_admin')::boolean, false)
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ==============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- Strict multi-school isolation and role enforcement
-- ==============================================================================

-- Enable RLS on all application tables
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_school_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- A. SCHOOLS POLICIES
-- ------------------------------------------------------------------------------
-- Super Admin can do everything on schools
CREATE POLICY "Super Admins have full access to schools"
    ON public.schools
    FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- School users can view their own school if active
CREATE POLICY "School users can view their active school"
    ON public.schools
    FOR SELECT
    TO authenticated
    USING (
        id IN (SELECT public.get_user_active_school_ids())
    );

-- ------------------------------------------------------------------------------
-- B. PROFILES POLICIES
-- ------------------------------------------------------------------------------
-- Super Admin has full view of all profiles
CREATE POLICY "Super Admin can view all profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (public.is_super_admin());

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- Users can update own profile (excluding super admin elevation)
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid()
        AND (is_super_admin = (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()))
    );

-- School Admins can view profiles of users linked to their active school
CREATE POLICY "School Admins can view school members profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_school_roles usr
            WHERE usr.user_id = public.profiles.id
              AND usr.school_id IN (
                  SELECT school_id FROM public.user_school_roles
                  WHERE user_id = auth.uid() AND role = 'school_admin' AND status = 'active'
              )
        )
    );

-- ------------------------------------------------------------------------------
-- C. USER SCHOOL ROLES POLICIES
-- ------------------------------------------------------------------------------
-- Super Admin full access
CREATE POLICY "Super Admin has full access to roles"
    ON public.user_school_roles
    FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- School Admins can view roles for their school
CREATE POLICY "School Admins can view their school roles"
    ON public.user_school_roles
    FOR SELECT
    TO authenticated
    USING (
        public.has_active_school_role(school_id, 'school_admin')
    );

-- School Admins can insert/update roles for parent/guard/teacher only (never school_admin or super_admin)
CREATE POLICY "School Admins can manage school members"
    ON public.user_school_roles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_active_school_role(school_id, 'school_admin')
        AND role IN ('parent', 'guard', 'teacher')
    );

CREATE POLICY "School Admins can update school members"
    ON public.user_school_roles
    FOR UPDATE
    TO authenticated
    USING (
        public.has_active_school_role(school_id, 'school_admin')
        AND role IN ('parent', 'guard', 'teacher')
    )
    WITH CHECK (
        public.has_active_school_role(school_id, 'school_admin')
        AND role IN ('parent', 'guard', 'teacher')
    );

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
    ON public.user_school_roles
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- D. SCHOOL CLASSES POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Super Admin class access"
    ON public.school_classes
    FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE POLICY "School Admin manage classes"
    ON public.school_classes
    FOR ALL
    TO authenticated
    USING (public.has_active_school_role(school_id, 'school_admin'))
    WITH CHECK (public.has_active_school_role(school_id, 'school_admin'));

CREATE POLICY "School members view classes"
    ON public.school_classes
    FOR SELECT
    TO authenticated
    USING (
        school_id IN (SELECT public.get_user_active_school_ids())
    );

-- ------------------------------------------------------------------------------
-- E. STUDENTS POLICIES
-- ------------------------------------------------------------------------------
-- Super Admin full access
CREATE POLICY "Super Admin full students access"
    ON public.students
    FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- School Admin full access for their active school
CREATE POLICY "School Admin manage students"
    ON public.students
    FOR ALL
    TO authenticated
    USING (public.has_active_school_role(school_id, 'school_admin'))
    WITH CHECK (public.has_active_school_role(school_id, 'school_admin'));

-- Teachers and Guards can read active students in their active school
CREATE POLICY "Teachers and Guards view students"
    ON public.students
    FOR SELECT
    TO authenticated
    USING (
        (public.has_active_school_role(school_id, 'teacher') OR public.has_active_school_role(school_id, 'guard'))
        AND status = 'active'
    );

-- Parents can view only their linked students
CREATE POLICY "Parents view linked students"
    ON public.students
    FOR SELECT
    TO authenticated
    USING (
        public.is_guardian_of_student(id)
    );

-- ------------------------------------------------------------------------------
-- F. STUDENT PHOTOS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Super Admin photos access"
    ON public.student_photos
    FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE POLICY "School Admin manage photos"
    ON public.student_photos
    FOR ALL
    TO authenticated
    USING (public.has_active_school_role(school_id, 'school_admin'))
    WITH CHECK (public.has_active_school_role(school_id, 'school_admin'));

CREATE POLICY "School staff view student photos"
    ON public.student_photos
    FOR SELECT
    TO authenticated
    USING (
        public.has_active_school_role(school_id, 'teacher')
        OR public.has_active_school_role(school_id, 'guard')
    );

CREATE POLICY "Parents view their student photos"
    ON public.student_photos
    FOR SELECT
    TO authenticated
    USING (
        public.is_guardian_of_student(student_id)
    );

-- ------------------------------------------------------------------------------
-- G. STUDENT GUARDIANS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Super Admin guardians access"
    ON public.student_guardians
    FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE POLICY "School Admin manage guardians"
    ON public.student_guardians
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = public.student_guardians.student_id
              AND public.has_active_school_role(s.school_id, 'school_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = public.student_guardians.student_id
              AND public.has_active_school_role(s.school_id, 'school_admin')
        )
    );

CREATE POLICY "Parents view own links"
    ON public.student_guardians
    FOR SELECT
    TO authenticated
    USING (guardian_user_id = auth.uid());

-- ==============================================================================
-- 11. SUPABASE STORAGE SETUP & ACCESS POLICIES
-- Bucket: 'student-photos' (Private)
-- Object path: '<school_id>/<student_id>/<random_uuid>.<ext>'
-- ==============================================================================

-- Create bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'student-photos',
    'student-photos',
    false,
    51200, -- 50 KB hard storage limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 51200,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Storage RLS: Super admin full access
CREATE POLICY "Super Admin full storage access"
    ON storage.objects
    FOR ALL
    TO authenticated
    USING (
        bucket_id = 'student-photos' AND public.is_super_admin()
    )
    WITH CHECK (
        bucket_id = 'student-photos' AND public.is_super_admin()
    );

-- Storage RLS: School Admin can upload photos for their own school
CREATE POLICY "School Admin upload student photos"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'student-photos'
        AND public.has_active_school_role((storage.foldername(name))[1]::uuid, 'school_admin')
    );

CREATE POLICY "School Admin update/delete student photos"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'student-photos'
        AND public.has_active_school_role((storage.foldername(name))[1]::uuid, 'school_admin')
    );

CREATE POLICY "School Admin delete student photos"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'student-photos'
        AND public.has_active_school_role((storage.foldername(name))[1]::uuid, 'school_admin')
    );

-- Storage RLS: Authorized school members and parents can read student photos
CREATE POLICY "Authorized users read student photos"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'student-photos'
        AND (
            public.is_super_admin()
            OR public.has_active_school_role((storage.foldername(name))[1]::uuid, 'school_admin')
            OR public.has_active_school_role((storage.foldername(name))[1]::uuid, 'teacher')
            OR public.has_active_school_role((storage.foldername(name))[1]::uuid, 'guard')
            OR public.is_guardian_of_student((storage.foldername(name))[2]::uuid)
        )
    );

-- ==============================================================================
-- 12. INITIAL BOOTSTRAP INSTRUCTIONS (Run in Supabase SQL Editor)
-- ==============================================================================
-- To bootstrap your initial Super Admin:
-- 1. Create a user via Supabase Dashboard -> Authentication -> Users (e.g. admin@mahaku.in)
-- 2. Execute the following SQL with your user's email:
--
-- UPDATE public.profiles
-- SET is_super_admin = true
-- WHERE email = 'admin@mahaku.in';
--
-- Or via SQL insert with user UUID:
-- INSERT INTO public.profiles (id, email, full_name, is_super_admin)
-- VALUES ('<YOUR_AUTH_USER_UUID>', 'admin@mahaku.in', 'System Super Admin', true)
-- ON CONFLICT (id) DO UPDATE SET is_super_admin = true;
-- ==============================================================================
