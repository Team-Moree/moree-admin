import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout as AntLayout, Menu, Button, theme } from 'antd';
import {
  DashboardOutlined,
  BarChartOutlined,
  TagsOutlined,
  AimOutlined,
  ShopOutlined,
  WarningOutlined,
  CommentOutlined,
  UserOutlined,
  LogoutOutlined,
  SmileOutlined,
  BookOutlined,
  BellOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import EnvBadge from './EnvBadge';
import { ENV_LABEL, ENV_BADGE_COLOR } from '../config/env';

const { Header, Sider, Content } = AntLayout;

const Logo = styled.div`
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: ${(p) => (p.$collapsed ? '16px' : '20px')};
  color: ${(p) => p.$color};
`;

const StyledHeader = styled(Header)`
  padding: 0 24px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #f0f0f0;
`;

const StyledContent = styled(Content)`
  margin: 24px;
  padding: 24px;
  background: #fff;
  border-radius: 8px;
  min-height: 360px;
`;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '대시보드' },
  { key: '/analytics', icon: <BarChartOutlined />, label: 'GA 분석' },
  { key: '/fandom-categories', icon: <TagsOutlined />, label: '팬덤 카테고리' },
  { key: '/fandom-targets', icon: <AimOutlined />, label: '팬덤 타겟' },
  { key: '/stores', icon: <ShopOutlined />, label: '스토어' },
  { key: '/store-reports', icon: <WarningOutlined />, label: '스토어 신고/수정' },
  { key: '/review-reports', icon: <CommentOutlined />, label: '리뷰 신고' },
  { key: '/users', icon: <UserOutlined />, label: '유저' },
  { key: '/morees', icon: <SmileOutlined />, label: '모리' },
  { key: '/bookmark-icons', icon: <BookOutlined />, label: '북마크 아이콘' },
  { key: '/notifications', icon: <BellOutlined />, label: '푸시 알림 (QA)' },
];

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { token: themeToken } = theme.useToken();

  const handleLogout = () => {
    sessionStorage.removeItem('masterToken');
    navigate('/login');
  };

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} theme="light">
        <Logo $collapsed={collapsed} $color={themeToken.colorPrimary}>
          {collapsed ? 'M' : `Moree Admin`}
          {!collapsed && (
            <span style={{ fontSize: 11, marginLeft: 6, opacity: 0.85 }}>{ENV_LABEL}</span>
          )}
        </Logo>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <AntLayout>
        <StyledHeader style={{ borderTop: `3px solid ${ENV_BADGE_COLOR}` }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <EnvBadge />
            <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}>
              로그아웃
            </Button>
          </div>
        </StyledHeader>
        <StyledContent>{children}</StyledContent>
      </AntLayout>
    </AntLayout>
  );
}
