import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Users,
  GraduationCap,
  UserPlus,
  QrCode,
  Layers,
  Settings,
  ShieldCheck,
  ChevronRight,
  X,
  HardDrive
} from 'lucide-react';
import { PWAInstallButton } from '../PWAInstallButton';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
}) => {
  const { isSuperAdmin, isSchoolAdmin, currentSchool, userRoles, selectSchool } = useAuth();

  const handleNav = (view: string) => {
    onNavigate(view);
    onCloseMobile();
  };

  const navItemClass = (viewName: string) => {
    const isActive = activeView === viewName;
    return `w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition ${
      isActive
        ? 'bg-blue-50 text-blue-800 font-semibold shadow-2xs border border-blue-100'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
    }`;
  };

  const content = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* School switcher for multi-school staff */}
      {userRoles.length > 1 && (
        <div className="p-3 border-b border-slate-100 bg-slate-50">
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Switch Campus
          </label>
          <select
            value={currentSchool?.id || ''}
            onChange={(e) => selectSchool(e.target.value)}
            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {userRoles.map((ur) => (
              <option key={ur.school_id} value={ur.school_id}>
                {ur.school?.school_name || 'School'} ({ur.role})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* SUPER ADMIN NAVIGATION */}
        {isSuperAdmin && (
          <div className="space-y-1">
            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Super Admin Console
            </p>
            <button
              onClick={() => handleNav('super-dashboard')}
              className={navItemClass('super-dashboard')}
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className="w-4 h-4 text-blue-600" />
                <span>Overview &amp; Metrics</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" />
            </button>

            <button
              onClick={() => handleNav('super-schools')}
              className={navItemClass('super-schools')}
            >
              <div className="flex items-center gap-2.5">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>Schools Directory</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" />
            </button>

            <button
              onClick={() => handleNav('super-admins')}
              className={navItemClass('super-admins')}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>School Admins</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" />
            </button>

            <button
              onClick={() => handleNav('super-storage')}
              className={navItemClass('super-storage')}
            >
              <div className="flex items-center gap-2.5">
                <HardDrive className="w-4 h-4 text-blue-600" />
                <span>Storage &amp; Quotas</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" />
            </button>
          </div>
        )}

        {/* SCHOOL ADMIN NAVIGATION */}
        {(isSchoolAdmin || !isSuperAdmin) && (
          <div className="space-y-1">
            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              School Administration
            </p>

            <button
              onClick={() => handleNav('school-dashboard')}
              className={navItemClass('school-dashboard')}
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className="w-4 h-4 text-blue-600" />
                <span>Campus Dashboard</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" />
            </button>

            <button
              onClick={() => handleNav('students-list')}
              className={navItemClass('students-list')}
            >
              <div className="flex items-center gap-2.5">
                <GraduationCap className="w-4 h-4 text-blue-600" />
                <span>Students Roster</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" />
            </button>

            <button
              onClick={() => handleNav('student-add')}
              className={navItemClass('student-add')}
            >
              <div className="flex items-center gap-2.5">
                <UserPlus className="w-4 h-4 text-blue-600" />
                <span>Admit New Student</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" />
            </button>

            <button
              onClick={() => handleNav('qr-id-cards')}
              className={navItemClass('qr-id-cards')}
            >
              <div className="flex items-center gap-2.5">
                <QrCode className="w-4 h-4 text-blue-600" />
                <span>Student QR ID Cards</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" />
            </button>

            <button
              onClick={() => handleNav('school-users')}
              className={navItemClass('school-users')}
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Parents, Guards &amp; Teachers</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" />
            </button>

            <button
              onClick={() => handleNav('classes-sections')}
              className={navItemClass('classes-sections')}
            >
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Classes &amp; Sections</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" />
            </button>
          </div>
        )}

        {/* SYSTEM & PROFILE */}
        <div className="space-y-1">
          <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Account &amp; System
          </p>
          <button
            onClick={() => handleNav('profile')}
            className={navItemClass('profile')}
          >
            <div className="flex items-center gap-2.5">
              <Settings className="w-4 h-4 text-slate-500" />
              <span>Profile &amp; Security</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 opacity-40" />
          </button>
        </div>
      </div>

      {/* Sidebar Footer with PWA Install */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-2">
        <PWAInstallButton variant="sidebar" />
        <div className="text-[11px] text-slate-500 text-center">
          MAHAKU Safety v1.0 (PWA)
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Static Sidebar (width 260px) */}
      <aside className="hidden md:block w-64 shrink-0 h-[calc(100vh-4rem)] sticky top-16">
        {content}
      </aside>

      {/* Mobile Drawer (with Backdrop) */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[80vw] h-full bg-white z-10 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="font-bold text-slate-900 text-sm">Navigation</span>
              <button
                onClick={onCloseMobile}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">{content}</div>
          </div>
        </div>
      )}
    </>
  );
};
