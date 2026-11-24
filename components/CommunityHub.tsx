'use client';
import SecureImage from './SecureImage';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MessageSquare, ArrowBigUp, Plus, X, Loader as Loader2, MessageCircleQuestion, MoveVertical as MoreVertical, Flag, Trash2, Megaphone, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/utils';
import { uploadImages } from '@/lib/media-upload';
import type { CommunityCategory, Comment, Profile } from '@/lib/types';
import CommentThread from '@/components/CommentThread';
import AdSlot from '@/components/AdSlot';
import PublicProfileModal from '@/components/PublicProfileModal';
import ImageUploader from '@/components/ImageUploader';
import Lightbox from '@/components/Lightbox';
import ReportModal from '@/components/ReportModal';
import ContextActions from './ContextActions';
import type { Destination, Visibility } from '@/lib/interconnect';
import { useToast } from '@/hooks/use-toast';
import CirklesLogo from './CirklesLogo';
import CirklesModerationNotice from './CirklesModerationNotice';
import CirklesStoryCard from './CirklesStoryCard';
import {CIRKLES,CIRKLE_PROMPTS,cirkleLabel,type CirkleSlug} from '@/lib/cirkles';
import {moderateText,type ModerationResult} from '@/lib/moderation';
import {publishCirkles,CirklesSubmissionError} from '@/lib/cirkles-client';

const FILTERS: CommunityCategory[] = ['All Questions', 'Academic', 'Housing', 'Tech', 'General', 'Textbooks', 'Beauty'];

type FeedPostRow = {
  circle_slug?: CirkleSlug | null; story_prompt?: string | null; moderation_status?: string; cirkles_hot_score?: number;
  visibility: Visibility; public_approved: boolean; institution: string | null; is_owner: boolean;
  id: string;
  user_id: string;
  author_name: string | null;
  avatar_url?: string | null;
  category: string;
  text: string;
  upvotes: number;
  created_at: string;
  images: string[] | null;
  is_anonymous?: boolean;
  is_blasted?: boolean;
  impact_score?: number;
};

type FeedCommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  author_name: string | null;
  avatar_url?: string | null;
  is_owner?: boolean;
  text: string;
  created_at: string;
  is_anonymous?: boolean;
};

type EnhancedCommunityPost = {
  circleSlug: CirkleSlug | null; storyPrompt: string | null; hotScore: number; createdAt: string; moderationStatus?: string;
  visibility: Visibility; approved: boolean; institution: string | null; isOwner: boolean;
  id: string;
  authorId: string;
  author: string;
  avatarUrl?: string | null;
  time: string;
  category: Exclude<CommunityCategory, 'All Questions'>;
  text: string;
  upvotes: number;
  comments: Comment[];
  images: string[];
  is_anonymous?: boolean;
  is_blasted?: boolean;
  impact_score?: number;
};

export default function CommunityHub({ 
  profile, 
  searchQuery,
  onMessageUser, selectedPostId, onNavigate
}: { 
  profile: Profile | null;
  selectedPostId?: string;
  onNavigate: (destination: Destination) => void;
  searchQuery: string;
  onMessageUser: (peerId: string, peerUsername: string) => void;
}) {
  const { toast } = useToast();
  const [posts, setPosts] = useState<EnhancedCommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError,setLoadError]=useState('');
  // Never unmount the visible feed during realtime updates, polling or voting.
  // Doing so destroys active comment inputs and causes the blank-page flash.
  const hasLoadedFeedRef = useRef(false);
  const latestFeedRequestRef = useRef(0);
  const [page,setPage]=useState(0);
  const [publicPost,setPublicPost]=useState(false);
  const [filter, setFilter] = useState<CommunityCategory>('All Questions');
  const [cirkle,setCirkle]=useState<'all'|'qa'|CirkleSlug>('all');
  const [sort,setSort]=useState<'latest'|'trending'>('latest');
  const [heroOpen,setHeroOpen]=useState(true);
  const [composeCircle,setComposeCircle]=useState<CirkleSlug|null>(null);
  const [storyPrompt,setStoryPrompt]=useState<string|null>(null);
  const [submissionError,setSubmissionError]=useState('');
  const [serverModeration,setServerModeration]=useState<ModerationResult|null>(null);
  
  const [askModalType, setAskModalType] = useState<'standard' | 'anonymous' | null>(null);
  
  const [newQuestion, setNewQuestion] = useState('');
  const localModeration=useMemo(()=>moderateText(newQuestion),[newQuestion]);
  const composerDialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(askModalType&&!composerDialog.current?.open)composerDialog.current?.showModal();},[askModalType]);
  const [newCategory, setNewCategory] = useState<Exclude<CommunityCategory, 'All Questions'>>('General');
  const [newImages, setNewImages] = useState<string[]>([]);
  
  const [profileUser, setProfileUser] = useState<{ id: string; username: string } | null>(null);
  const [posting, setPosting] = useState(false);
  const [reportPost, setReportPost] = useState<EnhancedCommunityPost | null>(null);
  const [lightboxImages, setLightboxImages] = useState<string[] | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const myName = profile ? (profile.username ? `@${profile.username}` : profile.email.split('@')[0]) : 'student';

  const loadPosts = useCallback(async () => {
    const requestId = ++latestFeedRequestRef.current;
    // A skeleton belongs only to the FIRST load. Afterward, keep posts and
    // draft inputs mounted while refreshed data arrives in the background.
    if (!hasLoadedFeedRef.current) { setLoading(true);setLoadError(''); }
    let query=supabase.from('feed_preview').select('*');
    query=sort==='trending'?query.order('cirkles_hot_score',{ascending:false}):query.order('created_at',{ascending:false});
    query=query.order('id',{ascending:false});
    if(!selectedPostId){
      if(cirkle==='qa')query=query.is('circle_slug',null);
      else if(cirkle!=='all')query=query.eq('circle_slug',cirkle);
      if((cirkle==='all'||cirkle==='qa')&&filter!=='All Questions')query=query.eq('category',filter);
    }
    if(selectedPostId)query=query.eq('id',selectedPostId);
    if(!selectedPostId&&searchQuery.trim())query=query.ilike('text','%'+searchQuery.trim().replace(/[\%_]/g,'')+'%');
    const {data,error}=await query.range(selectedPostId?0:page*40,selectedPostId?0:page*40+39);
    if(requestId !== latestFeedRequestRef.current) return;
    if(error||!data){
      if(!hasLoadedFeedRef.current){setLoadError('The feed could not be loaded. Please try again.');setLoading(false);}
      // A temporary background error must not erase the existing feed or draft.
      return;
    }
    const postRows = data as FeedPostRow[];

    const { data: commentData } = await supabase
      .from('comment_preview')
      .select('*')
      .in('post_id',postRows.map(p=>p.id))
      .limit(1000)
      .order('created_at', { ascending: true });
    const commentRows = (commentData as FeedCommentRow[]) ?? [];

    const mapped: EnhancedCommunityPost[] = postRows.map((p) => {
      const isPostAnon = p.is_anonymous || false;
      return {
        id: p.id,
        circleSlug:p.circle_slug||null,storyPrompt:p.story_prompt||null,hotScore:p.cirkles_hot_score||0,createdAt:p.created_at,
        visibility:p.visibility,approved:p.public_approved,institution:p.institution,isOwner:p.is_owner,moderationStatus:p.moderation_status,
        authorId: p.user_id ?? '',
        author: p.author_name ?? 'Student',
        avatarUrl: isPostAnon ? null : (p.avatar_url ?? null),
        time: timeAgo(p.created_at),
        category: p.category as Exclude<CommunityCategory, 'All Questions'>,
        text: p.text,
        upvotes: p.upvotes,
        is_anonymous: isPostAnon,
        is_blasted: p.is_blasted || false,
        impact_score: p.impact_score || 0,
        comments: commentRows
          .filter((c) => c.post_id === p.id)
          .map((c) => {
            const hidden = isPostAnon || Boolean(c.is_anonymous);
            return {
              id: c.id,
              authorId: hidden ? undefined : c.user_id,
              author: hidden ? 'Anonymous' : (c.author_name ?? 'Student'),
              avatarUrl: hidden ? null : (c.avatar_url ?? null),
              isOwner: Boolean(c.is_owner),
              text: c.text,
              time: timeAgo(c.created_at),
              is_anonymous: hidden,
            };
          }),
        images: p.images ?? [],
      };
    });
    // Ignore slower obsolete responses, e.g. overlapping realtime and polling refreshes.
    if(requestId !== latestFeedRequestRef.current) return;
    hasLoadedFeedRef.current=true;
    setPosts(mapped);
    setLoadError('');
    setLoading(false);
  }, [selectedPostId,searchQuery,page,cirkle,filter,sort]);

  useEffect(() => {
    loadPosts();
    const channel = supabase
      .channel('public:feed_posts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_posts' }, () => loadPosts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_comments' }, () => loadPosts())
      .subscribe();
    const timer=setInterval(()=>{if(!document.hidden)void loadPosts();},45000);
    return () => { clearInterval(timer);supabase.removeChannel(channel); };
  }, [loadPosts]);

  const q = searchQuery.trim().toLowerCase();
  // The query already returns newest first. Keep that chronology intact instead
  // of silently promoting an older same-institution post above newer discussions.
  const visible = posts.filter((p) => {
    if(selectedPostId)return p.id===selectedPostId;
    const matchesCategory = filter === 'All Questions' || p.category === filter;
    const matchesSearch = !q || p.text.toLowerCase().includes(q) || p.author.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const upvote = async (id: string) => {
    if (!profile?.id) {
      toast({ title: 'Sign in required', description: 'You must be signed in to upvote posts.' });
      return;
    }
    const post = posts.find((p) => p.id === id);
    if (!post) return;

    const { data: existingVote } = await supabase
      .from('feed_post_votes')
      .select('id')
      .eq('post_id', id)
      .eq('user_id', profile.id)
      .maybeSingle();

    if (existingVote) {
      const newCount = Math.max(0, post.upvotes - 1);
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, upvotes: newCount } : p)));
      const {error}=await supabase.from('feed_post_votes').delete().eq('id', existingVote.id);
      if(error){setPosts(prev=>prev.map(p=>p.id===id?{...p,upvotes:post.upvotes}:p));toast({title:'Vote not saved',description:'Check your connection and try again.'});}
    } else {
      const newCount = post.upvotes + 1;
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, upvotes: newCount } : p)));
      const {error}=await supabase.from('feed_post_votes').insert({ post_id: id, user_id: profile.id });
      if(error){setPosts(prev=>prev.map(p=>p.id===id?{...p,upvotes:post.upvotes}:p));toast({title:'Vote not saved',description:'Check your connection and try again.'});}
    }
  };

  const addComment = async (postId: string, comment: Comment): Promise<boolean> => {
    if (!profile) return false;
    
    const targetPost = posts.find((p) => p.id === postId);
    const isPostAnon = targetPost?.is_anonymous ?? false;

    try {
      await publishCirkles('comments',{
        post_id: postId,
        user_id: profile.id,
        author_name: isPostAnon ? 'Anonymous' : myName,
        is_anonymous: isPostAnon,
        text: comment.text,
      });
      // Inserting the comment is the success condition. A later feed refresh
      // failure must not mislead the student into posting the same reply twice.
      void loadPosts().catch(() => undefined);
      return true;
    } catch(error) {
      toast({title:"Reply not saved",description:error instanceof Error?error.message:"Please try again. Your draft is still here.",variant:"destructive"});
      if(error instanceof CirklesSubmissionError)throw error;
      return false;
    }
  };

  const deletePost = async (postId: string) => {
    setMenuOpenId(null);
    const {data,error}=await supabase.from('feed_posts').delete().eq('id',postId).select('id');
    if(error||!data?.length){toast({title:'Post not deleted',description:'Check your connection and permission, then try again.'});return;}
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    toast({ title: 'Post deleted' });
  };

  const deleteComment = async (postId: string, commentId: string) => {
    const {data,error}=await supabase.from('feed_comments').delete().eq('id',commentId).select('id');
    if(error||!data?.length){toast({title:'Reply not deleted',description:'Check your connection and permission, then try again.'});return;}
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comments: p.comments.filter(c => c.id !== commentId) } : p));
    toast({ title: 'Comment deleted' });
  };

  const submitQuestion = async () => {
    const text = newQuestion.trim();
    if (!text || !profile || !askModalType || posting) return;
    setSubmissionError('');setServerModeration(null);
    if(!localModeration.allowed){setServerModeration(localModeration);return;}
    setPosting(true);
    const isAnonymous = askModalType === 'anonymous';
    try {
      await publishCirkles('posts',{
        text,category:newCategory,post_kind: isAnonymous ? 'confession' : 'question',
        visibility:publicPost?'public':'campus',images:newImages,
        circle_slug:composeCircle,story_prompt:storyPrompt,
      });
      // Clear only a confirmed save; refresh errors must never suggest reposting.
      setNewQuestion(current=>current.trim()===text?'':current);setNewImages(current=>current===newImages?[]:current);setStoryPrompt(null);setAskModalType(null);
      void loadPosts().catch(() => undefined);
      toast({title:'Posted to Cirkles',description:isAnonymous?'Your confession and its replies will be anonymous.':'Your question and its replies will display student names.'});
    } catch(error) {
      setSubmissionError(error instanceof Error?error.message:'Could not save. Your draft is still here.');
      if(error instanceof CirklesSubmissionError&&error.matches.length)setServerModeration({allowed:false,matches:error.matches,suggestion:error.message});
    } finally {setPosting(false);}
  };
  const openDrop=()=>{setComposeCircle(cirkle==='all'||cirkle==='qa'?'tezember':cirkle);setSubmissionError('');setServerModeration(null);setAskModalType('anonymous');};
  const openQuestion=()=>{setComposeCircle(null);setStoryPrompt(null);setSubmissionError('');setServerModeration(null);setAskModalType('standard');};

  return (
    <div className="flex-1 bg-midnight flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 pb-[max(96px,calc(80px+env(safe-area-inset-bottom)))] pt-4 flex flex-col gap-4">
        <section className="rounded-2xl border border-pine/30 bg-surface p-4 shrink-0">
          <div className="flex items-center gap-3"><CirklesLogo size={38}/><h1 className="font-black tracking-[.12em] text-white">CIRKLES</h1><span className="ml-auto rounded-full border border-pine/40 px-2.5 py-1 text-[10px] font-bold text-pine">TEZEmber</span><button type="button" aria-expanded={heroOpen} aria-label={heroOpen?'Collapse Cirkles introduction':'Expand Cirkles introduction'} onClick={()=>setHeroOpen(v=>!v)} className="min-h-11 px-2 text-sage text-xs">{heroOpen?'Less':'More'}</button></div>
          {heroOpen&&<p className="mt-3 text-sm leading-relaxed text-sage">TEZEmber — Drop your holiday stories, spill the vibe (strictly no names), and connect before the new semester begins.</p>}
          <div className="flex gap-2 mt-4"><button type="button" onClick={openDrop} className="min-h-11 flex-1 rounded-xl bg-pine px-3 py-3 font-bold text-xs text-midnight">Drop in a Cirkle</button><button type="button" onClick={openQuestion} className="min-h-11 rounded-xl border border-gray-800 bg-ink px-4 py-3 font-bold text-xs text-sage">Ask Campus</button></div>
        </section>
        <nav aria-label="Cirkles" className="flex gap-3 overflow-x-auto py-1 shrink-0">
          {[{slug:'all',label:'All Cirkles & Feed',short:'All'},...CIRKLES,{slug:'qa',label:'Campus Q&A',short:'Q&A'}].map(c=><button key={c.slug} type="button" aria-pressed={cirkle===c.slug} aria-label={c.label} onClick={()=>{setCirkle(c.slug as typeof cirkle);setFilter('All Questions');setPage(0);}} className="min-w-[76px] max-w-[92px] flex flex-col items-center gap-2 text-center text-[10px] leading-snug"><span className={['grid place-items-center h-14 w-14 rounded-full border-2 bg-surface ',cirkle===c.slug?'border-pine text-pine':'border-gray-800 text-sage'].join(' ')}><CirklesLogo variant="nav" size={28}/></span><span className={cirkle===c.slug?'text-pine font-bold':'text-sage'}>{c.label}</span></button>)}
        </nav>
        {(cirkle==='all'||cirkle==='qa')&&<nav aria-label="Campus categories" className="flex gap-2 overflow-x-auto shrink-0">{FILTERS.map(f=><button key={f} type="button" aria-pressed={filter===f} onClick={()=>{setFilter(f);setPage(0);}} className={['min-h-11 whitespace-nowrap rounded-full px-4 text-xs font-semibold border ',filter===f?'bg-pine text-midnight border-pine':'border-gray-800 text-sage'].join(' ')}>{f==='All Questions'?'All categories':f}</button>)}</nav>}
        <div className="flex items-center justify-between gap-3 text-xs text-sage shrink-0"><span>{selectedPostId?'Discussion':cirkle==='all'?'Every Cirkle. Every campus question.':cirkle==='qa'?'Classic Campus Q&A':cirkleLabel(cirkle)}</span><label className="sr-only" htmlFor="cirkles-sort">Sort feed</label><select id="cirkles-sort" value={sort} onChange={e=>{setSort(e.target.value as typeof sort);setPage(0);}} className="rounded-xl border border-gray-800 bg-surface p-3 text-sage"><option value="latest">Latest</option><option value="trending">Trending</option></select></div>

        <AdSlot />

        {loadError ? <div role="alert" className="foundation-card text-sage">{loadError}<button className="foundation-action mt-3" onClick={()=>loadPosts()}>Try again</button></div> : loading ? (
          <div role="status" aria-label="Loading Cirkles" className="space-y-4"><span className="sr-only">Loading Cirkles…</span>{[0,1,2].map(i=><div key={i} className="h-48 rounded-2xl border border-gray-800 bg-surface animate-pulse motion-reduce:animate-none"/>)}</div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 pt-16">
            <div className="w-16 h-16 rounded-full bg-surface border border-gray-800 flex items-center justify-center">
              <MessageCircleQuestion className="w-7 h-7 text-sage" strokeWidth={1.5} />
            </div>
            <span className="text-white text-sm font-bold text-center">No posts yet</span>
            <span className="text-sage text-xs text-center max-w-[240px]">Be the first to ask a question or drop a confession.</span>
          </div>
        ) : (
          visible.map((post) => (
            <div id={'post-'+post.id} key={post.id} className={`bg-surface rounded-2xl p-4 flex flex-col gap-3 relative border ${post.circleSlug||post.is_blasted ? 'border-pine/30' : 'border-gray-800'}`}>
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                <CirklesStoryCard post={{id:post.id,text:post.text,circle:post.circleSlug||'',category:post.category,visibility:post.visibility,approved:post.approved,isOwner:post.isOwner,anonymous:post.is_anonymous,moderationStatus:post.moderationStatus}}/>
                <button
                  aria-label="Post actions"
                  onClick={() => setMenuOpenId(menuOpenId === post.id ? null : post.id)}
                  className="w-7 h-7 rounded-full bg-midnight/50 flex items-center justify-center active:scale-95"
                >
                  <MoreVertical className="w-3.5 h-3.5 text-sage" strokeWidth={2} />
                </button>
                {menuOpenId === post.id && (
                  <div className="absolute right-0 top-8 w-36 bg-surface rounded-lg border border-gray-800 shadow-xl flex flex-col overflow-hidden">
                    <button
                      onClick={() => { setReportPost(post); setMenuOpenId(null); }}
                      className="flex items-center gap-2 px-3 py-2.5 text-left text-sage text-xs font-bold hover:bg-white/5"
                    >
                      <Flag className="w-3.5 h-3.5" strokeWidth={1.5} /> Report Post
                    </button>
                    {(post.isOwner || profile?.is_admin) && (
                      <button
                        onClick={() => deletePost(post.id)}
                        className="flex items-center gap-2 px-3 py-2.5 text-left text-pine text-xs font-bold hover:bg-white/5 border-t border-gray-800"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} /> Delete
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pr-20 min-h-9">
                <div className="flex items-center gap-2">
                  {post.is_anonymous ? (
                    <div className="w-9 h-9 rounded-full bg-ink border border-gray-800 flex items-center justify-center text-lg shrink-0 shadow-inner">
                      <UserRound className="h-4 w-4 text-sage" aria-hidden="true" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-ink border border-gray-800 flex items-center justify-center shrink-0">
                      {post.avatarUrl ? <SecureImage src={post.avatarUrl} alt={post.author+"'s profile photo"} className="h-full w-full rounded-full object-cover" /> : <UserRound className="w-4 h-4 text-sage" strokeWidth={1.5} />}
                    </div>
                  )}
                  
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      {post.is_anonymous ? (
                        <span className="text-sage text-xs font-bold transition-colors text-left">
                          Anonymous Kamper
                        </span>
                      ) : (
                        <button
                          onClick={() => setProfileUser({ id: post.authorId, username: post.author })}
                          className="text-white text-xs font-bold hover:text-pine transition-colors text-left"
                        >
                          {post.author}
                        </button>
                      )}
                      {post.is_blasted && (
                        <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-pine text-black animate-pulse ">
                          Blast
                        </span>
                      )}
                    </div>
                    <span className="text-sage text-[10px]">{post.time} - {post.category}</span>
                  </div>
                </div>

              </div>

              {post.circleSlug&&<span className="inline-flex self-start items-center gap-2 rounded-full border border-pine/30 px-2.5 py-1 text-[10px] font-semibold text-pine"><CirklesLogo size={14} variant="badge"/>{cirkleLabel(post.circleSlug)}</span>}
              {post.storyPrompt&&<blockquote className="border-l-2 border-pine/40 pl-3 text-xs italic leading-relaxed text-sage">{post.storyPrompt}</blockquote>}
              <p className="text-white text-sm leading-relaxed whitespace-pre-wrap break-words">{post.text}</p>
              <ContextActions content={{id:post.id,type:post.category==="Academic"?"academic-question":"discussion",module:"community",visibility:post.visibility,approved:post.approved,available:true,category:post.category,text:post.text}} userId={profile?.id} onNavigate={onNavigate}/>

              {post.images.length > 0 && (
                <div className={`grid gap-2 mt-1 ${post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {post.images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setLightboxImages(post.images)}
                      className="w-full aspect-video rounded-xl overflow-hidden border border-gray-800"
                    >
                      <SecureImage src={img} alt={`post-img-${i}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4 mt-1">
                <button
                  onClick={() => upvote(post.id)}
                  aria-label="Upvote post"
                  className="flex items-center gap-1 active:scale-95 transition-transform"
                >
                  <ArrowBigUp className="w-4 h-4 text-pine" strokeWidth={1.5} />
                  <span className="text-sage text-xs font-bold">{post.upvotes}</span>
                </button>
                <div className="flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5 text-sage" strokeWidth={1.5} />
                  <span className="text-sage text-xs">{post.comments.length}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-800">
                <CommentThread
                  moderationEnabled
                  comments={post.comments}
                  onAdd={(c) => addComment(post.id, c)}
                  onDelete={(commentId) => deleteComment(post.id, commentId)}
                  currentUserId={profile?.id}
                  isAnonymousPost={post.is_anonymous}
                  myName={myName}
                  onAuthorClick={(username, authorId) => {
                    if (!post.is_anonymous && authorId) {
                      setProfileUser({ id: authorId, username });
                    }
                  }}
                  placeholder={post.is_anonymous ? "Reply anonymously..." : "Reply to this post..."}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {!selectedPostId && (page > 0 || posts.length === 40) && (
        <nav aria-label="Feed pages" className="flex items-center justify-center gap-3 px-4 py-3 text-xs text-sage">
          {page > 0 && <button className="min-h-9 rounded-full border border-gray-700 px-3 text-white hover:border-pine" onClick={() => setPage(v => Math.max(0, v - 1))}>← Newer</button>}
          <span className="text-sage/70">Page {page + 1}</span>
          {posts.length === 40 && <button className="min-h-9 rounded-full border border-gray-700 px-3 text-white hover:border-pine" onClick={() => setPage(v => v + 1)}>Older posts →</button>}
        </nav>
      )}
      {askModalType !== null && (
        <dialog ref={composerDialog} aria-label="Create a Cirkles post" onCancel={e=>{e.preventDefault();if(!posting)setAskModalType(null);}} className="fixed inset-0 z-[5000] m-0 h-full w-full max-w-none max-h-none border-0 bg-transparent text-white flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/80 "
            onClick={() => setAskModalType(null)}
          />
          <div className="relative w-full sm:max-w-lg bg-surface rounded-t-3xl sm:rounded-3xl p-6 flex flex-col gap-4 animate-slide-up max-h-[85dvh] sm:max-h-[90vh] overflow-y-auto no-scrollbar pb-[max(80px,calc(80px+env(safe-area-inset-bottom)))]">
            
            <div className="flex items-center justify-between shrink-0">
              <span className="text-white font-black text-lg">
                {composeCircle?'Drop in '+cirkleLabel(composeCircle):askModalType === 'anonymous' ? 'Drop a Confession' : 'Ask a Campus Question'}
              </span>
              <button 
                onClick={() => setAskModalType(null)} 
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-ink flex items-center justify-center text-sage hover:text-white transition-colors"
              >
                <X className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs text-sage">Post in<select aria-label="Post in" value={composeCircle||'qa'} onChange={e=>{const c=e.target.value as CirkleSlug|'qa';setComposeCircle(c==='qa'?null:c);if(c==='confessions')setAskModalType('anonymous');if(c==='qa')setStoryPrompt(null);}} className="mt-2 w-full rounded-xl border border-gray-800 bg-ink p-3 text-white"><option value="qa">Campus Q&A</option>{CIRKLES.map(c=><option value={c.slug} key={c.slug}>{c.label}</option>)}</select></label>
              <fieldset className="flex gap-2"><legend className="sr-only">Posting identity</legend><button type="button" aria-pressed={askModalType==='anonymous'} onClick={()=>setAskModalType('anonymous')} className={['min-h-11 rounded-xl border px-3 text-xs ',askModalType==='anonymous'?'border-pine text-pine':'border-gray-800 text-sage'].join(' ')}>Anonymous</button><button type="button" disabled={composeCircle==='confessions'} aria-pressed={askModalType==='standard'} onClick={()=>setAskModalType('standard')} className={['min-h-11 rounded-xl border px-3 text-xs disabled:opacity-40 ',askModalType==='standard'?'border-pine text-pine':'border-gray-800 text-sage'].join(' ')}>With my name</button></fieldset>
              {composeCircle&&<div className="flex gap-2 overflow-x-auto pb-1" aria-label="Story prompts">{CIRKLE_PROMPTS.map(prompt=><button type="button" key={prompt} aria-pressed={storyPrompt===prompt} onClick={()=>setStoryPrompt(storyPrompt===prompt?null:prompt)} className={['min-h-11 min-w-[190px] max-w-[220px] rounded-xl border p-3 text-left text-xs leading-relaxed ',storyPrompt===prompt?'border-pine text-pine':'border-gray-800 text-sage'].join(' ')}>{prompt}</button>)}</div>}
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <span className="text-sage text-xs font-bold uppercase tracking-wider">Category</span>
              <div className="flex flex-wrap gap-2">
                {FILTERS.filter((f) => f !== 'All Questions').map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setNewCategory(cat as Exclude<CommunityCategory, 'All Questions'>)}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                      newCategory === cat
                        ? 'bg-pine text-black'
                        : 'bg-transparent border border-gray-800 text-sage'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div role="status" className="rounded-xl border border-pine/20 bg-ink px-3 py-2 text-xs text-sage">
              {askModalType==='anonymous' ? 'Confess: your identity, profile photo and every reply are hidden from the feed. Avoid naming or identifying other people.' : 'Ask Question: your username and profile photo (if you have one) appear with your post. Replies show their authors, too.'}
            </div>
            <label className="text-sm text-sage flex items-start gap-3"><input type="checkbox" checked={publicPost} onChange={e=>setPublicPost(e.target.checked)}/>Share this post publicly after moderator review. Leave unchecked for campus-only visibility.</label>
            <div className="flex flex-col gap-1.5 shrink-0">
              <label className="text-sage text-xs font-bold uppercase tracking-wider">
                {askModalType === 'anonymous' ? 'Your Confession (Anonymous)' : 'Your Question'}
              </label>
              <textarea
                maxLength={4000}
                aria-label="Your post"
                value={newQuestion}
                onChange={(e) => {setNewQuestion(e.target.value);setServerModeration(null);setSubmissionError('');}}
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  const imageFiles: File[] = [];
                  for (let i = 0; i < items.length; i++) {
                    if (items[i].type.startsWith('image/')) {
                      const f = items[i].getAsFile();
                      if (f) imageFiles.push(f);
                    }
                  }
                  if (imageFiles.length > 0) {
                    e.preventDefault();
                    if (profile) {
                      uploadImages(imageFiles, profile.id).then((urls) => {
                        if (urls.length > 0) {
                          setNewImages((prev) => [...prev, ...urls]);
                          toast({ title: 'Image pasted', description: `${urls.length} image(s) attached.` });
                        }
                      });
                    }
                  }
                }}
                placeholder={askModalType === 'anonymous' ? "Spill the tea. No names allowed..." : "e.g. Where is the safest parking after 8pm on campus?"}
                rows={3}
                required
                minLength={5}
                className="bg-ink rounded-xl w-full p-4 border border-gray-800 text-white placeholder:text-sage outline-none focus:border-pine transition-colors resize-none text-sm"
              />
              {newQuestion.length > 0 && newQuestion.length < 5 && (
                <span className="text-pine text-[10px] font-bold">Must be at least 5 characters</span>
              )}
            </div>

            <CirklesModerationNotice text={newQuestion} result={serverModeration||localModeration} onChange={text=>{setNewQuestion(text);setServerModeration(null);setSubmissionError('');}}/>
            {submissionError&&<p role="alert" className="text-xs text-pine">{submissionError}</p>}
            {storyPrompt&&<blockquote className="border-l-2 border-pine/40 pl-3 text-xs text-sage">{storyPrompt}</blockquote>}
            <p className="text-xs text-sage">Names and identifying details are checked before posting. Photos are not automatically scanned: only attach images you have permission to share.</p>
            <p className="text-xs text-sage shrink-0">Students who opt in to browser alerts can receive a notification about new campus posts. Public posts are reviewed before sharing.</p>

            {profile && (
              <div className="shrink-0">
                <ImageUploader
                  userId={profile.id}
                  onUploaded={(urls) => setNewImages((prev) => [...prev, ...urls])}
                  onError={(msg) => toast({ title: 'Upload failed', description: msg, variant: 'destructive' })}
                />
              </div>
            )}

            <div className="pt-2 shrink-0">
              <button
                onClick={submitQuestion}
                disabled={newQuestion.trim().length < 5 || posting || !localModeration.allowed}
                className="w-full h-12 rounded-xl font-bold text-base active:scale-95 transition-transform disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg bg-pine text-black"
              >
                {posting && <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />}
                {posting ? 'Checking & posting...' : 'Post to Cirkles'}
              </button>
            </div>
            
          </div>
        </dialog>
      )}

      {reportPost && profile && (
        <ReportModal
          open={!!reportPost}
          onClose={() => setReportPost(null)}
          contentType="post"
          contentId={reportPost.id}
          reporterId={profile.id}
        />
      )}

      {lightboxImages && (
        <Lightbox images={lightboxImages} onClose={() => setLightboxImages(null)} />
      )}

      {profileUser && (
        <PublicProfileModal
          userId={profileUser.id}
          username={profileUser.username}
          onClose={() => setProfileUser(null)}
          onMessageUser={() => {
            onMessageUser(profileUser.id, profileUser.username);
            setProfileUser(null);
          }}
        />
      )}
    </div>
  );
}
