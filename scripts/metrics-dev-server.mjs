// 로컬 확인용: api/metrics/overview.js handler를 Vercel 없이 띄운다.
//
//   node --env-file=$HOME/moree-grafana.env scripts/metrics-dev-server.mjs
//   VITE_METRICS_PROXY_TARGET=http://localhost:3001 npm start
//
// 토큰 파일(GRAFANA_*)은 레포 밖에 둔다. .gitignore가 .env.local 등을 막지 않는다.
import http from 'node:http';
import handler from '../api/metrics/overview.js';

const PORT = Number(process.env.METRICS_DEV_PORT) || 3001;

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname !== '/api/metrics/overview') {
      res.writeHead(404).end();
      return;
    }
    // Vercel 함수의 req.query / res.status().json() 모양만 맞춰 준다
    req.query = Object.fromEntries(url.searchParams);
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (body) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    };
    await handler(req, res);
    console.log(`${req.method} ${req.url} -> ${res.statusCode}`);
  })
  .listen(PORT, () => console.log(`metrics dev server: http://localhost:${PORT}/api/metrics/overview`));
