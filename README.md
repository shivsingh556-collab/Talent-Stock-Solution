# Todo AI — TalentStock Recruitment Workspace

Todo AI is TalentStock's authenticated recruitment workspace for job profiles, candidate records, evidence-based resume screening, interviews, recruiter activity and reports. Production is hosted on Vercel and uses Supabase Auth, Postgres, Row Level Security and private Storage.

## Security model

- The public document contains only the sign-in screen. Workspace markup, option lists, feature JavaScript and application styles are fetched only after Supabase `auth.getUser()` verifies the session with the Auth server.
- A verified `@talent-stock.com` user must also have an active row in `public.profiles`. Roles come from that database row, never browser storage or auth metadata.
- Forged legacy `tss_user_session` values are removed during bootstrap and cannot reveal the workspace.
- Candidate, resume, screening, match and interview access is enforced by Supabase RLS. Recruiters see their own records; administrators retain the intended oversight access.
- Resume objects are private and restricted to the uploader's user-ID folder or an administrator.
- Browser cache is isolated by verified user ID and cleared on logout.
- Vercel adds CSP, HSTS, clickjacking protection, MIME sniffing protection, a restrictive permissions policy and no-store rules for the HTML shells.

The browser UI is not the authorization boundary. Supabase RLS remains authoritative for every data operation.

## Repository layout

Every editable file belongs to a named folder. The root contains this README and repository/deployment configuration.

| Path | Purpose |
| --- | --- |
| `src/pages/` | Login page, workspace HTML and candidate interview pages |
| `src/js/` | Application, authentication, screening and retained legacy JavaScript |
| `src/css/` | Login, application and retained legacy styles |
| `src/backend/` | Browser-safe Supabase configuration and client adapter |
| `src/assets/` | Logo and mascot images |
| `scripts/` | Production build |
| `tests/unit/` | Screening, extraction, candidate, realtime and resume-save checks |
| `tests/browser/` | Login, recovery, candidate and interview browser checks |
| `supabase/` | Database schema and dated SQL updates |
| `extensions/naukri-bridge/` | Naukri browser extension |
| `docs/` | Backend setup notes and archived rollback reference |
| `.github/workflows/` | CI and verification workflows |
| `public/` | Generated deployment output, ignored by Git |

The build script lists application sources in execution order. Legacy files are
retained in `src/`; they are not automatically included in production. Source,
tests, database updates, documentation and the extension are outside the deployed
`public/` directory.

## Production build

The build emits three application bundles:

- `app-core.js` — core application workflow
- `app-runtime.js` — post-auth feature modules
- `app-runtime.css` — application styles

`evidence-screening.js` is the standalone screening engine and is loaded separately.

`workspace-shell.html` is generated separately and is requested only after authentication. Legacy timed login renderers and the localhost n8n bridge are not included in the production runtime.

Rebuild after changing application modules:

```bash
node scripts/build-production.mjs
```

The build copies the login-only HTML, standalone scripts, selected late-loaded modules, browser-safe backend client and images into `public/`. It extracts the TalentStock logo asset and never rewrites editable source files. Existing public page URLs (`/`, `/confirm.html`, `/reschedule.html`) are preserved.

The JD parser automatically captures catalogue skills, structured skill sections and custom skills found in requirement cues. Recruiters can edit or add any skill manually; the matching engine does not require that skill to exist in the built-in alias catalogue.

## Verification

Start a static server:

```bash
node scripts/build-production.mjs
python3 -m http.server 4173 --bind 127.0.0.1 --directory public
```

Run logic and browser checks:

```bash
node --test tests/unit/evidence-screening.test.cjs tests/unit/candidate-records.test.cjs tests/unit/realtime-performance.test.cjs
TSS_BASE_URL=http://127.0.0.1:4173/ node tests/browser/browser-smoke.test.cjs
```

All logic checks, including JD skill extraction, can be run with
`node --test tests/unit/*.test.cjs`. Browser checks require Playwright and Chromium:

```bash
npm install --no-save playwright@1.55.0
npx playwright install chromium
```

The browser suite covers forged-session rejection, zero signed-out workspace payload, deferred bundles, mascot containment, no horizontal overflow at 360px/390px/768px, verified-profile boot, single bundle loading and reload stability.

## Database migrations

SQL migrations are stored in `supabase/`. Apply them in chronological order through the Supabase migration workflow. The latest production boundary is `2026-09-13-full-production-hardening.sql`.

## Deployment

Vercel runs `node scripts/build-production.mjs` and serves only `public/`, as configured in `vercel.json`. Run the production build and tests before deployment, verify the preview, then promote the verified commit. Generated bundles should be rebuilt rather than edited or committed. See [Vercel build configuration](https://vercel.com/docs/project-configuration/vercel-json).
