import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  Col,
  Row,
  Statistic,
  Table,
  DatePicker,
  Button,
  Alert,
  Space,
  Spin,
  Typography,
} from 'antd';
import {
  UserOutlined,
  UsergroupAddOutlined,
  ThunderboltOutlined,
  AppstoreOutlined,
  LoginOutlined,
  UserAddOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import styled from 'styled-components';
import { fetchGaOverview } from '../api/ga';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const PageTitle = styled.h2`
  margin-bottom: 4px;
`;
const SubText = styled.p`
  color: #8c8c8c;
  margin-bottom: 24px;
  font-size: 13px;
`;

const DATE_FMT = 'YYYY-MM-DD';
const DEFAULT_RANGE = [dayjs().subtract(28, 'day'), dayjs().subtract(1, 'day')];

export default function Analytics() {
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null); // { code, message }

  const load = useCallback(async (r) => {
    setLoading(true);
    setError(null);
    try {
      const [start, end] = r || [];
      const overview = await fetchGaOverview({
        startDate: start ? start.format(DATE_FMT) : undefined,
        endDate: end ? end.format(DATE_FMT) : undefined,
      });
      setData(overview);
    } catch (err) {
      const body = err.response?.data;
      setError({
        code: body?.code || 'UNKNOWN',
        message: body?.message || err.message || 'GA 데이터를 불러오지 못했습니다.',
      });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(DEFAULT_RANGE);
  }, [load]);

  const totals = data?.userTotals || {};
  const keyEvents = data?.keyEventCounts || {};

  const cards = [
    { title: '활성 사용자', value: totals.activeUsers, icon: <UserOutlined /> },
    { title: '신규 사용자', value: totals.newUsers, icon: <UsergroupAddOutlined /> },
    { title: '세션', value: totals.sessions, icon: <ThunderboltOutlined /> },
    { title: 'first_open (설치)', value: keyEvents.first_open, icon: <AppstoreOutlined /> },
    { title: 'sign_up (가입)', value: keyEvents.sign_up, icon: <UserAddOutlined /> },
    { title: 'login (로그인)', value: keyEvents.login, icon: <LoginOutlined /> },
  ];

  const isNotConfigured = error?.code === 'GA_NOT_CONFIGURED';

  return (
    <div>
      <PageTitle>GA 분석 (MVP)</PageTitle>
      <SubText>
        Firebase(GA4) 이벤트 기반 핵심 지표. 서버리스 함수(/api/ga)가 GA4 Data API 를 통해 집계합니다.
      </SubText>

      <Space style={{ marginBottom: 16 }} wrap>
        <RangePicker
          value={range}
          allowClear={false}
          onChange={(r) => r && setRange(r)}
          disabledDate={(d) => d && d > dayjs().endOf('day')}
        />
        <Button type="primary" icon={<ReloadOutlined />} loading={loading} onClick={() => load(range)}>
          조회
        </Button>
        {data?.dateRange && (
          <Text type="secondary">
            {data.dateRange.startDate} ~ {data.dateRange.endDate}
          </Text>
        )}
      </Space>

      {error && (
        <Alert
          style={{ marginBottom: 16 }}
          type={isNotConfigured ? 'info' : 'error'}
          showIcon
          message={isNotConfigured ? 'GA 환경변수가 아직 설정되지 않았습니다' : 'GA 데이터 조회 실패'}
          description={
            isNotConfigured ? (
              <span>
                Vercel 프로젝트에 <code>GA4_PROPERTY_ID</code>, <code>GA_CLIENT_EMAIL</code>,{' '}
                <code>GA_PRIVATE_KEY</code> 환경변수를 설정하면 실제 데이터가 표시됩니다. (설정 방법은{' '}
                <code>.env.ga.example</code> 참고)
              </span>
            ) : (
              <span>
                [{error.code}] {error.message}
              </span>
            )
          }
        />
      )}

      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          {cards.map((c) => (
            <Col xs={24} sm={12} lg={8} key={c.title}>
              <Card>
                <Statistic
                  title={c.title}
                  prefix={c.icon}
                  value={error ? '-' : c.value ?? 0}
                  groupSeparator=","
                />
              </Card>
            </Col>
          ))}
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={12}>
            <Card title="Top 이벤트">
              <Table
                size="small"
                rowKey={(r) => r.eventName}
                pagination={false}
                dataSource={error ? [] : data?.topEvents || []}
                columns={[
                  {
                    title: '#',
                    width: 48,
                    render: (_, __, i) => i + 1,
                  },
                  { title: '이벤트명', dataIndex: 'eventName' },
                  {
                    title: '발생 수',
                    dataIndex: 'eventCount',
                    align: 'right',
                    render: (v) => v?.toLocaleString(),
                  },
                ]}
              />
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title="검색어 TOP">
              {data?.searchTermsError && !error && (
                <Alert
                  style={{ marginBottom: 12 }}
                  type="warning"
                  showIcon
                  message="검색어 집계를 불러오지 못했습니다"
                  description="GA4 콘솔에서 맞춤 측정기준 search_term 등록이 선행되어야 합니다."
                />
              )}
              <Table
                size="small"
                rowKey={(r) => r.searchTerm}
                pagination={false}
                dataSource={error ? [] : data?.searchTerms || []}
                columns={[
                  {
                    title: '#',
                    width: 48,
                    render: (_, __, i) => i + 1,
                  },
                  { title: '검색어', dataIndex: 'searchTerm' },
                  {
                    title: '검색 수',
                    dataIndex: 'eventCount',
                    align: 'right',
                    render: (v) => v?.toLocaleString(),
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}
