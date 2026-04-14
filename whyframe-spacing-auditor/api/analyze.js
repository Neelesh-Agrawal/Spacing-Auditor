/**
 * api/analyze.js — Vercel Serverless Function
 * Reads GROQ_API_KEY from process.env server-side.
 * Never returns raw Groq errors to the client.
 */

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Parse request body
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Malformed request body' });
  }

  const { mode, platform, density, context, values, scaleType, baseUnit, auditFlags, score } = body || {};

  if (!mode || !platform || !Array.isArray(values)) {
    return res.status(400).json({ error: 'Missing required fields: mode, platform, values' });
  }

  // Build prompts
  const systemPrompt = `You are Whyframe, a design reasoning engine. You explain the WHY behind spacing decisions. Be specific, opinionated, and practical. Never be vague. Reference exact values from the data provided. Keep each section to 2–3 sentences max.`;

  let flagSummary = '';
  if (mode === 'audit' && Array.isArray(auditFlags) && auditFlags.length > 0) {
    flagSummary = `\nFlags: ${auditFlags.map(f => f.title).join('; ')}`;
    if (score !== undefined) flagSummary += `\nScore: ${score}/100`;
  }

  const userPrompt = `Mode: ${mode}. Platform: ${platform}. Density: ${density || 'default'}.
Values: [${values.join(', ')}].${scaleType ? ` Scale type: ${scaleType}.` : ''}${baseUnit ? ` Base unit: ${baseUnit}px.` : ''}
Context: ${context || 'No context provided.'}${flagSummary}

Respond ONLY in this JSON format (no markdown, no backticks, no preamble):
{
  "systemAnalysis": "2-3 sentences about why this scale works or doesn't",
  "watchOutFor": "1 specific risk with this system, referencing exact values",
  "suggestions": "2-3 concrete actionable improvements",
  "pairingNote": "optional — only include if there's a meaningful insight about platform-specific spacing behavior"
}`;

  // Call Groq API
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Analysis failed' });
  }

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!groqResponse.ok) {
      // Never expose raw Groq error
      return res.status(500).json({ error: 'Analysis failed' });
    }

    const groqData = await groqResponse.json();
    const rawContent = groqData?.choices?.[0]?.message?.content;

    if (!rawContent) {
      return res.status(500).json({ error: 'Analysis failed' });
    }

    // Strip markdown fences if present
    const cleaned = rawContent.replace(/```json|```/g, '').trim();

    // Validate JSON
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: 'Analysis failed' });
    }

    return res.status(200).json({
      systemAnalysis: parsed.systemAnalysis || '—',
      watchOutFor: parsed.watchOutFor || '—',
      suggestions: parsed.suggestions || '—',
      pairingNote: parsed.pairingNote || null
    });

  } catch {
    // Never expose raw errors
    return res.status(500).json({ error: 'Analysis failed' });
  }
}
