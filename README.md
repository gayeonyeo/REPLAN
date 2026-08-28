# RE:PLAN

> 학습 계획을 만들고 디벨롭해주는 나만의 캘린더

RE:PLAN은 대학생의 고정 일정, 시험 범위·시간·우선 챕터, 목표 회독 수와 실제 공부 수행 기록을 함께 사용해 시험 계획을 만들고 계속 재조정하는 웹 서비스다. 한 번 만든 계획을 보여주는 데서 끝나지 않고 `계획 생성 → 수행 기록 → 차이 감지 → 전체 재계획`의 피드백 루프를 반복한다.

## 해결하려는 문제

시험 계획은 대개 사용자가 기대한 공부 속도를 기준으로 만들어지지만, 실제 속도가 느려져도 이후 계획은 그대로 남는다. 이 차이가 누적되면 시험 직전에 미완료 범위가 몰리고 목표 회독을 달성하지 못한다.

Nexus는 다음 원칙으로 이 문제를 해결한다.

- 수업·아르바이트·약속을 제외한 실제 가용 시간에 공부량을 배정한다.
- 완료·일부 완료·미완료와 실제 완료 범위를 기록한다.
- 미완료분을 단순히 다음 날에 더하지 않고 남은 기간 전체를 다시 계산한다.
- 사용자의 기대치보다 과거의 실제 수행량을 우선해 계획 강도를 정한다.
- 목표 회독이 불가능하면 무리한 계획 대신 달성 가능한 대안을 제시한다.

## MVP 범위

1. 고정 일정과 시험(과목, 날짜, 범위, 목표 회독) 등록
2. 일정별 가용 시간 계산 및 최초 공부 계획 생성
3. 공부 계획의 완료·일부 완료·미완료 기록
4. 실제 완료 범위를 기준으로 미래 계획 전체 자동 재배분
5. 현재 회독률과 시험일까지의 예상 회독률 표시
6. 누적 수행 데이터를 다음 계획의 현실적 학습량 산정에 반영

자연어 일정 입력, 알림, 감정·컨디션 체크인, 상세 분석은 MVP 이후로 미룬다.

## 지금 작동하는 기능

- 수업·아르바이트·약속 등 고정 일정 등록
- 시험일, 숫자 범위, 단위, 목표 회독 등록
- 고정 일정이 긴 날의 공부량을 줄이는 날짜별 자동 배분
- 대시보드의 현재 회독, 예상 회독, 남은 계획 표시
- 완료·일부 완료·미완료 체크인
- 일부 완료 지점을 반영한 미래 계획 전체 재생성 및 버전 표시
- 한 번에 핵심 시나리오를 체험하는 `30초 데모 시작`
- 월간 캘린더를 기본으로 표시하고 날짜 선택 시 일간 타임테이블 전환
- OpenAI Responses API가 고정 일정을 피해 학습 날짜·시간·범위를 생성
- 월간·주간·일간 캘린더와 월간 옆 시험 진행률 표시
- 일간 일정 블록 이동 및 아래 손잡이로 길이 조절
- 다른 시험 공부와 고정 일정 간 타임블록 충돌 방지
- 예정량 초과 학습 반영과 재분배 이유·예상 회독·목표 조정 조언
- 시험 삭제, 같은 날 여러 시험의 시간별 등록, 우선 챕터 입력
- 월간 3 : 일간 2 비율의 한 화면 통합 캘린더(날짜 선택 시 오른쪽 타임테이블 갱신)
- OpenAI 계획 생성에 `reasoning.effort: none`을 적용하고 생성·재생성 중에만 전용 진행 상태 표시

## 핵심 시연 흐름

1. 이미 수업과 아르바이트가 있는 캘린더에 시험과 범위를 등록한다.
2. 시스템이 빈 시간을 기준으로 공부 계획을 캘린더에 생성한다.
3. 사용자가 오늘 계획을 `일부 완료`로 기록하고 실제 완료 지점을 입력한다.
4. 시스템이 남은 범위, 남은 시간, 실제 수행 속도를 다시 계산한다.
5. 미래 날짜의 계획이 변경되고 현재·예상 회독률이 갱신된다.

성공 기준은 계획 생성 화면의 화려함이 아니라 3→5의 변화가 실제 데이터로 재현되는 것이다.

## 문서

- [DESIGN.md](./DESIGN.md): 제품, 데이터, 화면, API 및 재계획 알고리즘 설계
- [PROGRESS.md](./PROGRESS.md): 현재 상태, 기능 분류, MVP 구현 순서와 완료 조건

## 기술 스택

- 프런트엔드: React + TypeScript + Vite
- 백엔드: Python + FastAPI
- 데이터베이스: SQLite
- ORM / 마이그레이션: SQLAlchemy + Alembic
- 테스트: Vitest, pytest
- 패키지 관리: npm, pip
- 기본 시간대: `Asia/Seoul`

## 프로젝트 구조

```text
.
├─ frontend/           React + Vite 애플리케이션
│  └─ src/             화면 및 Vitest 테스트
├─ backend/            FastAPI 애플리케이션
│  ├─ app/             API, 설정, DB 연결
│  ├─ alembic/         마이그레이션 환경
│  └─ tests/           pytest 테스트
├─ .env.example        비밀값 없는 환경 변수 예시
├─ DESIGN.md
└─ PROGRESS.md
```

`ai-여행-플래너/`는 별도 프로젝트이며 Nexus에서 사용하거나 수정하지 않는다.

## 로컬 실행

### 가장 빠른 실행 순서

터미널 두 개를 연다. 첫 번째 터미널에서 백엔드를 먼저 실행한다.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
python -m uvicorn app.main:app --reload
```

두 번째 터미널에서 프런트엔드를 실행한다.

```powershell
cd frontend
npm install
npm run dev
```

브라우저에서 `http://localhost:5173`을 열고 `30초 데모 시작`을 누른다. 첫 OpenAI 호출에는 잠시 시간이 걸릴 수 있다. 표시된 첫 공부 계획에서 `일부`를 선택해 실제 완료 지점을 입력하면 OpenAI가 미래 계획을 다시 생성한다.

### 사전 요구사항

- Node.js 20 이상과 npm
- Python 3.12 이상과 pip

### 환경 변수

시험 계획 생성과 재계획에는 OpenAI API 키가 필요하다. `backend` 폴더에 `.env` 파일을 만들고 다음 값을 입력한다.

```env
OPENAI_API_KEY=sk-발급받은키
OPENAI_MODEL=gpt-5-mini
TIMEZONE=Asia/Seoul
```

실제 `.env`는 Git에 포함되지 않는다. 키를 프런트엔드 코드나 `VITE_` 환경 변수에 넣으면 브라우저에 노출되므로 반드시 백엔드에서만 관리한다.

### 프런트엔드

```bash
cd frontend
npm install
npm run dev
```

브라우저에서 `http://localhost:5173`을 연다.

프런트엔드 테스트와 프로덕션 빌드:

```bash
cd frontend
npm test
npm run build
```

### 백엔드

Windows PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
python -m uvicorn app.main:app --reload
```

macOS / Linux:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
python -m uvicorn app.main:app --reload
```

API는 `http://localhost:8000`, 문서는 `http://localhost:8000/docs`, health check는 `http://localhost:8000/health`에서 확인한다.

백엔드 테스트:

```bash
cd backend
python -m pytest
```

### Alembic

모든 Alembic 명령은 `backend` 디렉터리에서 실행한다.

```bash
cd backend
python -m alembic current
python -m alembic revision --autogenerate -m "describe change"
python -m alembic upgrade head
```

첫 migration인 `0001_create_study_planner_tables.py`가 포함되어 있다. 개발 서버는 빈 SQLite DB에서 필요한 테이블을 자동 생성한다.

> 일부 Windows Python 배포판에서 한글이 포함된 경로의 가상환경 생성이 실패할 수 있다. 이 경우 저장소를 영문 경로에 clone하거나, 영문 경로에 가상환경을 만든 뒤 활성화하고 `backend/requirements-dev.txt`를 설치한다.

## 저장소 상태

- 현재 단계: 핵심 MVP 동작
- 기준 브랜치: `main`
- 원격 저장소: `https://github.com/gayeonyeo/nexus.git`
- 고정 일정·시험 등록·계획 생성·체크인·자동 재계획 연결 완료
- 기존 `ai-여행-플래너/`: 별도 프로젝트로 판단하여 변경하지 않음
