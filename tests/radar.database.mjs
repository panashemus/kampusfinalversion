import assert from "node:assert/strict";
import { asRole } from "./database.mjs";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
const db = new PGlite();
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY,username text,verified boolean DEFAULT true,email_verified boolean DEFAULT true);
CREATE TABLE public.user_blocks(user_id uuid,blocked_id uuid,PRIMARY KEY(user_id,blocked_id));
CREATE FUNCTION public.is_kampus_member() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND verified AND email_verified) $$;
GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;`);
await db.exec(
  fs.readFileSync(
    "supabase/migrations/20261120190000_social_radar.sql",
    "utf8",
  ),
);
await db.exec(fs.readFileSync('supabase/migrations/20261122004319_social_radar_video_privacy.sql','utf8'));
const ids = {
  a: "11111111-1111-4111-8111-111111111111",
  b: "22222222-2222-4222-8222-222222222222",
  c: "33333333-3333-4333-8333-333333333333",
  admin: "44444444-4444-4444-8444-444444444444",
};
for (const [name, id] of Object.entries(ids))
  await db.query("insert into profiles(id,username) values($1,$2)", [id, name]);
let count = 0;
const as = (id, sql, p = []) => asRole(db, "authenticated", id, sql, p);
const snap = async (id) =>
  (await as(id, "select radar_snapshot() as value"))[0].value;
const action = (id, peer, a) =>
  as(id, "select radar_friend_action($1,$2)", [peer, a]);
const start = (id, audience = "friends", recipients = []) =>
  as(
    id,
    "select radar_start_share(-24.66,25.93,60,$1,$2,'Library session',true)",
    [audience, recipients],
  );
async function check(name, fn) {
  await fn();
  count++;
  console.log("PASS " + name);
}
try {
  await check("anonymous and raw table access denied", async () => {
    await assert.rejects(asRole(db, "anon", null, "select radar_snapshot()"));
    await assert.rejects(as(ids.a, "select * from radar_shares"));
    await assert.rejects(as(ids.a, "select * from radar_friends"));
  });
  await check(
    "request does not grant visibility; sender cannot accept",
    async () => {
      await action(ids.a, ids.b, "request");
      await start(ids.a);
      assert.equal((await snap(ids.b)).shares.length, 0);
      await assert.rejects(action(ids.a, ids.b, "accept"));
    },
  );
  await check(
    "only recipient accepts; accepted friend sees share",
    async () => {
      await action(ids.b, ids.a, "accept");
      assert.equal((await snap(ids.b)).shares.length, 1);
      assert.equal((await snap(ids.c)).shares.length, 0);
    },
  );
  await check(
    "selected audience is enforced even for other accepted friends",
    async () => {
      await action(ids.a, ids.c, "request");
      await action(ids.c, ids.a, "accept");
      await start(ids.a, "selected", [ids.b]);
      assert.equal((await snap(ids.b)).shares.length, 1);
      assert.equal((await snap(ids.c)).shares.length, 0);
      await assert.rejects(start(ids.a, "selected", [ids.admin]));
      await assert.rejects(start(ids.a, "selected", []));
    },
  );
  await check("freshness and expiry checked on server", async () => {
    await db.query(
      "update radar_shares set updated_at=now()-interval '6 minutes' where user_id=$1",
      [ids.a],
    );
    assert.equal((await snap(ids.b)).shares.length, 0);
    await start(ids.a);
    await db.query(
      "update radar_shares set expires_at=now()-interval '1 second' where user_id=$1",
      [ids.a],
    );
    assert.equal((await snap(ids.b)).shares.length, 0);
    assert.equal((await snap(ids.a)).own, null);
  });
  await check("stop is owner-only and removes exact coordinates", async () => {
    await start(ids.a);
    await as(ids.b, "select radar_stop_share()");
    assert.equal((await snap(ids.b)).shares.length, 1);
    await as(ids.a, "select radar_stop_share()");
    assert.equal((await snap(ids.b)).shares.length, 0);
    assert.equal((await db.query("select * from radar_shares")).rows.length, 0);
  });
  await check("invalid coordinates and unlimited duration denied", async () => {
    await assert.rejects(
      as(ids.a, "select radar_start_share(999,0,60,'friends','{}','x',true)"),
    );
    await assert.rejects(
      as(ids.a, "select radar_start_share(0,0,999,'friends','{}','x',true)"),
    );
    await assert.rejects(
      as(ids.a, "select radar_update_position('NaN'::float8,0)"),
    );
  });
  await check("bidirectional block revokes reads and requests", async () => {
    await start(ids.a);
    await action(ids.b, ids.a, "block");
    assert.equal((await snap(ids.b)).shares.length, 0);
    assert.equal(
      (await snap(ids.a)).friends.some((f) => f.user_id === ids.b),
      false,
    );
    await assert.rejects(action(ids.a, ids.b, "request"));
    await action(ids.b, ids.a, "unblock");
    assert.equal((await snap(ids.b)).shares.length, 0);
  });
  await check("removing friendship revokes existing share", async () => {
    await start(ids.a);
    await action(ids.a, ids.c, "remove");
    assert.equal((await snap(ids.c)).shares.length, 0);
  });
  await check("unverified member cannot share or discover peers", async () => {
    await db.query("update profiles set verified=false where id=$1", [ids.c]);
    await assert.rejects(start(ids.c));
    assert.equal(
      (await as(ids.c, "select * from radar_find_friend('a')")).length,
      0,
    );
  });
  await check('coordinates are rounded before storage and peer projection; updates preserve deadline',async()=>{
    await action(ids.a,ids.b,'request');await action(ids.b,ids.a,'accept');
    await as(ids.a,"select radar_start_share(-24.661587,25.933812,60,'selected',$1,'Library session until 5',true)",[[ids.b]]);
    const before=(await snap(ids.a)).own;
    assert.equal(before.lat,-24.662);assert.equal(before.lng,25.934);
    const peer=(await snap(ids.b)).shares[0];assert.equal(peer.lat,before.lat);
    assert.ok(!('selected_ids' in peer));assert.ok(!('audience' in peer));
    await db.query("update radar_shares set updated_at=now()-interval '20 seconds' where user_id=$1",[ids.a]);
    await as(ids.a,'select radar_update_position(-24.662123,25.934987)');
    const after=(await snap(ids.a)).own;
    assert.equal(after.lat,-24.662);assert.equal(after.lng,25.935);assert.equal(after.expires_at,before.expires_at);
  });
  await check('selected consent cannot revive after remove and reconnect',async()=>{
    await action(ids.b,ids.a,'remove');
    assert.deepEqual((await snap(ids.a)).own.selected_ids,[]);
    await action(ids.b,ids.a,'request');await action(ids.a,ids.b,'accept');
    assert.equal((await snap(ids.b)).shares.length,0);
    await start(ids.a,'selected',[ids.b]);assert.equal((await snap(ids.b)).shares.length,1);
  });
  await check('blocks outside Radar delete friendship; unblock/reconnect cannot restore selected consent',async()=>{
    await db.query('insert into user_blocks(user_id,blocked_id) values($1,$2)',[ids.b,ids.a]);
    assert.equal((await snap(ids.b)).shares.length,0);assert.deepEqual((await snap(ids.a)).own.selected_ids,[]);
    await db.query('delete from user_blocks where user_id=$1 and blocked_id=$2',[ids.b,ids.a]);
    assert.equal((await snap(ids.a)).friends.length,0);
    await action(ids.a,ids.b,'request');await action(ids.b,ids.a,'accept');
    assert.equal((await snap(ids.b)).shares.length,0);
  });
  await check('position update never resurrects stopped or expired sharing',async()=>{
    await as(ids.a,'select radar_stop_share()');
    assert.equal((await as(ids.a,'select radar_update_position(1,2) as updated'))[0].updated,false);
    await start(ids.a);await db.query("update radar_shares set expires_at=now()-interval '1 second',updated_at=now()-interval '1 minute' where user_id=$1",[ids.a]);
    assert.equal((await as(ids.a,'select radar_update_position(1,2) as updated'))[0].updated,false);
    assert.equal((await snap(ids.b)).shares.length,0);
  });
  await check('new internal trigger functions and mutation RPCs deny anon execution',async()=>{
    for(const sql of ['select private.radar_forget_selected_friend()','select private.radar_block_revokes_friendship()',"select radar_start_share(0,0,60,'friends','{}','x',true)",'select radar_update_position(0,0)','select radar_stop_share()'])
      await assert.rejects(asRole(db,'anon',null,sql));
    await assert.rejects(as(ids.a,'select private.radar_forget_selected_friend()'));
  });
  console.log(`${count} Radar database checks passed`);
} finally {
  await db.close();
}
