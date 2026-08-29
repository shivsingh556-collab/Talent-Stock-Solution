-- Automatically record meaningful recruiter/admin business changes in activity_logs.

create or replace function public.log_tss_business_activity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  entity text;
  action_text text;
  info jsonb := '{}'::jsonb;
  changed boolean := true;
begin
  if tg_table_name = 'requirements' then
    entity := coalesce((case when tg_op='DELETE' then old.id else new.id end)::text, '');
    if tg_op = 'UPDATE' then
      changed := row(new.job_title,new.location,new.experience_text,new.salary_range,new.industry,new.qualification,new.responsibilities,new.jd_text,new.status,new.mandatory_skills,new.preferred_skills,new.ai_suggested_skills,new.ai_skills_approved,new.client_owner,new.requirement_handler,new.assigned_recruiters,new.positions_count)
        is distinct from
        row(old.job_title,old.location,old.experience_text,old.salary_range,old.industry,old.qualification,old.responsibilities,old.jd_text,old.status,old.mandatory_skills,old.preferred_skills,old.ai_suggested_skills,old.ai_skills_approved,old.client_owner,old.requirement_handler,old.assigned_recruiters,old.positions_count);
    end if;
    info := jsonb_build_object('tss_id',coalesce(case when tg_op='DELETE' then old.tss_id else new.tss_id end,''),'job_title',coalesce(case when tg_op='DELETE' then old.job_title else new.job_title end,''),'status',case when tg_op='DELETE' then old.status::text else new.status::text end);
  elsif tg_table_name = 'candidates' then
    entity := coalesce((case when tg_op='DELETE' then old.id else new.id end)::text, '');
    if tg_op = 'UPDATE' then
      changed := row(new.candidate_name,new.email,new.phone,new.current_location,new.preferred_location,new.total_experience,new.relevant_experience,new.current_company,new.current_designation,new.skills,new.education,new.notice_period,new.current_ctc,new.expected_ctc)
        is distinct from
        row(old.candidate_name,old.email,old.phone,old.current_location,old.preferred_location,old.total_experience,old.relevant_experience,old.current_company,old.current_designation,old.skills,old.education,old.notice_period,old.current_ctc,old.expected_ctc);
    end if;
    info := jsonb_build_object('candidate_name',coalesce(case when tg_op='DELETE' then old.candidate_name else new.candidate_name end,''));
  elsif tg_table_name = 'screenings' then
    entity := coalesce((case when tg_op='DELETE' then old.id else new.id end)::text, '');
    if tg_op = 'UPDATE' then
      changed := row(new.overall_score,new.final_recommendation,new.recruiter_decision,new.recruiter_notes,new.manually_overridden,new.submitted_at)
        is distinct from
        row(old.overall_score,old.final_recommendation,old.recruiter_decision,old.recruiter_notes,old.manually_overridden,old.submitted_at);
    end if;
    info := jsonb_build_object('candidate_id',(case when tg_op='DELETE' then old.candidate_id else new.candidate_id end),'requirement_id',(case when tg_op='DELETE' then old.requirement_id else new.requirement_id end),'score',(case when tg_op='DELETE' then old.overall_score else new.overall_score end),'decision',(case when tg_op='DELETE' then old.recruiter_decision::text else new.recruiter_decision::text end));
  elsif tg_table_name = 'interviews' then
    entity := coalesce((case when tg_op='DELETE' then old.id else new.id end)::text, '');
    if tg_op = 'UPDATE' then
      changed := row(new.scheduled_at,new.status,new.interview_type,new.interviewer,new.location_or_link,new.notes,new.candidate_response,new.reschedule_preferred_date,new.reschedule_preferred_time)
        is distinct from
        row(old.scheduled_at,old.status,old.interview_type,old.interviewer,old.location_or_link,old.notes,old.candidate_response,old.reschedule_preferred_date,old.reschedule_preferred_time);
    end if;
    info := jsonb_build_object('candidate',coalesce(case when tg_op='DELETE' then old.candidate_name_snapshot else new.candidate_name_snapshot end,''),'job_title',coalesce(case when tg_op='DELETE' then old.job_title_snapshot else new.job_title_snapshot end,''),'client',coalesce(case when tg_op='DELETE' then old.client_name_snapshot else new.client_name_snapshot end,''),'status',coalesce(case when tg_op='DELETE' then old.status else new.status end,''));
  end if;

  if not changed then
    return case when tg_op='DELETE' then old else new end;
  end if;

  action_text := case tg_op
    when 'INSERT' then initcap(replace(tg_table_name,'_',' ')) || ' created'
    when 'UPDATE' then initcap(replace(tg_table_name,'_',' ')) || ' updated'
    when 'DELETE' then initcap(replace(tg_table_name,'_',' ')) || ' deleted'
  end;

  insert into public.activity_logs(actor_id,action,entity_type,entity_id,details)
  values(actor,action_text,tg_table_name,entity,info || jsonb_build_object('operation',tg_op,'source','database_audit'));

  return case when tg_op='DELETE' then old else new end;
end;
$$;

drop trigger if exists audit_requirements_activity on public.requirements;
create trigger audit_requirements_activity after insert or update or delete on public.requirements for each row execute function public.log_tss_business_activity();

drop trigger if exists audit_candidates_activity on public.candidates;
create trigger audit_candidates_activity after insert or update or delete on public.candidates for each row execute function public.log_tss_business_activity();

drop trigger if exists audit_screenings_activity on public.screenings;
create trigger audit_screenings_activity after insert or update or delete on public.screenings for each row execute function public.log_tss_business_activity();

drop trigger if exists audit_interviews_activity on public.interviews;
create trigger audit_interviews_activity after insert or update or delete on public.interviews for each row execute function public.log_tss_business_activity();