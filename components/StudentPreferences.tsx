'use client';

import { useEffect, useState } from 'react';
import { Bookmark, CheckCircle2, Settings2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { destinationHash } from '@/lib/interconnect';
import type { Profile } from '@/lib/types';

type SavedItem = { content_id: string; content_type: 'post' | 'listing'; title: string; available: boolean };

export default function StudentPreferences({ profile, onProfileUpdate }: { profile: Profile; onProfileUpdate?: (updated: Profile) => void }) {
  const [publicProfile, setPublicProfile] = useState(!!profile.public_profile);
  const [messages, setMessages] = useState(profile.allow_messages !== false);
  const [topics, setTopics] = useState<string[]>(profile.preferences?.topics || []);
  const [institutionFirst, setInstitutionFirst] = useState(profile.preferences?.institutionFirst !== false);
  const [showEditor, setShowEditor] = useState(!Array.isArray(profile.preferences?.topics));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [saved, setSaved] = useState<SavedItem[]>([]);

  useEffect(() => {
    let live = true;
    (async () => {
      const { data, error } = await supabase.from('saved_items').select('content_id,content_type').order('created_at', { ascending: false }).limit(40);
      if (error) { if (live) setNotice('Saved items are temporarily unavailable.'); return; }
      const rows = data || [];
      if (!rows.length) { if (live) setSaved([]); return; }
      const posts = rows.filter(r => r.content_type === 'post').map(r => r.content_id);
      const listings = rows.filter(r => r.content_type === 'listing').map(r => r.content_id);
      const [p, l] = await Promise.all([
        posts.length ? supabase.from('feed_preview').select('id,text').in('id', posts) : Promise.resolve({ data: [] }),
        listings.length ? supabase.from('listing_preview').select('id,title').in('id', listings).eq('status', 'active') : Promise.resolve({ data: [] }),
      ]);
      if (live) setSaved(rows.map(r => {
        const item = (r.content_type === 'post' ? p.data : l.data)?.find(i => i.id === r.content_id);
        return {
          content_id: r.content_id,
          content_type: r.content_type as 'post' | 'listing',
          title: item ? ('text' in item ? String(item.text) : String(item.title)) : 'Content no longer available',
          available: !!item,
        };
      }));
    })();
    return () => { live = false; };
  }, [profile.id]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setNotice('');
    const preferences = { topics, institutionFirst };
    const { error } = await supabase.from('profiles').update({
      public_profile: publicProfile,
      allow_messages: messages,
      preferences,
    }).eq('id', profile.id);
    setSaving(false);
    if (error) { setNotice('Preferences could not be saved. Please try again.'); return; }
    onProfileUpdate?.({ ...profile, public_profile: publicProfile, allow_messages: messages, preferences });
    setShowEditor(false);
  };

  return (
    <section className="w-full mt-4 rounded-2xl border border-white/10 bg-surface/90 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-pine/25 bg-pine/10">
            <Bookmark className="h-5 w-5 text-pine" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Your collection</h2>
            <p className="text-xs text-sage">{saved.length} saved {saved.length === 1 ? 'item' : 'items'}</p>
          </div>
        </div>
        <button type="button" onClick={() => { setShowEditor(value => !value); setNotice(''); }}
          aria-expanded={showEditor}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 px-3 text-xs font-semibold text-sage transition-colors hover:border-pine/50 hover:text-white">
          <Settings2 className="h-4 w-4" aria-hidden="true" />
          {showEditor ? 'Close settings' : 'Edit preferences'}
        </button>
      </div>

      {showEditor && (
        <div className="mt-5 space-y-4 border-t border-white/10 pt-5">
          <div>
            <h3 className="text-sm font-bold text-white">Campus preferences</h3>
            <p className="mt-1 text-xs text-sage">Choose what matters to you. Your choices help prioritize discovery.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {['Academic','Textbooks','Housing','Tech','Beauty','General'].map(t => (
              <button key={t} type="button" aria-pressed={topics.includes(t)}
                className={topics.includes(t) ? 'rounded-full border border-pine bg-pine/15 px-3.5 py-2 text-xs font-semibold text-pine' : 'rounded-full border border-white/15 px-3.5 py-2 text-xs font-semibold text-sage hover:border-white/40'}
                onClick={() => setTopics(current => current.includes(t) ? current.filter(x => x !== t) : [...current, t])}>{t}</button>
            ))}
          </div>
          <div className="space-y-3 rounded-xl bg-midnight/70 p-3">
            <label className="flex items-start gap-3 text-xs leading-relaxed text-sage"><input type="checkbox" className="mt-0.5 accent-[#e4cd75]" checked={institutionFirst} onChange={e => setInstitutionFirst(e.target.checked)} />Prioritize my institution in discovery</label>
            <label className="flex items-start gap-3 text-xs leading-relaxed text-sage"><input type="checkbox" className="mt-0.5 accent-[#e4cd75]" checked={publicProfile} onChange={e => setPublicProfile(e.target.checked)} />Allow guests to see my username, institution, avatar and verification badge</label>
            <label className="flex items-start gap-3 text-xs leading-relaxed text-sage"><input type="checkbox" className="mt-0.5 accent-[#e4cd75]" checked={messages} onChange={e => setMessages(e.target.checked)} />Allow messages from verified students (except blocked accounts)</label>
          </div>
          <button type="button" className="foundation-primary inline-flex min-h-11 items-center gap-2" onClick={save} disabled={saving}>
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />{saving ? 'Saving…' : 'Save preferences'}
          </button>
        </div>
      )}
      {notice && <p role="status" className="mt-3 text-xs text-sage">{notice}</p>}
      {saved.length > 0 ? (
        <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
          {saved.map(item => (
            <div key={item.content_type + item.content_id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-midnight/50 px-3 py-2">
              <a className="min-w-0 flex-1 break-words text-xs leading-relaxed text-white hover:text-pine" href={item.available ? destinationHash(item.content_type === 'listing' ? { module: 'hustle', listing: item.content_id } : { module: 'community', post: item.content_id }) : undefined}>{item.title.slice(0,100)}</a>
              <button type="button" className="min-h-9 shrink-0 text-xs text-sage underline hover:text-white" onClick={async () => {
                const { error } = await supabase.from('saved_items').delete().eq('content_id', item.content_id).eq('content_type', item.content_type);
                if (error) { setNotice('Could not remove saved item.'); return; }
                setSaved(current => current.filter(s => !(s.content_id === item.content_id && s.content_type === item.content_type)));
              }}>Remove</button>
            </div>
          ))}
        </div>
      ) : !showEditor ? <p className="mt-3 text-xs text-sage">Saved discussions and listings will appear here.</p> : null}
    </section>
  );
}
