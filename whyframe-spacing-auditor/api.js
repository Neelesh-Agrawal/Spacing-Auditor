/**
 * api.js — Whyframe Spacing Auditor
 * Frontend API client. Only calls POST /api/analyze.
 * Never holds API key. Never calls Groq directly.
 */

const ANALYSIS_TIMEOUT_MS = 15000;

/**
 * Call the serverless /api/analyze endpoint.
 *
 * @param {{
 *   mode: "generate"|"audit",
 *   platform: "web"|"mobile",
 *   density: "compact"|"default"|"comfortable",
 *   context: string,
 *   values: number[],
 *   scaleType?: string,
 *   baseUnit?: number,
 *   auditFlags?: Array,
 *   score?: number
 * }} payload
 * @returns {Promise<{systemAnalysis:string, watchOutFor:string, suggestions:string, pairingNote?:string}|null>}
 */
async function analyzeWithAI(payload) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { _error: 'Analysis unavailable — try regenerating' };
    }

    const data = await response.json();

    if (data.error) {
      return { _error: data.error };
    }

    // Strip markdown fences if present
    let raw = typeof data === 'string' ? data : JSON.stringify(data);
    if (typeof data.result === 'string') {
      raw = data.result;
    } else if (data.systemAnalysis) {
      // Already parsed correctly
      return {
        systemAnalysis: data.systemAnalysis || '—',
        watchOutFor: data.watchOutFor || '—',
        suggestions: data.suggestions || '—',
        pairingNote: data.pairingNote || null
      };
    }

    // Try parse if string
    raw = raw.replace(/```json|```/g, '').trim();
    try {
      const parsed = JSON.parse(raw);
      return {
        systemAnalysis: parsed.systemAnalysis || '—',
        watchOutFor: parsed.watchOutFor || '—',
        suggestions: parsed.suggestions || '—',
        pairingNote: parsed.pairingNote || null
      };
    } catch {
      return { _error: 'Analysis unavailable — try regenerating' };
    }

  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { _error: 'Analysis timed out — your scale data is still valid' };
    }
    return { _error: "Couldn't reach the analysis service — check your connection" };
  }
}

export { analyzeWithAI };
