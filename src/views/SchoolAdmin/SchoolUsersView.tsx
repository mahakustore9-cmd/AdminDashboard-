import React, { useState, useEffect, useCallback } from 'react';
import { supabase, formatSupabaseError } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { UserSchoolRole, Profile } from '../../types/database';
import { buildWhatsAppShareUrl } from '../../lib/whatsapp';
import { Pagination } from '../../components/Common/Pagination';
import { ConfirmModal } from '../../components/Common/ConfirmModal';
import {
  Users,
  UserPlus,
  Shield,
  MessageSquare,
  Power,
  Search,
  Filter,
  CheckCircle2,
  Mail,
  Phone,
  Key,
  X,
  ExternalLink
} from 'lucide-react';

interface SchoolUsersViewProps {
  onNavigate: (view: string, payload?: unknown) => void;
}

export const SchoolUsersView: React.FC<SchoolUsersViewProps> = ({ onNavigate }) => {
  const { currentSchool } = useAuth();

  const [roles, setRoles] = useState<(UserSchoolRole & { profile?: Profile })[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [roleFilter, setRoleFilter] = useState<'all' | 'parent' | 'guard' | 'teacher'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal State for Provisioning User
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);
  const [formFullName, setFormFullName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState<'parent' | 'guard' | 'teacher'>('parent');
  const [formTempPassword, setFormTempPassword] = useState('');
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [justProvisioned, setJustProvisioned] = useState<{
    fullName: string;
    email: string;
    phone: string;
    role: string;
    tempPass: string;
  } | null>(null);

  // Status Toggle Confirm
  const [roleToToggle, setRoleToToggle] = useState<UserSchoolRole & { profile?: Profile } | null>(null);
  const [isToggleLoading, setIsToggleLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!currentSchool) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      let query = supabase
        .from('user_school_roles')
        .select('*, profile:profiles(*)', { count: 'exact' })
        .eq('school_id', currentSchool.id)
        .in('role', ['parent', 'guard', 'teacher']);

      if (roleFilter !== 'all') {
        query = query.eq('role', roleFilter);
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      let list = (data || []) as (UserSchoolRole & { profile?: Profile })[];

      // Client-side search on joined profile fields
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        list = list.filter(
          (item) =>
            item.profile?.full_name?.toLowerCase().includes(q) ||
            item.profile?.email?.toLowerCase().includes(q) ||
            item.profile?.phone?.includes(q)
        );
      }

      setRoles(list);
      setTotalCount(count || 0);
    } catch (err: unknown) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setIsLoading(false);
    }
  }, [currentSchool, currentPage, pageSize, roleFilter, searchQuery]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Handle Provision Account
  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSchool) return;

    setIsProvisioning(true);
    setProvisionError(null);

    const generatedPass = formTempPassword || `Mhk@${Math.random().toString(36).slice(-6)}!`;

    try {
      // 1. Invoke Supabase Edge Function: provision-user
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('provision-user', {
        body: {
          email: formEmail.trim().toLowerCase(),
          fullName: formFullName.trim(),
          phone: formPhone.trim() || undefined,
          role: formRole,
          schoolId: currentSchool.id,
          temporaryPassword: generatedPass,
        },
      });

      if (edgeError || edgeData?.error) {
        // Fallback if Edge Function not deployed yet in development:
        // Check if user profile already exists
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', formEmail.trim().toLowerCase())
          .maybeSingle();

        if (existingProfile) {
          const { error: roleErr } = await supabase
            .from('user_school_roles')
            .upsert({
              user_id: existingProfile.id,
              school_id: currentSchool.id,
              role: formRole,
              status: 'active',
            }, { onConflict: 'user_id, school_id, role' });

          if (roleErr) throw roleErr;
        } else {
          throw new Error(
            `Unable to provision user: ${edgeError?.message || edgeData?.error || 'Edge function not responding'}. To create fresh accounts without the Edge Function deployed, create the user in Supabase Auth first, then link their email here.`
          );
        }
      }

      setJustProvisioned({
        fullName: formFullName.trim(),
        email: formEmail.trim().toLowerCase(),
        phone: formPhone.trim(),
        role: formRole,
        tempPass: generatedPass,
      });

      await fetchUsers();
    } catch (err: unknown) {
      setProvisionError(formatSupabaseError(err));
    } finally {
      setIsProvisioning(false);
    }
  };

  // Handle Toggle Active/Inactive
  const handleToggleStatus = async () => {
    if (!roleToToggle) return;
    setIsToggleLoading(true);

    try {
      const nextStatus = roleToToggle.status === 'active' ? 'inactive' : 'active';
      const { error } = await supabase
        .from('user_school_roles')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', roleToToggle.id);

      if (error) throw error;
      setRoleToToggle(null);
      await fetchUsers();
    } catch (err: unknown) {
      alert(`Update failed: ${formatSupabaseError(err)}`);
    } finally {
      setIsToggleLoading(false);
    }
  };

  const handleResetModal = () => {
    setJustProvisioned(null);
    setFormFullName('');
    setFormEmail('');
    setFormPhone('');
    setFormRole('parent');
    setFormTempPassword('');
    setProvisionError(null);
    setIsProvisionModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Parents, Guards &amp; Teachers Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Campus: <span className="font-semibold text-slate-700">{currentSchool?.school_name}</span> · Account provisioning &amp; WhatsApp dispatch
          </p>
        </div>

        <button
          onClick={() => {
            setJustProvisioned(null);
            setIsProvisionModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition active:scale-98"
        >
          <UserPlus className="w-4 h-4" />
          <span>Provision New User</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
          {errorMsg}
        </div>
      )}

      {/* Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search user by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2 pointer-events-none" />
          </div>

          {/* Role Filter Tabs */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-medium">
            <button
              onClick={() => {
                setRoleFilter('all');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-lg transition ${roleFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600'}`}
            >
              All Users
            </button>
            <button
              onClick={() => {
                setRoleFilter('parent');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-lg transition ${roleFilter === 'parent' ? 'bg-white text-blue-800 shadow-2xs font-semibold' : 'text-slate-600'}`}
            >
              Parents
            </button>
            <button
              onClick={() => {
                setRoleFilter('guard');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-lg transition ${roleFilter === 'guard' ? 'bg-white text-amber-800 shadow-2xs font-semibold' : 'text-slate-600'}`}
            >
              Security Guards
            </button>
            <button
              onClick={() => {
                setRoleFilter('teacher');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-lg transition ${roleFilter === 'teacher' ? 'bg-white text-emerald-800 shadow-2xs font-semibold' : 'text-slate-600'}`}
            >
              Teachers
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Full Name</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Email ID</th>
                <th className="py-3 px-4">Mobile / WhatsApp</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    Loading campus users...
                  </td>
                </tr>
              ) : roles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-800">No users found</p>
                    <p className="text-slate-400 text-[11px]">Click "Provision New User" to register parents, security guards, or class teachers.</p>
                  </td>
                </tr>
              ) : (
                roles.map((r) => {
                  const isActive = r.status === 'active';
                  const roleColors: Record<string, string> = {
                    parent: 'bg-blue-50 text-blue-700 border-blue-200',
                    guard: 'bg-amber-50 text-amber-800 border-amber-200',
                    teacher: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                  };

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {r.profile?.full_name || 'User'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${roleColors[r.role] || 'bg-slate-50 text-slate-600'}`}>
                          {r.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {r.profile?.email || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {r.profile?.phone || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 font-medium ${isActive ? 'text-emerald-700' : 'text-slate-400'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {/* WhatsApp Share Button */}
                        <a
                          href={buildWhatsAppShareUrl({
                            schoolName: currentSchool?.school_name || 'School',
                            recipientName: r.profile?.full_name || 'User',
                            recipientPhone: r.profile?.phone,
                            role: r.role,
                            email: r.profile?.email || '',
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
                          title="Share Portal Access Details on WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>

                        {/* Status Toggle */}
                        <button
                          onClick={() => setRoleToToggle(r)}
                          className={`p-1.5 rounded-lg transition ${isActive ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                          title={isActive ? 'Disable User Access' : 'Enable User Access'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Provision User Modal */}
      {isProvisionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Provision Campus User</h3>
                  <p className="text-xs text-slate-500">
                    Add Parent, Guard, or Teacher for <span className="font-semibold">{currentSchool?.school_name}</span>
                  </p>
                </div>
              </div>
              <button onClick={handleResetModal} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {justProvisioned ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
                    <p className="font-bold text-sm">Account Provisioned Successfully!</p>
                    <p className="text-xs">
                      User <strong>{justProvisioned.fullName}</strong> is now registered as a <strong>{justProvisioned.role}</strong>.
                    </p>
                    <div className="mt-2 p-3 bg-white rounded-xl border border-emerald-100 font-mono text-xs space-y-1">
                      <p><strong>Login Email:</strong> {justProvisioned.email}</p>
                      <p><strong>Initial Password:</strong> {justProvisioned.tempPass}</p>
                    </div>
                  </div>

                  <a
                    href={buildWhatsAppShareUrl({
                      schoolName: currentSchool?.school_name || 'School',
                      recipientName: justProvisioned.fullName,
                      recipientPhone: justProvisioned.phone,
                      role: justProvisioned.role,
                      email: justProvisioned.email,
                      temporaryPassword: justProvisioned.tempPass,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 rounded-xl font-semibold text-xs text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition flex items-center justify-center gap-2 active:scale-98"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Send Login Instructions on WhatsApp</span>
                  </a>

                  <button
                    onClick={handleResetModal}
                    className="w-full py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleProvisionSubmit} className="space-y-4">
                  {provisionError && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 leading-relaxed">
                      {provisionError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Account Role <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormRole('parent')}
                        className={`py-2 px-3 text-xs font-bold rounded-xl border transition ${formRole === 'parent' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                      >
                        Parent
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormRole('guard')}
                        className={`py-2 px-3 text-xs font-bold rounded-xl border transition ${formRole === 'guard' ? 'bg-amber-50 border-amber-600 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                      >
                        Guard
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormRole('teacher')}
                        className={`py-2 px-3 text-xs font-bold rounded-xl border transition ${formRole === 'teacher' ? 'bg-emerald-50 border-emerald-600 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                      >
                        Teacher
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formFullName}
                      onChange={(e) => setFormFullName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="e.g. ramesh@example.com"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      WhatsApp Mobile Number
                    </label>
                    <input
                      type="tel"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="e.g. 9876543210 (10 digits)"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Initial Temporary Password (Optional)
                    </label>
                    <input
                      type="text"
                      value={formTempPassword}
                      onChange={(e) => setFormTempPassword(e.target.value)}
                      placeholder="Leave empty to auto-generate secure password"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono text-xs"
                    />
                  </div>

                  <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleResetModal}
                      disabled={isProvisioning}
                      className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isProvisioning}
                      className="px-5 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition flex items-center gap-2 disabled:opacity-50"
                    >
                      {isProvisioning && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      <span>Provision Account</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Deactivation Modal */}
      <ConfirmModal
        isOpen={Boolean(roleToToggle)}
        title={roleToToggle?.status === 'active' ? 'Disable User Access' : 'Enable User Access'}
        message={
          roleToToggle?.status === 'active'
            ? `Are you sure you want to disable access for ${roleToToggle?.profile?.full_name} (${roleToToggle?.role})? They will no longer be able to log in to this school's portal.`
            : `Are you sure you want to restore access for ${roleToToggle?.profile?.full_name}?`
        }
        confirmLabel={roleToToggle?.status === 'active' ? 'Disable Access' : 'Enable Access'}
        variant={roleToToggle?.status === 'active' ? 'danger' : 'primary'}
        isLoading={isToggleLoading}
        onConfirm={handleToggleStatus}
        onClose={() => setRoleToToggle(null)}
      />
    </div>
  );
};
