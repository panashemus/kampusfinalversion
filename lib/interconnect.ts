/** Shared contracts. Eligibility explains UI; backend/RLS is the authority. */
export type Module = 'discover' | 'community' | 'hustle' | 'kritic' | 'chat' | 'radar' | 'escrow' | 'profile' | 'auth';
export type ContentType = 'academic-question' | 'discussion' | 'listing' | 'profile' | 'conversation' | 'announcement' | 'event' | 'resource';
export type Visibility = 'public' | 'campus' | 'private';
export type ContentRef = {id: string; type: ContentType; module: Module; visibility: Visibility; ownerId?: string; approved?: boolean; available: boolean; title?: string; category?: string; text?: string; institution?: string | null; createdAt?: string};
export type Destination = {module: Module; post?: string; listing?: string; peer?: string; source?: string; search?: string};
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const modules: Module[] = ['discover','community','hustle','kritic','chat','radar','escrow','profile','auth'];
export function parseDestination(hash: string): Destination {
 const [raw, query=''] = hash.replace(/^#/, '').split('?');
 const destinationModule = modules.includes(raw as Module) ? raw as Module : 'discover';
 const params = new URLSearchParams(query); const result: Destination = {module:destinationModule};
 for (const key of ['post','listing','peer','source'] as const) {const value=params.get(key);if(value && UUID.test(value))result[key]=value;}
 const search=params.get('search'); if(search)result.search=search.slice(0,100);
 return result;
}
export function destinationHash(destination: Destination): string {
 const params=new URLSearchParams();for(const [key,value] of Object.entries(destination))if(key!=='module' && value)params.set(key,value);
 return `#${destination.module}${params.size ? `?${params}` : ''}`;
}
export function safeReturnDestination(value: string | null): string {
 const dest=parseDestination(value || '#discover');return destinationHash(dest.module==='auth' ? {module:'discover'} : dest);
}
export type ActionId = 'explore-kritic' | 'message-seller' | 'message-profile' | 'find-listings' | 'save' | 'share';
type Viewer={id?: string;verified?: boolean};
type Action={id:ActionId;label:string;sources:ContentType[];destination:Module;authentication:'required'|'optional';permissions:string[];context:string[];route:(content:ContentRef)=>Destination;fallback:string;analyticsEvent:string};
export const ACTIONS: readonly Action[] = [
 {id:'explore-kritic',label:'Explore with Kritic',sources:['academic-question'],destination:'kritic',authentication:'required',permissions:['source:read'],context:['source id only; re-fetch permitted text'],route:c=>({module:'kritic',source:c.id}),fallback:'This discussion is no longer available.',analyticsEvent:'interconnect.kritic.open'},
 {id:'message-seller',label:'Message seller',sources:['listing'],destination:'chat',authentication:'required',permissions:['verified','recipient:consent','not-blocked','listing:active'],context:['listing id','seller id'],route:c=>({module:'chat',listing:c.id,peer:c.ownerId}),fallback:'This seller or listing is unavailable.',analyticsEvent:'interconnect.seller.open'},
 {id:'message-profile',label:'Message student',sources:['profile'],destination:'chat',authentication:'required',permissions:['verified','recipient:consent','not-blocked'],context:['profile id'],route:c=>({module:'chat',peer:c.id}),fallback:'Messaging is unavailable for this account.',analyticsEvent:'interconnect.profile.open'},
 {id:'find-listings',label:'Find related listings',sources:['academic-question','discussion'],destination:'hustle',authentication:'optional',permissions:['source:read'],context:['explicit search terms'],route:c=>({module:'hustle',search:matchingTerms(c.text || '')}),fallback:'No matching active listings yet.',analyticsEvent:'interconnect.listings.search'},
 {id:'save',label:'Save',sources:['academic-question','discussion','listing'],destination:'profile',authentication:'required',permissions:['source:read','saved:own'],context:['type','source id'],route:c=>canonicalDestination(c),fallback:'This item could not be saved.',analyticsEvent:'interconnect.saved'},
 {id:'share',label:'Copy public link',sources:['academic-question','discussion','listing'],destination:'community',authentication:'optional',permissions:['explicit-public','approved'],context:['canonical URL only'],route:c=>canonicalDestination(c),fallback:'Only approved public content can be shared.',analyticsEvent:'interconnect.shared'},
];
export function canonicalDestination(c: ContentRef): Destination {return c.type==='listing' ? {module:'hustle',listing:c.id} : c.type==='profile' ? {module:'profile',peer:c.id} : {module:'community',post:c.id};}
export function matchingTerms(text: string): string {
 const ignored=new Set(['where','can','buy','find','need','looking','does','anyone','have','with','this','that','from','please','textbook','textbooks','book','books','want']);
 return text.toLowerCase().match(/[a-z0-9]{3,}/g)?.filter(x=>!ignored.has(x)).slice(0,5).join(' ') || 'textbook';
}
export function actionEligibility(action: Action,c: ContentRef,v: Viewer): 'available'|'sign-in'|'unavailable' {
 if(!UUID.test(c.id)||!c.available||!action.sources.includes(c.type))return 'unavailable';
 if(action.id==='share'&&(c.visibility!=='public'||!c.approved))return 'unavailable';
 if(action.id==='find-listings'&&!['Textbooks','Tech','Beauty'].includes(c.category||''))return 'unavailable';
 if(action.id==='message-seller'&&(!c.ownerId||c.ownerId===v.id))return 'unavailable';
 if(action.id==='message-profile'&&c.id===v.id)return 'unavailable';
 if(action.authentication==='required'&&!v.id)return 'sign-in';return 'available';
}
