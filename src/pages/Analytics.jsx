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
  Tabs,
  Typography,
} from 'antd';
import {
  UserOutlined,
  UsergroupAddOutlined,
  ThunderboltOutlined,
  AppstoreOutlined,
  LoginOutlined,
  UserAddOutlined,
  CommentOutlined,
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

// dataviz 검증 통과 팔레트(라이트): slot1 blue / slot2 green
// (validate_palette.js "#2a78d6,#008300" --mode light → ALL PASS)
const C = {
  active: '#2a78d6',
  new: '#008300',
  bar: '#2a78d6',
  barAlt: '#256abf',
  grid: '#f0f0f0',
  axis: '#8c8c8c',
};

const PageTitle = styled.h2`
  margin-bottom: 4px;
`;
const SubText = styled.p`
  color: #8c8c8c;
  margin-bottom: 20px;
  font-size: 13px;
`;

const tooltipStyle = {
  borderRadius: 8,
  border: '1px solid #f0f0f0',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  fontSize: 13,
};

const fmt = (v) => (typeof v === 'number' ? v.toLocaleString() : v);
const shortDay = (d) => (typeof d === 'string' && d.length >= 10 ? d.slice(5).replace('-', '/') : d);

// ── 재사용 가로 막대 ────────────────────────────────────────────────
function HBar({ data, nameKey, valueKey, valueName, highlightFirst = false }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 34 + 16)}>
      <BarChart layout="vertical" data={data} margin={{ top: 4, right: 52, bottom: 4, left: 8 }}>
        <CartesianGrid stroke={C.grid} horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey={nameKey}
          width={128}
          tick={{ fill: C.axis, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
        <Bar dataKey={valueKey} name={valueName} radius={[0, 4, 4, 0]} maxBarSize={22} fill={C.bar}>
          {highlightFirst &&
            data.map((_, i) => <Cell key={i} fill={i === 0 ? C.barAlt : C.bar} />)}
          <LabelList dataKey={valueKey} position="right" formatter={fmt} style={{ fill: C.axis, fontSize: 12 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── B그룹(맞춤차원) 패널: {rows:[{name,count}], error} ──────────────
function DimPanel({ title, result, valueName = '건수', paramHint }) {
  const rows = result?.rows || [];
  const pending = !!result?.error;
  return (
    <Card title={title} size="small">
      {pending && (
        <Alert
          style={{ marginBottom: 12 }}
          type="warning"
          showIcon
          message="아직 데이터 없음"
          description={`GA4 맞춤 측정기준(${paramHint}) 등록 + 앱 계측 후 표시됩니다.`}
        />
      )}
      {rows.length === 0 ? (
        <Empty description={pending ? '등록/계측 대기' : '데이터 없음'} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <HBar data={rows} nameKey="name" valueKey="count" valueName={valueName} highlightFirst />
      )}
    </Card>
  );
}

export default function Analytics() {
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');

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
  const retention = data?.retention || {};
  const dailyUsers = error ? [] : data?.dailyUsers || [];
  const topEvents = error ? [] : data?.topEvents || [];
  const topScreens = error ? [] : data?.topScreens || [];
  const platforms = error ? [] : data?.platforms || [];
  const searchTerms = error ? [] : data?.searchTerms || [];

  const isNotConfigured = error?.code === 'GA_NOT_CONFIGURED';
  const stat = (v) => (error ? '-' : v ?? 0);
  const pct = (v) => (error || v == null ? '-' : v);

  // ── 개요 탭 ──
  const OverviewTab = (
    <>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card><Statistic title="활성 사용자" prefix={<UserOutlined />} value={stat(totals.activeUsers)} groupSeparator="," /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card><Statistic title="신규 사용자" prefix={<UsergroupAddOutlined />} value={stat(totals.newUsers)} groupSeparator="," /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card><Statistic title="세션" prefix={<ThunderboltOutlined />} value={stat(totals.sessions)} groupSeparator="," /></Card>
        </Col>
      </Row>

      <Card title="재방문율 (선택 기간 코호트)" style={{ marginTop: 16 }} size="small">
        {retention?.error && !error && (
          <Alert style={{ marginBottom: 12 }} type="warning" showIcon message="재방문율을 계산할 데이터가 부족합니다" />
        )}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}><Statistic title="D1 재방문율" value={pct(retention.d1)} suffix={error || retention.d1 == null ? '' : '%'} /></Col>
          <Col xs={24} sm={8}><Statistic title="D7 재방문율" value={pct(retention.d7)} suffix={error || retention.d7 == null ? '' : '%'} /></Col>
          <Col xs={24} sm={8}><Statistic title="D30 재방문율" value={pct(retention.d30)} suffix={error || retention.d30 == null ? '' : '%'} /></Col>
        </Row>
        <Text type="secondary" style={{ fontSize: 12 }}>
          코호트 기준 인원 {error ? '-' : (retention.totalUsers ?? 0).toLocaleString()}명 · 최근 가입자는 아직 D30에 도달하지 않아 과소집계될 수 있습니다.
        </Text>
      </Card>

      <Card title="일별 사용자 추이" style={{ marginTop: 16 }}>
        {dailyUsers.length === 0 ? (
          <Empty description="데이터 없음" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyUsers} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fill: C.axis, fontSize: 12 }} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={24} />
              <YAxis tick={{ fill: C.axis, fontSize: 12 }} tickLine={false} axisLine={false} width={48} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
              <Legend iconType="plainline" wrapperStyle={{ fontSize: 13 }} />
              <Line type="monotone" dataKey="activeUsers" name="활성 사용자" stroke={C.active} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="newUsers" name="신규 사용자" stroke={C.new} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card title="플랫폼별 활성 사용자 (iOS / Android)" style={{ marginTop: 16 }} size="small">
        {platforms.length === 0 ? (
          <Empty description="데이터 없음" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <HBar data={platforms} nameKey="platform" valueKey="activeUsers" valueName="활성 사용자" />
        )}
      </Card>
    </>
  );

  // ── 이벤트 탭 ──
  const keyCards = [
    { title: 'first_open (설치)', value: keyEvents.first_open, icon: <AppstoreOutlined /> },
    { title: 'sign_up (가입)', value: keyEvents.sign_up, icon: <UserAddOutlined /> },
    { title: 'login (로그인)', value: keyEvents.login, icon: <LoginOutlined /> },
    { title: 'review_submit (후기)', value: keyEvents.review_submit, icon: <CommentOutlined /> },
  ];
  const EventsTab = (
    <>
      <Row gutter={[16, 16]}>
        {keyCards.map((c) => (
          <Col xs={24} sm={12} lg={6} key={c.title}>
            <Card><Statistic title={c.title} prefix={c.icon} value={stat(c.value)} groupSeparator="," /></Card>
          </Col>
        ))}
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="Top 이벤트" size="small">
            {topEvents.length === 0 ? (
              <Empty description="데이터 없음" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <HBar data={topEvents} nameKey="eventName" valueKey="eventCount" valueName="발생 수" highlightFirst />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="화면별 조회 TOP" size="small">
            {topScreens.length === 0 ? (
              <Empty description="데이터 없음" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <HBar data={topScreens} nameKey="screenName" valueKey="views" valueName="조회 수" highlightFirst />
            )}
          </Card>
        </Col>
      </Row>
    </>
  );

  // ── 행사·검색 탭 (B그룹) ──
  const ContentTab = (
    <>
      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message="이 탭의 지표는 GA4 맞춤 측정기준 등록 + 앱 이벤트 계측이 선행되어야 채워집니다"
        description="현재는 패널만 준비된 상태이며, 등록·계측이 완료되면 자동으로 데이터가 표시됩니다."
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="검색어 TOP" size="small">
            {data?.searchTermsError && !error && (
              <Alert style={{ marginBottom: 12 }} type="warning" showIcon message="아직 데이터 없음" description="GA4 맞춤 측정기준(search_term) 등록 + 앱 계측 후 표시됩니다." />
            )}
            {searchTerms.length === 0 ? (
              <Empty description={data?.searchTermsError ? '등록/계측 대기' : '데이터 없음'} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <HBar data={searchTerms} nameKey="searchTerm" valueKey="eventCount" valueName="검색 수" highlightFirst />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <DimPanel title="행사 조회 TOP" result={error ? null : data?.byStore} valueName="조회 수" paramHint="item_name · view_item" />
        </Col>
        <Col xs={24} lg={12}>
          <DimPanel title="지역별 조회" result={error ? null : data?.byLocation} valueName="조회 수" paramHint="location · view_item" />
        </Col>
        <Col xs={24} lg={12}>
          <DimPanel title="유형별 조회" result={error ? null : data?.byEventType} valueName="조회 수" paramHint="event_type · view_item" />
        </Col>
        <Col xs={24} lg={12}>
          <DimPanel title="상태별 조회" result={error ? null : data?.byStatus} valueName="조회 수" paramHint="status · view_item" />
        </Col>
      </Row>
    </>
  );

  return (
    <div>
      <PageTitle>GA 분석</PageTitle>
      <SubText>Firebase(GA4) 이벤트 기반 지표. 서버리스 함수(/api/ga)가 GA4 Data API 로 집계합니다.</SubText>

      <Space style={{ marginBottom: 16 }} wrap>
        <RangePicker value={range} allowClear={false} onChange={(r) => r && setRange(r)} disabledDate={(d) => d && d > dayjs().endOf('day')} />
        <Button type="primary" icon={<ReloadOutlined />} loading={loading} onClick={() => load(range)}>조회</Button>
        {data?.dateRange && <Text type="secondary">{data.dateRange.startDate} ~ {data.dateRange.endDate}</Text>}
      </Space>

      {error && (
        <Alert
          style={{ marginBottom: 16 }}
          type={isNotConfigured ? 'info' : 'error'}
          showIcon
          message={isNotConfigured ? 'GA 환경변수가 아직 설정되지 않았습니다' : 'GA 데이터 조회 실패'}
          description={
            isNotConfigured ? (
              <span>Vercel 프로젝트에 <code>GA4_PROPERTY_ID</code>, <code>GA_CLIENT_EMAIL</code>, <code>GA_PRIVATE_KEY</code> 를 설정하면 실제 데이터가 표시됩니다.</span>
            ) : (
              <span>[{error.code}] {error.message}</span>
            )
          }
        />
      )}

      <Spin spinning={loading}>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            { key: 'overview', label: '개요', children: OverviewTab },
            { key: 'events', label: '이벤트', children: EventsTab },
            { key: 'content', label: '행사·검색', children: ContentTab },
          ]}
        />
      </Spin>
    </div>
  );
}
