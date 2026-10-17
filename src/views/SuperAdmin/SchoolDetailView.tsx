import React, { useState, useEffect, useCallback } from 'react';
import { supabase, formatSupabaseError } from '../../lib/supabase';
import { School, Student, Profile, UserSchoolRole } from '../../types/database';
import { Pagination } from '../../components/Common/Pagination';
import { AssignAdminModal } from './AssignAdminModal';
import { SchoolFormModal } from './SchoolFormModal';
import { ConfirmModal } from '../../components/Common/ConfirmModal';
import {
  ArrowLeft,
  Building2,
  Users,
  GraduationCap,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  Search,
  Power,
  Edit2,
  Trash2,
  UserPlus
} from 'lucide-react';

interface SchoolDetailViewProps {
  school: School;
  onBack: () => void;
  onNavigateToStudent: (student: Student) => void;
}

export const SchoolDetailView: React.FC<SchoolDetailViewProps> = ({
  school: initialSchool,
  onBack,
  onNavigateToStudent,
}) => {
  const [school, setSchool] = useState<School>(initialSchool);
  const [admins, setAdmins] = useState<(UserSchoolRole & { profile?: Profile })[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchStudent, setSearchStudent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  // Fetch school details, assigned admins, and students
  const fetchSchoolData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      // 1. Refresh school info
      const { data: updatedSchool, error: schoolErr } = await supabase
        .from('schools')
        .select('*')
        .eq('id', school.id)
        .single();

      if (schoolErr) throw schoolErr;
      if (updatedSchool) setSchool(updatedSchool);

      // 2. Fetch School Admins
      const { data: adminRoles, error: adminErr } = await supabase
        .from('user_school_roles')
        .select('*, profile:profiles(*)')
        .eq('school_id', school.id)
        .eq('role', 'school_admin');

      if (adminErr) throw adminErr;
      setAdmins(adminRoles || []);

      // 3. Fetch paginated students for this school
      let studentQuery = supabase
        .from('students')
        .select('*', { count: 'exact' })
        .eq('school_id', school.id);

      if (searchStudent.trim()) {
        const term = `%${searchStudent.trim()}%`;
        studentQuery = studentQuery.or(`full_name.ilike.${term},admission_number.ilike.${term}`);
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data: studentList, count, error: studentErr } = await studentQuery
        .order('full_name', { ascending: true })
        .range(from, to);

      if (studentErr) throw studentErr;

      setStudents(studentList || []);
      setTotalStudents(count || 0);
    } catch (err: unknown) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setIsLoading(false);
    }
  }, [school.id, currentPage, pageSize, searchStudent]);

  useEffect(() => {
    fetchSchoolData();
  }, [fetchSchoolData]);

  // Toggle school active/inactive
  const handleToggleStatus = async () => {
    setIsDeactivating(true);
    try {
      const nextStatus = school.status === 'active' ? 'inactive' : 'active';
      const { error } = await supabase
        .from('schools')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', school.id);

      if (error) throw error;
      setSchool((prev) => ({ ...prev, status: nextStatus }));
      setShowDeactivateConfirm(false);
    } catch (err: unknown) {
      alert(`Status update failed: ${formatSupabaseError(err)}`);
    } finally {
      setIsDeactivating(false);
    }
  };

  // Remove School Admin role
  const handleRemoveAdmin = async (roleId: string) => {
    if (!confirm('Are you sure you want to remove this School Administrator?')) return;

    try {
      const { error } = await supabase
        .from('user_school_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;
      await fetchSchoolData();
    } catch (err: unknown) {
      alert(formatSupabaseError(err));
    }
  };

  const isActive = school.status === 'active';

  return (
    <div className="space-y-6">
      {/* Back Button & Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {school.school_name}
              </h1>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                {isActive ? 'Active Campus' : 'Deactivated Campus'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Code: {school.school_code}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Campus</span>
          </button>

          <button
            onClick={() => setShowDeactivateConfirm(true)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition ${isActive ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{isActive ? 'Deactivate Campus' : 'Activate Campus'}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
          {errorMsg}
        </div>
      )}

      {/* Campus Info & School Admins Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Campus Information Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 font-bold text-sm text-slate-900">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span>Campus Overview</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-slate-800">{school.address || 'Address not registered'}</p>
                <p className="text-slate-500">{[school.city, school.state].filter(Boolean).join(', ') || 'City/State not specified'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Phone className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-slate-700 font-medium">{school.phone || 'Phone not registered'}</span>
            </div>

            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-slate-700 font-medium font-mono">{school.email || 'Email not registered'}</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            <span>Created on {new Date(school.created_at).toLocaleDateString()}</span>
          </div>
        </div>

        {/* School Administrators Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Assigned School Administrators</span>
              <span className="text-xs text-slate-500 font-normal tabular-nums">({admins.length})</span>
            </div>

            <button
              onClick={() => setIsAssignModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Assign Administrator</span>
            </button>
          </div>

          {admins.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              <Users className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
              <p className="font-semibold text-slate-700">No School Administrators assigned yet</p>
              <p className="text-slate-400 text-[11px]">Assign an admin to allow this school to manage students and generate QR cards.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {admins.map((adm) => (
                <div key={adm.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{adm.profile?.full_name || 'Administrator'}</p>
                    <p className="text-slate-500 font-mono text-[11px]">{adm.profile?.email}</p>
                    {adm.profile?.phone && (
                      <p className="text-slate-400 text-[11px]">{adm.profile.phone}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveAdmin(adm.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Remove Administrator"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Enrolled Students Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">Enrolled Students</h2>
            <span className="text-xs text-slate-500 font-medium tabular-nums">
              ({totalStudents.toLocaleString('en-IN')})
            </span>
          </div>

          <div className="relative sm:w-72">
            <input
              type="text"
              placeholder="Search by student name or admission no..."
              value={searchStudent}
              onChange={(e) => {
                setSearchStudent(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Admission No</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Class &amp; Sec</th>
                <th className="py-3 px-4">Roll No</th>
                <th className="py-3 px-4">QR Token</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <span className="inline-block w-6 h-6 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mb-2" />
                    <p>Loading students...</p>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    <GraduationCap className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-800">No students enrolled</p>
                    <p className="text-slate-400 text-[11px]">Students added by the School Administrator will appear here.</p>
                  </td>
                </tr>
              ) : (
                students.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      {st.admission_number}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {st.full_name}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {st.student_class} - {st.section}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono">
                      {st.roll_number || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {st.qr_token.slice(0, 16)}...
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 font-medium ${st.status === 'active' ? 'text-emerald-700' : 'text-slate-500'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {st.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalCount={totalStudents}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Edit School Modal */}
      <SchoolFormModal
        isOpen={isEditModalOpen}
        schoolToEdit={school}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={fetchSchoolData}
      />

      {/* Assign Admin Modal */}
      <AssignAdminModal
        isOpen={isAssignModalOpen}
        school={school}
        onClose={() => setIsAssignModalOpen(false)}
        onSuccess={fetchSchoolData}
      />

      {/* Deactivate School Confirm */}
      <ConfirmModal
        isOpen={showDeactivateConfirm}
        title={isActive ? 'Deactivate School Campus' : 'Activate School Campus'}
        message={
          isActive
            ? `Deactivating "${school.school_name}" will immediately prevent all associated School Admins, teachers, guards, and parents from logging in or querying student data.`
            : `Re-activating "${school.school_name}" will restore campus access.`
        }
        confirmLabel={isActive ? 'Confirm Deactivation' : 'Confirm Activation'}
        variant={isActive ? 'danger' : 'primary'}
        isLoading={isDeactivating}
        onConfirm={handleToggleStatus}
        onClose={() => setShowDeactivateConfirm(false)}
      />
    </div>
  );
};
