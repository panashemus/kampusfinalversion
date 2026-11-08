/**
 * Opt-in live provider smoke test. This uses only synthetic test input and
 * does NOT use a student's identity, documents, auth token or quota budget.
 * Logs no API key, private text or model completion.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);
const typescript=require('typescript');
const originalLoader=require.extensions['.ts'];
require.extensions['.ts']=(module,filename)=>{
  const code=fs.readFileSync(filename,'utf8');
  const compiled=typescript.transpileModule(code,{
    compilerOptions:{module:typescript.ModuleKind.CommonJS,target:typescript.ScriptTarget.ES2022},
    fileName:filename,
  });
  module._compile(compiled.outputText,filename);
};
const dirname=path.dirname(fileURLToPath(import.meta.url));
const {buildBotswanaKriticInstruction}=require(path.join(dirname,'../lib/botswana-kritic.ts'));
const {generateKriticReply,isKriticGreeting}=require(path.join(dirname,'../lib/kritic-provider.ts'));
require.extensions['.ts']=originalLoader;

const apiKey=process.env.GEMINI_API_KEY;
const primaryModel=process.env.KRITIC_MODEL;
if(!apiKey||!primaryModel){console.error('[Kritic live smoke] Provider credentials not configured by name.');process.exit(1);}
const systemInstruction=buildBotswanaKriticInstruction({institution:'UB (synthetic test context)',programme:'BSc Computer Science'});
const samples=[
  {label:'Casual greeting',prompt:'ey monna'},
  {label:'Academic feedback',prompt:'Review this fictional sample paragraph, explaining one weakness: "Solar energy is important for Botswana because it is very important and everybody agrees."'},
];
for(const sample of samples){
  const start=Date.now();
  try{
    const result=await generateKriticReply({
      apiKey,primaryModel,systemInstruction,
      contents:[{role:'user',parts:[{text:sample.prompt}]}],
      greeting:isKriticGreeting(sample.prompt),
      logger:(event,model,reason)=>console.warn('[Kritic live smoke]',sample.label,event,model,reason),
    });
    if(!result.reply.trim())throw new Error('Empty response');
    console.log('[Kritic live smoke]',sample.label,'PASS model='+result.model,'fallback='+result.fallbackUsed,'seconds='+Math.round((Date.now()-start)/1000));
  }catch(error){
    console.error('[Kritic live smoke]',sample.label,'FAIL '+String(error?.name||'Unknown'));
    process.exit(1);
  }
}
console.log('[Kritic live smoke] Both official API requests returned user-visible text.');
