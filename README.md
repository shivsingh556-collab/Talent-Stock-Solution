# Talent Buddy — TSS Resume Screening

A Vercel-ready recruitment screening demo for Talent Stock Solutions.

## Included
- Active requirement dashboard
- Job Profile + JD input
- Upload JD / paste JD / manual skills / AI-suggested skills
- Candidate CV Library with duplicate detection
- Existing CV rematching when requirements are saved
- Resume screening score and explanations
- Manual recruiter decisions and score override
- Candidate screening history
- Excel-compatible export
- Responsive dark UI

## Data persistence
This demo stores data in browser localStorage so it can be demonstrated immediately without a backend account.

For multi-user production use, migrate the same entities to Supabase (Postgres + Auth + Storage) and keep this UI unchanged.

## Deploy on Vercel
Import this GitHub repository in Vercel and deploy with default settings. No build command is required.

## Security

See [SECURITY.md](SECURITY.md).

- Do not commit Supabase **service_role** keys or unrestricted Google API keys.
- GitHub secret scanning alert #1 (Google API key in git history) must be **rotated in Google Cloud**, then marked Revoked.
- After pulling this branch, run `supabase/2026-09-06-security-hardening.sql` in the Supabase SQL editor.
