const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

require.extensions['.ts'] = (mod, filename) => {
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  mod._compile(compiled.outputText, filename);
};
const {generateKriticReply,isKriticGreeting} = require('../lib/kritic-provider.ts');
const {uploadPrivateKriticFile} = require('../lib/kritic-files.ts');
const validReply = value => ({ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:value}]}}]})});
const failure = status => ({ok:false,status,json:async()=>({error:{status:'UNAVAILABLE'}})});
const base={
  apiKey:'local-unit-test-placeholder',
  primaryModel:'gemini-3.6-flash',
  systemInstruction:'Critique schoolwork according to the submitted rubric',
  contents:[{role:'user',parts:[{text:'ey monna'}]}],
};

test('Botswana short greetings are fast-lane eligible but substantive work is not', () => {
  assert.equal(isKriticGreeting('ey monna'), true);
  assert.equal(isKriticGreeting('dumela!'), true);
  assert.equal(isKriticGreeting('Analyse my paragraph'), false);
  assert.equal(isKriticGreeting('ey monna, review my assignment'), false);
});
test('working primary model returns real provider text and no fallback', async () => {
  let calls=0;
  const output=await generateKriticReply({...base,greeting:true,fetcher:async (_url,opts)=>{
    calls++;
    assert.equal(JSON.parse(opts.body).generationConfig.thinkingConfig.thinkingLevel,'low');
    return validReply('Ey monna! O tsogile jang?');
  }});
  assert.equal(calls,1);
  assert.equal(output.fallbackUsed,false);
  assert.match(output.reply,/Ey monna/);
});
test('timeout on primary model falls back to Flash-Lite with no second quota reservation', async () => {
  const seen=[];
  const output=await generateKriticReply({...base,fetcher:async url=>{
    seen.push(url);
    if(seen.length===1)throw new DOMException('Timeout','TimeoutError');
    return validReply('Here is your academic feedback.');
  }});
  assert.equal(seen.length,2);
  assert.match(seen[0],/gemini-3.6-flash/);
  assert.match(seen[1],/gemini-3.5-flash-lite/);
  assert.equal(output.fallbackUsed,true);
  assert.match(output.reply,/academic feedback/);
});
test('upstream 503 triggers a model fallback', async () => {
  let calls=0;
  const output=await generateKriticReply({...base,fetcher:async ()=>{
    calls++;
    return calls===1 ? failure(503) : validReply('Usable academic reply');
  }});
  assert.equal(output.fallbackUsed,true);
  assert.equal(calls,2);
});
test('thought-only content never leaks as a visible response', async () => {
  let calls=0;
  const res=await generateKriticReply({...base,fetcher:async () => {
    calls++;
    return calls===1 ? {ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:'internal thought',thought:true}]},finishReason:'MAX_TOKENS'}]})} : validReply('Student facing answer');
  }});
  assert.equal(res.reply,'Student facing answer');
  assert.equal(res.fallbackUsed,true);
});
test('all upstream failures surface an error rather than inventing an academic critique', async () => {
  await assert.rejects(()=>generateKriticReply({...base,fetcher:async()=>failure(503)}),/All configured academic AI providers failed/);
});
test('server uses the service-only refund RPC on failed generation and retains quota limit', () => {
  const source=fs.readFileSync(path.resolve(__dirname,'../app/api/kritic-audit/route.ts'),'utf8');
  assert.match(source,/reserve_kritic_request/);
  assert.match(source,/release_failed_kritic_request/);
  assert.match(source,/SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source,/generateKriticReply/);
  assert.match(source,/releaseUnsuccessfulReservation\(user\.id, bucket\)/);
});

test('10 MB files travel through the Gemini Files API rather than the generateContent JSON body',async()=>{
 const seen=[];
 const bytes=Buffer.from('%PDF-1.4\\nsynthetic coursework fixture');
 const uploadUrl='https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=fixture';
 const fakeFetch=async (url,options)=>{
   seen.push({url,options});
   if(seen.length===1) return {ok:true,headers:{get:()=>uploadUrl}};
   return {ok:true,json:async()=>({file:{uri:'https://generativelanguage.googleapis.com/v1beta/files/mock',name:'files/mock',state:'ACTIVE'}})};
 };
 const result=await uploadPrivateKriticFile('test-placeholder',bytes,'application/pdf',fakeFetch);
 assert.equal(result.name,'files/mock');
 assert.equal(seen.length,2);
 assert.equal(seen[0].url,'https://generativelanguage.googleapis.com/upload/v1beta/files');
 assert.equal(seen[0].options.headers['X-Goog-Upload-Header-Content-Length'],String(bytes.length));
 assert.equal(seen[1].url,uploadUrl);
 assert.equal(seen[1].options.headers['X-Goog-Upload-Command'],'upload, finalize');
 assert.deepEqual(Buffer.from(seen[1].options.body),bytes);
});
test('Gemini Files API refuses unexpected upload URLs',async()=>{
 const fakeFetch=async ()=>({ok:true,headers:{get:()=> 'http://untrusted.example/upload'}});
 await assert.rejects(()=>uploadPrivateKriticFile('test-placeholder',Buffer.from('PDF'),'application/pdf',fakeFetch),/could not be started/);
});
