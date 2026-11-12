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

### 2026-11-10 — frontend/src/app/(protected)/diagnosis-flow.test.tsx:답안 제출·중단 진단
- 작업: PLAN #9 4~6단계, F-04·F-06
- 증상: 답을 입력해도 제출 버튼이 비활성이고 중단된 진단의 라디오 disabled 속성 검사가 실패함
- 원인 분류: 테스트 오류
- 원인: router 가짜가 매 렌더마다 새 객체를 반환해 진단을 다시 불러오며 답을 초기화했고, 라디오는 상위 fieldset의 disabled를 상속하므로 자신의 disabled 속성만 확인해서는 실제 비활성 상태가 나타나지 않음.
- 해결: 안정적인 router 가짜를 반환하고 상속된 비활성 상태를 :disabled로 확인.

### 2026-11-10 — frontend Playwright webServer 시작
- 작업: PLAN #9 4~6단계, F-04·F-06
- 증상: `pnpm test:e2e`가 `listen EPERM: operation not permitted 0.0.0.0:3000`으로 서버 시작 전 중단됨.
- 원인 분류: 환경·설정
- 원인: 현재 샌드박스가 Playwright의 Next.js 서버가 포트 3000을 열지 못하게 막음.
- 해결: Codex 샌드박스 밖(Opus 실행 환경)에서 `pnpm test:e2e` 재실행, 12개 통과 (2026-11-10). 코드 문제 아님 (2026-11-09 기록과 같은 원인 반복).

### 2026-11-10 — frontend/e2e-dev/flow.spec.ts:진단을 풀고 이어서 확인해 제출하면 다음 진단은 다른 변형을 출제한다
- 작업: PLAN #9 7단계, F-04·F-06
- 증상: desktop·mobile 모두 `Test timeout of 180000ms exceeded`. 실패 화면은 "1 / 6", 모든 답 저장됨, "이전" 버튼 비활성.
- 원인 분류: 테스트 오류
- 원인: 테스트가 "이어서 풀기" 후 마지막 문제에서 시작한다고 가정하고 "이전"을 N-1번 눌렀다. 화면은 설계대로 답하지 않은 첫 문제(모두 답했으면 첫 문제)에서 시작하므로, 비활성인 "이전"을 누르려고 계속 기다렸다.
- 해결: "1 / N"이 될 때까지만 "이전"을 누르도록 고침. 재실행 3개 통과 (2026-11-10).

### 2026-11-10 — backend/tests/test_auth.py:test_cors_preflight (LAN 주소)
- 작업: PLAN #11 0단계 개발 중 폰 접속, F-01
- 증상: 허용된 LAN 요청에 LAN 주소가 반환됐으나 테스트는 localhost 주소를 기대해 실패.
- 원인 분류: 테스트 오류
- 원인: 기존 단일 주소 테스트를 여러 Origin으로 확장하면서 허용 응답이 요청 Origin과 일치해야 한다는 기준 대신 고정된 localhost 기대값을 그대로 둠.
- 해결: 요청에 사용한 각 Origin이 응답 헤더에 반환되는지 검사하도록 수정.

### 2026-11-10 — frontend Playwright webServer 시작 (계획 #11 2단계)
- 작업: PLAN #11 채점·2단계·리포트 마이그레이션, F-05·F-06·F-07·F-08·F-09
- 증상: `pnpm test:e2e`가 `listen EPERM: operation not permitted 0.0.0.0:3000`으로 서버 시작 전 중단됨.
- 원인 분류: 환경·설정
- 원인: 현재 샌드박스에서 Playwright가 시작한 Next.js 서버의 포트 수신이 거부됨.
- 해결: 미해결. 포트 수신이 허용된 환경에서 재실행 필요.

### 2026-11-10 — backend/tests/test_selection.py:test_no_ai_import
- 작업: PLAN #11 4·5단계 AI 연결과 API, F-05·F-07·F-08
- 증상: 기존 테스트가 진단 패키지의 AI 모듈 import를 발견해 실패함.
- 원인 분류: 요구사항 오해
- 원인: 이전 단계의 테스트가 출제 시 AI를 호출하지 않는 요구사항을 진단 패키지 전체에 AI import를 금지하는 방식으로 검사했으나, 새 승인 설계는 동일 패키지에 AI 채점·리포트 연결을 추가함.
- 해결: 사용자 승인으로 출제 코드의 import 검사로 범위를 바로잡고 진단 시작 API에서 가짜 AI 호출이 없는지 동작 테스트를 추가.

### 2026-11-11 — frontend/e2e-dev/access.spec.ts:다른 계정의 진단과 문제 은행에 접근할 수 없다, flow.spec.ts (desktop·mobile)
- 작업: 계획 시작 전 회사 PC 환경 확인 (`pnpm test:e2e:dev`), F-01·F-04
- 증상: access는 `POST /signup/complete`가 200이 아니라 401. flow는 단원 선택 화면이 "단원을 불러오고 있어요."에서 멈춰 180초 시간 초과.
- 원인 분류: 환경·설정
- 원인: PC 시계가 약 2초 늦었다 (`sntp time.apple.com` +1.97s). Supabase가 막 발급한 토큰의 `iat`가 백엔드 기준 미래가 되어, PyJWT 2.15.1 `_validate_iat`가 `ImmatureSignatureError`를 냈고 `backend/app/auth.py`가 leeway 0으로 이를 401로 바꿨다.
- 해결: 사용자가 `sudo sntp -sS time.apple.com`으로 시계를 맞춘 뒤 3개 모두 통과. 코드에 허용 오차(`leeway`)를 둘지는 결정 대기 (`docs/PROGRESS.md`).

### 2026-11-11 — frontend/e2e-dev/access.spec.ts, flow.spec.ts (desktop·mobile) (재발)
- 작업: 계획 "확장 준비" 8단계 검수, F-05·F-03·F-08
- 증상: 같은 날 오전 기록과 같다. access는 `POST /signup/complete` 401, flow는 단원 목록에서 180초 시간 초과.
- 원인 분류: 환경·설정
- 원인: 오전에 `sntp -sS`로 맞춘 PC 시계가 약 2시간 뒤 다시 약 2초 늦어졌다 (`sntp time.apple.com` +2.02s). 토큰 `iat`가 백엔드 기준 미래가 되어 PyJWT가 거부했다 (`backend/app/auth.py`, leeway 0). 같은 원인 2회째.
- 해결: 사용자가 시계를 다시 맞춘 뒤 통과. 재발 방지로 백엔드 토큰 검증에 시각 허용 오차 10초를 두었다 (사용자 결정 2026-11-11, `backend/app/auth.py` `CLOCK_SKEW_SECONDS`, 경계 테스트 `tests/test_auth.py`).

### 2026-11-11 — backend/tests/test_bank.py:test_curriculum_data_and_idempotent_load
- 작업: 계획 "중1 3단원 완성" 2단계, F-03
- 증상: `9수02-03` 성취기준 원문과 `concepts[0].standard_text`가 다르다 ("방정식과 그 해의 뜻을…" ≠ "다양한 상황을 문자를…").
- 원인 분류: 테스트 오류
- 원인: 테스트가 개념 데이터 파일이 `9수02-03` 하나뿐이라고 가정하고 첫 번째 파일을 골랐다. `9수02-01` 등이 추가되자 첫 번째가 바뀌었다. 첫 번째 오개념 ID가 `9수02-03-M1`이라는 검사도 같은 가정이었다.
- 해결: 모든 개념 파일의 원문이 성취기준 데이터와 같은지, 모든 오개념 ID에 성취기준 접두어가 붙는지 검사하도록 넓혔다 (검사를 약하게 하지 않음).

### 2026-11-11 — frontend/e2e-dev/flow.spec.ts:진단을 이어 풀고 리포트를 확인한 뒤 다른 변형을 받는다 (desktop·mobile)
- 작업: 계획 "중1 3단원 완성", 사용자 수동 확인에서 나온 보기 스크롤 막대 수정, F-06
- 증상: 보기 수식의 `scrollHeight > clientHeight`가 2개 (`\dfrac{a}{3}` 44/41px, `\dfrac{3}{a}` 49/45px).
- 원인 분류: 기타 (화면 CSS 값 부족)
- 원인: 세로 스크롤 막대를 없애려고 `overflow-y: hidden`과 위아래 여백 0.2em을 줬는데, `\dfrac` 분수의 아래쪽(분모)이 여백보다 3~4px 더 내려가 잘렸다. 스크롤 막대만 사라지고 내용이 잘린 상태였다.
- 해결: 위아래 여백을 0.4em으로 늘림. 같은 검사가 데스크톱·모바일에서 통과.

### 2026-11-11 — frontend/e2e-dev/flow.spec.ts:진단을 이어 풀고 리포트를 확인한 뒤 다른 변형을 받는다 (desktop·mobile)
- 작업: 계획 "중1 3단원 완성", 답하기 전 "다음" 꺼짐, F-06
- 증상: 두 테스트 모두 180초 시간 초과. 화면은 1/20에서 "다음" 꺼짐.
- 원인 분류: 테스트 오류
- 원인: 테스트 마지막 부분(다시 시작하면 다른 변형인지 확인)이 답하지 않고 "다음"만 눌러 20문제를 넘겼다. 새 동작에서 "다음"이 꺼져 있어 클릭이 켜지기를 기다리다 시간이 지났다.
- 해결: 그 부분도 답한 뒤 "다음"을 누르게 고침. 3개 통과 (1.8분).

### 2026-11-11 — frontend/e2e-dev/flow.spec.ts:진단을 이어 풀고 리포트를 확인한 뒤 다른 변형을 받는다 (desktop·mobile)
- 작업: 계획 #19, 사용자 수동 확인에서 나온 제출 확인 모달, F-06
- 증상: 180초 시간 초과. trace 로그: "`<dialog aria-label="제출 확인">` subtree intercepts pointer events"로 "← 단원 선택으로" 링크를 누르지 못함.
- 원인 분류: 기타 (화면 CSS)
- 원인: 모달 `<dialog>`에 `stack` 클래스(`display: grid`)를 붙여, 닫힌 dialog의 기본 `display: none`을 덮어썼다. 닫힌 모달이 화면 위에 떠서 다른 링크·버튼을 가렸다. Vitest(jsdom)는 레이아웃을 계산하지 않아 잡지 못했다.
- 해결: `stack`을 빼고 `.submit-dialog[open]`일 때만 flex로 배치.

### 2026-11-11 — frontend/e2e-dev/flow.spec.ts:진단을 이어 풀고 리포트를 확인한 뒤 다른 변형을 받는다 [mobile]
- 작업: 중2 전체, F-06 (문제 은행 확장 중 계획 종료 검사)
- 증상: `flow.spec.ts:81` `expect((await forward.boundingBox())?.y).toBe(navBefore)` 실패. Expected 995.28, Received 732.28. 2단계(심화) 첫 문제, 360×800 화면.
- 원인 분류: 테스트 오류
- 원인: "답할 때 이동 줄이 움직이지 않는다" 검사가 화면 기준 좌표(`boundingBox().y`)를 비교한다. 2단계 안내 문구와 긴 문장제 때문에 "다음" 버튼이 처음부터 화면 아래(y=995 > 화면 높이 800)에 있었고, `radio.check()`가 보기를 누르려고 화면을 263px 스크롤해 좌표가 바뀌었다. 이동 줄은 문서 안에서 움직이지 않았다. 지금까지는 짧은 문제만 걸려 스크롤이 생기지 않아 드러나지 않았다. 이 계획에서는 프론트엔드 코드를 바꾸지 않았다.
- 해결: 사용자 허락(2026-11-11)으로 테스트를 문서 기준 위치(`boundingBox().y + window.scrollY`) 비교로 고침 (`documentY`, Cursor 위임, Opus 검수). 비교는 `toBe` 그대로. 위치를 못 읽으면 실패하게 함 (예전에는 `undefined === undefined`로 통과할 수 있었음). 재실행: 5.2 검사 모두 통과, `pnpm test:e2e:dev` 3개 통과.

### 2026-11-12 — backend/tests/test_ai_compare.py 및 test_diagnoses.py
- 작업: 문제 그림 지원, F-05·F-06
- 증상: pytest 8개 실패. v8 테스트 프롬프트 파일이 없고 생성 스키마·진단 응답의 새 figure 필드가 기존 필드 목록 검사와 다름.
- 원인 분류: 테스트 오류
- 원인: 프롬프트 버전과 공개 응답·생성 스키마 변경에 맞춰 기존 테스트용 파일과 계약 검사를 갱신하지 않았다.
- 해결: v8 테스트 프롬프트를 준비하고 새 필드 계약을 검사하도록 갱신한다.

### 2026-11-12 — frontend Playwright 서버 및 브라우저 시작
- 작업: 문제 그림 지원, F-06
- 증상: `pnpm test:e2e`에서 Next.js가 `listen EPERM: operation not permitted 0.0.0.0:3000`으로 시작하지 못함. 서버 없이 그림 화면을 시험한 별도 실행에서도 Chromium이 `bootstrap_check_in ... Permission denied (1100)`으로 종료됨.
- 원인 분류: 환경·설정
- 원인: 실행 환경이 서버의 소켓 바인딩과 Chromium의 Mach 서비스 등록을 거부해 테스트 화면을 열지 못함.
- 해결: Codex 샌드박스의 포트·브라우저 제한이다 (2026-11-10 기록과 같은 원인). Opus가 일반 셸에서 `pnpm test:e2e`를 실행해 확인한다.

### 2026-11-12 — frontend Playwright 웹 서버 재시도
- 작업: 문제 그림 지원, F-06
- 증상: 전체 검사 재실행 시 `pnpm test:e2e`가 같은 `listen EPERM: operation not permitted 0.0.0.0:3000`으로 종료됨.
- 원인 분류: 환경·설정
- 원인: 실행 환경이 Next.js 서버의 로컬 포트 바인딩을 계속 거부함.
- 해결: 테스트 실패가 아니라 Codex 실행 환경(샌드박스)의 포트 제한이다. Opus가 같은 PC의 일반 셸에서 `pnpm test:e2e`를 실행해 확인한다 (그림 테스트 2개 통과, 2026-11-12).

### 2026-11-12 — frontend/e2e/figures.spec.tsx (mobile)
- 작업: 문제 그림 지원, F-06
- 증상: `[mobile] 본문 표와 그림 보기의 화면 너비` 실패. 360px에서 보기가 1열로 쌓이지 않음 (둘째 보기 y가 첫째와 같음).
- 원인 분류: 테스트 오류
- 원인: 테스트가 `page.setContent`로 만든 화면에 `<meta name="viewport">`가 없었다. Playwright 모바일 설정(`isMobile: true`)은 이 태그가 없으면 980px 너비로 그리므로 600px 미만 규칙이 적용되지 않았다. 같은 이유로 이 테스트의 가로 넘침 검사도 360px을 검사하지 못하고 통과하고 있었다. 실제 앱은 Next.js가 viewport 태그를 넣는다.
- 해결: 테스트 화면에 viewport 태그를 넣음 (Opus). 데스크톱·모바일 모두 통과. 스크린샷 저장 위치를 `/private/tmp`에서 `frontend/test-results/`로 옮김 (사용자 지시: 파일은 작업 디렉터리 안에).

### 2026-11-12 — 그림 크기 보완 Playwright 웹 서버 시작
- 작업: 문제 그림 지원, F-06
- 증상: `pnpm test:e2e`에서 Next.js가 `listen EPERM: operation not permitted 0.0.0.0:3000`으로 시작하지 못해 테스트와 스크린샷을 실행하지 못함.
- 원인 분류: 환경·설정
- 원인: 실행 환경이 로컬 서버의 포트 바인딩을 거부함.
- 해결: 위와 같은 Codex 샌드박스 포트 제한. Opus가 일반 셸에서 실행해 통과 확인 (2026-11-12). 앞으로 위임 지시서에는 "포트가 막히면 기록하지 말고 보고만"을 적는다.

### 2026-11-12 — frontend/src/lib/figures/figures.test.ts:글자와 축·눈금 겹침
- 작업: 문제 그림 지원 좌표평면 비율·눈금, F-06
- 증상: 촘촘한 좌표평면 견본에서 `coordinate_plane: -2 / O` 겹침 검사가 실패했다.
- 원인 분류: 타입·데이터 형식
- 원인: 원점 왼쪽 아래에 두 자릿수 음수 눈금과 O를 배치할 때, 눈금 위치만 기준으로 거리를 계산하고 숫자 글자의 폭을 반영하지 않았다.
- 해결: 음수 숫자 글자의 폭과 원점 표기 너비를 함께 고려해 O와 겹치는 눈금 숫자를 생략한다.

### 2026-11-12 — frontend/src/lib/figures/figures.test.ts:촘촘한 축 숫자
- 작업: 문제 그림 지원 좌표평면 비율·눈금, F-06
- 증상: 도수 그래프 시험에서 특정 경계값 `52`가 표시돼야 한다는 단언이 실패했다.
- 원인 분류: 테스트 오류
- 원인: 테스트가 허용된 2·5·10 간격 중 하나의 특정 숫자를 요구했지만, 실제 견본에서는 글자 폭을 고려한 2칸 간격이 유효해 52가 선택되지 않는다.
- 해결: 특정 경계값 대신 3개 이상의 실제 계급 경계가 표시되고 원래 계급 폭과 정렬되는지 검사한다.

### 2026-11-12 — backend/tests/test_concept_converter.py:test_regression_all_documents
- 작업: 개념 데이터 변환 명령, F-03
- 증상: 58개 문서 전체 회귀 검사에서 금지 용어 검출 32개 문서와 용어 목록 불일치 12개 문서로 실패했다. 나머지 테스트 153개는 통과했다.
- 원인 분류: 설계 불일치
- 원인: 문서 전체에는 뒤 단원에서 다룰 용어를 쓰지 말라는 안내와 이전 용어 출처가 들어 있어 문자열 포함 방식의 금지 용어 검사에 걸린다. 문서의 용어 표현과 기존 JSON 용어 목록도 서로 일치하지 않는 경우가 있다.
- 해결 (Opus): (1) 용어 목록은 손으로 정리해 승인된 기존 JSON 값을 유지하고, 새 성취기준만 "용어" 절에서 읽는다 (자유 문장이라 "밑각은 초등", "기호 sin" 같은 잘못된 항목이 생김). (2) 금지 용어는 변환 결과에서 찾고 실패 대신 경고로 출력한다 (범위 문장이 제외할 뒤 단원 용어를 일부러 적기 때문, 판단은 검토자). (3) 승인 날짜는 "상태"와 "사용자 승인" 변경 줄 가운데 가장 늦은 날. (4) `9수02-03`은 문서와 JSON이 실제로 달라 사용자 결정("문서를 JSON에 맞춤")으로 문서를 고침. (5) `--check`는 키 순서가 다른 옛 파일 때문에 바이트가 아니라 내용으로 비교. 결과: 58개 문서 모두 일치.
