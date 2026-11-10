# PLAN: 프로젝트 뼈대와 로그인

- 시작일: 2026-11-09
- 대상 기능: F-01 (F-11은 자리만)
- 상태: 진행 중 (사용자 검토 → 구현 허락 대기, `AGENTS.md` 3.1)

## 목표
- `frontend/`(Next.js)와 `backend/`(FastAPI) 프로젝트를 만들고, `AGENTS.md` 5.2의 검사 9개(백엔드 4, 프론트 5)가 모두 실행·통과하는 상태를 만든다.
- F-01: 이메일 + 비밀번호와 카카오로 가입·로그인·로그아웃이 되고, 로그인하지 않은 사용자는 보호된 화면과 보호된 서버 API를 쓸 수 없다.
- 두 가입 방식이 같은 "가입 완료 단계"를 거치게 해, 나중에 F-11(연령 확인·보호자 동의)을 한 곳에 끼워 넣을 수 있게 한다.

## 이전 계획에서 이어받은 것
- 없음 (첫 계획)

## 범위 밖
- F-02 ~ F-10, F-11 구현 (F-11은 자리만)
- Docker 이미지·배포 설정 (다음 계획)
- `profiles` 외의 테이블 (`docs/DESIGN.md` "DB 스키마")
- 커스텀 SMTP (`docs/PROGRESS.md` "실제 학생 공개 전 필수 항목")
- Supabase CLI 로컬 환경. 원격 개발 프로젝트만 쓴다 (사용자 결정, 2026-11-10). 마이그레이션이 늘어나면 다시 검토한다.

## 지켜야 할 규칙 (이번 계획에서 특히)
- `.env.sample`을 뺀 `.env*` 파일은 읽지도 고치지도 않는다. 값이 필요하면 사용자에게 요청한다 (`AGENTS.md` 4.3).
- 테스트에서 원격 Supabase와 카카오를 호출하지 않는다 (`AGENTS.md` 5.4).
- 원격 Supabase에 마이그레이션을 적용하기 전에 사용자 확인을 받는다 (`AGENTS.md` 3.2).
- 커밋은 사용자가 요청할 때만 한다.

## 설계 (이번 계획에서 정하는 것)

### 화면 (`frontend/`)
| 경로 | 내용 | 로그인 필요 |
|---|---|---|
| `/login` | 이메일 + 비밀번호 로그인, 카카오 로그인 버튼, 가입 화면 링크 | 아니요 |
| `/signup` | 이메일 + 비밀번호 가입 (확인 메일 안내) | 아니요 |
| `/auth/callback` | 이메일 확인 링크·카카오 로그인 후 돌아오는 주소. 세션을 만든 뒤 가입 완료 단계로 보낸다 | — |
| `/signup/complete` | **가입 완료 단계 (F-11 자리)**. 지금은 백엔드 가입 완료 API를 부르고 바로 다음으로 넘어간다 | 예 |
| `/` | 보호된 첫 화면 (로그인 상태 표시, 로그아웃 버튼) | 예 + 가입 완료 |

- Supabase 연결: `@supabase/ssr`로 서버용·브라우저용 클라이언트를 만든다. ([Supabase SSR 클라이언트](https://supabase.com/docs/guides/auth/server-side/creating-a-client))
- 로그인 확인: Next.js 16의 `proxy.ts`에서 `getClaims()`로 확인하고 세션을 갱신한다. 서버 코드에서 `getSession()`을 믿지 않는다. ([Supabase SSR 클라이언트](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Next.js proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy))
- 로그인하지 않았으면 `/login`으로, 로그인했지만 가입 완료 전이면 `/signup/complete`로 보낸다.
- `@supabase/auth-helpers-nextjs`는 쓰지 않는다 (지원 중단). ([Supabase 이전 안내](https://supabase.com/docs/guides/troubleshooting/how-to-migrate-from-supabase-auth-helpers-to-ssr-package-5NRunM))

### 서버 API (`backend/`)
| API | 내용 | 로그인 필요 |
|---|---|---|
| `GET /health` | 상태 확인 | 아니요 |
| `GET /me` | 로그인한 사용자 ID와 가입 상태 반환 (보호된 예시 API) | 예 |
| `POST /signup/complete` | **가입 완료 단계 (F-11 자리)**. `profiles`에 가입 상태 "완료"를 기록. 이미 완료면 그대로 성공 | 예 |

- 로그인 확인: 요청 헤더의 Supabase 토큰을 Supabase 서명 키(JWKS)로 검증하는 FastAPI 의존성을 만든다. ([Supabase JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys))
- 테스트에서는 이 의존성과 Supabase 클라이언트를 `dependency_overrides`로 바꾼다. ([FastAPI 의존성 교체](https://fastapi.tiangolo.com/advanced/testing-dependencies/))
- CORS: `FRONTEND_ORIGIN`(`.env.sample`)에서 오는 요청만 허용한다.

### DB
- `profiles`: ID(= `auth.users` ID), 가입 상태(`pending` / `completed`), 가입 완료 시각 (`docs/DESIGN.md` "DB 스키마")
- RLS: 학생은 자기 행 읽기만. 쓰기는 백엔드(secret key)만.
- 마이그레이션 SQL 파일은 `supabase/migrations/`에 둔다. 원격 적용 방법(대시보드 SQL 편집기 또는 Supabase CLI `db push`)은 5단계에서 사용자와 정한다.

## 단계
| # | 단계 | 담당 | 완료 조건 |
|---|---|---|---|
| 1 | 저장소 준비: `.gitignore` (`.env*` 단 `.env.sample` 제외, `.herdr-web-ui/`, `.DS_Store`, `node_modules/`, `.venv/`, 빌드 결과물, `experiments/*/node_modules/`) | Cursor | `git status`에 `.herdr-web-ui/`, `.DS_Store`가 안 보임. `git check-ignore`로 `.env`, `frontend/.env.local`, `backend/.env` 경로가 무시됨을 확인 (파일을 열지 않고) |
| 2 | 백엔드 뼈대: uv 프로젝트, FastAPI, `GET /health`, Ruff·mypy(strict, Pydantic 플러그인)·pytest 설정 | Codex | 백엔드 5.2 검사 4개 통과, `/health` 테스트 통과 |
| 3 | 프론트엔드 뼈대: pnpm, Next.js(TypeScript), ESLint, scripts(`lint`, `typecheck`, `test`, `build`, `test:e2e`), Vitest, Playwright(1280px·360px) | Codex | 프론트 5.2 검사 5개 통과, 첫 화면이 360px에서 가로 넘침 0 |
| 4 | 환경 변수 읽기: 프론트(URL·publishable key·API 주소), 백엔드(URL·secret key·`FRONTEND_ORIGIN`). 값이 없으면 어떤 키가 없는지 알려 주고 시작을 거부 | Codex | 키 없음 테스트 통과. 프론트 빌드 결과물에 `SUPABASE_SECRET_KEY`가 없음. **실제 `.env` 파일은 사용자가 `.env.sample`을 보고 만든다** |
| 5 | `profiles` 마이그레이션 SQL과 RLS 정책 작성 | Codex | SQL 파일 작성 → **원격 적용 전 사용자 확인** → 적용 후 다른 사용자의 `profiles`를 읽을 수 없음 확인 (`AGENTS.md` 3.7-5) |
| 6 | 백엔드 인증 의존성, `GET /me`, `POST /signup/complete`, CORS | Codex | 토큰 없음·잘못된 토큰 → 401, 정상 토큰 → 200 테스트. 가입 완료 API를 두 번 불러도 성공 |
| 7 | 이메일 + 비밀번호 가입·로그인·로그아웃 화면 | Codex | 화면 테스트(Vitest), 360px 가로 넘침 0 |
| 8 | 카카오 로그인 버튼과 `/auth/callback` | Codex | 버튼이 Supabase 카카오 로그인을 호출함을 테스트 (실제 카카오 호출 없이) |
| 9 | 가입 완료 단계 `/signup/complete` + proxy 보호 규칙 | Codex | 로그아웃 상태에서 `/` → `/login`, 가입 미완료 → `/signup/complete` (Playwright, 1280px·360px) |
| 10 | 사용자 수동 확인: 실제 Supabase·카카오로 두 가입 방식 전체 흐름 | 사용자 | 이메일(팀원 주소) 가입 → 확인 메일 → 로그인 → `/` → 로그아웃. 카카오 가입 → `/` → 로그아웃. 두 방식 모두 `profiles` 가입 상태 "완료" |

- 담당: 사용자 위임 규칙에 따라 여러 파일 구현은 Codex, 1~2개 파일 단순 작업은 Cursor. 결과는 Claude가 `git diff`와 5.2 검사로 검수한다.
- 각 단계가 끝날 때마다 5.2 검사를 실행한다 (5.3 루프).
- 실제 Supabase·카카오를 거치는 흐름은 자동 테스트로 확인할 수 없다 (테스트에서 원격 호출 금지). 그래서 10단계를 사용자 수동 확인으로 둔다.

## 완료 조건
- `AGENTS.md` 3.7 완료 기준 전부: 5.2 검사 9개 통과, 테스트 작성, 데스크톱·모바일 확인, RLS 확인
- `docs/features.md` F-01 완료 조건 전부
  - 이메일 + 비밀번호, 카카오 두 방식으로 가입·로그인·로그아웃 (10단계 수동 확인)
  - 두 가입 방식이 같은 가입 완료 단계(`/signup/complete` → `POST /signup/complete`)를 거침
  - 로그아웃 상태에서 보호된 화면 → 로그인 화면
  - 로그아웃 상태에서 보호된 서버 API 호출 거부 (AI API는 아직 없으므로 `GET /me`로 확인)

## 진행 메모
- 2026-11-09: 계획 작성. 구현은 사용자의 "코드를 작성해" 지시 후 시작한다.
- 2026-11-09: git 저장소 생성 (로컬 `main`, 원격 public https://github.com/93minki/math-concept-checker). 아직 커밋 없음.
- 2026-11-10: `.env.sample` 작성 (키 이름과 가짜 예시 값, `FRONTEND_ORIGIN` 포함). Supabase 새 키(Publishable/Secret) 사용, legacy 키 사용 안 함.
- 2026-11-10: 사용자 준비 완료 (사용자 보고). Supabase 개발 프로젝트, 카카오 앱(동의항목: 닉네임만), Supabase 카카오 공급자·"Allow users without an email"·URL Configuration(`http://localhost:3000`).
- 2026-11-10: 로컬 개발은 원격 개발 프로젝트만 사용 (Supabase CLI 로컬 환경 사용 안 함, 사용자 결정).
- 2026-11-10: 에이전트의 `.env*` 파일 읽기·수정 금지 규칙 추가 (`AGENTS.md` 4.3, 사용자 지시).

- 2026-11-10: 1단계 완료 (Claude 직접, `.gitignore`). `git check-ignore`로 `.env`, `frontend/.env.local`, `backend/.env` 무시 확인 (파일은 열지 않음).
- 2026-11-10: 2단계 완료 (Codex) + Claude 검수: 백엔드 검사 4개 재실행 통과. 검수에서 고친 것: Starlette 사용 중단 경고에 따라 테스트용 `httpx` → `httpx2`, 누락된 TEST_LOG 기록 추가.
- 2026-11-10: 3단계 완료 (Cursor) + Claude 검수: 프론트 검사 5개 재실행 통과. 검수에서 고친 것:
  - `packageManager`가 `pnpm@9.12.0`으로 고정되어 있었음 → 사용자가 설치한 `pnpm@12.18.0`으로 변경. pnpm 12의 공급망 정책(공개 1일 미만 버전 거부)이 pnpm 9로 만든 lockfile을 거부해, lockfile을 pnpm 12로 다시 만듦 (`DESIGN.md` "검사 도구"에서 pnpm을 고른 이유가 이 정책).
  - Vitest 설정이 CommonJS로 읽힌다는 경고 → `vitest.config.ts`를 `vitest.config.mts`로 변경.
  - Next.js가 만든 `frontend/AGENTS.md`를 `AGENTS.md` 문서 지도에 추가.
- 2026-11-10: 검수 추가 발견: lockfile을 pnpm 12로 다시 만들 때 pnpm이 `pnpm-workspace.yaml`에 공급망 정책 예외(`minimumReleaseAgeExclude`)를 자동으로 추가함. 대상: `next@16.4.6`(공개 약 5시간), `eslint-config-next@16.4.6`, `@vitejs/plugin-react@6.3.0`(공개 약 19시간). 예외를 지우고 공개 1일이 지난 `next@16.4.5`, `eslint-config-next@16.4.5`, `@vitejs/plugin-react@6.2.1`로 고정해 다시 설치. 프론트 검사 5개 재통과.
- 2026-11-10: 발견: 3단계 진행 중(10:36) nvm Node 24 `bin/`에 Corepack의 `pnpm`·`pnpx` 바로가기가 생겨 사용자의 pnpm 12(`~/Library/pnpm`)를 가림. 프로젝트 밖 변경이라 되돌리기 전에 사용자 확인 필요.

## 인계 (계획을 끝낼 때 작성)
- 결과:
- 끝내지 못한 일:
- 다음 계획이 알아야 할 것:
- `DESIGN.md`로 옮긴 결정:
