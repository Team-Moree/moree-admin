import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import koKR from 'antd/locale/ko_KR';
import { createGlobalStyle } from 'styled-components';
import App from './App';
import { ENV_PRIMARY_COLOR, IS_REAL, ENV_LABEL } from './config/env';

// 브라우저 탭에서도 환경 구분: 운영은 그대로, 개발은 접두어 표기
if (!IS_REAL) {
  document.title = `[${ENV_LABEL}] Moree Admin`;
}

const GlobalStyle = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  #root {
    min-height: 100vh;
  }
`;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ConfigProvider locale={koKR} theme={{ token: { colorPrimary: ENV_PRIMARY_COLOR } }}>
        <AntApp>
          <GlobalStyle />
          <App />
        </AntApp>
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>
);
