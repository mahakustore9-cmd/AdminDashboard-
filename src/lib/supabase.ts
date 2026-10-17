// ==============================================================================
// MAHAKU CORPORATION PVT. LTD. - STUDENT SAFETY TRACKING SYSTEM
// Supabase Client Setup & Session Management
// ==============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'mahaku_supabase_url';
const STORAGE_KEY_KEY = 'mahaku_supabase_anon_key';

export function getSupabaseCredentials(): { url: string; anonKey: string } {
  // Check localStorage overrides first (allows user to test with their Supabase project directly in the app)
  const localUrl = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_URL) : null;
  const localKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_KEY) : null;

  const url = (localUrl || import.meta.env.VITE_SUPABASE_URL || '').trim();
  const anonKey = (localKey || import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseCredentials();
  return Boolean(
    url &&
    anonKey &&
    url.startsWith('https://') &&
    url.includes('.supabase.co') &&
    anonKey.length > 20
  );
}

export function saveSupabaseCredentials(url: string, anonKey: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_URL, url.trim());
    localStorage.setItem(STORAGE_KEY_KEY, anonKey.trim());
  }
}

export function clearSupabaseCredentials() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_URL);
    localStorage.removeItem(STORAGE_KEY_KEY);
  }
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  const { url, anonKey } = getSupabaseCredentials();

  // If already instantiated with the same URL, reuse
  if (supabaseInstance) {
    return supabaseInstance;
  }

  // Fallback placeholder URL to prevent runtime crash during initial render before keys are supplied
  const effectiveUrl = url || 'https://placeholder-project.supabase.co';
  const effectiveKey = anonKey || 'placeholder-anon-key-placeholder-anon-key';

  supabaseInstance = createClient(effectiveUrl, effectiveKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  });

  return supabaseInstance;
}

export const supabase = getSupabaseClient();

/**
 * Re-initializes client when credentials change
 */
export function reinitializeSupabase() {
  supabaseInstance = null;
  return getSupabaseClient();
}

/**
 * Friendly error translator for Supabase errors
 */
export function formatSupabaseError(error: unknown): string {
  if (!error) return 'An unknown error occurred.';
  if (typeof error === 'string') return error;

  const err = error as { message?: string; code?: string; details?: string; hint?: string };

  if (err.message?.includes('JWT') || err.message?.includes('token')) {
    return 'Your session has expired. Please log in again.';
  }
  if (err.message?.includes('row-level security') || err.message?.includes('policy')) {
    return 'Access denied: You do not have permission to perform this action.';
  }
  if (err.message?.includes('duplicate key') || err.code === '23505') {
    if (err.message?.includes('admission_number') || err.message?.includes('uq_school_admission')) {
      return 'Admission number is already registered for this school.';
    }
    if (err.message?.includes('school_code')) {
      return 'A school with this School Code already exists.';
    }
    return 'This record already exists in the system.';
  }
  if (err.message?.includes('Failed to fetch') || err.message?.includes('network')) {
    return 'Unable to connect to Supabase. Please check your internet connection or Supabase URL.';
  }

  return err.message || 'Operation failed. Please try again.';
}
