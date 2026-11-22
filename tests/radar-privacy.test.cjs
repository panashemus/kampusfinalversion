const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {filterRadarShares, trackForegroundLocation, RADAR_JOIN_DRAFT} = require('../lib/radar-privacy.ts');

test('Join me excludes non-invitations without modifying the source shares', () => {
  const shares = [{user_id:'a',company_welcome:true},{user_id:'b',company_welcome:false}];
  assert.deepEqual(filterRadarShares(shares,'welcome').map(s=>s.user_id),['a']);
  assert.deepEqual(filterRadarShares(shares,'all').map(s=>s.user_id),['a','b']);
  assert.equal(shares.length,2);
});

function fixture(hidden=false) {
  const page = new EventTarget(); page.hidden = hidden;
  const callbacks = [], cleared=[], ticks=new Map(); let timer=0;
  const geo = { watchPosition(success,error) { callbacks.push({success,error}); return callbacks.length; },clearWatch(id){cleared.push(id);},getCurrentPosition(success){success({timestamp:Date.now()});} };
  const timers = {setInterval(fn){ticks.set(++timer,fn);return timer;},clearInterval(id){ticks.delete(id);}};
  const positions=[], errors=[];
  const dispose=trackForegroundLocation(geo,page,p=>positions.push(p),e=>errors.push(e),timers);
  const visibility=hidden=>{page.hidden=hidden;page.dispatchEvent(new Event('visibilitychange'));};
  return {callbacks,cleared,ticks,positions,errors,dispose,visibility};
}
test('foreground tracking clears the sensor and heartbeat on hide; stale callbacks stay rejected after return',()=>{
  const f=fixture(); assert.equal(f.callbacks.length,1);assert.equal(f.ticks.size,1);
  f.callbacks[0].success({timestamp:1});assert.equal(f.positions.length,1);
  f.visibility(true);assert.deepEqual(f.cleared,[1]);assert.equal(f.ticks.size,0);
  f.callbacks[0].success({timestamp:2});assert.equal(f.positions.length,1);
  f.visibility(false);assert.equal(f.callbacks.length,2);
  f.callbacks[0].success({timestamp:3});f.callbacks[0].error({code:1});
  assert.equal(f.positions.length,1);assert.equal(f.errors.length,0);
  f.callbacks[1].success({timestamp:4});assert.equal(f.positions.length,2);
  [...f.ticks.values()][0]();assert.equal(f.positions.length,3);
  f.dispose();assert.deepEqual(f.cleared,[1,2]);assert.equal(f.ticks.size,0);
  f.callbacks[1].success({timestamp:5});f.visibility(false);
  assert.equal(f.positions.length,3);assert.equal(f.callbacks.length,2);
});
test('mounting hidden never requests location, and permission errors remain recoverable',()=>{
  const f=fixture(true);assert.equal(f.callbacks.length,0);
  f.visibility(false);f.callbacks[0].error({code:1});assert.equal(f.errors.length,1);
  f.visibility(true);f.visibility(false);f.callbacks[1].success({timestamp:1});
  assert.equal(f.positions.length,1);f.dispose();
});
test('join-request draft contains no coordinates and does not imply acceptance',()=>{
  assert.match(RADAR_JOIN_DRAFT,/room to join/);assert.doesNotMatch(RADAR_JOIN_DRAFT,/\d|accepted|confirmed/i);
});
