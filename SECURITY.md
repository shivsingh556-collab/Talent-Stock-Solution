# Security policy — TODO AI (Talent-Stock-Solution)

This repository powers the Talent Stock Solutions recruiter workspace at
https://todo-resume-intelligence.vercel.app

## Report a vulnerability

Email the maintainer (GitHub: [@shivsingh556-collab](https://github.com/shivsingh556-collab))
or open a **private** security advisory:
https://github.com/shivsingh556-collab/Talent-Stock-Solution/security/advisories/new

Do **not** file a public issue for a live leak (API keys, passwords, candidate PII).

## Incident: Google API key in git history (open)

GitHub secret scanning alert #1 is **open** and marked **publicly leaked**.

- Type: Google API key (`AIza…`)
- First seen in: `firebase-applet-config.json` (file later deleted from `main`)
- Alert: https://github.com/shivsingh556-collab/Talent-Stock-Solution/security/secret-scanning/1

Deleting the file is **not** enough. The key is still in git history and on the public internet.

### Do this now (you, in Google Cloud — Grok cannot rotate keys for you)

1. Open [Google Cloud Console → APIs & Credentials](https://console.cloud.google.com/apis/credentials).
2. Find the leaked browser key and **restrict or delete it**:
   - Application restriction: HTTP referrers only (`https://todo-resume-intelligence.vercel.app/*`)
   - API restriction: only the APIs this app actually uses
   - Or **regenerate** the key and delete the old one.
3. Confirm no Firebase/Google Maps/Gemini calls fail after rotation.
4. In GitHub: Secret scanning alert #1 → **Revoked**.
5. Optional (history purge): `git filter-repo` / BFG to drop `firebase-applet-config.json` from all commits, then force-push. Only do this if you understand the rewrite. Rotation is the real fix.

## What is safe to commit

| Item | Commit? |
|---|---|
| Supabase **anon / publishable** key | Yes, if Row Level Security is on |
| Supabase **service_role** key | **Never** |
| Google / Firebase API keys | Prefer env + referrer restrictions; do not commit unrestricted keys |
| Candidate resumes, emails, phones | **Never** |
| `.env`, private keys, `*.pem` | **Never** (see `.gitignore`) |

`backend/config.js` holds the browser publishable key on purpose. RLS in `supabase/*.sql` is the real access control.

## Production checklist

Supabase Dashboard (must be done by a project owner):

- [ ] Authentication → disable public sign-ups **or** attach `hook_restrict_tss_signup` as the Before User Created hook
- [ ] Confirm email: ON
- [ ] Run `supabase/schema.sql` plus every `supabase/2026-*.sql` migration, including `2026-09-06-security-hardening.sql`
- [ ] Storage bucket `candidate-resumes` is **private**
- [ ] No `service_role` key in Vercel env vars that start with `NEXT_PUBLIC_`, `VITE_`, or any client bundle
- [ ] GitHub → Settings → Code security: secret scanning, push protection, Dependabot alerts **on**
- [ ] Consider making this repository **private** (candidate PII product + leaked key still in history)

## Browser / deploy controls (this PR)

- `vercel.json` sends HSTS, CSP, frame denial, nosniff, referrer policy
- `index.html` pins `@supabase/supabase-js` to a specific version with SRI
- CI `security.yml` fails the build if high-risk secret patterns are added
