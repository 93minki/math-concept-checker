-- F-12/F-13: reports and revisions; replacement is atomic and service-only.
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  note text
);

create table public.question_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  diagnosis_item_id bigint references public.diagnosis_items(id) on delete set null,
  kind text not null check (kind in ('text', 'choice_answer', 'figure', 'out_of_curriculum', 'other')),
  description text not null default '' check (char_length(description) <= 500),
  status text not null default 'received' check (status in ('received', 'in_review', 'fixed', 'no_issue')),
  resolution_note text,
  replacement_question_id uuid references public.questions(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index question_reports_open_per_user on public.question_reports(user_id, question_id)
  where status in ('received', 'in_review');
create index question_reports_user_created on public.question_reports(user_id, created_at desc);
create index question_reports_question_status on public.question_reports(question_id, status);

create table public.question_revisions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id),
  source text not null check (source in ('ai', 'manual')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  checks jsonb not null,
  status text not null check (status in ('draft', 'passed', 'failed', 'approved', 'discarded')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  ai_cost numeric not null default 0 check (ai_cost >= 0)
);
create index question_revisions_question_created on public.question_revisions(question_id, created_at desc);

alter table public.admins enable row level security;
alter table public.question_reports enable row level security;
alter table public.question_revisions enable row level security;
revoke all on public.admins, public.question_reports, public.question_revisions from public, anon, authenticated;
grant select, insert, update, delete on public.admins, public.question_reports, public.question_revisions to service_role;
grant select, insert on public.question_reports to authenticated;
create policy question_reports_own_select on public.question_reports
  for select to authenticated using (user_id = (select auth.uid()));
create policy question_reports_own_insert on public.question_reports
  for insert to authenticated with check (
    user_id = (select auth.uid()) and status = 'received'
    and resolution_note is null and replacement_question_id is null and resolved_at is null
    and exists (
      select 1 from public.diagnosis_items as i
      where i.id = question_reports.diagnosis_item_id and i.user_id = (select auth.uid())
        and i.question_id = question_reports.question_id
    )
  );

create function public.bank_replace_question(p_revision_id uuid, p_admin_id uuid) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  rev public.question_revisions%rowtype;
  original public.questions%rowtype;
  new_id uuid;
begin
  if not exists (select 1 from public.admins where user_id = p_admin_id) then
    raise exception 'administrator required';
  end if;
  select * into rev from public.question_revisions where id = p_revision_id for update;
  if not found or rev.status <> 'passed' then
    raise exception 'revision is not passed';
  end if;
  select * into original from public.questions where id = rev.question_id for update;
  if not found or original.status <> 'approved' then
    raise exception 'original question is not approved';
  end if;
  -- Lock open reports so a simultaneous no-issue transition cannot race approval.
  perform 1 from public.question_reports
    where question_id = original.id and status in ('received', 'in_review')
    for update;
  if not found then
    raise exception 'no open reports';
  end if;
  if rev.payload->>'assessment_item_id' is distinct from original.assessment_item_id
    or rev.payload->>'difficulty' is distinct from original.difficulty
    or rev.payload->>'question_type' is distinct from original.question_type
    or (rev.payload->>'variant')::int is distinct from original.variant then
    raise exception 'replacement slot mismatch';
  end if;
  update public.questions set status = 'disabled', disabled_at = now() where id = original.id;
  new_id := public.bank_insert_question(rev.payload);
  update public.questions set status = 'approved', approved_by = p_admin_id::text, approved_at = now() where id = new_id;
  update public.question_revisions set status = 'approved' where id = rev.id;
  update public.question_reports set status = 'fixed', replacement_question_id = new_id, resolved_at = now()
    where question_id = original.id and status in ('received', 'in_review');
  return new_id;
end
$$;
revoke execute on function public.bank_replace_question(uuid, uuid) from public, anon, authenticated;
grant execute on function public.bank_replace_question(uuid, uuid) to service_role;
