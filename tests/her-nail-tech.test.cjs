const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const store=fs.readFileSync('components/HerNailTechStorefront.tsx','utf8');
const route=fs.readFileSync('app/store/her-nail-tech/page.tsx','utf8');
const hub=fs.readFileSync('components/HustleHub.tsx','utf8');
const guest=fs.readFileSync('components/GuestPreview.tsx','utf8');
const radar=fs.readFileSync('components/RadarMap.tsx','utf8');
const member=fs.readFileSync('components/MemberApp.tsx','utf8');
const asset=fs.readFileSync('public/images/her-nail-tech/portfolio-refresh.svg','utf8');

test('studio storefront is reachable from member and guest Hustle Hub',()=>{
 assert.match(route,/HerNailTechStorefront/);
 assert.match(hub,/store\/her-nail-tech/);
 assert.match(guest,/store\/her-nail-tech/);
});

test('lookbook uses nine refreshed nail photos, without visible view counts',()=>{
 assert.equal((store.match(/\{name:'[^']+',tags:/g)||[]).length,9);
 assert.match(asset,/data:image\/webp;base64,UklGR/);
 assert.doesNotMatch(asset,/TikTok|Following|2,489|views/);
 assert.match(store,/300% 300%/);
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
