import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, GraduationCap, UserPlus, QrCode, Users, Building2 } from 'lucide-react';

interface BottomNavProps {
  activeView: string;
  onNavigate: (view: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeView, onNavigate }) => {
  const { isSuperAdmin } = useAuth();

  const navButton = (viewName: string, label: string, Icon: React.ElementType, isPrimary = false) => {
    const isActive = activeView === viewName;

    if (isPrimary) {
      return (
        <button
          key={viewName}
          onClick={() => onNavigate(viewName)}
          className="flex flex-col items-center justify-center min-w-[56px] min-h-[48px] -mt-4 group active:scale-95 transition"
        >
          <div className="w-12 h-12 rounded-full bg-blue-700 text-white shadow-lg flex items-center justify-center border-2 border-white group-hover:bg-blue-800 transition">
            <Icon className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-semibold text-slate-800 mt-0.5 tracking-tight">
            {label}
          </span>
        </button>
      );
    }

    return (
      <button
        key={viewName}
        onClick={() => onNavigate(viewName)}
        className={`flex flex-col items-center justify-center min-w-[48px] min-h-[44px] transition active:scale-95 ${
          isActive ? 'text-blue-700 font-semibold' : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        <Icon className={`w-5 h-5 ${isActive ? 'text-blue-700' : 'text-slate-500'}`} />
        <span className="text-[10px] mt-0.5 tracking-tight leading-none">{label}</span>
      </button>
    );
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg pb-[env(safe-area-inset-bottom,4px)]">
      {isSuperAdmin ? (
        <>
          {navButton('super-dashboard', 'Metrics', LayoutDashboard)}
          {navButton('super-schools', 'Schools', Building2)}
          {navButton('super-schools-add', 'New School', Building2, true)}
          {navButton('super-admins', 'Admins', Users)}
          {navButton('profile', 'Settings', Users)}
        </>
      ) : (
        <>
          {navButton('school-dashboard', 'Home', LayoutDashboard)}
          {navButton('students-list', 'Students', GraduationCap)}
          {navButton('student-add', 'Admit', UserPlus, true)}
          {navButton('qr-id-cards', 'QR Cards', QrCode)}
          {navButton('school-users', 'Staff/Parents', Users)}
        </>
      )}
    </nav>
  );
};
