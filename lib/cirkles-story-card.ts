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
 const accent=post.circle==='tezember'?'rgb(255,195,95)':post.circle==='confessions'?'rgb(248,163,176)':post.circle==='unpopular-takes'?'rgb(190,187,255)':post.circle==='holiday-linkup'?'rgb(157,230,196)':p.pine;
 let font=60,lines=wrap(post.text,25);
 for(const size of [54,50,46,42,38,34]){
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
 '<defs><linearGradient id="card-bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+p.surface+'"/><stop offset="1" stop-color="'+p.midnight+'"/></linearGradient><radialGradient id="halo"><stop stop-color="'+accent+'" stop-opacity=".21"/><stop offset="1" stop-color="'+accent+'" stop-opacity="0"/></radialGradient><clipPath id="frame"><rect x="54" y="100" width="972" height="1670" rx="56"/></clipPath></defs>'+
 '<rect width="1080" height="1920" fill="'+p.midnight+'"/><rect x="54" y="100" width="972" height="1670" rx="56" fill="url(#card-bg)" stroke="'+p.pine+'" stroke-opacity=".32" stroke-width="2"/>'+
 '<g clip-path="url(#frame)"><circle cx="985" cy="210" r="440" fill="url(#halo)"/><circle cx="1000" cy="180" r="210" fill="none" stroke="'+accent+'" stroke-opacity=".14" stroke-width="2"/><circle cx="1000" cy="180" r="160" fill="none" stroke="'+accent+'" stroke-opacity=".22" stroke-width="2"/><circle cx="1000" cy="180" r="110" fill="none" stroke="'+accent+'" stroke-opacity=".35" stroke-width="3"/><circle cx="840" cy="180" r="7" fill="'+accent+'"/><circle cx="924" cy="316" r="4" fill="'+accent+'"/><circle cx="75" cy="1710" r="300" fill="url(#halo)"/><rect x="100" y="119" width="110" height="6" rx="3" fill="'+accent+'"/><rect x="222" y="119" width="28" height="6" rx="3" fill="'+accent+'" opacity=".4"/></g>'+
 '<g transform="translate(100 167) scale(.85)" fill="none" stroke="'+p.pine+'" stroke-linecap="round"><g stroke-width="15"><path d="M54 17 A48 48 0 0 1 99 97"/><path d="M33 28 A48 48 0 0 0 30 98"/><path d="M48 110 A48 48 0 0 0 78 111"/></g><circle cx="64" cy="64" r="24" stroke-width="7"/></g>'+
 '<g font-family="Arial, sans-serif, Apple Color Emoji, Segoe UI Emoji"><text x="226" y="237" font-size="64" font-weight="700" letter-spacing="-2" fill="white">Cirkles</text>'+
 '<rect x="100" y="292" width="880" height="2" fill="'+accent+'" opacity=".25"/><rect x="100" y="316" width="'+Math.min(800,Math.max(260,Array.from(label).length*20+52))+'" height="55" rx="27" fill="'+accent+'" fill-opacity=".12" stroke="'+accent+'" stroke-opacity=".55"/><text x="126" y="352" font-size="30" font-weight="700" fill="'+accent+'">'+escape(label)+'</text><text x="100" y="410" font-size="23" letter-spacing="3" fill="'+p.sage+'">'+author+'</text><text x="920" y="435" text-anchor="end" font-size="110" font-weight="700" fill="'+accent+'" opacity=".25">“</text>'+
 displayed.map((line,i)=>'<text x="100" y="'+(top+font+i*step)+'" font-size="'+font+'" fill="white">'+escape(line)+'</text>').join('')+
 (truncated?'<text x="100" y="1515" font-size="25" fill="'+p.sage+'">Excerpt · Read the full post on Kampus</text>':'')+
 '<rect x="100" y="1550" width="880" height="2" fill="'+accent+'" opacity=".25"/><rect x="100" y="1584" width="880" height="125" rx="30" fill="'+accent+'" fill-opacity=".09" stroke="'+accent+'" stroke-opacity=".3"/><text x="130" y="1621" font-size="21" font-weight="700" letter-spacing="3" fill="'+p.sage+'">JOIN THE CONVERSATION</text><text x="130" y="1679" font-size="52" font-weight="700" fill="'+accent+'">kampusbw.site</text><circle cx="918" cy="1646" r="34" fill="'+accent+'"/><text x="918" y="1660" font-size="43" text-anchor="middle" fill="'+p.midnight+'">↗</text></g></svg>';
}
