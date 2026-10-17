import React, { useState, useEffect, useCallback } from 'react';
import { supabase, formatSupabaseError } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { SchoolClass } from '../../types/database';
import { Layers, Plus, Trash2, CheckCircle2, Sparkles, BookOpen } from 'lucide-react';

export const ClassesView: React.FC = () => {
  const { currentSchool } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [newClassName, setNewClassName] = useState('Class 1');
  const [newSection, setNewSection] = useState('A');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchClasses = useCallback(async () => {
    if (!currentSchool) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase
        .from('school_classes')
        .select('*')
        .eq('school_id', currentSchool.id)
        .order('class_name', { ascending: true })
        .order('section', { ascending: true });

      if (error) throw error;
      setClasses(data || []);
    } catch (err: unknown) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setIsLoading(false);
    }
  }, [currentSchool]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSchool) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { error } = await supabase.from('school_classes').insert([
        {
          school_id: currentSchool.id,
          class_name: newClassName.trim(),
          section: newSection.trim().toUpperCase(),
        },
      ]);

      if (error) throw error;

      setSuccessMsg(`Class "${newClassName} - ${newSection.toUpperCase()}" added successfully.`);
      await fetchClasses();
    } catch (err: unknown) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSeedStandardClasses = async () => {
    if (!currentSchool) return;
    if (!confirm('Populate standard Indian K-12 grades (Nursery to Class 12, Sections A & B)?')) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    const standardNames = [
      'Nursery', 'LKG', 'UKG',
      'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
      'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
      'Class 11', 'Class 12'
    ];

    const batch = [];
    for (const name of standardNames) {
      batch.push({ school_id: currentSchool.id, class_name: name, section: 'A' });
      batch.push({ school_id: currentSchool.id, class_name: name, section: 'B' });
    }

    try {
      const { error } = await supabase
        .from('school_classes')
        .upsert(batch, { onConflict: 'school_id, class_name, section' });

      if (error) throw error;
      setSuccessMsg('Successfully seeded standard school grades and sections.');
      await fetchClasses();
    } catch (err: unknown) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClass = async (classId: string) => {
    if (!confirm('Delete this class section? Students currently enrolled will remain.')) return;

    try {
      const { error } = await supabase
        .from('school_classes')
        .delete()
        .eq('id', classId);

      if (error) throw error;
      await fetchClasses();
    } catch (err: unknown) {
      alert(formatSupabaseError(err));
    }
  };

  // Group classes by class_name for clean scannable display
  const groupedClasses: Record<string, SchoolClass[]> = {};
  classes.forEach((c) => {
    if (!groupedClasses[c.class_name]) groupedClasses[c.class_name] = [];
    groupedClasses[c.class_name].push(c);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Classes &amp; Academic Sections
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure academic grade tiers and sections for student classification
          </p>
        </div>

        <button
          onClick={handleSeedStandardClasses}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Auto-Populate K-12 Grades</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Class Form */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 h-fit">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Plus className="w-4 h-4 text-blue-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Add Class &amp; Section
            </h2>
          </div>

          <form onSubmit={handleAddClass} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Class / Grade Name
              </label>
              <input
                type="text"
                required
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="e.g. Class 10 or Nursery"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Section
              </label>
              <input
                type="text"
                required
                maxLength={5}
                value={newSection}
                onChange={(e) => setNewSection(e.target.value.toUpperCase())}
                placeholder="e.g. A, B, C"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium uppercase font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Create Section</span>
            </button>
          </form>
        </div>

        {/* Existing Classes Grid */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Registered Academic Divisions ({classes.length})
              </h2>
            </div>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading academic classes...</div>
          ) : classes.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-800">No classes registered yet</p>
              <p className="text-slate-400 text-[11px] mt-0.5">
                Click <strong>Auto-Populate K-12 Grades</strong> to automatically register standard Indian school grades.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(groupedClasses).map(([className, sectionList]) => (
                <div key={className} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-900 text-xs">{className}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{sectionList.length} sections</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {sectionList.map((sec) => (
                      <div
                        key={sec.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700"
                      >
                        <span className="font-bold text-blue-700">Sec {sec.section}</span>
                        <button
                          onClick={() => handleDeleteClass(sec.id)}
                          className="text-slate-400 hover:text-rose-600 ml-0.5"
                          title="Remove section"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
