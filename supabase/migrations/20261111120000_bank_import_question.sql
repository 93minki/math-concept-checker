create function public.bank_import_question(payload jsonb) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  q uuid;
  r bigint;
  item jsonb;
  mid text;
begin
  insert into public.questions (
    id, assessment_item_id, difficulty, variant, question_type, body, explanation,
    model_answer, hard_condition, hard_condition_reason, status, approved_by, approved_at, model,
    prompt_version, generated_at, validation, retry_count, created_at
  ) values (
    (payload->>'id')::uuid, payload->>'assessment_item_id', payload->>'difficulty',
    (payload->>'variant')::int, payload->>'question_type', payload->>'body',
    payload->>'explanation', payload->>'model_answer', payload->>'hard_condition',
    payload->>'hard_condition_reason', 'validated', payload->>'approved_by',
    (payload->>'approved_at')::timestamptz, payload->>'model',
    payload->>'prompt_version', (payload->>'generated_at')::timestamptz,
    payload->'validation', (payload->>'retry_count')::int,
    (payload->>'created_at')::timestamptz
  ) returning id into q;

  for item in select * from jsonb_array_elements(payload->'choices') loop
    insert into public.question_choices (question_id, no, text, is_correct, misconception_id)
    values (q, (item->>'no')::int, item->>'text', (item->>'is_correct')::boolean, item->>'misconception_id');
  end loop;

  for item in select * from jsonb_array_elements(payload->'rubric') loop
    insert into public.rubric_elements (question_id, no, description, points, required)
    values (q, (item->>'no')::int, item->>'description', (item->>'points')::numeric, (item->>'required')::boolean)
    returning id into r;
    for mid in select jsonb_array_elements_text(item->'related_misconception_ids') loop
      insert into public.rubric_element_misconceptions values (r, mid);
    end loop;
  end loop;

  if payload->>'status' <> 'validated' then
    update public.questions set
      status = (payload->>'status')::public.question_status,
      approved_by = payload->>'approved_by',
      approved_at = (payload->>'approved_at')::timestamptz,
      disabled_at = (payload->>'disabled_at')::timestamptz
    where id = q;
  end if;
  return q;
end
$$;

revoke execute on function public.bank_import_question(jsonb) from public, anon, authenticated;
grant execute on function public.bank_import_question(jsonb) to service_role;
