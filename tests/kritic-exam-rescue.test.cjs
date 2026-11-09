const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(module,filename)=>{
  const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
    fileName:filename
  });
  module._compile(compiled.outputText,filename);
};
const {validateKriticPrompt,isValidKriticCourse,KRITIC_MAX_FILES}=require('../lib/kritic-intake.ts');
const {validateKriticInput}=require('../lib/kritic-validation.ts');
const route=fs.readFileSync('app/api/kritic-audit/route.ts','utf8');
const member=fs.readFileSync('components/MemberApp.tsx','utf8');
const course=fs.readFileSync('components/KriticCourseGate.tsx','utf8');
const kritic=fs.readFileSync('components/KampusKritic.tsx','utf8');
const intake=fs.readFileSync('components/KriticExamIntake.tsx','utf8');
const prompt=fs.readFileSync('lib/botswana-kritic.ts','utf8');
const validPath='12345678-1234-4234-8234-123456789012/12345678-1234-4234-8234-123456789012.pdf';

test('greetings, empty text and slop are blocked before Gemini quotas',()=>{
  assert.match(validateKriticPrompt('hi',false),/Kritic is for academic help/);
  assert.match(validateKriticPrompt('ey monna',true),/Kritic is for academic help/);
  assert.match(validateKriticPrompt('hello!',true),/Kritic is for academic help/);
  assert.match(validateKriticPrompt('abcd',false),/18 characters/);
  assert.match(validateKriticPrompt('aaaaaaaaaaaaaaaaaaaaaaaa',false),/placeholder/);
  assert.equal(validateKriticPrompt('help me pass',false),null);
  assert.equal(validateKriticPrompt('evaluate',true),null);
  assert.match(validateKriticPrompt('evaluate',false),/Attach the work/);
  assert.match(validateKriticPrompt('quiz me',false),/module or topic/);
  assert.equal(validateKriticPrompt('quiz me',false,true),null);
  assert.equal(validateKriticPrompt('',true),null);
});
test('course gate rejects obvious placeholders, accepts selected courses and honest manual titles',()=>{
  for(const c of ['', 'other','not specified','n/a','hi','AAAAAAAAAAA']) assert.equal(isValidKriticCourse(c),false,c);
  assert.equal(isValidKriticCourse('Bachelor of Science in Computer Science'),true);
  assert.equal(isValidKriticCourse('LLB'),true);
  assert.equal(isValidKriticCourse('Diploma in Business Administration'),true);
});
test('exam intake preserves roles, validates optional date, and enforces four attachments',()=>{
  assert.equal(KRITIC_MAX_FILES,4);
  const params={mode:'exam_rescue',promptText:'evaluate',filePaths:[validPath,validPath],fileKinds:['graded_work','lecture_material'],images:[],history:[],examTopic:'Statistics',examDate:'2026-11-18'};
  const parsed=validateKriticInput(params);
  assert.equal(parsed.mode,'exam_rescue');
  assert.deepEqual(parsed.fileKinds,['graded_work','lecture_material']);
  assert.equal(parsed.examTopic,'Statistics');
  assert.throws(()=>validateKriticInput({...params,fileKinds:['graded_work']}),/Tell Kritic/);
  assert.throws(()=>validateKriticInput({...params,filePaths:[validPath,validPath,validPath,validPath,validPath]}),/no more than four/);
  assert.throws(()=>validateKriticInput({...params,examDate:'18 November'}),/Invalid exam date/);
  assert.throws(()=>validateKriticInput({...params,promptText:'hi'}),/Kritic is for academic help/);
});
test('server checks verified student and course before reserving or uploading',()=>{
  const courseIndex=route.indexOf('if (!isValidKriticCourse(profile.course_code))');
  const uploadIndex=route.indexOf('admin.storage.from');
  const reserveIndex=route.indexOf("rpc('reserve_kritic_request')");
  assert.ok(courseIndex>0 && courseIndex<uploadIndex && courseIndex<reserveIndex);
  assert.match(route,/buildExamRescueInstruction/);
  assert.match(route,/kindLabel\(file.kind\)/);
  assert.match(route,/totalAttachmentBytes > KRITIC_MAX_TOTAL_BYTES/);
  assert.match(route,/greeting: false/);
});
test('every member without course sees course prompt, and Kritic stays locked',()=>{
  assert.match(member,/coursePromptOpen/);
  assert.match(member,/KriticCourseGate/);
  assert.match(member,/activeView === 'kritic' && profile && !isValidKriticCourse/);
  assert.match(member,/activeView === 'kritic' && profile && isValidKriticCourse/);
  assert.match(course,/\.update\(\{course_code: choice/);
  assert.match(course,/if \(updateError \|\| !data/);
});
test('exam interface prompts for separate graded work and lecture material',()=>{
  assert.match(intake,/Past marked work/);
  assert.match(intake,/Lecture material/);
  assert.match(intake,/onFiles\(Array.from\(e.target.files\),'graded_work'\)/);
  assert.match(intake,/onFiles\(Array.from\(e.target.files\),'lecture_material'\)/);
  assert.match(kritic,/fileKinds:attachedKinds/);
  assert.match(kritic,/validateKriticPrompt\(/);
  assert.match(intake,/No pass|No exam|guarantee/i);
});
test('exam model guidance separates observed and inferred weaknesses and avoids grade predictions',()=>{
  assert.match(prompt,/CONFIRMED/);
  assert.match(prompt,/INFERRED/);
  assert.match(prompt,/UNKNOWN/);
  assert.match(prompt,/never predict|Never invent a grade/i);
  assert.match(prompt,/Practice exam/);
  assert.match(prompt,/revision timetable/i);
  assert.match(prompt,/performance is not guaranteed/);
});
