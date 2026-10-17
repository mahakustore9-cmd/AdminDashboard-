import React, { useState } from 'react';
import { supabase, formatSupabaseError, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, LogIn, Key, Mail, Database, HelpCircle, ArrowRight } from 'lucide-react';
import { SupabaseConfigModal } from '../components/Common/SupabaseConfigModal';
import { PWAInstallButton } from '../components/PWAInstallButton';

interface LoginViewProps {
  onSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess }) => {
  const { refreshAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isResetMode, setIsResetMode] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

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
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password: password,
        });

        if (error) throw error;
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
            {isResetMode ? 'Reset Your Password' : 'Administrator & Staff Portal'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isResetMode
              ? 'Enter your registered email to receive setup instructions'
              : 'Secure login for Super Admins and School Administrators'}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 leading-relaxed">
            {errorMsg}
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
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@mahaku.in"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
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
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
                <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm text-white bg-blue-700 hover:bg-blue-800 active:scale-[0.99] shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isResetMode ? (
              <span>Send Reset Email</span>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Sign In to Portal</span>
              </>
            )}
          </button>
        </form>

        {isResetMode && (
          <button
            onClick={() => setIsResetMode(false)}
            className="mt-4 w-full text-center text-xs text-slate-600 hover:text-slate-900 font-medium"
          >
            Back to Sign In
          </button>
        )}

        {/* First time setup helper */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>First time setup?</span>
          </div>
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="text-blue-600 font-semibold hover:underline flex items-center gap-1"
          >
            <span>Bootstrap Super Admin</span>
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
