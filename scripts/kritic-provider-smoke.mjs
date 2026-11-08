/**
 * Temporary provider investigation. Logs only status codes, timings, and error classes.
 * Never logs or stores credentials, student work, or provider response text.
 */
const key=process.env.GEMINI_API_KEY;
if(!key){ console.error('[Kritic probe] GEMINI_API_KEY missing');process.exit(1); }
const models=['gemini-3.8-flash','gemini-3.5-flash-lite'];
const api='https://generativelanguage.googleapis.com/v1beta/models/';
async function probe(label, url, init, timeout=12000) {
  const started=Date.now();
  try{
    const result=await fetch(url,{...init,headers:{'x-goog-api-key':key,'Content-Type':'application/json'},signal:AbortSignal.timeout(timeout)});
    let statusCode='';
    try {const data=await result.json();statusCode=String(data?.error?.status||'');if(result.ok && label.startsWith('POST')){const reply=data?.candidates?.[0]?.content?.parts?.filter(x=>typeof x.text==='string'&&!x.thought).map(x=>x.text).join(' ').trim();statusCode=reply?'valid-text':'no-visible-text';}}
    catch{}
    console.log('[Kritic probe] '+label+' HTTP='+result.status+' result='+statusCode+' elapsed='+Math.round((Date.now()-started)/1000)+'s');
    return result.ok && (label.startsWith('GET')||statusCode==='valid-text');
  }catch(error){
    console.log('[Kritic probe] '+label+' error='+String(error?.name||'unknown')+' elapsed='+Math.round((Date.now()-started)/1000)+'s');
    return false;
  }
}
const tests=[];
for(const model of models){
 const get=await probe('GET '+model,api+model,{method:'GET'},8000);
 tests.push(get);
 if(get){
  const post=await probe('POST '+model,api+model+':generateContent',{
    method:'POST',
    body:JSON.stringify({
     contents:[{role:'user',parts:[{text:'ey monna'}]}],
     systemInstruction:{parts:[{text:'Reply naturally, briefly to a greeting from a student in Botswana.'}]},
     generationConfig:{maxOutputTokens:384,thinkingConfig:{thinkingLevel:model.includes('3.8')?'low':'minimal'}}
    })
  },18000);
  tests.push(post);
 }
}
if(!tests.some((x,i)=>i%2===1&&x)){
 console.error('[Kritic probe] No successful generation via provider; build blocked.');
 process.exit(1);
}
console.log('[Kritic probe] At least one provider model generated a reply.');
