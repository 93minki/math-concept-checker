-- Design: docs/DESIGN.md "진단 기록", "접근 권한 (RLS)", "진단 출제·풀이".

create type public.diagnosis_status as enum ('stage1', 'stage2', 'completed', 'aborted');
create type public.diagnosis_abort_reason as enum ('expired', 'restarted');

-- 진단, 출제 항목, 답안. 자식 행의 사용자는 진단의 사용자와 같아야 한다.
create table public.diagnoses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  display_unit_id bigint not null references public.display_units,
  standard_codes text[] not null check (cardinality(standard_codes) > 0),
  status public.diagnosis_status not null default 'stage1',
  abort_reason public.diagnosis_abort_reason,
  started_at timestamptz not null default now(),
  stage1_submitted_at timestamptz,
  completed_at timestamptz,
  aborted_at timestamptz,
  check ((status = 'aborted') = (abort_reason is not null)),
  check ((status = 'aborted') = (aborted_at is not null)),
  check ((status = 'completed') = (completed_at is not null)),
  unique (id, user_id)
);

create index diagnoses_user_id_idx on public.diagnoses (user_id);
create unique index diagnoses_one_in_progress on public.diagnoses (user_id, display_unit_id)
where status in ('stage1', 'stage2');

create table public.diagnosis_items (
  id bigint generated always as identity primary key,
  diagnosis_id uuid not null,
  user_id uuid not null,
  stage smallint not null check (stage in (1, 2)),
  position int not null check (position >= 1),
  question_id uuid not null references public.questions,
  assessment_item_id text not null references public.assessment_items,
  foreign key (diagnosis_id, user_id) references public.diagnoses (id, user_id) on delete cascade,
  unique (diagnosis_id, stage, position),
  unique (diagnosis_id, stage, assessment_item_id),
  unique (id, user_id)
);

create index diagnosis_items_user_id_idx on public.diagnosis_items (user_id);
create index diagnosis_items_user_question_idx on public.diagnosis_items (user_id, question_id);

create table public.answers (
  diagnosis_item_id bigint primary key,
  user_id uuid not null,
  selected_choice smallint check (selected_choice between 1 and 5),
  written_text text check (char_length(written_text) <= 1000),
  updated_at timestamptz not null default now(),
  foreign key (diagnosis_item_id, user_id) references public.diagnosis_items (id, user_id) on delete cascade,
  check (selected_choice is null or written_text is null)
);

create index answers_user_id_idx on public.answers (user_id);

-- 제출과 답안 저장이 동시에 일어나도 제출 뒤 답안을 변경하지 못한다.
create function public.answers_guard() returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_status public.diagnosis_status;
  submitted_at timestamptz;
  item_stage smallint;
  question_type text;
begin
  if tg_op = 'UPDATE' and (
    new.diagnosis_item_id is distinct from old.diagnosis_item_id
    or new.user_id is distinct from old.user_id
  ) then
    raise exception 'answer identity cannot be changed';
  end if;

  select d.status, d.stage1_submitted_at, i.stage, q.question_type
    into current_status, submitted_at, item_stage, question_type
  from public.diagnosis_items as i
  join public.diagnoses as d on (d.id, d.user_id) = (i.diagnosis_id, i.user_id)
  join public.questions as q on q.id = i.question_id
  where i.id = new.diagnosis_item_id and i.user_id = new.user_id
  for update of d;

  if not found then
    raise exception 'diagnosis item not found';
  end if;
  if current_status not in ('stage1', 'stage2')
    or (current_status = 'stage1' and item_stage <> 1)
    or (current_status = 'stage2' and item_stage <> 2)
    or (item_stage = 1 and submitted_at is not null) then
    raise exception 'diagnosis stage is not accepting answers';
  end if;
  if (question_type = 'multiple_choice' and new.written_text is not null)
    or (question_type = 'written' and new.selected_choice is not null) then
    raise exception 'answer does not match question type';
  end if;
  new.updated_at := now();
  return new;
end
$$;

create trigger answers_guard
  before insert or update on public.answers
  for each row execute function public.answers_guard();

-- 만료, 시작, 1단계 제출은 백엔드에서만 실행한다.
create function public.diagnosis_expire(p_user_id uuid) returns int
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
    and started_at < now() - interval '3 days'
    and not (status = 'stage1' and stage1_submitted_at is not null);
  get diagnostics affected = row_count;
  return affected;
end
$$;

create function public.diagnosis_start(
  p_user_id uuid, p_display_unit_id bigint, p_restart boolean, p_question_ids uuid[]
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_id uuid;
  created_id uuid;
  codes text[];
begin
  perform public.diagnosis_expire(p_user_id);

  select id into existing_id from public.diagnoses
  where user_id = p_user_id and display_unit_id = p_display_unit_id
    and status in ('stage1', 'stage2')
  for update;
  if found then
    if p_restart is not true then
      return jsonb_build_object('result', 'in_progress', 'diagnosis_id', existing_id);
    end if;
    update public.diagnoses
    set status = 'aborted', abort_reason = 'restarted', aborted_at = now()
    where id = existing_id;
  end if;

  if not exists (select 1 from public.display_units where id = p_display_unit_id) then
    return jsonb_build_object('result', 'unit_not_found');
  end if;

  if p_question_ids is null or cardinality(p_question_ids) = 0
    or cardinality(p_question_ids) <> (select count(distinct id) from unnest(p_question_ids) as ids(id))
    or exists (
      select 1 from unnest(p_question_ids) as ids(id)
      left join public.questions as q on q.id = ids.id
      left join public.assessment_items as a on a.id = q.assessment_item_id
      left join public.concepts as c on c.id = a.concept_id
      left join public.display_unit_standards as s
        on s.standard_code = c.standard_code and s.display_unit_id = p_display_unit_id
      where q.id is null or q.status <> 'approved' or q.difficulty <> 'normal'
        or s.standard_code is null
    )
    or exists (
      select 1 from public.questions as q
      where q.id = any(p_question_ids)
      group by q.assessment_item_id having count(*) > 1
    ) then
    raise exception 'invalid diagnosis questions';
  end if;

  select array_agg(standard_code order by standard_code) into codes
  from public.display_unit_standards where display_unit_id = p_display_unit_id;
  insert into public.diagnoses (user_id, display_unit_id, standard_codes)
  values (p_user_id, p_display_unit_id, codes) returning id into created_id;

  insert into public.diagnosis_items (diagnosis_id, user_id, stage, position, question_id, assessment_item_id)
  select created_id, p_user_id, 1, ids.position, q.id, q.assessment_item_id
  from unnest(p_question_ids) with ordinality as ids(id, position)
  join public.questions as q on q.id = ids.id;

  return jsonb_build_object('result', 'created', 'diagnosis_id', created_id);
end
$$;

create function public.diagnosis_submit_stage1(p_user_id uuid, p_diagnosis_id uuid) returns text
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
  if exists (
    select 1 from public.diagnosis_items as i
    left join public.answers as a on a.diagnosis_item_id = i.id
    where i.diagnosis_id = p_diagnosis_id and i.stage = 1
      and a.selected_choice is null and coalesce(btrim(a.written_text), '') = ''
  ) then return 'unanswered'; end if;
  update public.diagnoses set stage1_submitted_at = now() where id = p_diagnosis_id;
  return 'submitted';
end
$$;

revoke execute on function public.answers_guard() from public, anon, authenticated;
revoke execute on function public.diagnosis_expire(uuid) from public, anon, authenticated;
revoke execute on function public.diagnosis_start(uuid, bigint, boolean, uuid[]) from public, anon, authenticated;
revoke execute on function public.diagnosis_submit_stage1(uuid, uuid) from public, anon, authenticated;
grant execute on function public.answers_guard() to service_role;
grant execute on function public.diagnosis_expire(uuid) to service_role;
grant execute on function public.diagnosis_start(uuid, bigint, boolean, uuid[]) to service_role;
grant execute on function public.diagnosis_submit_stage1(uuid, uuid) to service_role;

-- 학생은 자기 행만 읽고, 쓰기는 백엔드만 한다.
alter table public.diagnoses enable row level security;
alter table public.diagnosis_items enable row level security;
alter table public.answers enable row level security;

revoke all on table public.diagnoses, public.diagnosis_items, public.answers from public, anon, authenticated;
grant select on table public.diagnoses, public.diagnosis_items, public.answers to authenticated;
grant select, insert, update on table public.diagnoses, public.diagnosis_items, public.answers to service_role;
grant usage, select on sequence public.diagnosis_items_id_seq to service_role;

create policy "diagnoses_select_own" on public.diagnoses
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "diagnosis_items_select_own" on public.diagnosis_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "answers_select_own" on public.answers
  for select to authenticated using ((select auth.uid()) = user_id);
