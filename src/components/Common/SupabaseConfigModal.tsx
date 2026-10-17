import React, { useState } from 'react';
import { Database, Copy, Check, ExternalLink, X, RefreshCw, Key, ShieldCheck, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  getSupabaseCredentials,
  saveSupabaseCredentials,
  reinitializeSupabase,
  clearSupabaseCredentials
} from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({ isOpen, onClose }) => {
  const { refreshAuth, isConfigured } = useAuth();
  const current = getSupabaseCredentials();

  const [url, setUrl] = useState(current.url);
  const [anonKey, setAnonKey] = useState(current.anonKey);
  const [activeTab, setActiveTab] = useState<'config' | 'migration' | 'bootstrap'>('config');
  const [statusState, setStatusState] = useState<'idle' | 'success' | 'migration_needed' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [copiedMigration, setCopiedMigration] = useState(false);
  const [copiedBootstrap, setCopiedBootstrap] = useState(false);

  if (!isOpen) return null;

  const handleSaveAndTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    setStatusMessage(null);
    setStatusState('idle');

    // 1. Sanitize URL (removes trailing slashes, accidental /rest/v1 copy-pastes)
    let cleanUrl = url.trim().replace(/\/+$/, '');
    cleanUrl = cleanUrl.replace(/\/rest\/v1\/?$/, '');
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }
    const cleanKey = anonKey.trim();

    setUrl(cleanUrl);
    setAnonKey(cleanKey);

    try {
      saveSupabaseCredentials(cleanUrl, cleanKey);
      const client = reinitializeSupabase();

      // Test connection by querying schools table
      const { error } = await client.from('schools').select('id').limit(1);

      if (error) {
        const errorLower = (error.message || '').toLowerCase();
        const isTableMissing =
          error.code === 'PGRST125' ||
          error.code === 'PGRST204' ||
          error.code === '42P01' ||
          errorLower.includes('invalid path') ||
          errorLower.includes('relation') ||
          errorLower.includes('does not exist');

        if (isTableMissing) {
          // Connected, but tables not yet created in Supabase
          setStatusState('migration_needed');
          setStatusMessage(
            'Connection to Supabase project was successful! However, the database tables have not been created yet.'
          );
        } else if (error.code === 'PGRST301' || errorLower.includes('jwt') || errorLower.includes('api key')) {
          setStatusState('error');
          setStatusMessage('Invalid Supabase Anon Key. Please re-check your Project API key in Supabase Dashboard.');
        } else {
          setStatusState('error');
          setStatusMessage(`Connected, but received: ${error.message}`);
        }
      } else {
        setStatusState('success');
        setStatusMessage('Success! Connected and verified connection to Supabase database.');
      }

      await refreshAuth();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown connection error';
      setStatusState('error');
      setStatusMessage(`Connection failed: ${msg}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleReset = () => {
    clearSupabaseCredentials();
    setUrl(import.meta.env.VITE_SUPABASE_URL || '');
    setAnonKey(import.meta.env.VITE_SUPABASE_ANON_KEY || '');
    setStatusState('idle');
    setStatusMessage(null);
    reinitializeSupabase();
    refreshAuth();
  };

  const fullMigrationSQL = `-- ==============================================================================
-- MAHAKU CORPORATION PVT. LTD. - STUDENT SAFETY TRACKING SYSTEM
-- Complete Initial Schema Migration
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. SCHOOLS TABLE
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

-- 2. USER PROFILES TABLE
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

-- 3. USER SCHOOL ROLES TABLE
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

-- 4. SCHOOL CLASSES TABLE
CREATE TABLE IF NOT EXISTS public.school_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    class_name TEXT NOT NULL,
    section TEXT NOT NULL DEFAULT 'A',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_school_class_section UNIQUE (school_id, class_name, section)
);

CREATE INDEX IF NOT EXISTS idx_school_classes_school ON public.school_classes(school_id);

-- 5. STUDENTS TABLE
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

-- 6. STUDENT PHOTOS TABLE
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

-- 7. STUDENT GUARDIANS TABLE
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

-- 8. HELPER SECURITY DEFINER FUNCTIONS
CREATE OR REPLACE FUNCTION public.is_super_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
    SELECT COALESCE((SELECT is_super_admin FROM public.profiles WHERE id = check_user_id), false);
$$;

CREATE OR REPLACE FUNCTION public.is_active_school(check_school_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
    SELECT EXISTS (SELECT 1 FROM public.schools WHERE id = check_school_id AND status = 'active');
$$;

CREATE OR REPLACE FUNCTION public.has_active_school_role(check_school_id UUID, required_role TEXT, check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
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

CREATE OR REPLACE FUNCTION public.get_user_active_school_ids(check_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(school_id UUID) LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
    SELECT usr.school_id FROM public.user_school_roles usr
    JOIN public.schools s ON s.id = usr.school_id
    WHERE usr.user_id = check_user_id AND usr.status = 'active' AND s.status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.is_guardian_of_student(check_student_id UUID, check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.student_guardians sg
        JOIN public.students st ON st.id = sg.student_id
        JOIN public.schools s ON s.id = st.school_id
        WHERE sg.guardian_user_id = check_user_id AND sg.student_id = check_student_id AND s.status = 'active'
    );
$$;

-- 9. PROFILE SYNC TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT OR UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 10. ROW LEVEL SECURITY
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_school_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super Admins have full access to schools" ON public.schools FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "School users can view their active school" ON public.schools FOR SELECT TO authenticated USING (id IN (SELECT public.get_user_active_school_ids()));

CREATE POLICY "Super Admin can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid() AND (is_super_admin = (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid())));
CREATE POLICY "School Admins can view school members profiles" ON public.profiles FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_school_roles usr WHERE usr.user_id = public.profiles.id AND usr.school_id IN (SELECT school_id FROM public.user_school_roles WHERE user_id = auth.uid() AND role = 'school_admin' AND status = 'active'))
);

CREATE POLICY "Super Admin has full access to roles" ON public.user_school_roles FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "School Admins can view their school roles" ON public.user_school_roles FOR SELECT TO authenticated USING (public.has_active_school_role(school_id, 'school_admin'));
CREATE POLICY "School Admins can manage school members" ON public.user_school_roles FOR INSERT TO authenticated WITH CHECK (public.has_active_school_role(school_id, 'school_admin') AND role IN ('parent', 'guard', 'teacher'));
CREATE POLICY "School Admins can update school members" ON public.user_school_roles FOR UPDATE TO authenticated USING (public.has_active_school_role(school_id, 'school_admin') AND role IN ('parent', 'guard', 'teacher')) WITH CHECK (public.has_active_school_role(school_id, 'school_admin') AND role IN ('parent', 'guard', 'teacher'));
CREATE POLICY "Users can view own roles" ON public.user_school_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Super Admin class access" ON public.school_classes FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "School Admin manage classes" ON public.school_classes FOR ALL TO authenticated USING (public.has_active_school_role(school_id, 'school_admin')) WITH CHECK (public.has_active_school_role(school_id, 'school_admin'));
CREATE POLICY "School members view classes" ON public.school_classes FOR SELECT TO authenticated USING (school_id IN (SELECT public.get_user_active_school_ids()));

CREATE POLICY "Super Admin full students access" ON public.students FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "School Admin manage students" ON public.students FOR ALL TO authenticated USING (public.has_active_school_role(school_id, 'school_admin')) WITH CHECK (public.has_active_school_role(school_id, 'school_admin'));
CREATE POLICY "Teachers and Guards view students" ON public.students FOR SELECT TO authenticated USING ((public.has_active_school_role(school_id, 'teacher') OR public.has_active_school_role(school_id, 'guard')) AND status = 'active');
CREATE POLICY "Parents view linked students" ON public.students FOR SELECT TO authenticated USING (public.is_guardian_of_student(id));

CREATE POLICY "Super Admin photos access" ON public.student_photos FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "School Admin manage photos" ON public.student_photos FOR ALL TO authenticated USING (public.has_active_school_role(school_id, 'school_admin')) WITH CHECK (public.has_active_school_role(school_id, 'school_admin'));
CREATE POLICY "School staff view student photos" ON public.student_photos FOR SELECT TO authenticated USING (public.has_active_school_role(school_id, 'teacher') OR public.has_active_school_role(school_id, 'guard'));
CREATE POLICY "Parents view their student photos" ON public.student_photos FOR SELECT TO authenticated USING (public.is_guardian_of_student(student_id));

CREATE POLICY "Super Admin guardians access" ON public.student_guardians FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "School Admin manage guardians" ON public.student_guardians FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = public.student_guardians.student_id AND public.has_active_school_role(s.school_id, 'school_admin'))) WITH CHECK (EXISTS (SELECT 1 FROM public.students s WHERE s.id = public.student_guardians.student_id AND public.has_active_school_role(s.school_id, 'school_admin')));
CREATE POLICY "Parents view own links" ON public.student_guardians FOR SELECT TO authenticated USING (guardian_user_id = auth.uid());

-- 11. STORAGE BUCKET & POLICIES
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('student-photos', 'student-photos', false, 51200, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 51200, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

CREATE POLICY "Super Admin full storage access" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'student-photos' AND public.is_super_admin()) WITH CHECK (bucket_id = 'student-photos' AND public.is_super_admin());
CREATE POLICY "School Admin upload student photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'student-photos' AND public.has_active_school_role((storage.foldername(name))[1]::uuid, 'school_admin'));
CREATE POLICY "School Admin update/delete student photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'student-photos' AND public.has_active_school_role((storage.foldername(name))[1]::uuid, 'school_admin'));
CREATE POLICY "School Admin delete student photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'student-photos' AND public.has_active_school_role((storage.foldername(name))[1]::uuid, 'school_admin'));
CREATE POLICY "Authorized users read student photos" ON storage.objects FOR SELECT TO authenticated USING (
    bucket_id = 'student-photos' AND (
        public.is_super_admin()
        OR public.has_active_school_role((storage.foldername(name))[1]::uuid, 'school_admin')
        OR public.has_active_school_role((storage.foldername(name))[1]::uuid, 'teacher')
        OR public.has_active_school_role((storage.foldername(name))[1]::uuid, 'guard')
        OR public.is_guardian_of_student((storage.foldername(name))[2]::uuid)
    )
);`;

  const bootstrapSQL = `-- ==============================================================================
-- 1-CLICK SUPER ADMIN ACTIVATION
-- Email: mukeshchaudhary15796@gmail.com | Password: Mukesh123
-- Auto-confirms email and grants Super Admin rights immediately
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  v_user_id UUID;
  v_email TEXT := 'mukeshchaudhary15796@gmail.com';
  v_password TEXT := 'Mukesh123';
  v_encrypted_pw TEXT := crypt(v_password, gen_salt('bf', 10));
BEGIN
  -- 1. Check if user already exists in auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NOT NULL THEN
    -- Update existing user password and mark email confirmed
    UPDATE auth.users
    SET 
      encrypted_password = v_encrypted_pw,
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now(),
      raw_app_meta_data = '{"provider":"email","providers":["email"]}',
      raw_user_meta_data = jsonb_build_object('full_name', 'Super Admin Mukesh', 'is_super_admin', true)
    WHERE id = v_user_id;
  ELSE
    v_user_id := gen_random_uuid();
    -- Insert new confirmed user
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud,
      confirmation_token
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      v_email,
      v_encrypted_pw,
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Super Admin Mukesh","is_super_admin":true}',
      now(),
      now(),
      'authenticated',
      'authenticated',
      ''
    );
  END IF;

  -- 2. Upsert profile with is_super_admin = true
  INSERT INTO public.profiles (id, email, full_name, is_super_admin, created_at, updated_at)
  VALUES (v_user_id, v_email, 'Super Admin Mukesh', true, now(), now())
  ON CONFLICT (id) DO UPDATE
  SET 
    is_super_admin = true,
    email = v_email,
    full_name = 'Super Admin Mukesh',
    updated_at = now();

  UPDATE public.profiles
  SET is_super_admin = true
  WHERE email = v_email;

END $$;`;

  const copyToClipboard = (text: string, type: 'migration' | 'bootstrap') => {
    navigator.clipboard.writeText(text);
    if (type === 'migration') {
      setCopiedMigration(true);
      setTimeout(() => setCopiedMigration(false), 2000);
    } else {
      setCopiedBootstrap(true);
      setTimeout(() => setCopiedBootstrap(false), 2000);
    }
  };

  const handleGoToMigration = () => {
    setActiveTab('migration');
    copyToClipboard(fullMigrationSQL, 'migration');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Supabase Integration Setup</h3>
              <p className="text-xs text-slate-500">Database connection &amp; SQL schema deployment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6 gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('config')}
            className={`py-3 border-b-2 transition -mb-px ${activeTab === 'config' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
          >
            1. API Credentials
          </button>
          <button
            onClick={() => setActiveTab('migration')}
            className={`py-3 border-b-2 transition -mb-px flex items-center gap-1.5 ${activeTab === 'migration' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
          >
            <span>2. SQL Migration</span>
            {statusState === 'migration_needed' && (
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('bootstrap')}
            className={`py-3 border-b-2 transition -mb-px ${activeTab === 'bootstrap' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
          >
            3. Super Admin
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {activeTab === 'config' && (
            <form onSubmit={handleSaveAndTest} className="space-y-4">
              {/* Notice for Migration Needed (What the user experienced in screenshot) */}
              {statusState === 'migration_needed' && (
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950 space-y-3 animate-in fade-in">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-sm text-slate-900">
                        🎉 Connection Successful! (Supabase Connected)
                      </p>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Aapka Supabase account successfully connect ho gaya hai! Lekin aapke Supabase database me abhi <strong>tables create nahi hui hain</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-blue-200 text-xs space-y-2">
                    <p className="font-semibold text-slate-800">
                      👉 Agla Step (Next Step - 1 minute):
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[11px]">
                      <li>Neeche diye gaye blue button par click karein.</li>
                      <li>Supabase Dashboard ke <strong>SQL Editor</strong> me paste karke <strong>Run</strong> daba dein.</li>
                    </ol>

                    <button
                      type="button"
                      onClick={handleGoToMigration}
                      className="w-full mt-2 py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition flex items-center justify-center gap-1.5 active:scale-98"
                    >
                      <span>Go to SQL Migration (Copy SQL Code)</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Success Notification */}
              {statusState === 'success' && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold text-sm">Database Fully Connected &amp; Verified!</p>
                    <p className="text-emerald-700">All tables exist and are ready for multi-school tracking.</p>
                  </div>
                </div>
              )}

              {/* Error Notification */}
              {statusState === 'error' && statusMessage && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">Connection Warning</p>
                    <p className="text-rose-700 mt-0.5">{statusMessage}</p>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Secure Browser Connection</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Only your public <strong>Anon Key</strong> is used with Row Level Security.
                  The <strong>service_role</strong> key stays securely on Supabase servers.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Supabase Project URL
                </label>
                <input
                  type="text"
                  placeholder="https://xyzcompany.supabase.co"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Example: <code>https://your-project-ref.supabase.co</code> (do not include trailing /rest/v1)
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Supabase Anon (Public) Key
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI..."
                    value={anonKey}
                    onChange={(e) => setAnonKey(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono pr-10"
                  />
                  <Key className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Found in Supabase Dashboard &gt; Project Settings &gt; API &gt; Project API keys (anon public).
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-slate-500 hover:text-slate-800 underline"
                >
                  Reset Defaults
                </button>
                <button
                  type="submit"
                  disabled={isTesting}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition disabled:opacity-50 active:scale-98"
                >
                  {isTesting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Testing Connection...</span>
                    </>
                  ) : (
                    <span>Save &amp; Test Connection</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'migration' && (
            <div className="space-y-4">
              {/* Step by Step instructions */}
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-200 text-xs space-y-2.5">
                <p className="font-bold text-sm text-slate-900">
                  How to Run this in Supabase (3 Simple Steps):
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-700">
                  <li>
                    Click the <strong>Copy SQL Code</strong> button below.
                  </li>
                  <li>
                    Open your <strong>Supabase Dashboard</strong> and click <strong>SQL Editor</strong> on the left menu (or{' '}
                    <a
                      href="https://supabase.com/dashboard/project/_/sql"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 font-semibold underline inline-flex items-center gap-0.5"
                    >
                      open SQL Editor here <ExternalLink className="w-3 h-3" />
                    </a>
                    ).
                  </li>
                  <li>
                    Click <strong>New query</strong>, paste the copied SQL, and click the green <strong>RUN</strong> button!
                  </li>
                </ol>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Full Schema Migration SQL</span>
                <button
                  onClick={() => copyToClipboard(fullMigrationSQL, 'migration')}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition active:scale-98"
                >
                  {copiedMigration ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Full SQL Code</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-4 bg-slate-900 text-slate-100 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-72 border border-slate-800 leading-relaxed">
                {fullMigrationSQL}
              </pre>

              <p className="text-[11px] text-slate-500">
                This SQL creates all tables (<code>schools</code>, <code>profiles</code>, <code>user_school_roles</code>, <code>students</code>, <code>student_photos</code>, <code>student_guardians</code>, <code>school_classes</code>), RLS policies, and provisions the private <code>student-photos</code> storage bucket.
              </p>
            </div>
          )}

          {activeTab === 'bootstrap' && (
            <div className="space-y-4 text-xs text-slate-600">
              <p className="leading-relaxed">
                Super Admins are protected and cannot be created through public self-registration.
                Follow this simple 2-step bootstrap process:
              </p>

              <div className="space-y-2 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <p className="font-bold text-slate-900">Step 1: Create your User in Supabase Auth</p>
                <p>
                  Go to <strong>Authentication &gt; Users &gt; Add User &gt; Create User</strong> and enter your email and password (e.g. <code>admin@mahaku.in</code>).
                </p>
              </div>

              <div className="space-y-2 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-900">Step 2: Grant Super Admin Access</p>
                  <button
                    onClick={() => copyToClipboard(bootstrapSQL, 'bootstrap')}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition font-semibold"
                  >
                    {copiedBootstrap ? 'Copied!' : 'Copy SQL'}
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl text-xs font-mono">
                  {bootstrapSQL}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Status: {isConfigured ? '🟢 Connected' : '⚪ Not configured'}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
