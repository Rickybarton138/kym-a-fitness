# Kym A Fitness — AI coaching app

**One-liner:** Fully working AI coaching PWA for Kym (Ricky's wife, a PT / "Kym A Fitness") and her clients. Kym is the live design-partner; her clients train at South Coast Power House. Grown from the `thryve-prototype` gym demo.

**Owner:** Ricky (rickybarton138@btinternet.com)

**Tech stack:** Vite + React (JSX) + plain CSS · Supabase (auth + Postgres + RLS) · Netlify Functions → Claude `claude-opus-4-8` (vision + text). No TypeScript.

## Backend (Supabase)
- Project: **kym-a-fitness** — ref `ezwmfbuuopsnpanebtal`, region eu-west-2, org PRIME HAUL LEADS.
- URL/anon key hardcoded as fallback in `src/supabaseClient.js` (publishable key — safe; RLS protects data). Also in `.env` as VITE_ vars.
- Tables: `profiles` (role trainer/client, trainer_id, trainer_code), `macro_targets`, `nutrition_logs`, `workout_plans`, `body_measurements`. RLS: clients CRUD own rows; trainer reads/manages their clients (via `is_my_client()`). Trigger `on_auth_user_created` → `handle_new_user()` auto-creates a profile (trainer gets a code; client links via `trainer_code` in signup metadata + seeds default macro targets).

## Roles / onboarding
- Kym signs up as **coach** → gets a `trainer_code`. Clients sign up as **client** + enter her code → linked to her.
- **IMPORTANT: email confirmation must be OFF** for smooth onboarding (Supabase Auth → Email → uncheck "Confirm email"), or configure custom SMTP. Default-on + built-in mailer rate limit blocks signups.
- Test coach account (seeded via SQL): `kymtest@kymafit.app` / `TestPass123` (code 94BA86).

## Structure
- `src/App.jsx` — session router (auth → role → ClientApp/TrainerApp)
- `src/auth.jsx`, `src/ClientApp.jsx` (Home/Train/Fridge/Meal/Body, DB-backed), `src/TrainerApp.jsx` (dashboard + client detail)
- `src/ui.jsx` (shared components/icons), `src/lib.js`, `src/themes.js` (Kym branding — PLACEHOLDER pending real logo/colours; training defaults to Power House kit), `src/supabaseClient.js`
- `netlify/functions/analyze.mjs` — Claude proxy (fridge/meal/workout modes)

## Run
- `npm run dev` (port 5220) — UI + auth/DB work (AI needs the function)
- `netlify dev` (port 8899) — everything, needs `ANTHROPIC_API_KEY` in `.env`
- **`npm run build:paul`** (or `build:kim` / `build:pph` / `build:elev8`) — ALWAYS build
  with the per-brand script before deploying. `npx vite build` skips
  `scripts/brand-html.mjs`, and plain `npm run build` defaults to BRAND=kim, so
  either one ships Kim's title, icon, link preview and PWA install name to
  whichever site you deploy to. The runtime brand still comes from the hostname
  (HOST_BRAND in `src/themes.js`) — this only stamps the static metadata that
  crawlers and "add to home screen" read.
- Deploy Paul: `npm run build:paul` then
  `npx netlify deploy --dir dist --site bda91296-2224-4923-b91c-d6482971eab1`
  (this folder is linked to Kim's site, so `--site` is not optional), then promote
  the draft with `npx netlify api restoreSiteDeploy`.

## Agent rules
Plan for 3+ steps; verify before done (build + drive it); simplicity first; after corrections update `tasks/lessons.md`.
