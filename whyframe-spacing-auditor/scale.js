/**
 * scale.js — Whyframe Spacing Auditor
 * Pure math only. Zero DOM. All functions are exported and used by app.js.
 */

/**
 * Snap a value to the nearest multiple of 4.
 * @param {number} n
 * @returns {number}
 */
function snapTo4(n) {
  return Math.round(n / 4) * 4;
}

/**
 * Snap a value to the nearest even integer.
 * @param {number} n
 * @returns {number}
 */
function snapToEven(n) {
  return Math.round(n / 2) * 2;
}

/**
 * Deduplicate an array preserving first occurrence.
 * @param {number[]} arr
 * @returns {number[]}
 */
function dedupe(arr) {
  const seen = new Set();
  return arr.filter(v => {
    if (seen.has(v)) return false;
    seen.add(v);
    return true;
  });
}

/**
 * Generate the 4pt grid base sequence.
 * @returns {number[]}
 */
function gen4ptGrid(steps) {
  const base = [0, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 320, 384, 512];
  return base.slice(0, steps);
}

/**
 * Generate the 8pt grid base sequence.
 * @returns {number[]}
 */
function gen8ptGrid(steps) {
  const base = [0, 8, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 640, 768, 1024];
  return base.slice(0, steps);
}

/**
 * Generate a linear scale: [0, base, base*2, base*3...]
 * @param {number} baseUnit
 * @param {number} steps
 * @returns {number[]}
 */
function genLinear(baseUnit, steps) {
  const vals = [0];
  for (let i = 1; i < steps; i++) {
    vals.push(baseUnit * i);
  }
  return vals;
}

/**
 * Generate a geometric 1.5× scale.
 * value[0]=0, value[1]=base, value[n] = snapToEven(base * 1.5^(n-1))
 * @param {number} baseUnit
 * @param {number} steps
 * @returns {{ values: number[], notes: string[] }}
 */
function genGeometric(baseUnit, steps) {
  const vals = [0, baseUnit];
  for (let i = 2; i < steps; i++) {
    const raw = baseUnit * Math.pow(1.5, i - 1);
    vals.push(snapToEven(raw));
  }
  const unique = dedupe(vals);
  const notes = [];
  if (unique.length < steps) {
    notes.push('Scale compressed — some steps merged due to rounding');
  }
  return { values: unique, notes };
}

/**
 * Generate a Fibonacci-ish scale.
 * Start [base, base], each next = prev1+prev2, snap to nearest 4, prepend 0.
 * Cap at 2000px.
 * @param {number} baseUnit
 * @param {number} steps
 * @returns {{ values: number[], notes: string[] }}
 */
function genFibonacci(baseUnit, steps) {
  const notes = [];
  const raw = [baseUnit, baseUnit];
  while (raw.length < steps + 4) {
    const next = raw[raw.length - 1] + raw[raw.length - 2];
    if (next > 2000) {
      notes.push('Scale capped at 2000px');
      break;
    }
    raw.push(next);
  }
  const snapped = raw.map(v => snapTo4(v));
  const unique = dedupe(snapped);
  const withZero = [0, ...unique];
  const sliced = withZero.slice(0, steps);
  if (sliced.length < steps) {
    notes.push(`Scale compressed — some steps merged due to rounding`);
  }
  return { values: sliced, notes };
}

/**
 * Generate a scale based on type.
 *
 * @param {number} baseUnit
 * @param {"4pt-grid"|"8pt-grid"|"linear"|"geometric"|"fibonacci"} scaleType
 * @param {number} steps - 8, 12, or 16
 * @param {"web"|"mobile"} platform
 * @returns {{ tokens: Array<{name:string, px:number, rem:string, pt:number}>, notes: string[] }}
 */
function generateScale(baseUnit, scaleType, steps, platform) {
  let values = [];
  let notes = [];

  switch (scaleType) {
    case '4pt-grid':
      values = gen4ptGrid(steps);
      break;
    case '8pt-grid':
      values = gen8ptGrid(steps);
      break;
    case 'linear':
      values = genLinear(baseUnit, steps);
      break;
    case 'geometric': {
      const result = genGeometric(baseUnit, steps);
      values = result.values;
      notes = result.notes;
      break;
    }
    case 'fibonacci': {
      const result = genFibonacci(baseUnit, steps);
      values = result.values;
      notes = result.notes;
      break;
    }
    default:
      values = gen4ptGrid(steps);
  }

  // Cap if needed
  if (values.length > steps) {
    values = values.slice(0, steps);
  }

  // Warn if we have fewer unique values than requested
  const unique = dedupe(values);
  if (unique.length < steps && !notes.some(n => n.includes('compressed') || n.includes('capped'))) {
    notes.push(`Only ${unique.length} unique values available for this scale type`);
  }
  values = unique;

  // Build token objects
  const tokens = values.map((px, i) => {
    const pxRounded = Math.round(px);
    const remRaw = (pxRounded / 16).toFixed(3).replace(/\.?0+$/, '');
    const pt = Math.round(pxRounded / 2);
    return {
      name: `space-${i}`,
      px: pxRounded,
      rem: remRaw,
      pt: pt
    };
  });

  return { tokens, notes };
}

// Export for use in app.js via ES module style (works with type="module")
export { generateScale };
