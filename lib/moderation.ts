import { NAME_CORPUS, HIGH_CONFIDENCE_NAMES, CONTEXT_NAMES } from './botswanaNames';

export type ModerationMatch = {start:number;end:number;layer:string;rule:string};
export type ModerationResult = {allowed:boolean;matches:ModerationMatch[];suggestion:string};
export const MODERATION_MESSAGE = 'Hold up — Cirkles is strictly no-names and no-doxxing. Swap names, initials or identifying details for “this guy”, “my ex” or [someone]. Your draft stays here.';
const names=new Set(NAME_CORPUS);
const confusables:Record<string,string>={а:'a',А:'a',е:'e',Е:'e',о:'o',О:'o',р:'p',Р:'p',с:'c',С:'c',у:'y',У:'y',х:'x',Х:'x',і:'i',І:'i',ј:'j',Ј:'j',ѕ:'s',Ѕ:'s',ԁ:'d',Ԍ:'g',ԛ:'q',ԝ:'w',Ь:'b',Β:'b',Α:'a',Ε:'e',Ζ:'z',Η:'h',Ι:'i',Κ:'k',Μ:'m',Ν:'n',Ο:'o',Ρ:'p',Τ:'t',Υ:'y',Χ:'x',α:'a',ι:'i',ο:'o',κ:'k',ν:'v',τ:'t',ϲ:'c',ӏ:'l'};
const leet:Record<string,string>={'0':'o','3':'e','4':'a','@':'a','5':'s','$':'s','7':'t','8':'b','9':'g','!':'1'};
Object.assign(confusables,{Т:'t',т:'t',К:'k',к:'k',М:'m',м:'m',Н:'h',н:'h',В:'b',в:'b'});
type Normalized={text:string;map:{start:number;end:number}[]};
export function normalizeModeration(text:string):Normalized {
  let normalized='';const map:Normalized['map']=[];let index=0;
  for(const original of text){const start=index;index+=original.length;
    for(const char of original.normalize('NFKD')){
      if(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff\u00ad\p{M}]/u.test(char))continue;
      const out=(confusables[char]||char).toLowerCase();
      normalized+=out;for(let i=0;i<out.length;i++)map.push({start,end:index});
    }
  }return {text:normalized,map};
}
const collapse=(s:string)=>s.replace(/(.)\1+/g,'$1');
const decode=(s:string,one='i')=>s.replace(/[034@$5789!1]/g,c=>c==='1'||c==='!'?one:leet[c]);
const collapsedNames=new Set(NAME_CORPUS.filter(n=>!CONTEXT_NAMES.has(n)).map(collapse));
// Bounded optimal-string-alignment distance: insertion/deletion/substitution/transposition.
export function distanceAtMostOne(a:string,b:string){
  if(Math.abs(a.length-b.length)>1)return false;if(a===b)return true;
  if(a.length===b.length){const diff=[];for(let i=0;i<a.length;i++)if(a[i]!==b[i])diff.push(i);
    return diff.length===1||(diff.length===2&&diff[1]===diff[0]+1&&a[diff[0]]===b[diff[1]]&&a[diff[1]]===b[diff[0]]);}
  if(a.length>b.length)[a,b]=[b,a];let i=0,j=0,skips=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;}else{if(++skips>1)return false;j++;}}return true;
}
const ordinary=new Set(('about above after again almost along already also another anyone around asked asking available before being below between biology block book books borrow break campus chapter classic class coffee coming comment company computer course deadline december degree discussion doing during early essay everyone exams exam exercise family festive finding first friday friend friends general going great group happy holiday holidays homes hoping housing human inside instead internet lecture library lights linkup looking lovely making maybe meeting module modules monday months morning myself nobody normal notes opinion people person please posting programme question reading really related rental research revision semester session sharing should silver someone something staying story student students studying study summer sunday table taking textbook textbooks thanks their there these thing think third those through thursday together tomorrow tonight trying tuesday under unpopular university until useful using waiting wanting wednesday weekend welcome where which while without woman working would writing young yourself').split(' '));

export function moderateText(input:string):ModerationResult {
 const source=input.slice(0,12000);const normalized=normalizeModeration(source);const {text,map}=normalized;const found:ModerationMatch[]=[];
 const add=(start:number,end:number,layer:string,rule:string)=>{if(map[start]&&map[end-1])found.push({start:map[start].start,end:map[end-1].end,layer,rule});};
 const scan=(regex:RegExp,rule:string)=>{for(const m of Array.from(text.matchAll(regex)))add(m.index!,m.index!+m[0].length,'identifier',rule);};
 scan(/(?<![a-z0-9])@[a-z0-9_][a-z0-9_.]{1,40}/g,'social_handle');
 scan(/\b(?:ig|insta(?:gram)?|tiktok|tt|snap(?:chat)?|sc|fb|facebook|x)\s*:\s*[@a-z0-9_.-]{2,40}/g,'social_pointer');
 scan(/\b(?:insta|tiktok|snap)\s+(?!story\b|stories\b|video\b|videos\b|is\b|was\b|down\b)[@a-z0-9_.-]{3,40}/g,'social_pointer');
 scan(/(?:https?:\/\/)?(?:www\.)?(?:instagram|tiktok|facebook|snapchat|twitter|x)\.com\/[^\s]+/g,'social_profile');
 scan(/(?<!\d)(?:(?:\+?267)[\s.()-]*)?[67][0-9](?:[\s.-]*\d){6}(?!\d)/g,'phone_number');
 scan(/(?<!\d)202\d(?:[\s.-]*\d){5,7}(?!\d)/g,'student_id');
 scan(/\b(?:block\s*\d{2,4}\s*(?:room|rm|r)\s*\d{1,4}[a-z]?|\d{3}\s*\/\s*\d{1,3}|(?:[a-z]+\s+)?(?:hall|hostel|dorm|residence)\s*(?:block\s*\w+\s*)?(?:room|rm)\s*\w+|(?:room|rm)\s*\d{1,4}\s*(?:at|in|of)\s*[a-z]+\s*(?:hall|hostel|dorm))\b/g,'specific_room');
 scan(/\b[a-z]\s*\.\s*[a-z]\s*\.(?:\s*[a-z]\s*\.)?/g,'person_initials');
 scan(/\b[a-z]\s*\.\s*[a-z]\b\s+(?:from|in|at)\s+[a-z]+/g,'person_initials');
 scan(/\b(?:starts?\s+with|initial(?:s)?(?:\s+(?:is|are))?)\s+[a-z]\b(?:\s+(?:from|in|at)\s+[a-z]+)?/g,'coded_initial');
 for(const m of Array.from(text.matchAll(/\b(?:ausi|rra|mma|mr|miss|ms|mrs|bro|sis)\.?\s+([a-z][a-z0-9*#?_@!$.-]{0,30})/g))){
  if(['is','was','are','please','thanks','we','you','he','she','they','it','my','our','your'].includes(m[1]))continue;
  if(m[1]==='i'&&/^\s+(?:need|have|am|will|can|was|think|want)\b/.test(text.slice(m.index!+m[0].length)))continue;
  add(m.index!,m.index!+m[0].length,'identifier','honorific_callout');
 }
 // Multiple identifying attributes, not harmless “my ex from UB” placeholders.
 scan(/\b(?:that|the)\s+(?:(?:light|dark)[ -]?skin(?:ned)?\s+)?(?:\d(?:st|nd|rd|th)|third|second|first|final)[ -]?year\s+[a-z]+\s+(?:guy|girl|man|woman|student)\b[^.!?\n]{0,140}\b(?:drives?|car|honda|bumper|registration|plate)\b[^.!?\n]{0,60}/g,'coded_identity_bundle');
 scan(/\b(?:expose|leak|post|share)\s+(?:his|her|their)\s+(?:address|number|nudes|id|location)\b/g,'doxxing_intent');
 scan(/\b(?:i(?:'m| am)?\s+(?:going\s+to|will)|let(?:'s| us))\s+(?:kill|attack|hurt|beat)\s+(?:you|him|her|them)\b/g,'targeted_threat');
 const tokenRegex=/[a-z0-9@!$*#?_]+/g;const tokens=Array.from(text.matchAll(tokenRegex));
 const targeting=/\b(?:dating|kissed|cheated|exposed|expose|slept|stole|scammer|drives?|called|named|name\s+is|from\s+(?:ub|bac|bis|bsbs|biust|botho|buan)|in\s+(?:ub|bac|bis|bsbs|law))\b/i;
 for(let t=0;t<tokens.length;t++){
  const token=tokens[t][0],start=tokens[t].index!,end=start+token.length;
  const variants=[decode(token),decode(token,'l'),decode(token.replace(/_/g,''))];
  const plain=variants[0];const original=source.slice(map[start]?.start,map[end-1]?.end);
  const before=source.slice(0,map[start]?.start);const sentenceStart=!before.trim()||/[.!?]\s*$/.test(before);
  const previous=tokens[t-1]?.[0],next=tokens[t+1]?.[0];
  const paired=!!((next&&names.has(decode(next))&&!CONTEXT_NAMES.has(decode(next)))||(previous&&names.has(decode(previous))&&!CONTEXT_NAMES.has(decode(previous))));
  const context=text.slice(Math.max(0,start-45),Math.min(text.length,end+75));
  const contextName=CONTEXT_NAMES.has(plain);
  const commonPhrase=(plain==='hope'&&/\b(?:i|we|you|they|still|really|just)\s+$/i.test(before))||
   (plain==='one'&&/^\s+(?:bedroom|day|habit|semester|module|book|thing|person|of|more|less)\b/.test(text.slice(end)))||
   (['faith','blessing','gift','joy','peace','love','mercy','comfort','fortune'].includes(plain)&&/\b(?:a|the|have|keep|pure|some|much|with|and|of)\s+$/i.test(before)&&!/^\s+(?:is\s+)?(?:dating|kissed|cheated|drives)\b/.test(text.slice(end)));
  if(contextName&&commonPhrase&&!paired)continue;
  const safeContextWord=contextName&&!paired&&!targeting.test(context)&&!( /^[A-Z]/.test(original)&&!sentenceStart );
  if(safeContextWord)continue;
  if(variants.some(v=>names.has(v))){add(start,end,contextName?'context':'name',contextName?'targeted_name_word':'exact_name');continue;}
  if(variants.some(v=>ordinary.has(v)))continue;
  if(variants.some(v=>collapsedNames.has(collapse(v)))){add(start,end,'normalization','stretched_or_leet_name');continue;}
  // Masks are anchored and bounded: do not turn arbitrary punctuation into an unbounded regex.
  if(/[*#?_]/.test(token)&&token.length>=4&&(token.match(/[a-z]/g)||[]).length>=3){
    const letters=(token.match(/[a-z]/g)||[]).length;
    if(letters/token.length>=0.45&&variants.some(v=>{const pattern=new RegExp('^'+v.split(/([*#?_]+)/).map(part=>/^[*#?_]+$/.test(part)?'.{1,4}':part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('')+'$');return HIGH_CONFIDENCE_NAMES.some(n=>pattern.test(n));}))add(start,end,'mask','censored_name');
  }
  if(plain.length>=5&&plain.length<=24&&HIGH_CONFIDENCE_NAMES.some(n=>distanceAtMostOne(collapse(plain),collapse(n))))add(start,end,'fuzzy','one_edit_name');
 }
 // Compact short runs only; never concatenate a whole sentence and match substrings.
 for(let i=0;i<tokens.length;i++){
  if(tokens[i][0].length!==1)continue;let joined='';
  for(let j=i;j<tokens.length&&j<i+22;j++){
   if(tokens[j][0].length>2)break;
   if(j>i&&!/^[\s.\-_/]*$/.test(text.slice(tokens[j-1].index!+tokens[j-1][0].length,tokens[j].index!)))break;
   joined+=tokens[j][0];
   if(joined.length>=3&&[decode(joined),decode(joined,'l')].some(n=>names.has(n)))add(tokens[i].index!,tokens[j].index!+tokens[j][0].length,'separator','separated_name');
  }
 }
 for(let i=0;i<tokens.length;i++){
  let joined=tokens[i][0];
  for(let j=i+1;j<tokens.length&&j<i+4&&joined.length<=22;j++){
   const separator=text.slice(tokens[j-1].index!+tokens[j-1][0].length,tokens[j].index!);
   if(!/^[.\-_/]+$/.test(separator)||tokens[j][0].length>12)break;joined+=tokens[j][0];
   if([decode(joined),decode(joined,'l')].some(n=>names.has(n)))add(tokens[i].index!,tokens[j].index!+tokens[j][0].length,'separator','fragmented_name');
  }
 }
 const matches=found.sort((a,b)=>a.start-b.start||b.end-a.end).filter((m,i,a)=>!a.slice(0,i).some(p=>p.start<=m.start&&p.end>=m.end));
 return {allowed:matches.length===0,matches,suggestion:matches.length?MODERATION_MESSAGE:''};
}

export function autoAnonymize(text:string,matches:ModerationMatch[]) {
 const ranges:ModerationMatch[]=[];for(const m of [...matches].sort((a,b)=>a.start-b.start)){const previous=ranges.at(-1);if(previous&&m.start<previous.end)previous.end=Math.max(previous.end,m.end);else ranges.push({...m});}
 let result=text;for(const m of ranges.reverse())result=result.slice(0,m.start)+'[someone]'+result.slice(m.end);return result;
}
