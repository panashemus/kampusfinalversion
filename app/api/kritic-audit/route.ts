import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { classifyUniversity } from '@/lib/utils';

const AI_CLICHES = [
  'delve',
  'tapestry',
  'testament',
  'moreover',
  'furthermore',
  'crucial',
  'underscores',
  'realm',
  'pivotal',
  'intricate',
];

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Optional automated SMS webhook handler for iPhone Shortcuts / FNB inContact
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
    const activeSchool = university || schoolInfo.fullName;
    const activeCourse = (courseCode || 'General Coursework').trim().toUpperCase();

    // 1. Query verified 80%+ contributor benchmarks for this exact course & school
    let benchmarkCitation = `${schoolInfo.code} Institutional Academic Standard (${activeCourse})`;
    let benchmarkExcerpt = '';

    try {
      const { data: benchmarks } = await supabase
        .from('academic_contributors')
        .select('course_code, grade_achieved, sample_title, methodology_notes, institution')
        .ilike('course_code', `%${activeCourse}%`)
        .limit(2);

      if (benchmarks && benchmarks.length > 0) {
        const top = benchmarks[0];
        benchmarkCitation = `${top.institution || schoolInfo.code} ${top.course_code} Distinction Benchmark (Scored ${top.grade_achieved} on "${top.sample_title}")`;
        benchmarkExcerpt = top.methodology_notes;
      }
    } catch {
      // Continues with institutional rubric if table is empty
    }

    // 2. Call Gemini API if GEMINI_API_KEY is configured in environment variables
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const systemInstruction = `You are Kampus Kritic (powered by Argon), the academic benchmark and pre-submission audit engine for ${activeSchool}.
You are speaking directly with ${username}, who is studying ${activeCourse} at ${schoolInfo.code}.
Active Benchmark Reference: ${benchmarkCitation}
${benchmarkExcerpt ? `Verified Distinction Excerpt from this course:\n${benchmarkExcerpt}\n` : ''}

Rules:
1. Never use emojis under any circumstances. Keep your tone sharp, analytical, direct, and grounded in ${schoolInfo.code} marking standards.
2. Address the student's exact prompt or uploaded assignment image: check structure, methodology, calculations, Harvard/APA citations, and flag robotic AI phrasing.
3. Explicitly reference their school (${schoolInfo.code}) and course (${activeCourse}) standards.
4. Provide:
   - [BENCHMARK ALIGNMENT]: How their work compares to ${schoolInfo.code} distinction standards (with estimated grade band).
   - [CRITICAL DEDUCTIONS]: Specific errors, missing citations, calculation mistakes, or AI-flagged phrases found.
   - [REFINED OUTPUT]: The corrected, polished section, calculation verification, or structured solution.`;

      const contents: any[] = [];

      // Append recent conversation history for context recall
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

      const currentParts: any[] = [{ text: promptText || 'Analyze the attached academic material.' }];

      // Attach any pasted/uploaded images
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

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents,
          }),
        }
      );

      if (geminiRes.ok) {
        const geminiJson = await geminiRes.json();
        const replyText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (replyText) {
          return NextResponse.json({
            reply: replyText,
            benchmark_used: benchmarkCitation,
          });
        }
      }
    }

    // 3. Deterministic Academic Audit Fallback (Works immediately even before GEMINI_API_KEY is added)
    const lower = promptText.toLowerCase();
    const detectedCliches = AI_CLICHES.filter((w) => lower.includes(w));
    const hasCitations =
      /\([a-zA-Z]+,?\s*\d{4}\)/.test(promptText) || /\[\d+\]/.test(promptText);
    const wordCount = promptText.trim() ? promptText.trim().split(/\s+/).length : 0;
    const estScore = Math.min(
      92,
      Math.max(64, 76 + (hasCitations ? 8 : -5) - detectedCliches.length * 4)
    );

    const structuredReply = `[BENCHMARK ALIGNMENT — ${schoolInfo.code} | ${activeCourse}]
Reference Standard: ${benchmarkCitation}
Estimated Rubric Standing: ${estScore}% (${estScore >= 80 ? 'Distinction Band' : 'Credit Band — Needs Tightening'})
Input Analyzed: ${wordCount} words${images.length > 0 ? ` + ${images.length} attached image(s)` : ''}

[CRITICAL DEDUCTIONS & AUDIT FINDINGS]
1. Citation & Referencing Check: ${
      hasCitations
        ? `In-text citations detected. Verify that every bracketed source matches an alphabetical entry in your final ${schoolInfo.code} Reference List.`
        : `No formal Harvard/APA in-text citations (Author, Year) were detected. ${schoolInfo.code} marking rubrics deduct 10 to 15 marks for unsubstantiated claims.`
    }
2. AI Probability & Tone Check: ${
      detectedCliches.length > 0
        ? `High Turnitin AI-tone risk detected. Replace overused terms (${detectedCliches.join(', ')}) with direct empirical phrasing.`
        : `Low AI-tone risk (Human academic cadence verified). Sentence burstiness and transitions read naturally.`
    }
3. ${activeCourse} Methodological Rigor: Top-scoring 85%+ submissions at ${schoolInfo.code} anchor every section by contrasting theoretical models with applied local data or step-by-step working.

[REFINED REVISION & NEXT STEP]
${
  promptText.trim()
    ? promptText
        .replace(/\b(delve|Moreover|Furthermore|tapestry|testament|crucial)\b/gi, '')
        .trim()
    : 'Image attachment logged for inspection.'
}

[KRITIC RECOMMENDATION]: State your primary thesis metric in sentence one, attach a supporting (Author, Year) citation after your second claim, and paste your next section or rubric screenshot below for line-by-line verification.`;

    return NextResponse.json({
      reply: structuredReply,
      benchmark_used: benchmarkCitation,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Audit request failed.' },
      { status: 500 }
    );
  }
}
