import React, { useState } from 'react';
import { supabase, formatSupabaseError, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, LogIn, Key, Mail, Database, HelpCircle, ArrowRight, Copy, Check, Sparkles, AlertCircle } from 'lucide-react';
import { SupabaseConfigModal } from '../components/Common/SupabaseConfigModal';
import { PWAInstallButton } from '../components/PWAInstallButton';

interface LoginViewProps {
  onSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess }) => {
  const { refreshAuth } = useAuth();
  const [email, setEmail] = useState('mukeshchaudhary15796@gmail.com');
  const [password, setPassword] = useState('Mukesh123');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isResetMode, setIsResetMode] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showSqlAssistant, setShowSqlAssistant] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const activationSQL = `-- ==============================================================================
-- 1-CLICK SUPER ADMIN FIX & ACTIVATION
-- Sets Password: Mukesh123 for mukeshchaudhary15796@gmail.com
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
  -- 1. Check if user exists in auth.users
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

  const copySql = () => {
    navigator.clipboard.writeText(activationSQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!isSupabaseConfigured()) {
      setShowConfigModal(true);
      return;
    }

    setIsLoading(true);

    try {
      if (isResetMode) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setSuccessMsg('Password reset instructions sent to your email.');
        setIsResetMode(false);
      } else {
        // Attempt Sign In
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password: password,
        });

        if (error) {
          // If login failed, automatically show the SQL assistant so the user can activate it
          setShowSqlAssistant(true);
          throw error;
        }

        if (data.session) {
          await refreshAuth();
          onSuccess();
        }
      }
    } catch (err: unknown) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Alternative direct client sign up
  const handleDirectSignUp = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
        options: {
          data: {
            full_name: 'Super Admin Mukesh',
            is_super_admin: true,
          },
        },
      });

      if (error) throw error;

      if (data.session) {
        setSuccessMsg('Super Admin account created and signed in!');
        await refreshAuth();
        onSuccess();
      } else {
        setSuccessMsg(
          'User registered in Supabase! If email confirmation is required, run the 1-Click SQL script below in Supabase SQL Editor to bypass confirmation.'
        );
        setShowSqlAssistant(true);
      }
    } catch (err: unknown) {
      setErrorMsg(formatSupabaseError(err));
      setShowSqlAssistant(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <div className="flex items-center justify-between max-w-5xl w-full mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-lg shadow-lg">
            M
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">
              MAHAKU CORPORATION
            </h1>
            <p className="text-[11px] text-blue-200">Student Safety Tracking System</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <PWAInstallButton variant="header" />
          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg border border-slate-700 transition"
          >
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Database Setup</span>
          </button>
        </div>
      </div>

      {/* Main Form Box */}
      <div className="max-w-md w-full mx-auto my-8 bg-white rounded-3xl shadow-2xl p-6 sm:p-8 border border-slate-100">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {isResetMode ? 'Reset Your Password' : 'Super Admin & Staff Portal'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Sign in with your configured Super Admin credentials
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 leading-relaxed">
            <div className="flex items-center gap-2 font-bold mb-1">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>Login Error: {errorMsg}</span>
            </div>
            <p className="text-[11px] text-rose-700">
              Agar aapne abhi tak Supabase me ye user activate nahi kiya hai, to neeche diye gaye <strong>"1-Click SQL Fix"</strong> se turant activate karein.
            </p>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 leading-relaxed">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Super Admin Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="mukeshchaudhary15796@gmail.com"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>

          {!isResetMode && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={() => setIsResetMode(true)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mukesh123"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono font-medium"
                />
                <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
              </div>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-blue-700 hover:bg-blue-800 active:scale-[0.99] shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isResetMode ? (
                <span>Send Reset Email</span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In as Super Admin</span>
                </>
              )}
            </button>

            {!isResetMode && (
              <button
                type="button"
                onClick={handleDirectSignUp}
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Create / Register This Account in Supabase</span>
              </button>
            )}
          </div>
        </form>

        {isResetMode && (
          <button
            onClick={() => setIsResetMode(false)}
            className="mt-4 w-full text-center text-xs text-slate-600 hover:text-slate-900 font-medium"
          >
            Back to Sign In
          </button>
        )}

        {/* 1-Click Super Admin SQL Fix Assistant */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowSqlAssistant(!showSqlAssistant)}
            className="w-full text-left flex items-center justify-between text-xs text-blue-700 font-bold hover:underline p-2 bg-blue-50/60 rounded-xl border border-blue-100"
          >
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Super Admin 1-Click Activation Script</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
          </button>

          {showSqlAssistant && (
            <div className="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-2.5 animate-in fade-in">
              <p className="font-semibold text-slate-800">
                👉 Agar Login fail ho raha hai:
              </p>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Supabase ke <strong>SQL Editor</strong> me neeche diya gaya script paste karke <strong>RUN</strong> kar dein. Ye turant aapka password <code className="font-bold text-blue-700">Mukesh123</code> set kar dega aur email confirm kar dega:
              </p>

              <button
                type="button"
                onClick={copySql}
                className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
              >
                {copiedSql ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy 1-Click Activation SQL</span>
                  </>
                )}
              </button>

              <pre className="p-2.5 bg-slate-900 text-emerald-400 rounded-xl text-[10px] font-mono overflow-x-auto max-h-36">
                {activationSQL}
              </pre>
            </div>
          )}
        </div>

        {/* First time setup helper */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>Need database setup?</span>
          </div>
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="text-blue-600 font-semibold hover:underline flex items-center gap-1"
          >
            <span>Supabase Settings</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-400">
        <p>© {new Date().getFullYear()} MAHAKU CORPORATION PVT. LTD. All rights reserved.</p>
        <p className="text-[11px] text-slate-500 mt-1">Production Multi-School Student Safety Architecture</p>
      </footer>

      {/* Supabase Config Modal */}
      <SupabaseConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
      />
    </div>
  );
};
