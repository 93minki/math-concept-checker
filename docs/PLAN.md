# PLAN: Docker 배포

- 시작일: 2026-11-15
- 대상 기능: 공통 (`AGENTS.md` 4.1 "우리 앱은 Docker로 배포"), F-01 (배포 주소의 로그인·카카오 설정)
- 상태: 진행 중
- 이슈: #47 (https://github.com/93minki/math-concept-checker/issues/47)
- 브랜치: plan/2026-11-15_docker
- PR: (계획을 끝낼 때 링크)
- 마일스톤: M3 리포트·기록 — 근거: GitHub 마일스톤 M3 설명 "F-08 리포트, F-10 기록 조회, Docker 배포"

## 목표
1. 프론트엔드(Next.js)와 백엔드(FastAPI)를 각각 Docker 이미지로 만들고, `compose.yaml` 하나로 두 컨테이너를 띄운다.
2. 이미지 안에 비밀값이 없고, 개발·운영 차이는 환경 변수로만 처리한다(`AGENTS.md` 4.1·4.3).
3. (결정 1에 따라) 띄운 컨테이너를 실제 주소로 열어 개발·시험 계정으로 쓴다.

이번 계획에 넣지 않는 것
- 실제 학생 공개: F-11(연령 확인·보호자 동의)이 먼저다(`AGENTS.md` 4.3). 공개 전 필수 항목(`PROGRESS.md`)은 M4.
- Supabase를 Docker로 띄우기: Supabase는 클라우드를 쓴다(`AGENTS.md` 4.1).
- CI에서 이미지 자동 빌드·배포 (필요하면 다음 계획)

### 이 작업을 하는 이유 (근거)
- 사용자 2026-11-14: "이거 먼저 처리하고 도커 배포로 가자", 2026-11-15 "다음으로 도커 배포 계획으로 넘어가자".
- `AGENTS.md` 4.1: 우리 앱(Next.js, FastAPI)은 Docker로 배포, 비밀값은 이미지에 넣지 않는다.

## 이전 계획에서 이어받은 것
- 위임 환경(Codex)은 포트·Chromium·Docker가 막혀 있어 컨테이너 실행·E2E는 Opus가 돌린다. (출처: plans/2026-11-15_question-reports.md 인계)
- 시험 계정 A·B는 절대 바꾸지 않는다. `test:e2e:dev`는 3100·8100 임시 복사본으로 돈다. 사용자 서버 3000·8000은 끄지 않는다. (출처: plans/2026-11-14_account.md, 2026-11-15_question-reports.md 인계)
- 에이전트가 띄운 컨테이너는 끝나면 지우고 `docker ps`로 확인, 사용자의 `n8n` 컨테이너는 건드리지 않는다. (출처: `AGENTS.md` 3.9, plans/2026-11-15_question-reports.md 백엔드 지시서)
- 결정 대기 "배포 주소: Cloudflare Tunnel로 93minki.dev 하위 주소에 배포할지" (출처: `PROGRESS.md` 결정 대기 항목)
- 운영 Supabase 프로젝트는 "M3 Docker 배포 또는 M4 학생 공개 준비" 때 만든다. (출처: `DESIGN.md` "실행 환경 분리")

## 결정 (사용자 2026-11-15)
1. **배포 범위: (나)** 이 PC에서 확인 + Cloudflare Tunnel로 `93minki.dev` 하위 주소에 연다. 도메인은 새로 사지 않는다.
   - 서버는 포트폴리오를 띄운 다른 맥북(이하 서버 맥북, Docker 설치됨). 그 맥북에서 compose 프로젝트 `mk-portfolio`가 `app`(포트폴리오)과 `cloudflared`(터널 `mk-portfolio`, 대시보드 관리 방식) 컨테이너로 돌고, 길 `93minki.dev → http://app:3000`은 compose 네트워크 안의 서비스 이름으로 닿는다(사용자 확인 2026-11-15: 대시보드 Service URL, `docker ps`).
   - 그래서 우리 컨테이너를 그 compose 네트워크(외부 네트워크, 이름은 서버 맥북 `docker network ls`로 확인)에 붙이고, 길 두 개를 추가한다: 프론트 하위 주소 → `http://<프론트 서비스 이름>:3000`, 백엔드 하위 주소 → `http://<백엔드 서비스 이름>:8000`. 서비스 이름은 포트폴리오의 `app`과 겹치지 않게 짓는다. 컨테이너끼리는 각자 포트를 쓰므로 포트폴리오의 3000과 충돌하지 않는다. 호스트에 포트를 열 필요는 없다.
   - 브라우저가 백엔드를 직접 부르므로 하위 주소 2개: 프론트 `math-concept.93minki.dev`, 백엔드 `math-concept-api.93minki.dev`(사용자 결정 2026-11-15). 백엔드는 쿠키 없이 토큰만 쓰므로(`DESIGN.md` "인증 (F-01)" 백엔드) 주소가 달라도 CORS(`FRONTEND_ORIGIN`)만 맞추면 된다.
   - 서버 맥북 작업(저장소 받기, 환경 변수 파일 만들기, `docker compose up`, 대시보드에 길 추가)은 사용자가 한다. 에이전트는 명령과 설정을 단계별로 정리해 드린다.
   - 가입은 막지 않는다(사용자 결정).
2. **Supabase: 지금 개발 프로젝트를 그대로 쓴다.** 운영 프로젝트는 M4(학생 공개 준비) 때 만든다.
3. **`NEXT_PUBLIC_` 값: 환경마다 빌드 인자로 넣어 이미지를 따로 만든다.** Next.js는 이 값을 빌드 때 자바스크립트에 박아 넣고(`frontend/node_modules/next/dist/docs/01-app/02-guides/environment-variables.md` 158~166줄), 들어가는 값은 브라우저에 공개되는 값이다(`AGENTS.md` 4.3).
- 이메일 인증·SMTP: 이번 계획에서 다루지 않고 M4로 미룬다(사용자 결정). Supabase 기본 메일은 시간당 2통·팀원 주소만이라 외부 가입자는 인증 메일을 받지 못한다 — 배포 주소에서는 카카오 로그인과 이미 있는 계정으로 확인한다.

## 단계
1. **설계** — `DESIGN.md`에 "Docker 배포" 절: 이미지 구성(백엔드 Python 3.13 + uv 잠금 파일 그대로 설치, 프론트 Node 24 + pnpm + Next.js `output: "standalone"`), 컨테이너 사용자(root 아님), 상태 확인(`/health`, `/login`), 환경 변수 목록(어느 값이 빌드 인자·어느 값이 실행 환경 변수인지), 포트, 결정 1~3. 근거는 공식 문서(Next.js self-hosting·standalone, uv Docker 가이드, Docker 문서)에서 찾는다. 완료 조건: 사용자 확인.
2. **백엔드 이미지** — `backend/Dockerfile`, `backend/.dockerignore`(`.env*`·테스트·캐시 제외). 완료 조건: 빌드, 컨테이너에서 `/health` 200, 이미지 안에 `.env`·비밀값 형태 문자열 없음.
3. **프론트 이미지** — `frontend/Dockerfile`, `frontend/.dockerignore`, `next.config.ts`에 `output: "standalone"`. 완료 조건: 빌드, `/login` 200, 이미지 안에 `sb_secret_` 등 비밀값 형태 없음(기존 `e2e/build-secrets.spec.ts`와 같은 검사를 이미지에도), 5.2 검사 통과(설정 변경이 개발 실행을 깨지 않음).
4. **`compose.yaml`** — 두 서비스, 실행 환경 변수는 저장소 밖 파일에서(`env_file`, 파일은 사용자가 만든다 — 에이전트는 `.env*`를 읽지 않음), 상태 확인·재시작 규칙. `.env.sample`에 배포용 키 설명 추가. 완료 조건: `docker compose up`으로 둘 다 healthy, 사용자 서버(3000·8000)와 포트가 겹치지 않음, 컨테이너 대상으로 `test:e2e:dev` 통과.
5. **서버 맥북에 배포·주소 열기** — 서버 맥북 실행 안내서(저장소 받기, 저장소 밖 환경 변수 파일, 외부 네트워크 이름 확인, `docker compose up -d --build`, 대시보드에서 길 2개 추가), Supabase Site URL·Redirect URLs에 배포 주소 추가, 카카오 Redirect URI·사이트 도메인, `FRONTEND_ORIGIN`. 원격 설정 변경은 모두 사용자가 하거나 사용자 확인 후(`AGENTS.md` 3.2). 완료 조건: 배포 주소에서 이메일·카카오 로그인 → 진단 → 리포트, 데스크톱·폰.
6. **검수·종료** — 5.2 전체, 실행 방법을 `README`/`DESIGN.md`에, 계획 종료, PR.

## 완료 조건
- `AGENTS.md` 3.7: 5.2 검사 모두 통과, `pnpm test:e2e:dev` 통과(컨테이너 대상 포함).
- 이미지 안에 비밀값이 없음을 검사로 확인(`AGENTS.md` 4.1·4.3).
- 에이전트가 띄운 컨테이너·프로세스 정리, `docker ps` 확인(`AGENTS.md` 3.9).
- 배포 주소에서 로그인·진단·리포트 동작을 사용자가 확인.

## 진행 메모
- 2026-11-15: 초안 작성, 사용자 승인("이슈 생성하고 브랜치 만들고 설계시작해라"). 서버 맥북에 환경 변수 파일(`frontend/.env.local`, `backend/.env`) 사용자가 추가.

## 인계 (계획을 끝낼 때 작성)
- 결과:
- 끝내지 못한 일:
- 다음 계획이 알아야 할 것:
- `DESIGN.md`로 옮긴 결정:
