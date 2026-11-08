import {UUID} from './interconnect';
export type KriticInput={promptText:string;images:string[];filePaths:string[];history:{role:'user'|'assistant';content:string}[];sourcePostId?:string};
export function validateKriticInput(raw:unknown):KriticInput{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid request.');
 const b=raw as Record<string,unknown>;
 if(typeof b.promptText!=='string'||b.promptText.length>12000)throw new Error('Keep your prompt within 12,000 characters.');
 const images=b.images??[];const filePaths=b.filePaths??[];
 if(!Array.isArray(images)||!Array.isArray(filePaths)||images.length+filePaths.length>2)throw new Error('Attach at most two files.');
 for(const filePath of filePaths){if(typeof filePath!=='string'||!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:jpg|jpeg|png|webp|pdf)$/i.test(filePath))throw new Error('Invalid private attachment reference.');}
 for(const image of images){if(typeof image!=='string'||image.length>350000||!/^data:(image\/(png|jpeg|webp)|application\/pdf);base64,[A-Za-z0-9+/]+={0,2}$/.test(image))throw new Error('Use JPEG, PNG, WebP or PDF attachments up to 256 KB each.');}
 if(!b.promptText.trim()&&!images.length&&!filePaths.length)throw new Error('Add a question or attachment.');
 const rawHistory=b.history??[];if(!Array.isArray(rawHistory)||rawHistory.length>100)throw new Error('Conversation history is too long.');
 const history=rawHistory.slice(-6).map(m=>{if(!m||typeof m!=='object'||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>12000)throw new Error('Invalid conversation history.');return {role:m.role as 'user'|'assistant',content:m.content.slice(0,4000)};});
 if(b.sourcePostId!==undefined&&(typeof b.sourcePostId!=='string'||!UUID.test(b.sourcePostId)))throw new Error('Invalid discussion reference.');
 return {promptText:b.promptText.trim(),images,filePaths,history,sourcePostId:b.sourcePostId as string|undefined};
}
