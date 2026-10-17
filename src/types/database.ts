// ==============================================================================
// MAHAKU CORPORATION PVT. LTD. - STUDENT SAFETY TRACKING SYSTEM
// Database Types and Data Models
// ==============================================================================

export type SchoolStatus = 'active' | 'inactive';
export type StudentStatus = 'active' | 'inactive';
export type UserRoleType = 'super_admin' | 'school_admin' | 'parent' | 'guard' | 'teacher';
export type GenderType = 'Male' | 'Female' | 'Other';

export interface School {
  id: string;
  school_code: string;
  school_name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  email?: string | null;
  status: SchoolStatus;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  is_super_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSchoolRole {
  id: string;
  user_id: string;
  school_id: string;
  role: 'school_admin' | 'parent' | 'guard' | 'teacher';
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  // Joins
  school?: School;
  profile?: Profile;
}

export interface SchoolClass {
  id: string;
  school_id: string;
  class_name: string;
  section: string;
  created_at: string;
}

export interface Student {
  id: string;
  school_id: string;
  admission_number: string;
  full_name: string;
  student_class: string;
  section: string;
  roll_number?: string | null;
  date_of_birth?: string | null;
  gender?: GenderType | null;
  blood_group?: string | null;
  address?: string | null;
  qr_token: string;
  status: StudentStatus;
  created_at: string;
  updated_at: string;
  // Joined relation for photo path
  photo?: StudentPhoto | null;
  guardians?: StudentGuardian[];
}

export interface StudentPhoto {
  id: string;
  school_id: string;
  student_id: string;
  storage_path: string;
  file_size_bytes?: number | null;
  mime_type?: string | null;
  created_at: string;
  updated_at: string;
  // Computed client-side short-lived signed URL
  signed_url?: string | null;
}

export interface StudentGuardian {
  id: string;
  student_id: string;
  guardian_user_id: string;
  relationship: string;
  is_primary: boolean;
  created_at: string;
  guardian_profile?: Profile;
  student?: Student;
}

export interface SystemStats {
  totalSchools: number;
  activeSchools: number;
  inactiveSchools: number;
  totalStudents: number;
  totalSchoolAdmins: number;
  totalPhotosCount: number;
  approxStorageKB: number;
}
