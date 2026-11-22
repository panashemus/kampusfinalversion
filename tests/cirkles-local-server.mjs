/** Explicitly synthetic, loopback-only Supabase adapter for the real Next endpoints. */
import http from 'node:http';import {cirklesFixture} from './cirkles-fixture.mjs';import {asRole} from './database.mjs';
const {db,ids}=await cirklesFixture();
const demo='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
await db.query("insert into feed_posts(id,user_id,category,text,visibility,post_kind,circle_slug,story_prompt) values($1,$2,'General','This guy brought snacks after the last exam. Our whole lecture survived together.','public','confession','tezember','Wildest semester story without dropping a single name...')",[demo,ids.b]);
await db.query('update feed_posts set public_approved=true where id=$1',[demo]);
let queue=Promise.resolve();const queued=fn=>{const next=queue.then(fn,fn);queue=next.catch(()=>{});return next;};
const tokenFor=id=>Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+86400})).toString('base64url')+'.synthetic-signature';
const users=Object.values(ids).slice(0,4);const tokens=new Map(users.map(id=>[tokenFor(id),id]));
const tokenForUser=id=>Array.from(tokens.entries()).find(([,user])=>user===id)[0];
const identifier=value=>{if(!/^[a-z_][a-z_0-9]*$/.test(value))throw Error('Unsupported fixture identifier');return '"'+value+'"';};
const filter=(params,values)=>{const clauses=[];for(const [key,value] of params){if(['select','order','offset','limit','on_conflict'].includes(key))continue;const [op,...rest]=value.split('.');const v=rest.join('.');if(op==='is'&&v==='null'){clauses.push(identifier(key)+' IS NULL');continue;}if(op==='in'){const entries=v.replace(/^\(|\)$/g,'').split(',').filter(Boolean);clauses.push(entries.length?identifier(key)+' IN ('+entries.map(entry=>{values.push(entry);return '$'+values.length;}).join(',')+')':'false');continue;}const operators={eq:'=',ilike:'ILIKE'};if(!operators[op])throw Error('Unsupported fixture filter');values.push(v==='true'?true:v==='false'?false:v);clauses.push(identifier(key)+' '+operators[op]+' $'+values.length);}return clauses.length?' WHERE '+clauses.join(' AND '):'';};
const rpcArgs={is_kampus_member:[],cirkles_reserve_attempt:['actor','kind'],cirkles_reserve_ai:[],cirkles_submit:['actor','kind','payload','review_mode'],cirkles_admin_status:['source','new_status']};
const server=http.createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','http://localhost:3000');res.setHeader('Access-Control-Allow-Headers',String(req.headers['access-control-request-headers']||'authorization,apikey,content-type,x-client-info,prefer,x-supabase-api-version,accept-profile'));res.setHeader('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');res.setHeader('Access-Control-Expose-Headers','Content-Range');res.setHeader('Access-Control-Allow-Private-Network','true');
 if(req.method==='OPTIONS'){res.writeHead(204).end();return;}
 const send=(status,body)=>res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify(body));
 try{
  const url=new URL(req.url,'http://127.0.0.1:54321');const bearer=String(req.headers.authorization||'').replace(/^Bearer /,'');const userId=tokens.get(bearer);const role=bearer==='synthetic-service-key'?'service_role':userId?'authenticated':'anon';
  if(url.pathname==='/fixture/session'){return send(200,{access_token:tokenForUser(ids.a),token_type:'bearer',refresh_token:'synthetic-refresh',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,user:{id:ids.a,email:'fixture@ub.ac.bw',email_confirmed_at:new Date().toISOString(),aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()}});}
  if(url.pathname==='/auth/v1/user')return send(userId?200:401,userId?{id:userId,email:'fixture@ub.ac.bw',email_confirmed_at:new Date().toISOString(),aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()}:{message:'Invalid fixture session'});
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>30000)throw Error('Too large');}const body=raw?JSON.parse(raw):{};
  if(url.pathname.startsWith('/rest/v1/rpc/')){const name=url.pathname.split('/').at(-1);if(!(name in rpcArgs))throw Error('Unsupported fixture RPC');const args=rpcArgs[name].map(key=>key==='payload'?JSON.stringify(body[key]):body[key]);const rows=await queued(()=>asRole(db,role,userId||null,'select '+identifier(name)+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') as value',args));return send(200,rows[0].value);}
  if(!url.pathname.startsWith('/rest/v1/'))return send(404,{message:'Fixture route not available'});
  const table=identifier(url.pathname.split('/').at(-1));const values=[];let sql;
  if(req.method==='GET'){const columns=url.searchParams.get('select')||'*';sql='SELECT '+(columns==='*'?'*':columns.split(',').map(identifier).join(','))+' FROM '+table+filter(url.searchParams,values);const order=url.searchParams.get('order');if(order)sql+=' ORDER BY '+order.split(',').map(item=>{const [key,dir]=item.split('.');return identifier(key)+(dir==='desc'?' DESC':' ASC');}).join(',');const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||1000);sql+=' LIMIT '+Math.min(limit,1000)+' OFFSET '+offset;}
  else if(req.method==='POST'){const keys=Object.keys(body);values.push(...Object.values(body));sql='INSERT INTO '+table+'('+keys.map(identifier).join(',')+') VALUES('+values.map((_,i)=>'$'+(i+1)).join(',')+') RETURNING *';}
  else if(req.method==='DELETE')sql='DELETE FROM '+table+filter(url.searchParams,values)+' RETURNING *';else return send(405,{message:'Fixture method unavailable'});
  const rows=await queued(()=>asRole(db,role,userId||null,sql,values));if(String(req.headers.accept).includes('vnd.pgrst.object'))return rows.length===1?send(200,rows[0]):send(406,{code:'PGRST116',message:'No row'});return send(200,rows);
 }catch(e){return send(e.code==='42501'?403:400,{code:e.code||'FIXTURE',message:e.message});}
});
server.listen(54321,'127.0.0.1',()=>console.log('Cirkles synthetic Postgres adapter ready at loopback:54321. No production services.'));
