-- Permit record-only client interviews for all active TSS team members.
-- Existing row ownership policies and candidate email suppression stay in force.
begin;
do $$
declare definition text;
begin
  definition:=pg_get_functiondef('private.guard_interview_scheduling_source()'::regprocedure);
  if position('not private.is_admin()' in definition)>0 then
    definition:=replace(definition,'not private.is_admin()','not private.is_active_user()');
    definition:=replace(definition,
      'Only admins and super admins can record client-scheduled interviews.',
      'Only active TSS team members can record client-scheduled interviews.');
    execute definition;
  elsif position('not private.is_active_user()' in definition)=0 then
    raise exception 'Unexpected interview permission guard; review before applying.';
  end if;
end $$;
commit;
