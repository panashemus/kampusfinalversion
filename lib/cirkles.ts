export const CIRKLES=[
 {slug:'tezember',label:'TEZEmber Stories',short:'TEZEmber'},
 {slug:'confessions',label:'Confessions',short:'Confess'},
 {slug:'semester-wrap',label:'Semester Wrap-Up',short:'Wrap-Up'},
 {slug:'holiday-linkup',label:'Pre-Sem Linkups',short:'Linkups'},
 {slug:'unpopular-takes',label:'Unpopular Takes',short:'Takes'},
] as const;
export type CirkleSlug=typeof CIRKLES[number]['slug'];
export const CIRKLE_PROMPTS=[
 'Wildest semester story without dropping a single name...',
 'What is the TEZEmber move this December?',
 'One habit staying in 2026 before the new semester starts...',
 'Unpopular campus opinion nobody wants to admit...',
] as const;
export const CLASSIC_CATEGORIES=['Academic','Housing','Tech','General','Textbooks','Beauty'] as const;
export function cirkleLabel(slug:string){return CIRKLES.find(c=>c.slug===slug)?.label||'Cirkles';}
export function trendingScore(p:{upvotes:number;comments:{length:number};impact_score?:number;createdAt:string},now=Date.now()){
 const age=Math.max(0,(now-Date.parse(p.createdAt))/3600000);
 return (p.upvotes+p.comments.length*2+Math.min(25,p.impact_score||0)+1)/Math.pow(age+2,1.35);
}
