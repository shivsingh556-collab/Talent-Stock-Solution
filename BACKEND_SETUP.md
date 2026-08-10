# Talent Buddy Backend Setup

The repository now contains a Supabase-ready backend structure. The current Vercel app keeps working with localStorage until Supabase is configured, so the manager demo is not blocked.

## Backend scope
- Recruiter/admin authentication
- Role-based access
- Clients and requirements
- Mandatory/preferred/AI-suggested skills
- Permanent candidate library
- Resume versions and protected storage
- Duplicate checks by email, phone and resume hash
- Screening history
- Recruiter decisions and notes
- Existing-CV rematching table
- Interviews
- Activity logs

## Connect Supabase
1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. Create a private Storage bucket named `candidate-resumes`.
4. Copy `backend/config.example.js` to `backend/config.js` and fill only the project URL and browser-safe anon/publishable key.
5. Add the Supabase JS browser library and `backend/config.js` / `backend/supabase-client.js` to the site before `app.js`.
6. Create users in Supabase Auth. New users receive recruiter role by default. Change the manager/admin user's row in `profiles.role` to `admin`.
7. Test login, requirement read/write, candidate upload, screening save, candidate history and resume access before moving away from localStorage.

## Migration rule
Do not delete the current Vercel/localStorage data. Migrate in stages:
1. requirements
2. candidates
3. screening history
4. resume files
5. recruiter notes / interviews

Only switch the frontend fully to Supabase after record counts and sample records match.

## Security
Never expose the service-role key in frontend code, GitHub or Vercel public environment variables. The browser should use only the anon/publishable key with Row Level Security enabled.
