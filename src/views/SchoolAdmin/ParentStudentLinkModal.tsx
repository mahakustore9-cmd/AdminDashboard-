import React, { useState, useEffect } from 'react';
import { supabase, formatSupabaseError } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Student, Profile, UserSchoolRole, StudentGuardian } from '../../types/database';
import { Users, X, UserPlus, Trash2, CheckCircle2, Shield } from 'lucide-react';

interface ParentStudentLinkModalProps {
  isOpen: boolean;
  student: Student | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ParentStudentLinkModal: React.FC<ParentStudentLinkModalProps> = ({
  isOpen,
  student,
  onClose,
  onSuccess,
}) => {
  const { currentSchool } = useAuth();
  const [existingLinks, setExistingLinks] = useState<(StudentGuardian & { guardian_profile?: Profile })[]>([]);
  const [availableParents, setAvailableParents] = useState<(UserSchoolRole & { profile?: Profile })[]>([]);
  const [selectedParentUserId, setSelectedParentUserId] = useState('');
  const [relationship, setRelationship] = useState('Father');
  const [isPrimary, setIsPrimary] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !student || !currentSchool) return;

    const loadData = async () => {
      setIsLoading(true);
      setErrorMsg(null);

      try {
        // 1. Fetch current guardians for this student
        const { data: guardians, error: gErr } = await supabase
          .from('student_guardians')
          .select('*, guardian_profile:profiles(*)')
          .eq('student_id', student.id);

        if (gErr) throw gErr;
        setExistingLinks(guardians || []);

        // 2. Fetch all parents belonging to this school
        const { data: parents, error: pErr } = await supabase
          .from('user_school_roles')
          .select('*, profile:profiles(*)')
          .eq('school_id', currentSchool.id)
          .eq('role', 'parent')
          .eq('status', 'active');

        if (pErr) throw pErr;
        setAvailableParents(parents || []);
        if (parents && parents.length > 0) {
          setSelectedParentUserId(parents[0].user_id);
        }
      } catch (err: unknown) {
        setErrorMsg(formatSupabaseError(err));
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen, student, currentSchool]);

  if (!isOpen || !student) return null;

  // Add new link
  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParentUserId) {
      setErrorMsg('Please select a parent account to link.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase
        .from('student_guardians')
        .insert([
          {
            student_id: student.id,
            guardian_user_id: selectedParentUserId,
            relationship: relationship,
            is_primary: isPrimary,
          },
        ]);

      if (error) throw error;

      // Reload links
      const { data: updated } = await supabase
        .from('student_guardians')
        .select('*, guardian_profile:profiles(*)')
        .eq('student_id', student.id);

      setExistingLinks(updated || []);
      onSuccess();
    } catch (err: unknown) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Remove link
  const handleRemoveLink = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from('student_guardians')
        .delete()
        .eq('id', linkId);

      if (error) throw error;

      setExistingLinks((prev) => prev.filter((item) => item.id !== linkId));
      onSuccess();
    } catch (err: unknown) {
      alert(formatSupabaseError(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Link Parent / Guardian</h3>
              <p className="text-xs text-slate-500">
                Student: <span className="font-semibold text-slate-800">{student.full_name}</span> (Adm: {student.admission_number})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 leading-relaxed">
              {errorMsg}
            </div>
          )}

          {/* Existing Linked Guardians */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Currently Linked Guardians ({existingLinks.length})
            </h4>

            {existingLinks.length === 0 ? (
              <p className="text-xs text-slate-400 py-2 italic">
                No parents linked to this student yet. Link a guardian account below to enable parent tracking.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden bg-slate-50/50">
                {existingLinks.map((link) => (
                  <div key={link.id} className="p-3 flex items-center justify-between gap-3 text-xs bg-white">
                    <div>
                      <p className="font-bold text-slate-900">
                        {link.guardian_profile?.full_name || 'Guardian'}{' '}
                        <span className="font-normal text-slate-500">({link.relationship})</span>
                      </p>
                      <p className="text-slate-500 font-mono text-[11px]">{link.guardian_profile?.email}</p>
                      {link.guardian_profile?.phone && (
                        <p className="text-slate-400 text-[11px]">{link.guardian_profile.phone}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveLink(link.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Unlink Guardian"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Link Form */}
          <form onSubmit={handleAddLink} className="space-y-4 pt-3 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Link Registered Parent Account
            </h4>

            {availableParents.length === 0 ? (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
                No parent accounts are registered for this school yet. Please go to <strong>Staff/Parents</strong> in the menu and provision a parent account first.
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Select Parent Account
                  </label>
                  <select
                    value={selectedParentUserId}
                    onChange={(e) => setSelectedParentUserId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
                  >
                    {availableParents.map((p) => (
                      <option key={p.user_id} value={p.user_id}>
                        {p.profile?.full_name} ({p.profile?.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Relationship
                    </label>
                    <select
                      value={relationship}
                      onChange={(e) => setRelationship(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
                    >
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Guardian">Guardian</option>
                      <option value="Brother">Brother</option>
                      <option value="Sister">Sister</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Primary Contact
                    </label>
                    <div className="flex items-center h-10">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={isPrimary}
                          onChange={(e) => setIsPrimary(e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded-md focus:ring-blue-500"
                        />
                        <span>Primary Emergency Guardian</span>
                      </label>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Link Parent to Student</span>
                </button>
              </>
            )}
          </form>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
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
