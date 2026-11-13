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

### 2026-11-12 — frontend/src/lib/figures/figures.test.ts:상자그림 다섯 수치의 위치
- 작업: 그림 그리기 확장 단계 1, F-06
- 증상: 상자 x좌표 114 대신 0으로 검사 실패
- 원인 분류: 테스트 오류
- 원인: 첫 rect를 상자로 찾던 기존 검사가 새 흰 배경 rect를 선택했다.
- 해결: 테두리 속성으로 상자 rect를 찾는다.

### 2026-11-12 — frontend/e2e: Playwright 서버 시작
- 작업: 그림 그리기 확장 단계 1, F-06
- 증상: `pnpm test:e2e`의 Next.js 서버가 `listen EPERM: operation not permitted 0.0.0.0:3000`으로 시작되지 않음.
- 원인 분류: 환경·설정
- 원인: 실행 샌드박스에서 서버 포트 바인딩이 거부되어 테스트 실행 전 중단됨.
- 해결: Opus가 샌드박스 밖에서 실행, 22 통과.

### 2026-11-12 — backend/tests/test_ai_compare.py: v9 프롬프트 픽스처
- 작업: 그림 그리기 확장 단계 4, F-05
- 증상: 7개 테스트가 v9 픽스처 파일을 찾지 못함.
- 원인 분류: 테스트 오류
- 원인: 기본 프롬프트 버전을 v9로 바꿀 때 테스트 전용 v9 픽스처를 복사하지 않았다.
- 해결: v8 테스트 픽스처를 v9로 복사했다.

### 2026-11-12 — backend/tests/test_concept_converter.py: 그림 참조·전체 문서 회귀
- 작업: 그림 그리기 확장 단계 4, F-03·F-05
- 증상: 그림 참조 테스트와 35개 성취기준 문서·JSON 일치 검사가 실패했다.
- 원인 분류: 설계 불일치
- 원인: 작업 시작 전 변경된 개념 문서에 그림 표기가 이미 있고, 대응 JSON은 아직 갱신되지 않아 테스트의 기존 문서 가정 및 사본 비교와 다르다.
- 해결: Opus가 단계 5에서 `convert-concepts`로 35개 JSON을 변환해 해결 (pytest 179 통과).

### 2026-11-12 — frontend/e2e: Playwright 서버 시작 (단계 4)
- 작업: 그림 그리기 확장 단계 4, F-06
- 증상: `pnpm test:e2e`가 `listen EPERM: operation not permitted 0.0.0.0:3000`으로 중단됐다.
- 원인 분류: 환경·설정
- 원인: 샌드박스에서 Next.js 서버 포트 바인딩이 거부되어 테스트를 시작하지 못했다.
- 해결: Opus가 샌드박스 밖에서 실행, 통과.

### 2026-11-12 — backend/tests/test_concept_converter.py: 전체 문서 회귀 재실행
- 작업: 그림 그리기 확장 단계 4, F-03·F-05
- 증상: 35개 개념 문서와 JSON 비교 실패, 나머지 158개 테스트 통과.
- 원인 분류: 설계 불일치
- 원인: 선행 변경된 개념 문서가 아직 단계 5의 JSON 변환 전이다. 같은 원인으로 세 번째 실패했다.
- 해결: 위와 같음 (Opus JSON 변환). 문서·JSON을 건드리지 말라는 지시는 Opus가 위임 범위를 정한 것이다.

### 2026-11-12 — frontend/e2e: 단계 4 새 그림 화면
- 작업: 그림 그리기 확장 단계 4, F-06
- 증상: `pnpm test:e2e`가 `listen EPERM: operation not permitted 0.0.0.0:3000`으로 서버 시작 전에 중단됐다.
- 원인 분류: 환경·설정
- 원인: 샌드박스가 Next.js 서버의 포트 바인딩을 거부했다.
- 해결: Opus가 샌드박스 밖에서 실행, 24 통과.

### 2026-11-12 — frontend/src/lib/figures/figures.test.ts: 예시 그림 글자 순서
- 작업: 그림 그리기 확장 단계 4 그리기 2차 수정, F-06
- 증상: 빈 글자가 있는 그림 3의 출력 순서 검사 실패.
- 원인 분류: 테스트 오류
- 원인: 그림 3에는 text가 없어 `slice(-0)`이 전체 요소를 반환했다. 처음에는 빈 text 요소 때문으로 잘못 판단해 수정했으나 같은 오류가 반복됐다.
- 해결: 글자가 없는 그림을 별도로 처리하고, 글자가 있는 경우 모든 text의 순서를 검사한다.

### 2026-11-12 — frontend/src/lib/figures/figures.test.ts: 글자 없는 그림의 출력 순서 재검사
- 작업: 그림 그리기 확장 단계 4 그리기 2차 수정, F-06
- 증상: 그림 3 출력 순서 검사가 같은 이유로 다시 실패.
- 원인 분류: 테스트 오류
- 원인: 첫 수정에서 `slice(-0)`이 전체 배열을 반환한다는 점을 놓쳤다.
- 해결: text 요소가 없는 경우를 별도 처리한다.

### 2026-11-12 — frontend/src/lib/figures/figures.test.ts: 모든 종류 글자 순서
- 작업: 그림 그리기 확장 단계 4 그리기 3차 수정, F-06
- 증상: 전체 종류 집합 검사에서 boxplot·scatter 누락.
- 원인 분류: 테스트 오류
- 원인: 새 그림 예시 목록만 검사했고 기존 종류 예시 배열을 포함하지 않았다.
- 해결: 기존 그림 예시와 새 그림 예시를 함께 검사한다.

### 2026-11-12 — backend/tests/test_concept_converter.py::test_figure_references_and_variants
- 작업: 남은 그림 항목·중3 마무리 계획 검수 (F-03)
- 증상: `assert result["variants"] == 1` 실패 (`2 == 1`)
- 원인 분류: 테스트 오류
- 원인: 테스트가 실제 `backend/data/concepts/9수03-19.json`을 복사해 쓰면서 그 `variants`가 1이라고 가정했다. 이번 계획에서 실제 데이터를 2로 올리자 깨졌다. 변환기는 기존 JSON의 `variants`를 유지한다(`converter.py:172`).
- 해결: 테스트가 복사한 고정 데이터의 `variants`를 1로 직접 정한 뒤 유지되는지 검사한다. 실제 데이터 값에 기대지 않는다.

### 2026-11-12 — frontend/src/lib/figures/figures.test.ts:다각 입체의 가려진 모서리만 점선이다
- 작업: 사각뿔 높이 라벨과 그림 크기 수정, F-05
- 증상: 사각뿔 뒤 꼭짓점 C의 모서리에 점선 대신 실선이 출력됨
- 원인 분류: 기타 (투영 각도)
- 원인: 밑면 회전을 대각선 방향에 너무 가깝게 바꿔 C와 D 사이 옆면이 보이는 방향으로 투영됨
- 해결: 밑면 회전 각도를 줄여 기존 숨은 모서리 판정과 라벨 공간을 함께 유지

### 2026-11-12 — frontend/src/lib/figures/figures.test.ts:사각뿔의 높이선과 모서리가 분리되고 꼭짓점 이름이 가까이 있다
- 작업: 사각뿔 사선 투영, F-05
- 증상: 최소 높이 비율 검사에서 예상 180 대신 179.99999999999997로 실패
- 원인 분류: 기타 (부동소수점 연산)
- 원인: 최소 높이를 밑면 폭의 정확히 0.6배로 두어 좌표 뺄셈의 반올림 오차가 경계값을 밑돎
- 해결: 최소 높이에 작은 여유를 둬 좌표 연산 뒤에도 기준을 넘게 함

### 2026-11-12 — diagnosis-flow.test.tsx:A 학년 제목과 B 탭, 검색 및 진행 상태
- 작업: UI 고도화 단계 2, F-04
- 증상: 중2 탭을 누른 뒤 `도형` 텍스트를 찾지 못함.
- 원인 분류: 테스트 오류
- 원인: 단원 제목에 번호가 함께 렌더링되는데 이름만 정확히 일치하는 텍스트로 조회함.
- 해결: 번호를 포함한 접근성 제목으로 조회함.

### 2026-11-12 — frontend/e2e-dev/flow.spec.ts:진단을 이어 풀고 리포트를 확인한 뒤 다른 변형을 받는다
- 작업: UI 고도화 단계 3 (디자인 기준 B를 모든 화면에 적용), F-04·F-06
- 증상: "답할 때 이동 줄이 움직이지 않는다" 검사(`documentY`)가 1px 차이로 실패. 1회차 데스크톱 16번째 문제 Expected 777.5 Received 776.5, 2회차 모바일 Expected 936.09375 Received 935.09375. 실행마다 실패하는 화면·문제가 달랐다.
- 원인 분류: 기타 (글꼴 교체로 인한 줄 높이 변화)
- 원인: Pretendard 동적 서브셋은 화면에 처음 나온 글자의 조각을 그때 받고(`font-display: swap`), `body`에 `line-height`가 없어 "normal"(글꼴 지표에 따라 달라짐)이었다. 답을 고르는 사이에 조각이 도착하면 대체 글꼴 → Pretendard로 바뀌며 위쪽 줄 높이가 조금 달라져 이동 버튼이 1px 움직였다. 같은 화면에서 문제 12개를 재었을 때는 차이가 없어(조각이 이미 받아진 상태) 간헐적으로만 드러났다. 이 원인은 줄 높이를 고정하자 사라진 것으로 확인했고, 글꼴 도착 시점을 직접 재지는 않았다.
- 해결: `globals.css`에 `body { line-height: 1.5 }`, 제목 `h1~h4 { line-height: 1.3 }`를 지정(Opus). 이어서 서술형 답 칸 높이(140px)가 공통 입력창 규칙(48px)에 덮인 결함도 함께 고침. 재실행: `pnpm test:e2e:dev`(임시 설정으로 3100·8100 포트) 두 번 연속 3개 모두 통과.

### 2026-11-12 — frontend/e2e/home.spec.ts:/login?login=1 화면은 가로로 넘치지 않는다, /login?login=1 화면은 스크립트 실행 전에도 비밀번호를 주소로 보내지 않는다
- 작업: UI 고도화 단계 4, 머리말 아이콘·파비콘 추가 (F-01)
- 증상: 데스크톱·모바일 4건 실패. `locator('main')`, `locator('form')`가 strict mode에서 2개로 잡힘. 직전 실행(아이콘 추가 전)에서는 같은 테스트가 통과했다.
- 원인 분류: 기타 (임시 시안 장치의 Suspense 대체본)
- 원인: 단계 2에서 넣은 임시 시안 장치가 루트 레이아웃에서 `<Suspense fallback={children}><VariantProvider>{children}</VariantProvider></Suspense>`로 화면 전체를 감쌌다. `/login?login=1`은 `searchParams`를 기다리는 동적 화면이라 이 경계가 대체본(같은 `children`)을 먼저 보내고 진짜 화면을 숨긴 `<div hidden id="S:0">`로 이어 보냈다(응답 HTML에서 `<main>`·`<dialog>`가 두 벌인 것을 `curl`로 확인). 스크립트가 바꿔 끼우기 전에는 폼과 `id="email"`이 두 벌이다. 이전 실행의 통과·실패는 응답 타이밍에 따라 갈린 것으로 본다.
- 해결: 쓰는 곳이 없어진 임시 시안 장치(`src/app/variant.tsx`, `variant.test.ts`, `data-variant`, 루트 Suspense)를 지움(Opus). 재실행: 프론트엔드 검사 전부, `pnpm test:e2e` 두 번 연속 26개 통과, `pnpm test:e2e:dev` 3개 통과.

### 2026-11-12 — frontend/e2e-dev/flow.spec.ts:진단을 이어 풀고 리포트를 확인한 뒤 다른 변형을 받는다 (mobile)
- 작업: UI 고도화, 로그인 전 주소 구조 변경(`/` 랜딩, `/login` 페이지) (F-01)
- 증상: 모바일 1회 실패(22.2초). 진행 표시 `locator('section p').filter({ hasText: /^\d+\s*\/\s*\d+$/ })`를 5초 안에 찾지 못함 (`toHaveText(/^1\s*\/\s*\d+$/)`). 실패 화면 기록(page snapshot)은 남지 않았다. 데스크톱·접근 권한 테스트는 같은 실행에서 통과.
- 원인 분류: 기타 (원인 미확인)
- 원인: 확인하지 못함. 같은 코드로 모바일만 다시 실행해 통과, 전체를 다시 실행해 3개 모두 통과했다. 그 실행 사이에 바꾼 것은 `e2e-dev/helpers.ts`의 `login()`이 여는 주소(`/login?login=1` → `/login`)뿐이며, 새 `/login`은 쿼리를 무시하므로 실패 원인으로 보기 어렵다. 같은 증상이 다시 나면 진행 표시를 기다리는 시점(진단 시작 응답 직후)을 먼저 본다.
- 해결: 없음 (재실행 통과). 반복되면 원인 조사.


### 2026-11-12 — frontend/src/lib/unit-progress.test.ts:깊이 이해를 정복한 뒤 다시 푸는 단원도 정복 수에 포함한다
- 작업: UI 고도화 첫 화면 진행, F-04·F-08
- 증상: 정복 수 1을 기대했지만 0으로 계산됨
- 원인 분류: 요구사항 오해
- 원인: 재진단 중이면 표시 상태가 진행 중으로 우선되는 함수를 정복 수에도 사용해 최근 완료의 깊이 이해를 누락함
- 해결: 정복 수는 진행 상태와 독립적으로 최근 완료 결과의 단원 단계를 확인함


### 2026-11-12 — frontend/src/app/(protected)/learning-map.test.tsx:상태별 게이지
- 작업: UI 고도화 학습 지도, F-04·F-08
- 증상: 기본 이해·다시 도전·빈 게이지에서 채워진 칸 수가 항상 3으로 집계됨
- 원인 분류: 테스트 오류
- 원인: 빈 칸에도 React가 빈 class 속성을 출력하는데 테스트가 속성 존재만 확인했음
- 해결: 실제 채움 색상에 대응하는 상태 클래스만 선택해 갯수를 검사함

### 2026-11-13 — history.test.tsx:첫 화면과 진단 화면에 지난 기록 링크가 있다
- 작업: UI 고도화 단계 4, F-06
- 증상: 제거한 `지난 기록으로` 링크를 찾지 못함.
- 원인 분류: 테스트 오류
- 원인: 풀이 화면의 중복 링크를 제거하라는 지시 이후에도 테스트가 두 링크를 요구함.
- 해결: 공통 머리말의 지난 기록 링크와 단원 복귀 링크를 확인하도록 변경.

### 2026-11-13 — diagnosis-flow.test.tsx:보기와 선택한 답의 표를 번호와 함께 표시한다
- 작업: UI 고도화 단계 4, F-06·F-08
- 증상: 결과 화면에서 라디오 버튼을 찾지 못함.
- 원인 분류: 테스트 오류
- 원인: 풀이 화면용 라디오 검사를 읽기 전용 결과 화면 검사에도 중복 삽입함.
- 해결: 라디오와 번호의 접근성 검사는 풀이 화면에서만 하고, 결과 화면은 표·그림 목록과 답안 표시를 확인함.

### 2026-11-13 — e2e/home.spec.ts:테마 선택은 새로고침 뒤에도 유지된다
- 작업: UI 고도화 4-1 Astryx 기반, 공통
- 증상: (1) 새로고침 뒤 `<html data-theme>`가 비어 있음. (2) 고친 뒤 `[data-astryx-theme="concept"]` 선택자가 2개 요소에 걸림(strict mode).
- 원인 분류: (1) 코드 오류 (2) 테스트 오류
- 원인: (1) Astryx 최상위 `<Theme>`가 `<html data-theme>`를 관리하며(`@astryxdesign/core/dist/theme/Theme.js` `useRootThemeSync`), 처음 그릴 때 `mode="system"`이면 속성을 지운다. 우리 코드가 모드를 그 속성에서 다시 읽어 저장한 선택이 사라졌다. (2) Astryx가 `<html>`에도 `data-astryx-theme`를 붙여 감싸개와 둘이 되었다.
- 해결: (1) 모드를 `localStorage.theme`에서 읽는다(`storedTheme()`). (2) `<html>`과 `body` 안 감싸개를 따로 검사.

### 2026-11-13 — 인증·랜딩 컴포넌트 Vitest
- 작업: Astryx 전환 4-2, F-01
- 증상: `pnpm test`에서 인증·랜딩 테스트 6개 실패. 체크박스 이름에 `Required`가 추가되고, 머리말 landmark가 사라졌으며, 비활성 버튼의 `disabled` 속성이 false로 나타남.
- 원인 분류: 설계 불일치
- 원인: Astryx CheckboxInput은 필수 문구를 추가하고, TopNav는 nav만 렌더링하며, Button은 `disabled` 대신 `aria-disabled`를 사용함.
- 해결: header landmark를 복원하고 중복 필수 표시는 숨김. 테스트와 E2E는 새 체크박스 구조와 aria-disabled 동작을 검증함.

### 2026-11-13 — `astryx doctor --built .next` 테마 검사
- 작업: Astryx 전환 4-2, F-01
- 증상: theme-module·theme-local-builds 검사 실패. theme-module-import·theme-fonts 경고.
- 원인 분류: 환경·설정
- 원인: 기존 4-1 테마 생성물과 CLI가 기대하는 생성 결과가 일치하지 않으며, CLI는 앱의 별칭 import와 로컬 Pretendard 로딩을 확인하지 못함.
- 해결: 미해결. 이번 지시의 테마 파일 변경 금지와 외부 글꼴 요청 금지에 따라 유지하고 보고함.

### 2026-11-13 — 학습 지도 및 진단 흐름 Vitest
- 작업: Astryx 전환 4-3①, F-04
- 증상: `pnpm test` 16건 실패. 제거한 게이지·길 장식 선택자와 네이티브 disabled 속성 및 버튼 메뉴 역할을 찾음.
- 원인 분류: 테스트 오류
- 원인: 기존 화면 장식과 details 메뉴의 DOM 구조를 테스트가 직접 참조했으나 Astryx 컴포넌트는 상태를 `aria-disabled`와 menuitem 역할로 표시함.
- 해결: 상태 글자·모양, 정복 수, 주 버튼 우선순위, 메뉴의 실제 동작을 검사하도록 변경함.

### 2026-11-13 — Astryx doctor 4-3① 테마 검사
- 작업: Astryx 전환 4-3①, F-04·F-10
- 증상: `pnpm exec astryx doctor --built .next`의 theme-module·theme-local-builds 실패, theme-module-import·theme-fonts 경고가 다시 발생함.
- 원인 분류: 환경·설정
- 원인 (Opus 확인): Astryx가 만든 생성 파일(`src/astryx-themes.ts`, `src/themes/concept/concept.{js,css,d.ts}`)을 `pnpm format`(Prettier)이 다시 정렬해, doctor가 "생성 결과와 다름"으로 판정. 글꼴 경고는 Google Fonts를 쓰지 않는 결정(2026-11-13) 때문의 의도된 경고.
- 해결: 생성 파일 4종을 `.prettierignore`에 넣고 `astryx theme build/add/use`로 다시 생성. doctor fail 0.

### 2026-11-13 — learning-map.test.tsx:더보기 메뉴 바깥 클릭
- 작업: Astryx 전환 4-3①, F-04
- 증상: jsdom에서 바깥 pointerdown 뒤 메뉴의 `aria-expanded`가 true로 남음.
- 원인 분류: 환경·설정
- 원인: Astryx MoreMenu가 사용하는 브라우저 Popover의 바깥 클릭 닫힘을 jsdom이 구현하지 않음.
- 해결: 바깥 클릭 닫힘 검사는 실제 브라우저 E2E에 두고, Escape 닫힘은 Vitest에서 유지함.

### 2026-11-13 — 진단 흐름·랜딩 Vitest
- 작업: Astryx 전환 4-3②, F-06·F-08
- 증상: 저장 상태 역할 중복 3건, 제출 Dialog 포커스 1건, 저장 재시도 버튼 1건, 샘플 리포트 구역 선택 1건 실패.
- 원인 분류: 테스트 오류
- 원인: Astryx ProgressBar가 자체 `role="status"` 영역을 추가하는데 테스트가 이름 없이 status 하나만 찾았고, Section이 `<section>`을 렌더링한다고 가정했다. Dialog의 `data-autofocus`·포커스 복귀는 jsdom에서 동작하지 않았으며, Banner의 자식은 `collapsible={false}` 없이 바로 표시되지 않았다.
- 해결: 저장 상태에 접근성 이름을 붙여 정확히 찾고, Section은 Astryx 클래스 기준으로 찾는다. 제출 Dialog는 명시적으로 첫 버튼과 트리거에 포커스를 옮기고, 오류 Banner는 자식을 항상 펼쳐 둔다.

### 2026-11-13 — e2e/diagnosis-ui.spec.tsx (수집 단계)
- 작업: Astryx 전환 4-3②, F-06·F-08
- 증상: Astryx reset CSS를 읽지 못해 ENOENT가 발생하고 테스트를 수집하지 못함.
- 원인 분류: 테스트 오류
- 원인: 패키지 import 경로 `@astryxdesign/core/reset.css`를 실제 파일 경로 `dist/reset.css`로 잘못 추정했으며, 설치된 패키지의 파일은 `src/reset.css`에 있음.
- 해결: 정적 화면 E2E가 읽는 경로를 `node_modules/@astryxdesign/core/src/reset.css`로 고침.

### 2026-11-13 — e2e/diagnosis-ui.spec.tsx:풀이 머리와 리포트는 화면 너비 안에 표시된다
- 작업: Astryx 전환 4-3②, F-06·F-08 (Opus 검수)
- 증상: 버튼 높이 검사 실패. "이전" 버튼 36px (기준 44px 이상).
- 원인 분류: 코드 오류
- 원인: Astryx 컨트롤 높이 토큰 기본값이 `--size-element-md` 32px, `--size-element-lg` 36px (`astryx docs tokens/tokens-size`). 우리 터치 기준 44px(`docs/DESIGN.md` "화면", WCAG 2.5.5)보다 낮다. 학습 지도 등 Astryx 버튼을 쓴 모든 화면에 해당.
- 해결: 테마 `concept`에서 `--size-element-md`·`--size-element-lg`를 44px로(기본·폰 조건 모두), `astryx theme build/add/use`로 다시 생성.

### 2026-11-13 — e2e-dev/flow.spec.ts:진단을 이어 풀고 리포트를 확인한 뒤 다른 변형을 받는다
- 작업: UI 고도화 단계 5 (`pnpm test:e2e:dev`)
- 증상: 학습 지도 열 정렬 검사에서 `.learning-row` 0개 (`expect(columns.length).toBeGreaterThan(0)`).
- 원인 분류: 테스트 오류
- 원인: 4-3①에서 추가한 검사가 단원 목록을 불러오기 전(로딩 화면)에 행을 셌다. `test:e2e:dev`에서만 도는 검사라 추가 때 실행되지 않았다.
- 해결: 대상 단원 행이 보일 때까지 기다린 뒤 잰다.

### 2026-11-13 — e2e-dev/flow.spec.ts 학습 지도 열 정렬 (모바일), 지난 기록 제목
- 작업: UI 고도화 단계 5 (`pnpm test:e2e:dev`)
- 증상: (1) 모바일에서 동작 열 x 좌표 차이 2px(기준 1px). (2) `heading "지난 기록"`이 2개에 걸림(strict mode).
- 원인 분류: 테스트 오류
- 원인: (1) 사용자 요청으로 모바일 버튼 너비를 글자에 맞춰 버튼 묶음의 왼쪽 끝이 글자 길이에 따라 달라짐. 오른쪽 끝은 맞춰져 있음. (2) 지난 기록 로딩 화면 제목 "지난 기록을 불러오고 있어요."가 부분 일치로 함께 잡힘.
- 해결: (1) 동작 열은 오른쪽 끝을 비교(상태 열은 왼쪽 끝 그대로). (2) 제목은 `exact: true`.

### 2026-11-13 — e2e-dev/flow.spec.ts 지난 기록 진행 중 항목
- 작업: UI 고도화 단계 5 (`pnpm test:e2e:dev`)
- 증상: 진단 링크(`a`) 안에 "진행 중"이 없음.
- 원인 분류: 테스트 오류
- 원인: Astryx `ListItem`이 상태 꼬리표(`endContent`)를 링크 밖, 같은 목록 줄에 그린다. 화면에는 같은 줄에 보인다.
- 해결: 링크가 든 목록 줄(`li`)에서 상태를 확인. 링크 글자("이어서 풀기")와 이동 동작 검사는 그대로.

### 2026-11-13 — frontend/src/app/(protected)/diagnosis-flow.test.tsx:완료된 진단은 리포트와 문제별 결과를 표시한다
- 작업: UI 고도화 2차, F-08
- 증상: `1번 · 심화 문제` 제목을 찾지 못함.
- 원인 분류: 테스트 오류
- 원인: 기존 완료 진단 fixture에는 기본 문제만 있는데 심화 문제 제목을 검증함.
- 해결: 해당 테스트에 심화 문제를 추가하고 단계별 번호를 확인함.

### 2026-11-13 — e2e/figures.spec.tsx:새 그림의 본문과 보기 크기 (desktop)
- 작업: UI 고도화 2차, 랜딩·리포트 8개 항목 검수
- 증상: 전체 `test:e2e` 중 `locator.screenshot: Target page, context or browser has been closed` (32.0s, 기본 제한 30초 초과).
- 원인 분류: 환경·설정 (일시)
- 원인: 같은 파일만 다시 돌리면 8개 모두 13.6초에 통과. 바뀐 코드는 리포트·랜딩이고 이 테스트는 정적 그림 페이지라 관련 없음. 전체 실행 중 부하로 제한 시간을 넘긴 것으로 추정(근거: 재실행 결과만).
- 해결: 코드 변경 없음. 다시 나오면 이 테스트의 제한 시간·부하를 조사.

### 2026-11-13 — frontend Vitest: 랜딩 및 문제 결과 탐색 테스트
- 작업: UI 고도화 2차, F-01·F-08
- 증상: 랜딩 영역 포함 검사와 이전·다음 버튼 비활성 검사가 실패함.
- 원인 분류: 테스트 오류
- 원인: 히어로가 더 이상 Astryx Section이 아닌데 이전 선택자를 사용했고, Astryx Button이 `disabled` 대신 `aria-disabled`로 상태를 표시함.
- 해결: 새 히어로 선택자와 `aria-disabled`를 검사함.

### 2026-11-13 — frontend Vitest: 공통 머리말 관련 테스트 5건
- 작업: UI 고도화 2차, F-01·F-08
- 증상: 로그아웃 버튼 또는 지난 기록 링크가 여러 개 발견됨 (auth-pages 2건, history 1건, layout 2건).
- 원인 분류: 코드 오류 (Opus 확인)
- 원인: Opus가 머리말을 데스크톱용 글자 메뉴와 폰용 아이콘 메뉴 두 벌로 그리고 CSS로 하나를 숨김. jsdom은 CSS를 적용하지 않아 같은 이름의 링크·버튼이 둘로 보였고, 실제 DOM에도 같은 이름 요소가 중복됨.
- 해결: 동작마다 Astryx `Button` 하나(아이콘 + 글자 children, `label`이 접근성 이름)로 만들고 폰에서는 글자만 숨김. 테스트는 바꾸지 않았고 158개 통과.

### 2026-11-13 — frontend/src/app/(protected)/diagnosis-flow.test.tsx:학년 탭과 검색 및 진행 상태
- 작업: 학습 지도 길 시안, F-04
- 증상: 검색 결과 영역을 찾지 못함.
- 원인 분류: 테스트 오류
- 원인: 검색 입력 전에 검색 결과 영역에 노드가 없는지 검사함.
- 해결: 검색어 입력 후 기존 검색 결과 영역 검사에 노드 부재 확인을 추가함.
