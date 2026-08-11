-- Allow a recruiter to permanently delete candidates they own; admins can delete any candidate.
-- Related relational records are removed automatically by ON DELETE CASCADE / SET NULL rules.
-- Resume files in Storage are deleted by the frontend before the candidate row is removed.

drop policy if exists "candidates owner or admin delete" on public.candidates;
create policy "candidates owner or admin delete"
on public.candidates
for delete
to authenticated
using (uploaded_by = auth.uid() or public.is_admin());
