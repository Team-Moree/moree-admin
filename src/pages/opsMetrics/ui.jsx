import { useCallback, useEffect, useState } from 'react';
import { Card, Alert, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import styled from 'styled-components';

export const PageTitle = styled.h2`
  margin-bottom: 4px;
`;
export const SubText = styled.p`
  color: #8c8c8c;
  margin-bottom: 20px;
  font-size: 13px;
`;
export const HintText = styled.p`
  margin: 8px 0 0;
  font-size: 12px;
  color: #8c8c8c;
  line-height: 1.4;
`;
export const SectionTitle = styled.h3`
  margin: 32px 0 12px;
  font-weight: 600;
`;
export const SoftCard = styled(Card)`
  border-radius: 14px;
  border: 1px solid #f0f0f0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03);
  height: 100%;
  .ant-card-head-title {
    font-weight: 600;
  }
`;
export const Toolbar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
`;
export const ClickText = styled.a`
  color: inherit;
  &:hover {
    color: #2a78d6;
    text-decoration: underline;
  }
`;

export const COLORS = {
  blue: '#2a78d6',
  green: '#1baf7a',
  pink: '#e87ba4',
  orange: '#eda100',
  red: '#eb6834',
  purple: '#7856ff',
  gray: '#bfbfbf',
};

export const formatDate = (d) => (d ? dayjs(d).format('YYYY.MM.DD') : '-');
export const formatShort = (d) => dayjs(d).format('M/D');
export const formatNumber = (n) => (n == null ? '-' : n.toLocaleString());
export const formatRate = (n) => (n == null ? '-' : `${n}%`);

export function useRemote(fetcher) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetcher()
      .then(setData)
      .catch((err) => setError(err?.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  }, [fetcher]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, load };
}

export function ReloadButton({ onClick, loading }) {
  return (
    <Button icon={<ReloadOutlined />} onClick={onClick} loading={loading}>
      새로고침
    </Button>
  );
}

export function ErrorAlert({ title, error }) {
  if (!error) return null;
  return <Alert type="error" showIcon title={title} description={error} style={{ marginBottom: 16 }} />;
}
