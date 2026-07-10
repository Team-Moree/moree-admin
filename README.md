# Moree Admin

Moree 서비스 관리자 패널

## 기술 스택

- React 18 + Vite
- Ant Design (UI)
- styled-components (스타일링)
- axios (HTTP 클라이언트)
- react-router-dom (라우팅)

## 설치

```bash
npm install
```

## 환경 프로필 (REAL / BETA)

화면 상단·로그인 화면·브라우저 탭에 현재 환경이 표시됩니다.

| 프로필 | 배지 | 테마색 | 용도 |
|--------|------|--------|------|
| **REAL** (운영) | 🔴 `REAL · 운영` | 인디고 | 운영 서버 |
| **BETA** (개발) | 🟠 `BETA · 개발` | 주황 | 개발 서버 |

- 운영 API: `api.moree.app`
- 개발 API: `dev.api.moree.app` (Swagger: https://dev.api.moree.app/swagger-ui/index.html)
- 프로필은 `VITE_APP_ENV` (`real` | `beta`) 값으로 결정되며, 설정의 단일 소스는 `src/config/env.js` 입니다.

## 로컬 실행

개발 서버: http://localhost:3000

```bash
# 1) 로컬 백엔드(localhost:8080) 연동 — 기본 개발
npm start

# 2) 개발(BETA) 환경 — 개발 API 연동, 화면은 BETA(주황)
npm run start:beta

# 3) 릴리즈(REAL) 환경 — 운영 API 연동, 화면은 REAL(인디고)
npm run start:real
```

> `start:beta` / `start:real` 은 실제 배포와 동일한 프로필 화면을 로컬에서 미리 볼 때 사용합니다.
> API 는 vite 프록시(`VITE_DEV_PROXY_TARGET`)를 통해 same-origin(`/api`)으로 호출되어 CORS 없이 동작합니다.

## 빌드

```bash
npm run build        # 기본(development 값)
npm run build:beta   # 개발(BETA)
npm run build:real   # 운영(REAL)
```

## 환경 설정 파일

| 파일 | 프로필 | 프록시/ API 대상 |
|------|--------|------------------|
| `.env.local` | BETA | 로컬 `http://localhost:8080` (프록시) |
| `.env.beta`  | BETA | `api.moree.app` (초기) → `dev.api.moree.app` (전환 시) |
| `.env.real`  | REAL | `api.moree.app` |

### API 라우팅 동작 방식

- axios `client` 의 baseURL 은 `VITE_API_BASE_URL` 이 있으면 그 호스트로 **직접 호출**, 없으면 `/api` 로 호출합니다.
- `/api` 요청은 **로컬**에서는 vite 프록시가, **배포**에서는 `vercel.json` 의 rewrite 가 실제 API 로 전달합니다.
- 기본값은 `VITE_API_BASE_URL` 미설정 → `/api` → (배포) `vercel.json` → `api.moree.app` 입니다.
  이 방식은 same-origin 이라 **CORS 설정이 필요 없습니다.**

주소 검색 기능을 사용하는 환경에는 `VITE_NAVER_MAP_KEY` 를 설정합니다.

## 로그인

마스터 토큰을 입력하여 로그인합니다. 토큰은 백엔드 `jwt.masterToken` 설정값과 동일해야 합니다.

## Vercel 배포 (레포 1개로 운영 + 개발 동시 운영)

한 레포지토리로 **운영(Production)** 과 **개발(Preview)** 을 동시에 띄웁니다.

### 1. 프로젝트 최초 설정

1. [vercel.com](https://vercel.com) → **Add New Project** → GitHub `moree-admin` 선택
2. 빌드 설정:
   - **Framework Preset**: Vite
   - **Build Command**: *비워두기* — `package.json` 의 `vercel-build` 스크립트가 자동 사용됩니다.
     `vercel-build` 는 `VERCEL_ENV` 를 보고 운영이면 `build:real`, 그 외엔 `build:beta` 로 빌드합니다.
   - **Output Directory**: `dist`
3. **Settings → Git → Production Branch** 를 운영 브랜치(예: `main` 또는 `release`)로 지정
4. **Deploy**

### 2. 브랜치별 배포 (자동)

| 브랜치 | Vercel 환경 | 빌드 | 프로필 | URL |
|--------|-------------|------|--------|-----|
| 운영 브랜치 (`main`) | Production | `build:real` | 🔴 REAL | 운영 도메인 (고정) |
| 그 외 브랜치 (`dev` 등) | Preview | `build:beta` | 🟠 BETA | 브랜치 고정 URL |

- 운영 브랜치에 push → 운영(REAL) 배포 갱신
- `dev` 브랜치에 push → 개발(BETA) 프리뷰 배포 갱신
  (브랜치 고정 URL: `moree-admin-git-dev-<팀명>.vercel.app` — 항상 최신 dev 유지)

### 3. 환경 변수 (Vercel → Settings → Environment Variables)

프로필 배지와 기본 API(api.moree.app)는 코드/`vercel.json` 으로 이미 동작하므로 **필수 변수는 없습니다.**
지도 기능을 쓰면 아래만 추가:

- `VITE_NAVER_MAP_KEY` = NAVER Maps `ncpKeyId` (Production, Preview 모두)

### 4. [전환] 개발 배포를 `dev.api.moree.app` 로 직접 연결할 때

초기에는 개발 배포도 `api.moree.app` 을 사용합니다(요구사항).
백엔드 `dev.api.moree.app` 준비 + 프론트 오리진 CORS 허용 후:

- Vercel → Environment Variables 에서 **Preview** 스코프에만 추가:
  - `VITE_API_BASE_URL` = `https://dev.api.moree.app`
- 이후 개발(Preview) 배포는 `dev.api.moree.app` 을 직접 호출합니다. (운영은 그대로 `api.moree.app`)
- 코드에서 하려면 `.env.beta` 의 `VITE_API_BASE_URL` 주석을 해제해도 됩니다.

### vercel.json

SPA 라우팅과 `/api` → `api.moree.app` rewrite 가 포함되어 있습니다. (same-origin, CORS 불필요)
