-- Only admins can permanently delete candidates.
-- Related relational records are removed automatically by ON DELETE CASCADE / SET NULL rules.
-- Resume files in Storage are deleted by the frontend before the candidate row is removed.

drop policy if exists "candidates owner or admin delete" on public.candidates;
drop policy if exists "candidates authenticated delete" on public.candidates;
drop policy if exists "candidates admin delete" on public.candidates;
create policy "candidates admin delete"
on public.candidates
for delete
to authenticated
using ((select public.is_admin()));

