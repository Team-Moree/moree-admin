import { Card, Col, Row, Statistic } from 'antd';
import { ShopOutlined, AimOutlined, TagsOutlined, UserOutlined } from '@ant-design/icons';
import styled from 'styled-components';

const PageTitle = styled.h2`
  margin-bottom: 24px;
`;

export default function Dashboard() {
  return (
    <div>
      <PageTitle>대시보드</PageTitle>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic title="팬덤 카테고리" prefix={<TagsOutlined />} value="-" />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic title="팬덤 타겟" prefix={<AimOutlined />} value="-" />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic title="스토어" prefix={<ShopOutlined />} value="-" />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic title="유저" prefix={<UserOutlined />} value="-" />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
