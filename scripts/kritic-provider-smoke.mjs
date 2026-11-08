/**
 * One-time deployment-time, user-authorized provider diagnostic.
 * Does not log or transmit credentials beyond Google's official API.
 * This is not a replacement for authenticated end-to-end testing.
 */
const key = process.env.GEMINI_API_KEY;
const model = process.env.KRITIC_MODEL;
if (!key || !model) {
  console.error('[Kritic smoke] Missing configured model/API key (names only).');
  process.exit(1);
}
let response;
try {
  response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(model) + ':generateContent', {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'x-goog-api-key': key },
    signal: AbortSignal.timeout(23000),
    body: JSON.stringify({
      contents: [{ role:'user', parts:[{text:'ey monna'}] }],
      systemInstruction: { parts: [{text:'You are a helpful Botswana university academic coach. Reply briefly and naturally to a greeting.'}]},
      generationConfig: { maxOutputTokens:256, thinkingConfig:{thinkingLevel:'low'} },
    }),
  });
} catch(error) {
  console.error('[Kritic smoke] Provider transport error:', error?.name || 'unknown');
  process.exit(1);
}
if (!response.ok) {
  let code = 'unknown';
  try { const body=await response.json();code=String(body?.error?.status || 'unknown'); } catch {}
  console.error('[Kritic smoke] Provider rejected request. HTTP '+response.status+', status '+code+', model '+model);
  process.exit(1);
}
const body = await response.json();
const reply = body?.candidates?.[0]?.content?.parts?.filter(x=>typeof x.text==='string'&&!x.thought).map(x=>x.text).join(' ').trim();
if (!reply) { console.error('[Kritic smoke] Provider returned success without visible reply. Finish reason '+String(body?.candidates?.[0]?.finishReason));process.exit(1); }
console.log('[Kritic smoke] Provider responded successfully with visible text; model '+model+'.');
