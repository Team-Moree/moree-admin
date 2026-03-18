import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Input, Button, Typography, notification } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import client from '../api/client';

const { Title, Text } = Typography;

const Wrapper = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
`;

const LoginCard = styled(Card)`
  width: 400px;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
`;

const LogoArea = styled.div`
  text-align: center;
  margin-bottom: 32px;
`;

export default function Login() {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!token.trim()) {
      notification.warning({ message: '입력 필요', description: '토큰을 입력해주세요' });
      return;
    }
    setLoading(true);
    try {
      sessionStorage.setItem('masterToken', token.trim());
      const res = await client.get('/health/auth');
      const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      if (!body.includes('master-user')) {
        throw new Error('not master');
      }
      notification.success({ message: '로그인 성공', description: '관리자 패널에 진입합니다' });
      navigate('/');
    } catch {
      sessionStorage.removeItem('masterToken');
      notification.error({ message: '로그인 실패', description: '마스터 토큰이 아니거나 유효하지 않은 토큰입니다' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Wrapper>
      <LoginCard>
        <LogoArea>
          <Title level={2} style={{ margin: 0, color: '#6366f1' }}>Moree Admin</Title>
          <Text type="secondary">마스터 토큰으로 로그인</Text>
        </LogoArea>
        <Input.Password
          size="large"
          prefix={<LockOutlined />}
          placeholder="마스터 토큰 입력"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onPressEnter={handleLogin}
          style={{ marginBottom: 16 }}
        />
        <Button type="primary" size="large" block loading={loading} onClick={handleLogin}>
          로그인
        </Button>
      </LoginCard>
    </Wrapper>
  );
}
