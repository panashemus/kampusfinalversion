const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const store=fs.readFileSync('components/HerNailTechStorefront.tsx','utf8');
const route=fs.readFileSync('app/store/her-nail-tech/page.tsx','utf8');
const hub=fs.readFileSync('components/HustleHub.tsx','utf8');
const guest=fs.readFileSync('components/GuestPreview.tsx','utf8');
const radar=fs.readFileSync('components/RadarMap.tsx','utf8');
const member=fs.readFileSync('components/MemberApp.tsx','utf8');
const shell=fs.readFileSync('app/layout.tsx','utf8');
const assets=Array.from({length:9},(_,i)=>fs.readFileSync(`public/images/her-nail-tech/studio-${String(i+1).padStart(2,'0')}.svg`,'utf8'));

test('studio storefront is reachable from member and guest Hustle Hub',()=>{
 assert.match(route,/HerNailTechStorefront/);
 assert.match(hub,/store\/her-nail-tech/);
 assert.match(guest,/store\/her-nail-tech/);
});

test('lookbook uses nine independent, high-resolution supplied nail photos',()=>{
 assert.equal((store.match(/\{name:'[^']+',tags:/g)||[]).length,9);
 assert.equal(assets.length,9);
 for(const asset of assets){
  assert.match(asset,/data:image\/webp;base64,UklGR/);
  assert.ok(asset.length>30000,'Full-resolution photo should not be a tiny contact-sheet crop');
  assert.doesNotMatch(asset,/TikTok|Following|2,489|views/);
 }
 assert.match(store,/studio-["']\+number\+["']\.svg/);
 assert.doesNotMatch(store,/lookbook\.svg|portfolio-refresh\.svg/);
 assert.match(hub,/studio-01\.svg/);
 assert.match(guest,/studio-01\.svg/);
});

test('mobile storefront scrolls inside the fixed-height Kampus application shell',()=>{
 assert.match(shell,/h-\[100dvh\].*overflow-hidden/);
 assert.match(store,/h-\[100dvh\].*overflow-x-hidden overflow-y-auto overscroll-y-contain/);
 assert.match(store,/lg:grid-cols-\[minmax\(0,1\.08fr\)_minmax\(0,\.92fr\)\]/);
 assert.match(store,/overflow-x-auto overscroll-x-contain/);
 assert.match(store,/pb-\[calc\(110px\+env\(safe-area-inset-bottom\)\)\]/);
});

test('booking never requests payment before confirmation and routes directly to technician',()=>{
 assert.match(store,/PHONE='26778348637'/);
 assert.match(store,/wa\.me\//);
 assert.match(store,/Wait for availability confirmation/);
 assert.match(store,/P30 non-refundable deposit/);
 assert.match(store,/73108066/);
 assert.match(store,/No walk-ins/);
 assert.match(store,/required checked=\{accepted\}/);
 assert.doesNotMatch(store,/\b(createPayment|initiateEscrow|chargeCard|checkoutSession)\b/);
});

test('location is navigable within Radar and always described as approximate',()=>{
 assert.match(store,/#radar\?search=Tlokweng%2C%20Metlhabeng/);
 assert.match(member,/focusPlace=\{destination.search\}/);
 assert.match(radar,/RequestedPlaceFocus/);
 assert.match(member,/not the studio.s exact address/);
});

test('gallery filters, lightbox escape, save and share are interactive',()=>{
 assert.match(store,/setFilter/);
 assert.match(store,/setSelected/);
 assert.match(store,/e.key==='Escape'/);
 assert.match(store,/localStorage.setItem/);
 assert.match(store,/navigator.share/);
});
