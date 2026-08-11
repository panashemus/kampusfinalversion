'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, ArrowBigUp, Plus, X, Loader as Loader2, MessageCircleQuestion, MoveVertical as MoreVertical, Flag, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/utils';
import { uploadImages } from '@/lib/payment';
import type { CommunityCategory, CommunityPost, Comment, Profile } from '@/lib/types';
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
};

type FeedCommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  author_name: string | null;
  text: string;
  created_at: string;
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
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CommunityCategory>('All Questions');
  const [showAskModal, setShowAskModal] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newCategory, setNewCategory] = useState<Exclude<CommunityCategory, 'All Questions'>>('General');
  const [newImages, setNewImages] = useState<string[]>([]);
  
  const [profileUser, setProfileUser] = useState<{ id: string; username: string } | null>(null);
  
  const [posting, setPosting] = useState(false);
  const [reportPost, setReportPost] = useState<CommunityPost | null>(null);
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

    const mapped: CommunityPost[] = postRows.map((p) => ({
      id: p.id,
      authorId: p.user_id,
      author: p.author_name ?? p.user_id,
      time: timeAgo(p.created_at),
      category: p.category as Exclude<CommunityCategory, 'All Questions'>,
      text: p.text,
      upvotes: p.upvotes,
      comments: commentRows
        .filter((c) => c.post_id === p.id)
        .map((c) => ({
          id: c.id,
          authorId: c.user_id,
          author: c.author_name ?? c.user_id,
          text: c.text,
          time: timeAgo(c.created_at),
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
    const post = posts.find((p) => p.id === id);
    if (!post) return;
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, upvotes: p.upvotes + 1 } : p))
    );
    await supabase
      .from('feed_posts')
      .update({ upvotes: post.upvotes + 1 })
      .eq('id', id);
  };

  const addComment = async (postId: string, comment: Comment) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comments: [...p.comments, comment] } : p
      )
    );
    if (!profile) return;
    await supabase.from('feed_comments').insert({
      post_id: postId,
      user_id: profile.id,
      author_name: myName,
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
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comments: p.comments.filter(c => c.id !== commentId) } : p
      )
    );
    await supabase.from('feed_comments').delete().eq('id', commentId);
    toast({ title: 'Comment deleted' });
  };

  const submitQuestion = async () => {
    const text = newQuestion.trim();
    if (!text || !profile) return;
    setPosting(true);
    const { data } = await supabase
      .from('feed_posts')
      .insert({
        user_id: profile.id,
        author_name: myName,
        category: newCategory,
        text,
        upvotes: 0,
        images: newImages.length > 0 ? newImages : null,
      })
      .select()
      .maybeSingle();
    
    if (data) {
      const post: CommunityPost = {
        id: (data as FeedPostRow).id,
        authorId: profile.id,
        author: myName,
        time: 'just now',
        category: newCategory,
        text,
        upvotes: 0,
        comments: [],
        images: newImages,
      };
      setPosts((prev) => [post, ...prev]);
    }
    setNewQuestion('');
    setNewImages([]);
    setPosting(false);
    setShowAskModal(false);
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
                filter === f
                  ? 'bg-pine text-black'
                  : 'bg-transparent border border-sage text-sage'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 flex flex-col gap-4">
        
        {/* MOVED ASK QUESTION BUTTON TO TOP */}
        <button
          onClick={() => setShowAskModal(true)}
          className="w-full mb-1 h-12 rounded-xl bg-pine text-black flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shrink-0"
        >
          <Plus className="w-5 h-5" strokeWidth={2.5} />
          <span className="font-bold text-sm">Ask Question</span>
        </button>

        <AdSlot />

        {loading ? (
          <span className="text-sage text-sm text-center mt-8">Loading feed...</span>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 pt-16">
            <div className="w-16 h-16 rounded-full bg-surface border border-gray-800 flex items-center justify-center">
              <MessageCircleQuestion className="w-7 h-7 text-sage" strokeWidth={1.5} />
            </div>
            <span className="text-white text-sm font-bold text-center">
              No posts yet
            </span>
            <span className="text-sage text-xs text-center max-w-[240px]">
              Be the first to ask a question or share something with your campus.
            </span>
          </div>
        ) : (
          visible.map((post) => (
            <div key={post.id} className="bg-surface rounded-2xl p-4 flex flex-col gap-3 relative">
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
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} /> Delete Post
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-ink border border-gray-800 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4 text-sage" strokeWidth={1.5} />
                </div>
                <div className="flex flex-col">
                  <button
                    onClick={() => setProfileUser({ id: post.authorId, username: post.author })}
                    className="text-white text-xs font-bold hover:text-pine transition-colors text-left pr-6"
                  >
                    {post.author}
                  </button>
                  <span className="text-sage text-[10px]">{post.time} - {post.category}</span>
                </div>
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

              <div className="flex items-center gap-4">
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
                  onAuthorClick={(username, authorId) => setProfileUser({ id: authorId || '', username })}
                  onDelete={(commentId) => deleteComment(post.id, commentId)}
                  currentUserId={profile?.id}
                  placeholder="Reply to this post..."
                />
              </div>
            </div>
          ))
        )}
      </div>

      {showAskModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowAskModal(false)}
          />
          <div className="relative w-full sm:max-w-lg bg-surface rounded-t-3xl sm:rounded-3xl p-6 flex flex-col gap-4 animate-slide-up max-h-[85dvh] sm:max-h-[90vh] overflow-y-auto no-scrollbar pb-[max(80px,calc(80px+env(safe-area-inset-bottom)))]">
            
            <div className="flex items-center justify-between shrink-0">
              <span className="text-white font-black text-lg">Ask a Campus Question</span>
              <button 
                onClick={() => setShowAskModal(false)} 
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
              <label className="text-sage text-xs font-bold uppercase tracking-wider">Your Question</label>
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
                placeholder="e.g. Where is the safest parking after 8pm on campus?"
                rows={3}
                required
                minLength={5}
                className="bg-ink rounded-xl w-full p-4 border border-gray-800 text-white placeholder:text-sage outline-none focus:border-pine transition-colors resize-none text-sm"
              />
              {newQuestion.length > 0 && newQuestion.length < 5 && (
                <span className="text-red-400 text-[10px] font-bold">Question must be at least 5 characters</span>
              )}
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
                className="w-full h-12 rounded-xl bg-pine text-black font-bold text-base active:scale-95 transition-transform disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg"
              >
                {posting && <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />}
                {posting ? 'Posting...' : 'Post to Feed'}
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
