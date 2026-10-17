import React, { useState } from 'react';
import { Database, Copy, Check, ExternalLink, X, RefreshCw, Key, ShieldCheck } from 'lucide-react';
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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [copiedMigration, setCopiedMigration] = useState(false);
  const [copiedBootstrap, setCopiedBootstrap] = useState(false);

  if (!isOpen) return null;

  const handleSaveAndTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    setStatusMessage(null);

    try {
      saveSupabaseCredentials(url.trim(), anonKey.trim());
      const client = reinitializeSupabase();

      // Test connection by pinging health/schema
      const { error } = await client.from('schools').select('id').limit(1);

      if (error && error.code !== 'PGRST116' && !error.message.includes('0 rows')) {
        // If table doesn't exist yet, warn user to run migration
        if (error.message.includes('relation "public.schools" does not exist')) {
          setStatusMessage('Connected to Supabase project! However, the database tables have not been created yet. Please run the SQL migration from the "SQL Migration" tab in your Supabase SQL Editor.');
        } else {
          setStatusMessage(`Connected to project, but query returned: ${error.message}`);
        }
      } else {
        setStatusMessage('Success! Connected and verified connection to Supabase database.');
      }

      await refreshAuth();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown connection error';
      setStatusMessage(`Connection failed: ${msg}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleReset = () => {
    clearSupabaseCredentials();
    setUrl(import.meta.env.VITE_SUPABASE_URL || '');
    setAnonKey(import.meta.env.VITE_SUPABASE_ANON_KEY || '');
    reinitializeSupabase();
    refreshAuth();
    setStatusMessage('Configuration reset to environment default.');
  };

  const sampleMigrationSQL = `-- Run this in your Supabase Dashboard -> SQL Editor
-- Full migration is in supabase/migrations/001_initial_schema.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    is_super_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

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

CREATE TABLE IF NOT EXISTS public.school_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    class_name TEXT NOT NULL,
    section TEXT NOT NULL DEFAULT 'A',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_school_class_section UNIQUE (school_id, class_name, section)
);

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

CREATE TABLE IF NOT EXISTS public.student_guardians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    guardian_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    relationship TEXT NOT NULL DEFAULT 'Parent',
    is_primary BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_student_guardian UNIQUE (student_id, guardian_user_id)
);`;

  const bootstrapSQL = `-- 1. Create a user via Supabase Dashboard -> Authentication -> Users
-- 2. Run this SQL with your admin email to grant Super Admin access:
UPDATE public.profiles
SET is_super_admin = true
WHERE email = 'admin@mahaku.in';`;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Supabase Integration Setup</h3>
              <p className="text-xs text-slate-500">Configure PostgreSQL database & private storage</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6 gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('config')}
            className={`py-3 border-b-2 transition -mb-px ${activeTab === 'config' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
          >
            API Credentials
          </button>
          <button
            onClick={() => setActiveTab('migration')}
            className={`py-3 border-b-2 transition -mb-px ${activeTab === 'migration' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
          >
            SQL Migration
          </button>
          <button
            onClick={() => setActiveTab('bootstrap')}
            className={`py-3 border-b-2 transition -mb-px ${activeTab === 'bootstrap' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
          >
            Super Admin Setup
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {activeTab === 'config' && (
            <form onSubmit={handleSaveAndTest} className="space-y-4">
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-blue-900 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-blue-950">
                  <ShieldCheck className="w-4 h-4 text-blue-700" />
                  <span>Production Security Architecture</span>
                </div>
                <p>
                  Only your public <strong>Anon Key</strong> is used in the browser with Row Level Security (RLS).
                  The <strong>service_role</strong> key must NEVER be entered here; it stays securely in Supabase Edge Functions.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Supabase Project URL
                </label>
                <input
                  type="url"
                  placeholder="https://xyzcompany.supabase.co"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
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

              {statusMessage && (
                <div className={`p-3 rounded-xl text-xs font-medium ${statusMessage.startsWith('Success') ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                  {statusMessage}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-slate-500 hover:text-slate-800 underline"
                >
                  Reset Defaults
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={isTesting}
                    className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition disabled:opacity-50"
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
              </div>
            </form>
          )}

          {activeTab === 'migration' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-600">
                  Open your <strong>Supabase Dashboard &gt; SQL Editor</strong> and execute this schema script:
                </p>
                <button
                  onClick={() => copyToClipboard(sampleMigrationSQL, 'migration')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  {copiedMigration ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Migration SQL</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto max-h-72 border border-slate-800">
                {sampleMigrationSQL}
              </pre>
              <p className="text-[11px] text-slate-500">
                Full file is available in the repository at <code>supabase/migrations/001_initial_schema.sql</code> with all RLS policies, indexes, and storage security rules.
              </p>
            </div>
          )}

          {activeTab === 'bootstrap' && (
            <div className="space-y-4 text-xs text-slate-600">
              <p className="leading-relaxed">
                Super Admins are protected and cannot be created through public self-registration.
                Follow this simple 2-step bootstrap process:
              </p>

              <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="font-semibold text-slate-900">Step 1: Create your User in Supabase Auth</p>
                <p>
                  Go to <strong>Authentication &gt; Users &gt; Add User &gt; Create User</strong> and enter your email and password (e.g. <code>admin@mahaku.in</code>).
                </p>
              </div>

              <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">Step 2: Grant Super Admin Status</p>
                  <button
                    onClick={() => copyToClipboard(bootstrapSQL, 'bootstrap')}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition font-medium"
                  >
                    {copiedBootstrap ? 'Copied!' : 'Copy SQL'}
                  </button>
                </div>
                <pre className="p-2.5 bg-slate-900 text-emerald-400 rounded-lg text-xs font-mono">
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
