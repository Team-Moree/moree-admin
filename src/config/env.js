// 환경 프로필 단일 소스(single source of truth)
// - 배지 색/문구, 테마 강조색, API 베이스 URL을 모두 여기서 파생한다.
// - VITE_APP_ENV: 'real'(운영) | 'beta'(개발). 미설정 시 안전하게 'beta'로 간주.
// - VITE_API_BASE_URL: 지정 시 해당 호스트로 직접 호출, 미지정 시 '/api'(프록시/리라이트) 사용.

export const APP_ENV = import.meta.env.VITE_APP_ENV === 'real' ? 'real' : 'beta';
export const IS_REAL = APP_ENV === 'real';

// 지정되지 않으면 same-origin '/api' 로 폴백 → 로컬은 vite 프록시, 배포는 vercel.json rewrite 사용
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const PROFILE = {
  real: {
    label: 'REAL',
    scope: '운영',
    // 배지: 운영은 "조심하세요" 신호로 붉은색
    badgeColor: '#f5222d',
    // 테마 강조색: 기존 인디고 유지(익숙한 운영 화면)
    primaryColor: '#6366f1',
  },
  beta: {
    label: 'BETA',
    scope: '개발',
    // 배지: 개발은 한눈에 구분되는 주황색
    badgeColor: '#fa8c16',
    // 테마 강조색: 전체 UI가 주황으로 물들어 운영과 확실히 구분됨
    primaryColor: '#fa8c16',
  },
};

export const ENV_PROFILE = PROFILE[APP_ENV];
export const ENV_LABEL = ENV_PROFILE.label;
export const ENV_SCOPE = ENV_PROFILE.scope;
export const ENV_BADGE_COLOR = ENV_PROFILE.badgeColor;
export const ENV_PRIMARY_COLOR = ENV_PROFILE.primaryColor;

// "REAL · 운영" / "BETA · 개발"
export const ENV_BADGE_TEXT = `${ENV_LABEL} · ${ENV_SCOPE}`;
