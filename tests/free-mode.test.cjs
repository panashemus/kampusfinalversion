const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const root = join(__dirname, '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

test('untrusted SMS action cannot grant premium or paid access', () => {
  const api = read('app/api/kritic-audit/route.ts');
  assert.doesNotMatch(api, /auto_verify_sms|is_premium:\s*true|payment_ref_code:\s*'VERIFIED'/);
  assert.match(api, /reserve_kritic_request/);
});

test('client escrow confirmation and DPO callback are retired', () => {
  assert.match(read('app/api/notify-seller/route.ts'), /status:\s*410/);
  assert.match(read('supabase/functions/dpo-webhook/index.ts'), /status:\s*410/);
});

test('Kritic and student listings have no payment checkout', () => {
  assert.doesNotMatch(read('components/KampusKritic.tsx'), /handleUnlockUnlimited|Confirm P50 Payment|P50\/month|isLockedByPaywall/);
  assert.doesNotMatch(read('components/HustleHub.tsx'), /handleProceedToPayment|Escrow Checkout|Listing Fee|Proceed to Payment/);
  assert.match(read('components/HustleHub.tsx'), /onClick=\{handlePublishGig\}/);
  assert.match(read('components/HustleHub.tsx'), /Publish Listing for Free/);
});

test('paid UI components are not shipped, and moderated public posts remain available', () => {
  for (const name of ['PaymentModal', 'SubscriptionModal', 'EscrowVault']) {
    assert.equal(existsSync(join(root, `components/${name}.tsx`)), false);
  }
  assert.match(read('components/AdminDashboard.tsx'), /PublicReviewQueue/);
});

test('database migration blocks entitlements and new transactions', () => {
  const sql = read('supabase/migrations/20261105181102_free_mode_finance_pause.sql');
  assert.match(sql, /BEFORE UPDATE ON public\.profiles/);
  assert.match(sql, /BEFORE INSERT ON public\.%I/);
  assert.match(sql, /REVOKE INSERT, UPDATE, DELETE/);
  assert.match(sql, /hazards_insert_free/);
});
