import React, { useState, useEffect, useCallback } from 'react';
import { supabase, formatSupabaseError } from '../../lib/supabase';
import { School, SystemStats } from '../../types/database';
import { StatCard } from '../../components/Common/StatCard';
import { Pagination } from '../../components/Common/Pagination';
import { ConfirmModal } from '../../components/Common/ConfirmModal';
import { SchoolFormModal } from './SchoolFormModal';
import { AssignAdminModal } from './AssignAdminModal';
import { exportToCSV } from '../../lib/csvExport';
import {
  Building2,
  Users,
  GraduationCap,
  HardDrive,
  Search,
  Filter,
  Plus,
  Download,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  MoreVertical,
  ExternalLink,
  Edit2,
  Power
} from 'lucide-react';

interface SuperAdminDashboardProps {
  onNavigate: (view: string, payload?: unknown) => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<SystemStats>({
    totalSchools: 0,
    activeSchools: 0,
    inactiveSchools: 0,
    totalStudents: 0,
    totalSchoolAdmins: 0,
    totalPhotosCount: 0,
    approxStorageKB: 0,
  });

  const [schools, setSchools] = useState<School[]>([]);
  const [totalSchoolsCount, setTotalSchoolsCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modals state
  const [isSchoolFormOpen, setIsSchoolFormOpen] = useState(false);
  const [schoolToEdit, setSchoolToEdit] = useState<School | null>(null);
  const [assignAdminSchool, setAssignAdminSchool] = useState<School | null>(null);

  // Confirm deactivation
  const [schoolToToggle, setSchoolToToggle] = useState<School | null>(null);
  const [isToggleLoading, setIsToggleLoading] = useState(false);

  // Fetch metrics & schools
  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      // 1. Fetch system metrics in parallel
      const [
        { count: totalSchools },
        { count: activeSchools },
        { count: inactiveSchools },
        { count: totalStudents },
        { count: totalSchoolAdmins },
        { data: photoStats }
      ] = await Promise.all([
        supabase.from('schools').select('*', { count: 'exact', head: true }),
        supabase.from('schools').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('schools').select('*', { count: 'exact', head: true }).eq('status', 'inactive'),
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('user_school_roles').select('*', { count: 'exact', head: true }).eq('role', 'school_admin'),
        supabase.from('student_photos').select('file_size_bytes'),
      ]);

      const photoCount = photoStats?.length || 0;
      const totalBytes = (photoStats || []).reduce((acc, curr) => acc + (curr.file_size_bytes || 35000), 0);
      const approxStorageKB = Math.round(totalBytes / 1024);

      setStats({
        totalSchools: totalSchools || 0,
        activeSchools: activeSchools || 0,
        inactiveSchools: inactiveSchools || 0,
        totalStudents: totalStudents || 0,
        totalSchoolAdmins: totalSchoolAdmins || 0,
        totalPhotosCount: photoCount,
        approxStorageKB: approxStorageKB,
      });

      // 2. Fetch schools with pagination and search
      let query = supabase
        .from('schools')
        .select('*', { count: 'exact' });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (searchQuery.trim()) {
        const term = `%${searchQuery.trim()}%`;
        query = query.or(`school_name.ilike.${term},school_code.ilike.${term},city.ilike.${term}`);
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data: schoolList, count, error: listErr } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (listErr) throw listErr;

      setSchools(schoolList || []);
      setTotalSchoolsCount(count || 0);
    } catch (err: unknown) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, searchQuery, statusFilter]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Handle school activation / deactivation toggle
  const handleToggleStatus = async () => {
    if (!schoolToToggle) return;
    setIsToggleLoading(true);

    try {
      const newStatus = schoolToToggle.status === 'active' ? 'inactive' : 'active';
      const { error } = await supabase
        .from('schools')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', schoolToToggle.id);

      if (error) throw error;

      setSchoolToToggle(null);
      await fetchDashboardData();
    } catch (err: unknown) {
      alert(`Status update failed: ${formatSupabaseError(err)}`);
    } finally {
      setIsToggleLoading(false);
    }
  };

  const handleExportCSV = () => {
    exportToCSV<School>(
      'Mahaku_Schools_Directory',
      [
        { label: 'School Code', key: 'school_code' },
        { label: 'School Name', key: 'school_name' },
        { label: 'Status', key: 'status' },
        { label: 'City', key: 'city' },
        { label: 'State', key: 'state' },
        { label: 'Phone', key: 'phone' },
        { label: 'Email', key: 'email' },
        { label: 'Created At', key: (r: School) => new Date(r.created_at).toLocaleDateString() },
      ],
      schools
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Super Administrator Control Center
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Global monitoring of all campuses, security quotas, and school administrators
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
            onClick={() => {
              setSchoolToEdit(null);
              setIsSchoolFormOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Register New School</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Registered Schools"
          value={stats.totalSchools}
          subtitle={`${stats.activeSchools} active · ${stats.inactiveSchools} deactivated`}
          icon={Building2}
          variant="default"
        />
        <StatCard
          label="Active Campus Students"
          value={stats.totalStudents}
          subtitle="System-wide student roll"
          icon={GraduationCap}
          variant="success"
        />
        <StatCard
          label="School Administrators"
          value={stats.totalSchoolAdmins}
          subtitle="Authorized campus operators"
          icon={Users}
          variant="default"
        />
        <StatCard
          label="Private Storage Usage"
          value={`${stats.approxStorageKB} KB`}
          subtitle={`${stats.totalPhotosCount} photos (≤50 KB strict cap)`}
          icon={HardDrive}
          variant="warning"
        />
      </div>

      {/* Schools Directory & Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">Schools Directory</h2>
            <span className="text-xs text-slate-500 font-medium tabular-nums">
              ({totalSchoolsCount.toLocaleString('en-IN')})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <input
                type="text"
                placeholder="Search by school, code, city..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            </div>

            {/* Status Filter Tabs (Segmented control) */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-medium">
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-lg transition ${statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                All
              </button>
              <button
                onClick={() => {
                  setStatusFilter('active');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-lg transition ${statusFilter === 'active' ? 'bg-white text-emerald-800 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Active
              </button>
              <button
                onClick={() => {
                  setStatusFilter('inactive');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-lg transition ${statusFilter === 'inactive' ? 'bg-white text-rose-800 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Inactive
              </button>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 bg-rose-50 border-b border-rose-100 text-xs text-rose-800">
            {errorMsg}
          </div>
        )}

        {/* Schools Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">School Code</th>
                <th className="py-3 px-4">Campus Name</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <span className="inline-block w-6 h-6 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mb-2" />
                    <p>Loading schools directory...</p>
                  </td>
                </tr>
              ) : schools.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-800">No schools found</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      {searchQuery ? 'Try adjusting your search criteria' : 'Register your first campus to begin tracking students'}
                    </p>
                  </td>
                </tr>
              ) : (
                schools.map((school) => {
                  const isActive = school.status === 'active';
                  return (
                    <tr key={school.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                        {school.school_code}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => onNavigate('super-school-details', school)}
                          className="font-bold text-slate-900 hover:text-blue-700 transition text-left"
                        >
                          {school.school_name}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {school.city ? `${school.city}${school.state ? `, ${school.state}` : ''}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {school.phone || school.email || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 font-medium ${isActive ? 'text-emerald-700' : 'text-rose-600'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => onNavigate('super-school-details', school)}
                          className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded-lg transition"
                          title="View Campus Details & Students"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setAssignAdminSchool(school)}
                          className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded-lg transition"
                          title="Assign School Admin"
                        >
                          <Users className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            setSchoolToEdit(school);
                            setIsSchoolFormOpen(true);
                          }}
                          className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded-lg transition"
                          title="Edit School Information"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setSchoolToToggle(school)}
                          className={`p-1.5 rounded-lg transition ${isActive ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                          title={isActive ? 'Deactivate School' : 'Activate School'}
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

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalCount={totalSchoolsCount}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* School Form Modal (Create / Edit) */}
      <SchoolFormModal
        isOpen={isSchoolFormOpen}
        schoolToEdit={schoolToEdit}
        onClose={() => {
          setIsSchoolFormOpen(false);
          setSchoolToEdit(null);
        }}
        onSuccess={fetchDashboardData}
      />

      {/* Assign School Admin Modal */}
      <AssignAdminModal
        isOpen={Boolean(assignAdminSchool)}
        school={assignAdminSchool}
        onClose={() => setAssignAdminSchool(null)}
        onSuccess={fetchDashboardData}
      />

      {/* Confirm Deactivation Modal */}
      <ConfirmModal
        isOpen={Boolean(schoolToToggle)}
        title={schoolToToggle?.status === 'active' ? 'Deactivate School Campus' : 'Activate School Campus'}
        message={
          schoolToToggle?.status === 'active'
            ? `Are you sure you want to deactivate "${schoolToToggle?.school_name}"? When deactivated, all school administrators, teachers, guards, and parents for this school will be prevented from accessing the application and student tracking features.`
            : `Are you sure you want to re-activate "${schoolToToggle?.school_name}"? Authorized users will immediately regain access to student records.`
        }
        confirmLabel={schoolToToggle?.status === 'active' ? 'Deactivate School' : 'Activate School'}
        variant={schoolToToggle?.status === 'active' ? 'danger' : 'primary'}
        isLoading={isToggleLoading}
        onConfirm={handleToggleStatus}
        onClose={() => setSchoolToToggle(null)}
      />
    </div>
  );
};
