const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const feed=fs.readFileSync('components/CommunityHub.tsx','utf8');
const comments=fs.readFileSync('components/CommentThread.tsx','utf8');
const member=fs.readFileSync('components/MemberApp.tsx','utf8');
const banner=fs.readFileSync('components/PushNotificationBanner.tsx','utf8');
const server=fs.readFileSync('app/api/push/dispatch/route.ts','utf8');
const worker=fs.readFileSync('public/sw.js','utf8');
const sql=fs.readFileSync('supabase/migrations/20261109145000_community_identity_and_opt_in_push.sql','utf8');

test('question and confession have distinct server-enforced privacy modes',()=>{
 assert.match(feed,/setAskModalType\('standard'\)/);
 assert.match(feed,/setAskModalType\('anonymous'\)/);
 assert.match(feed,/post_kind: isAnonymous \? 'confession' : 'question'/);
 assert.match(sql,/NEW\.is_anonymous := \(NEW\.post_kind='confession'\)/);
 assert.match(sql,/Post type cannot be changed after publishing/);
 assert.match(sql,/coalesce\(NEW\.post_kind,CASE WHEN coalesce\(NEW\.is_anonymous,false\) THEN 'confession' ELSE 'question' END\)/);
 assert.match(sql,/ALTER COLUMN post_kind DROP DEFAULT/);
 assert.match(sql,/CREATE TRIGGER feed_post_kind_privacy BEFORE INSERT OR UPDATE/);
});

test('every reply inherits the parent post anonymity; previews cannot reveal confession identities',()=>{
 assert.match(sql,/NEW\.is_anonymous := parent_is_anonymous/);
 assert.match(sql,/CREATE TRIGGER feed_comment_privacy BEFORE INSERT/);
 assert.match(sql,/CASE WHEN p\.is_anonymous THEN NULL::uuid ELSE p\.user_id END AS user_id/);
 assert.match(sql,/coalesce\(c\.is_anonymous,false\) OR coalesce\(p\.is_anonymous,false\)/);
 assert.match(comments,/const commentIsAnon = isAnonymousPost \|\| c\.is_anonymous/);
 assert.match(feed,/isOwner: Boolean\(c\.is_owner\)/);
});

test('named questions and replies include user identity and saved profile images',()=>{
 assert.match(sql,/AS avatar_url/);
 assert.match(feed,/avatarUrl: isPostAnon \? null : \(p\.avatar_url \?\? null\)/);
 assert.match(feed,/avatarUrl: hidden \? null : \(c\.avatar_url \?\? null\)/);
 assert.match(feed,/post\.avatarUrl \? <SecureImage/);
 assert.match(comments,/c\.avatarUrl \? <SecureImage/);
 assert.match(feed,/your username and profile photo/i);
 assert.doesNotMatch(feed,/Pay P15 & Blast|Campus Blast \(P15\)/);
});

test('server push is secret-authenticated, scoped and idempotent',()=>{
 assert.match(server,/timingSafeEqual/);
 assert.match(server,/KAMPUS_PUSH_DISPATCH_SECRET/);
 assert.match(server,/allowed|ALLOWED/);
 assert.match(server,/push_delivery_claims/);
 assert.match(server,/push_subscriptions/);
 assert.match(server,/member\?\.verified/);
 assert.match(server,/post\.is_anonymous\?'New anonymous confession'/);
 assert.match(sql,/vault\.decrypted_secrets/);
 assert.match(sql,/net\.http_post/);
 assert.match(sql,/new campus question/i);
 assert.match(sql,/s\.user_id<>NEW\.user_id/);
 assert.doesNotMatch(sql,/NEW\.text|decrypted_secret\s*:=\s*'/);
});

test('system notifications deep-link to posts and do not double-show phone alerts',()=>{
 assert.match(member,/n\.type === 'comment' \|\| n\.type === 'post'/);
 assert.match(member,/onNavigate\(\{ module: 'community', post:/);
 assert.doesNotMatch(member,/if \(notif\.type !== 'push_test'\) fireSystemNotification/);
 assert.match(worker,/showNotification/);
 assert.match(worker,/notificationclick/);
 assert.match(server,/\/#community\?post=/);
});

test('iPhone users get install instructions and must explicitly enable notifications',()=>{
 assert.match(banner,/Add to Home Screen/);
 assert.match(banner,/Notification\.requestPermission\(\)/);
 assert.match(banner,/pushManager\.subscribe/);
 assert.match(banner,/push-remind-after/);
 assert.match(banner,/lock screen/);
 assert.doesNotMatch(banner,/sessionStorage\.getItem\('kampus:push-dismissed'\)/);
});
