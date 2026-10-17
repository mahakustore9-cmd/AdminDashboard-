import React, { useState, useEffect, useRef } from 'react';
import { supabase, formatSupabaseError } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Student } from '../../types/database';
import { compressStudentPhoto, CompressionResult, MAX_PHOTO_BYTES } from '../../lib/photoCompression';
import { uploadStudentPhoto, getSignedPhotoUrl } from '../../lib/storageService';
import { generateStudentQrToken } from '../../lib/qrCode';
import {
  ArrowLeft,
  UserPlus,
  Upload,
  Camera,
  CheckCircle2,
  AlertTriangle,
  X,
  FileImage,
  QrCode,
  ShieldAlert
} from 'lucide-react';

interface StudentFormViewProps {
  studentToEdit?: Student | null;
  onBack: () => void;
  onSuccess: (savedStudent: Student) => void;
}

export const StudentFormView: React.FC<StudentFormViewProps> = ({
  studentToEdit,
  onBack,
  onSuccess,
}) => {
  const { currentSchool } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form Fields
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [studentClass, setStudentClass] = useState('Class 1');
  const [section, setSection] = useState('A');
  const [rollNumber, setRollNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [bloodGroup, setBloodGroup] = useState('B+');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  // Photo State & Compression
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [compressedResult, setCompressedResult] = useState<CompressionResult | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<string | null>(null);

  // Status
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Populate data when editing
  useEffect(() => {
    if (studentToEdit) {
      setAdmissionNumber(studentToEdit.admission_number);
      setFullName(studentToEdit.full_name);
      setStudentClass(studentToEdit.student_class);
      setSection(studentToEdit.section);
      setRollNumber(studentToEdit.roll_number || '');
      setDateOfBirth(studentToEdit.date_of_birth || '');
      setGender(studentToEdit.gender || 'Male');
      setBloodGroup(studentToEdit.blood_group || 'B+');
      setAddress(studentToEdit.address || '');
      setStatus(studentToEdit.status);

      // Fetch existing photo signed URL if exists
      if (studentToEdit.photo?.storage_path) {
        getSignedPhotoUrl(studentToEdit.photo.storage_path).then((url) => {
          if (url) setExistingPhotoUrl(url);
        });
      }
    } else {
      setAdmissionNumber(`ADM-${Math.floor(10000 + Math.random() * 90000)}`);
      setFullName('');
      setStudentClass('Class 1');
      setSection('A');
      setRollNumber('');
      setDateOfBirth('');
      setGender('Male');
      setBloodGroup('B+');
      setAddress('');
      setStatus('active');
      setSelectedFile(null);
      setCompressedResult(null);
      setExistingPhotoUrl(null);
      setCompressionInfo(null);
    }
  }, [studentToEdit]);

  // Handle Photo Selection with Strict 50 KB Compression
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setIsCompressing(true);
    setCompressionInfo(null);

    const origKb = (file.size / 1024).toFixed(1);

    try {
      // Run iterative canvas compressor
      const result = await compressStudentPhoto(file);
      const finalKb = (result.sizeBytes / 1024).toFixed(1);

      setSelectedFile(file);
      setCompressedResult(result);
      setCompressionInfo(`Original: ${origKb} KB ➔ Compressed: ${finalKb} KB (Passes 50 KB Cap)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Photo compression failed.';
      setErrorMsg(msg);
      setSelectedFile(null);
      setCompressedResult(null);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleClearPhoto = () => {
    setSelectedFile(null);
    setCompressedResult(null);
    setCompressionInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSchool) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const qrToken = studentToEdit?.qr_token || generateStudentQrToken();

      const studentPayload = {
        school_id: currentSchool.id,
        admission_number: admissionNumber.trim().toUpperCase(),
        full_name: fullName.trim(),
        student_class: studentClass.trim(),
        section: section.trim().toUpperCase(),
        roll_number: rollNumber.trim() || null,
        date_of_birth: dateOfBirth || null,
        gender: gender,
        blood_group: bloodGroup || null,
        address: address.trim() || null,
        qr_token: qrToken,
        status: status,
        updated_at: new Date().toISOString(),
      };

      let savedStudentId: string;
      let finalStudentData: Student;

      if (studentToEdit) {
        const { data, error } = await supabase
          .from('students')
          .update(studentPayload)
          .eq('id', studentToEdit.id)
          .select()
          .single();

        if (error) throw error;
        savedStudentId = data.id;
        finalStudentData = data as Student;
      } else {
        const { data, error } = await supabase
          .from('students')
          .insert([studentPayload])
          .select()
          .single();

        if (error) throw error;
        savedStudentId = data.id;
        finalStudentData = data as Student;
      }

      // If a new compressed photo was selected, upload it to private storage
      if (compressedResult) {
        await uploadStudentPhoto(currentSchool.id, savedStudentId, compressedResult);
      }

      onSuccess(finalStudentData);
    } catch (err: unknown) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const classesList = [
    'Nursery', 'LKG', 'UKG',
    'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
    'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
    'Class 11', 'Class 12'
  ];

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {studentToEdit ? `Edit Student: ${studentToEdit.full_name}` : 'Student Admission & ID Provisioning'}
          </h1>
          <p className="text-xs text-slate-500">
            {currentSchool?.school_name} · Complete student record and biometric badge generation
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 leading-relaxed">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Photo Upload Card (Strict 50 KB Limit) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-blue-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Official Student Photograph
              </h2>
            </div>
            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
              Strict 50 KB Storage Limit
            </span>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row items-center gap-6">
            {/* Image Preview Box */}
            <div className="w-32 h-40 rounded-2xl overflow-hidden bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center relative shrink-0 shadow-2xs">
              {compressedResult ? (
                <img
                  src={compressedResult.previewUrl}
                  alt="Student Preview"
                  className="w-full h-full object-cover"
                />
              ) : existingPhotoUrl ? (
                <img
                  src={existingPhotoUrl}
                  alt="Existing Student Photo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-3 text-slate-400">
                  <FileImage className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                  <span className="text-[10px] block">No photo</span>
                </div>
              )}

              {compressedResult && (
                <button
                  type="button"
                  onClick={handleClearPhoto}
                  className="absolute top-1.5 right-1.5 p-1 bg-black/70 hover:bg-black text-white rounded-full transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Upload & Compression Controls */}
            <div className="flex-1 space-y-2 text-xs">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoSelect}
                className="hidden"
                id="student-photo-upload"
              />

              <div className="flex flex-wrap items-center gap-2">
                <label
                  htmlFor="student-photo-upload"
                  className={`px-4 py-2 rounded-xl font-semibold cursor-pointer transition flex items-center gap-2 shadow-xs ${isCompressing ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isCompressing ? 'Compressing Image...' : (compressedResult || existingPhotoUrl ? 'Change Photo' : 'Select Photo')}</span>
                </label>
                {(compressedResult || existingPhotoUrl) && (
                  <button
                    type="button"
                    onClick={handleClearPhoto}
                    className="px-3 py-2 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl"
                  >
                    Remove
                  </button>
                )}
              </div>

              {compressionInfo && (
                <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{compressionInfo}</span>
                </div>
              )}

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Accepted: JPEG, PNG, WebP. High-resolution images are automatically cropped and compressed to under <strong>50 KB</strong> before encrypted upload to the private <code>student-photos</code> storage bucket.
              </p>
            </div>
          </div>
        </div>

        {/* Academic & Identity Details Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <UserPlus className="w-4 h-4 text-blue-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Student Academic &amp; Personal Details
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Admission Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={admissionNumber}
                onChange={(e) => setAdmissionNumber(e.target.value.toUpperCase())}
                placeholder="e.g. ADM-2026-001"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono font-medium uppercase"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Full Name of Student <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Aarav Sharma"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Class / Grade <span className="text-rose-500">*</span>
              </label>
              <select
                value={studentClass}
                onChange={(e) => setStudentClass(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
              >
                {classesList.map((cls) => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Section <span className="text-rose-500">*</span>
              </label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
              >
                {['A', 'B', 'C', 'D', 'E', 'F'].map((sec) => (
                  <option key={sec} value={sec}>Section {sec}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Roll Number
              </label>
              <input
                type="text"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="e.g. 14"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Blood Group
              </label>
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
              >
                {bloodGroups.map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Date of Birth
              </label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Gender
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as 'Male' | 'Female' | 'Other')}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Admission Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
              >
                <option value="active">Active (Enrolled)</option>
                <option value="inactive">Inactive (Withdrawn)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Residential Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="House/Flat No, Street, City, Pin Code"
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        {/* Security QR Token Notice */}
        <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 flex items-start gap-3 text-xs text-blue-900">
          <QrCode className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-blue-950">Cryptographic QR Token Protection</p>
            <p className="mt-0.5 text-blue-800">
              Each student is assigned a collision-resistant random opaque token. Personal details (such as address or phone number) are never encoded in the raw QR code matrix, preventing privacy exposure if the ID card is scanned by unauthorized third-party scanner apps.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            disabled={isLoading || isCompressing}
            className="px-5 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || isCompressing}
            className="px-6 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-md transition flex items-center gap-2 active:scale-98 disabled:opacity-50"
          >
            {isLoading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            <span>{studentToEdit ? 'Save Changes' : 'Complete Admission & Generate ID'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
