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

## 실행

### 로컬 개발 (localhost:8080 API)

```bash
npm start
```

### 베타 환경 (api.moree.app API)

```bash
npm run start:beta
```

개발 서버: http://localhost:3000

## 빌드

```bash
# 로컬
npm run build

# 베타
npm run build:beta
```

## 환경 설정

| 파일 | API 대상 |
|------|----------|
| `.env.local` | `http://localhost:8080` |
| `.env.beta` | `https://api.moree.app` |

## 로그인

마스터 토큰을 입력하여 로그인합니다. 토큰은 백엔드 `jwt.masterToken` 설정값과 동일해야 합니다.

## Vercel 배포

### 1. Vercel CLI로 배포

```bash
# Vercel CLI 설치
npm i -g vercel

# 로그인
vercel login

# 배포 (최초 실행 시 프로젝트 설정 진행)
vercel

# 프로덕션 배포
vercel --prod
```

### 2. GitHub 연동 자동 배포

1. [vercel.com](https://vercel.com)에서 로그인
2. **Add New Project** 클릭
3. GitHub 레포지토리 `moree-admin` 선택
4. 빌드 설정 확인:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build:beta`
   - **Output Directory**: `dist`
5. **Environment Variables** 설정:
   - `VITE_API_BASE_URL` = `https://api.moree.app`
6. **Deploy** 클릭

이후 `main` 브랜치에 push하면 자동 배포됩니다.

### 3. Vercel 프로젝트 설정 (vercel.json)

SPA 라우팅을 위해 `vercel.json`이 프로젝트 루트에 포함되어 있습니다. 모든 경로를 `index.html`로 리다이렉트합니다.
