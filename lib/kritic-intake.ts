/** Shared client/server validation: reject empty or token-wasting Kritic prompts. */
export type KriticMode = 'exam_rescue' | 'coursework_review';
export type KriticFileKind = 'graded_work' | 'lecture_material' | 'other';
export const KRITIC_MIN_CHARS = 18;
export const KRITIC_MAX_FILES = 4;
export const KRITIC_MAX_TOTAL_BYTES = 25 * 1024 * 1024;
export const KRITIC_QUICK_INTENTS = [
  'evaluate', 'evaluate my work', 'check my work', 'review my work',
  'assess my work', 'analyse my work', 'analyze my work', 'check this',
  'review this', 'check my assignment', 'review my test',
  'help me pass', 'help me revise', 'help me study',
  'exam rescue', 'revise', 'revision plan', 'make a revision plan',
  'quiz me', 'test me', 'mock exam', 'practice questions',
  'explain this', 'explain my mistakes', 'find my mistakes',
] as const;
const intents = new Set<string>(KRITIC_QUICK_INTENTS);
const needsEvidence = new Set<string>([
  'evaluate','evaluate my work','check my work','review my work',
  'assess my work','analyse my work','analyze my work','check this',
  'review this','check my assignment','review my test','explain this',
  'explain my mistakes','find my mistakes',
]);
const greetings = /^(?:hi|hey|hello|yo|sup|dumela(?:ng)?|ey(?:\s+monna)?|sharp|howzit|o\s+kae)[!.?,\s]*$/i;
const placeholders = /^(?:unknown|none|other|not sure|not specified|select|course|student|tbd|n\/a|na|general|undecided|university)$/i;
export function isValidKriticCourse(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 3 &&
    value.trim().length <= 120 && !/[<>\x00-\x1f]/.test(value) &&
    !placeholders.test(value.trim()) && new Set((value.match(/[a-z]/gi) || []).map(c => c.toLowerCase())).size >= 2;
}
export function validateKriticPrompt(prompt: string, hasEvidence: boolean, hasTopic = false): string | null {
  const t = prompt.trim();
  if (!t) return hasEvidence ? null : 'Add your question or attach previous work or lecture material.';
  if (greetings.test(t)) return 'Kritic is for academic help. Try “help me pass”, “quiz me”, or attach your work and say “evaluate”.';
  const normalized = t.toLowerCase().replace(/[!?.:,;]+$/g, '').replace(/\s+/g,' ').trim();
  if (intents.has(normalized)) {
    if (needsEvidence.has(normalized) && !hasEvidence) return 'Attach the work you want evaluated, or describe your academic problem in more detail.';
    if (['quiz me','test me','mock exam','practice questions'].includes(normalized) && !hasEvidence && !hasTopic)
      return 'Add a module or topic, or upload notes, so your practice questions have a subject.';
    return null;
  }
  if (t.length < KRITIC_MIN_CHARS)
    return 'Write at least ' + KRITIC_MIN_CHARS + ' characters, or choose a supported quick action such as “help me pass”.';
  if (!/[a-zA-Z]{2}/.test(t) || new Set((t.match(/[a-z]/gi) || []).map(c=>c.toLowerCase())).size < 3)
    return 'Please describe a real academic question instead of placeholder text.';
  return null;
}
