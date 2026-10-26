import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { classifyUniversity } from '@/lib/utils';

const ACTIVE_MODELS = [
  'gemini-2.0-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash',
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
    const apiKey = (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '').trim();

    if (!apiKey) {
      return NextResponse.json({
        reply: `Configuration Error: GEMINI_API_KEY is not set in Vercel Environment Variables. Please add GEMINI_API_KEY under Vercel Settings -> Environment Variables and redeploy.`,
        benchmark_used: benchmarkStatusLabel,
        is_preview: true,
      });
    }

    const systemInstruction = `You are Kampus Kritic (powered by Argon), the conversational academic assistant and pre-flight assignment auditor for ${activeSchool}.
You are chatting with ${username}, a verified student enrolled in "${activeCourse}" at ${schoolInfo.code}.

${
  hasBenchmarks
    ? `Verified distinction benchmark notes for ${activeCourse}:\n${verifiedBenchmarks[0].methodology_notes}`
    : `(Institutional benchmark archive is currently populating. Provide rigorous, standard ${schoolInfo.code} academic grading, Harvard/APA citation, and coursework guidance.)`
}

Rules:
1. Never use emojis.
2. Be an authentic, helpful academic collaborator. If the student greets you casually (e.g. "yo", "what can you do"), answer naturally, state that you are Kampus Kritic calibrated for ${activeCourse} at ${schoolInfo.code}, and ask how you can assist with their coursework or assignments.
3. If the student submits drafts, questions, code, or formulas, audit them rigorously according to university rubrics.`;

    const contents: any[] = [];

    // Append conversation history
    if (Array.isArray(history)) {
      for (const msg of history.slice(-6)) {
        if (msg && msg.content) {
          contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
          });
        }
      }
    }

    const currentParts: any[] = [
      { text: promptText || 'Please inspect the attached coursework.' },
    ];

    // Handle attached screenshots / images
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

    contents.push({ role: 'user', parts: currentParts });

    const requestPayload = {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents,
    };

    let lastError = '';

    // Loop through active model aliases to handle Google Studio deprecation/renaming
    for (const modelName of ACTIVE_MODELS) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

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
        const replyText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (replyText) {
          return NextResponse.json({
            reply: replyText,
            benchmark_used: benchmarkStatusLabel,
            is_preview: false,
          });
        }
      }

      lastError = await geminiRes.text();
      console.warn(`Model ${modelName} failed (${geminiRes.status}):`, lastError);
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
