// ==============================================================================
// MAHAKU CORPORATION PVT. LTD. - STUDENT SAFETY TRACKING SYSTEM
// Authentication & Multi-School Role Context
// ==============================================================================

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Profile, School, UserSchoolRole, UserRoleType } from '../types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userRoles: UserSchoolRole[];
  currentSchool: School | null;
  currentRole: UserRoleType | null;
  isSuperAdmin: boolean;
  isSchoolAdmin: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  activeSchoolError: string | null;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  selectSchool: (schoolId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRoles, setUserRoles] = useState<UserSchoolRole[]>([]);
  const [currentSchool, setCurrentSchool] = useState<School | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRoleType | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConfigured, setIsConfigured] = useState<boolean>(isSupabaseConfigured());
  const [activeSchoolError, setActiveSchoolError] = useState<string | null>(null);

  const fetchUserData = useCallback(async (authUser: User) => {
    try {
      setActiveSchoolError(null);

      // 1. Fetch user profile
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profileErr) {
        console.warn('Profile fetch error:', profileErr.message);
      }

      const userProfile: Profile = profileData || {
        id: authUser.id,
        email: authUser.email || '',
        full_name: authUser.user_metadata?.full_name || authUser.email || 'User',
        phone: authUser.user_metadata?.phone || null,
        is_super_admin: authUser.user_metadata?.is_super_admin === true,
        created_at: authUser.created_at,
        updated_at: authUser.created_at,
      };

      setProfile(userProfile);

      // If Super Admin
      if (userProfile.is_super_admin) {
        setCurrentRole('super_admin');
        setCurrentSchool(null);
        return;
      }

      // 2. Fetch User School Roles and associated schools
      const { data: rolesData, error: rolesErr } = await supabase
        .from('user_school_roles')
        .select('*, school:schools(*)')
        .eq('user_id', authUser.id)
        .eq('status', 'active');

      if (rolesErr) {
        console.warn('User roles fetch error:', rolesErr.message);
      }

      const roles = (rolesData || []) as (UserSchoolRole & { school: School })[];
      setUserRoles(roles);

      if (roles.length > 0) {
        // Find first active school
        const activeRole = roles.find((r) => r.school?.status === 'active');
        if (activeRole && activeRole.school) {
          setCurrentSchool(activeRole.school);
          setCurrentRole(activeRole.role as UserRoleType);
        } else {
          // School is deactivated!
          const firstSchool = roles[0].school;
          if (firstSchool && firstSchool.status === 'inactive') {
            setActiveSchoolError(`Your affiliated school "${firstSchool.school_name}" has been deactivated. Please contact the Super Administrator.`);
            setCurrentSchool(firstSchool);
            setCurrentRole(null);
          }
        }
      } else {
        setCurrentRole(null);
        setCurrentSchool(null);
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    setIsLoading(true);
    const configured = isSupabaseConfigured();
    setIsConfigured(configured);

    if (!configured) {
      setUser(null);
      setSession(null);
      setProfile(null);
      setUserRoles([]);
      setCurrentRole(null);
      setCurrentSchool(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        await fetchUserData(currentSession.user);
      } else {
        setProfile(null);
        setUserRoles([]);
        setCurrentRole(null);
        setCurrentSchool(null);
      }
    } catch (err) {
      console.error('Session check failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchUserData]);

  useEffect(() => {
    refreshAuth();

    if (!isSupabaseConfigured()) return;

    // Listen for Supabase auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          await fetchUserData(newSession.user);
        } else {
          setProfile(null);
          setUserRoles([]);
          setCurrentRole(null);
          setCurrentSchool(null);
        }
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshAuth, fetchUserData]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out warning:', err);
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    setUserRoles([]);
    setCurrentRole(null);
    setCurrentSchool(null);
    setActiveSchoolError(null);
  };

  const selectSchool = (schoolId: string) => {
    const selected = userRoles.find((r) => r.school_id === schoolId);
    if (selected && selected.school) {
      if (selected.school.status !== 'active') {
        setActiveSchoolError(`The school "${selected.school.school_name}" is currently deactivated.`);
        setCurrentSchool(selected.school);
        setCurrentRole(null);
      } else {
        setActiveSchoolError(null);
        setCurrentSchool(selected.school);
        setCurrentRole(selected.role as UserRoleType);
      }
    }
  };

  const isSuperAdmin = currentRole === 'super_admin' || profile?.is_super_admin === true;
  const isSchoolAdmin = currentRole === 'school_admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        userRoles,
        currentSchool,
        currentRole,
        isSuperAdmin,
        isSchoolAdmin,
        isLoading,
        isConfigured,
        activeSchoolError,
        signOut,
        refreshAuth,
        selectSchool,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
