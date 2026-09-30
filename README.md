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

| Path | Purpose |
| --- | --- |
| `src/js/` | Editable application modules, including retained legacy modules |
| `src/css/` | Editable application and legacy styles |
| `scripts/` | Production bundle build |
| `tests/unit/` | Screening, extraction, candidate and realtime logic checks |
| `tests/browser/` | Login, recovery, candidate and interview browser checks |
| `backend/` | Browser-safe Supabase configuration and client adapter |
| `supabase/` | Database schema and dated SQL updates |
| `assets/` | Logos and mascot images |
| `naukri-bridge/` | Naukri browser extension |
| `docs/` | Backend setup notes and archived rollback reference |
| `.github/workflows/` | CI and verification workflows |

Public HTML pages, `auth-bootstrap.js`, `confirm.js`, `evidence-screening.js`,
`login-shell.css` and generated bundles remain at the root to preserve existing
page and asset URLs. The build script lists the source files in execution order;
files in `src/` are not automatically included in production.

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

The build also rewrites `index.html` as the public login-only shell and extracts the TalentStock logo asset.

The JD parser automatically captures catalogue skills, structured skill sections and custom skills found in requirement cues. Recruiters can edit or add any skill manually; the matching engine does not require that skill to exist in the built-in alias catalogue.

## Verification

Start a static server:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
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

Vercel serves the repository as a static application; no server-side build command is required. Run the production build script and tests before deployment, deploy a preview, verify the full auth story, then promote the verified commit.
