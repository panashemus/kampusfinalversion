import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { classifyUniversity } from '@/lib/utils';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Automated SMS webhook handler for iPhone Shortcuts / FNB inContact
    if (body.action === 'auto_verify_sms') {
      const { smsText } = body;
      const refMatch = (smsText || '').match(/KRT-\d{4}/i);
      if (refMatch) {
        const matchedRef = refMatch[0].toUpperCase();
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        await supabase
          .from('profiles')
          .update({
            kritic_unlimited: true,
            is_premium: true,
            kritic_sub_until: nextMonth.toISOString(),
            payment_ref_code: 'VERIFIED',
          })
          .eq('payment_ref_code', matchedRef);
        return NextResponse.json({ verified: true, reference: matchedRef });
      }
      return NextResponse.json({ verified: false });
    }

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

    // 1. Query verified 80%+ contributor benchmarks for this course
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

    // 2. Call Gemini API
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const systemInstruction = `You are Kampus Kritic (powered by Argon), the conversational academic assistant and pre-flight assignment auditor for ${activeSchool}.
You are chatting with ${username}, a verified student enrolled in "${activeCourse}" at ${schoolInfo.code}.

Benchmark Knowledge:
${
  hasBenchmarks
    ? `You have access to verified distinction benchmark papers for ${activeCourse}:\n${verifiedBenchmarks[0].methodology_notes}`
    : `(Note: Institutional benchmark archive is currently populating for ${activeCourse}. Use standard ${schoolInfo.code} university grading and citation conventions.)`
}

Behavior Rules:
1. Never use emojis under any circumstances.
2. Be a helpful, sharp, and authentic academic thought partner. If the user greets you casually (e.g. "yo", "hi", "what's up"), greet ${username} naturally, acknowledge their programme (${activeCourse} at ${schoolInfo.code}), and let them know you're ready to review their work, check citations, or help with coursework.
3. If the user pastes an essay, question, lab report, formula, or code, audit it thoroughly: identify flaws, cite Harvard/APA referencing standards, test calculations, and give clean improvements.
4. If an image is attached, inspect the image content directly and address their questions about it.`;

      const contents: any[] = [];

      // Append conversation history for memory recall
      if (Array.isArray(history)) {
        for (const msg of history.slice(-8)) {
          if (msg.content) {
            contents.push({
              role: msg.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: msg.content }],
            });
          }
        }
      }

      const currentParts: any[] = [
        { text: promptText || 'Please inspect the attached material.' },
      ];

      // Handle attached images (data URLs)
      if (Array.isArray(images)) {
        for (const imgUrl of images) {
          if (imgUrl.startsWith('data:image/')) {
            const [meta, base64Data] = imgUrl.split(',');
            const mimeType = meta.split(':')[1]?.split(';')[0] || 'image/png';
            currentParts.push({
              inlineData: {
                mimeType,
                data: base64Data,
              },
            });
          }
        }
      }

      contents.push({ role: 'user', parts: currentParts });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

      if (apiKey.startsWith('AQ.')) {
        headers['x-goog-api-key'] = apiKey;
      }

      const geminiRes = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents,
        }),
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
      } else {
        const errorDetails = await geminiRes.text();
        console.error('Gemini API Error:', errorDetails);
      }
    }

    // 3. Fallback if GEMINI_API_KEY is not yet active or redeployed
    const fallbackReply = `Hey ${username}. I am set up for ${activeCourse} at ${activeSchool}. 

If you are seeing this message, your GEMINI_API_KEY environment variable is still completing its deployment in Vercel. 

Once Vercel finishes deploying, I will respond dynamically to all your questions, assignment drafts, and attached images.`;

    return NextResponse.json({
      reply: fallbackReply,
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
