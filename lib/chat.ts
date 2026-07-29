import { supabase } from './supabase';
import type { Conversation, Message } from './types';

// Service-role client used only inside edge-function calls is not needed here;
// the anon client is sufficient because RLS policies scope conversations to
// the authenticated participant.

export function participantKey(a: string, b: string): string {
  return [a, b].sort().join('::');
}

export async function getOrCreateConversation(
  myId: string,
  peerId: string,
  peerUsername: string
): Promise<Conversation | null> {
  // Look for an existing conversation between these two participants.
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .or(`participant_a.eq.${myId},participant_b.eq.${myId}`)
    .eq('participant_a', myId)
    .maybeSingle();

  // Broader search: either direction
  const { data: found } = await supabase
    .from('conversations')
    .select('*')
    .or(`and(participant_a.eq.${myId},participant_b.eq.${peerId}),and(participant_a.eq.${peerId},participant_b.eq.${myId})`)
    .maybeSingle();

  if (found) return found as Conversation;

  // Create a new conversation.
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      participant_a: myId,
      participant_b: peerId,
      peer_username: peerUsername,
    })
    .select()
    .maybeSingle();

  if (error || !data) return null;
  return data as Conversation;
}

export async function fetchConversations(myId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .or(`participant_a.eq.${myId},participant_b.eq.${myId}`)
    .order('last_message_at', { ascending: false, nullsFirst: false });
  if (error || !data) return [];
  return data as Conversation[];
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data as Message[];
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  text: string
): Promise<Message | null> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, text })
    .select()
    .maybeSingle();
  if (error || !data) return null;

  // Update the conversation preview.
  await supabase
    .from('conversations')
    .update({
      last_message: text,
      last_message_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  return data as Message;
}
