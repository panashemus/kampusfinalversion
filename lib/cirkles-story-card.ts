import {moderateText} from './moderation';
import {cirkleLabel} from './cirkles';

export const STORY_CARD_PALETTE={midnight:'rgb(11,22,17)',surface:'rgb(21,36,28)',pine:'rgb(255,222,77)',sage:'rgb(139,163,150)'};
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export type StoryCardInput={id:string;text:string;circle:string;visibility:string;approved:boolean;category?:string;isOwner?:boolean;anonymous?:boolean;moderationStatus?:string};

// Campus-only posts can be exported by their authors, not by other readers or admins.
// Public sharing still requires approval, and private drafts never leave Kampus.
export function canExportStory(post:StoryCardInput){
 return Boolean((post.circle||post.category)&&post.text.trim()&&
  (post.visibility==='public'&&post.approved||post.visibility==='campus'&&post.isOwner===true&&post.moderationStatus==='approved')&&
  (!post.moderationStatus||post.moderationStatus==='approved')&&moderateText(post.text).allowed);
}

function wrap(text:string,limit:number){
 const lines:string[]=[];
 for(const paragraph of text.split(/\r?\n/)){
  let line='';
  for(const word of paragraph.split(/\s+/).filter(Boolean)){
   const chars=Array.from(word);
   for(let i=0;i<chars.length;i+=limit){
    const part=chars.slice(i,i+limit).join('');
    if(line&&Array.from(line+' '+part).length>limit){lines.push(line);line='';}
    line=line?line+' '+part:part;
   }
  }
  lines.push(line);
 }
 return lines;
}

export function buildStoryCard(post:StoryCardInput){
 if(!canExportStory(post))throw Error('Only approved public posts or your own approved campus posts can be exported.');
 const p=STORY_CARD_PALETTE;
 let font=54,lines=wrap(post.text,28);
 for(const size of [50,46,42,38,34]){
  if(lines.length*Math.ceil(font*1.3)<=1040)break;
  font=size;lines=wrap(post.text,Math.floor(820/(font*0.57)));
 }
 const step=Math.ceil(font*1.3),max=Math.floor(1040/step),truncated=lines.length>max;
 const displayed=lines.slice(0,max);
 if(truncated)displayed[max-1]=Array.from(displayed[max-1]).slice(0,-2).join('')+'…';
 const label=post.circle?cirkleLabel(post.circle):post.category||'Community';
 const author=post.anonymous!==false?'ANONYMOUS KAMPER':'COMMUNITY POST';
 const top=430+Math.max(0,Math.min(200,(1040-displayed.length*step)/2));
 return '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">'+
 '<defs><linearGradient id="card-bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+p.surface+'"/><stop offset="1" stop-color="'+p.midnight+'"/></linearGradient></defs>'+
 '<rect width="1080" height="1920" fill="'+p.midnight+'"/><rect x="54" y="100" width="972" height="1670" rx="56" fill="url(#card-bg)" stroke="'+p.pine+'" stroke-opacity=".32" stroke-width="2"/>'+
 '<g transform="translate(100 167) scale(.85)" fill="none" stroke="'+p.pine+'" stroke-linecap="round"><g stroke-width="15"><path d="M54 17 A48 48 0 0 1 99 97"/><path d="M33 28 A48 48 0 0 0 30 98"/><path d="M48 110 A48 48 0 0 0 78 111"/></g><circle cx="64" cy="64" r="24" stroke-width="7"/></g>'+
 '<g font-family="Arial, sans-serif, Apple Color Emoji, Segoe UI Emoji"><text x="226" y="237" font-size="64" font-weight="700" letter-spacing="-2" fill="white">Cirkles</text>'+
 '<rect x="100" y="292" width="880" height="2" fill="'+p.pine+'" opacity=".25"/><text x="100" y="357" font-size="31" font-weight="700" fill="'+p.pine+'">'+escape(label)+'</text><text x="100" y="400" font-size="23" letter-spacing="2" fill="'+p.sage+'">'+author+'</text>'+
 displayed.map((line,i)=>'<text x="100" y="'+(top+font+i*step)+'" font-size="'+font+'" fill="white">'+escape(line)+'</text>').join('')+
 (truncated?'<text x="100" y="1515" font-size="25" fill="'+p.sage+'">Excerpt · Read the full post on Kampus</text>':'')+
 '<rect x="100" y="1550" width="880" height="2" fill="'+p.pine+'" opacity=".25"/><text x="100" y="1635" font-size="54" font-weight="700" fill="'+p.pine+'">kampusbw.site</text><text x="100" y="1690" font-size="26" fill="'+p.sage+'">Find your people. Join the conversation.</text></g></svg>';
}
