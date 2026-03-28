import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, App } from 'antd';
import { ShopOutlined, AimOutlined, TagsOutlined, UserOutlined, SmileOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import client from '../api/client';

const PageTitle = styled.h2`
  margin-bottom: 24px;
`;

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const { notification } = App.useApp();

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const res = await client.get('/admin/dashboard');
        setStats(res.data);
      } catch (err) {
        const msg = err.response?.data?.message || err.message || '통계 조회 실패';
        notification.error({ message: '통계 조회 실패', description: msg });
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div>
      <PageTitle>대시보드</PageTitle>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable loading={loading}>
            <Statistic title="팬덤 카테고리" prefix={<TagsOutlined />} value={stats?.fandomCategoryCount ?? '-'} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable loading={loading}>
            <Statistic title="팬덤 타겟" prefix={<AimOutlined />} value={stats?.fandomTargetCount ?? '-'} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable loading={loading}>
            <Statistic title="모리" prefix={<SmileOutlined />} value={stats?.moreeCount ?? '-'} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable loading={loading}>
            <Statistic title="스토어" prefix={<ShopOutlined />} value={stats?.storeCount ?? '-'} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable loading={loading}>
            <Statistic title="유저" prefix={<UserOutlined />} value={stats?.userCount ?? '-'} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
