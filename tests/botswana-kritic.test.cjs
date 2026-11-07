const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText, filename);
};

const { classifyUniversity, isValidCourseForSchool } = require('../lib/utils.ts');
const { BQA_DEGREES_BY_SCHOOL } = require('../lib/bqa-degree-catalogue.ts');
const { buildBotswanaKriticInstruction } = require('../lib/botswana-kritic.ts');

test('BQA-curated degree names appear at each supported institution', () => {
  const expected = {
    UB: 'Bachelor of Science in Computer Science',
    'BAC / BSBS': 'Bachelor of Science in Business Intelligence and Data Analytics',
    BIUST: 'Bachelor of Science in Cyber Security and Digital Forensics',
    BOTHO: 'Bachelor of Commerce in Digital Marketing',
    BUAN: 'Bachelor of Science in Biodiversity and Conservation',
  };
  for (const [school, title] of Object.entries(expected)) {
    assert.ok(BQA_DEGREES_BY_SCHOOL[school].includes(title), title + ' missing');
  }
});
test('existing titles and BQA titles remain available', () => {
  const ub = classifyUniversity('student@ub.ac.bw');
  const bac = classifyUniversity('student@thuto.bac.ac.bw');
  assert.ok(ub.courses.includes('BSc Computer Science'));
  assert.ok(ub.courses.includes('Bachelor of Education in Art and Design'));
  assert.ok(bac.courses.includes('BSc (Hons) Business Intelligence and Data Analytics'));
  assert.ok(bac.courses.includes('Bachelor of Science in Business Intelligence and Data Analytics'));
  assert.equal(new Set(ub.courses).size, ub.courses.length);
});
test('custom programmes are allowed without false accreditation claims', () => {
  assert.equal(isValidCourseForSchool('Bachelor of Science in an Emerging Discipline'), true);
  assert.equal(isValidCourseForSchool('MSc in Applied Statistics'), true);
});
test('invalid custom programme names are rejected', () => {
  assert.equal(isValidCourseForSchool('  '), false);
  assert.equal(isValidCourseForSchool('x'), false);
  assert.equal(isValidCourseForSchool('x'.repeat(121)), false);
  assert.equal(isValidCourseForSchool('<script>alert(1)</script>'), false);
  assert.equal(isValidCourseForSchool('bad\nnewline'), false);
});
test('Kritic uses BQA principles without making a universal marking claim', () => {
  const prompt = buildBotswanaKriticInstruction({ institution: 'UB', programme: 'BSc Mathematics' });
  assert.match(prompt, /BQA Assessment Policy DNCQF\.POL04/);
  assert.match(prompt, /timely, specific, actionable and constructive/);
  assert.match(prompt, /does NOT publish a universal essay-scoring rubric/);
  assert.match(prompt, /actual marking rubric/);
  assert.match(prompt, /BQA Assessment Guidelines/);
  assert.match(prompt, /## Priority fixes/);
});
test('API retains authentication, quota and safe provider configuration', () => {
  const api = fs.readFileSync(path.resolve(__dirname, '../app/api/kritic-audit/route.ts'), 'utf8');
  assert.match(api, /requireUser\(req\)/);
  assert.match(api, /reserve_kritic_request/);
  assert.match(api, /buildBotswanaKriticInstruction/);
  assert.match(api, /KRITIC_MODEL/);
  assert.doesNotMatch(api, /auto_verify_sms|is_premium:\s*true/);
});
