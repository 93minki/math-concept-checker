# DESIGN

확정된 설계만 적는다. 결정마다 근거(`AGENTS.md` 3.3)를 함께 적는다.
이 문서는 하나만 두고 계속 고친다. 백업·이동하지 않는다.

## 기술 스택

| 영역 | 선택 | 근거 |
|---|---|---|
| 프론트엔드 | Next.js | 사용자 결정 (2026-11-09) |
| 백엔드 | FastAPI (Python) | 사용자 결정 (2026-11-09) |
| 인증 | Supabase Auth | 사용자 결정 (2026-11-09) |
| 데이터베이스 | PostgreSQL (Supabase 내장) | 아래 "데이터베이스 선택" |
| Supabase 운영 | Supabase 클라우드 | 사용자 결정 (2026-11-09). 셀프 호스팅 이전 경로는 아래 참고 |
| 수식 렌더링 | KaTeX | 사용자 결정 (2026-11-09). 아래 "수식 렌더링" 시험 결과 |

### 데이터베이스 선택: PostgreSQL
- Supabase 프로젝트는 모두 완전한 Postgres 데이터베이스이고, Auth가 이 데이터베이스 위에 만들어져 있다. ([Supabase Database 문서](https://supabase.com/docs/guides/database/overview))
  → MySQL·MongoDB를 쓰면 Supabase 밖에 DB를 따로 두어야 하고, Supabase Auth 사용자와 DB가 분리된다.
- `AGENTS.md` 4.3은 사용자 데이터 테이블에 RLS를 요구한다. Supabase는 Postgres의 RLS로 데이터 접근을 제한한다. ([Supabase Database 문서](https://supabase.com/docs/guides/database/overview))
- 이용 기록(F-09)은 사용자 → 진단 → 문제 → 답안 → 채점처럼 서로 연결된 데이터다. Supabase Postgres는 외래 키를 지원한다. ([Supabase for Postgres Developers](https://supabase.com/solutions/postgres-developers))
- AI가 만든 문제를 당시 내용 그대로 저장(F-09)하는 데 JSONB를 쓸 수 있다. ([Supabase for Postgres Developers](https://supabase.com/solutions/postgres-developers))
  → 관계형 데이터와 문서형 데이터를 한 DB에서 다룰 수 있으므로 MongoDB를 추가할 이유가 없다.
- GraphQL은 데이터베이스가 아니라 API 질의 방식이다. API는 FastAPI가 맡고, `docs/features.md`에 GraphQL이 필요한 요구사항이 없으므로 쓰지 않는다.

### Supabase 셀프 호스팅 이전 가능성
- 클라우드 프로젝트를 셀프 호스팅으로 옮기는 공식 절차가 있다. ([Restore a Platform Project to Self-Hosted](https://supabase.com/docs/guides/self-hosting/restore-from-platform))
  - DB는 Supabase CLI로 역할·스키마·데이터를 내보내고 `psql`로 복원한다.
  - 클라우드와 셀프 호스팅의 Postgres 버전이 다를 수 있다 (예: 클라우드 17, 셀프 호스팅 기본 이미지 15).
  - JWT 비밀값·API 키, OAuth 설정, SMTP, DNS, 파일 저장소는 따로 옮기거나 다시 설정해야 한다.

## 수식 렌더링: KaTeX

### 근거: 비교 시험 (2026-11-09)
- 시험: 중학교 수식 27개를 KaTeX 0.16.47과 MathJax 4.1.3으로 렌더링. 360px·1280px, Chromium 158, 데스크톱 측정.
- 시험 코드·결과: `experiments/math-render-test/` (`results/summary.md`, `results/results.json`, 스크린샷). 로컬에만 있고 git에는 올리지 않는다 (사용자 결정, 2026-11-10). 결정에 필요한 측정값은 아래 요약에 옮겨 두었다.
- 결과 요약
  - 렌더 시간(27개, 중앙값): KaTeX 약 83ms, MathJax(줄바꿈 설정) 1.7~2.6초
  - 서버 렌더(Node): 둘 다 성공. KaTeX 18ms, MathJax 815ms
  - 360px 가로 넘침: 두 라이브러리 모두 기본 설정에서는 넘치고(KaTeX 279px), 줄바꿈 설정을 하면 0px
  - 기하 기호(≡, ∽, ∠, ⊥, ∥, `\overset{\frown}{AB}`)는 둘 다 정상
- 결정: 사용자 결정 (2026-11-09). 에이전트 추천 근거는 렌더 속도 차이(20~30배)였다. 줄바꿈 품질과 한글 글꼴은 시험에서 MathJax가 더 나았다.

### 사용 규칙
- 별도 줄 수식에는 KaTeX 공식 문서(https://katex.org/docs/issues)의 줄바꿈 CSS `.katex-display > .katex { white-space: normal }`를 적용한다. (시험에서 360px 가로 넘침 0px 확인)
  - 이 CSS는 괄호 안에서도 줄을 끊을 수 있다 (시험 S27). 넘침을 막는 안전장치로만 본다.
- 쓰지 않는 표기 (시험에서 KaTeX 미지원 확인): `\overparen`. 호는 `\overset{\frown}{AB}`로 쓴다.
- 시험하지 않은 것 (적용 전 확인 필요)
  - 한글 `\text{}` 글꼴을 본문과 맞추는 KaTeX 공식 CSS(`.hangul_fallback`, https://katex.org/docs/supported.html)
  - 긴 수식을 AI가 `\\`로 직접 줄바꿈하게 하는 방식

## 검사 도구

결정: 사용자 결정 (2026-11-09). 명령은 `AGENTS.md` 5.2.

| 영역 | 도구 | 근거 |
|---|---|---|
| 백엔드 패키지 관리 | uv | FastAPI 테스트 문서가 uv로 의존성 추가를 안내 ([FastAPI Testing](https://fastapi.tiangolo.com/tutorial/testing/)) |
| 백엔드 린트·포맷 | Ruff | Flake8 대체 가능, Black 호환 포맷 99.9% 이상 ([Ruff FAQ](https://docs.astral.sh/ruff/faq/), [Ruff Formatter](https://astral.sh/blog/the-ruff-formatter)). 한계: 직접 만든 린트 규칙 미지원 |
| 백엔드 타입 체크 | mypy (strict, Pydantic 플러그인) | Pydantic이 mypy 플러그인을 공식 제공 ([Pydantic](https://docs.pydantic.dev/latest/integrations/visual_studio_code/)). mypy 기본값은 타입 표시 없는 함수를 검사하지 않아 strict 필요 ([Pyright의 mypy 비교](https://github.com/microsoft/pyright/blob/main/docs/mypy-comparison.md)) |
| 백엔드 테스트 | pytest + TestClient | FastAPI 공식 테스트 방식, `dependency_overrides`로 외부 의존성 교체 ([Testing](https://fastapi.tiangolo.com/tutorial/testing/), [Dependency overrides](https://fastapi.tiangolo.com/advanced/testing-dependencies/)) |
| 프론트 패키지 관리 | pnpm | 사용자 결정 (2026-11-09). pnpm 11부터 공개 1일 미만 버전을 기본으로 설치하지 않음(하위 의존성 포함) ([pnpm 공급망 보안](https://pnpm.io/supply-chain-security)). Next.js 공식 Docker 예제가 pnpm 지원 ([with-docker](https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile)). Yarn 2+(Berry)는 기본 PnP 방식과 Next.js standalone 배포 호환 문제 보고가 있어 제외 ([Next.js #33567](https://github.com/vercel/next.js/discussions/33567)) |
| 프론트 타입 체크 | `next typegen && tsc --noEmit` | Next.js 공식 안내 ([Next.js TypeScript](https://nextjs.org/docs/app/api-reference/config/typescript)) |
| 프론트 린트 | ESLint + eslint-config-next | `next lint`는 Next.js 16에서 삭제 ([Upgrading to 16](https://nextjs.org/docs/app/guides/upgrading/version-16)) |
| 프론트 단위 테스트 | Vitest | 사용자 결정. Vitest·Jest 모두 Next.js 공식 가이드가 있고 우열 근거는 찾지 못함 ([Next.js Testing](https://nextjs.org/docs/pages/guides/testing)) |
| E2E·화면 크기 | Playwright | Next.js 테스트 가이드 포함, 기기·화면 크기 흉내 지원 ([Playwright Emulation](https://playwright.dev/docs/emulation)) |

제외: Pyright(속도 장점은 큰 코드베이스 기준이라 이 프로젝트에 크지 않음), ty(베타, Pydantic 지원이 정식 출시 전 목표로 남아 있음, [ty 발표](https://astral.sh/blog/ty)).

## 교육과정 데이터 구조 (F-03, F-04)

- 내부 기준: 2022 개정 수학과 교육과정 원문(`docs/[별책8] 수학과 교육과정.pdf`) 구조. 영역 → 주제 → 성취기준(`[9수xx-xx]`) → 개념
  - 근거: 원문의 중학교 성취기준은 "[중학교 1∼3학년]"으로 묶여 있고 학년·학기 구분이 없다. 출판사마다 대단원 구성이 다르다. (사용자 결정, 2026-11-09)
- 학생 화면: **표시 단원**. 이름 + 학년 + 기준 출판사 + 별칭 목록 + 연결된 **성취기준 코드**
  - 연결 단위를 주제가 아니라 성취기준으로 하는 이유: 교육과정 주제 하나가 교과서에서 여러 단원으로 나뉜다 (예: 주제 "삼각형과 사각형의 성질" → 교과서 "삼각형의 성질", "사각형의 성질").

### 표시 단원 연결표 (동아출판 기준)

- 기준 출판사: 동아출판 (대표저자 강옥기)
  - 근거: 한국교과서협회 주문 부수 집계 기준 2022 개정 중학 수학 채택률 1위라는 보도 ([서울경제, 2025.4.1.](https://v.daum.net/v/20250401110801113)). 회사 발표 기사이고 원자료와 학년은 확인하지 못했다.
- 단원 이름 근거: 동아출판 사이트의 중학교 수학 1·2·3 목차 (사용자 확인, 2026-11-09)
- 단원별 성취기준 연결 근거: 단원 이름과 성취기준 주제 이름 대응, 성취기준 순서와 단원 순서의 일치 (에이전트 추론, 사용자 승인 2026-11-09). 교과서 중단원 목차로는 검증하지 않았다. 특히 수학 1의 3단원(일차방정식 포함)과 4단원(정비례와 반비례 포함)은 추론 비중이 크다.
- 검증: 중학교 성취기준 60개(9수01 10개, 9수02 22개, 9수03 19개, 9수04 9개)가 모두 정확히 한 번 연결된다.

| 학년 | 번호 | 표시 단원 | 성취기준 | 교육과정 주제 |
|---|---|---|---|---|
| 중1 | 1 | 소인수분해 | 9수01-01~02 | 소인수분해 |
| 중1 | 2 | 정수와 유리수 | 9수01-03~05 | 정수와 유리수 |
| 중1 | 3 | 문자의 사용과 식 | 9수02-01~04 | 문자의 사용과 식, 일차방정식 |
| 중1 | 4 | 좌표평면과 그래프 | 9수02-05~07 | 좌표평면과 그래프, 정비례와 반비례 |
| 중1 | 5 | 기본 도형과 작도 | 9수03-01~04 | 기본 도형, 작도와 합동 |
| 중1 | 6 | 평면도형의 성질 | 9수03-05~06 | 평면도형의 성질 |
| 중1 | 7 | 입체도형의 성질 | 9수03-07~08 | 입체도형의 성질 |
| 중1 | 8 | 자료의 정리와 해석 | 9수04-01~04 | 대푯값, 도수분포표와 상대도수 |
| 중2 | 1 | 유리수와 순환소수 | 9수01-06 | 유리수와 순환소수 |
| 중2 | 2 | 식의 계산 | 9수02-08~10 | 식의 계산 |
| 중2 | 3 | 부등식과 연립방정식 | 9수02-11~13 | 일차부등식, 연립일차방정식 |
| 중2 | 4 | 일차함수와 그래프 | 9수02-14~18 | 일차함수와 그 그래프, 일차함수와 일차방정식의 관계 |
| 중2 | 5 | 삼각형의 성질 | 9수03-09~10 | 삼각형과 사각형의 성질 |
| 중2 | 6 | 사각형의 성질 | 9수03-11 | 삼각형과 사각형의 성질 |
| 중2 | 7 | 도형의 닮음과 피타고라스 정리 | 9수03-12~15 | 도형의 닮음, 피타고라스 정리 |
| 중2 | 8 | 경우의 수와 확률 | 9수04-05~06 | 경우의 수와 확률 |
| 중3 | 1 | 제곱근과 실수 | 9수01-07~10 | 제곱근과 실수 |
| 중3 | 2 | 다항식의 곱셈과 인수분해 | 9수02-19 | 다항식의 곱셈과 인수분해 |
| 중3 | 3 | 이차방정식 | 9수02-20 | 이차방정식 |
| 중3 | 4 | 이차함수와 그래프 | 9수02-21~22 | 이차함수와 그 그래프 |
| 중3 | 5 | 삼각비 | 9수03-16~17 | 삼각비 |
| 중3 | 6 | 원의 성질 | 9수03-18~19 | 원의 성질 |
| 중3 | 7 | 자료의 분포와 관계 | 9수04-07~09 | 산포도, 상자그림과 산점도 |

- 별칭 목록은 아직 비어 있다. 다른 출판사 단원 이름을 확보하면 채운다.

### 개념 데이터 (F-03)

성취기준마다 아래 정보를 둔다.

| 항목 | 내용 |
|---|---|
| 성취기준 | 코드와 원문 문장 |
| 개념 | ID(`<성취기준 코드>-C<번호>`, 예: `9수02-03-C1`), 이름 |
| 평가 항목 | 개념별 (이해 수준, 근거). 근거는 "성취기준 문장의 어느 표현"인지, "에이전트 추가(이유)"인지 구분해 적는다 |
| 대표 오개념 | ID, 관련 개념, 내용, 출처 |
| 용어 | 영역의 "용어와 기호" 목록에서 가져온다 |

- 개념 단위: 개념을 크게 묶지 않는다. 문제 수가 늘어도 지금처럼 잘게 나눈다. (사용자 결정, 2026-11-09. 이유: 크게 묶으면 개념 이해 여부를 가려내는 의미가 줄어든다)
- 용어 (사용자 결정, 2026-11-09)
  - 정식 학습 용어(원문 "용어와 기호로 ~를 다룬다"): 문제·해설에 쓰고, 그 용어의 뜻을 묻는 문제도 낼 수 있다.
  - 수업용 용어(원문 "교수·학습 상황에서 사용할 수 있다", 예: 좌변, 우변, 양변): 문제·해설 문장에 자유롭게 쓴다. 그 용어 자체를 묻는 문제는 내지 않는다.
  - 초등학교와 중학교 교육과정의 "용어와 기호" 목록 어디에도 없는 수학 용어는 쓰지 않는다 (`AGENTS.md` 4.4). 이 목록들을 F-05 문제 검증에 쓴다.
  - 중학교 목록은 1~3학년이 한 묶음이라, 아직 배우지 않은 학년의 용어를 걸러 내려면 표시 단원의 학년 정보가 필요하다. 검증 방식은 F-05 설계 때 정한다.
- 대표 오개념: 에이전트가 출처(교육 연구 자료 등)를 찾아 붙여 초안을 만들고, 사용자가 검토·승인한다. 승인 전 오개념은 출제에 쓰지 않는다. (사용자 결정, 2026-11-09)

## 문제 데이터와 검증 (F-05)

### 문제 하나에 담는 정보
| 묶음 | 항목 |
|---|---|
| 측정 대상 | 성취기준 코드, 개념 ID, 이해 수준, 유형(객관식/서술형), 난이도(일반/고난이도), 단계(1/2) |
| 문제 | 본문(수식은 KaTeX `$...$`), 해설 |
| 객관식 | 보기 5개. 보기마다 정답 여부, 연결된 오개념 ID 또는 "일반 오답" |
| 서술형 | 모범 답안, 채점 요소 목록(요소별 배점·판단 기준), 관련 오개념 ID |
| 검증 결과 | 검사 항목별 통과 여부, 재생성 횟수 |
| 변형 | 평가 항목 × 난이도 안에서 변형 번호 (1~3) |
| 생성 정보 | AI 모델, 프롬프트 버전, 생성 시각 |
| 상태 | 생성됨 / 검증 통과 / 승인 / 사용 중지, 승인자·승인 시각 |

### 객관식 오답 보기 (사용자 결정, 2026-11-09)
- 오답 4개 중 **최소 1개**는 해당 개념의 승인된 오개념(`docs/concepts/`)에 연결한다.
- 나머지는 "일반 오답"(계산 실수 등)으로 표시할 수 있다. 일반 오답을 고르면 오개념을 추정하지 않는다.
- 이유: 개념마다 승인된 오개념이 4개 이상 있지 않다. 오개념 보강은 나중에 수학 전문가 검토로 한다.

### 검증
1. 코드 검사 (결정적)
   - 보기 5개, 정답 정확히 1개
   - 수식이 KaTeX로 오류 없이 렌더링됨
   - 금지 표기 없음 (`\overparen` 등, "수식 렌더링" 절)
   - 교육과정 용어 목록 밖의 수학 용어 없음 ("개념 데이터 (F-03)" 용어 규칙)
   - 오답 보기의 오개념 ID가 승인된 오개념임
2. AI 검사 (문제 생성과 별도 호출)
   - 직접 풀어 정답이 하나뿐인지, 조건이 충분한지 확인
   - 의도한 개념·이해 수준을 실제로 재는지 확인

### 문제 은행 (사용자 결정, 2026-11-09)
- 문제는 진단할 때 만들지 않고 미리 만들어 둔다. 평가 항목 × 난이도마다 변형 3개.
- 규모 추정: 성취기준 60개 × 평가 항목 약 6개 × 난이도 2 × 변형 3 ≈ 2,000문제 (평가 항목 수는 `9수02-03` 한 개에서 나온 값이라 실제와 다를 수 있다)
- 문제 상태: `생성됨` → `검증 통과` → `승인` → (필요하면) `사용 중지`
  - 승인 = AI 검증 통과 + 개발자 확인. 수학 교육 전문가 검토는 실제 학생 공개 전에 한다.
  - 승인된 문제는 고치지 않는다. 수정이 필요하면 새 문제를 만들고 기존 문제를 `사용 중지`한다.
- 진단 중 AI를 쓰는 곳은 서술형 채점(`docs/SCORING.md`)과 리포트 문장 작성("리포트 문장" 절)이다.

### 실패 처리 (사용자 결정, 2026-11-09)
- 검증에 실패한 문제는 그 문제만 다시 만든다. **최대 3번.**
- 3번 모두 실패하면 그 문제 자리를 비워 두고 **백로그**로 남긴다: 평가 항목(개념 ID·이해 수준·난이도), 시도별 실패한 검사와 이유, 시각. 개발자가 나중에 개념 데이터나 프롬프트를 보강하는 데 쓴다.
- 진단할 때 승인된 문제가 하나도 없는 평가 항목은 제외하고 "측정 안 함"으로 처리한다 (`docs/SCORING.md`).

## AI 제공사·모델 (F-05, F-07, F-08)

- **문제 생성·문제 검사·서술형 채점·리포트 문장 모두 OpenAI `gpt-6.1-terra`** (사용자 결정, 2026-11-10). 추론 정도 `reasoning.effort` 기본값 `medium`.
  - 통일한 이유: 문제 생성은 문제 은행을 만들 때 한 번이지만 채점은 학생마다 실행된다. 제공사 하나로 관리한다 (사용자 판단).
- 근거: `gemini-3.8-flash`와 비교 시험 (`docs/plans/2026-11-10_ai-provider-compare.md`, 원본은 `experiments/ai-provider-compare/`, git 제외)
  - 성취기준 9수02-03, 프롬프트 v2, 제공사마다 문제 12개 생성·검사, 서술형 답안 10개 × 3회 채점, 리포트 3세트.
  - 서술형 채점: 두 모델 모두 채점 요소 판정 일치율 100%, 3회 일관성 100%. 오개념 탐지는 Gemini 100%, GPT 90% (한쪽 변만 연산하는 오개념 M2를 놓침).
  - 문제 생성: 통과 문제 16개를 에이전트가 검토했을 때 두 모델 모두 정답 오류·범위 위반 없음. Gemini는 형식 오류(되돌려 달라고 한 ID 값 변경)가 많았다.
  - 1회 비용(표준가)·지연: 생성 GPT $0.0068·14초 / Gemini $0.026·30초, 채점 GPT $0.0018·4초 / Gemini $0.0057·9초.
  - 가격: 입력 $1, 출력 $5 / 100만 토큰, 추론 토큰은 출력으로 청구 ([gpt-6.1-terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra)). 구조화 출력: `client.responses.parse(..., text_format=...)` ([Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)).
  - 한계: 표본이 작다 (성취기준 1개). 기대 판정과 문제 검토는 전문가 검토가 아니다.
- 보완 결과 (프롬프트 v4, `docs/plans/2026-11-10_prompt-v3.md`): 평가 항목 ID·이해 수준·탐지 목록은 코드가 채우고, 채점은 오개념마다 답안 인용과 함께 확인(인용이 답안에 없으면 탐지 제외), 리포트에는 이해도 숫자를 넘기지 않고 내부 ID를 쓰지 않게 했다.
  - v3 재시험 (채점, 답안 15개 × 3회): A05의 M2 3/3, 잘못 탐지 0/21, A03·A08 6/6, 채점 요소 판정 일치 100% (A14 기대값 수정 후), 3회 일관성 100%, 추가 답안 오개념 탐지 14/15.
  - v4 재시험 (생성·리포트): 문제 생성 통과 11/12, 리포트 숫자·내부 ID 0건, 형식 오류 0건.
- 남은 약점: 고난이도(hard) 문제가 "어렵다고 보기엔 쉽다"는 검사 거절이 잦다 (v4 거절 6건 중 5건). 고난이도의 정의를 프롬프트에서 더 구체화해야 한다.
- 코드: `backend/app/ai/` (제공사 연결, 검증기, 작업), 프롬프트 `backend/prompts/<버전>/`. Gemini 연결 코드는 비교용으로 남겨 둔다.

## 리포트 문장 (F-08)

- 리포트 문장(이해하지 못한 부분, 추정 오개념 설명, 다음 학습 방향)은 **진단마다 AI가 작성**한다. (사용자 결정, 2026-11-09)
- AI는 문장만 쓴다. 이해도 숫자, 단계, 추정 오개념 목록은 `docs/SCORING.md` 계산 결과를 그대로 넘겨받아 쓰고, AI가 바꾸지 않는다.
- 작성한 문장은 `reports`에 저장한다. 다시 열 때 AI를 다시 부르지 않는다 (F-09).
- 리포트 문장도 교육과정 용어 규칙("개념 데이터 (F-03)")을 따른다.

## DB 스키마 (초안, 사용자 승인 2026-11-09)

테이블과 주요 항목만 적는다. SQL·RLS 정책은 구현 허락 후 작성한다 (`AGENTS.md` 3.1).

### 교육과정 데이터 (원본: `docs/concepts/*.md`, 승인된 내용을 DB로 옮긴다)
| 테이블 | 주요 항목 |
|---|---|
| `standards` | 코드(`9수02-03`), 영역, 주제, 원문 |
| `concepts` | ID(`9수02-03-C1`), 성취기준, 이름 |
| `assessment_items` | 개념, 이해 수준, 근거 |
| `misconceptions` | 내용, 출처, 연결 개념(여러 개) |
| `display_units` | 학년, 번호, 이름, 기준 출판사, 별칭 목록, 연결 성취기준(여러 개) |

### 문제 은행 (F-05)
| 테이블 | 주요 항목 |
|---|---|
| `questions` | 평가 항목, 난이도, 변형 번호, 유형, 본문, 해설, 상태, 승인자·승인 시각, 생성 정보, 검증 결과 |
| `question_choices` | 번호(1~5), 내용, 정답 여부, 연결 오개념 |
| `rubric_elements` | 설명, 배점, 필수 여부, 관련 오개념 |
| `generation_backlog` | 평가 항목, 난이도, 시도별 실패 검사와 이유, 해결 여부 |

### 사용자 (F-01, F-11 자리)
| 테이블 | 주요 항목 |
|---|---|
| `profiles` | ID(= `auth.users` ID), 가입 상태, 가입 완료 시각 |

- `auth.users`를 참조하는 `profiles` 테이블: [Supabase User Management](https://supabase.com/docs/guides/auth/managing-user-data)
- 가입 상태: 지금은 가입 즉시 "완료". F-11 구현 때 "보호자 동의 대기"를 추가한다.
- 이메일 등은 Supabase Auth에만 두고 중복 저장하지 않는다 (`AGENTS.md` 4.3).

### 진단 기록 (F-06 ~ F-10)
| 테이블 | 주요 항목 |
|---|---|
| `diagnoses` | 사용자, 표시 단원, 상태(1단계 진행 / 2단계 진행 / 완료 / 중단), 중단 사유(기간 만료 / 새로 시작), 시작·완료·중단 시각 |
| `diagnosis_items` | 진단, 단계(1/2), 문제, 평가 항목, 순서 |
| `answers` | 출제된 문제, 고른 번호 또는 서술 내용, 마지막 저장 시각, 단계 제출 시각 |
| `gradings` | 점수, 통과 여부, 고른 보기의 오개념, 서술형 요소별 판단과 근거, 채점 AI 정보 |
| `reports` | 단원 이해도, 개념별 이해도와 단계, 추정 오개념, 리포트 문장, 작성 AI 정보 |

- 승인된 문제는 고치지 않으므로 문제 ID만 저장해도 지난 기록이 당시 문제를 보여 준다 (F-09).
- 학생이 이미 본 문제는 `diagnosis_items`로 찾는다 (F-05 "아직 보지 않은 문제 우선").

### 접근 권한 (RLS)
| 대상 | 학생 (authenticated) | 백엔드 (service role) |
|---|---|---|
| `profiles` | 자기 것 읽기 | 쓰기 |
| 진단·출제 문제·답안·채점·리포트 | 자기 것 읽기만 | 쓰기 |
| 교육과정·문제 은행·백로그 | 접근 불가 | 읽기·쓰기 |

- 문제 은행을 학생이 직접 읽지 못하게 하는 이유: `question_choices`에 정답 여부가 있다. 문제는 백엔드가 정답을 뺀 상태로 내려 준다.
- 쓰기를 모두 백엔드에서 하는 이유: 제출 시점·단계 진행·채점 결과 조작 방지 (`AGENTS.md` 4.3).
- 정책 작성: 작업(select·insert·update·delete)마다 정책을 따로 두고 `to authenticated`, `(select auth.uid()) = user_id` 형태로 쓰며 `user_id`에 인덱스를 둔다. ([Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security))

## 실행 환경 분리 (사용자 결정, 2026-11-10)

- Supabase 프로젝트를 2개로 나눈다 (방식 A).
  - **개발·테스트용**: 지금 프로젝트 `math-concept-checker` (ref `nhbtyedxsjxiybtusnbt`, 서울). 회원가입 시험 등 개발 중 모든 원격 확인은 여기서 한다.
  - **운영용**: 실제 배포 직전(M3 Docker 배포 또는 M4 학생 공개 준비)에 새로 만든다. 지금 만들지 않는 이유: 무료 요금제의 일주일 비활동 일시정지 때문에 관리 대상만 늘어난다 ([무료 프로젝트 일시정지](https://supabase.com/kb/faqs/platform/free-project-pausing)).
- 무료 요금제는 활성 프로젝트 2개까지 쓸 수 있다 ([무료 Postgres 안내](https://supabase.com/kb/faqs/platform/free-postgres-for-side-projects)).
- 마이그레이션은 개발 프로젝트에 먼저 적용해 확인한 뒤 운영에 적용한다. 원격 적용은 매번 사용자 확인 (`AGENTS.md` 3.2).
- 개발·운영은 서로 다른 환경 변수 값을 쓴다 (`AGENTS.md` 4.1). 운영용 카카오 설정(Redirect URI)은 운영 프로젝트를 만들 때 따로 등록한다. 카카오 테스트 앱(앱당 최대 5개, 비즈 앱 필요)도 개발용으로 쓸 수 있다.

## 인증 (F-01)

`docs/plans/2026-11-09_skeleton-login.md`에서 구현하며 정한 것.

### 흐름
- 가입·로그인: 이메일 + 비밀번호, 카카오 (Supabase Auth). 두 방식 모두 `/auth/callback` → `/signup/complete` → 백엔드 `POST /signup/complete`를 거친다.
- **F-11 자리**: 백엔드 `backend/app/profiles.py`의 `check_signup_requirements` (가입 완료 직전 호출, 지금은 그대로 통과). 연령 확인·보호자 동의는 여기에 넣는다.

### 프론트엔드
- `@supabase/ssr`로 서버·브라우저 클라이언트 ([Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client)). 서버 코드는 `getClaims()`로 확인하고 `getSession()`을 믿지 않는다.
- 보호 규칙 두 겹
  - `src/proxy.ts` (Next.js 16): 로그인 여부만. 응답에 `Cache-Control: private, no-store` (갱신된 세션 쿠키가 공유 캐시로 다른 사용자에게 가지 않게, 같은 문서).
  - `src/app/(protected)/layout.tsx`: 자기 `profiles` 행(RLS)으로 가입 완료 여부 확인, 미완료면 `/signup/complete`.

### 백엔드
- 토큰 검증: 프로젝트가 ES256 비대칭 서명을 쓴다 (`/auth/v1/.well-known/jwks.json` 확인). PyJWT `PyJWKClient`로 공개 키를 받아 직접 검증한다. ES256만, `aud=authenticated`, `iss=<SUPABASE_URL>/auth/v1`, `exp`·`sub` 필수 ([JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys)).
- DB 쓰기: supabase-py + Secret key(`sb_secret_`). 클라이언트는 프로세스당 하나.
- CORS: `FRONTEND_ORIGIN`만 허용, 끝 `/` 제거(`Settings.cors_origin`), 쿠키 미사용.

### 카카오 로그인 설정
- Supabase는 카카오에 항상 `account_email profile_image profile_nickname`을 요청한다 (2026-11-10 Supabase 인가 주소에서 확인). 카카오 동의항목에서 이 세 항목을 모두 켜지 않으면 KOE205 에러가 난다.
- `account_email`은 비즈 앱에서만 켤 수 있다. 개인 개발자는 앱 아이콘 등록 + 본인인증 + 카카오비즈니스 약관 동의로 비즈 앱 전환이 가능하다 (사용자 확인).
- 이메일·프로필 사진은 **선택 동의**로 둔다 (`AGENTS.md` 4.3 최소 수집). 동의한 값은 Supabase Auth 사용자 정보에 저장되므로 개인정보 처리방침에 포함해야 한다 (`docs/PROGRESS.md` 공개 전 필수 항목).

### Supabase CLI
- v3.1.0. `supabase link`는 DB 비밀번호 대신 로그인 토큰으로 임시 접속 역할을 만든다.
- 원격 적용: `supabase db push --remote` (미리보기 `--dry-run`). 조회는 `supabase db query --remote --read-only`. 에이전트 실행에서 쓰기는 `--yes`가 필요하며, 사용자 승인 후에만 붙인다.

## 서술형 답안 입력
- 일반 텍스트로 입력받는다. 수식 입력기와 손글씨 사진 업로드는 쓰지 않는다.
  - 근거: 사용자 결정 (2026-11-09)
