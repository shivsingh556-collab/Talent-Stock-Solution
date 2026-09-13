# TODO AI — Talent Stock Recruitment Workspace

TODO AI is the internal recruitment operations and resume-screening workspace used by Talent Stock Solutions.

## Current architecture
- **Frontend:** static web application deployed on Vercel
- **Authentication:** Supabase Auth using Talent Stock company accounts
- **Database:** Supabase Postgres for requirements, candidates, screenings, interviews and profiles
- **Resume storage:** Supabase Storage
- **Realtime / hydration:** browser runtime modules keep recruiter views synchronized with Supabase-backed records
- **Local browser storage:** used only as a UI/cache compatibility layer; it is not an authorization source

## Main workflows
- Requirement / Job Profile management
- JD upload, paste and extraction
- Quick Screening for recruiters
- Detailed resume screening and scoring
- Candidate CV Library and duplicate handling
- Candidate history and recruiter decisions
- Interview scheduling, lifecycle tracking and outcomes
- Recruitment reports and recruiter/admin activity views

## Access model
Workspace access must be backed by a verified Supabase session. Browser `localStorage` must never be treated as proof of authentication.

Quick Screening is intentionally limited to:
- users whose profile role is `recruiter`
- `info@talent-stock.com`

Other admin/management views continue to use their existing role-based access rules.

Supabase Row Level Security (RLS) remains the authoritative control for database and storage access. Frontend visibility rules are only a UX layer and must not replace RLS.

## Deployment
The production project is connected to this GitHub repository through Vercel. Merges to `main` create the production deployment; feature branches create preview deployments for validation before merge.

## Production quality priorities
1. Verified-session authentication and permission isolation
2. Stable login rendering with a single Todo mascot implementation
3. Progressive consolidation of legacy patch scripts and CSS overrides
4. End-to-end tests for screening, persistence, interviews, logout and role isolation
5. Responsive QA across mobile, tablet and desktop widths
