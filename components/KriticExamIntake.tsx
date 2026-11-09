'use client';
import {useRef} from 'react';
import {FileCheck2, BookOpenText, ShieldAlert, GraduationCap} from 'lucide-react';
import type {KriticMode,KriticFileKind} from '@/lib/kritic-intake';

type Props={
  mode:KriticMode;onModeChange:(value:KriticMode)=>void;
  topic:string;onTopicChange:(value:string)=>void;
  examDate:string;onDateChange:(value:string)=>void;
  onFiles:(files:File[],kind:KriticFileKind)=>void;
  uploading:boolean;
};
const accept='.pdf,.docx,.doc,.txt,.jpg,.jpeg,.png,.webp';
export default function KriticExamIntake({mode,onModeChange,topic,onTopicChange,examDate,onDateChange,onFiles,uploading}:Props){
  const markedRef=useRef<HTMLInputElement>(null);
  const notesRef=useRef<HTMLInputElement>(null);
  return <section aria-label="Kritic study options" className="border-b border-gray-800 p-3.5 sm:p-4 space-y-3 max-h-[44dvh] overflow-y-auto overscroll-contain">
    <div role="group" aria-label="Study mode" className="grid grid-cols-2 gap-2">
      <button type="button" aria-pressed={mode==='exam_rescue'} onClick={()=>onModeChange('exam_rescue')}
        className={'min-h-11 rounded-xl border px-2 text-xs font-black transition-colors '+(mode==='exam_rescue'?'bg-pine border-pine text-black':'border-gray-700 bg-surface text-sage hover:text-white')}>Exam Rescue · Finals</button>
      <button type="button" aria-pressed={mode==='coursework_review'} onClick={()=>onModeChange('coursework_review')}
        className={'min-h-11 rounded-xl border px-2 text-xs font-black transition-colors '+(mode==='coursework_review'?'bg-pine border-pine text-black':'border-gray-700 bg-surface text-sage hover:text-white')}>Coursework Review</button>
    </div>
    {mode==='exam_rescue'?<div className="rounded-2xl bg-surface border border-pine/40 p-4 space-y-3">
      <div className="flex gap-3 items-start">
        <div className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-pine/15 text-pine"><GraduationCap size={22}/></div>
        <div>
          <p className="uppercase text-[10px] font-black tracking-widest text-pine">Exam Rescue</p>
          <h2 className="text-white font-black text-base mt-0.5">Turn old mistakes into your revision plan.</h2>
          <p className="text-sage text-xs leading-relaxed mt-1">Give Kritic your earlier marked test or assignment and lecture slides. It will compare evidence, explain weaknesses, set revision priorities and create original practice questions.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="text-[11px] text-sage font-semibold">Module or topic (recommended)
          <input type="text" value={topic} maxLength={120} onChange={e=>onTopicChange(e.target.value)} placeholder="e.g. Financial Accounting 1"
            className="mt-1 w-full rounded-xl bg-ink text-white border border-gray-700 p-3 text-xs outline-none focus:border-pine"/>
        </label>
        <label className="text-[11px] text-sage font-semibold">Exam date (optional)
          <input type="date" value={examDate} onChange={e=>onDateChange(e.target.value)}
            className="mt-1 w-full rounded-xl bg-ink text-white border border-gray-700 p-3 text-xs outline-none focus:border-pine"/>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={uploading} onClick={()=>markedRef.current?.click()}
          className="min-h-16 rounded-xl border border-gray-700 bg-ink hover:border-pine disabled:opacity-40 px-3 py-3 text-left">
          <FileCheck2 className="w-5 h-5 text-pine mb-1"/>
          <span className="text-xs text-white font-bold block">Past marked work</span>
          <span className="text-[10px] text-sage">Graded test / assignment</span>
        </button>
        <button type="button" disabled={uploading} onClick={()=>notesRef.current?.click()}
          className="min-h-16 rounded-xl border border-gray-700 bg-ink hover:border-pine disabled:opacity-40 px-3 py-3 text-left">
          <BookOpenText className="w-5 h-5 text-pine mb-1"/>
          <span className="text-xs text-white font-bold block">Lecture material</span>
          <span className="text-[10px] text-sage">Slides / notes / outline</span>
        </button>
        <input aria-label="Upload previous marked work" type="file" multiple accept={accept} ref={markedRef} className="hidden" onChange={e=>{if(e.target.files)onFiles(Array.from(e.target.files),'graded_work');e.target.value='';}}/>
        <input aria-label="Upload lecture slides or notes" type="file" multiple accept={accept} ref={notesRef} className="hidden" onChange={e=>{if(e.target.files)onFiles(Array.from(e.target.files),'lecture_material');e.target.value='';}}/>
      </div>
      <div className="flex gap-2 items-start"><ShieldAlert className="text-sage w-4 h-4 shrink-0 mt-0.5"/>
        <p className="text-[11px] leading-relaxed text-sage">4 files maximum; 10 MB per file, 25 MB combined. Files are processed by Google Gemini AI. Remove student numbers, names and other personal details before uploading. <strong className="text-white">This is a study aid, not official marking. It cannot predict your exam or guarantee a pass.</strong></p>
      </div>
    </div>:<p className="text-xs leading-relaxed text-sage">Review drafts, rubrics, calculations or citations. Upload coursework in the composer below. Feedback is independent, not a lecturer&apos;s official grade.</p>}
    <p className="text-[11px] text-sage">20 requests per student per UTC day, subject to shared daily capacity. Greetings and empty prompts are rejected before AI usage.</p>
  </section>;
}
