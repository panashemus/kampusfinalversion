const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = name => fs.readFileSync(path.resolve(__dirname, '..', name), 'utf8');
const migration = read('supabase/migrations/20261119163000_add_boitekanelo_student_domain.sql');

test('Boitekanelo is accepted in signup and the exact server-side domain allowlist', () => {
  assert.match(read('components/AuthScreen.tsx'), /'student\.boitekanelo\.ac\.bw'/);
  assert.match(migration, /'student\.boitekanelo\.ac\.bw'/);
  assert.doesNotMatch(migration, /'%?\.boitekanelo\.ac\.bw'/);
  assert.match(migration, /email_confirmed_at IS NOT NULL/);
});

test('Boitekanelo has its own university and course mapping, never defaulting to UB', () => {
  const utils = read('lib/utils.ts');
  assert.match(utils, /code: 'BOITEKANELO'/);
  assert.match(utils, /fullName: 'Boitekanelo College'/);
  assert.match(utils, /Bachelor of Science \(Honours\) in Nursing/);
  assert.match(read('lib/bqa-degree-catalogue.ts'), /BOITEKANELO: \[\]/);
  assert.match(read('components/GuestPreview.tsx'), /Boitekanelo College/);
});

test('Kampus page logo retains the gold tree without an opaque background layer', () => {
  const logo = read('components/KampusLogo.tsx');
  assert.match(logo, /<svg/);
  assert.match(logo, /<feColorMatrix/);
  assert.match(logo, /10 -10 0 0 0/);
  assert.match(logo, /ClipSnap_20260723201232\.png/);
  assert.doesNotMatch(logo, /<rect/);
});
