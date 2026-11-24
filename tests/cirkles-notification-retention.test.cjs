const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const source=fs.readFileSync('supabase/migrations/20261124110000_cirkles_retention_notifications.sql','utf8');
test('notification migration: real isolated Postgres consent, moderation, dedup and worker leases',async()=>{
 const {cirklesFixture}=await import('./cirkles-fixture.mjs');
 const {db,ids}=await cirklesFixture();
 try{
 await db.exec(`CREATE TABLE public.notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,type text,title text,body text,reference_id text);
 CREATE TABLE public.push_subscriptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid);
 CREATE TABLE public.user_blocks(user_id uuid,blocked_id uuid,PRIMARY KEY(user_id,blocked_id));`);
 await db.exec(source.split('-- Production scheduler')[0]+'COMMIT;');
 const q=async(sql,args=[]) =>(await db.query(sql,args)).rows;
 async function as(role,id,sql,args=[]){
 await db.exec('BEGIN');try{await db.exec('SET LOCAL ROLE '+role);await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id||'']);const r=await q(sql,args);await db.exec('COMMIT');return r;}catch(e){await db.exec('ROLLBACK');throw e;}}
 assert.equal((await q('select count(*)::int n from cirkles_email_jobs'))[0].n,0);
 await q('insert into push_subscriptions(user_id) values($1),($2),($3)',[ids.a,ids.b,ids.c]);
 await as('authenticated',ids.b,"insert into cirkles_notification_preferences(user_id,push_new_posts,email_frequency,email_replies) values($1,true,'every',true) on conflict(user_id) do update set user_id=excluded.user_id,email_frequency=excluded.email_frequency,push_new_posts=excluded.push_new_posts,email_replies=excluded.email_replies",[ids.b]);
 await as('authenticated',ids.c,"insert into cirkles_notification_preferences(user_id,push_new_posts,email_frequency) values($1,false,'daily')",[ids.c]);
 await as('authenticated',ids.admin,"insert into cirkles_notification_preferences(user_id,push_new_posts,email_frequency) values($1,false,'weekly')",[ids.admin]);
 await assert.rejects(as('authenticated',ids.a,"insert into cirkles_notification_preferences(user_id,email_frequency) values($1,'every')",[ids.b]));
 assert.equal((await as('authenticated',ids.a,'select user_id from cirkles_notification_preferences')).length,0);
 await assert.rejects(as('authenticated',ids.b,'select unsubscribe_token from cirkles_notification_preferences'));
 await assert.rejects(as('authenticated',ids.b,'select * from cirkles_email_jobs'));
 await assert.rejects(as('authenticated',ids.b,'select claim_cirkles_email_jobs()'));
 const create=async(visibility='campus',status='approved')=>(await q("insert into feed_posts(user_id,category,text,visibility,post_kind,moderation_status) values($1,'General','Original fictional test story',$2,'confession',$3) returning id",[ids.a,visibility,status]))[0].id;
 const post=await create();const second=await create();
 let jobs=await q('select user_id,kind,post_ids,due_at from cirkles_email_jobs order by user_id,kind');
 assert.equal(jobs.filter(j=>j.user_id===ids.b&&j.kind==='post').length,2);
 assert.equal(jobs.filter(j=>j.user_id===ids.c&&j.kind==='digest').length,1);
 assert.equal(jobs.find(j=>j.user_id===ids.c).post_ids.length,2);
 assert.equal(jobs.find(j=>j.user_id===ids.admin).post_ids.length,2);
 assert.equal((await q("select count(*)::int n from notifications where user_id=$1 and type='post'",[ids.b]))[0].n,2);
 assert.equal((await q('select count(*)::int n from notifications where user_id=$1',[ids.c]))[0].n,0);
 assert.equal((await q('select count(*)::int n from notifications where user_id=$1',[ids.a]))[0].n,0);
 const blocked=await create('campus','blocked');const privateId=await create('private');const pub=await create('public');
 assert.equal((await q('select count(*)::int n from cirkles_email_jobs where post_ids && $1::uuid[]',[[blocked,privateId,pub]]))[0].n,0);
 await q('update feed_posts set moderation_status=\'approved\' where id=$1',[blocked]);
 assert.equal((await q('select count(*)::int n from cirkles_email_jobs where $1=any(post_ids)',[blocked]))[0].n,3);
 await q('update feed_posts set moderation_status=\'blocked\' where id=$1',[blocked]);await q('update feed_posts set moderation_status=\'approved\' where id=$1',[blocked]);
 assert.equal((await q('select count(*)::int n from cirkles_email_jobs where $1=any(post_ids)',[blocked]))[0].n,3);
 await q('insert into user_blocks(user_id,blocked_id) values($1,$2)',[ids.a,ids.b]);const excluded=await create();
 assert.equal((await q('select count(*)::int n from cirkles_email_jobs where user_id=$1 and $2=any(post_ids)',[ids.b,excluded]))[0].n,0);
 await q('delete from user_blocks where user_id=$1 and blocked_id=$2',[ids.a,ids.b]);
 const owned=(await q("insert into feed_posts(user_id,category,text,visibility,post_kind,moderation_status) values($1,'General','A reply test','campus','question','approved') returning id",[ids.b]))[0].id;
 await q("insert into feed_comments(post_id,user_id,text) values($1,$2,'A sample reply')",[owned,ids.a]);
 assert.equal((await q("select count(*)::int n from cirkles_email_jobs where user_id=$1 and kind='reply'",[ids.b]))[0].n,1);
 const old=(await q('select email_version from cirkles_notification_preferences where user_id=$1',[ids.b]))[0].email_version;
 await as('authenticated',ids.b,"update cirkles_notification_preferences set email_frequency='off',email_replies=false where user_id=$1",[ids.b]);
 assert.notEqual((await q('select email_version from cirkles_notification_preferences where user_id=$1',[ids.b]))[0].email_version,old);
 const claimed=await as('service_role',null,'select * from claim_cirkles_email_jobs()');assert.ok(claimed.length>0&&claimed.length<=8);assert.ok(claimed.every(j=>j.status==='processing'&&j.attempts===1&&j.kind!=='digest'));
 const again=await as('service_role',null,'select * from claim_cirkles_email_jobs()');assert.ok(again.every(j=>!claimed.some(c=>c.id===j.id)));
 }finally{await db.close();}
});
test('dispatch contains provider dedup, source eligibility and unsubscribe controls',()=>{
 const src=fs.readFileSync('app/api/cirkles/notifications/dispatch/route.ts','utf8');
 const unsub=fs.readFileSync('app/api/cirkles/notifications/unsubscribe/route.ts','utf8');
 const push=fs.readFileSync('app/api/push/dispatch/route.ts','utf8');
 for(const term of ['timingSafeEqual','Idempotency-Key','consent_version','moderation_status','email_confirmed_at','List-Unsubscribe-Post','claim_cirkles_email_jobs'])assert.ok(src.includes(term),term);
 assert.ok(!src.includes(".select('text"));assert.match(unsub,/export async function POST/);assert.match(unsub,/email_frequency:'off',email_replies:false/);assert.match(push,/Post alerts disabled/);assert.match(push,/post.moderation_status/);
});
