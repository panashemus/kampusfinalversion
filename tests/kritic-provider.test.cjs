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
  assert.match(seen[1],/gemini-2.5-flash-lite/);
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

test('exam quality floor triggers fallback instead of accepting a one-line non-critique', async () => {
  let calls=0;
  const result=await generateKriticReply({...base,minReplyChars:120,fetcher:async()=>{
    calls++;
    return validReply(calls===1 ? 'Looks good.' : 'Kritic overview: The sample reasoning lacks a clear explanation. Study the underlying concepts, practise two worked problems, and check your answer against the supplied marking rubric.');
  }});
  assert.equal(calls,2);
  assert.equal(result.fallbackUsed,true);
});
test('exam quality floor rejects both inadequate responses', async () => {
  await assert.rejects(()=>generateKriticReply({...base,minReplyChars:500,fetcher:async()=>validReply('Too brief for a detailed assessment')}),/All configured academic AI providers failed/);
});

test('Kritic uses free Hydrogen before both established Gemini fallback models', async () => {
  const {selectKriticModels, FREE_KRITIC_MODELS} = require('../lib/kritic-provider.ts');
  assert.deepEqual(
    selectKriticModels('gemini-4-hydrogen', ['gemini-3.6-flash']),
    ['gemini-4-hydrogen', 'gemini-3.6-flash', 'gemini-2.5-flash-lite'],
  );
  assert.ok(FREE_KRITIC_MODELS.includes('gemini-4-hydrogen'));
  const seen = [];
  const result = await generateKriticReply({
    ...base,
    primaryModel: 'gemini-4-hydrogen',
    fallbackModels: ['gemini-3.6-flash'],
    fetcher: async (url,opts) => {
      seen.push(url);
      assert.ok(!opts.body.includes('OPENAI_API_KEY'));
      return seen.length === 3 ? validReply('Here is the improved review with evidence.') : failure(503);
    },
  });
  assert.deepEqual(seen.map(url => url.split('/models/')[1].split(':')[0]), [
    'gemini-4-hydrogen','gemini-3.6-flash','gemini-2.5-flash-lite',
  ]);
  assert.equal(result.model, 'gemini-2.5-flash-lite');
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.multiStepUsed, false);
});

test('Carbon and Argon are never selected with the default zero-paid-model policy', () => {
  const {selectKriticModels} = require('../lib/kritic-provider.ts');
  const models = selectKriticModels('gemini-4-carbon', [
    'gemini-4-argon','gemini-3.6-flash','gemini-2.5-pro',
  ]);
  assert.deepEqual(models, ['gemini-3.5-flash-lite','gemini-3.6-flash','gemini-2.5-flash-lite']);
  assert.deepEqual(
    selectKriticModels('gemini-4-argon',['gemini-3.6-flash'],true),
    ['gemini-4-argon','gemini-3.6-flash','gemini-2.5-flash-lite'],
  );
  const route = fs.readFileSync(path.resolve(__dirname,'../app/api/kritic-audit/route.ts'),'utf8');
  assert.match(route,/KRITIC_PAID_MODELS_ENABLED === 'I_ACCEPT_PAID_API_CHARGES'/);
  assert.doesNotMatch(route,/process\.env\.OPENAI_API_KEY|api\.openai\.com/);
});

test('complex coursework first maps evidence, then verifies it in final academic critique', async () => {
  const calls=[];
  const result=await generateKriticReply({
    ...base,
    primaryModel:'gemini-4-hydrogen',
    fallbackModels:['gemini-3.6-flash'],
    multiStep:true,
    deadlineAt:Date.now()+50_000,
    contents:[{role:'user',parts:[{text:'Review this supplied synthetic assignment and rubric.'}]}],
    fetcher:async (url,options) => {
      calls.push({url,options});
      return calls.length === 1
        ? validReply('Supplied rubric: research accuracy; sample argument is vague; source not identified.')
        : validReply('Kritic verdict: The draft needs evidence. Priority fix: verify the claim against your supplied rubric and substantiate it.');
    },
  });
  assert.equal(calls.length,2);
  assert.equal(result.model,'gemini-4-hydrogen');
  assert.equal(result.fallbackUsed,false);
  assert.equal(result.multiStepUsed,true);
  const planning=JSON.parse(calls[0].options.body);
  const final=JSON.parse(calls[1].options.body);
  assert.match(planning.systemInstruction.parts[0].text,/FACTUAL evidence inventory/);
  assert.match(JSON.stringify(final.contents),/AUTO-GENERATED EVIDENCE INVENTORY FOR VERIFICATION/);
  assert.match(JSON.stringify(final.contents),/Supplied rubric/);
  assert.equal(planning.generationConfig.maxOutputTokens,800);
});

test('failed evidence mapping never blocks a usable final answer', async () => {
  let calls=0;
  const result=await generateKriticReply({
    ...base, primaryModel:'gemini-4-hydrogen',
    multiStep:true, deadlineAt:Date.now()+50_000,
    fetcher:async () => (++calls === 1 ? failure(429) : validReply('Review is available without the optional planning pass.')),
  });
  assert.equal(calls,2);
  assert.equal(result.fallbackUsed,false);
  assert.equal(result.multiStepUsed,false);
});

test('short request deadlines skip extra reasoning and avoid unbounded retries', async () => {
  let calls=0;
  await assert.rejects(()=>generateKriticReply({
    ...base, primaryModel:'gemini-4-hydrogen',multiStep:true,
    deadlineAt:Date.now()+500,
    fetcher:async()=>{calls++;return failure(503)},
  }),/All configured academic AI providers failed/);
  assert.equal(calls,0);
});


test('fast short answers skip heavyweight thinking and limit visible tokens', async () => {
 const seen=[];
 const result=await generateKriticReply({
   ...base,primaryModel:'gemini-3.5-flash-lite',quickAnswer:true,
   fallbackModels:['gemini-2.5-flash-lite'],
   fetcher:async (url,opts)=>{seen.push({url,body:JSON.parse(opts.body)});return validReply('Kritic uses different Gemini models based on availability.');},
 });
 assert.equal(result.fallbackUsed,false);
 assert.equal(seen.length,1);
 assert.match(seen[0].url,/gemini-3.5-flash-lite/);
 assert.equal(seen[0].body.generationConfig.thinkingConfig.thinkingLevel,'low');
 assert.equal(seen[0].body.generationConfig.maxOutputTokens,1300);
});

test('2.5-model requests use thinkingBudget, not unsupported thinkingLevel', async () => {
 for (const model of ['gemini-2.5-flash','gemini-2.5-flash-lite']) {
   let body;
   await generateKriticReply({...base,primaryModel:model,quickAnswer:true,
     fetcher:async (_,opts)=>{body=JSON.parse(opts.body);return validReply('Test reply');}});
   assert.equal(body.generationConfig.thinkingConfig.thinkingBudget,0);
   assert.equal(body.generationConfig.thinkingConfig.thinkingLevel,undefined);
 }
});

test('route disables extra model pass unless explicitly enabled and defaults away from Hydrogen',()=>{
 const route=fs.readFileSync(path.resolve(__dirname,'../app/api/kritic-audit/route.ts'),'utf8');
 assert.match(route,/KRITIC_EVIDENCE_PASS_ENABLED === 'true'/);
 assert.match(route,/quickAnswer \? 'gemini-3.5-flash-lite' : 'gemini-3.8-flash'/);
 assert.match(route,/Answer the actual question directly/);
 assert.doesNotMatch(route,/process\.env\.OPENAI_API_KEY/);
});

test('model-status questions return a truthful no-quota fast path without the provider',()=>{
 const route=fs.readFileSync(path.resolve(__dirname,'../app/api/kritic-audit/route.ts'),'utf8');
 assert.match(route,/modelStatusQuestion/);
 assert.match(route,/Hydrogen is temporarily not the default/);
 assert.match(route,/is_preview: true, \/\/ informational system reply/);
 const statusIndex=route.indexOf('if (modelStatusQuestion)');
 const quotaIndex=route.indexOf("db.rpc('reserve_kritic_request')");
 assert.ok(statusIndex > 0 && statusIndex < quotaIndex);
});
