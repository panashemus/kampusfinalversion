/** Provider failover for KAMPUS Kritic. No secrets or user content in logs. */
export type GeminiContent = {
  role: 'user' | 'model';
  parts: Array<Record<string, unknown>>;
};
export type KriticGeneration = {
  reply: string;
  model: string;
  fallbackUsed: boolean;
};
type GeminiResponse = {
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
  }>;
};
export type KriticGenerationOptions = {
  apiKey: string;
  primaryModel: string;
  systemInstruction: string;
  contents: GeminiContent[];
  greeting?: boolean;
  fetcher?: typeof fetch;
  logger?: (event: string, model: string, reason: string) => void;
};

export function isKriticGreeting(text: string): boolean {
  return /^(?:ey(?:\s+monna)?|dumela(?:ng)?|hello|hi|hey|yo|sup|sharp|howzit|o\s+kae)[!?.\s]*$/i.test(text.trim());
}

/**
 * One attempt on the configured quality model followed by one fast provider fallback.
 * Both use the same official Google API, with independent request deadlines.
 */
export async function generateKriticReply({
  apiKey, primaryModel, systemInstruction, contents,
  greeting = false, fetcher = fetch, logger = () => {},
}: KriticGenerationOptions): Promise<KriticGeneration> {
  const fallbackModel = 'gemini-3.5-flash-lite';
  const models = [primaryModel, fallbackModel].filter((model, index, all) => all.indexOf(model) === index);
  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];
    if (!/^gemini-[a-z0-9.-]+$/.test(model)) continue;
    const isFallback = index > 0;
    const timeoutMs = isFallback ? (greeting ? 9500 : 14000) : (greeting ? 11000 : 23000);
    const thinkingLevel = greeting ? 'low' : isFallback ? 'low' : 'medium';
    const maxOutputTokens = greeting ? 512 : isFallback ? 6144 : 8192;
    try {
      const response = await fetcher(
        'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents,
            generationConfig: {
              maxOutputTokens,
              thinkingConfig: { thinkingLevel },
            },
          }),
        },
      );
      if (!response.ok) {
        logger('provider_rejected', model, String(response.status));
        continue;
      }
      const result = await response.json() as GeminiResponse;
      const reply = result.candidates?.[0]?.content?.parts
        ?.filter((part): part is { text: string; thought?: boolean } =>
          typeof part.text === 'string' && part.thought !== true)
        .map(part => part.text)
        .join('\n')
        .trim() || '';
      if (!reply) {
        logger('provider_empty', model, result.candidates?.[0]?.finishReason || 'unknown');
        continue;
      }
      return { reply, model, fallbackUsed: isFallback };
    } catch (error) {
      logger('provider_transport', model, error instanceof Error ? error.name : 'unknown');
    }
  }
  throw new Error('All configured academic AI providers failed.');
}
