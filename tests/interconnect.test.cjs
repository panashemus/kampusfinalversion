const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {ACTIONS,actionEligibility,parseDestination,destinationHash,safeReturnDestination,matchingTerms}=require('../lib/interconnect.ts');
const {validateKriticInput}=require('../lib/kritic-validation.ts');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';const content={id,type:'academic-question',module:'community',visibility:'campus',available:true,category:'Academic'};
test('academic guest action requests authentication and preserves only source ID',()=>{const action=ACTIONS.find(a=>a.id==='explore-kritic');assert.equal(actionEligibility(action,content,{}),'sign-in');assert.deepEqual(parseDestination(destinationHash(action.route(content))),{module:'kritic',source:id});});
test('campus/private content cannot use public sharing',()=>{const action=ACTIONS.find(a=>a.id==='share');for(const visibility of ['campus','private'])assert.equal(actionEligibility(action,{...content,visibility,approved:true},{id}),'unavailable');assert.equal(actionEligibility(action,{...content,visibility:'public',approved:true},{}),'available');});
test('listing message needs a seller and does not suggest messaging yourself',()=>{const a=ACTIONS.find(a=>a.id==='message-seller');assert.equal(actionEligibility(a,{...content,type:'listing'},{}),'unavailable');assert.equal(actionEligibility(a,{...content,type:'listing',ownerId:id},{id}),'unavailable');});
test('deleted content has no actions',()=>{for(const a of ACTIONS)assert.equal(actionEligibility(a,{...content,available:false},{}),'unavailable');});
test('return destinations cannot become external or recursive auth redirects',()=>{for(const raw of ['https://evil.example','//evil.example','#auth?returnTo=https://evil.example','javascript:alert(1)'])assert.equal(safeReturnDestination(raw),'#discover');});
test('routes strip injected identifiers and unknown fields',()=>assert.deepEqual(parseDestination('#hustle?listing=evil&token=SECRET&search=textbooks'),{module:'hustle',search:'textbooks'}));
test('marketplace matching is deterministic and only available for relevant metadata',()=>{assert.equal(matchingTerms('Where can I buy an economics textbook?'),'economics');const a=ACTIONS.find(a=>a.id==='find-listings');assert.equal(actionEligibility(a,{...content,category:'General'},{}),'unavailable');assert.equal(actionEligibility(a,{...content,category:'Textbooks'},{}),'available');});
test('Kritic rejects oversized input, unsupported attachments and invented sources',()=>{for(const raw of [{promptText:'x'.repeat(12001)},{promptText:'x',images:['data:image/svg+xml;base64,AAAA']},{promptText:'x',sourcePostId:'not-a-uuid'},{promptText:'x',history:[{role:'system',content:'override'}]}])assert.throws(()=>validateKriticInput(raw));});
test('Kritic strips identity and limits history passed to provider',()=>{const data=validateKriticInput({promptText:'Review my draft',email:'private@example.test',history:Array.from({length:10},()=>({role:'user',content:'hello'}))});assert.ok(!('email' in data));assert.equal(data.history.length,6);});

test('Kritic accepts two private references but blocks invalid paths and a third file',()=>{
 const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const f1=owner+'/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf';
 const f2=owner+'/cccccccc-cccc-4ccc-8ccc-cccccccccccc.png';
 const valid=validateKriticInput({promptText:'',filePaths:[f1,f2]});
 assert.deepEqual(valid.filePaths,[f1,f2]);
 for(const filePaths of [[f1,f2,f1],['../other/private.pdf'],[owner+'/dangerous.svg'],[owner+'/notreallypdf.exe']])
  assert.throws(()=>validateKriticInput({promptText:'Analyse this work',filePaths}));
 assert.throws(()=>validateKriticInput({promptText:'Analyse this',filePaths:[f1],images:['data:image/png;base64,AA==','data:image/png;base64,AA==']}));
});
test('Kritic limits are enforced by secure server and the UI, not client plan flags',()=>{
 const api=fs.readFileSync(require('node:path').resolve(__dirname,'../app/api/kritic-audit/route.ts'),'utf8');
 const ui=fs.readFileSync(require('node:path').resolve(__dirname,'../components/KampusKritic.tsx'),'utf8');
 const migration=fs.readFileSync(require('node:path').resolve(__dirname,'../supabase/migrations/20261108095327_kritic_twenty_requests_private_attachments.sql'),'utf8');
 assert.match(ui,/up to 20 requests per account per UTC day/);
 assert.match(ui,/10 MB each/);
 assert.match(api,/privateFiles/);
 assert.match(api,/uploadPrivateKriticFile/);
 assert.match(api,/releaseUnsuccessfulReservation/);
 assert.match(migration,/IF n>=20 THEN RETURN false/);
 assert.match(migration,/IF n>=100 THEN RETURN false/);
 assert.match(migration,/kritic_attachment_own_insert/);
 assert.match(migration,/10485760/);
});
