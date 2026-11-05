import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
export async function fixtureDatabase(){
 const db=new PGlite();await db.exec(`
 CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth;CREATE SCHEMA storage;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb DEFAULT '{}');
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,owner uuid);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array($1,'/') $$;
 GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO anon,authenticated,service_role;
 GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated;
 `);
 for(const file of fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()){
 try{await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));}catch(e){throw new Error('Migration failed: '+file+': '+e.message);}}
 const ids={a:'11111111-1111-4111-8111-111111111111',b:'22222222-2222-4222-8222-222222222222',c:'33333333-3333-4333-8333-333333333333',admin:'44444444-4444-4444-8444-444444444444',post:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',private:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',campus:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',listing:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'};
 for(const [name,id] of Object.entries(ids).slice(0,4))await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[id,name+'@ub.ac.bw']);
 await db.query("UPDATE public.profiles SET username=split_part(email,'@',1),university='University of Botswana',is_admin=(id=$1)",[ids.admin]);
 await db.query("INSERT INTO public.feed_posts(id,user_id,text,category,visibility,is_anonymous,author_name) VALUES($1,$2,'How can I improve a research argument?','Academic','public',true,'PRIVATE AUTHOR'),($3,$2,'Private draft','Academic','private',false,'PRIVATE AUTHOR'),($4,$2,'Campus discussion','Textbooks','campus',false,'Student')",[ids.post,ids.a,ids.private,ids.campus]);
 await db.query('UPDATE public.feed_posts SET public_approved=true WHERE id=$1',[ids.post]);
 await db.query("INSERT INTO public.feed_comments(post_id,user_id,text,is_public) VALUES($1,$2,'Public response',true),($1,$2,'Campus-only response',false)",[ids.post,ids.b]);
 await db.query("INSERT INTO public.hustles(id,seller_id,title,price,category,description,visibility,reference_code,payment_ref_id) VALUES($1,$2,'Research methods textbook',120,'Textbooks','Synthetic test listing','public','PRIVATE REFERENCE','PRIVATE PAYMENT')",[ids.listing,ids.b]);
 await db.query('UPDATE public.hustles SET public_approved=true WHERE id=$1',[ids.listing]);
 return {db,ids};
}
export async function asRole(db,role,id,sql,params=[]){
 await db.exec('BEGIN');try{await db.exec('SET LOCAL ROLE '+role);await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[id||'']);const result=await db.query(sql,params);await db.exec('COMMIT');return result.rows;}catch(e){await db.exec('ROLLBACK');throw e;}
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/tests/database.mjs')){
 const {db,ids}=await fixtureDatabase();let passed=0;
 async function check(name,fn){await fn();passed++;console.log('PASS '+name);}
 const guest=(sql,p=[])=>asRole(db,'anon',null,sql,p);const a=(sql,p=[])=>asRole(db,'authenticated',ids.a,sql,p);const c=(sql,p=[])=>asRole(db,'authenticated',ids.c,sql,p);
 await check('guest sees approved public posts only',async()=>assert.equal((await guest('SELECT * FROM feed_preview')).length,1));
 await check('confession hides owner and author from guests and peers',async()=>{for(const rows of [await guest('SELECT * FROM feed_preview'),await c('SELECT * FROM feed_preview WHERE id=$1',[ids.post])]){assert.equal(rows[0].user_id,null);assert.equal(rows[0].author_name,'Anonymous');assert.equal(rows[0].images.length,0);}});
 await check('guest sees only explicitly public comments',async()=>{const rows=await guest('SELECT * FROM comment_preview');assert.equal(rows.length,1);assert.equal(rows[0].user_id,null);});
 await check('guest cannot read or write base tables',async()=>{for(const table of ['profiles','feed_posts','feed_comments','hustles','messages','conversations','sos_alerts','kritic_chats','kritic_messages','saved_items','user_blocks']){try{assert.equal((await guest('SELECT * FROM '+table)).length,0,table);}catch(e){assert.equal(e.code,'42501',table);}}await assert.rejects(guest("INSERT INTO sos_alerts(lat,lng) VALUES(0,0)"));});
 await check('listing guest projection excludes financial fields',async()=>{const [row]=await guest('SELECT * FROM public_listings');assert.equal(row.title,'Research methods textbook');assert.ok(!('payment_ref_id' in row));assert.ok(!('reference_code' in row));});
 await check('public profiles require explicit opt-in',async()=>{assert.equal((await guest('SELECT * FROM profile_directory')).length,0);await a('UPDATE profiles SET public_profile=true WHERE id=$1',[ids.a]);const [row]=await guest('SELECT * FROM profile_directory');assert.equal(row.id,ids.a);assert.ok(!('email' in row));});
 await check('members cannot self-assign admin or verification',async()=>{for(const field of ['is_admin','verified','email_verified'])await assert.rejects(a('UPDATE profiles SET '+field+'=true WHERE id=$1',[ids.a]));await assert.rejects(guest('INSERT INTO profiles(id,email,is_admin) VALUES($1,$2,true)',[ids.c,'fake@ub.ac.bw']));});
 await check('member cannot read another private post or raw confession',async()=>{assert.equal((await c('SELECT * FROM feed_preview WHERE id=$1',[ids.private])).length,0);assert.equal((await c('SELECT * FROM feed_posts WHERE id=$1',[ids.post])).length,0);});
 await check('owner cannot self-approve public content',async()=>{await db.query('UPDATE feed_posts SET public_approved=false WHERE id=$1',[ids.post]);await assert.rejects(a('UPDATE feed_posts SET public_approved=true WHERE id=$1',[ids.post]));});
 await db.query('UPDATE feed_posts SET public_approved=true WHERE id=$1',[ids.post]);
 await check('editing public content withdraws approval',async()=>{await a("UPDATE feed_posts SET text='Changed content' WHERE id=$1",[ids.post]);assert.equal((await guest('SELECT * FROM feed_preview')).length,0);});
 await db.query('UPDATE feed_posts SET public_approved=true WHERE id=$1',[ids.post]);
 let conversation;
 await check('listing conversation is authorized and reused in either direction',async()=>{conversation=(await a('SELECT * FROM open_conversation($1,$2)',[ids.b,ids.listing]))[0];const same=(await asRole(db,'authenticated',ids.b,'SELECT * FROM open_conversation($1,NULL)',[ids.a]))[0];assert.equal(conversation.id,same.id);assert.equal((await a('SELECT * FROM conversation_sources')).length,1);});
 await check('nonparticipant cannot read messages or source context',async()=>{await a('INSERT INTO messages(conversation_id,sender_id,text) VALUES($1,$2,$3)',[conversation.id,ids.a,'Synthetic private message']);assert.equal((await c('SELECT * FROM messages')).length,0);assert.equal((await c('SELECT * FROM conversation_sources')).length,0);});
 await check('participant cannot rewrite membership or impersonate sender',async()=>{await assert.rejects(a('UPDATE conversations SET participant_b=$1 WHERE id=$2',[ids.c,conversation.id]));await assert.rejects(a('INSERT INTO messages(conversation_id,sender_id,text) VALUES($1,$2,$3)',[conversation.id,ids.b,'spoof']));});
 await check('blocks enforce both directions at database write boundary',async()=>{await a('INSERT INTO user_blocks(blocked_id) VALUES($1)',[ids.b]);await assert.rejects(a('SELECT * FROM open_conversation($1,NULL)',[ids.b]));await assert.rejects(asRole(db,'authenticated',ids.b,'INSERT INTO messages(conversation_id,sender_id,text) VALUES($1,$2,$3)',[conversation.id,ids.b,'blocked message']));await a('DELETE FROM user_blocks WHERE blocked_id=$1',[ids.b]);});
 await check('message preferences deny conversation creation',async()=>{await asRole(db,'authenticated',ids.b,'UPDATE profiles SET allow_messages=false WHERE id=$1',[ids.b]);await assert.rejects(a('SELECT * FROM open_conversation($1,NULL)',[ids.b]));await asRole(db,'authenticated',ids.b,'UPDATE profiles SET allow_messages=true WHERE id=$1',[ids.b]);});
 await check('deleted and suspended listings cannot open a contextual conversation',async()=>{await db.query("UPDATE hustles SET status='unpaid_suspended' WHERE id=$1",[ids.listing]);await assert.rejects(a('SELECT * FROM open_conversation($1,$2)',[ids.b,ids.listing]));await db.query("UPDATE hustles SET status='active' WHERE id=$1",[ids.listing]);});
 await check('saved references retain ownership and permission checks',async()=>{await a("INSERT INTO saved_items(content_type,content_id) VALUES('post',$1)",[ids.private]);assert.equal((await c('SELECT * FROM saved_items')).length,0);await assert.rejects(c("INSERT INTO saved_items(content_type,content_id) VALUES('post',$1)",[ids.private]));});
 await check('atomic quota stops sixth request and cannot be reset by caller',async()=>{for(let i=0;i<5;i++)assert.equal((await a('SELECT reserve_kritic_request() AS allowed'))[0].allowed,true);assert.equal((await a('SELECT reserve_kritic_request() AS allowed'))[0].allowed,false);await assert.rejects(a('UPDATE request_budgets SET used=0'));await assert.rejects(guest('SELECT reserve_kritic_request()'));});
 await check('private media denies guest and unrelated peer; signed URL policy allows owner',async()=>{await db.query("INSERT INTO storage.objects(bucket_id,name,owner) VALUES('post_media',$1,$2)",[ids.a+'/private.png',ids.a]);assert.equal((await guest('SELECT * FROM storage.objects')).length,0);assert.equal((await c('SELECT * FROM storage.objects')).length,0);assert.equal((await a('SELECT * FROM storage.objects')).length,1);assert.equal((await db.query("SELECT public FROM storage.buckets WHERE id='post_media'")).rows[0].public,false);});
 await check('uploads cannot spoof another user folder',async()=>await assert.rejects(a("INSERT INTO storage.objects(bucket_id,name,owner) VALUES('post_media',$1,$2)",[ids.b+'/spoof.png',ids.a])));
 await check('SOS owner cannot deactivate another account alert',async()=>{await a('INSERT INTO sos_alerts(user_id,lat,lng) VALUES($1,1,1)',[ids.a]);assert.equal((await c('UPDATE sos_alerts SET active=false RETURNING id')).length,0);});
 console.log(`Database checks: ${passed} passed`);await db.close();
}
