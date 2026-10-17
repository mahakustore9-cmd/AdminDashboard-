import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { StatCard } from '../../components/Common/StatCard';
import { HardDrive, AlertTriangle, ShieldCheck, Database, FileImage, ExternalLink } from 'lucide-react';

export const StorageQuotaView: React.FC = () => {
  const [photoCount, setPhotoCount] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [largestPhotoBytes, setLargestPhotoBytes] = useState(0);
  const [schoolsCount, setSchoolsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStorageMetrics = async () => {
      setIsLoading(true);
      try {
        const [
          { data: photos },
          { count: schools }
        ] = await Promise.all([
          supabase.from('student_photos').select('file_size_bytes'),
          supabase.from('schools').select('*', { count: 'exact', head: true })
        ]);

        const count = photos?.length || 0;
        let sum = 0;
        let max = 0;
        (photos || []).forEach((p) => {
          const sz = p.file_size_bytes || 38000;
          sum += sz;
          if (sz > max) max = sz;
        });

        setPhotoCount(count);
        setTotalBytes(sum);
        setLargestPhotoBytes(max);
        setSchoolsCount(schools || 0);
      } catch (e) {
        console.error('Failed to fetch storage stats:', e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStorageMetrics();
  }, []);

  const totalKB = Math.round(totalBytes / 1024);
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
  const avgKB = photoCount > 0 ? (totalKB / photoCount).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Supabase Storage &amp; Database Quota Monitor
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          High-efficiency image compression analytics and Supabase resource governance
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Student Photos"
          value={photoCount}
          subtitle="Encrypted in private bucket"
          icon={FileImage}
          variant="default"
        />
        <StatCard
          label="Cumulative Storage Used"
          value={`${totalMB} MB`}
          subtitle={`${totalKB.toLocaleString()} KB total footprint`}
          icon={HardDrive}
          variant="default"
        />
        <StatCard
          label="Average Photo Size"
          value={`${avgKB} KB`}
          subtitle="Strict ≤50 KB compression"
          icon={ShieldCheck}
          variant="success"
        />
        <StatCard
          label="Participating Schools"
          value={schoolsCount}
          subtitle="Multi-tenant storage isolation"
          icon={Database}
          variant="default"
        />
      </div>

      {/* Storage Architecture & Monitoring Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 text-xs leading-relaxed">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 font-bold text-sm text-slate-900">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Strict 50 KB Limit Enforcement Architecture</span>
          </div>

          <p className="text-slate-600">
            To guarantee extreme scalability for tens of thousands of student records, the system enforces a strict 50 KB limit:
          </p>

          <ul className="space-y-1.5 text-slate-600 list-disc list-inside">
            <li><strong>Client-Side Canvas Downscaling:</strong> High-resolution photos taken on modern smartphones (3MB–15MB) are downscaled to 480px on canvas before network transmission.</li>
            <li><strong>Progressive WebP/JPEG Compression:</strong> Iterative quality algorithms ensure the output file is under 51,200 bytes.</li>
            <li><strong>Storage Bucket File Size Enforcement:</strong> The Supabase private bucket <code>student-photos</code> defines <code>file_size_limit: 51200</code> directly in Postgres storage policies.</li>
            <li><strong>Short-Lived Signed URLs:</strong> Photos are never public. Only authenticated users with matching school permissions receive 1-hour signed URLs.</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 text-xs leading-relaxed">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 font-bold text-sm text-slate-900">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Supabase Plan Governance &amp; Monitoring</span>
          </div>

          <p className="text-slate-600">
            Important documentation regarding Supabase tiers and database limits:
          </p>

          <ul className="space-y-1.5 text-slate-600 list-disc list-inside">
            <li><strong>Free Tier Limits:</strong> Supabase Free Tier allows up to 500 MB database size and 1 GB storage. With our 50 KB cap, 1 GB storage can hold up to <strong>20,000 student photographs</strong>!</li>
            <li><strong>Project Inactivity:</strong> Free tier Supabase projects pause after 7 days of inactivity. Upgrading to the Pro tier prevents pausing and gives 100 GB storage.</li>
            <li><strong>Live Dashboard Monitoring:</strong> Monitor database disk space and egress traffic in your <strong>Supabase Dashboard &gt; Project Settings &gt; Usage</strong>.</li>
            <li><strong>Backups:</strong> Configure Point-In-Time Recovery (PITR) in Supabase Pro for automated continuous disaster recovery.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
