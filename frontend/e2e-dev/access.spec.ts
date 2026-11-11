import { expect, test, type APIRequestContext } from "@playwright/test";
import { requiredEnv, tokenFor, unitName } from "./helpers";

type Unit = { id: number; name: string };
type Item = {
  id: number;
  stage: number;
  question_type: "multiple_choice" | "written";
  choices: { no: number }[];
};
type Diagnosis = { id: string; started_at: string; items: Item[] };

const api = () => requiredEnv("NEXT_PUBLIC_API_BASE_URL").replace(/\/$/, "");
const headers = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});

async function completeSignup(request: APIRequestContext, accessToken: string) {
  const response = await request.post(`${api()}/signup/complete`, {
    headers: headers(accessToken),
  });
  expect(response.status()).toBe(200);
}

async function startDiagnosis(
  request: APIRequestContext,
  accessToken: string,
  unitId: number,
): Promise<Diagnosis> {
  const started = await request.post(`${api()}/diagnoses`, {
    headers: headers(accessToken),
    data: { display_unit_id: unitId, restart: true },
  });
  expect(started.status()).toBe(201);
  const { diagnosis_id } = (await started.json()) as { diagnosis_id: string };
  const response = await request.get(`${api()}/diagnoses/${diagnosis_id}`, {
    headers: headers(accessToken),
  });
  expect(response.status()).toBe(200);
  return response.json() as Promise<Diagnosis>;
}

function answerFor(item: Item) {
  return item.question_type === "multiple_choice"
    ? { selected_choice: item.choices[0].no }
    : { written_text: "시험 답안" };
}

test("다른 계정의 진단과 문제 은행에 접근할 수 없다", async ({ request }) => {
  const a = await tokenFor(
    requiredEnv("E2E_USER_A_EMAIL"),
    requiredEnv("E2E_USER_A_PASSWORD"),
  );
  const b = await tokenFor(
    requiredEnv("E2E_USER_B_EMAIL"),
    requiredEnv("E2E_USER_B_PASSWORD"),
  );
  expect(a.userId).not.toBe(b.userId);
  await completeSignup(request, a.accessToken);
  await completeSignup(request, b.accessToken);
  const unitsResponse = await request.get(`${api()}/units`, {
    headers: headers(b.accessToken),
  });
  expect(unitsResponse.status()).toBe(200);
  const units = (await unitsResponse.json()) as Unit[];
  const unit = units.find((value) => value.name === unitName);
  if (!unit) throw new Error("시험 단원을 찾지 못했어요");
  await startDiagnosis(request, a.accessToken, unit.id);
  const diagnosis = await startDiagnosis(request, b.accessToken, unit.id);
  expect(diagnosis.items.length).toBeGreaterThanOrEqual(2);
  const first = diagnosis.items[0];
  const second = diagnosis.items[1];
  const itemUrl = `${api()}/diagnoses/${diagnosis.id}/items/${first.id}/answer`;
  const ownSave = await request.put(itemUrl, {
    headers: headers(b.accessToken),
    data: answerFor(first),
  });
  expect(ownSave.status()).toBe(200);
  const getOther = await request.get(`${api()}/diagnoses/${diagnosis.id}`, {
    headers: headers(a.accessToken),
  });
  expect(getOther.status()).toBe(404);
  const putOther = await request.put(itemUrl, {
    headers: headers(a.accessToken),
    data: answerFor(first),
  });
  expect(putOther.status()).toBe(404);
  const submitOther = await request.post(
    `${api()}/diagnoses/${diagnosis.id}/stages/1/submit`,
    { headers: headers(a.accessToken) },
  );
  expect(submitOther.status()).toBe(404);

  const otherDiagnosis = await a.client
    .from("diagnoses")
    .select("id")
    .eq("id", diagnosis.id);
  expect(otherDiagnosis.error).toBeNull();
  expect(otherDiagnosis.data).toHaveLength(0);
  const otherItems = await a.client
    .from("diagnosis_items")
    .select("id")
    .eq("diagnosis_id", diagnosis.id);
  expect(otherItems.error).toBeNull();
  expect(otherItems.data).toHaveLength(0);
  const otherAnswers = await a.client
    .from("answers")
    .select("diagnosis_item_id")
    .eq("diagnosis_item_id", first.id);
  expect(otherAnswers.error).toBeNull();
  expect(otherAnswers.data).toHaveLength(0);
  const ownDiagnoses = await a.client
    .from("diagnoses")
    .select("id")
    .eq("user_id", a.userId);
  expect(ownDiagnoses.error).toBeNull();
  expect(ownDiagnoses.data?.length).toBeGreaterThan(0);

  const update = await a.client
    .from("diagnoses")
    .update({ started_at: diagnosis.started_at })
    .eq("id", diagnosis.id);
  expect(update.error?.code).toBe("42501");
  const insert = await a.client.from("answers").insert({
    diagnosis_item_id: second.id,
    user_id: b.userId,
    ...answerFor(second),
  });
  expect(insert.error?.code).toBe("42501");
  for (const table of ["questions", "question_choices"]) {
    const result = await a.client.from(table).select("*").limit(1);
    expect(result.error !== null || result.data?.length === 0).toBe(true);
  }
  // B의 시험 진단을 완료해 실제 채점·리포트 행에 대한 접근 권한을 확인한다.
  for (const item of diagnosis.items.filter((value) => value.stage === 1)) {
    const saved = await request.put(
      `${api()}/diagnoses/${diagnosis.id}/items/${item.id}/answer`,
      { headers: headers(b.accessToken), data: answerFor(item) },
    );
    expect(saved.status()).toBe(200);
  }
  const firstSubmit = await request.post(
    `${api()}/diagnoses/${diagnosis.id}/stages/1/submit`,
    { headers: headers(b.accessToken) },
  );
  expect(firstSubmit.status()).toBe(200);
  const firstResult = (await firstSubmit.json()) as {
    status: "stage2" | "completed";
  };
  let completedItems = diagnosis.items;
  if (firstResult.status === "stage2") {
    const stageTwo = await request.get(`${api()}/diagnoses/${diagnosis.id}`, {
      headers: headers(b.accessToken),
    });
    expect(stageTwo.status()).toBe(200);
    completedItems = ((await stageTwo.json()) as Diagnosis).items;
    for (const item of completedItems.filter((value) => value.stage === 2)) {
      const saved = await request.put(
        `${api()}/diagnoses/${diagnosis.id}/items/${item.id}/answer`,
        { headers: headers(b.accessToken), data: answerFor(item) },
      );
      expect(saved.status()).toBe(200);
    }
    const secondSubmit = await request.post(
      `${api()}/diagnoses/${diagnosis.id}/stages/2/submit`,
      { headers: headers(b.accessToken) },
    );
    expect(secondSubmit.status()).toBe(200);
    expect(((await secondSubmit.json()) as { status: string }).status).toBe(
      "completed",
    );
  } else expect(firstResult.status).toBe("completed");
  expect(
    (
      await request.get(`${api()}/diagnoses/${diagnosis.id}/report`, {
        headers: headers(b.accessToken),
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.get(`${api()}/diagnoses/${diagnosis.id}/report`, {
        headers: headers(a.accessToken),
      })
    ).status(),
  ).toBe(404);
  const otherGradings = await a.client
    .from("gradings")
    .select("diagnosis_item_id")
    .in(
      "diagnosis_item_id",
      completedItems.map((item) => item.id),
    );
  expect(otherGradings.error).toBeNull();
  expect(otherGradings.data).toHaveLength(0);
  const otherReports = await a.client
    .from("reports")
    .select("diagnosis_id")
    .eq("diagnosis_id", diagnosis.id);
  expect(otherReports.error).toBeNull();
  expect(otherReports.data).toHaveLength(0);
  const gradingInsert = await a.client.from("gradings").insert({
    diagnosis_item_id: first.id,
    user_id: b.userId,
    score: 1,
    passed: true,
  });
  expect(gradingInsert.error?.code).toBe("42501");
  const reportInsert = await a.client.from("reports").insert({
    diagnosis_id: diagnosis.id,
    user_id: b.userId,
    concepts: [],
    text: {},
    ai_model: "fake",
    prompt_version: "v5",
  });
  expect(reportInsert.error?.code).toBe("42501");
});
