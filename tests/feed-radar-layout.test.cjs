const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const feed = fs.readFileSync('components/CommunityHub.tsx', 'utf8');
const social = fs.readFileSync('components/RadarSocial.tsx', 'utf8');
const app = fs.readFileSync('components/MemberApp.tsx', 'utf8');

test('Feed defaults to true newest-first without silently pushing an older campus post above a newer one', () => {
  assert.match(feed, /\.order\('created_at',\s*\{ascending:false\}\)/);
  assert.match(feed, /const visible = posts\.filter\(\(p\) =>/);
  assert.doesNotMatch(feed, /\[\.\.\.posts\]\.sort\(/);
  assert.match(feed, /if\(requestId !== latestFeedRequestRef\.current\) return/);
});

test('Radar controls can be expanded and minimized while preserving manual share, stop, and privacy status', () => {
  assert.match(social, /const \[topCollapsed, setTopCollapsed\] = useState\(true\)/);
  assert.match(social, /const \[bottomCollapsed, setBottomCollapsed\] = useState\(true\)/);
  assert.match(social, /setTopCollapsed\(value => !value\)/);
  assert.match(social, /setBottomCollapsed\(value => !value\)/);
  assert.match(social, /aria-expanded=\{!topCollapsed\}/);
  assert.match(social, /aria-expanded=\{!bottomCollapsed\}/);
  assert.match(social, /onClick=\{openShare\}/);
  assert.match(social, /radar\.stop/);
  assert.match(social, /onClick=\{\(\) => \{ setTab\("welcome"\); setBottomCollapsed\(false\); \}\}/);
});

test('Radar map is bounded above both the legal footer and mobile bottom navigation', () => {
  assert.match(app, /activeView === 'radar' \? 'overflow-hidden pb-0'/);
  assert.match(app, /bottom-\[calc\(100px\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(app, /<BottomNav active=\{activeView\}/);
  assert.match(app, /<footer className="absolute bottom-/);
});
