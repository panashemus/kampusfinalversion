const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const src = fs.readFileSync(path.resolve(__dirname, '../components/AuthScreen.tsx'), 'utf8');

test('unverified users can correct inaccessible university email without bypassing verification', () => {
  assert.match(src, /correctUnreachableEmail/);
  assert.match(src, /setSignup\(true\)/);
  assert.match(src, /setStep\('form'\)/);
  assert.match(src, /Wrong email or inbox not working\?/);
  assert.match(src, /A new address must be verified/);
  assert.match(src, /domains\.includes\(clean\.split\('@'\)\[1\]\)/);
  assert.match(src, /supabase\.auth\.verifyOtp/);
  assert.match(src, /if \(!profile\?\.email_verified \|\| !profile\?\.verified\)/);
});

test('email delivery language does not claim accepted mail has reached a university inbox', () => {
  assert.match(src, /Verification code requested/);
  assert.match(src, /Student mailboxes sometimes reject external messages/);
  assert.match(src, /contact university IT/);
  assert.doesNotMatch(src, /We sent a 6-digit verification code/);
});

test('resend remains rate limited and uses Supabase signed confirmation flow', () => {
  assert.match(src, /resendCooldown > 0 \|\| busy/);
  assert.match(src, /supabase\.auth\.resend\(\{ type: 'signup', email: pendingEmail \}\)/);
  assert.match(src, /setResendCooldown\(60\)/);
});
