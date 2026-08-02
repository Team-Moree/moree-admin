import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  Col,
  Row,
  Statistic,
  DatePicker,
  Button,
  Alert,
  Space,
  Spin,
  Empty,
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
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
  Cell,
} from 'recharts';
import dayjs from 'dayjs';
import styled from 'styled-components';
import { fetchGaOverview } from '../api/ga';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const DATE_FMT = 'YYYY-MM-DD';
const DEFAULT_RANGE = [dayjs().subtract(28, 'day'), dayjs().subtract(1, 'day')];

// dataviz 검증 통과 팔레트(라이트 모드): slot1 blue / slot2 green.
// (validate_palette.js "#2a78d6,#008300" --mode light → ALL PASS)
const C = {
  active: '#2a78d6', // 활성 사용자
  new: '#008300', // 신규 사용자
  bar: '#2a78d6', // 단일 계열 막대
  barAlt: '#256abf', // 강조(1위)
  grid: '#f0f0f0', // 눈에 띄지 않는 그리드
  axis: '#8c8c8c', // 축/눈금 텍스트(계열색 아님)
};

const PageTitle = styled.h2`
  margin-bottom: 4px;
`;
const SubText = styled.p`
  color: #8c8c8c;
  margin-bottom: 24px;
  font-size: 13px;
`;

const tooltipStyle = {
  borderRadius: 8,
  border: '1px solid #f0f0f0',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  fontSize: 13,
};

const fmt = (v) => (typeof v === 'number' ? v.toLocaleString() : v);
// 'YYYY-MM-DD' → 'MM/DD' (축 라벨 간결화)
const shortDay = (d) => (typeof d === 'string' && d.length >= 10 ? d.slice(5).replace('-', '/') : d);

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
  const dailyUsers = error ? [] : data?.dailyUsers || [];
  const topEvents = error ? [] : data?.topEvents || [];
  const searchTerms = error ? [] : data?.searchTerms || [];

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
      <PageTitle>GA 분석</PageTitle>
      <SubText>
        Firebase(GA4) 이벤트 기반 핵심 지표. 서버리스 함수(/api/ga)가 GA4 Data API 로 집계합니다.
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
                <code>GA_PRIVATE_KEY</code> 를 설정하면 실제 데이터가 표시됩니다.
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
        {/* KPI 카드: 단일 값은 차트보다 히어로 숫자가 명확 */}
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

        {/* 일별 사용자 추이: 변화-시간 → 라인차트 (2계열, 범례로 식별) */}
        <Card title="일별 사용자 추이" style={{ marginTop: 16 }}>
          {dailyUsers.length === 0 ? (
            <Empty description="데이터 없음" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyUsers} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDay}
                  tick={{ fill: C.axis, fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: C.grid }}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fill: C.axis, fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  allowDecimals={false}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
                <Legend iconType="plainline" wrapperStyle={{ fontSize: 13 }} />
                <Line
                  type="monotone"
                  dataKey="activeUsers"
                  name="활성 사용자"
                  stroke={C.active}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="newUsers"
                  name="신규 사용자"
                  stroke={C.new}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {/* Top 이벤트: 크기 비교 → 가로 막대(단일 계열, 직접 라벨) */}
          <Col xs={24} lg={12}>
            <Card title="Top 이벤트">
              {topEvents.length === 0 ? (
                <Empty description="데이터 없음" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(240, topEvents.length * 34)}>
                  <BarChart
                    layout="vertical"
                    data={topEvents}
                    margin={{ top: 4, right: 48, bottom: 4, left: 8 }}
                  >
                    <CartesianGrid stroke={C.grid} horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="eventName"
                      width={132}
                      tick={{ fill: C.axis, fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
                    <Bar dataKey="eventCount" name="발생 수" radius={[0, 4, 4, 0]} maxBarSize={22}>
                      {topEvents.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? C.barAlt : C.bar} />
                      ))}
                      <LabelList dataKey="eventCount" position="right" formatter={fmt} style={{ fill: C.axis, fontSize: 12 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </Col>

          {/* 검색어 TOP: 동일 형태의 가로 막대 */}
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
              {searchTerms.length === 0 ? (
                <Empty description="데이터 없음" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(240, searchTerms.length * 34)}>
                  <BarChart
                    layout="vertical"
                    data={searchTerms}
                    margin={{ top: 4, right: 48, bottom: 4, left: 8 }}
                  >
                    <CartesianGrid stroke={C.grid} horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="searchTerm"
                      width={132}
                      tick={{ fill: C.axis, fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
                    <Bar dataKey="eventCount" name="검색 수" fill={C.bar} radius={[0, 4, 4, 0]} maxBarSize={22}>
                      <LabelList dataKey="eventCount" position="right" formatter={fmt} style={{ fill: C.axis, fontSize: 12 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}
