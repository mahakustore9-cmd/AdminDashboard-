import React, { useState } from 'react';
import { supabase, formatSupabaseError } from '../../lib/supabase';
import { School } from '../../types/database';
import { ShieldCheck, X, Mail, User, Phone, Key, Send, Copy, Check, MessageSquare } from 'lucide-react';
import { buildWhatsAppShareUrl } from '../../lib/whatsapp';

interface AssignAdminModalProps {
  isOpen: boolean;
  school: School | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const AssignAdminModal: React.FC<AssignAdminModalProps> = ({
  isOpen,
  school,
  onClose,
  onSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [provisionedInfo, setProvisionedInfo] = useState<{
    email: string;
    fullName: string;
    phone?: string;
    tempPass: string;
  } | null>(null);

  if (!isOpen || !school) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    const generatedPassword = temporaryPassword || `Mhk@${Math.random().toString(36).slice(-6)}!`;

    try {
      // 1. Try invoking the Supabase Edge Function first
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('provision-user', {
        body: {
          email: email.trim().toLowerCase(),
          fullName: fullName.trim(),
          phone: phone.trim() || undefined,
          role: 'school_admin',
          schoolId: school.id,
          temporaryPassword: generatedPassword,
        },
      });

      if (edgeError || edgeData?.error) {
        // If Edge Function is not deployed yet in this Supabase project, fallback to direct role mapping if user exists in auth or DB
        const fallbackMsg = edgeError?.message || edgeData?.error;
        console.warn('Edge Function returned error, attempting direct role mapping:', fallbackMsg);

        // Check if profile exists for this email
        const { data: existingProfile, error: profileErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email.trim().toLowerCase())
          .maybeSingle();

        if (existingProfile) {
          // Link existing user as school_admin
          const { error: roleErr } = await supabase
            .from('user_school_roles')
            .upsert({
              user_id: existingProfile.id,
              school_id: school.id,
              role: 'school_admin',
              status: 'active',
            }, { onConflict: 'user_id, school_id, role' });

          if (roleErr) throw roleErr;
        } else {
          throw new Error(
            `Unable to provision user: ${fallbackMsg || 'Edge Function not deployed'}. Note: If testing without the provision-user Edge Function deployed, create the user in Supabase Auth first, then link their email here.`
          );
        }
      }

      setProvisionedInfo({
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        tempPass: generatedPassword,
      });

      onSuccess();
    } catch (err: unknown) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setProvisionedInfo(null);
    setEmail('');
    setFullName('');
    setPhone('');
    setTemporaryPassword('');
    setErrorMsg(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Assign School Administrator</h3>
              <p className="text-xs text-slate-500">
                Grant management access for <span className="font-semibold">{school.school_name}</span>
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {provisionedInfo ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
                <p className="font-bold text-sm">School Administrator Provisioned!</p>
                <p className="text-xs">
                  Account has been created and assigned to <strong>{school.school_name}</strong>.
                </p>
                <div className="mt-2 p-3 bg-white rounded-xl border border-emerald-100 font-mono text-xs space-y-1">
                  <p><strong>Email:</strong> {provisionedInfo.email}</p>
                  <p><strong>Temporary Password:</strong> {provisionedInfo.tempPass}</p>
                </div>
              </div>

              {/* WhatsApp Share Button */}
              <div className="pt-2">
                <a
                  href={buildWhatsAppShareUrl({
                    schoolName: school.school_name,
                    recipientName: provisionedInfo.fullName,
                    recipientPhone: provisionedInfo.phone,
                    role: 'school_admin',
                    email: provisionedInfo.email,
                    temporaryPassword: provisionedInfo.tempPass,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-xl font-semibold text-xs text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition flex items-center justify-center gap-2 active:scale-98"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Share Login Instructions via WhatsApp</span>
                </a>
              </div>

              <button
                onClick={handleClose}
                className="w-full mt-2 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 leading-relaxed">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Administrator Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. Rajesh Sharma"
                    className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="principal@school.edu.in"
                    className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  WhatsApp Mobile Number (for Login Delivery)
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 9876543210 (10 digits)"
                    className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
                  />
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Temporary Initial Password (Optional)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={temporaryPassword}
                    onChange={(e) => setTemporaryPassword(e.target.value)}
                    placeholder="Leave empty to auto-generate secure password"
                    className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono text-xs"
                  />
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition flex items-center gap-2 disabled:opacity-50"
                >
                  {isLoading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  <span>Provision Admin</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
