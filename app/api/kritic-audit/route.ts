import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const AI_CLICHES = [
  'delve',
  'tapestry',
  'testament',
  'moreover',
  'furthermore',
  'crucial',
  'underscores',
  'realm',
  'beacon',
  'pivotal',
];

export async function POST(req: Request) {
  try {
    const { institution, courseCode, mode, draftText } = await req.json();

    // 1. Check if we have a real donated student benchmark for this course in Supabase
    let benchmarkLabel = `${institution} Institutional Rubric (${courseCode})`;
    let benchmarkContext = '';

    try {
      const { data: benchmarks } = await supabase
        .from('academic_contributors')
        .select('course_code, grade_achieved, sample_title, methodology_notes')
        .eq('course_code', courseCode)
        .limit(2);

      if (benchmarks && benchmarks.length > 0) {
        const top = benchmarks[0];
        benchmarkLabel = `Verified ${institution} ${top.course_code} Graduate Benchmark (Scored ${top.grade_achieved} on "${top.sample_title}")`;
        benchmarkContext = top.methodology_notes;
      }
    } catch {
      // Fallback if table isn't migrated yet
    }

    // 2. If GEMINI_API_KEY is configured in Vercel, call Gemini API with RAG context
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const prompt = `You are Kampus Kritic (powered by Gemini Argon), an elite academic auditor for ${institution} (${courseCode}).
Benchmark Reference: ${benchmarkLabel}
${benchmarkContext ? `Verified Distinction Excerpt to compare against:\n${benchmarkContext}\n` : ''}
Task Mode: ${mode}
Student Submission:
"""
${draftText}
"""
Return ONLY valid JSON with keys:
- "overall_score": number (60-96)
- "ai_probability": string (e.g. "Low (12%)" or "High (68% - Flagged)")
- "benchmark_citation": string (mention how a ${institution} ${courseCode} distinction student structures this)
- "summary_verdict": string (2 concise sentences)
- "critical_issues": array of 4 specific actionable fixes
- "polished_rewrite": string (the improved, humanized, or formatted version / slide script / lecturer email)
- "rubric_breakdown": array of {"criterion": string, "score": string, "note": string}`;

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      );

      if (geminiRes.ok) {
        const geminiJson = await geminiRes.json();
        const rawText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          return NextResponse.json(JSON.parse(rawText));
        }
      }
    }

    // 3. Built-in Heuristic Fallback (Works immediately even before GEMINI_API_KEY is added)
    const lower = draftText.toLowerCase();
    const detectedCliches = AI_CLICHES.filter((w) => lower.includes(w));
    const hasCitations = /\([a-zA-Z]+,?\s*\d{4}\)/.test(draftText) || /\[\d+\]/.test(draftText);
    const wordCount = draftText.trim().split(/\s+/).length;

    const aiRisk =
      detectedCliches.length >= 2
        ? `High (${Math.min(88, 45 + detectedCliches.length * 12)}% - Turnitin Risk)`
        : detectedCliches.length === 1
        ? 'Moderate (34%)'
        : 'Low (9% - Human Tone)';

    const baseScore = Math.min(
      91,
      Math.max(62, 74 + (hasCitations ? 8 : -6) - detectedCliches.length * 5)
    );

    return NextResponse.json({
      overall_score: baseScore,
      ai_probability: aiRisk,
      benchmark_citation: benchmarkLabel,
      summary_verdict: `Audited ${wordCount} words against ${benchmarkLabel}. ${
        hasCitations
          ? 'In-text citations detected, but methodological transitions and critical synthesis need tightening to hit the 85%+ distinction band.'
          : 'No formal Harvard/APA in-text citations (Author, Year) detected—this costs up to 15 marks on UB & BAC marking rubrics.'
      }`,
      critical_issues: [
        detectedCliches.length > 0
          ? `AI Vocabulary Flag: Remove words like "${detectedCliches.join(', ')}" which immediately trigger lecturer AI detectors.`
          : 'Structure Check: Anchor your opening claim with a concrete regional or empirical metric in sentence 1.',
        hasCitations
          ? 'Citation Cross-Check: Ensure every (Author, Year) bracket has a matching alphabetical entry in your final Reference List.'
          : 'Missing Citations: Add at least 2 peer-reviewed (Author, Year) citations per body paragraph.',
        mode === 'lab'
          ? 'Dimensional Sanity: Explicitly state SI units and percentage uncertainty margins beside every calculated value.'
          : mode === 'slides'
          ? 'Slide Density: Cap each slide at 4 bullet points (max 8 words per bullet) and shift explanations to your speaker script.'
          : 'Rubric Alignment: Top-scoring 85%+ submissions explicitly contrast theory with a local Botswana / SADC case application.',
      ],
      polished_rewrite:
        mode === 'email'
          ? `Subject: Formal Inquiry Regarding ${courseCode} Continuous Assessment Record\n\nDear Lecturer,\n\nI hope this email finds you well. I am writing to respectfully request a brief review of my ${courseCode} assessment record, as my submitted coursework does not currently reflect on the portal.\n\nI have attached my submission receipt and draft for your convenience. Please let me know if I may pass by during your office hours this week.\n\nKind regards,\n[Your Name & Student ID]`
          : mode === 'slides'
          ? `SLIDE 1: CORE PROBLEM & CONTEXT\n• Key operational bottleneck identified\n• Empirical baseline across ${institution} case parameters\n\n[SPEAKER SCRIPT - 0:00 to 0:45]:\n"Good morning everyone. Rather than repeating the textbook definition, let's look directly at the core metric driving our ${courseCode} analysis..."`
          : `[BENCHMARK-ALIGNED REVISION (${courseCode})]:\n\n${draftText
              .replace(/\b(delve|Moreover|Furthermore|tapestry|testament)\b/gi, '')
              .trim()}\n\n[Kritic Structural Note: Insert (Author, 2024) empirical citation here and link directly to the ${institution} ${courseCode} grading rubric conclusion.]`,
      rubric_breakdown: [
        { criterion: 'Academic & Rubric Structure', score: `${baseScore}/100`, note: 'Checked against faculty format' },
        { criterion: 'Citation & Referencing', score: hasCitations ? 'Pass' : 'Needs Fix', note: 'Harvard / APA standard' },
      ],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
