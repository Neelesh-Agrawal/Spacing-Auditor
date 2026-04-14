/**
 * app.js — Whyframe Spacing Auditor
 * Mode toggle, UI state, render orchestration.
 * Imports: scale.js, audit.js, api.js
 */

import { generateScale } from './scale.js';
import { parseInput, runAuditChecks, calculateScore } from './audit.js';
import { analyzeWithAI } from './api.js';

// ─── STATE ─────────────────────────────────────────────────────────────────

const state = {
  mode: 'generate',
  platform: 'web',
  density: 'default',
  baseUnit: 4,
  scaleType: '4pt-grid',
  steps: 12,
  context: '',
  pastedInput: '',
  generatedScale: [],
  parsedValues: [],
  auditFlags: [],
  score: null,
  aiReasoning: null,
  activeExportTab: 'css-vars',
  isLoading: false,
  aiLoading: false,
  error: null,
  scaleNotes: []
};

// ─── DEBOUNCE ───────────────────────────────────────────────────────────────

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ─── INIT ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  bindModeToggle();
  bindPlatformSelector();
  bindDensitySelector();
  bindGenerateInputs();
  bindAuditInputs();
  bindPresetButtons();
  bindGenerateButton();
  bindAuditButton();
  bindExportTabs();
  renderAll();
});


// ─── MODE TOGGLE ───────────────────────────────────────────────────────────

function bindModeToggle() {
  const btns = document.querySelectorAll('.mode-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const newMode = btn.dataset.mode;
      if (newMode === state.mode) return;
      state.mode = newMode;
      // Reset outputs only
      state.generatedScale = [];
      state.parsedValues = [];
      state.auditFlags = [];
      state.score = null;
      state.aiReasoning = null;
      state.scaleNotes = [];
      state.error = null;
      renderAll();
    });

    // Keyboard: arrow keys to switch
    btn.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const allBtns = [...document.querySelectorAll('.mode-btn')];
        const idx = allBtns.indexOf(btn);
        const next = e.key === 'ArrowRight'
          ? allBtns[(idx + 1) % allBtns.length]
          : allBtns[(idx - 1 + allBtns.length) % allBtns.length];
        next.click();
        next.focus();
      }
    });
  });
}

// ─── PLATFORM SELECTOR ─────────────────────────────────────────────────────

function bindPlatformSelector() {
  document.querySelectorAll('input[name="platform"]').forEach(radio => {
    radio.addEventListener('change', () => {
      state.platform = radio.value;
      // Reset base unit to platform default
      state.baseUnit = 4;
      updateSliderUI();
      updateSwiftTabVisibility();
      renderAll();
    });
  });
}

// ─── DENSITY SELECTOR ──────────────────────────────────────────────────────

function bindDensitySelector() {
  document.querySelectorAll('input[name="density"]').forEach(radio => {
    radio.addEventListener('change', () => {
      state.density = radio.value;
      // Density affects AI reasoning only
    });
  });
}

// ─── GENERATE INPUTS ───────────────────────────────────────────────────────

function bindGenerateInputs() {
  const slider = document.getElementById('base-unit-slider');
  const numberIn = document.getElementById('base-unit-number');

  if (slider) {
    const debouncedUpdate = debounce(() => {
      state.baseUnit = parseInt(slider.value, 10);
      updateSliderFill(slider);
    }, 150);

    slider.addEventListener('input', () => {
      numberIn.value = slider.value;
      debouncedUpdate();
    });
  }

  if (numberIn) {
    numberIn.addEventListener('input', () => {
      let val = parseInt(numberIn.value, 10);
      if (isNaN(val)) return;
      val = Math.max(2, Math.min(16, val));
      slider.value = val;
      state.baseUnit = val;
      updateSliderFill(slider);
    });
  }

  const scaleSelect = document.getElementById('scale-type');
  if (scaleSelect) {
    scaleSelect.addEventListener('change', () => {
      state.scaleType = scaleSelect.value;
    });
  }

  // Segmented control for steps
  document.querySelectorAll('.seg-btn[data-steps]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.steps = parseInt(btn.dataset.steps, 10);
      document.querySelectorAll('.seg-btn[data-steps]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });

    btn.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const allBtns = [...document.querySelectorAll('.seg-btn[data-steps]')];
        const idx = allBtns.indexOf(btn);
        const next = e.key === 'ArrowRight'
          ? allBtns[(idx + 1) % allBtns.length]
          : allBtns[(idx - 1 + allBtns.length) % allBtns.length];
        next.click();
        next.focus();
      }
    });
  });

  const ctxArea = document.getElementById('context-area');
  if (ctxArea) {
    ctxArea.addEventListener('input', () => {
      state.context = ctxArea.value;
      updateCharCounter('context-counter', ctxArea.value, 300);
      autoResizeTextarea(ctxArea);
      // Sync audit textarea
      const auditCtx = document.getElementById('context-area-audit');
      if (auditCtx) auditCtx.value = ctxArea.value;
    });
  }
}


// ─── AUDIT INPUTS ──────────────────────────────────────────────────────────

function bindAuditInputs() {
  const pasteArea = document.getElementById('paste-area');
  if (pasteArea) {
    pasteArea.addEventListener('input', () => {
      state.pastedInput = pasteArea.value;
      updateCharCounter('paste-counter', pasteArea.value, 5000);
      autoResizeTextarea(pasteArea);
      pasteArea.classList.remove('error');
      clearInlineError('paste-error');
    });
  }

  const auditCtxArea = document.getElementById('context-area-audit');
  if (auditCtxArea) {
    auditCtxArea.addEventListener('input', () => {
      state.context = auditCtxArea.value;
      // Sync generate textarea
      const genCtx = document.getElementById('context-area');
      if (genCtx) {
        genCtx.value = auditCtxArea.value;
        updateCharCounter('context-counter', auditCtxArea.value, 300);
      }
    });
  }
}

// ─── PRESET EXAMPLES ───────────────────────────────────────────────────────

const PRESETS = {
  broken: {
    label: 'Broken system',
    description: 'Arbitrary values picked by eye — magic numbers, odd values, no grid alignment.',
    values: '3, 7, 11, 13, 19, 23, 31, 50, 95'
  },
  messy: {
    label: 'Messy system',
    description: 'Started on a grid but drifted — near-duplicates, missing steps, too many tokens.',
    values: '4, 8, 12, 14, 16, 24, 28, 32, 46, 64, 80, 96, 128, 200'
  },
  clean: {
    label: 'Clean system',
    description: 'Textbook 4pt grid — consistent ratios, right token count, solid base.',
    values: '0, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192'
  }
};

function bindPresetButtons() {
  document.querySelectorAll('.try-btn[data-preset]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const preset = PRESETS[btn.dataset.preset];
      if (!preset) return;

      // Switch to Audit mode
      if (state.mode !== 'audit') {
        state.mode = 'audit';
        state.generatedScale = [];
        state.parsedValues = [];
        state.auditFlags = [];
        state.score = null;
        state.aiReasoning = null;
        state.scaleNotes = [];
        state.error = null;
        renderAll();
      }

      // Fill textarea
      const pasteArea = document.getElementById('paste-area');
      if (pasteArea) {
        pasteArea.value = preset.values;
        state.pastedInput = preset.values;
        updateCharCounter('paste-counter', preset.values, 5000);
        pasteArea.classList.remove('error');
        clearInlineError('paste-error');
        // Briefly highlight the textarea to signal it was filled
        pasteArea.style.borderColor = 'var(--purple)';
        setTimeout(() => { pasteArea.style.borderColor = ''; }, 800);
      }

      // Auto-run audit
      await handleAudit();
    });
  });
}

// ─── GENERATE BUTTON ───────────────────────────────────────────────────────

function bindGenerateButton() {
  const btn = document.getElementById('generate-btn');
  if (!btn) return;
  btn.addEventListener('click', handleGenerate);
}

async function handleGenerate() {
  setLoading('generate', true);

  // Run scale math synchronously
  const { tokens, notes } = generateScale(
    state.baseUnit,
    state.scaleType,
    state.steps,
    state.platform
  );
  state.generatedScale = tokens;
  state.scaleNotes = notes;
  state.error = null;

  renderOutputPanel();
  renderExportPanel();
  setLoading('generate', false);

  // Now run AI in background
  state.aiReasoning = null;
  state.aiLoading = true;
  renderAIPanel();

  const values = tokens.map(t => t.px);
  const result = await analyzeWithAI({
    mode: 'generate',
    platform: state.platform,
    density: state.density,
    context: state.context,
    values,
    scaleType: state.scaleType,
    baseUnit: state.baseUnit
  });

  state.aiLoading = false;
  state.aiReasoning = result;
  renderAIPanel();
}

// ─── AUDIT BUTTON ──────────────────────────────────────────────────────────

function bindAuditButton() {
  const btn = document.getElementById('audit-btn');
  if (!btn) return;
  btn.addEventListener('click', handleAudit);
}

async function handleAudit() {
  const pasteArea = document.getElementById('paste-area');
  const rawInput = pasteArea ? pasteArea.value : '';

  // Validate
  if (!rawInput.trim()) {
    pasteArea && pasteArea.classList.add('error');
    showInlineError('paste-error', 'Paste some spacing values to audit');
    return;
  }

  if (rawInput.length > 5000) {
    pasteArea && pasteArea.classList.add('error');
    showInlineError('paste-error', 'Input too long — paste up to 5000 characters');
    return;
  }

  setLoading('audit', true);

  // Parse
  const { values, warnings, error } = parseInput(rawInput);

  if (error || values.length === 0) {
    state.error = error || 'No spacing values found. Try: 4, 8, 16, 32';
    state.parsedValues = [];
    state.auditFlags = [];
    state.score = null;
    renderOutputPanel();
    setLoading('audit', false);
    return;
  }

  // Edge cases
  if (values.length === 1 && values[0] === 0) {
    state.error = '0 is not a spacing system — add at least one non-zero value';
    state.parsedValues = [];
    state.auditFlags = [];
    state.score = null;
    renderOutputPanel();
    setLoading('audit', false);
    return;
  }

  // Check all identical
  const uniqueVals = [...new Set(values)];
  if (uniqueVals.length === 1) {
    state.error = `All values are the same (${uniqueVals[0]}px) — a spacing system needs variation`;
    state.parsedValues = values;
    state.auditFlags = [];
    state.score = 0;
    renderOutputPanel();
    setLoading('audit', false);
    return;
  }

  state.parsedValues = values;
  state.scaleNotes = warnings;
  state.error = null;

  // Run 10 checks
  const checks = runAuditChecks(values, state.platform);
  state.auditFlags = checks;

  // Calculate score
  const scoreResult = calculateScore(checks, values);
  state.score = scoreResult;

  // Build token objects for export + table
  state.generatedScale = values.map((px, i) => {
    const pxR = Math.round(px);
    const remRaw = (pxR / 16).toFixed(3).replace(/\.?0+$/, '');
    const pt = Math.round(pxR / 2);
    return { name: `space-${i}`, px: pxR, rem: remRaw, pt };
  });

  renderOutputPanel();
  renderExportPanel();
  setLoading('audit', false);

  // AI in background
  state.aiReasoning = null;
  state.aiLoading = true;
  renderAIPanel();

  const result = await analyzeWithAI({
    mode: 'audit',
    platform: state.platform,
    density: state.density,
    context: state.context,
    values,
    auditFlags: checks,
    score: scoreResult.score
  });

  state.aiLoading = false;
  state.aiReasoning = result;
  renderAIPanel();
}

// ─── EXPORT TABS ───────────────────────────────────────────────────────────

function bindExportTabs() {
  document.querySelectorAll('.export-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeExportTab = btn.dataset.tab;
      updateExportTabsUI();
      renderActiveExportTab();
    });

    btn.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const allBtns = [...document.querySelectorAll('.export-tab-btn:not(.hidden)')];
        const idx = allBtns.indexOf(btn);
        const next = e.key === 'ArrowRight'
          ? allBtns[(idx + 1) % allBtns.length]
          : allBtns[(idx - 1 + allBtns.length) % allBtns.length];
        next.click();
        next.focus();
      }
    });
  });
}

// ─── RENDER ORCHESTRATION ──────────────────────────────────────────────────

function renderAll() {
  renderModeButtons();
  renderModePanel();
  renderOutputPanel();
  renderExportPanel();
  renderAIPanel();
}

function renderModeButtons() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    const isActive = btn.dataset.mode === state.mode;
    btn.classList.toggle('active', isActive);
    btn.classList.toggle('inactive', !isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function renderModePanel() {
  const generatePanel = document.getElementById('generate-panel');
  const auditPanel = document.getElementById('audit-panel');
  if (generatePanel) generatePanel.classList.toggle('hidden', state.mode !== 'generate');
  if (auditPanel) auditPanel.classList.toggle('hidden', state.mode !== 'audit');
}

// ─── OUTPUT PANEL ──────────────────────────────────────────────────────────

function renderOutputPanel() {
  const hasData = state.generatedScale.length > 0 || state.parsedValues.length > 0;
  const tokens = state.generatedScale;

  // Error state
  const errorEl = document.getElementById('output-error');
  if (errorEl) {
    if (state.error) {
      errorEl.textContent = state.error;
      errorEl.classList.remove('hidden');
    } else {
      errorEl.classList.add('hidden');
    }
  }

  // Notes/warnings
  renderScaleNotes();

  // Token table
  renderTokenTable(tokens);

  // Bar chart
  renderBarChart(tokens);
  renderSpacingPlayground(tokens);

  // Health score (audit only)
  const scoreSection = document.getElementById('score-section');
  if (scoreSection) {
    scoreSection.classList.toggle('hidden', state.mode !== 'audit' || !state.score);
    if (state.mode === 'audit' && state.score) {
      renderHealthScore(state.score);
    }
  }

  // Audit flags (audit only)
  const flagsSection = document.getElementById('flags-section');
  if (flagsSection) {
    flagsSection.classList.toggle('hidden', state.mode !== 'audit');
    if (state.mode === 'audit') {
      renderAuditFlags(state.auditFlags);
    }
  }

  // Empty output state
  const emptyOutput = document.getElementById('output-empty');
  if (emptyOutput) {
    emptyOutput.classList.toggle('hidden', hasData || !!state.error);
  }

  // Sections visibility
  const tableSection = document.getElementById('table-section');
  const chartSection = document.getElementById('chart-section');
  const playgroundSection = document.getElementById('spacing-playground-section');
  if (tableSection) tableSection.classList.toggle('hidden', !hasData);
  if (chartSection) chartSection.classList.toggle('hidden', !hasData);
  if (playgroundSection) playgroundSection.classList.toggle('hidden', !hasData);
}

// ─── SCALE NOTES ───────────────────────────────────────────────────────────

function renderScaleNotes() {
  const el = document.getElementById('scale-notes');
  if (!el) return;
  if (!state.scaleNotes || state.scaleNotes.length === 0) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = state.scaleNotes.map(n =>
    `<div class="note-item">⚠ ${escHtml(n)}</div>`
  ).join('');
}

// ─── TOKEN TABLE ───────────────────────────────────────────────────────────

function renderTokenTable(tokens) {
  const tbody = document.getElementById('token-tbody');
  const ptCol = document.querySelectorAll('.pt-col');
  const remCols = document.querySelectorAll('.rem-col');
  const isMobile = state.platform === 'mobile';

  // Mobile: show pt, optionally hide rem on very small
  ptCol.forEach(el => el.classList.toggle('hidden', !isMobile));

  if (!tbody) return;
  if (!tokens || tokens.length === 0) {
    tbody.innerHTML = '';
    return;
  }

  tbody.innerHTML = tokens.map(t => `
    <tr data-px="${t.px}" title="Click to copy ${t.px}px">
      <td class="name-col">${escHtml(t.name)}</td>
      <td>${t.px}px</td>
      <td class="rem-col">${t.rem}rem</td>
      ${isMobile ? `<td class="pt-col">${t.pt}pt</td>` : ''}
      <td class="copy-hint">copy</td>
    </tr>
  `).join('');

  // Copy on click
  tbody.querySelectorAll('tr').forEach(row => {
    row.addEventListener('click', () => {
      const px = row.dataset.px;
      copyToClipboard(`${px}px`, `Copied ${px}px`);
    });
  });
}

// ─── BAR CHART ─────────────────────────────────────────────────────────────

function renderBarChart(tokens) {
  const container = document.getElementById('bar-chart');
  if (!container) return;

  if (!tokens || tokens.length === 0) {
    container.innerHTML = '';
    return;
  }

  const maxPx = Math.max(...tokens.map(t => t.px), 1);
  const MIN_BAR = 4; // px min width for non-zero

  container.innerHTML = tokens.map(t => {
    let widthPct = 0;
    if (t.px > 0) {
      widthPct = Math.max((t.px / maxPx) * 100, (MIN_BAR / container.clientWidth) * 100);
      widthPct = Math.min(widthPct, 100);
    }
    return `
      <div class="bar-row">
        <span class="bar-name" title="${escHtml(t.name)}">${escHtml(t.name)}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${widthPct.toFixed(2)}%"></div>
        </div>
        <span class="bar-value">${t.px}px</span>
      </div>
    `;
  }).join('');

  // Animate bars in
  requestAnimationFrame(() => {
    container.querySelectorAll('.bar-fill').forEach((b, i) => {
      b.style.transitionDelay = `${i * 30}ms`;
    });
  });
}

// ─── SPACING PLAYGROUND ─────────────────────────────────────────────────────

function renderSpacingPlayground(tokens) {
  const container = document.getElementById('spacing-playground');
  if (!container) return;

  if (!tokens || tokens.length === 0) {
    container.innerHTML = '';
    return;
  }

  const positiveValues = [...new Set(tokens.map(t => t.px).filter(v => v > 0))].sort((a, b) => a - b);
  if (positiveValues.length === 0) {
    container.innerHTML = `<div class="playground-empty">No positive spacing values to preview.</div>`;
    return;
  }

  const samples = buildSampleValues(positiveValues);
  const anchors = buildPreviewAnchors(positiveValues);
  const [tight, component, section, layout] = anchors;
  const largest = Math.max(...positiveValues, 1);
  const smallest = Math.min(...positiveValues);

  const markerItems = samples.map((value, idx) => {
    const leftPct = largest === smallest ? 0 : ((value - smallest) / (largest - smallest)) * 100;
    const lane = idx % 2;
    return `<div class="scale-marker lane-${lane}" style="left:${leftPct.toFixed(2)}%" title="${value}px">
      <span class="scale-dot"></span>
    </div>`;
  }).join('');

  const midValue = anchors[2];
  const scaleLegend = `
    <div class="scale-legend">
      <span>${smallest}px</span>
      <span>${midValue}px</span>
      <span>${largest}px</span>
    </div>
  `;

  const meaningItems = anchors.map(value => `
    <div class="meaning-item">
      <span class="meaning-value">${value}px</span>
      <span class="meaning-text">${getSpacingMeaning(value)}</span>
    </div>
  `).join('');

  const tightVisual = normalizePreviewSpace(tight, largest, 8, 22);
  const componentVisual = normalizePreviewSpace(component, largest, 8, 28);
  const sectionVisual = normalizePreviewSpace(section, largest, 14, 40);
  const layoutVisual = normalizePreviewSpace(layout, largest, 20, 56);

  container.innerHTML = `
    <div class="playground-grid">
      <div class="playground-block">
        <div class="playground-block-title">Scale at a glance</div>
        <div class="playground-block-note">Each marker is one of your spacing tokens on a low-to-high ruler.</div>
        <div class="scale-track-wrap">
          <div class="scale-track"></div>
          ${markerItems}
        </div>
        ${scaleLegend}
        <div class="meaning-list">${meaningItems}</div>
      </div>
      <div class="playground-block">
        <div class="playground-block-title">Real UI examples</div>
        <div class="playground-block-note">How your tokens feel in actual interface patterns.</div>
        <div class="example-list">
          <div class="example-row">
            <div class="example-meta"><span>${tight}px</span><small>Tight control gap</small></div>
            <div class="example-preview toolbar-preview" style="--space:${tightVisual}px">
              <span class="tiny-chip"></span><span class="tiny-chip"></span><span class="tiny-chip"></span>
            </div>
          </div>
          <div class="example-row">
            <div class="example-meta"><span>${component}px</span><small>Component spacing</small></div>
            <div class="example-preview card-preview" style="--space:${componentVisual}px">
              <div class="card-line long"></div>
              <div class="card-line short"></div>
              <div class="card-line medium"></div>
            </div>
          </div>
          <div class="example-row">
            <div class="example-meta"><span>${section}px</span><small>Section spacing</small></div>
            <div class="example-preview section-preview" style="--space:${sectionVisual}px">
              <div class="section-box"></div>
              <div class="section-box second"></div>
            </div>
          </div>
          <div class="example-row">
            <div class="example-meta"><span>${layout}px</span><small>Layout breathing room</small></div>
            <div class="example-preview layout-preview" style="--space:${layoutVisual}px">
              <div class="layout-column"></div>
              <div class="layout-column"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildSampleValues(values) {
  if (values.length <= 6) return values;
  const desiredIndices = [0, 1, Math.floor(values.length / 2) - 1, Math.floor(values.length / 2), values.length - 2, values.length - 1];
  const unique = [...new Set(desiredIndices.map(i => values[Math.max(0, Math.min(values.length - 1, i))]))];
  return unique.sort((a, b) => a - b);
}

function buildPreviewAnchors(values) {
  if (values.length === 1) return [values[0], values[0], values[0], values[0]];
  const i1 = 0;
  const i2 = Math.max(0, Math.floor(values.length * 0.33) - 1);
  const i3 = Math.max(0, Math.floor(values.length * 0.66) - 1);
  const i4 = values.length - 1;
  return [values[i1], values[i2], values[i3], values[i4]];
}

function normalizePreviewSpace(value, maxValue, minPx, maxPx) {
  if (!maxValue || maxValue <= 0) return minPx;
  const normalized = (value / maxValue) * maxPx;
  return Math.max(minPx, Math.min(maxPx, Math.round(normalized)));
}

function getSpacingMeaning(px) {
  if (px <= 6) return 'Micro spacing: icon + label alignment';
  if (px <= 12) return 'Compact spacing: buttons and dense controls';
  if (px <= 24) return 'Comfortable spacing: card content';
  if (px <= 48) return 'Section spacing: block-to-block rhythm';
  return 'Layout spacing: major page separation';
}

// ─── HEALTH SCORE ──────────────────────────────────────────────────────────

function renderHealthScore(scoreResult) {
  const numEl = document.getElementById('score-number');
  const labelEl = document.getElementById('score-label');
  const barEl = document.getElementById('score-bar');
  const breakdownListEl = document.getElementById('breakdown-list');

  if (!numEl) return;

  numEl.textContent = scoreResult.score;
  numEl.className = `score-number ${scoreResult.color}`;
  if (labelEl) labelEl.textContent = scoreResult.label;

  if (barEl) {
    barEl.style.width = `${scoreResult.score}%`;
    barEl.className = `score-bar-fill ${scoreResult.color}`;
  }

  if (breakdownListEl) {
    if (scoreResult.breakdown.length === 0) {
      breakdownListEl.innerHTML = '<div class="breakdown-item"><span>No deductions — perfect score!</span><span></span></div>';
    } else {
      breakdownListEl.innerHTML = scoreResult.breakdown.map(b => `
        <div class="breakdown-item">
          <span>${escHtml(b.reason)}</span>
          <span class="deduction">${b.deduction}</span>
        </div>
      `).join('');
    }
    breakdownListEl.classList.add('hidden');
  }
}

// ─── AUDIT FLAGS ───────────────────────────────────────────────────────────

function renderAuditFlags(flags) {
  const container = document.getElementById('flags-list');
  if (!container) return;

  if (!flags || flags.length === 0) {
    container.innerHTML = `<div class="flags-empty">✓ No issues found — your spacing system looks clean</div>`;
    return;
  }

  const errors   = flags.filter(f => f.severity === 'error');
  const warnings = flags.filter(f => f.severity === 'warning');
  const infos    = flags.filter(f => f.severity === 'info');

  const renderGroup = (items, label) => {
    if (items.length === 0) return '';
    return `
      <div class="flags-section-header">${label} (${items.length})</div>
      ${items.map(f => `
        <div class="flag-item ${f.severity}" role="listitem">
          <div class="flag-dot ${f.severity}" aria-hidden="true"></div>
          <div class="flag-content">
            <div class="flag-severity ${f.severity}">${f.severity}</div>
            <div class="flag-title">${escHtml(f.title)}</div>
            <div class="flag-detail">${escHtml(f.detail)}</div>
            ${f.suggestion ? `<div class="flag-suggestion">→ ${escHtml(f.suggestion)}</div>` : ''}
          </div>
        </div>
      `).join('')}
    `;
  };

  container.innerHTML = `
    <div class="flag-list" role="list" aria-label="Audit flags">
      ${renderGroup(errors, 'Errors')}
      ${renderGroup(warnings, 'Warnings')}
      ${renderGroup(infos, 'Info')}
    </div>
  `;
}

// ─── AI PANEL ──────────────────────────────────────────────────────────────

function renderAIPanel() {
  const panel = document.getElementById('ai-panel');
  if (!panel) return;

  if (state.aiLoading) {
    panel.setAttribute('aria-busy', 'true');
    panel.innerHTML = `
      <div class="skeleton-wrap" aria-label="Loading AI analysis">
        <div class="skeleton-line title"></div>
        <div class="skeleton-line long"></div>
        <div class="skeleton-line medium"></div>
        <div class="skeleton-line title" style="margin-top:12px"></div>
        <div class="skeleton-line long"></div>
        <div class="skeleton-line short"></div>
        <div class="skeleton-line title" style="margin-top:12px"></div>
        <div class="skeleton-line medium"></div>
        <div class="skeleton-line long"></div>
      </div>
    `;
    return;
  }

  panel.setAttribute('aria-busy', 'false');

  if (!state.aiReasoning) {
    panel.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✦</div>
        <div class="empty-state-text">AI reasoning will appear here after generating or auditing your scale.</div>
      </div>
    `;
    return;
  }

  const r = state.aiReasoning;

  if (r._error) {
    panel.innerHTML = `<div class="ai-error" role="alert">⚠ ${escHtml(r._error)}</div>`;
    return;
  }

  const pairingSection = r.pairingNote ? `
    <div class="ai-section">
      <div class="ai-section-title">Platform note</div>
      <div class="ai-section-body">${escHtml(r.pairingNote)}</div>
    </div>
  ` : '';

  panel.innerHTML = `
    <div class="ai-panel">
      <div class="ai-section">
        <div class="ai-section-title">System analysis</div>
        <div class="ai-section-body">${escHtml(r.systemAnalysis || '—')}</div>
      </div>
      <div class="ai-section">
        <div class="ai-section-title">Watch out for</div>
        <div class="ai-section-body">${escHtml(r.watchOutFor || '—')}</div>
      </div>
      <div class="ai-section">
        <div class="ai-section-title">Suggestions</div>
        <div class="ai-section-body">${escHtml(r.suggestions || '—')}</div>
      </div>
      ${pairingSection}
    </div>
  `;
}

// ─── EXPORT PANEL ──────────────────────────────────────────────────────────

function renderExportPanel() {
  updateSwiftTabVisibility();
  updateExportTabsUI();
  // Ensure active tab is visible
  const swiftTab = document.querySelector('[data-tab="swift"]');
  if (swiftTab && swiftTab.classList.contains('hidden') && state.activeExportTab === 'swift') {
    state.activeExportTab = 'css-vars';
  }
  renderActiveExportTab();
}

function updateSwiftTabVisibility() {
  const swiftTab = document.querySelector('[data-tab="swift"]');
  if (swiftTab) swiftTab.classList.toggle('hidden', state.platform !== 'mobile');
}

function updateExportTabsUI() {
  document.querySelectorAll('.export-tab-btn').forEach(btn => {
    const isActive = btn.dataset.tab === state.activeExportTab;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  renderExportUsageHint();
}

const EXPORT_HINTS = {
  'css-vars':    '<strong>How to use:</strong> Paste into your <code>.css</code> file, inside <code>:root { }</code>. Reference with <code>var(--space-1)</code> anywhere in your CSS.',
  'css-classes': '<strong>How to use:</strong> Add the class directly to HTML elements — e.g. <code>&lt;div class="space-4"&gt;</code>. Works without any framework.',
  'tailwind':    '<strong>How to use:</strong> Paste into <code>tailwind.config.js</code> under <code>theme.extend.spacing</code>. Then use <code>p-space-4</code>, <code>mt-space-2</code>, etc.',
  'figma':       '<strong>How to use:</strong> Install the <strong>Figma Tokens</strong> plugin, paste this JSON into a new token set. Values sync to your Figma file automatically.',
  'swift':       '<strong>How to use:</strong> Paste into your Swift project. Use <code>spacing.space2</code> in <code>SwiftUI</code> padding and frame modifiers.',
  'svg':         '<strong>How to use:</strong> Download the file, drag it into Figma. Each bar is an editable vector — use it as a reference sheet in your design file.'
};

function renderExportUsageHint() {
  const el = document.getElementById('export-usage-hint');
  if (!el) return;
  el.innerHTML = EXPORT_HINTS[state.activeExportTab] || '';
}


function renderActiveExportTab() {
  const tokens = state.generatedScale;
  const contentEl = document.getElementById('export-code');
  const actionsEl = document.getElementById('export-actions');

  if (!contentEl) return;

  if (!tokens || tokens.length === 0) {
    contentEl.innerHTML = `
      <div class="empty-state" style="padding: 30px 0">
        <div class="empty-state-text">Generate or audit a scale to see export formats.</div>
      </div>
    `;
    if (actionsEl) actionsEl.classList.add('hidden');
    return;
  }

  if (actionsEl) actionsEl.classList.remove('hidden');

  const tab = state.activeExportTab;
  let code = '';
  let lang = 'css';
  let filename = 'spacing';
  let ext = 'css';

  switch (tab) {
    case 'css-vars':
      code = generateCSSVars(tokens);
      lang = 'css'; ext = 'css'; filename = 'spacing-vars';
      break;
    case 'css-classes':
      code = generateCSSClasses(tokens);
      lang = 'css'; ext = 'css'; filename = 'spacing-classes';
      break;
    case 'tailwind':
      code = generateTailwind(tokens);
      lang = 'javascript'; ext = 'js'; filename = 'tailwind-spacing';
      break;
    case 'figma':
      code = generateFigmaTokens(tokens);
      lang = 'json'; ext = 'json'; filename = 'figma-tokens';
      break;
    case 'swift':
      code = generateSwift(tokens);
      lang = 'swift'; ext = 'swift'; filename = 'Spacing';
      break;
    case 'svg':
      renderSVGExport(tokens);
      return;
  }

  // Use highlight.js if available
  let highlighted;
  if (window.hljs) {
    try {
      highlighted = window.hljs.highlight(code, { language: lang }).value;
    } catch {
      highlighted = escHtml(code);
    }
  } else {
    highlighted = escHtml(code);
  }

  contentEl.innerHTML = `<div class="code-block"><pre><code class="hljs">${highlighted}</code></pre></div>`;

  // Bind copy button
  const copyBtn = document.getElementById('export-copy-btn');
  if (copyBtn) {
    copyBtn.onclick = () => {
      copyToClipboard(code, 'Copied!');
      copyBtn.classList.add('copied');
      copyBtn.textContent = 'Copied ✓';
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyBtn.textContent = 'Copy all';
      }, 2000);
    };
  }

  // Bind download button
  const dlBtn = document.getElementById('export-dl-btn');
  if (dlBtn) {
    dlBtn.onclick = () => downloadFile(code, `${filename}.${ext}`, getMimeType(ext));
  }
}

// ─── SVG EXPORT ─────────────────────────────────────────────────────────────

function renderSVGExport(tokens) {
  const contentEl = document.getElementById('export-code');
  if (!contentEl) return;

  const svg = generateSVG(tokens);

  contentEl.innerHTML = `
    <div style="border: 1px solid rgba(124,58,237,0.15); border-radius:8px; overflow:hidden; background:#fff; padding: 16px;">
      <div style="font-size:11px;color:#9ca3af;font-family:'Space Mono',monospace;margin-bottom:12px;">
        Preview — download to open in Figma as editable vectors
      </div>
      <div id="svg-preview" style="max-height:320px;overflow:auto;">${svg}</div>
    </div>
  `;

  const copyBtn = document.getElementById('export-copy-btn');
  if (copyBtn) {
    copyBtn.onclick = () => {
      copyToClipboard(svg, 'Copied SVG!');
      copyBtn.classList.add('copied');
      copyBtn.textContent = 'Copied ✓';
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyBtn.textContent = 'Copy all';
      }, 2000);
    };
  }

  const dlBtn = document.getElementById('export-dl-btn');
  if (dlBtn) {
    dlBtn.onclick = () => downloadFile(svg, 'spacing-scale.svg', 'image/svg+xml');
  }
}

function generateSVG(tokens) {
  const maxPx = Math.max(...tokens.map(t => t.px), 1);
  const BAR_H = 22;
  const GAP = 8;
  const LABEL_W = 90;
  const BAR_MAX = 280;
  const VALUE_W = 80;
  const PAD = 20;
  const scaleLabel = state.scaleType.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const meta = `Base: ${state.baseUnit}px | Scale: ${scaleLabel} | Platform: ${state.platform.charAt(0).toUpperCase() + state.platform.slice(1)}`;
  const totalH = PAD * 2 + 28 + tokens.length * (BAR_H + GAP);
  const totalW = LABEL_W + BAR_MAX + VALUE_W + PAD * 2;

  const rows = tokens.map((t, i) => {
    const y = PAD + 28 + i * (BAR_H + GAP);
    const barW = t.px > 0 ? Math.max((t.px / maxPx) * BAR_MAX, 4) : 0;
    return `
      <text x="${LABEL_W - 8}" y="${y + BAR_H / 2 + 5}" text-anchor="end" font-family="Space Mono, monospace" font-size="11" fill="#4b5563">${escHtml(t.name)}</text>
      <rect x="${LABEL_W}" y="${y}" width="${barW}" height="${BAR_H}" rx="4" fill="#7c3aed" opacity="${0.75 + (t.px / maxPx) * 0.25}"/>
      <text x="${LABEL_W + barW + 6}" y="${y + BAR_H / 2 + 5}" font-family="Space Mono, monospace" font-size="11" fill="#6b7280">${t.px}px / ${t.rem}rem</text>
    `;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
  <rect width="${totalW}" height="${totalH}" fill="white"/>
  <text x="${PAD}" y="${PAD + 16}" font-family="Inter, sans-serif" font-size="11" fill="#9ca3af">${escHtml(meta)}</text>
  <line x1="${PAD}" y1="${PAD + 24}" x2="${totalW - PAD}" y2="${PAD + 24}" stroke="#e5e7eb" stroke-width="1"/>
  ${rows}
</svg>`;
}

// ─── EXPORT GENERATORS ──────────────────────────────────────────────────────

function generateCSSVars(tokens) {
  const lines = tokens.map(t => `  --${t.name}: ${t.px}px;`);
  return `:root {\n${lines.join('\n')}\n}`;
}

function generateCSSClasses(tokens) {
  return tokens.map(t => `.${t.name} { margin: ${t.px}px; padding: ${t.px}px; }`).join('\n');
}

function generateTailwind(tokens) {
  const entries = tokens.map(t => `        '${t.name.replace('space-', '')}': '${t.px}px',`).join('\n');
  return `module.exports = {\n  theme: {\n    extend: {\n      spacing: {\n${entries}\n      }\n    }\n  }\n}`;
}

function generateFigmaTokens(tokens) {
  const obj = {};
  tokens.forEach(t => {
    obj[t.name] = { value: String(t.px), type: 'spacing' };
  });
  return JSON.stringify({ spacing: obj }, null, 2);
}

function generateSwift(tokens) {
  const props = tokens.map(t => `  space${t.name.replace('space-', '')}: CGFloat = ${t.pt},  // ${t.px}px`).join('\n');
  return `let spacing = (\n${props}\n)`;
}

// ─── HELPERS ───────────────────────────────────────────────────────────────

function setLoading(target, isLoading) {
  if (target === 'generate') {
    state.isLoading = isLoading;
    const btn = document.getElementById('generate-btn');
    const spinner = document.getElementById('generate-spinner');
    if (btn) {
      btn.disabled = isLoading;
      btn.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    }
    if (spinner) spinner.style.display = isLoading ? 'block' : 'none';
  } else {
    state.isLoading = isLoading;
    const btn = document.getElementById('audit-btn');
    const spinner = document.getElementById('audit-spinner');
    if (btn) {
      btn.disabled = isLoading;
      btn.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    }
    if (spinner) spinner.style.display = isLoading ? 'block' : 'none';
  }
}

function updateSliderUI() {
  const slider = document.getElementById('base-unit-slider');
  const numberIn = document.getElementById('base-unit-number');
  if (slider) {
    slider.value = state.baseUnit;
    updateSliderFill(slider);
  }
  if (numberIn) numberIn.value = state.baseUnit;
}

function updateSliderFill(slider) {
  const min = parseInt(slider.min, 10);
  const max = parseInt(slider.max, 10);
  const val = parseInt(slider.value, 10);
  const pct = ((val - min) / (max - min)) * 100;
  slider.style.setProperty('--fill', `${pct}%`);
}

function updateCharCounter(id, value, max) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = `${value.length} / ${max}`;
  el.classList.toggle('over', value.length > max);
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

function showInlineError(id, msg) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = msg;
    el.classList.remove('hidden');
    el.setAttribute('role', 'alert');
  }
}

function clearInlineError(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

async function copyToClipboard(text, flashMsg) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  showCopyFlash(flashMsg || 'Copied!');
}

function showCopyFlash(msg) {
  const el = document.getElementById('copy-flash');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1800);
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getMimeType(ext) {
  const map = { css: 'text/css', js: 'application/javascript', json: 'application/json', swift: 'text/x-swift', svg: 'image/svg+xml' };
  return map[ext] || 'text/plain';
}

function escHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Score breakdown toggle ────────────────────────────────────────────────

document.addEventListener('click', e => {
  if (e.target && e.target.id === 'breakdown-toggle') {
    const list = document.getElementById('breakdown-list');
    if (list) {
      const isHidden = list.classList.toggle('hidden');
      e.target.textContent = isHidden ? 'Show breakdown' : 'Hide breakdown';
    }
  }
});
