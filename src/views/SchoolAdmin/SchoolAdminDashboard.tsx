import React, { useState, useEffect, useCallback } from 'react';
import { supabase, formatSupabaseError } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Student } from '../../types/database';
import { StatCard } from '../../components/Common/StatCard';
import {
  GraduationCap,
  Users,
  ShieldCheck,
  QrCode,
  UserPlus,
  Layers,
  ArrowRight,
  Download,
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react';
import { exportToCSV } from '../../lib/csvExport';

interface SchoolAdminDashboardProps {
  onNavigate: (view: string, payload?: unknown) => void;
}

export const SchoolAdminDashboard: React.FC<SchoolAdminDashboardProps> = ({ onNavigate }) => {
  const { currentSchool } = useAuth();

  const [totalStudents, setTotalStudents] = useState(0);
  const [activeStudents, setActiveStudents] = useState(0);
  const [totalClasses, setTotalClasses] = useState(0);
  const [totalParents, setTotalParents] = useState(0);
  const [totalStaff, setTotalStaff] = useState(0);
  const [recentStudents, setRecentStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchCampusStats = useCallback(async () => {
    if (!currentSchool) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const [
        { count: allStudents },
        { count: activeCount },
        { count: classCount },
        { count: parentCount },
        { count: staffCount },
        { data: recentList }
      ] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', currentSchool.id),
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', currentSchool.id).eq('status', 'active'),
        supabase.from('school_classes').select('*', { count: 'exact', head: true }).eq('school_id', currentSchool.id),
        supabase.from('user_school_roles').select('*', { count: 'exact', head: true }).eq('school_id', currentSchool.id).eq('role', 'parent'),
        supabase.from('user_school_roles').select('*', { count: 'exact', head: true }).eq('school_id', currentSchool.id).in('role', ['guard', 'teacher']),
        supabase.from('students').select('*').eq('school_id', currentSchool.id).order('created_at', { ascending: false }).limit(6),
      ]);

      setTotalStudents(allStudents || 0);
      setActiveStudents(activeCount || 0);
      setTotalClasses(classCount || 0);
      setTotalParents(parentCount || 0);
      setTotalStaff(staffCount || 0);
      setRecentStudents(recentList || []);
    } catch (err: unknown) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setIsLoading(false);
    }
  }, [currentSchool]);

  useEffect(() => {
    fetchCampusStats();
  }, [fetchCampusStats]);

  const handleExportRoster = async () => {
    if (!currentSchool) return;
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('school_id', currentSchool.id)
        .order('student_class', { ascending: true })
        .order('section', { ascending: true })
        .order('roll_number', { ascending: true });

      if (error) throw error;

      exportToCSV(
        `${currentSchool.school_code}_Students_Roster`,
        [
          { label: 'Admission No', key: 'admission_number' },
          { label: 'Full Name', key: 'full_name' },
          { label: 'Class', key: 'student_class' },
          { label: 'Section', key: 'section' },
          { label: 'Roll No', key: 'roll_number' },
          { label: 'Blood Group', key: 'blood_group' },
          { label: 'DOB', key: 'date_of_birth' },
          { label: 'Status', key: 'status' },
          { label: 'QR Token', key: 'qr_token' },
        ],
        data || []
      );
    } catch (err: unknown) {
      alert(`Export failed: ${formatSupabaseError(err)}`);
    }
  };

  if (!currentSchool) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
        <h2 className="text-base font-bold text-slate-900">No School Selected</h2>
        <p className="text-xs text-slate-500 mt-1">Please select an affiliated school from the sidebar menu.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
            Campus Administration
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
            {currentSchool.school_name}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            School Code: <span className="font-mono font-semibold text-slate-700">{currentSchool.school_code}</span> · {currentSchool.city || 'India'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportRoster}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Roster CSV</span>
          </button>

          <button
            onClick={() => onNavigate('student-add')}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition active:scale-98"
          >
            <UserPlus className="w-4 h-4" />
            <span>Admit Student</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
          {errorMsg}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Students"
          value={totalStudents}
          subtitle={`${activeStudents} active enrolled`}
          icon={GraduationCap}
          variant="default"
        />
        <StatCard
          label="Classes & Sections"
          value={totalClasses}
          subtitle="Registered academic grades"
          icon={Layers}
          variant="default"
        />
        <StatCard
          label="Linked Parents"
          value={totalParents}
          subtitle="Guardian app accounts"
          icon={Users}
          variant="success"
        />
        <StatCard
          label="Guards & Teachers"
          value={totalStaff}
          subtitle="Authorized gate & class scanners"
          icon={ShieldCheck}
          variant="default"
        />
      </div>

      {/* Quick Action Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => onNavigate('student-add')}
          className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-xs transition cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-700">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Admit Student</p>
              <p className="text-[11px] text-slate-500">Capture photo &amp; auto-generate QR token</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400" />
        </div>

        <div
          onClick={() => onNavigate('qr-id-cards')}
          className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-xs transition cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Print QR ID Cards</p>
              <p className="text-[11px] text-slate-500">Preview &amp; bulk print badge cards</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400" />
        </div>

        <div
          onClick={() => onNavigate('school-users')}
          className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-xs transition cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Provision Accounts</p>
              <p className="text-[11px] text-slate-500">Add Parents, Guards &amp; Teachers via WhatsApp</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400" />
        </div>
      </div>

      {/* Recent Enrollments Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">Recent Student Admissions</h2>
          </div>
          <button
            onClick={() => onNavigate('students-list')}
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1"
          >
            <span>View All Roster</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Admission No</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Class &amp; Sec</th>
                <th className="py-3 px-4">Roll No</th>
                <th className="py-3 px-4">Blood Group</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading student records...
                  </td>
                </tr>
              ) : recentStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No students admitted yet. Click <strong>Admit Student</strong> to add the first record.
                  </td>
                </tr>
              ) : (
                recentStudents.map((st) => (
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
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {st.roll_number || '—'}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {st.blood_group || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onNavigate('qr-id-cards', st)}
                        className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                      >
                        ID Card
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
