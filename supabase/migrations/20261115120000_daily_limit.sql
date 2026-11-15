-- F-14: service-only exemptions and atomic daily quota enforcement.
create table public.diagnosis_limit_exempt (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  note text
);
alter table public.diagnosis_limit_exempt enable row level security;
revoke all on public.diagnosis_limit_exempt from public, anon, authenticated;
grant select, insert, update, delete on public.diagnosis_limit_exempt to service_role;

alter type public.diagnosis_abort_reason add value if not exists 'stopped';
drop function public.diagnosis_submit_stage1(uuid, uuid, jsonb, uuid[]);

create function public.diagnosis_submit_stage1(
  p_user_id uuid, p_diagnosis_id uuid, p_gradings jsonb, p_stage2_question_ids uuid[], p_daily_limit int
) returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_status public.diagnosis_status;
  submitted_at timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  if p_daily_limit is not null and (
    select count(*) from public.diagnoses
    where user_id = p_user_id
      and stage1_submitted_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')
  ) >= p_daily_limit then return 'daily_limit'; end if;
  select status, stage1_submitted_at into current_status, submitted_at
  from public.diagnoses where id = p_diagnosis_id and user_id = p_user_id
  for update;
  if not found then return 'not_found'; end if;
  if current_status <> 'stage1' then return 'not_in_progress'; end if;
  if submitted_at is not null then return 'already_submitted'; end if;
  if jsonb_typeof(p_gradings) is distinct from 'array' then
    raise exception 'gradings must be an array';
  end if;
  -- 채점에 사용한 답안이 잠금 이전에 변경됐다면 아무것도 저장하지 않는다.
  if exists (
    select 1 from jsonb_array_elements(p_gradings) as input(value)
    left join public.answers as a
      on a.diagnosis_item_id = (input.value->>'diagnosis_item_id')::bigint
      and a.user_id = p_user_id
    where a.updated_at is null
      or input.value->>'answer_updated_at' is null
      or a.updated_at is distinct from (input.value->>'answer_updated_at')::timestamptz
  ) then return 'answers_changed'; end if;

  if exists (
    select 1 from public.diagnosis_items as i
    left join public.answers as a on a.diagnosis_item_id = i.id
    where i.diagnosis_id = p_diagnosis_id and i.stage = 1
      and a.selected_choice is null and coalesce(btrim(a.written_text), '') = ''
  ) then return 'unanswered'; end if;

  if jsonb_array_length(p_gradings) <> (
    select count(*) from public.diagnosis_items where diagnosis_id = p_diagnosis_id and stage = 1
  ) or jsonb_array_length(p_gradings) <> (
    select count(distinct (g.value->>'diagnosis_item_id')::bigint) from jsonb_array_elements(p_gradings) as g(value)
  ) or exists (
    select 1 from jsonb_array_elements(p_gradings) as g(value)
    where not exists (
      select 1 from public.diagnosis_items as i
      where i.id = (g.value->>'diagnosis_item_id')::bigint
        and i.diagnosis_id = p_diagnosis_id and i.stage = 1
    )
  ) then raise exception 'gradings do not match stage 1 items'; end if;

  insert into public.gradings (
    diagnosis_item_id, user_id, score, passed, selected_misconception_id,
    element_results, detected_misconception_ids, ai_model, prompt_version
  )
  select (g.value->>'diagnosis_item_id')::bigint, p_user_id,
    (g.value->>'score')::numeric, (g.value->>'passed')::boolean,
    g.value->>'selected_misconception_id', nullif(g.value->'element_results', 'null'::jsonb),
    array(select jsonb_array_elements_text(coalesce(nullif(g.value->'detected_misconception_ids', 'null'::jsonb), '[]'::jsonb))),
    g.value->>'ai_model', g.value->>'prompt_version'
  from jsonb_array_elements(p_gradings) as g(value);

  if coalesce(cardinality(p_stage2_question_ids), 0) > 0 then
    if cardinality(p_stage2_question_ids) <> (
      select count(distinct id) from unnest(p_stage2_question_ids) as ids(id)
    ) or exists (
      select 1 from unnest(p_stage2_question_ids) as ids(id)
      left join public.questions as q on q.id = ids.id
      where q.id is null or q.status <> 'approved' or q.difficulty <> 'hard'
        or not exists (
          select 1 from public.diagnosis_items as i
          join public.gradings as g on g.diagnosis_item_id = i.id
          where i.diagnosis_id = p_diagnosis_id and i.stage = 1
            and i.assessment_item_id = q.assessment_item_id and g.passed
        )
    ) or exists (
      select 1 from public.questions as q where q.id = any(p_stage2_question_ids)
      group by q.assessment_item_id having count(*) > 1
    ) then raise exception 'invalid stage 2 questions'; end if;

    insert into public.diagnosis_items (diagnosis_id, user_id, stage, position, question_id, assessment_item_id)
    select p_diagnosis_id, p_user_id, 2, ids.position, q.id, q.assessment_item_id
    from unnest(p_stage2_question_ids) with ordinality as ids(id, position)
    join public.questions as q on q.id = ids.id;
    update public.diagnoses set stage1_submitted_at = now(), status = 'stage2'
    where id = p_diagnosis_id and user_id = p_user_id;
  else
    update public.diagnoses set stage1_submitted_at = now(), status = 'completed', completed_at = now()
    where id = p_diagnosis_id and user_id = p_user_id;
  end if;
  return 'submitted';
end
$$;

revoke execute on function public.diagnosis_submit_stage1(uuid, uuid, jsonb, uuid[], int) from public, anon, authenticated;
grant execute on function public.diagnosis_submit_stage1(uuid, uuid, jsonb, uuid[], int) to service_role;

create function public.diagnosis_stop_stage2(p_user_id uuid, p_diagnosis_id uuid)
returns text language plpgsql security invoker set search_path = '' as $$
declare current_status public.diagnosis_status;
begin
  select status into current_status from public.diagnoses
  where id = p_diagnosis_id and user_id = p_user_id for update;
  if not found then return 'not_found'; end if;
  if current_status <> 'stage2' then return 'not_in_stage2'; end if;
  update public.diagnoses set status = 'aborted', abort_reason = 'stopped', aborted_at = now()
  where id = p_diagnosis_id and user_id = p_user_id;
  return 'ok';
end
$$;
revoke execute on function public.diagnosis_stop_stage2(uuid, uuid) from public, anon, authenticated;
grant execute on function public.diagnosis_stop_stage2(uuid, uuid) to service_role;
