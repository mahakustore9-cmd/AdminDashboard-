// ==============================================================================
// MAHAKU CORPORATION PVT. LTD. - STUDENT SAFETY TRACKING SYSTEM
// Private Storage Service for Student Photos
// ==============================================================================

import { supabase, formatSupabaseError } from './supabase';
import { CompressionResult } from './photoCompression';

const BUCKET_NAME = 'student-photos';
const SIGNED_URL_CACHE_MS = 45 * 60 * 1000; // 45 minutes (Supabase default expiry is 60m)

interface CachedUrl {
  url: string;
  expiresAt: number;
}

const signedUrlCache = new Map<string, CachedUrl>();

/**
 * Uploads compressed student photo to the private student-photos bucket
 * and registers it in the student_photos database table.
 */
export async function uploadStudentPhoto(
  schoolId: string,
  studentId: string,
  compressed: CompressionResult
): Promise<{ storagePath: string; signedUrl: string }> {
  const extension = compressed.mimeType === 'image/webp' ? 'webp' : 'jpg';
  const randomFileName = `${crypto.randomUUID()}.${extension}`;
  const storagePath = `${schoolId}/${studentId}/${randomFileName}`;

  // 1. Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, compressed.blob, {
      contentType: compressed.mimeType,
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  // 2. Insert or Update student_photos record
  const { error: dbError } = await supabase
    .from('student_photos')
    .upsert(
      {
        school_id: schoolId,
        student_id: studentId,
        storage_path: storagePath,
        file_size_bytes: compressed.sizeBytes,
        mime_type: compressed.mimeType,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'student_id' }
    );

  if (dbError) {
    // Attempt cleanup if DB insert fails
    await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
    throw new Error(formatSupabaseError(dbError));
  }

  // 3. Obtain initial short-lived signed URL for display
  const signedUrl = await getSignedPhotoUrl(storagePath);
  return { storagePath, signedUrl };
}

/**
 * Fetches a short-lived signed URL for an authorized user.
 * Caches in memory to avoid redundant calls.
 */
export async function getSignedPhotoUrl(storagePath: string): Promise<string> {
  if (!storagePath) return '';

  const now = Date.now();
  const cached = signedUrlCache.get(storagePath);
  if (cached && cached.expiresAt > now) {
    return cached.url;
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, 3600); // 1 hour

  if (error || !data?.signedUrl) {
    console.warn('Could not generate signed URL for path:', storagePath, error);
    return '';
  }

  signedUrlCache.set(storagePath, {
    url: data.signedUrl,
    expiresAt: now + SIGNED_URL_CACHE_MS,
  });

  return data.signedUrl;
}

/**
 * Batch resolve signed URLs for an array of student photo records
 */
export async function batchResolveSignedUrls(
  photoPaths: { studentId: string; storagePath: string }[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!photoPaths.length) return result;

  // Process in small parallel chunks
  await Promise.all(
    photoPaths.map(async (item) => {
      try {
        const url = await getSignedPhotoUrl(item.storagePath);
        if (url) {
          result.set(item.studentId, url);
        }
      } catch (e) {
        console.error('Failed to resolve photo for student:', item.studentId, e);
      }
    })
  );

  return result;
}
