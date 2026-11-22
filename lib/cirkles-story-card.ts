import {moderateText} from './moderation';
export const STORY_CARD_PALETTE={midnight:'rgb(11,22,17)',surface:'rgb(21,36,28)',pine:'rgb(255,222,77)',sage:'rgb(139,163,150)'};
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export type StoryCardInput={id:string;text:string;circle:string;visibility:string;approved:boolean};
export function canExportStory(post:StoryCardInput){return !!post.circle&&post.visibility==='public'&&post.approved&&moderateText(post.text).allowed;}
export function buildStoryCard(post:StoryCardInput){
 if(!canExportStory(post))throw Error('Story cards are available only for approved public stories without identifying text.');
 const words=post.text.slice(0,1800).split(/\s+/);const lines:string[]=[];let line='';
 for(const word of words){for(let offset=0;offset<word.length;offset+=31){const part=word.slice(offset,offset+31);if((line+' '+part).trim().length>31){lines.push(line);line=part;}else line=(line+' '+part).trim();}}
 if(line)lines.push(line);const displayed=lines.slice(0,21);if(lines.length>21)displayed[20]=displayed[20].slice(0,27)+'…';
 const p=STORY_CARD_PALETTE;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><rect width="1080" height="1920" fill="${p.midnight}"/><rect x="58" y="58" width="964" height="1804" rx="52" fill="${p.surface}" stroke="${p.sage}"/>
 <g transform="translate(90 105) scale(1.15)" fill="none" stroke="${p.pine}" stroke-linecap="round"><g stroke-width="15"><path d="M54 17 A48 48 0 0 1 99 97"/><path d="M33 28 A48 48 0 0 0 30 98"/><path d="M48 110 A48 48 0 0 0 78 111"/></g><circle cx="64" cy="64" r="24" stroke-width="7"/></g>
 <g font-family="Arial,sans-serif"><text x="270" y="178" font-size="56" font-weight="700" fill="white">CIRKLES</text><text x="94" y="330" font-size="32" fill="${p.pine}">TEZEmber · A story, no names</text>
 ${displayed.map((text,i)=>`<text x="94" y="${455+i*58}" font-size="46" fill="white">${escape(text)}</text>`).join('')}
 <text x="94" y="1730" font-size="38" font-weight="700" fill="${p.pine}">kampusbw.site</text><text x="94" y="1785" font-size="25" fill="${p.sage}">Read the conversation. Share your own story.</text></g></svg>`;
}
