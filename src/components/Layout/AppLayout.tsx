import React, { useState } from 'react';
import { AppHeader } from './AppHeader';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { OfflineIndicator } from '../OfflineIndicator';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle, Database, ShieldAlert } from 'lucide-react';
import { SupabaseConfigModal } from '../Common/SupabaseConfigModal';

interface AppLayoutProps {
  activeView: string;
  onNavigate: (view: string) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  activeView,
  onNavigate,
  children,
}) => {
  const { isConfigured, activeSchoolError } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Top Application Header */}
      <AppHeader
        activeView={activeView}
        onNavigate={onNavigate}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      {/* Database Setup Warning if Supabase is not configured */}
      {!isConfigured && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2.5 text-xs font-medium flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-slate-950" />
            <span>
              <strong>Supabase database not connected yet.</strong> Provide your project URL &amp; Anon Key or run the migration to activate full tracking capabilities.
            </span>
          </div>
          <button
            onClick={() => setShowConfigModal(true)}
            className="px-3 py-1 bg-slate-950 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition shrink-0 flex items-center gap-1.5"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Setup Now</span>
          </button>
        </div>
      )}

      {/* Deactivated School Critical Warning */}
      {activeSchoolError && (
        <div className="bg-rose-600 text-white px-4 py-3 text-xs font-medium flex items-center gap-3 shadow-xs">
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-200" />
          <div className="flex-1">
            <p className="font-bold">Campus Access Suspended</p>
            <p className="text-rose-100">{activeSchoolError}</p>
          </div>
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto">
        <Sidebar
          activeView={activeView}
          onNavigate={onNavigate}
          isOpenMobile={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pb-20 md:pb-8 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav activeView={activeView} onNavigate={onNavigate} />

      {/* Network Connectivity Status */}
      <OfflineIndicator />

      {/* Supabase Config Modal */}
      <SupabaseConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
      />
    </div>
  );
};
