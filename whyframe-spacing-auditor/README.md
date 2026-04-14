# Whyframe — Module 03: Spacing Auditor

> **design reasoning engine** — Generate, audit, and understand your spacing system with AI-powered insights.

![Module 03](https://img.shields.io/badge/Whyframe-Module%2003-7c3aed?style=flat-square)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000?style=flat-square&logo=vercel)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## What it does

| Mode | Description |
|------|-------------|
| **Generate** | Creates a mathematically rigorous spacing scale (4pt grid, 8pt grid, linear, geometric 1.5×, Fibonacci-ish) with token names, px/rem/pt values, and AI reasoning |
| **Audit** | Paste any spacing values (raw numbers, CSS vars, Figma JSON) and get 10 structured checks, a health score 0–100, and AI-powered suggestions |

---

## Project structure

```
whyframe-spacing-auditor/
├── index.html        ← App shell
├── style.css         ← Brand + component styles
├── app.js            ← State, orchestration, render pipeline
├── scale.js          ← Pure math (zero DOM)
├── audit.js          ← Parser + 10 audit checks (zero DOM)
├── api.js            ← Frontend: calls POST /api/analyze only
├── api/
│   └── analyze.js    ← Vercel serverless function
├── .env.example
├── .gitignore
├── vercel.json
└── README.md
```

---

## Quick start (local)

```bash
# 1. Clone / enter project
cd whyframe-spacing-auditor

# 2. Set up env
cp .env.example .env
# Edit .env and add your Groq API key

# 3. Install Vercel CLI (to run serverless locally)
npm install -g vercel

# 4. Run dev server
vercel dev
# Visits: http://localhost:3000
```

> The Groq API key is read **server-side only** via `process.env.GROQ_API_KEY`.  
> It never touches the browser.

---

## Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod

# Set environment variable in Vercel dashboard or CLI:
vercel env add GROQ_API_KEY
```

Then verify:
```bash
curl -X POST https://your-project.vercel.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"mode":"generate","platform":"web","density":"default","context":"test","values":[4,8,16,32],"scaleType":"4pt-grid","baseUnit":4}'
```
Should return `200` with `systemAnalysis`, `watchOutFor`, `suggestions`.

---

## Security

| Rule | Status |
|------|--------|
| `GROQ_API_KEY` in `.env` only | ✅ |
| `.env` in `.gitignore` | ✅ |
| API key read only in `api/analyze.js` (server-side) | ✅ |
| Frontend `api.js` only calls `/api/analyze` | ✅ |
| Raw Groq errors never returned to client | ✅ |
| Key never appears in browser Network tab | ✅ |

---

## Features

### Generate mode
- **5 scale types**: 4pt Grid, 8pt Grid, Linear, Geometric 1.5×, Fibonacci-ish
- **Configurable**: base unit slider (2–16px), 8/12/16 steps
- **Outputs**: token table (px/rem/pt), visual bar chart, AI reasoning

### Audit mode
- **4 input formats**: raw numbers, CSS custom properties, Figma Tokens JSON, mixed
- **10 checks**: base unit, magic numbers, gaps, near-duplicates, token count, mobile minimum, large jumps, base presence, scaling pattern, odd values
- **Health score**: 0–100 with labeled breakdown
- **Platform-aware**: different thresholds for Web vs Mobile

### Export formats
- CSS Variables (`:root { --space-1: 4px; }`)
- CSS Classes (`.space-1 { margin: 4px; padding: 4px; }`)
- Tailwind config (`theme.extend.spacing`)
- Figma Tokens JSON
- Swift (mobile platform only)
- SVG (downloads as editable Figma vectors)

---

## Design

Follows the Whyframe `DESIGN.md` spec:
- **Background**: animated gradient purple → amber → green → white, 12s loop
- **Cards**: `backdrop-filter: blur(16px)` glassmorphism, white border
- **Accent**: `#7c3aed` purple
- **Fonts**: Inter (UI), Space Mono (tokens/code)

---

## Groq API

- **Model**: `llama-3.3-70b-versatile`
- **Endpoint**: `https://api.groq.com/openai/v1/chat/completions`
- **Max tokens**: 1000
- **Timeout**: 15s client-side

Get a free key at [console.groq.com](https://console.groq.com).

---

## Test checklist

- [ ] Generate mode produces correct values for all 5 scale types
- [ ] Audit mode parses all 4 input formats correctly
- [ ] All 10 checks fire on appropriate inputs
- [ ] Health score never goes below 0 or above 100
- [ ] All 5 export formats copy and download correctly
- [ ] Swift tab hidden on Web platform
- [ ] Responsive layout works at 375px, 768px, 1280px
- [ ] API key never appears in browser DevTools network tab
- [ ] Error states display correctly without breaking layout
- [ ] AI reasoning shows skeleton → then content (not a blank flash)

---

Part of the **Whyframe** design reasoning engine — modules 01 (Color), 02 (Type Scale), 03 (Spacing).
