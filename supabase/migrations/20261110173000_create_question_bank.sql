-- Design: docs/DESIGN.md "교육과정 데이터 구조", "문제 은행", "DB 스키마", "접근 권한 (RLS)".
create type public.question_status as enum ('generated', 'validated', 'approved', 'disabled');
create table public.standards (code text primary key check (code ~ '^9수[0-9]{2}-[0-9]{2}$'), area text not null, topic text not null, text text not null);
create table public.concepts (id text primary key, standard_code text not null references public.standards, name text not null);
create table public.assessment_items (id text primary key, concept_id text not null references public.concepts, level text not null check (level in ('정의 이해','성질 적용','오개념 판별','이유 설명')), question_type text not null check (question_type in ('multiple_choice','written')), basis text not null);
create table public.misconceptions (id text primary key, standard_code text not null references public.standards, local_id text not null, content text not null, source text not null, unique (standard_code, local_id));
create table public.misconception_concepts (misconception_id text references public.misconceptions, concept_id text references public.concepts, primary key (misconception_id, concept_id));
create table public.display_units (id bigint generated always as identity primary key, grade text not null check (grade in ('중1','중2','중3')), number int not null, name text not null, publisher text not null, aliases text[] not null default '{}', unique (grade, number));
create table public.display_unit_standards (display_unit_id bigint references public.display_units, standard_code text unique references public.standards, primary key (display_unit_id, standard_code));
create table public.questions (
 id uuid primary key default gen_random_uuid(), assessment_item_id text not null references public.assessment_items,
 difficulty text not null check (difficulty in ('normal','hard')), variant int not null check (variant between 1 and 3),
 question_type text not null check (question_type in ('multiple_choice','written')), body text not null, explanation text not null,
 model_answer text, hard_condition text, hard_condition_reason text, status public.question_status not null default 'validated',
 approved_by text, approved_at timestamptz, disabled_at timestamptz, model text not null, prompt_version text not null,
 generated_at timestamptz not null, validation jsonb not null, retry_count int not null, created_at timestamptz not null default now(),
 check (status <> 'approved' or (approved_by is not null and approved_at is not null)),
 check ((status = 'disabled') = (disabled_at is not null)),
 check ((difficulty = 'hard' and hard_condition is not null and hard_condition_reason is not null) or (difficulty = 'normal' and hard_condition is null and hard_condition_reason is null))
);
create unique index questions_live_slot on public.questions (assessment_item_id,difficulty,variant) where status <> 'disabled';
create table public.question_choices (question_id uuid references public.questions on delete cascade, no int check (no between 1 and 5), text text not null, is_correct boolean not null, misconception_id text references public.misconceptions, primary key(question_id,no));
create table public.rubric_elements (id bigint generated always as identity primary key, question_id uuid not null references public.questions on delete cascade, no int not null, description text not null, points numeric not null check (points > 0), required boolean not null, unique(question_id,no));
create table public.rubric_element_misconceptions (rubric_element_id bigint references public.rubric_elements on delete cascade, misconception_id text references public.misconceptions, primary key(rubric_element_id,misconception_id));
create table public.generation_backlog (id bigint generated always as identity primary key, assessment_item_id text not null references public.assessment_items, difficulty text not null check (difficulty in ('normal','hard')), variant int not null check (variant between 1 and 3), attempts jsonb not null, prompt_version text not null, model text not null, created_at timestamptz not null default now(), resolved_at timestamptz);

create function public.bank_guard_question() returns trigger language plpgsql set search_path = '' as $$
begin
 if tg_op = 'DELETE' then
   if old.status in ('approved','disabled') then raise exception 'locked question'; end if;
   return old;
 end if;
 if old.status = 'disabled' then raise exception 'locked question'; end if;
 if old.status = 'approved' and (new.status <> 'disabled' or new.disabled_at is null or (to_jsonb(new) - 'status' - 'disabled_at') is distinct from (to_jsonb(old) - 'status' - 'disabled_at')) then raise exception 'approved question can only be disabled'; end if;
 return new;
end $$;
create trigger bank_guard_question before update or delete on public.questions for each row execute function public.bank_guard_question();

create function public.bank_guard_child() returns trigger language plpgsql set search_path = '' as $$
declare old_q uuid; new_q uuid;
begin
 if tg_table_name = 'rubric_element_misconceptions' then
   if tg_op <> 'INSERT' then select question_id into old_q from public.rubric_elements where id = old.rubric_element_id; end if;
   if tg_op <> 'DELETE' then select question_id into new_q from public.rubric_elements where id = new.rubric_element_id; end if;
 else
   if tg_op <> 'INSERT' then old_q := old.question_id; end if;
   if tg_op <> 'DELETE' then new_q := new.question_id; end if;
 end if;
 perform 1 from public.questions where id in (old_q,new_q) order by id for update;
 if exists (select 1 from public.questions where id in (old_q,new_q) and status in ('approved','disabled')) then raise exception 'locked question children'; end if;
 if tg_op = 'DELETE' then return old; end if;
 return new;
end $$;
create trigger bank_guard_choices before insert or update or delete on public.question_choices for each row execute function public.bank_guard_child();
create trigger bank_guard_rubric before insert or update or delete on public.rubric_elements for each row execute function public.bank_guard_child();
create trigger bank_guard_rubric_misconceptions before insert or update or delete on public.rubric_element_misconceptions for each row execute function public.bank_guard_child();

create function public.bank_insert_question(payload jsonb) returns uuid language plpgsql security invoker set search_path = '' as $$
declare q uuid; r bigint; item jsonb; mid text;
begin
 insert into public.questions (assessment_item_id,difficulty,variant,question_type,body,explanation,model_answer,hard_condition,hard_condition_reason,status,model,prompt_version,generated_at,validation,retry_count)
 values (payload->>'assessment_item_id',payload->>'difficulty',(payload->>'variant')::int,payload->>'question_type',payload->>'body',payload->>'explanation',payload->>'model_answer',payload->>'hard_condition',payload->>'hard_condition_reason','validated',payload->>'model',payload->>'prompt_version',(payload->>'generated_at')::timestamptz,payload->'validation',(payload->>'retry_count')::int) returning id into q;
 for item in select * from jsonb_array_elements(payload->'choices') loop
   insert into public.question_choices (question_id,no,text,is_correct,misconception_id) values (q,(item->>'no')::int,item->>'text',(item->>'is_correct')::boolean,item->>'misconception_id');
 end loop;
 for item in select * from jsonb_array_elements(payload->'rubric') loop
   insert into public.rubric_elements (question_id,no,description,points,required) values (q,(item->>'no')::int,item->>'description',(item->>'points')::numeric,(item->>'required')::boolean) returning id into r;
   for mid in select jsonb_array_elements_text(item->'related_misconception_ids') loop insert into public.rubric_element_misconceptions values (r,mid); end loop;
 end loop;
 return q;
end $$;
revoke execute on function public.bank_insert_question(jsonb) from public, anon, authenticated;
grant execute on function public.bank_insert_question(jsonb) to service_role;

do $$ declare t text; begin
 foreach t in array array['standards','concepts','assessment_items','misconceptions','misconception_concepts','display_units','display_unit_standards','questions','question_choices','rubric_elements','rubric_element_misconceptions','generation_backlog'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from public, anon, authenticated',t);
  execute format('grant select, insert, update on table public.%I to service_role',t);
 end loop;
end $$;
grant usage, select on sequence public.display_units_id_seq, public.rubric_elements_id_seq, public.generation_backlog_id_seq to service_role;
