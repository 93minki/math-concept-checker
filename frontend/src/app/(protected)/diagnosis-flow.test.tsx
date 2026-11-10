import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import UnitSelection from "./unit-selection";
import DiagnosisView from "./diagnoses/[id]/diagnosis-view";
import { ApiError, type Diagnosis, type Unit } from "@/lib/diagnosis-api";

const mocks = vi.hoisted(() => ({ getUnits: vi.fn(), startDiagnosis: vi.fn(), getDiagnosis: vi.fn(), saveAnswer: vi.fn(), submitDiagnosis: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => { const router = { push: mocks.push }; return { useRouter: () => router }; });
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'test' } } }) } }) }));
vi.mock("@/lib/diagnosis-api", async importOriginal => ({ ...await importOriginal<typeof import('@/lib/diagnosis-api')>(), ...mocks }));
const units: Unit[] = [
  { id: 1, grade: '중1', number: 1, name: '문자와 식', publisher: '동아출판', aliases: ['문자식'], status: 'partial', in_progress_diagnosis_id: 'old' },
  { id: 2, grade: '중2', number: 2, name: '도형', publisher: '동아출판', aliases: [], status: 'unavailable', in_progress_diagnosis_id: null },
];
const diagnosis: Diagnosis = { id: 'd', status: 'stage1', abort_reason: null, started_at: '', stage1_submitted_at: null, unit: units[0], items: [
  { id: 1, stage: 1, position: 1, question_type: 'multiple_choice', body: '$x$', choices: [{ no: 1, text: '하나' }, { no: 2, text: '둘' }], answer: null },
  { id: 2, stage: 1, position: 2, question_type: 'written', body: '설명해요', choices: [], answer: null },
] };
beforeEach(() => { vi.clearAllMocks(); mocks.getUnits.mockResolvedValue(units); mocks.getDiagnosis.mockResolvedValue(diagnosis); mocks.saveAnswer.mockResolvedValue({}); });
afterEach(cleanup);
test('학년과 상태를 표시하고 별칭으로 검색한다', async () => {
  render(<UnitSelection />);
  expect(await screen.findByText('중1 · 동아출판 기준')).toBeTruthy();
  expect(screen.getByText('이 단원은 일부 내용만 진단해요')).toBeTruthy();
  expect((screen.getByRole('button', { name: '준비 중' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole('link', { name: '이어서 풀기' }).getAttribute('href')).toBe('/diagnoses/old');
  fireEvent.change(screen.getByLabelText('단원 검색'), { target: { value: '문자식' } });
  expect(screen.queryByText('도형')).toBeNull();
});
test('진행 중 충돌이면 계속 또는 새로 시작을 고른다', async () => {
  mocks.startDiagnosis.mockRejectedValueOnce(new ApiError(409, { code: 'in_progress', diagnosis_id: 'old' })).mockResolvedValueOnce({ diagnosis_id: 'new' });
  render(<UnitSelection />);
  fireEvent.click(await screen.findByRole('button', { name: '진단 시작하기' }));
  const dialog = await screen.findByRole('dialog');
  expect(screen.getByRole('heading', { name: '1. 문자와 식' }).closest('article')?.contains(dialog)).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '새로 시작하기' }));
  await waitFor(() => expect(mocks.startDiagnosis).toHaveBeenCalledWith(1, true));
  expect(mocks.push).toHaveBeenCalledWith('/diagnoses/new');
});
test('답을 저장하고 모두 답해야 제출한다', async () => {
  render(<DiagnosisView id="d" />);
  const submit = await screen.findByRole('button', { name: '제출하기' });
  expect((submit as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('radio', { name: /하나/ }));
  await waitFor(() => expect(mocks.saveAnswer).toHaveBeenCalledWith('d', 1, { selected_choice: 1 }));
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  const input = await screen.findByLabelText('풀이와 답');
  fireEvent.change(input, { target: { value: '  ' } });
  expect((submit as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(input, { target: { value: '답이에요' } });
  expect((submit as HTMLButtonElement).disabled).toBe(false);
  mocks.submitDiagnosis.mockResolvedValue({ stage1_submitted_at: 'now' });
  fireEvent.click(submit); fireEvent.click(screen.getByRole('button', { name: '제출할게요' }));
  expect(await screen.findByText('제출했어요. 채점 기능은 준비 중이에요')).toBeTruthy();
  expect((screen.getByLabelText('풀이와 답') as HTMLTextAreaElement).disabled).toBe(true);
});
test('중단된 진단은 수정할 수 없다', async () => {
  mocks.getDiagnosis.mockResolvedValue({ ...diagnosis, status: 'aborted', abort_reason: 'expired' });
  render(<DiagnosisView id="d" />);
  expect(await screen.findByText('기간이 지나 중단된 진단이에요')).toBeTruthy();
  expect(screen.getByRole('radio', { name: /하나/ }).matches(':disabled')).toBe(true);
});
test('저장에 실패하면 다시 시도할 수 있다', async () => {
  mocks.saveAnswer.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({});
  render(<DiagnosisView id="d" />);
  fireEvent.click(await screen.findByRole('radio', { name: /하나/ }));
  fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }));
  expect(await screen.findByText('저장했어요')).toBeTruthy();
  expect(mocks.saveAnswer).toHaveBeenCalledTimes(2);
});
test('저장된 답은 이어서 보여 주고 답하지 않은 첫 문제에서 시작한다', async () => {
  mocks.getDiagnosis.mockResolvedValue({ ...diagnosis, items: [
    { ...diagnosis.items[0], answer: { selected_choice: 2, written_text: null, updated_at: 'now' } }, diagnosis.items[1],
  ] });
  render(<DiagnosisView id="d" />);
  expect(await screen.findByText('2 / 2')).toBeTruthy();
  expect(screen.getByLabelText('풀이와 답')).toBeTruthy();
});
