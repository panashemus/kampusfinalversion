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
    const activeCourse = (courseCode || '').trim();

    // 1. Check if verified 80%+ contributor papers exist in Supabase for this exact course
    let verifiedBenchmarks: any[] = [];
    try {
      const { data } = await supabase
        .from('academic_contributors')
        .select(
          'course_code, grade_achieved, sample_title, methodology_notes, institution'
        )
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
      : `In Development — ${schoolInfo.code} (${activeCourse || 'No Course Selected'})`;

    // 2. Call Gemini API if GEMINI_API_KEY is present in environment variables
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const systemInstruction = `You are Kampus Kritic, the academic assistant for ${activeSchool}.
You are speaking directly with ${username}, who is enrolled in "${activeCourse}" at ${schoolInfo.code}.

MANDATORY TRANSPARENCY DISCLAIMER:
${
  hasBenchmarks
    ? `Use these verified past-student benchmark notes for ${activeCourse}:\n${verifiedBenchmarks[0].methodology_notes}`
    : `Always begin your response with a one-line notice stating: "[Notice: Kampus Kritic is still in development and does not yet source past or current ${schoolInfo.code} student coursework for ${activeCourse}. The following is general AI academic guidance.]"`
}

Rules:
1. Never use emojis under any circumstances.
2. Tailor your academic guidance to a student studying ${activeCourse} at ${activeSchool}.
3. If the student pastes an assignment draft, calculation, or image, point out structural improvements, citation formatting, and clarity fixes honestly without inventing fake past-student citations.`;

      const contents: any[] = [];
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
        { text: promptText || 'Review the attached academic material.' },
      ];

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
      let endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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
            is_preview: !hasBenchmarks,
          });
        }
      }
    }

    // 3. Honest Pre-Launch Notice (No fake 71% grade or fabricated rubric scores)
    const honestPreviewReply = `[DEVELOPMENT NOTICE — BENCHMARK ARCHIVE IN PROGRESS]
Institution: ${activeSchool}
Selected Programme: ${activeCourse || 'Not Set'}
Benchmark Status: 0 Verified Student Papers Indexed

Kampus Kritic is currently being built and is not yet functional for live benchmark grading. It does not currently source past or current student coursework from ${schoolInfo.code}.

Once verified 80%+ distinction papers for ${activeCourse || schoolInfo.code} are indexed and the live model connection is active in your deployment environment, you will be able to audit your assignments here. This test message did not use your free trial prompt.`;

    return NextResponse.json({
      reply: honestPreviewReply,
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
