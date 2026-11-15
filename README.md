# 수학 개념 체커 (Math Concept Checker)

점수가 아니라 **수학 개념을 이해했는지**를 진단하는 웹 서비스입니다. 중학교 수학 단원을 골라 문제를 풀면, AI가 답안을 채점하고 개념별 이해도와 오개념, 앞으로 공부할 방향을 리포트로 보여 줍니다.

- 서비스 주소: https://math-concept.93minki.dev
- 범위: 2022 개정 교육과정 중학교 수학
  - 표시 단원 23개(중1 8, 중2 8, 중3 7)
  - 성취기준 60개
  - 승인된 문제 1,196개

## 진단 흐름

1. **단원 선택:** 학습 지도에서 단원을 고릅니다.
2. **1단계(기본):** 개념의 평가 항목마다 일반 문제 하나씩 풉니다.
3. **2단계(심화):** 1단계에서 맞힌 항목만 고난이도 문제로 한 번 더 확인합니다. 원하면 "여기까지 하고 리포트 보기"로 끝낼 수 있습니다.
4. **채점:** 객관식은 코드가, 서술형은 AI가 채점하고 개념별 이해도를 계산합니다.
5. **리포트:** 개념별 이해 단계, 추정 오개념, 학습 방향을 보여 줍니다.

풀던 답은 자동으로 저장되어 이어 풀 수 있고, 지난 진단과 리포트는 계정에 남아 다시 볼 수 있습니다.

## 주요 기능

| ID | 기능 |
|---|---|
| F-01 | 이메일·카카오 회원가입, 로그인, 로그아웃 |
| F-02 | 내 정보, 비밀번호 변경, 회원 탈퇴 |
| F-03 | 교육과정 성취기준별 개념 데이터(개념, 평가 항목, 대표 오개념) |
| F-04 | 학습 지도에서 단원 선택 |
| F-05 | AI로 미리 만들고 검사·승인한 문제 은행에서 출제(그림 문제 포함) |
| F-06 | 문제 풀이(KaTeX 수식, 자동 저장, 이어 풀기) |
| F-07 | 채점과 개념별 이해도 계산 |
| F-08 | 이해도 리포트 |
| F-09, F-10 | 진단 기록 저장과 지난 기록 조회 |
| F-12, F-13 | 문항 오류 신고와 관리자 처리(AI 수정안·직접 수정) |
| F-14 | 계정당 하루 개념 체크 횟수 제한 |

기능별 상세와 완료 조건은 [`docs/features.md`](docs/features.md)에 있습니다.

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 프론트엔드 | Next.js (TypeScript, pnpm), 디자인 시스템 Astryx, 수식 KaTeX |
| 백엔드 | FastAPI (Python, uv) |
| 인증·DB | Supabase 클라우드 (Auth, PostgreSQL, RLS) |
| AI | OpenAI `gpt-6.1-terra` (문제 생성·검사, 서술형 채점, 리포트 문장) |
| 배포 | Docker Compose, Cloudflare Tunnel |
| 검사 | Ruff, mypy, pytest / ESLint, Prettier, TypeScript, Vitest, Playwright |

선택한 이유와 근거는 [`docs/DESIGN.md`](docs/DESIGN.md)에 있습니다.

## 설계에서 신경 쓴 점

- **채점 결과는 서버만 씁니다.** 사용자 데이터 테이블은 모두 RLS를 켰고, 채점·리포트는 서버가 Secret key로 DB 함수 하나(한 트랜잭션)를 불러 기록합니다.
- **AI는 정해진 형식으로만 받습니다.** 문제 은행은 AI가 만들고, 코드 검사와 AI 검사를 거친 뒤 승인한 문제만 출제합니다. 학생이 진단할 때 AI는 서술형 채점과 리포트 문장에만 씁니다.
- **이해도는 계산식으로 정합니다.** 문제 점수에서 개념·단원 이해도와 학생에게 보이는 단계를 계산합니다([`docs/SCORING.md`](docs/SCORING.md)).
- **수식과 그림을 웹에서 그립니다.** 수식은 KaTeX로, 좌표평면·수직선·도형·입체도형 같은 그림은 데이터로 받아 SVG로 그립니다.
- **모바일에서도 씁니다.** 360px 너비에서 가로 넘침이 없는지 Playwright로 검사합니다.

## 폴더 구조

```
frontend/   Next.js 앱 (화면, Supabase 로그인, 그림·수식 그리기)
backend/    FastAPI 앱 (진단·채점·리포트 API, 문제 은행 명령, AI 연결)
  data/     문제 은행 내보내기, 교육과정 용어표
  prompts/  AI 프롬프트
supabase/   DB 마이그레이션
docs/       기능 목록, 설계, 채점 기준, 개념 데이터, 작업 기록
scripts/    배포 이미지 비밀값 검사
compose*.yaml  Docker 배포 설정
```

## 로컬에서 실행하기

필요한 것: Node.js와 pnpm, Python과 uv, Supabase 프로젝트(마이그레이션 적용).

1. 환경 변수 파일을 만듭니다. 키 이름과 설명은 [`.env.sample`](.env.sample)에 있습니다.
   - `frontend/.env.local`: `[프론트엔드]` 부분
   - `backend/.env`: `[백엔드]` 부분
   - 실제 AI를 부르지 않으려면 `backend/.env`에 `AI_MODE=fake`를 넣습니다.
2. DB 마이그레이션을 적용합니다.
   ```
   supabase db push
   ```
3. 백엔드를 실행합니다(포트 8000).
   ```
   cd backend && uv sync && make dev
   ```
4. 프론트엔드를 실행합니다(포트 3000).
   ```
   cd frontend && pnpm install && pnpm dev
   ```

Docker로 실행하는 방법은 [`docs/DESIGN.md`](docs/DESIGN.md)의 Docker 배포 절에 있습니다.

## 검사

```
cd backend  && uv run ruff format --check . && uv run ruff check . && uv run mypy . && uv run pytest
cd frontend && pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e
```

`pnpm test:e2e`는 데스크톱(1280px)과 모바일(360px) 두 너비로 실행합니다.

## 문서

| 문서 | 내용 |
|---|---|
| [`AGENTS.md`](AGENTS.md) | 이 저장소에서 일하는 AI 에이전트가 따르는 작업 규칙과 문서 지도 |
| [`docs/features.md`](docs/features.md) | 기능 목록과 완료 조건 |
| [`docs/DESIGN.md`](docs/DESIGN.md) | 확정된 설계와 근거 |
| [`docs/SCORING.md`](docs/SCORING.md) | 채점 기준과 이해도 계산식 |
| [`docs/concepts/`](docs/concepts/) | 성취기준별 개념 데이터 |
| [`docs/plans/`](docs/plans/) | 끝난 작업 계획 기록 |
| [`docs/PROGRESS.md`](docs/PROGRESS.md) | 진행 상황 |
