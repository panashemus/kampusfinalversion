'use client';
import { useMemo, useState } from 'react';
import { BookOpen, Check, GraduationCap, Search, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { classifyUniversity } from '@/lib/utils';
import { isValidKriticCourse } from '@/lib/kritic-intake';
import type { Profile } from '@/lib/types';

/** Course onboarding is dismissible outside Kritic; the server independently enforces the gate. */
export default function KriticCourseGate({
  profile, onSaved, onDismiss, mandatory = false,
}: {
  profile: Profile; onSaved: (updated: Profile) => void; onDismiss?: () => void; mandatory?: boolean;
}) {
  const school = classifyUniversity(profile.email || profile.university);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');
  const [manual, setManual] = useState(false);
  const [manualName, setManualName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const filtered = useMemo(() =>
    school.courses.filter(name => name.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 25),
    [school.code, search]
  );
  const choice = manual ? manualName.trim() : selected;
  const valid = isValidKriticCourse(choice);
  const save = async () => {
    if (!valid || saving) return;
    setSaving(true); setError('');
    try {
      const { data, error: updateError } = await supabase.from('profiles')
        .update({course_code: choice, university: profile.university && profile.university !== 'Unknown' ? profile.university : school.fullName})
        .eq('id', profile.id).select('*').single();
      if (updateError || !data || data.course_code !== choice)
        throw new Error(updateError?.message || 'The course could not be saved. Please try again.');
      onSaved(data as Profile);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Course selection failed. Please retry.');
    } finally { setSaving(false); }
  };
  return (
    <div role="dialog" aria-modal="true" aria-label="Choose your academic programme"
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-3xl border border-pine/40 bg-surface p-5 sm:p-7 shadow-2xl text-white">
        {onDismiss && (
          <button aria-label="Choose later" onClick={onDismiss} className="absolute right-4 top-4 p-2 rounded-full text-sage hover:text-white hover:bg-ink"><X size={20}/></button>
        )}
        <div className="w-12 h-12 rounded-2xl bg-pine/15 text-pine flex items-center justify-center mb-4"><GraduationCap size={26}/></div>
        <p className="text-pine text-[10px] tracking-[.2em] font-black uppercase">Set up your student profile</p>
        <h2 className="text-2xl font-black mt-1">What course are you studying?</h2>
        <p className="text-sage text-sm mt-2 leading-relaxed">Kritic needs your actual programme to give relevant academic support. Choose it once, then use Exam Rescue to revise from your previous work.</p>
        <p className="mt-3 rounded-xl border border-gray-800 bg-ink px-3 py-2 text-xs text-sage"><BookOpen className="inline w-4 h-4 text-pine mr-2"/>Institution: <strong className="text-white">{school.fullName}</strong></p>
        {!manual ? (
          <>
            <label className="block text-sm font-bold mt-5 mb-2" htmlFor="course-picker-search">Find your course</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-3.5 text-sage"/>
              <input id="course-picker-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search degrees and programmes" autoComplete="off"
                className="w-full rounded-xl bg-ink border border-gray-700 focus:border-pine outline-none p-3 pl-10 text-sm text-white"/>
            </div>
            <div role="listbox" aria-label="Available programmes" className="mt-3 max-h-52 overflow-y-auto rounded-xl border border-gray-800 bg-ink divide-y divide-gray-800/60">
              {filtered.length ? filtered.map(name => (
                <button type="button" role="option" aria-selected={selected===name} key={name} onClick={()=>setSelected(name)}
                  className={'w-full p-3 text-left text-xs leading-relaxed flex gap-2 items-start hover:bg-pine/10 ' + (selected===name ? 'text-pine bg-pine/10' : 'text-white')}>
                  <span className="flex-1">{name}</span>{selected===name&&<Check className="w-4 h-4 shrink-0"/>}
                </button>
              )):<p className="px-3 py-4 text-xs text-sage">No exact match. Use “My course isn't listed” below.</p>}
            </div>
            <button className="mt-3 text-xs text-pine underline min-h-10" type="button" onClick={()=>{setManual(true);setSelected('');setError('');}}>My course isn't listed</button>
          </>
        ):(
          <div className="mt-5">
            <label htmlFor="course-picker-manual" className="block font-bold text-sm mb-2">Enter the exact title from your university</label>
            <input id="course-picker-manual" autoFocus maxLength={120} value={manualName} onChange={e=>setManualName(e.target.value)}
              placeholder="E.g. Diploma in Business Administration"
              className="w-full rounded-xl bg-ink border border-gray-700 focus:border-pine outline-none p-3 text-sm text-white"/>
            <p className="text-sage text-xs mt-2">Manually entered programmes are self-declared; this does not establish BQA accreditation.</p>
            <button type="button" onClick={()=>{setManual(false);setError('');}} className="mt-3 min-h-10 text-xs text-pine underline">Back to programme list</button>
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
        <button type="button" disabled={!valid||saving} onClick={save}
          className="mt-4 w-full min-h-12 rounded-xl bg-pine text-black font-black text-sm disabled:opacity-40">
          {saving?'Saving your course…':'Save course and unlock Kritic'}
        </button>
        {onDismiss && <button onClick={onDismiss} className="w-full min-h-11 mt-2 text-sage text-xs font-semibold">{mandatory ? 'Back to campus' : 'Not now — explore Kampus'}</button>}
        <p className="text-center text-[11px] text-sage mt-3">Your course can be changed later in your profile. No exam grades or pass results are guaranteed.</p>
      </div>
    </div>
  );
}
