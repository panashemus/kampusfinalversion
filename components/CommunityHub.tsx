'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, ArrowBigUp, Plus, X, Loader as Loader2, MessageCircleQuestion, MoveVertical as MoreVertical, Flag, Trash2, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/utils';
import { uploadImages } from '@/lib/payment';
import type { CommunityCategory, Comment, Profile } from '@/lib/types';
import CommentThread from '@/components/CommentThread';
import AdSlot from '@/components/AdSlot';
import PublicProfileModal from '@/components/PublicProfileModal';
import ImageUploader from '@/components/ImageUploader';
import Lightbox from '@/components/Lightbox';
import ReportModal from '@/components/ReportModal';
import { useToast } from '@/hooks/use-toast';

const FILTERS: CommunityCategory[] = ['All Questions', 'Academic', 'Housing', 'Tech', 'General', 'Textbooks', 'Beauty'];

type FeedPostRow = {
  id: string;
  user_id: string;
  author_name: string | null;
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
  text: string;
  created_at: string;
  is_anonymous?: boolean;
};

type EnhancedCommunityPost = {
  id: string;
  authorId: string;
  author: string;
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
  onMessageUser 
}: { 
  profile: Profile | null; 
  searchQuery: string;
  onMessageUser: (peerId: string, peerUsername: string) => void;
}) {
  const { toast } = useToast();
  const [posts, setPosts] = useState<EnhancedCommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CommunityCategory>('All Questions');
  
  const [askModalType, setAskModalType] = useState<'standard' | 'anonymous' | null>(null);
  const [isBlast, setIsBlast] = useState(false);
  
  const [newQuestion, setNewQuestion] = useState('');
  const [newCategory, setNewCategory] = useState<Exclude<CommunityCategory, 'All Questions'>>('General');
  const [newImages, setNewImages] = useState<string[]>([]);
  
  const [profileUser, setProfileUser] = useState<{ id: string; username: string } | null>(null);
  const [posting, setPosting] = useState(false);
  const [reportPost, setReportPost] = useState<EnhancedCommunityPost | null>(null);
  const [lightboxImages, setLightboxImages] = useState<string[] | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const myName = profile ? (profile.username ? `@${profile.username}` : profile.email.split('@')[0]) : 'student';

  const loadPosts = useCallback(async () => {
    const { data } = await supabase
      .from('feed_posts')
      .select('*')
      .order('created_at', { ascending: false });
    if (!data) return;
    const postRows = data as FeedPostRow[];

    const { data: commentData } = await supabase
      .from('feed_comments')
      .select('*')
      .order('created_at', { ascending: true });
    const commentRows = (commentData as FeedCommentRow[]) ?? [];

    const mapped: EnhancedCommunityPost[] = postRows.map((p) => ({
      id: p.id,
      authorId: p.user_id,
      author: p.author_name ?? p.user_id,
      time: timeAgo(p.created_at),
      category: p.category as Exclude<CommunityCategory, 'All Questions'>,
      text: p.text,
      upvotes: p.upvotes,
      is_anonymous: p.is_anonymous || false,
      is_blasted: p.is_blasted || false,
      impact_score: p.impact_score || 0,
      comments: commentRows
        .filter((c) => c.post_id === p.id)
        .map((c) => ({
          id: c.id,
          authorId: c.user_id,
          author: 'Anonymous', // Forces retroactive anonymity on old comments
          text: c.text,
          time: timeAgo(c.created_at),
          is_anonymous: true,
        })),
      images: p.images ?? [],
    }));
    setPosts(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPosts();
    const channel = supabase
      .channel('public:feed_posts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_posts' }, () => loadPosts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_comments' }, () => loadPosts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadPosts]);

  const q = searchQuery.trim().toLowerCase();
  const visible = posts.filter((p) => {
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
      await supabase.from('feed_post_votes').delete().eq('id', existingVote.id);
      await supabase.from('feed_posts').update({ upvotes: newCount }).eq('id', id);
    } else {
      const newCount = post.upvotes + 1;
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, upvotes: newCount } : p)));
      await supabase.from('feed_post_votes').insert({ post_id: id, user_id: profile.id });
      await supabase.from('feed_posts').update({ upvotes: newCount }).eq('id', id);
    }
  };

  // Hardcoded to lock all database inserts as Anonymous
  const addComment = async (postId: string, comment: Comment) => {
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comments: [...p.comments, comment] } : p));
    if (!profile) return;
    
    await supabase.from('feed_comments').insert({
      post_id: postId,
      user_id: profile.id, // Kept so they can delete their own comments, but never shown publicly
      author_name: 'Anonymous',
      is_anonymous: true,
      text: comment.text,
    });
  };

  const deletePost = async (postId: string) => {
    setMenuOpenId(null);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    await supabase.from('feed_posts').delete().eq('id', postId);
    toast({ title: 'Post deleted' });
  };

  const deleteComment = async (postId: string, commentId: string) => {
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comments: p.comments.filter(c => c.id !== commentId) } : p));
    await supabase.from('feed_comments').delete().eq('id', commentId);
    toast({ title: 'Comment deleted' });
  };

  const submitQuestion = async () => {
    const text = newQuestion.trim();
    if (!text || !profile || !askModalType) return;
    setPosting(true);
    
    const isAnonymous = askModalType === 'anonymous';
    const startingImpact = isBlast ? 15 : 0;

    const { data, error } = await supabase
      .from('feed_posts')
      .insert({
        user_id: profile.id,
        author_name: myName,
        category: newCategory,
        text,
        upvotes: 0,
        images: newImages.length > 0 ? newImages : null,
        is_anonymous: isAnonymous,
        is_blasted: isBlast,
        impact_score: startingImpact
      })
      .select()
      .maybeSingle();
    
    if (data) {
      const post: EnhancedCommunityPost = {
        id: (data as FeedPostRow).id,
        authorId: profile.id,
        author: myName,
        time: 'just now',
        category: newCategory,
        text,
        upvotes: 0,
        comments: [],
        images: newImages,
        is_anonymous: isAnonymous,
        is_blasted: isBlast,
        impact_score: startingImpact
      };
      setPosts((prev) => [post, ...prev]);

      if (isBlast) {
         toast({ title: '⚡ Blast Sent', description: 'Your post was blasted to the campus.' });
      }
    } else {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to post.', variant: 'destructive' });
    }
    
    setNewQuestion('');
    setNewImages([]);
    setIsBlast(false);
    setPosting(false);
    setAskModalType(null);
  };

  return (
    <div className="flex-1 bg-midnight flex flex-col overflow-hidden">
      <div className="px-4 py-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                filter === f ? 'bg-pine text-black' : 'bg-transparent border border-sage text-sage'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 flex flex-col gap-4">
        
        <div className="flex gap-3 mb-1 shrink-0 w-full">
          <button
            onClick={() => setAskModalType('standard')}
            className="flex-1 h-12 rounded-xl bg-pine text-black flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg"
          >
            <Plus className="w-5 h-5" strokeWidth={2.5} />
            <span className="font-bold text-sm">Ask Question</span>
          </button>
          <button
            onClick={() => setAskModalType('anonymous')}
            className="flex-1 h-12 rounded-xl bg-[#161616] border border-zinc-700 text-white flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-[0_0_15px_rgba(255,255,255,0.03)]"
          >
            <span className="text-lg">🤫</span>
            <span className="font-bold text-sm">Confess</span>
          </button>
        </div>

        <AdSlot />

        {loading ? (
          <span className="text-sage text-sm text-center mt-8">Loading feed...</span>
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
            <div key={post.id} className={`bg-surface rounded-2xl p-4 flex flex-col gap-3 relative ${post.is_blasted ? 'border border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : ''}`}>
              <div className="absolute top-2 right-2 z-10">
                <button
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
                    {(profile?.id === post.authorId || profile?.is_admin) && (
                      <button
                        onClick={() => deletePost(post.id)}
                        className="flex items-center gap-2 px-3 py-2.5 text-left text-red-400 text-xs font-bold hover:bg-white/5 border-t border-gray-800"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} /> Delete
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pr-8">
                <div className="flex items-center gap-2">
                  {post.is_anonymous ? (
                    <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-lg shrink-0 shadow-inner">
                      🤫
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-ink border border-gray-800 flex items-center justify-center shrink-0">
                      <MessageSquare className="w-4 h-4 text-sage" strokeWidth={1.5} />
                    </div>
                  )}
                  
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      {post.is_anonymous ? (
                        <span className="text-zinc-200 text-xs font-bold transition-colors text-left">
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
                        <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-yellow-400 text-black animate-pulse shadow-[0_0_8px_rgba(250,204,21,0.4)]">
                          ⚡ Blast
                        </span>
                      )}
                    </div>
                    <span className="text-sage text-[10px]">{post.time} - {post.category}</span>
                  </div>
                </div>

                {post.is_anonymous && (
                  <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded text-[10px] text-yellow-400 font-mono font-bold">
                    ⚡ {post.impact_score}
                  </div>
                )}
              </div>

              <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{post.text}</p>

              {post.images.length > 0 && (
                <div className={`grid gap-2 mt-1 ${post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {post.images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setLightboxImages(post.images)}
                      className="w-full aspect-video rounded-xl overflow-hidden border border-gray-800"
                    >
                      <img src={img} alt={`post-img-${i}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4 mt-1">
                <button
                  onClick={() => upvote(post.id)}
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
                  comments={post.comments}
                  onAdd={(c) => addComment(post.id, c)}
                  onDelete={(commentId) => deleteComment(post.id, commentId)}
                  currentUserId={profile?.id}
                  placeholder="Reply anonymously..."
                />
              </div>
            </div>
          ))
        )}
      </div>

      {askModalType !== null && (
        <div className="fixed inset-0 z-[5000] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setAskModalType(null)}
          />
          <div className="relative w-full sm:max-w-lg bg-surface rounded-t-3xl sm:rounded-3xl p-6 flex flex-col gap-4 animate-slide-up max-h-[85dvh] sm:max-h-[90vh] overflow-y-auto no-scrollbar pb-[max(80px,calc(80px+env(safe-area-inset-bottom)))]">
            
            <div className="flex items-center justify-between shrink-0">
              <span className="text-white font-black text-lg">
                {askModalType === 'anonymous' ? '🤫 Drop a Confession' : 'Ask a Campus Question'}
              </span>
              <button 
                onClick={() => setAskModalType(null)} 
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-ink flex items-center justify-center text-sage hover:text-white transition-colors"
              >
                <X className="w-5 h-5" strokeWidth={1.5} />
              </button>
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

            <div className="flex flex-col gap-1.5 shrink-0">
              <label className="text-sage text-xs font-bold uppercase tracking-wider">
                {askModalType === 'anonymous' ? 'Your Confession (Anonymous)' : 'Your Question'}
              </label>
              <textarea
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
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
                <span className="text-red-400 text-[10px] font-bold">Must be at least 5 characters</span>
              )}
            </div>

            <div 
              onClick={() => setIsBlast(!isBlast)}
              className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                isBlast ? 'bg-yellow-500/10 border-yellow-500/50' : 'bg-ink border-gray-800 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isBlast ? 'bg-yellow-400 text-black' : 'bg-gray-800 text-sage'}`}>
                  <Zap className="w-4 h-4" strokeWidth={2} />
                </div>
                <div className="flex flex-col">
                  <span className={`text-sm font-bold ${isBlast ? 'text-yellow-400' : 'text-white'}`}>
                    Campus Blast (P15)
                  </span>
                  <span className="text-sage text-[10px]">Send push notification to all users</span>
                </div>
              </div>
              <div className={`w-10 h-6 rounded-full p-1 transition-colors ${isBlast ? 'bg-yellow-400' : 'bg-gray-800'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isBlast ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </div>

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
                disabled={newQuestion.trim().length < 5 || posting}
                className={`w-full h-12 rounded-xl font-bold text-base active:scale-95 transition-transform disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg ${
                  isBlast ? 'bg-yellow-400 text-black' : 'bg-pine text-black'
                }`}
              >
                {posting && <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />}
                {posting ? 'Posting...' : (isBlast ? 'Pay P15 & Blast' : 'Post to Feed')}
              </button>
            </div>
            
          </div>
        </div>
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
