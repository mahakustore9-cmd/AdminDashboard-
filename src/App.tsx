/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ==============================================================================
// MAHAKU CORPORATION PVT. LTD. - STUDENT SAFETY TRACKING SYSTEM
// Main Application Component & View Router
// ==============================================================================

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/Layout/AppLayout';
import { LoginView } from './views/LoginView';
import { SuperAdminDashboard } from './views/SuperAdmin/SuperAdminDashboard';
import { SchoolDetailView } from './views/SuperAdmin/SchoolDetailView';
import { StorageQuotaView } from './views/SuperAdmin/StorageQuotaView';
import { SchoolAdminDashboard } from './views/SchoolAdmin/SchoolAdminDashboard';
import { StudentListView } from './views/SchoolAdmin/StudentListView';
import { StudentFormView } from './views/SchoolAdmin/StudentFormView';
import { StudentIDCardView } from './views/SchoolAdmin/StudentIDCardView';
import { SchoolUsersView } from './views/SchoolAdmin/SchoolUsersView';
import { ClassesView } from './views/SchoolAdmin/ClassesView';
import { ParentStudentLinkModal } from './views/SchoolAdmin/ParentStudentLinkModal';
import { ProfileView } from './views/Profile/ProfileView';
import { School, Student } from './types/database';
import { ShieldCheck, GraduationCap, Users } from 'lucide-react';

function MainApp() {
  const { user, isSuperAdmin, isSchoolAdmin, isLoading, currentRole, currentSchool } = useAuth();

  // Active view routing state
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
  const [studentForCard, setStudentForCard] = useState<Student | null>(null);
  const [studentForLink, setStudentForLink] = useState<Student | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center font-black text-xl mb-4 shadow-xl animate-pulse">
          M
        </div>
        <h2 className="text-base font-bold tracking-tight">MAHAKU SAFETY TRACKING SYSTEM</h2>
        <p className="text-xs text-slate-400 mt-1">Connecting to Supabase...</p>
      </div>
    );
  }

  // If not logged in, show Login Screen
  if (!user) {
    return (
      <LoginView
        onSuccess={() => {
          setActiveView('dashboard');
        }}
      />
    );
  }

  // Navigation Handler
  const handleNavigate = (view: string, payload?: unknown) => {
    if (view === 'super-school-details' && payload) {
      setSelectedSchool(payload as School);
      setActiveView('super-school-details');
      return;
    }

    if (view === 'student-edit' && payload) {
      setStudentToEdit(payload as Student);
      setActiveView('student-add');
      return;
    }

    if (view === 'student-add') {
      setStudentToEdit(null);
      setActiveView('student-add');
      return;
    }

    if (view === 'qr-id-cards') {
      if (payload) {
        setStudentForCard(payload as Student);
      }
      setActiveView('qr-id-cards');
      return;
    }

    setActiveView(view);
  };

  // Determine effective dashboard view
  const resolvedView = (() => {
    if (activeView === 'dashboard') {
      return isSuperAdmin ? 'super-dashboard' : 'school-dashboard';
    }
    return activeView;
  })();

  return (
    <AppLayout activeView={resolvedView} onNavigate={handleNavigate}>
      {/* ================= SUPER ADMIN VIEWS ================= */}
      {resolvedView === 'super-dashboard' && (
        <SuperAdminDashboard
          onNavigate={(view, payload) => handleNavigate(view, payload)}
        />
      )}

      {resolvedView === 'super-schools' && (
        <SuperAdminDashboard
          onNavigate={(view, payload) => handleNavigate(view, payload)}
        />
      )}

      {resolvedView === 'super-admins' && (
        <SuperAdminDashboard
          onNavigate={(view, payload) => handleNavigate(view, payload)}
        />
      )}

      {resolvedView === 'super-school-details' && selectedSchool && (
        <SchoolDetailView
          school={selectedSchool}
          onBack={() => setActiveView('super-dashboard')}
          onNavigateToStudent={(student) => {
            setStudentForCard(student);
            setActiveView('qr-id-cards');
          }}
        />
      )}

      {resolvedView === 'super-storage' && <StorageQuotaView />}

      {/* ================= SCHOOL ADMIN VIEWS ================= */}
      {resolvedView === 'school-dashboard' && (
        <SchoolAdminDashboard
          onNavigate={(view, payload) => handleNavigate(view, payload)}
        />
      )}

      {resolvedView === 'students-list' && (
        <StudentListView
          onNavigate={handleNavigate}
          onSelectStudentForCard={(student) => {
            setStudentForCard(student);
            setActiveView('qr-id-cards');
          }}
          onSelectStudentForEdit={(student) => {
            setStudentToEdit(student);
            setActiveView('student-add');
          }}
          onSelectStudentForLink={(student) => {
            setStudentForLink(student);
          }}
        />
      )}

      {resolvedView === 'student-add' && (
        <StudentFormView
          studentToEdit={studentToEdit}
          onBack={() => setActiveView('students-list')}
          onSuccess={(savedStudent) => {
            setStudentForCard(savedStudent);
            setActiveView('qr-id-cards');
          }}
        />
      )}

      {resolvedView === 'qr-id-cards' && (
        <StudentIDCardView
          initialStudent={studentForCard}
          onBack={() => setActiveView('students-list')}
        />
      )}

      {resolvedView === 'school-users' && (
        <SchoolUsersView onNavigate={handleNavigate} />
      )}

      {resolvedView === 'classes-sections' && <ClassesView />}

      {/* ================= COMMON VIEWS ================= */}
      {resolvedView === 'profile' && <ProfileView />}

      {/* Modal for Parent-Student Link */}
      <ParentStudentLinkModal
        isOpen={Boolean(studentForLink)}
        student={studentForLink}
        onClose={() => setStudentForLink(null)}
        onSuccess={() => {
          setStudentForLink(null);
        }}
      />
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
