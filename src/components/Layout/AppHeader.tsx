import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PWAInstallButton } from '../PWAInstallButton';
import { LogOut, User as UserIcon, Database, Menu, School as SchoolIcon, ShieldAlert } from 'lucide-react';
import { SupabaseConfigModal } from '../Common/SupabaseConfigModal';

interface AppHeaderProps {
  onToggleMobileMenu: () => void;
  activeView: string;
  onNavigate: (view: string) => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onToggleMobileMenu,
  activeView,
  onNavigate,
}) => {
  const { user, profile, isSuperAdmin, currentRole, currentSchool, signOut, isConfigured } = useAuth();
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between gap-4 md:gap-8 shadow-2xs">
        {/* Zone 1: Mobile Hamburger + Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            onClick={() => onNavigate(isSuperAdmin ? 'super-dashboard' : 'school-dashboard')}
            className="flex items-center gap-2.5 text-left group"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-700 flex items-center justify-center text-white font-black text-sm tracking-tighter shadow-xs">
              M
            </div>
            <div className="leading-tight">
              <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap block group-hover:text-blue-700 transition">
                MAHAKU SAFETY
              </span>
              <span className="text-[10px] text-slate-500 font-medium tracking-wide uppercase hidden sm:block">
                Corporation Pvt. Ltd.
              </span>
            </div>
          </button>
        </div>

        {/* Zone 2: Navigation Links / Current School Indicator */}
        <div className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600">
          {currentSchool ? (
            <div className="flex items-center gap-2 text-xs text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              <SchoolIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="font-semibold truncate max-w-[220px]">{currentSchool.school_name}</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500 font-mono text-[11px]">{currentSchool.school_code}</span>
            </div>
          ) : isSuperAdmin ? (
            <div className="flex items-center gap-2 text-xs text-blue-900 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 font-medium">
              <ShieldAlert className="w-3.5 h-3.5 text-blue-700" />
              <span>Super Administrator Mode</span>
            </div>
          ) : null}
        </div>

        {/* Zone 3: Actions (PWA install, DB config, User Profile) */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* PWA Install Button */}
          <PWAInstallButton variant="header" />

          {/* Database Setup Button */}
          <button
            onClick={() => setShowConfigModal(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition ${isConfigured ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-amber-300 bg-amber-50 text-amber-800 animate-pulse'}`}
            title="Database Configuration & Migration"
          >
            <Database className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Database</span>
          </button>

          {/* User Account Menu */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 text-slate-700 hover:bg-slate-100 rounded-xl transition"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs uppercase">
                  {profile?.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-semibold text-slate-900 truncate max-w-[120px]">
                    {profile?.full_name || 'Admin'}
                  </p>
                  <p className="text-[10px] text-slate-500 capitalize">
                    {currentRole ? currentRole.replace('_', ' ') : 'User'}
                  </p>
                </div>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900 truncate">{profile?.full_name}</p>
                    <p className="text-[11px] text-slate-500 font-mono truncate">{user.email}</p>
                    <span className="inline-block mt-1 text-[10px] font-semibold text-blue-700 uppercase">
                      {isSuperAdmin ? 'Super Administrator' : (currentRole?.replace('_', ' ') || 'Staff')}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      onNavigate('profile');
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                    <span>My Profile &amp; Settings</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowConfigModal(true);
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Database className="w-3.5 h-3.5 text-slate-500" />
                    <span>Supabase Connection</span>
                  </button>

                  <div className="my-1 border-t border-slate-100" />

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      signOut();
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => onNavigate('login')}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-xs transition"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Supabase Config / Migration Modal */}
      <SupabaseConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
      />
    </>
  );
};
