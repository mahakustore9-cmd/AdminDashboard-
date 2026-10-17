import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Student } from '../../types/database';
import { generateQrDataUrl } from '../../lib/qrCode';
import { getSignedPhotoUrl } from '../../lib/storageService';
import { buildStudentCardWhatsAppUrl } from '../../lib/whatsapp';
import {
  ArrowLeft,
  Printer,
  Download,
  Share2,
  Shield,
  QrCode,
  User,
  GraduationCap,
  HeartPulse,
  Phone,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface StudentIDCardViewProps {
  initialStudent?: Student | null;
  onBack: () => void;
}

export const StudentIDCardView: React.FC<StudentIDCardViewProps> = ({
  initialStudent,
  onBack,
}) => {
  const { currentSchool } = useAuth();
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(initialStudent || null);
  const [studentsList, setStudentsList] = useState<Student[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [parentPhone, setParentPhone] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [cardOrientation, setCardOrientation] = useState<'portrait' | 'landscape'>('portrait');

  // Load students for selector dropdown if not preselected
  useEffect(() => {
    if (!currentSchool) return;

    const loadStudents = async () => {
      const { data } = await supabase
        .from('students')
        .select('*, photo:student_photos(*)')
        .eq('school_id', currentSchool.id)
        .order('full_name', { ascending: true })
        .limit(100);

      if (data && data.length > 0) {
        setStudentsList(data as Student[]);
        if (!selectedStudent) {
          setSelectedStudent(data[0] as Student);
        }
      }
    };

    loadStudents();
  }, [currentSchool]);

  // Load QR code, photo signed URL, and linked parent phone for the selected student
  useEffect(() => {
    if (!selectedStudent) return;

    let isMounted = true;
    setIsLoading(true);

    const loadCardAssets = async () => {
      try {
        // 1. Generate QR Code Data URL from opaque token
        const qrUrl = await generateQrDataUrl(selectedStudent.qr_token);
        if (isMounted) setQrDataUrl(qrUrl);

        // 2. Fetch signed photo URL
        if (selectedStudent.photo?.storage_path) {
          const pUrl = await getSignedPhotoUrl(selectedStudent.photo.storage_path);
          if (isMounted) setPhotoUrl(pUrl);
        } else {
          // Check database if photo relation wasn't populated
          const { data: photoData } = await supabase
            .from('student_photos')
            .select('storage_path')
            .eq('student_id', selectedStudent.id)
            .maybeSingle();

          if (photoData?.storage_path && isMounted) {
            const pUrl = await getSignedPhotoUrl(photoData.storage_path);
            if (isMounted) setPhotoUrl(pUrl);
          } else if (isMounted) {
            setPhotoUrl('');
          }
        }

        // 3. Check for linked parent phone for WhatsApp dispatch
        const { data: guardianData } = await supabase
          .from('student_guardians')
          .select('guardian_profile:profiles(phone)')
          .eq('student_id', selectedStudent.id)
          .eq('is_primary', true)
          .maybeSingle();

        if (isMounted) {
          const phone = (guardianData as unknown as { guardian_profile?: { phone?: string } })?.guardian_profile?.phone || '';
          setParentPhone(phone);
        }
      } catch (err) {
        console.error('Error loading card assets:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadCardAssets();

    return () => {
      isMounted = false;
    };
  }, [selectedStudent]);

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // WhatsApp Share to Parent
  const handleShareWhatsApp = () => {
    if (!selectedStudent || !currentSchool) return;

    const url = buildStudentCardWhatsAppUrl(
      parentPhone,
      selectedStudent.full_name,
      currentSchool.school_name,
      selectedStudent.student_class,
      selectedStudent.section,
      selectedStudent.admission_number
    );

    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Non-printable action bar */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Student Safety QR ID Card
            </h1>
            <p className="text-xs text-slate-500">
              High-resolution printable biometric campus security badge
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Student Selector */}
          {studentsList.length > 0 && (
            <select
              value={selectedStudent?.id || ''}
              onChange={(e) => {
                const found = studentsList.find((s) => s.id === e.target.value);
                if (found) setSelectedStudent(found);
              }}
              className="text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              {studentsList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.student_class}-{s.section} · Adm: {s.admission_number})
                </option>
              ))}
            </select>
          )}

          {/* Orientation switch */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-medium">
            <button
              onClick={() => setCardOrientation('portrait')}
              className={`px-2.5 py-1 rounded-lg transition ${cardOrientation === 'portrait' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600'}`}
            >
              Portrait Badge
            </button>
            <button
              onClick={() => setCardOrientation('landscape')}
              className={`px-2.5 py-1 rounded-lg transition ${cardOrientation === 'landscape' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600'}`}
            >
              Landscape Card
            </button>
          </div>

          <button
            onClick={handleShareWhatsApp}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>WhatsApp Parent</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition active:scale-98"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print ID Badge</span>
          </button>
        </div>
      </div>

      {!selectedStudent ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
          <QrCode className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="font-semibold text-slate-800">No student selected</p>
          <p className="text-slate-400 text-xs mt-1">Please admit a student or pick one from the directory.</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-4 sm:p-8 bg-slate-100/70 rounded-3xl border border-slate-200/80">
          {/* Card Print Container */}
          <div id="printable-id-card" className="print:m-0 print:p-0">
            {cardOrientation === 'portrait' ? (
              /* PORTRAIT BADGE FORMAT (Standard 54mm x 85.6mm vertical badge) */
              <div className="w-[320px] bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-300 flex flex-col text-slate-900 relative">
                {/* Lanyard Slot Simulation */}
                <div className="print:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-2" />

                {/* Badge Top Header */}
                <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-950 text-white p-3.5 text-center relative overflow-hidden">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
                      M
                    </div>
                    <div className="text-left leading-tight">
                      <p className="text-[12px] font-bold tracking-tight uppercase line-clamp-1">
                        {currentSchool?.school_name || 'MAHAKU PUBLIC SCHOOL'}
                      </p>
                      <p className="text-[9px] text-blue-200 uppercase tracking-widest font-semibold">
                        Student Safety Identity Badge
                      </p>
                    </div>
                  </div>
                </div>

                {/* Student Photo & Identity */}
                <div className="p-4 flex flex-col items-center text-center space-y-3">
                  {/* Photo Frame */}
                  <div className="w-24 h-28 rounded-xl overflow-hidden bg-slate-100 border-2 border-blue-600 shadow-sm flex items-center justify-center shrink-0">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={selectedStudent.full_name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="text-center p-2 text-slate-400">
                        <User className="w-8 h-8 mx-auto text-slate-300" />
                        <span className="text-[9px]">Photo</span>
                      </div>
                    )}
                  </div>

                  {/* Student Name & Academic Tag */}
                  <div>
                    <h3 className="text-base font-bold text-slate-900 tracking-tight leading-tight">
                      {selectedStudent.full_name}
                    </h3>
                    <p className="text-xs font-bold text-blue-700 mt-0.5">
                      Class {selectedStudent.student_class} - {selectedStudent.section}
                    </p>
                  </div>

                  {/* Attributes Matrix */}
                  <div className="w-full bg-slate-50 rounded-xl p-2.5 border border-slate-200 grid grid-cols-2 gap-2 text-left text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-semibold">Admission No</span>
                      <span className="font-mono font-bold text-slate-900">{selectedStudent.admission_number}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-semibold">Roll Number</span>
                      <span className="font-mono font-bold text-slate-900">{selectedStudent.roll_number || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-semibold">Blood Group</span>
                      <span className="font-bold text-rose-700">{selectedStudent.blood_group || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-semibold">Campus Code</span>
                      <span className="font-mono font-bold text-slate-900">{currentSchool?.school_code || 'MHK'}</span>
                    </div>
                  </div>

                  {/* QR Code Container */}
                  <div className="flex flex-col items-center space-y-1 pt-1">
                    <div className="w-24 h-24 p-1 bg-white rounded-lg border border-slate-200 shadow-2xs flex items-center justify-center">
                      {qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt="Security QR Code"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                          <QrCode className="w-6 h-6 text-slate-300" />
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] font-mono font-semibold text-slate-400 uppercase tracking-widest">
                      GATE TRACKING QR
                    </span>
                  </div>

                  {/* Principal Sign & Emergency Footer */}
                  <div className="w-full pt-2 border-t border-slate-200 flex items-end justify-between text-[9px] text-slate-500">
                    <div className="text-left">
                      <p className="font-semibold text-slate-700">Campus Helpline:</p>
                      <p className="font-mono">{currentSchool?.phone || '+91 11 2345 6789'}</p>
                    </div>
                    <div className="text-center">
                      <div className="w-16 border-b border-slate-400 mb-0.5" />
                      <p className="font-medium text-[8px] uppercase">Principal / Auth.</p>
                    </div>
                  </div>
                </div>

                {/* Micro Brand Ribbon */}
                <div className="bg-slate-900 text-slate-300 py-1 text-center text-[8px] font-semibold tracking-wider uppercase">
                  MAHAKU CORPORATION PVT. LTD. · SECURE SMART ID
                </div>
              </div>
            ) : (
              /* LANDSCAPE CARD FORMAT (Standard 85.6mm x 54mm credit card format) */
              <div className="w-[440px] bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-300 flex flex-col text-slate-900">
                {/* Header Strip */}
                <div className="bg-gradient-to-r from-blue-900 to-blue-800 text-white px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
                      M
                    </div>
                    <span className="font-bold text-xs uppercase tracking-tight line-clamp-1">
                      {currentSchool?.school_name || 'MAHAKU PUBLIC SCHOOL'}
                    </span>
                  </div>
                  <span className="text-[9px] text-blue-200 font-mono tracking-widest uppercase">
                    {currentSchool?.school_code || 'MHK'}
                  </span>
                </div>

                {/* Card Body */}
                <div className="p-4 grid grid-cols-12 gap-3 items-center">
                  {/* Photo */}
                  <div className="col-span-3">
                    <div className="w-20 h-24 rounded-xl overflow-hidden bg-slate-100 border-2 border-blue-600 shadow-2xs flex items-center justify-center">
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={selectedStudent.full_name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <User className="w-8 h-8 text-slate-300" />
                      )}
                    </div>
                  </div>

                  {/* Attributes */}
                  <div className="col-span-6 space-y-1.5 text-xs">
                    <h3 className="text-sm font-bold text-slate-900 tracking-tight leading-tight">
                      {selectedStudent.full_name}
                    </h3>
                    <p className="text-xs font-bold text-blue-700">
                      Class {selectedStudent.student_class} - {selectedStudent.section}
                    </p>

                    <div className="grid grid-cols-2 gap-1 text-[11px] pt-1">
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase">Adm No</span>
                        <span className="font-mono font-bold text-slate-900">{selectedStudent.admission_number}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase">Roll No</span>
                        <span className="font-mono font-bold text-slate-900">{selectedStudent.roll_number || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase">Blood Grp</span>
                        <span className="font-bold text-rose-700">{selectedStudent.blood_group || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase">DOB</span>
                        <span className="font-medium text-slate-700">{selectedStudent.date_of_birth || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* QR Code */}
                  <div className="col-span-3 flex flex-col items-center">
                    <div className="w-20 h-20 p-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
                      {qrDataUrl && (
                        <img
                          src={qrDataUrl}
                          alt="QR Code"
                          className="w-full h-full object-contain"
                        />
                      )}
                    </div>
                    <span className="text-[8px] font-mono text-slate-400 uppercase tracking-widest mt-0.5">
                      Gate Scan
                    </span>
                  </div>
                </div>

                {/* Footer Strip */}
                <div className="bg-slate-50 border-t border-slate-200 px-4 py-1.5 flex items-center justify-between text-[9px] text-slate-500">
                  <span>Helpline: {currentSchool?.phone || '+91 11 2345 6789'}</span>
                  <span className="font-medium">Authorized Signatory</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Notice */}
          <div className="print:hidden mt-6 text-center text-xs text-slate-500 max-w-sm">
            <p>
              💡 <strong>Print Tip:</strong> Use <em>Landscape/Portrait</em> settings with 100% scale in your printer dialog. The generated QR code is high-resolution 300 DPI for reliable camera and optical barcode scanning.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
