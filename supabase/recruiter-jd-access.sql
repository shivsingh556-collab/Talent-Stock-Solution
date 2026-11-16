-- Active recruiters can add JDs and edit shared requirements.
-- Keep active-employee enforcement and existing delete permissions.
alter policy "requirements creator or admin update" on public.requirements
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));
