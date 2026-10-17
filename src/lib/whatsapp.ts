// ==============================================================================
// MAHAKU CORPORATION PVT. LTD. - STUDENT SAFETY TRACKING SYSTEM
// WhatsApp Communication & Onboarding Dispatcher
// ==============================================================================

export interface WhatsAppInviteParams {
  schoolName: string;
  recipientName: string;
  recipientPhone?: string | null;
  role: string;
  email: string;
  temporaryPassword?: string;
  appUrl?: string;
}

/**
 * Builds a standardized, professional onboarding message for parents, guards, and teachers.
 * Encodes all parameters safely for WhatsApp web / mobile click-to-chat links.
 */
export function buildWhatsAppShareUrl(params: WhatsAppInviteParams): string {
  const portalUrl = params.appUrl || window.location.origin;

  const roleLabels: Record<string, string> = {
    parent: 'Parent Portal',
    guard: 'Security Guard Gate Scanner',
    teacher: 'Class Teacher Attendance',
    school_admin: 'School Administrator Console',
  };

  const roleTitle = roleLabels[params.role] || params.role;

  let text = `*MAHAKU STUDENT SAFETY TRACKING SYSTEM*\n`;
  text += `Official Notification from *${params.schoolName}*\n\n`;
  text += `Namaste ${params.recipientName},\n`;
  text += `Your access to the *${roleTitle}* has been configured.\n\n`;
  text += `📌 *Login Credentials:*\n`;
  text += `• Portal URL: ${portalUrl}\n`;
  text += `• Login Email / User ID: ${params.email}\n`;

  if (params.temporaryPassword) {
    text += `• Initial Temporary Password: ${params.temporaryPassword}\n`;
    text += `⚠️ *Security Note:* Please change this temporary password immediately after your first sign-in under Profile > Settings.\n\n`;
  } else {
    text += `• Password: If you do not have a password, please click "Forgot / Set Password" on the login screen to set your secure password.\n\n`;
  }

  text += `📲 *Mobile App Instructions:*\n`;
  text += `You can install this safety portal directly on your Android phone or iPhone by opening the URL in Chrome / Safari and tapping "Add to Home screen".\n\n`;
  text += `For assistance, please contact the school administrative office.\n`;
  text += `_Powered by MAHAKU CORPORATION PVT. LTD._`;

  const encodedText = encodeURIComponent(text);

  if (params.recipientPhone) {
    // Strip non-digits and ensure Indian country code 91 if 10-digit number
    let cleanPhone = params.recipientPhone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }

  return `https://wa.me/?text=${encodedText}`;
}

/**
 * Helper to share student ID Card details or emergency card link to parents via WhatsApp
 */
export function buildStudentCardWhatsAppUrl(
  parentPhone: string | null | undefined,
  studentName: string,
  schoolName: string,
  className: string,
  section: string,
  admissionNo: string
): string {
  let text = `*MAHAKU STUDENT SAFETY ID CARD*\n`;
  text += `School: *${schoolName}*\n`;
  text += `Student: *${studentName}*\n`;
  text += `Class: ${className} - ${section} | Admission No: ${admissionNo}\n\n`;
  text += `The official Digital Student Safety QR ID card has been issued. The QR code on the student badge is monitored for safe campus entry & exit.\n`;
  text += `_MAHAKU CORPORATION PVT. LTD._`;

  const encodedText = encodeURIComponent(text);
  if (parentPhone) {
    let cleanPhone = parentPhone.replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}
