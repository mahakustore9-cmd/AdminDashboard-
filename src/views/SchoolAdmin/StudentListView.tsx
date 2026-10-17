import React, { useState, useEffect, useCallback } from 'react';
import { supabase, formatSupabaseError } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Student, StudentPhoto, SchoolClass } from '../../types/database';
import { Pagination } from '../../components/Common/Pagination';
import { ConfirmModal } from '../../components/Common/ConfirmModal';
import { exportToCSV } from '../../lib/csvExport';
import { batchResolveSignedUrls } from '../../lib/storageService';
import {
  GraduationCap,
  Search,
  Filter,
  Plus,
  Download,
  QrCode,
  Edit2,
  Users,
  Power,
  User,
  AlertTriangle
} from 'lucide-react';

interface StudentListViewProps {
  onNavigate: (view: string, payload?: unknown) => void;
  onSelectStudentForCard: (student: Student) => void;
  onSelectStudentForEdit: (student: Student) => void;
  onSelectStudentForLink: (student: Student) => void;
}

export const StudentListView: React.FC<StudentListViewProps> = ({
  onNavigate,
  onSelectStudentForCard,
  onSelectStudentForEdit,
  onSelectStudentForLink,
}) => {
  const { currentSchool } = useAuth();

  const [students, setStudents] = useState<Student[]>([]);
  const [photoUrlMap, setPhotoUrlMap] = useState<Map<string, string>>(new Map());
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Status toggle confirm
  const [studentToToggle, setStudentToToggle] = useState<Student | null>(null);
  const [isToggleLoading, setIsToggleLoading] = useState(false);

  // Fetch unique classes for filter dropdown
  useEffect(() => {
    if (!currentSchool) return;

    const fetchClasses = async () => {
      const { data } = await supabase
        .from('school_classes')
        .select('class_name')
        .eq('school_id', currentSchool.id);

      if (data && data.length > 0) {
        const unique = Array.from(new Set(data.map((c) => c.class_name))).sort();
        setAvailableClasses(unique);
      } else {
        // Default standard classes if not yet populated
        setAvailableClasses([
          'Nursery', 'LKG', 'UKG',
          'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
          'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
          'Class 11', 'Class 12'
        ]);
      }
    };

    fetchClasses();
  }, [currentSchool]);

  // Scalable server-side paginated fetch (designed for 10,000+ students)
  const fetchStudents = useCallback(async () => {
    if (!currentSchool) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      let query = supabase
        .from('students')
        .select('*, photo:student_photos(*)', { count: 'exact' })
        .eq('school_id', currentSchool.id);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (selectedClass !== 'all') {
        query = query.eq('student_class', selectedClass);
      }

      if (selectedSection !== 'all') {
        query = query.eq('section', selectedSection);
      }

      if (searchQuery.trim()) {
        const term = `%${searchQuery.trim()}%`;
        query = query.or(`full_name.ilike.${term},admission_number.ilike.${term},roll_number.ilike.${term}`);
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await query
        .order('student_class', { ascending: true })
        .order('section', { ascending: true })
        .order('roll_number', { ascending: true })
        .range(from, to);

      if (error) throw error;

      const studentList = (data || []) as Student[];
      setStudents(studentList);
      setTotalCount(count || 0);

      // Batch resolve signed URLs for photos in current page
      const photoPathsToResolve = studentList
        .filter((s) => s.photo?.storage_path)
        .map((s) => ({ studentId: s.id, storagePath: s.photo!.storage_path }));

      if (photoPathsToResolve.length > 0) {
        const urlMap = await batchResolveSignedUrls(photoPathsToResolve);
        setPhotoUrlMap(urlMap);
      }
    } catch (err: unknown) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setIsLoading(false);
    }
  }, [currentSchool, currentPage, pageSize, searchQuery, selectedClass, selectedSection, statusFilter]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Handle status toggle
  const handleToggleStudentStatus = async () => {
    if (!studentToToggle) return;
    setIsToggleLoading(true);

    try {
      const nextStatus = studentToToggle.status === 'active' ? 'inactive' : 'active';
      const { error } = await supabase
        .from('students')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', studentToToggle.id);

      if (error) throw error;

      setStudentToToggle(null);
      await fetchStudents();
    } catch (err: unknown) {
      alert(`Update failed: ${formatSupabaseError(err)}`);
    } finally {
      setIsToggleLoading(false);
    }
  };

  // CSV Export for filtered students
  const handleExportCSV = async () => {
    if (!currentSchool) return;

    try {
      // Fetch up to 2000 records for export with current filters
      let exportQuery = supabase
        .from('students')
        .select('*')
        .eq('school_id', currentSchool.id);

      if (statusFilter !== 'all') exportQuery = exportQuery.eq('status', statusFilter);
      if (selectedClass !== 'all') exportQuery = exportQuery.eq('student_class', selectedClass);
      if (selectedSection !== 'all') exportQuery = exportQuery.eq('section', selectedSection);

      const { data, error } = await exportQuery.limit(2000);
      if (error) throw error;

      exportToCSV(
        `${currentSchool.school_code}_Students`,
        [
          { label: 'Admission No', key: 'admission_number' },
          { label: 'Full Name', key: 'full_name' },
          { label: 'Class', key: 'student_class' },
          { label: 'Section', key: 'section' },
          { label: 'Roll Number', key: 'roll_number' },
          { label: 'Date of Birth', key: 'date_of_birth' },
          { label: 'Gender', key: 'gender' },
          { label: 'Blood Group', key: 'blood_group' },
          { label: 'Status', key: 'status' },
          { label: 'QR Token', key: 'qr_token' },
          { label: 'Address', key: 'address' },
        ],
        data || []
      );
    } catch (err: unknown) {
      alert(`CSV Export failed: ${formatSupabaseError(err)}`);
    }
  };

  if (!currentSchool) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
        <p className="font-semibold text-slate-800">No active school linked</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Students Directory &amp; Roster
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Campus: <span className="font-semibold text-slate-700">{currentSchool.school_name}</span> · Paginated multi-class registry
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => onNavigate('student-add')}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Admit New Student</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
          {errorMsg}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by student name, admission no, or roll no..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          </div>

          {/* Filters Cluster */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Class Filter */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
              <span className="text-slate-400 font-medium">Class:</span>
              <select
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent font-semibold text-slate-800 focus:outline-none"
              >
                <option value="all">All Classes</option>
                {availableClasses.map((cls) => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>

            {/* Section Filter */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
              <span className="text-slate-400 font-medium">Sec:</span>
              <select
                value={selectedSection}
                onChange={(e) => {
                  setSelectedSection(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent font-semibold text-slate-800 focus:outline-none"
              >
                <option value="all">All</option>
                <option value="A">Sec A</option>
                <option value="B">Sec B</option>
                <option value="C">Sec C</option>
                <option value="D">Sec D</option>
                <option value="E">Sec E</option>
              </select>
            </div>

            {/* Status Segmented Control */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl font-medium">
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg transition ${statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600'}`}
              >
                All
              </button>
              <button
                onClick={() => {
                  setStatusFilter('active');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg transition ${statusFilter === 'active' ? 'bg-white text-emerald-800 shadow-2xs font-semibold' : 'text-slate-600'}`}
              >
                Active
              </button>
              <button
                onClick={() => {
                  setStatusFilter('inactive');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg transition ${statusFilter === 'inactive' ? 'bg-white text-rose-800 shadow-2xs font-semibold' : 'text-slate-600'}`}
              >
                Inactive
              </button>
            </div>
          </div>
        </div>

        {/* Scalable Students Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 w-12 text-center">Photo</th>
                <th className="py-3 px-4">Admission No</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Class &amp; Sec</th>
                <th className="py-3 px-4">Roll No</th>
                <th className="py-3 px-4">Blood</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <span className="inline-block w-6 h-6 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mb-2" />
                    <p>Loading students directory...</p>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <GraduationCap className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-800">No students match criteria</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      {searchQuery ? 'Try clearing your search term or filters' : 'Admit your first student to generate their safety QR ID card'}
                    </p>
                  </td>
                </tr>
              ) : (
                students.map((st) => {
                  const signedUrl = photoUrlMap.get(st.id);
                  const isActive = st.status === 'active';

                  return (
                    <tr key={st.id} className="hover:bg-slate-50/70 transition">
                      {/* Photo Thumbnail */}
                      <td className="py-2 px-4 text-center">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 border border-slate-200 mx-auto flex items-center justify-center">
                          {signedUrl ? (
                            <img
                              src={signedUrl}
                              alt={st.full_name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <User className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </td>

                      {/* Admission Number */}
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                        {st.admission_number}
                      </td>

                      {/* Full Name */}
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {st.full_name}
                      </td>

                      {/* Class & Section */}
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {st.student_class} - {st.section}
                      </td>

                      {/* Roll Number */}
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {st.roll_number || '—'}
                      </td>

                      {/* Blood Group */}
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {st.blood_group || '—'}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 font-medium ${isActive ? 'text-emerald-700' : 'text-slate-400'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => onSelectStudentForCard(st)}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                          title="Generate &amp; Print QR ID Card"
                        >
                          <span className="flex items-center gap-1">
                            <QrCode className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">QR Card</span>
                          </span>
                        </button>

                        <button
                          onClick={() => onSelectStudentForLink(st)}
                          className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded-lg transition"
                          title="Link Parents / Guardians"
                        >
                          <Users className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onSelectStudentForEdit(st)}
                          className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded-lg transition"
                          title="Edit Student Info"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setStudentToToggle(st)}
                          className={`p-1.5 rounded-lg transition ${isActive ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                          title={isActive ? 'Deactivate' : 'Re-activate'}
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

        {/* Server-side Pagination */}
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

      {/* Confirm Deactivation / Status Toggle */}
      <ConfirmModal
        isOpen={Boolean(studentToToggle)}
        title={studentToToggle?.status === 'active' ? 'Deactivate Student Record' : 'Activate Student Record'}
        message={
          studentToToggle?.status === 'active'
            ? `Are you sure you want to mark ${studentToToggle?.full_name} (Adm: ${studentToToggle?.admission_number}) as inactive? The student's QR ID card will show inactive during gate scans.`
            : `Are you sure you want to restore active tracking for ${studentToToggle?.full_name}?`
        }
        confirmLabel={studentToToggle?.status === 'active' ? 'Deactivate Student' : 'Activate Student'}
        variant={studentToToggle?.status === 'active' ? 'danger' : 'primary'}
        isLoading={isToggleLoading}
        onConfirm={handleToggleStudentStatus}
        onClose={() => setStudentToToggle(null)}
      />
    </div>
  );
};
