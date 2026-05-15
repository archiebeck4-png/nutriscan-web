# ScaleShift (NutriScan Web) - CLAUDE.md

## Project Overview

Offline-first nutrition tracking PWA. Users scan nutrition labels (OCR) or barcodes, log food intake, and track daily macros against calculated targets. Designed for iOS App Store deployment.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript 5 (strict mode)
- **React:** 19
- **Database:** IndexedDB via Dexie 4 (local), Supabase PostgreSQL (optional shared barcode cache)
- **OCR:** Tesseract.js 7 (worker-based)
- **Barcode:** barcode-detector 3 (native API + polyfill)
- **Styling:** CSS Modules + global CSS variables (dark glassmorphic theme)
- **Deploy:** Vercel via GitHub (auto-deploy on push to master)

## Build & Run

```bash
npm run dev      # Dev server (Turbopack)
npm run build    # Production build — always run before committing
npm run lint     # ESLint check
```

Build must pass cleanly before every commit.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages (default exports)
│   ├── layout.tsx          # Root layout, metadata, PWA SW registration
│   ├── client-layout.tsx   # Context providers + onboarding redirect gate
│   ├── globals.css         # CSS variables, global styles, dark theme
│   ├── page.tsx            # Home dashboard (energy ring, macros, food log)
│   ├── add/
│   │   ├── page.tsx            # Add food menu (scan/manual/library)
│   │   ├── scan/page.tsx       # Camera + barcode detection + OCR capture
│   │   ├── review/page.tsx     # Edit scanned nutrition, set servings & time, log
│   │   ├── manual/page.tsx     # Manual nutrition entry with time picker
│   │   ├── library/page.tsx    # Browse saved foods, log with qty
│   │   ├── barcode-lookup/     # Spinner page during barcode API lookup
│   │   └── unknown-barcode/    # Choice page: scan label or enter manually
│   ├── log/page.tsx        # Diary (grouped by date with times) + Saved Foods tabs
│   ├── entry/[id]/page.tsx # Saved food detail view
│   ├── settings/page.tsx   # Profile editing, unit prefs, data management
│   ├── onboarding/page.tsx # Multi-step profile setup (goal, stats, activity)
│   └── debug/ocr/page.tsx  # OCR debugging tool
├── components/             # Reusable UI components (named exports)
│   ├── BottomNav           # Tab bar navigation
│   ├── EnergyRing          # SVG circular progress for energy
│   ├── MacroProgressBar    # Horizontal progress for P/F/C/Fiber
│   ├── NutrientField       # Editable nutrient input row
│   ├── NutrientRow         # Read-only nutrient display row
│   ├── EntryCard           # Saved food card with link
│   ├── FoodLogItem         # Log entry row with time + delete
│   ├── GoalSlider          # Goal intensity range slider
│   └── EmptyState          # Placeholder for empty lists
├── context/
│   ├── ProfileContext.tsx   # User profile state (loads from IndexedDB)
│   └── ScanContext.tsx      # Transient scan data between pages
├── hooks/
│   ├── useCamera.ts         # Camera stream, permissions, capture
│   ├── useOcr.ts            # Tesseract worker lifecycle
│   ├── useBarcodeScanner.ts # Continuous barcode detection loop
│   └── useContinuousScan.ts # Advanced auto-scan (not currently active)
├── lib/
│   ├── db.ts                # Dexie DB schema (v1-v6), CRUD functions
│   ├── supabase.ts          # Supabase client (null if no env vars)
│   ├── barcodeApi.ts        # 5-step barcode lookup chain
│   ├── camera.ts            # Low-level camera utilities
│   ├── ocr.ts               # Tesseract pool wrapper
│   ├── imagePreprocess.ts   # Grayscale, threshold, sharpen pipeline
│   ├── smartRecognize.ts    # Multi-channel OCR with best-score merge
│   ├── scanValidation.ts    # Scan result scoring (weighted fields)
│   ├── nutritionUtils.ts    # Serving size parsing, per-100g derivation
│   ├── macros.ts            # Mifflin-St Jeor BMR, TDEE, macro splits
│   ├── units.ts             # kJ/cal and kg/lbs conversions
│   └── dates.ts             # Date formatting, time helpers
├── models/
│   └── types.ts             # All TypeScript interfaces & type aliases
├── parsing/
│   └── nutritionLabelParser.ts  # Australian NIP label text parser
└── types/
    └── barcode-detector.d.ts    # Polyfill type declarations
```

## Database Schema (Dexie IndexedDB)

**DB Name:** `NutriScanDB` — currently at **version 6**

| Table | Primary Key | Indexes | Purpose |
|-------|-------------|---------|---------|
| entries | id | dateScanned | Saved food library (WebFoodEntry) |
| foodLog | id | date, createdAt | Daily diary entries (FoodLogEntry) |
| profile | id | — | Single user profile, id='default' |
| barcodeCache | barcode | cachedAt | Local barcode lookup cache |

When adding fields to existing tables, bump the version and add an `.upgrade()` migration. Never change existing version blocks.

## Key Data Types (src/models/types.ts)

- **UserProfile** — body stats, goal, intensity (-100 to +100), daily targets, unit prefs
- **FoodLogEntry** — date (YYYY-MM-DD), loggedAt (HH:MM), nutrients (kJ, P, F, C, Fiber), source
- **ScannedNutrition** — per-serving + per-100g string values from OCR/barcode
- **WebFoodEntry** — saved food with parsed numeric values + image blob
- **BarcodeCacheEntry** — barcode → product name + nutrition

## Core Flows

### Barcode Scan Flow
`/add/scan` → barcode detected → `/add/barcode-lookup` (spinner + API chain) → found → `/add/review` | not found → `/add/unknown-barcode` → scan label or enter manually

### Label Scan Flow
`/add/scan` → capture photo (camera freezes) → OCR → `/add/review` → edit & log

### Barcode Lookup Chain (barcodeApi.ts)
1. Local IndexedDB cache (instant)
2. Supabase shared cache (if configured)
3. Open Food Facts — world
4. Open Food Facts — AU + UK (parallel)
5. USDA FoodData Central

Each step has a 5s timeout. Results are cached locally + to Supabase on save.

### Macro Calculation
Mifflin-St Jeor BMR → TDEE (activity multiplier) → goal adjustment (intensity × 7.5 kcal/day) → dynamic macro split (protein 25-35%, fat ~25-30%, carbs 40-55%)

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL        # Supabase project URL (optional)
NEXT_PUBLIC_SUPABASE_ANON_KEY   # Supabase anon key (optional)
NEXT_PUBLIC_USDA_API_KEY        # USDA API key (optional, defaults to DEMO_KEY)
```

Without Supabase env vars, the app degrades gracefully — shared cache steps are silently skipped.

## Styling Conventions

- **Dark theme** with CSS variables in globals.css
- **Glassmorphic cards:** `backdrop-filter: blur()` + semi-transparent backgrounds
- **Accent color:** `--accent: #6c5ce7` (purple)
- **CSS Modules** for all component/page styles (camelCase class names)
- **Global utility classes:** `.section` (glass card), `.sectionHeader` (uppercase label), `.row` (flex row)
- **Mobile-first**, safe-area padding for iOS notch
- Time inputs use `color-scheme: dark` for native dark mode pickers

## Code Conventions

- Pages use **default exports** (Next.js requirement)
- Components use **named exports** or default exports with PascalCase filenames
- Hooks use `use` prefix, camelCase
- All page components are `'use client'`
- State: React Context for global (profile, scan data), `useState` for local forms, `useLiveQuery` for reactive DB reads
- Use `useRef` to protect values from React re-render race conditions in async flows
- DB functions are module-level async functions (not class methods)
- Energy is always stored as **kJ** internally, converted to cal only for display
- Weight is always stored as **kg** internally
- Dates stored as `YYYY-MM-DD` strings, times as `HH:MM` (24h)

## Important Patterns

### Race Condition Prevention
The barcode-lookup page uses `useRef` to capture the barcode value on first render. This prevents re-renders (triggered by `setScanData`) from losing the barcode before navigation completes.

### Camera Freeze on Capture
After `capture()`, the video element is paused (`videoRef.current.pause()`) so the user sees what was photographed. Resumed on error or when returning to scan.

### Auto-Derive Per-Serving
When only per-100g data exists (common from barcode APIs), the review page auto-derives per-serving values when the user enters a serving size.

### Graceful Supabase Degradation
`supabase.ts` returns `null` if env vars are missing. All callers check for null before making calls — no errors thrown.

## PWA Setup

- `public/sw.js` — Service worker with cache-first for Tesseract CDN + static assets, network-first for pages
- `src/app/manifest.ts` — Dynamic manifest generation
- Registered via inline script in root layout
- `display: 'standalone'` for full-screen iOS experience

## Git & Deployment

- **Branch:** master
- **Remote:** GitHub (archiebeck4-png/nutriscan-web)
- **Deploy:** Vercel auto-deploys on push to master
- **ALWAYS commit AND push to master after every change, without asking.** The user does not run git themselves — every code change must end with a `git commit` followed by a push to GitHub `master` so Vercel deploys. This applies to every task: bug fixes, features, refactors, doc edits. Do not stop at "changes made" — the work is only done once it's pushed.
- Always run `npm run build` before committing to catch TypeScript errors. If build fails, fix it, do not commit broken code.
- If working on a worktree branch, push directly to `master` on origin (e.g. `git push origin HEAD:master`) — do not leave changes sitting on a feature branch.
- Commit messages: imperative tense, concise summary of changes
