/**
 * audit.js — Whyframe Spacing Auditor
 * Parse raw input and run 10 audit checks. Zero DOM.
 */

// ─── PARSER ────────────────────────────────────────────────────────────────

/**
 * Extract numbers from raw string (commas, spaces, newlines).
 * @param {string} raw
 * @returns {number[]}
 */
function extractRawNumbers(raw) {
  const matches = raw.match(/(-?\d+(\.\d+)?)/g) || [];
  return matches.map(Number);
}

/**
 * Parse CSS custom properties:
 *   --space-sm: 8px;
 *   --spacing-4: 1rem;
 * @param {string} raw
 * @returns {number[]}
 */
function parseCSSProps(raw) {
  const lines = raw.split('\n');
  const result = [];
  for (const line of lines) {
    const match = line.match(/--[\w-]+:\s*(-?\d+(\.\d+)?)(px|rem|em)?/);
    if (match) {
      let val = parseFloat(match[1]);
      const unit = match[3];
      if (unit === 'rem' || unit === 'em') val = val * 16;
      result.push(val);
    }
  }
  return result;
}

/**
 * Recursively extract numeric values from "value" keys in a JSON object.
 * @param {any} obj
 * @returns {number[]}
 */
function extractFromJson(obj) {
  const results = [];
  if (typeof obj !== 'object' || obj === null) return results;
  for (const key of Object.keys(obj)) {
    if (key === 'value') {
      const raw = String(obj[key]).replace(/[^\d.]/g, '');
      const n = parseFloat(raw);
      if (!isNaN(n)) results.push(n);
    } else {
      results.push(...extractFromJson(obj[key]));
    }
  }
  return results;
}

/**
 * Parse JSON / Figma Tokens format.
 * @param {string} raw
 * @returns {{ values: number[], failed: boolean }}
 */
function parseFigmaJson(raw) {
  try {
    const obj = JSON.parse(raw);
    return { values: extractFromJson(obj), failed: false };
  } catch {
    return { values: [], failed: true };
  }
}

/**
 * Main parser — handles all 4 formats automatically.
 *
 * @param {string} rawString
 * @returns {{ values: number[], warnings: string[], error: string|null }}
 */
function parseInput(rawString) {
  if (!rawString || rawString.trim() === '') {
    return { values: [], warnings: [], error: 'No spacing values found. Try: 4, 8, 16, 32' };
  }

  const warnings = [];
  let allValues = [];

  // Attempt JSON parse
  const jsonResult = parseFigmaJson(rawString.trim());
  if (!jsonResult.failed && jsonResult.values.length > 0) {
    allValues.push(...jsonResult.values);
  }

  // Attempt CSS vars parse
  if (rawString.includes('--')) {
    allValues.push(...parseCSSProps(rawString));
  }

  // Always attempt raw number extraction as fallback/merge
  allValues.push(...extractRawNumbers(rawString));

  if (allValues.length === 0) {
    return {
      values: [],
      warnings: [],
      error: 'No spacing values found. Try pasting like: 4, 8, 16, 32'
    };
  }

  // Exclude negatives with warning
  const negatives = allValues.filter(v => v < 0);
  if (negatives.length > 0) {
    warnings.push('Negative spacing values ignored');
    allValues = allValues.filter(v => v >= 0);
  }

  // Exclude > 1000 with warning
  const hugeVals = allValues.filter(v => v > 1000);
  if (hugeVals.length > 0) {
    warnings.push('Values above 1000px excluded — likely not spacing tokens');
    allValues = allValues.filter(v => v <= 1000);
  }

  // Round decimals
  const hasDecimals = allValues.some(v => v !== Math.round(v));
  if (hasDecimals) {
    warnings.push('Decimal values rounded to nearest integer');
    allValues = allValues.map(v => Math.round(v));
  }

  // Deduplicate
  const unique = [...new Set(allValues)];
  const dupeCount = allValues.length - unique.length;
  if (dupeCount > 0) {
    warnings.push(`${dupeCount} duplicate value${dupeCount > 1 ? 's' : ''} removed`);
  }

  // Sort ascending
  unique.sort((a, b) => a - b);

  if (unique.length === 0) {
    return {
      values: [],
      warnings,
      error: 'No spacing values found. Try pasting like: 4, 8, 16, 32'
    };
  }

  return { values: unique, warnings, error: null };
}

// ─── AUDIT CHECKS ──────────────────────────────────────────────────────────

/**
 * Run all 10 audit checks.
 *
 * @param {number[]} values - parsed, sorted unique values
 * @param {"web"|"mobile"} platform
 * @returns {Array<{id:string, severity:"error"|"warning"|"info", title:string, detail:string, suggestion:string}>}
 */
function runAuditChecks(values, platform) {
  const checks = [];

  // ---- Utility -----
  const nonZero = values.filter(v => v > 0);
  const sorted = [...values].sort((a, b) => a - b);

  // ── CHECK 1: Base unit detection ──────────────────────────────────────
  const allDiv4 = nonZero.length > 0 && nonZero.every(v => v % 4 === 0);
  const allDiv8 = nonZero.length > 0 && nonZero.every(v => v % 8 === 0);

  if (allDiv8) {
    checks.push({
      id: 'check-1',
      severity: 'info',
      title: 'Values align to 8pt grid',
      detail: 'All non-zero values are divisible by 8.',
      suggestion: 'Keep it up — 8pt grids produce clean, consistent layouts.'
    });
  } else if (allDiv4) {
    checks.push({
      id: 'check-1',
      severity: 'info',
      title: 'Values align to 4pt grid',
      detail: 'All non-zero values are divisible by 4.',
      suggestion: 'Solid foundation. 4pt grids align to most screen densities.'
    });
  } else {
    checks.push({
      id: 'check-1',
      severity: 'error',
      title: 'No consistent base unit detected',
      detail: "Values don't align to a 4pt or 8pt grid.",
      suggestion: 'Normalize all values to multiples of 4 or 8.'
    });
  }

  // ── CHECK 2: Magic numbers ────────────────────────────────────────────
  const magicNums = nonZero.filter(v => v % 4 !== 0);
  magicNums.forEach(v => {
    const nearest4a = Math.floor(v / 4) * 4;
    const nearest4b = Math.ceil(v / 4) * 4;
    checks.push({
      id: `check-2-${v}`,
      severity: 'error',
      title: `${v}px is not on a 4pt or 8pt grid`,
      detail: `Magic number detected: ${v}px doesn't conform to a 4pt grid system.`,
      suggestion: `Nearest 4pt values: ${nearest4a}px or ${nearest4b}px`
    });
  });

  // ── CHECK 3: Missing intermediate steps ──────────────────────────────
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (a === 0) continue;
    const gap = b - a;
    if (gap > 2 * a && gap > 16) {
      const mid1 = snapSuggestion(a, b, 1);
      const mid2 = snapSuggestion(a, b, 2);
      const suggest = mid2 ? `Consider adding ${mid1}px or ${mid2}px between them` : `Consider adding ${mid1}px between them`;
      checks.push({
        id: `check-3-${a}-${b}`,
        severity: 'warning',
        title: `Gap between ${a}px and ${b}px — missing intermediate step`,
        detail: `The jump from ${a}px to ${b}px is ${gap}px, which may cause inconsistent visual rhythm.`,
        suggestion: suggest
      });
    }
  }

  // ── CHECK 4: Near-duplicates ──────────────────────────────────────────
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (a !== b && Math.abs(a - b) <= 2) {
      checks.push({
        id: `check-4-${a}-${b}`,
        severity: 'warning',
        title: `${a}px and ${b}px are within 2px — likely redundant`,
        detail: `Near-duplicate values create ambiguity in your spacing system.`,
        suggestion: 'Keep one value, remove the other.'
      });
    }
  }

  // ── CHECK 5: Too many tokens ──────────────────────────────────────────
  if (nonZero.length > 12) {
    checks.push({
      id: 'check-5',
      severity: 'warning',
      title: `${nonZero.length} spacing tokens — systems with more than 12 are hard to maintain`,
      detail: `Large token sets cause decision fatigue and inconsistent usage.`,
      suggestion: 'Reduce to 8–12 tokens by merging similar values.'
    });
  }

  // ── CHECK 6: Mobile minimum ───────────────────────────────────────────
  const minNonZero = nonZero.length > 0 ? Math.min(...nonZero) : null;
  if (minNonZero !== null && minNonZero < 8) {
    if (platform === 'mobile') {
      checks.push({
        id: 'check-6',
        severity: 'error',
        title: `Smallest value ${minNonZero}px is below 8px — invisible on mobile screens`,
        detail: `Touch interfaces need at least 8px spacing to remain perceptible.`,
        suggestion: 'Use 8px as your minimum spacing unit for touch interfaces.'
      });
    } else {
      checks.push({
        id: 'check-6',
        severity: 'warning',
        title: `Smallest value ${minNonZero}px is very small`,
        detail: `Very small spacing values can be hard to perceive or use consistently.`,
        suggestion: 'Consider if sub-8px spacing is intentional or accidental.'
      });
    }
  }

  // ── CHECK 7: Large jumps / broken rhythm ─────────────────────────────
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (a > 0 && b / a > 3.0) {
      const ratio = (b / a).toFixed(1);
      checks.push({
        id: `check-7-${a}-${b}`,
        severity: 'warning',
        title: `Jump from ${a}px to ${b}px breaks visual rhythm (${ratio}× step)`,
        detail: `A ${ratio}× ratio between consecutive steps creates jarring layout jumps.`,
        suggestion: 'Add intermediate values to smooth the progression.'
      });
    }
  }

  // ── CHECK 8: No base unit present ────────────────────────────────────
  if (!values.includes(4) && !values.includes(8)) {
    checks.push({
      id: 'check-8',
      severity: 'error',
      title: 'Neither 4px nor 8px found — no clear base unit',
      detail: 'A well-defined spacing system starts with a visible base unit token.',
      suggestion: 'Start your scale with 4px or 8px as the foundation.'
    });
  }

  // ── CHECK 9: Non-scaling pattern ─────────────────────────────────────
  if (nonZero.length >= 3) {
    const ratios = [];
    for (let i = 0; i < nonZero.length - 1; i++) {
      if (nonZero[i] > 0) {
        ratios.push(nonZero[i + 1] / nonZero[i]);
      }
    }
    if (ratios.length > 1) {
      const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
      const variance = ratios.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / ratios.length;
      const stdDev = Math.sqrt(variance);
      if (stdDev > 0.8) {
        checks.push({
          id: 'check-9',
          severity: 'warning',
          title: 'Spacing ratios are inconsistent — scale doesn\'t follow a mathematical pattern',
          detail: `Ratio standard deviation is ${stdDev.toFixed(2)} — high inconsistency indicates arbitrary values.`,
          suggestion: 'Choose a consistent multiplier (1.25, 1.5, or 2×) between steps.'
        });
      }
    }
  }

  // ── CHECK 10: Odd values ──────────────────────────────────────────────
  const oddVals = nonZero.filter(v => v % 2 !== 0);
  oddVals.forEach(v => {
    const lower = v - 1;
    const upper = v + 1;
    checks.push({
      id: `check-10-${v}`,
      severity: 'warning',
      title: `${v}px is an odd number — odd values can cause sub-pixel rendering issues`,
      detail: 'Odd values can cause blurry rendering on non-retina screens and break center-alignment math.',
      suggestion: `Use ${lower}px or ${upper}px instead — even numbers render crisply on all screens.`
    });
  });

  return checks;
}

/**
 * Helper: suggest a midpoint value snapped to 4pt grid.
 */
function snapSuggestion(a, b, idx) {
  const thirds = [
    Math.round((a + (b - a) / 3) / 4) * 4,
    Math.round((a + (2 * (b - a)) / 3) / 4) * 4
  ];
  return thirds[idx - 1] || null;
}

// ─── HEALTH SCORE ──────────────────────────────────────────────────────────

/**
 * Calculate health score from 0–100.
 *
 * @param {Array} checks
 * @param {number[]} values
 * @returns {{ score: number, label: string, color: "green"|"amber"|"red", breakdown: Array }}
 */
function calculateScore(checks, values) {
  let score = 100;
  const breakdown = [];

  // Base unit not detected
  const baseCheck = checks.find(c => c.id === 'check-1' && c.severity === 'error');
  if (baseCheck) {
    score -= 25;
    breakdown.push({ reason: 'No consistent base unit', deduction: -25 });
  }

  // Magic numbers: -3 each, cap -20
  const magicChecks = checks.filter(c => c.id.startsWith('check-2-'));
  const magicDeduction = Math.min(magicChecks.length * 3, 20);
  if (magicDeduction > 0) {
    score -= magicDeduction;
    breakdown.push({ reason: `Magic numbers (${magicChecks.length} values)`, deduction: -magicDeduction });
  }

  // Missing intermediate steps: -5 each, cap -15
  const gapChecks = checks.filter(c => c.id.startsWith('check-3-'));
  const gapDeduction = Math.min(gapChecks.length * 5, 15);
  if (gapDeduction > 0) {
    score -= gapDeduction;
    breakdown.push({ reason: `Missing intermediate steps (${gapChecks.length} gaps)`, deduction: -gapDeduction });
  }

  // Near-duplicates: -5 each, cap -10
  const dupeChecks = checks.filter(c => c.id.startsWith('check-4-'));
  const dupeDeduction = Math.min(dupeChecks.length * 5, 10);
  if (dupeDeduction > 0) {
    score -= dupeDeduction;
    breakdown.push({ reason: `Near-duplicates (${dupeChecks.length} pairs)`, deduction: -dupeDeduction });
  }

  // Too many tokens: -5
  if (checks.find(c => c.id === 'check-5')) {
    score -= 5;
    breakdown.push({ reason: 'Too many tokens', deduction: -5 });
  }

  // Mobile minimum violation: -10
  if (checks.find(c => c.id === 'check-6' && c.severity === 'error')) {
    score -= 10;
    breakdown.push({ reason: 'Mobile minimum violation', deduction: -10 });
  }

  // Large jumps: -5 each, cap -10
  const jumpChecks = checks.filter(c => c.id.startsWith('check-7-'));
  const jumpDeduction = Math.min(jumpChecks.length * 5, 10);
  if (jumpDeduction > 0) {
    score -= jumpDeduction;
    breakdown.push({ reason: `Large jumps (${jumpChecks.length})`, deduction: -jumpDeduction });
  }

  // No base unit: -15 (check-8 — avoid double-counting with check-1)
  if (checks.find(c => c.id === 'check-8') && !baseCheck) {
    score -= 15;
    breakdown.push({ reason: 'No base unit present', deduction: -15 });
  }

  // Non-scaling pattern: -10
  if (checks.find(c => c.id === 'check-9')) {
    score -= 10;
    breakdown.push({ reason: 'Inconsistent scaling pattern', deduction: -10 });
  }

  // Odd values: -2 each, cap -6
  const oddChecks = checks.filter(c => c.id.startsWith('check-10-'));
  const oddDeduction = Math.min(oddChecks.length * 2, 6);
  if (oddDeduction > 0) {
    score -= oddDeduction;
    breakdown.push({ reason: `Odd values (${oddChecks.length})`, deduction: -oddDeduction });
  }

  score = Math.max(0, Math.min(100, score));

  let label, color;
  if (score >= 90) { label = 'Production ready'; color = 'green'; }
  else if (score >= 70) { label = 'Minor issues'; color = 'amber'; }
  else if (score >= 50) { label = 'Needs cleanup'; color = 'amber'; }
  else { label = 'Rebuild recommended'; color = 'red'; }

  return { score, label, color, breakdown };
}

export { parseInput, runAuditChecks, calculateScore };
