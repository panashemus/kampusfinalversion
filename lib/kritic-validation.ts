import {UUID} from './interconnect';
import {KRITIC_MAX_FILES,KRITIC_MAX_TOTAL_BYTES,validateKriticPrompt, type KriticMode,type KriticFileKind} from './kritic-intake';
export type KriticInput = {
  promptText:string; images:string[]; filePaths:string[]; fileKinds:KriticFileKind[];
  mode:KriticMode; examDate?:string; examTopic?:string;
  history:{role:'user'|'assistant';content:string}[];sourcePostId?:string;
};
export function validateKriticInput(raw:unknown):KriticInput {
  if(!raw || typeof raw!=='object' || Array.isArray(raw))throw new Error('Invalid request.');
  const b=raw as Record<string,unknown>;
  if(typeof b.promptText!=='string' || b.promptText.length>12000)throw new Error('Keep your prompt within 12,000 characters.');
  const images=b.images??[],filePaths=b.filePaths??[];
  if(!Array.isArray(images)||!Array.isArray(filePaths)||images.length+filePaths.length>KRITIC_MAX_FILES)throw new Error('Attach no more than four files.');
  for(const path of filePaths)
    if(typeof path!=='string'||!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:jpg|jpeg|png|webp|pdf|docx|doc|txt)$/i.test(path))throw new Error('Invalid private attachment reference.');
  for(const image of images)
    if(typeof image!=='string'||image.length>350000||!/^data:(image\/(png|jpeg|webp)|application\/pdf);base64,[A-Za-z0-9+/]+={0,2}$/.test(image))throw new Error('Use JPEG, PNG, WebP or PDF legacy attachments up to 256 KB each.');
  const kinds=b.fileKinds??filePaths.map(()=> 'other');
  if(!Array.isArray(kinds)||kinds.length!==filePaths.length || !kinds.every(k=>['graded_work','lecture_material','other'].includes(k)))throw new Error('Tell Kritic which attachment is marked work and which is lecture material.');
  const mode=b.mode??'coursework_review';
  if(mode!=='exam_rescue'&&mode!=='coursework_review')throw new Error('Choose a valid Kritic mode.');
  const examTopic=b.examTopic===undefined?'':b.examTopic;
  if(typeof examTopic!=='string'||examTopic.length>120)throw new Error('Module or topic is too long.');
  const examDate=b.examDate??'';
  if(typeof examDate!=='string'||(examDate!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(examDate)))throw new Error('Invalid exam date.');
  if(examDate&&!Number.isFinite(Date.parse(examDate)))throw new Error('Invalid exam date.');
  const rawHistory=b.history??[];
  if(!Array.isArray(rawHistory)||rawHistory.length>100)throw new Error('Conversation history is too long.');
  const history=rawHistory.slice(-6).map(m=>{
    if(!m||typeof m!=='object'||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>12000)throw new Error('Invalid conversation history.');
    return {role:m.role as 'user'|'assistant',content:m.content.slice(0,4000)};
  });
  if(b.sourcePostId!==undefined&&(typeof b.sourcePostId!=='string'||!UUID.test(b.sourcePostId)))throw new Error('Invalid discussion reference.');
  const promptError=validateKriticPrompt(b.promptText,images.length+filePaths.length>0||!!b.sourcePostId,!!examTopic.trim());
  if(promptError)throw new Error(promptError);
  return {promptText:b.promptText.trim(),images,filePaths,fileKinds:kinds as KriticFileKind[],mode,examTopic:examTopic.trim(),examDate,history,sourcePostId:b.sourcePostId as string|undefined};
}
