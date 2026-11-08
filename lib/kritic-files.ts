/**
 * Send large private coursework through Gemini Files API, not JSON inline blobs.
 * Gemini stores uploads temporarily; delete them after generating a response.
 * No student content, file links, or credentials should enter application logs.
 */
export async function uploadPrivateKriticFile(
  apiKey: string,
  bytes: Buffer,
  mimeType: string,
  fetcher: typeof fetch = fetch,
): Promise<{ fileUri: string; name: string }> {
  const base = 'https://generativelanguage.googleapis.com';
  const start = await fetcher(base + '/upload/v1beta/files', {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes.length),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: 'Kampus Kritic coursework' } }),
    signal: AbortSignal.timeout(12000),
  });
  const uploadUrl = start.headers.get('x-goog-upload-url');
  if (!start.ok || !uploadUrl || !uploadUrl.startsWith(base + '/upload/')) {
    throw new Error('Gemini file upload could not be started.');
  }

  const finished = await fetcher(uploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
      'Content-Type': mimeType,
    },
    body: new Uint8Array(bytes),
    signal: AbortSignal.timeout(20000),
  });
  if (!finished.ok) throw new Error('Gemini file upload could not be finalized.');

  const data = await finished.json() as { file?: { uri?: string; name?: string; state?: string } };
  let file = data.file;
  if (!file?.uri || !file?.name || !/^files\/[a-zA-Z0-9_-]+$/.test(file.name)) {
    throw new Error('Gemini returned an invalid file reference.');
  }
  if (file.state === 'FAILED') throw new Error('Gemini could not process this attachment.');
  for (let tries = 0; file.state === 'PROCESSING' && tries < 5; tries++) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    const response = await fetcher(base + '/v1beta/' + file.name, {
      headers: { 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error('Gemini file processing status unavailable.');
    file = await response.json() as { uri?: string; name?: string; state?: string };
    if (file.state === 'FAILED') throw new Error('Gemini could not process this attachment.');
  }
  if (file.state === 'PROCESSING' || !file.uri) throw new Error('Gemini attachment processing timed out.');
  return { fileUri: file.uri, name: file.name! };
}

export async function deletePrivateKriticFiles(apiKey: string, names: string[]): Promise<void> {
  await Promise.all(names.map(async name => {
    try {
      if (!/^files\/[a-zA-Z0-9_-]+$/.test(name)) return;
      await fetch('https://generativelanguage.googleapis.com/v1beta/' + name, {
        method: 'DELETE', headers: { 'x-goog-api-key': apiKey },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      console.error('[Kritic attachment] Provider file cleanup failed.');
    }
  }));
}
