import {PGlite} from '@electric-sql/pglite';import fs from 'node:fs';
export const cirklesMigration=fs.readdirSync('supabase/migrations').find(f=>f.endsWith('_cirkles_tezember.sql'));
export async function cirklesFixture(){
 const db=new PGlite();await db.exec(`
 CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
 CREATE TABLE public.profiles(id uuid PRIMARY KEY,username text,university text,avatar_url text,verified boolean DEFAULT true,email_verified boolean DEFAULT true,is_admin boolean DEFAULT false);
 CREATE TABLE public.feed_posts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,category text NOT NULL,text text NOT NULL,upvotes integer DEFAULT 0,created_at timestamptz DEFAULT now(),author_name text,images text[],is_anonymous boolean DEFAULT false,is_blasted boolean DEFAULT false,impact_score integer DEFAULT 0,visibility text DEFAULT 'campus',public_approved boolean DEFAULT false,institution text,post_kind text);
 CREATE TABLE public.feed_comments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),post_id uuid REFERENCES feed_posts(id) ON DELETE CASCADE,user_id uuid NOT NULL,text text NOT NULL,created_at timestamptz DEFAULT now(),author_name text,is_anonymous boolean DEFAULT false,is_public boolean DEFAULT false);
 CREATE TABLE public.feed_post_votes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),post_id uuid REFERENCES feed_posts(id) ON DELETE CASCADE,user_id uuid,created_at timestamptz DEFAULT now(),UNIQUE(post_id,user_id));
 CREATE FUNCTION public.is_kampus_member() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT EXISTS(SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE p.id=auth.uid() AND p.verified AND p.email_verified AND u.email_confirmed_at IS NOT NULL)$$;
 CREATE FUNCTION public.is_kampus_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_admin)$$;
 CREATE FUNCTION public.can_read_post(source_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT EXISTS(SELECT 1 FROM public.feed_posts p WHERE p.id=source_id AND ((p.visibility='public' AND p.public_approved) OR (auth.uid() IS NOT NULL AND (p.user_id=auth.uid() OR public.is_kampus_admin() OR (p.visibility='campus' AND public.is_kampus_member())))))$$;
 GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated,service_role;
 ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;ALTER TABLE public.feed_post_votes ENABLE ROW LEVEL SECURITY;
 CREATE POLICY posts_owner ON feed_posts FOR ALL TO authenticated USING(user_id=auth.uid() OR public.is_kampus_admin()) WITH CHECK(user_id=auth.uid() OR public.is_kampus_admin());
 CREATE POLICY comments_owner ON feed_comments FOR ALL TO authenticated USING(user_id=auth.uid() OR public.is_kampus_admin()) WITH CHECK(user_id=auth.uid() OR public.is_kampus_admin());
 CREATE POLICY votes_owner ON feed_post_votes FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid() AND public.can_read_post(post_id));
 `);
 const legacy=fs.readFileSync('supabase/migrations/20261109145000_community_identity_and_opt_in_push.sql','utf8');
 await db.exec(legacy.slice(legacy.indexOf('CREATE OR REPLACE FUNCTION public.enforce_feed_post_kind'),legacy.indexOf('-- Replies notify')));
 const foundation=fs.readFileSync('supabase/migrations/20261105181025_foundation_privacy.sql','utf8');
 await db.exec(foundation.slice(foundation.indexOf('CREATE OR REPLACE FUNCTION public.reset_public_approval'),foundation.indexOf('CREATE TRIGGER foundation_listing_approval')));
 const interconnect=fs.readFileSync('supabase/migrations/20261105181039_interconnect.sql','utf8');
 await db.exec(interconnect.slice(interconnect.indexOf('CREATE OR REPLACE FUNCTION public.sync_vote_count'),interconnect.indexOf('CREATE TRIGGER foundation_votes'))+`CREATE TRIGGER foundation_votes AFTER INSERT OR DELETE ON public.feed_post_votes FOR EACH ROW EXECUTE FUNCTION public.sync_vote_count();`);
 const ids={a:'11111111-1111-4111-8111-111111111111',b:'22222222-2222-4222-8222-222222222222',c:'33333333-3333-4333-8333-333333333333',admin:'44444444-4444-4444-8444-444444444444',post:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',anon:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',private:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'};
 for(const name of ['a','b','c','admin']){await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[ids[name],name+'@ub.ac.bw']);await db.query('insert into profiles(id,username,university,is_admin) values($1,$2,$3,$4)',[ids[name],name,'University of Botswana',name==='admin']);}
 await db.query("insert into feed_posts(id,user_id,category,text,visibility,post_kind) values($1,$2,'Housing','Legacy question with original student text','public','question'),($3,$2,'General','Legacy anonymous story containing Katlego','campus','confession'),($4,$2,'Tech','Legacy private draft','private','question')",[ids.post,ids.a,ids.anon,ids.private]);
 await db.query('update feed_posts set public_approved=true where id=$1',[ids.post]);
 await db.query("insert into feed_comments(post_id,user_id,text) values($1,$2,'Legacy anonymous reply')",[ids.anon,ids.b]);
 await db.query('insert into feed_post_votes(post_id,user_id) values($1,$2)',[ids.post,ids.b]);
 const before=await db.query("select id,text,upvotes,post_kind,public_approved from feed_posts order by id");
 await db.exec(fs.readFileSync('supabase/migrations/'+cirklesMigration,'utf8'));
 return {db,ids,before:before.rows};
}
