const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const kritic=fs.readFileSync('components/KampusKritic.tsx','utf8');
const exam=fs.readFileSync('components/KriticExamIntake.tsx','utf8');
const member=fs.readFileSync('components/MemberApp.tsx','utf8');

test('Kritic content, messages, and Exam Rescue intake share a single bounded scroll pane',()=>{
  assert.match(kritic,/flex-1 min-h-0 bg-midnight flex flex-col overflow-hidden relative/);
  assert.match(kritic,/ref=\{conversationScrollRef\}[^>]*flex-1 min-h-0 overflow-y-auto/);
  const scroller=kritic.indexOf('ref={conversationScrollRef}');
  const intake=kritic.indexOf('<KriticExamIntake ');
  const messages=kritic.indexOf('{messages.map((m) => {');
  const composer=kritic.indexOf('Bottom Chat, Image & PDF Composer');
  assert.ok(scroller>=0 && scroller<intake && intake<messages && messages<composer);
  assert.doesNotMatch(exam,/max-h-\[44dvh\]|overflow-y-auto/);
});

test('course and history controls cannot overlay the exam form',()=>{
  assert.ok(kritic.indexOf('Course and conversation controls stay')<kritic.indexOf('ref={conversationScrollRef}'));
  assert.match(kritic,/Course and conversation controls stay in their own row/);
});

test('full-height Kritic view avoids competing outer page scrolling',()=>{
  assert.match(member,/flex-1 min-h-0 relative flex flex-col pb-28/);
  assert.match(member,/activeView === 'kritic' \? 'overflow-hidden'/);
  assert.match(member,/px-4 shrink-0"><PushNotificationBanner/);
  assert.match(kritic,/Composer stays outside the scrolling pane/);
});

test('opening a conversation never auto-scrolls away from Exam Rescue upload controls',()=>{
  assert.match(kritic,/followNewMessagesRef\.current/);
  assert.match(kritic,/conversationScrollRef\.current/);
  assert.doesNotMatch(kritic,/bottomRef\.current\?\.scrollIntoView/);
});
