-- Design: docs/DESIGN.md "진단 기록", "접근 권한 (RLS)", "채점·2단계·리포트".

alter table public.diagnoses add column stage2_submitted_at timestamptz;

-- 채점과 리포트는 한 번만 저장하며 원래 항목·진단의 사용자와 연결한다.
create table public.gradings (
  diagnosis_item_id bigint primary key,
  user_id uuid not null,
  score numeric not null check (score between 0 and 1),
  passed boolean not null,
  selected_misconception_id text references public.misconceptions,
  element_results jsonb,
  detected_misconception_ids text[] not null default '{}',
  ai_model text,
  prompt_version text,
  graded_at timestamptz not null default now(),
  foreign key (diagnosis_item_id, user_id) references public.diagnosis_items (id, user_id) on delete cascade,
  check ((element_results is null) = (ai_model is null)),
  check ((ai_model is null) = (prompt_version is null))
);

create index gradings_user_id_idx on public.gradings (user_id);

create table public.reports (
  diagnosis_id uuid primary key,
  user_id uuid not null,
  unit_score numeric check (unit_score between 0 and 1),
  unit_stage text check (unit_stage in ('아직 이해 못 함', '기본 이해', '깊이 이해')),
  concepts jsonb not null,
  misconception_ids text[] not null default '{}',
  text jsonb not null,
  ai_model text not null,
  prompt_version text not null,
  created_at timestamptz not null default now(),
  foreign key (diagnosis_id, user_id) references public.diagnoses (id, user_id) on delete cascade,
  check ((unit_score is null) = (unit_stage is null))
);

create index reports_user_id_idx on public.reports (user_id);

alter table public.gradings enable row level security;
alter table public.reports enable row level security;
revoke all on table public.gradings, public.reports from public, anon, authenticated, service_role;
grant select on table public.gradings, public.reports to authenticated;
grant select, insert on table public.gradings, public.reports to service_role;

create policy "gradings_select_own" on public.gradings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "reports_select_own" on public.reports
  for select to authenticated using ((select auth.uid()) = user_id);

-- 1단계 제출과 채점, 2단계 출제 또는 완료를 한 트랜잭션으로 처리한다.
drop function public.diagnosis_submit_stage1(uuid, uuid);

create function public.diagnosis_submit_stage1(
  p_user_id uuid, p_diagnosis_id uuid, p_gradings jsonb, p_stage2_question_ids uuid[]
) returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_status public.diagnosis_status;
  submitted_at timestamptz;
begin
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

-- 2단계 제출도 채점과 완료를 함께 기록한다.
create function public.diagnosis_submit_stage2(
  p_user_id uuid, p_diagnosis_id uuid, p_gradings jsonb
) returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_status public.diagnosis_status;
begin
  select status into current_status from public.diagnoses
  where id = p_diagnosis_id and user_id = p_user_id for update;
  if not found then return 'not_found'; end if;
  if current_status <> 'stage2' then return 'not_in_progress'; end if;
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
    where i.diagnosis_id = p_diagnosis_id and i.stage = 2
      and a.selected_choice is null and coalesce(btrim(a.written_text), '') = ''
  ) then return 'unanswered'; end if;

  if jsonb_array_length(p_gradings) <> (
    select count(*) from public.diagnosis_items where diagnosis_id = p_diagnosis_id and stage = 2
  ) or jsonb_array_length(p_gradings) <> (
    select count(distinct (g.value->>'diagnosis_item_id')::bigint) from jsonb_array_elements(p_gradings) as g(value)
  ) or exists (
    select 1 from jsonb_array_elements(p_gradings) as g(value)
    where not exists (
      select 1 from public.diagnosis_items as i
      where i.id = (g.value->>'diagnosis_item_id')::bigint
        and i.diagnosis_id = p_diagnosis_id and i.stage = 2
    )
  ) then raise exception 'gradings do not match stage 2 items'; end if;

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

  update public.diagnoses set stage2_submitted_at = now(), status = 'completed', completed_at = now()
  where id = p_diagnosis_id and user_id = p_user_id;
  return 'submitted';
end
$$;

-- 완료된 진단 또는 2단계 중단 진단의 리포트를 최초 한 번만 저장한다.
create function public.report_create(
  p_user_id uuid, p_diagnosis_id uuid, p_gradings jsonb, p_report jsonb
) returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_status public.diagnosis_status;
  submitted_at timestamptz;
begin
  select status, stage1_submitted_at into current_status, submitted_at
  from public.diagnoses where id = p_diagnosis_id and user_id = p_user_id
  for update;
  if not found then return 'not_found'; end if;
  if exists (select 1 from public.reports where diagnosis_id = p_diagnosis_id) then
    return 'exists';
  end if;
  if current_status <> 'completed' and not (current_status = 'aborted' and submitted_at is not null) then
    return 'no_report';
  end if;
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

  if current_status = 'completed' then
    if jsonb_array_length(p_gradings) <> 0 then
      raise exception 'completed diagnosis cannot receive additional gradings';
    end if;
  else
    if jsonb_array_length(p_gradings) <> (
      select count(*) from public.diagnosis_items as i
      join public.answers as a on a.diagnosis_item_id = i.id
      left join public.gradings as g on g.diagnosis_item_id = i.id
      where i.diagnosis_id = p_diagnosis_id and i.stage = 2
        and (a.selected_choice is not null or coalesce(btrim(a.written_text), '') <> '')
        and g.diagnosis_item_id is null
    ) or jsonb_array_length(p_gradings) <> (
      select count(distinct (g.value->>'diagnosis_item_id')::bigint) from jsonb_array_elements(p_gradings) as g(value)
    ) or exists (
      select 1 from jsonb_array_elements(p_gradings) as input(value)
      where not exists (
        select 1 from public.diagnosis_items as i
        join public.answers as a on a.diagnosis_item_id = i.id
        left join public.gradings as g on g.diagnosis_item_id = i.id
        where i.id = (input.value->>'diagnosis_item_id')::bigint
          and i.diagnosis_id = p_diagnosis_id and i.stage = 2
          and (a.selected_choice is not null or coalesce(btrim(a.written_text), '') <> '')
          and g.diagnosis_item_id is null
      )
    ) then raise exception 'gradings do not match answered stage 2 items'; end if;
  end if;

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

  insert into public.reports (
    diagnosis_id, user_id, unit_score, unit_stage, concepts, misconception_ids, text, ai_model, prompt_version
  ) values (
    p_diagnosis_id, p_user_id, (p_report->>'unit_score')::numeric, p_report->>'unit_stage',
    nullif(p_report->'concepts', 'null'::jsonb),
    array(select jsonb_array_elements_text(coalesce(nullif(p_report->'misconception_ids', 'null'::jsonb), '[]'::jsonb))),
    nullif(p_report->'text', 'null'::jsonb), p_report->>'ai_model', p_report->>'prompt_version'
  );
  return 'created';
end
$$;

-- 제출과 채점은 원자적으로 처리하므로 단계가 진행 중이면 3일 뒤 만료한다.
create or replace function public.diagnosis_expire(p_user_id uuid) returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected int;
begin
  update public.diagnoses
  set status = 'aborted', abort_reason = 'expired', aborted_at = now()
  where user_id = p_user_id
    and status in ('stage1', 'stage2')
    and started_at < now() - interval '3 days';
  get diagnostics affected = row_count;
  return affected;
end
$$;

revoke execute on function public.diagnosis_submit_stage1(uuid, uuid, jsonb, uuid[]) from public, anon, authenticated;
revoke execute on function public.diagnosis_submit_stage2(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.report_create(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.diagnosis_expire(uuid) from public, anon, authenticated;
grant execute on function public.diagnosis_submit_stage1(uuid, uuid, jsonb, uuid[]) to service_role;
grant execute on function public.diagnosis_submit_stage2(uuid, uuid, jsonb) to service_role;
grant execute on function public.report_create(uuid, uuid, jsonb, jsonb) to service_role;
grant execute on function public.diagnosis_expire(uuid) to service_role;
