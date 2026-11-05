/** Local synthetic adapter for browser QA, never production. RLS still executes. */
import http from 'node:http';
import {fixtureDatabase,asRole} from './database.mjs';
const {db,ids}=await fixtureDatabase();
await db.query("UPDATE profiles SET course_code='Research Methods',kritic_prompts_used=0 WHERE false").catch(()=>{});
const user={id:ids.a,email:'a@ub.ac.bw',email_confirmed_at:new Date().toISOString(),aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()};
let queue=Promise.resolve();const queued=fn=>{const next=queue.then(fn,fn);queue=next.catch(()=>{});return next;};
const identifier=s=>{if(!/^[a-z_][a-z_0-9]*$/.test(s))throw Error('Unsupported identifier');return '"'+s+'"';};
function where(params,values){const terms=[];for(const [key,value] of params){if(['select','order','limit','offset','on_conflict'].includes(key))continue;
 if(key==='or'){const matches=[...value.matchAll(/(participant_[ab])\.eq\.([a-f0-9-]+)/g)];if(matches.length){terms.push('('+matches.map(m=>{values.push(m[2]);return identifier(m[1])+'=$'+values.length;}).join(' OR ')+')');}continue;}
 const [operator,...parts]=value.split('.');let v=parts.join('.');let op={eq:'=',lt:'<',gt:'>',gte:'>=',ilike:'ILIKE'}[operator];
 if(operator==='in'){const entries=v.replace(/^\(|\)$/g,'').split(',').filter(Boolean);terms.push(entries.length?identifier(key)+' IN ('+entries.map(e=>{values.push(e.replace(/^"|"$/g,''));return '$'+values.length;}).join(',')+')':'false');continue;}
 if(!op)throw Error('Unsupported filter');values.push(v==='true'?true:v==='false'?false:v);terms.push(identifier(key)+' '+op+' $'+values.length);
 }return terms.length?' WHERE '+terms.join(' AND '):'';}
const server=http.createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','http://localhost:3000');res.setHeader('Access-Control-Allow-Headers','authorization,apikey,content-type,x-client-info,x-supabase-api-version,prefer,range,range-unit');res.setHeader('Access-Control-Allow-Methods','GET,HEAD,POST,PATCH,DELETE,OPTIONS');res.setHeader('Access-Control-Expose-Headers','Content-Range');res.setHeader('Access-Control-Allow-Private-Network','true');
 if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Headers',String(req.headers['access-control-request-headers']||'authorization,content-type,apikey'));res.writeHead(204).end();return;}
 const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify(body));};
 try{const url=new URL(req.url,'http://localhost');let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1000000)throw Error('Too large');}const body=raw?JSON.parse(raw):{};
 const signed=req.headers.authorization==='Bearer fixture-a';const role=signed?'authenticated':'anon';
 if(url.pathname==='/auth/v1/token'){send(200,{access_token:'fixture-a',refresh_token:'fixture-refresh',expires_in:3600,token_type:'bearer',user});return;}
 if(url.pathname==='/auth/v1/user'){send(signed?200:401,signed?user:{message:'Invalid fixture session'});return;}
 if(url.pathname==='/auth/v1/logout'){send(200,{});return;}
 if(url.pathname.startsWith('/rest/v1/rpc/')){const name=url.pathname.split('/').at(-1);if(!['sync_my_verification','open_conversation','reserve_kritic_request'].includes(name))throw Error('RPC unavailable');const args=name==='open_conversation'?[body.peer,body.listing]:[];const rows=await queued(()=>asRole(db,role,signed?ids.a:null,'SELECT * FROM '+identifier(name)+'('+args.map((_,i)=>'$'+(i+1)).join(',')+')',args));send(200,name==='open_conversation'?rows[0]:name==='reserve_kritic_request'?rows[0].reserve_kritic_request:null);return;}
 if(!url.pathname.startsWith('/rest/v1/')){send(404,{message:'Not available in fixture adapter'});return;}
 const table=identifier(url.pathname.split('/').at(-1));const values=[];let sql;
 if(req.method==='GET'||req.method==='HEAD'){
 const select=url.searchParams.get('select')||'*';const columns=select==='*'?'*':select.split(',').map(identifier).join(',');sql='SELECT '+columns+' FROM '+table+where(url.searchParams,values);
 const order=url.searchParams.get('order');if(order)sql+=' ORDER BY '+order.split(',').map(o=>{const [c,d]=o.split('.');return identifier(c)+(d==='desc'?' DESC':' ASC');}).join(',');
 const range=String(req.headers.range||'').split('-');const offset=Number(url.searchParams.get('offset')||range[0]||0);const limit=Number(url.searchParams.get('limit')||(range[1]?Number(range[1])-offset+1:100));sql+=' LIMIT '+Math.min(1000,limit)+' OFFSET '+offset;
 }else if(req.method==='POST'){const data=Array.isArray(body)?body[0]:body;const keys=Object.keys(data);values.push(...Object.values(data));sql='INSERT INTO '+table+'('+keys.map(identifier).join(',')+') VALUES('+values.map((_,i)=>'$'+(i+1)).join(',')+') RETURNING *';}
 else if(req.method==='PATCH'){const entries=Object.entries(body);sql='UPDATE '+table+' SET '+entries.map(([k,v])=>{values.push(typeof v==='object'?JSON.stringify(v):v);return identifier(k)+'=$'+values.length;}).join(',')+where(url.searchParams,values)+' RETURNING *';}
 else if(req.method==='DELETE')sql='DELETE FROM '+table+where(url.searchParams,values)+' RETURNING *';else throw Error('Method unsupported');
 const rows=await queued(()=>asRole(db,role,signed?ids.a:null,sql,values));res.setHeader('Content-Range',`0-${Math.max(0,rows.length-1)}/${rows.length}`);
 const single=String(req.headers.accept).includes('vnd.pgrst.object');if(single&&rows.length!==1){send(406,{code:'PGRST116',message:'No row'});return;}send(200,single?rows[0]:rows);
 }catch(e){send(400,{code:e.code||'FIXTURE',message:e.message});}
});server.listen(54321,'127.0.0.1',()=>console.log('Synthetic Supabase adapter ready at 127.0.0.1:54321; no external services.'));
