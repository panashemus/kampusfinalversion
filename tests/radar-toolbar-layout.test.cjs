const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const map = fs.readFileSync('components/RadarMap.tsx', 'utf8');
const social = fs.readFileSync('components/RadarSocial.tsx', 'utf8');
const member = fs.readFileSync('components/MemberApp.tsx', 'utf8');

test('SOS, report hazard and locate live in a single, aligned action rail', () => {
  assert.match(map, /role="group"\s+aria-label="Radar map actions"/);
  assert.match(map, /right-3 top-1\/2 z-\[1200\] flex -translate-y-1\/2 flex-col/);
  assert.match(map, /onClick=\{onRequestSOS\}/);
  assert.match(map, /onClick=\{onReportHazard\}/);
  assert.match(map, /onClick=\{locate\}/);
  assert.match(map, /aria-label="Campus SOS — request help"/);
  assert.match(map, /aria-label="Drop new hazard pin"/);
  assert.match(map, /aria-label="Center map on my location"/);
  assert.doesNotMatch(map, /bottom-48 right-4/);
  assert.doesNotMatch(member, /absolute top-\[270px\] right-4 z-\[1001\]/);
  assert.match(member, /onRequestSOS=\{\(\) => \{ setSosGeoStatus\('idle'\); setIsSosModalOpen\(true\); \}\}/);
  assert.match(member, /onReportHazard=\{\(\) => setIsReportModalOpen\(true\)\}/);
});

test('Campus focus is in the compact header flow, not a floating center-map pill', () => {
  assert.match(map, /campusFocus=\{nearbyCampus \?/);
  assert.match(social, /campusFocus && \(/);
  assert.match(social, /onClick=\{campusFocus.onFocus\}/);
  assert.match(social, /onClick=\{campusFocus.onClear\}/);
  assert.doesNotMatch(map, /top-\[245px\]|top-\[210px\]/);
});

test('Map actions do not auto-start sharing and retain the privacy and loading affordances', () => {
  assert.match(map, /locateRequested\s*\? <Loader2/);
  assert.match(map, /disabled=\{locateRequested\}/);
  assert.match(map, /onFocus: handleEnterCampusMode/);
  assert.match(map, /onClear: \(\) => setInCampusMode\(null\)/);
  assert.match(social, /const \[topCollapsed, setTopCollapsed\] = useState\(true\)/);
  assert.match(social, /const \[bottomCollapsed, setBottomCollapsed\] = useState\(true\)/);
});
