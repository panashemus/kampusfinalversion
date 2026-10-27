import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { classifyUniversity } from '@/lib/utils';

const PREFERRED_MODELS = [
  'models/gemini-3.8-flash',
  'models/gemini-3.6-flash',
  'models/gemini-3.5-flash-lite',
  'models/gemini-4-argon',
];

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      promptText = '',
      images = [],
      history = [],
      email = '',
      username = 'Student',
      university = '',
      courseCode = '',
    } = body;

    const schoolInfo = classifyUniversity(email || university);
    const activeSchool = schoolInfo.fullName;
    const activeCourse = (courseCode || '').trim() || 'General Coursework';

    // 1. Check for verified benchmark papers in Supabase
    let verifiedBenchmarks: any[] = [];
    try {
      const { data } = await supabase
        .from('academic_contributors')
        .select('course_code, grade_achieved, sample_title, methodology_notes, institution')
        .eq('verified', true)
        .ilike('course_code', `%${activeCourse}%`)
        .limit(2);

      if (data && data.length > 0) {
        verifiedBenchmarks = data;
      }
    } catch {
      verifiedBenchmarks = [];
    }

    const hasBenchmarks = verifiedBenchmarks.length > 0;
    const benchmarkStatusLabel = hasBenchmarks
      ? `Verified ${schoolInfo.code} Benchmark (${verifiedBenchmarks[0].course_code} - ${verifiedBenchmarks[0].grade_achieved})`
      : `${schoolInfo.code} Academic Engine (${activeCourse})`;

    // 2. Read GEMINI_API_KEY from environment variables
    const apiKey = (
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      ''
    ).trim();

    if (!apiKey) {
      return NextResponse.json({
        reply:
          'Configuration Error: GEMINI_API_KEY is not set in Vercel Environment Variables.',
        benchmark_used: benchmarkStatusLabel,
        is_preview: true,
      });
    }

    const systemInstruction = `You are Kampus Kritic (powered by Argon), the conversational academic assistant and pre-flight assignment auditor for ${activeSchool}.
You are chatting with ${username}, a verified student enrolled in "${activeCourse}" at ${schoolInfo.code}.

${
  hasBenchmarks
    ? `Verified distinction benchmark notes for ${activeCourse}:\n${verifiedBenchmarks[0].methodology_notes}`
    : `(Note: The past-student benchmark archive for ${activeCourse} is still being populated. Provide rigorous, standard ${schoolInfo.code} academic guidance, Harvard/APA citation checks, and coursework support.)`
}

Rules:
1. Never use emojis.
2. Be an authentic, sharp academic collaborator. If the student greets you casually (e.g. "yo", "what can you do"), greet ${username} naturally, acknowledge their ${activeCourse} programme at ${schoolInfo.code}, and explain how you can help audit drafts, check citations, verify calculations, or review pasted screenshots.
3. If the student submits drafts, questions, code, or formulas, audit them thoroughly.`;

    // 3. Build clean alternating conversation history (excluding the current user turn which KampusKritic already appended)
    const contents: any[] = [];
    const priorHistory = Array.isArray(history) ? history.slice(0, -1).slice(-6) : [];

    for (const msg of priorHistory) {
      if (
        msg &&
        typeof msg.content === 'string' &&
        msg.content.trim() &&
        !msg.content.startsWith('Gemini API Error')
      ) {
        const role = msg.role === 'assistant' ? 'model' : 'user';
        // Ensure first message is 'user' and roles alternate
        if (contents.length === 0 && role === 'model') continue;
        if (contents.length > 0 && contents[contents.length - 1].role === role) {
          contents[contents.length - 1].parts[0].text += `\n${msg.content}`;
        } else {
          contents.push({
            role,
            parts: [{ text: msg.content }],
          });
        }
      }
    }

    const currentParts: any[] = [
      { text: promptText || 'Please inspect the attached coursework.' },
    ];

    if (Array.isArray(images)) {
      for (const imgUrl of images) {
        if (typeof imgUrl === 'string' && imgUrl.startsWith('data:image/')) {
          const [meta, base64Data] = imgUrl.split(',');
          const mimeType = meta.split(':')[1]?.split(';')[0] || 'image/png';
          currentParts.push({
            inlineData: { mimeType, data: base64Data },
          });
        }
      }
    }

    if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
      contents[contents.length - 1].parts.push(...currentParts);
    } else {
      contents.push({ role: 'user', parts: currentParts });
    }

    const requestPayload = {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents,
    };

    // 4. Discover available models directly from Google's ListModels endpoint if needed
    let modelsToTry = [...PREFERRED_MODELS];
    try {
      const listRes = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models',
        {
          method: 'GET',
          headers: { 'x-goog-api-key': apiKey },
        }
      );
      if (listRes.ok) {
        const listJson = await listRes.json();
        const available: string[] = (listJson.models || [])
          .filter(
            (m: any) =>
              Array.isArray(m.supportedGenerationMethods) &&
              m.supportedGenerationMethods.includes('generateContent') &&
              typeof m.name === 'string' &&
              m.name.includes('gemini') &&
              !m.name.includes('image') &&
              !m.name.includes('embedding') &&
              !m.name.includes('tts') &&
              !m.name.includes('audio')
          )
          .map((m: any) => m.name);

        if (available.length > 0) {
          // Prioritize flash models from the live list, then append the rest
          const flashModels = available.filter((n) => n.includes('flash'));
          const otherModels = available.filter((n) => !n.includes('flash'));
          modelsToTry = Array.from(
            new Set([...PREFERRED_MODELS.filter((p) => available.includes(p)), ...flashModels, ...otherModels])
          );
        }
      }
    } catch {
      // Continues with PREFERRED_MODELS
    }

    let lastError = '';

    for (const modelPath of modelsToTry) {
      const cleanPath = modelPath.startsWith('models/')
        ? modelPath
        : `models/${modelPath}`;
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/${cleanPath}:generateContent`;

      const geminiRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(requestPayload),
      });

      if (geminiRes.ok) {
        const geminiJson = await geminiRes.json();
        const replyText =
          geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (replyText) {
          return NextResponse.json({
            reply: replyText,
            benchmark_used: benchmarkStatusLabel,
            is_preview: false,
          });
        }
      }

      lastError = await geminiRes.text();
    }

    return NextResponse.json({
      reply: `Gemini API Error: ${lastError}`,
      benchmark_used: benchmarkStatusLabel,
      is_preview: true,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Request failed.' },
      { status: 500 }
    );
  }
}
