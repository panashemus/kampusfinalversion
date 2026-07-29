/*
# Kampus — email verification + chat infrastructure

## Purpose
Adds email-verification gating and a real chat/messaging backend so
students can message each other from gigs and profiles.

## Changes

### 1. profiles (modified)
- New column `email_verified` (boolean, NOT NULL, default false).
  This is the flag the feature-gate checks before allowing messages,
  gig listings, or escrow initialization. It is separate from the
  existing `verified` flag (institutional auto-verify) so the two
  concepts do not collide.

### 2. conversations (new table)
- `id` (uuid, primary key)
- `participant_a` (text, not null) — a user id (as text) OR a mock
  username such as "@ub_hustler". Text is used so the chat works
  between real authenticated users and the demo mock sellers alike.
- `participant_b` (text, not null) — the other participant.
- `peer_username` (text) — display name of the counterpart, used to
  render the inbox list without an extra join.
- `last_message` (text) — preview of the most recent message.
- `last_message_at` (timestamptz) — for ordering the inbox.
- `created_at` (timestamptz, default now())

### 3. messages (new table)
- `id` (uuid, primary key)
- `conversation_id` (uuid, references conversations, cascade delete)
- `sender_id` (text, not null) — the author's id (as text)
- `text` (text, not null)
- `created_at` (timestamptz, default now())

## Security (RLS)
- RLS enabled on `conversations` and `messages`.
- `conversations`: SELECT / INSERT / UPDATE restricted to rows where
  the authenticated user's id (cast to text) equals participant_a or
  participant_b.
- `messages`: SELECT allowed when the caller is a participant of the
  parent conversation; INSERT allowed when sender_id is the caller AND
  the caller is a participant of the parent conversation.
- No DELETE policies (messages are immutable history).

## Notes
- Idempotent: uses IF NOT EXISTS and DROP POLICY IF EXISTS.
- Safe to re-apply.
*/

-- ---------- profiles: email_verified ----------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

-- ---------- conversations ----------
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_a text NOT NULL,
  participant_b text NOT NULL,
  peer_username text,
  last_message text,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_select_own" ON conversations;
CREATE POLICY "conversations_select_own" ON conversations FOR SELECT
  TO authenticated USING (auth.uid()::text = participant_a OR auth.uid()::text = participant_b);

DROP POLICY IF EXISTS "conversations_insert_own" ON conversations;
CREATE POLICY "conversations_insert_own" ON conversations FOR INSERT
  TO authenticated WITH CHECK (auth.uid()::text = participant_a OR auth.uid()::text = participant_b);

DROP POLICY IF EXISTS "conversations_update_own" ON conversations;
CREATE POLICY "conversations_update_own" ON conversations FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = participant_a OR auth.uid()::text = participant_b)
  WITH CHECK (auth.uid()::text = participant_a OR auth.uid()::text = participant_b);

CREATE INDEX IF NOT EXISTS idx_conversations_participants
  ON conversations (participant_a, participant_b);

-- ---------- messages ----------
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id text NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_own" ON messages;
CREATE POLICY "messages_select_own" ON messages FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participant_a = auth.uid()::text OR c.participant_b = auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "messages_insert_own" ON messages;
CREATE POLICY "messages_insert_own" ON messages FOR INSERT
  TO authenticated WITH CHECK (
    sender_id = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participant_a = auth.uid()::text OR c.participant_b = auth.uid()::text)
    )
  );

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages (conversation_id, created_at);
