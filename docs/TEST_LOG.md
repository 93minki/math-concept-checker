# TEST_LOG

테스트 실패 기록이다. 같은 이유로 반복되는 실패를 찾아 `AGENTS.md` 규칙으로 올리는 데 쓴다.
에이전트는 평소에 이 파일을 읽지 않는다. 사용자가 요청할 때와 실패를 기록할 때만 읽는다.

## 기록 규칙
- 테스트를 실행해 실패하면 맨 아래에 기록을 하나 추가한다. 기존 기록은 고치거나 지우지 않는다.
  - 예외: 원인을 찾거나 해결한 뒤 같은 기록의 **원인**, **해결** 칸을 채우는 것은 된다.
- 기능을 만들기 전에 테스트를 먼저 작성해 일부러 실패시킨 경우는 기록하지 않는다.
- 원인은 "테스트 실패", "버그"처럼 뭉뚱그리지 말고 무엇이 왜 틀렸는지 구체적으로 쓴다.
- 원인 분류는 아래 목록에서 고른다. 맞는 것이 없으면 `기타`를 고르고 설명을 붙인다.

## 원인 분류
| 분류 | 뜻 |
|---|---|
| 요구사항 오해 | `docs/features.md`의 동작·완료 조건을 잘못 이해함 |
| 설계 불일치 | `docs/DESIGN.md`와 다르게 구현함 |
| 타입·데이터 형식 | 타입, 데이터 구조, null 처리 등이 맞지 않음 |
| 권한·RLS | 인증, 접근 권한, RLS 정책 문제 |
| AI 응답 | AI 출력 형식·내용이 기대와 다름 |
| 환경·설정 | 환경 변수, 의존성, 실행 환경 문제 |
| 테스트 오류 | 테스트 자체가 잘못 작성됨 |
| 기타 | 위에 없음 (설명 필수) |

## 기록 양식
```markdown
### YYYY-MM-DD — <테스트 파일:테스트 이름>
- 작업: <PLAN 주제>, F-xx
- 증상: <에러 메시지 요약>
- 원인 분류: <위 목록 중 하나>
- 원인: <무엇이 왜 틀렸는지>
- 해결: <어떻게 고쳤는지. 아직이면 "미해결">
```

---

## 기록

### 2026-11-10 — backend/tests/test_health.py (수집 단계)
- 작업: PLAN 2단계 백엔드 뼈대, F-01 준비
- 증상: pytest가 테스트를 수집하면서 `from app.main import app`를 import하지 못함 (Codex 보고, 에러 원문은 남지 않음)
- 원인 분류: 환경·설정
- 원인: pytest 실행 경로에 `backend/`가 없어 `app` 패키지를 찾지 못함
- 해결: `backend/pyproject.toml`의 `[tool.pytest.ini_options]`에 `pythonpath = ["."]` 추가
- 비고: Codex가 지시서의 "backend/ 밖 변경 금지" 때문에 기록을 생략했고, 검수 단계에서 Claude가 대신 기록했다. 다음 지시서부터 TEST_LOG 기록은 예외로 허용한다.

### 2026-11-10 — backend/tests/test_settings.py:test_url_format
- 작업: PLAN 4단계 백엔드 환경 변수 읽기, F-01 준비
- 증상: `https://` 입력값 비노출 검사에서 Pydantic 오류 문서 URL의 같은 문자열까지 입력값으로 판정
- 원인 분류: 테스트 오류
- 원인: 오류 문서 링크에 포함되는 일반 문자열 `https://`를 비밀 입력값으로 사용해 검사 범위가 겹침
- 해결: 문서 URL과 겹치지 않는 고유한 잘못된 URL(`https://bad host`)로 검사

### 2026-11-10 — frontend/src/app/auth-pages.test.tsx:카카오·회원가입
- 작업: PLAN 7~9단계 프론트엔드 인증, F-01
- 증상: 앞 테스트의 화면이 남아 카카오 버튼이 중복되고, 회원가입 입력이 다른 폼에 들어감
- 원인 분류: 테스트 오류
- 원인: Vitest 환경에서 React Testing Library 정리가 자동 실행되지 않아 테스트 간 DOM이 공유됨
- 해결: 각 테스트 뒤 `cleanup()` 실행

### 2026-11-10 — frontend/src/app/signup/complete/complete-signup.test.tsx:다시 시도
- 작업: PLAN 7~9단계 프론트엔드 인증, F-01
- 증상: 재시도 테스트에서 백엔드 가짜 호출 2회 예상 대신 3회 발생
- 원인 분류: 테스트 오류
- 원인: 이전 테스트의 화면이 남고 router mock이 렌더마다 새 객체를 반환해 effect가 재실행됨
- 해결: 각 테스트 뒤 `cleanup()` 실행, 안정적인 router 메서드를 effect 의존성으로 사용

### 2026-11-10 — frontend/e2e/build-secrets.spec.ts:빌드 결과물에 비밀 키 문자열이 없다
- 작업: PLAN 7~9단계 프론트엔드 인증, F-01
- 증상: E2E 데스크톱·모바일에서 `SUPABASE_SECRET_KEY`, `sb_secret_` 문자열 발견
- 원인 분류: 테스트 오류
- 원인: 새 Supabase JS 의존성의 자체 키 형식 검사 코드(`GoTrueAdminApi.ts`, `FunctionsClient.ts`, `fetch.ts`)가 빌드 산출물에 포함되어 일반 문자열 검사에 걸림. 실제 키 값 노출 증거는 없음
- 해결: 사용자 승인 후, 고유 가짜 secret을 E2E webServer 환경에 넣고 `.next` 전체에서 그 값이 없는지 검사. 라이브러리의 일반 문자열은 검사 대상에서 제외

### 2026-11-10 — backend/app/ai/compare.py:probe --fake
- 작업: PLAN 7단계 AI 제공사 비교 실행 명령, F-05·F-07·F-08
- 증상: 평가 자료를 읽는 단계에서 `question.explanation`, `question.choices` 필수 필드 누락으로 Pydantic ValidationError
- 원인 분류: 타입·데이터 형식
- 원인: 승인된 고정 서술형 평가 자료는 생성용 `Question` 모델과 달리 해설·객관식 보기 필드를 생략했는데, 실행 명령이 그대로 `Question`으로 검증함
- 해결: 평가 자료 로더에서 생략된 해설은 빈 문자열, 보기는 빈 목록으로 채운 뒤 `Question`으로 검증

### 2026-11-10 — backend/tests/test_ai_compare.py:test_prompt_loading
- 작업: AI 제공사 비교 계획, probe 후 프롬프트 v2 (F-05, F-07, F-08)
- 증상: `assert prompt.version == "v1"` 실패 (실제 `v2`)
- 원인 분류: 테스트 오류
- 원인: 기본 프롬프트 버전을 의도적으로 v2로 바꿨는데 테스트가 v1을 고정값으로 확인하고 있었다
- 해결: 기본값은 `PROMPT_VERSION`(v2)과 비교하고, v1도 명시하면 계속 불러와지는지 확인하도록 테스트를 바꿈 (이전 실행 재현용)

### 2026-11-10 — backend/tests/test_ai_compare.py (프롬프트 v4 전환)
- 작업: 프롬프트 v3 계획, 재시험 후 수정 (F-05, F-08)
- 증상: 테스트 4개가 `tests/fixtures/ai_prompts/v4/...` 파일 없음으로 실패, `test_report_validation`이 문제 코드 집합 불일치로 실패
- 원인 분류: 테스트 오류
- 원인: 기본 프롬프트를 v4로 올렸는데 테스트용 프롬프트 폴더에 v4가 없었다. 리포트 내부 ID 검사(`report_internal_id`)를 새로 넣어, ID가 들어간 테스트 문장이 의도대로 이 문제도 잡히게 됐다
- 해결: 테스트용 프롬프트 v4 폴더 추가, 기대 문제 코드에 `report_internal_id` 추가, "문제 없는 리포트" 예시 문장에서 내부 ID를 뺌

### 2026-11-10 — frontend Playwright E2E (서버 시작 단계)
- 작업: 문제 은행 DB·적재·생성·승인 명령, F-03·F-05
- 증상: `pnpm test:e2e`에서 Next 서버가 `listen EPERM: operation not permitted 0.0.0.0:31847`로 시작하지 못해 테스트를 실행하지 못함.
- 원인 분류: 환경·설정
- 원인: 실행 샌드박스가 테스트 서버의 포트 바인딩을 거부함.
- 해결: Codex 샌드박스 밖(Opus 실행 환경)에서 `pnpm test:e2e` 재실행, 10개 통과 (2026-11-10). 코드 문제 아님. 위임 지시서에 "E2E는 샌드박스에서 포트를 열 수 없으면 Opus가 실행"을 적는다.
