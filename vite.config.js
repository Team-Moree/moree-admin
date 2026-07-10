import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // 로컬 개발 서버 프록시 대상.
  // client 의 baseURL 이 '/api'(프록시)일 때만 사용되므로, 클라이언트가 직접 호출하는
  // VITE_API_BASE_URL 과 분리한다. (VITE_API_BASE_URL 은 하위호환 폴백)
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || env.VITE_API_BASE_URL || 'http://localhost:8080'
  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
