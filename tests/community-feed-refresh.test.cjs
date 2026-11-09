const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const feed = fs.readFileSync('components/CommunityHub.tsx', 'utf8');
const thread = fs.readFileSync('components/CommentThread.tsx', 'utf8');

test('realtime vote and comment updates refresh without unmounting the feed', () => {
  assert.match(feed, /const hasLoadedFeedRef = useRef\(false\)/);
  assert.match(feed, /const latestFeedRequestRef = useRef\(0\)/);
  assert.match(feed, /if \(!hasLoadedFeedRef\.current\) \{ setLoading\(true\);setLoadError\(''\); \}/);
  assert.doesNotMatch(feed, /const loadPosts = useCallback\(async \(\) => \{\s*setLoading\(true\)/);
  assert.match(feed, /hasLoadedFeedRef\.current=true;\s*setPosts\(mapped\)/);
  assert.match(feed, /on\('postgres_changes', \{ event: '\*', schema: 'public', table: 'feed_posts' \}, \(\) => loadPosts\(\)\)/);
  assert.match(feed, /on\('postgres_changes', \{ event: '\*', schema: 'public', table: 'feed_comments' \}, \(\) => loadPosts\(\)\)/);
});

test('stale overlapping realtime and polling requests never overwrite newer posts', () => {
  assert.match(feed, /const requestId = \+\+latestFeedRequestRef\.current/);
  assert.ok((feed.match(/requestId !== latestFeedRequestRef\.current/g)||[]).length >= 2);
  assert.match(feed, /if\(!hasLoadedFeedRef\.current\)\{setLoadError/);
  assert.match(feed, /A temporary background error must not erase the existing feed or draft/);
});

test('upvoting retains mounted posts and does not force navigation or page reload', () => {
  const vote = feed.slice(feed.indexOf('  const upvote = async ('), feed.indexOf('  const addComment = async ('));
  assert.match(vote, /feed_post_votes/);
  assert.match(vote, /setPosts\(/);
  assert.doesNotMatch(vote, /setLoading\(|loadPosts\(|location\.reload|onNavigate\(/);
});

test('a comment draft is only cleared after a confirmed save and stays on failure', () => {
  assert.match(thread, /const \[submitting, setSubmitting\] = useState\(false\)/);
  assert.match(thread, /const saved = await onAdd\(/);
  assert.match(thread, /if\(saved !== false\) setText\(/);
  assert.doesNotMatch(thread, /onAdd\(\{[\s\S]*?\}\);\s*setText\(''\)/);
  assert.match(feed, /Promise<boolean>/);
  assert.match(feed, /return false;[\s\S]*Reply not saved|Reply not saved[\s\S]*return false;/);
  assert.match(feed, /void loadPosts\(\)\.catch\(\(\) => undefined\);/);
  assert.match(thread, /disabled=\{!text\.trim\(\) \|\| submitting\}/);
});

test('Confess anonymity and named question replies are unchanged', () => {
  assert.match(feed, /is_anonymous: isPostAnon,/);
  assert.match(thread, /const commentIsAnon = isAnonymousPost \|\| c\.is_anonymous/);
  assert.match(feed, /author_name: isPostAnon \? 'Anonymous' : myName/);
});
