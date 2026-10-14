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
  Segmented,
  Tag,
  Table,
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
  IdcardOutlined,
  SearchOutlined,
  StarOutlined,
  ShareAltOutlined,
  BellOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
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
import { fetchUserStats } from '../api/userStats';
import { buildMockOverview } from './analyticsMock'; // [MOCK] 롤백 시 이 줄 + 토글 제거

const { RangePicker } = DatePicker;
const { Text } = Typography;

const DATE_FMT = 'YYYY-MM-DD';
const DEFAULT_RANGE = [dayjs().subtract(28, 'day'), dayjs().subtract(1, 'day')];

// dataviz 검증 통과 팔레트(라이트). 도넛(all-pairs)까지 PASS: blue/green/magenta/yellow/aqua/orange
const C = {
  active: '#2a78d6',
  new: '#008300',
  bar: '#2a78d6',
  barTo: '#5598e7',
  grid: '#eef0f2',
  axis: '#8c8c8c',
};
const CAT = ['#2a78d6', '#008300', '#e87ba4', '#eda100', '#1baf7a', '#eb6834'];

const STATUS_LABEL = {
  PRE_OPEN: '오픈 예정',
  BEFORE_HOURS: '영업 전',
  OPEN: '영업 중',
  CLOSED: '영업 종료',
  PERMANENTLY_CLOSED: '폐업',
};
const ELEMENT_LABEL = {
  share_button: '공유 버튼 (매장 상세)',
  search_result_item: '검색 결과 항목 (탐색)',
};
const withLabels = (result, labels) =>
  result && { ...result, rows: (result.rows || []).map((r) => ({ ...r, name: labels[r.name] || r.name })) };

const PageTitle = styled.h2`
  margin-bottom: 4px;
`;
const SubText = styled.p`
  color: #8c8c8c;
  margin-bottom: 20px;
  font-size: 13px;
`;
// 부드러운 카드 (얇은 테두리 + 은은한 그림자 + 둥근 모서리)
const SoftCard = styled(Card)`
  border-radius: 14px;
  border: 1px solid #f0f0f0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03);
  overflow: hidden;
  .ant-card-head {
    border-bottom: 1px solid #f5f5f5;
    min-height: 48px;
  }
  .ant-card-head-title {
    font-weight: 600;
  }
`;

const tooltipStyle = {
  borderRadius: 10,
  border: '1px solid #f0f0f0',
  boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
  fontSize: 13,
};

const fmt = (v) => (typeof v === 'number' ? v.toLocaleString() : v);
const shortDay = (d) => (typeof d === 'string' && d.length >= 10 ? d.slice(5).replace('-', '/') : d);

// ── 컬러 아이콘 스탯 카드 ───────────────────────────────────────────
function StatCard({ title, value, icon, color, suffix }) {
  return (
    <SoftCard>
      <Statistic
        title={title}
        value={value}
        suffix={suffix}
        groupSeparator=","
        valueStyle={{ fontWeight: 700, color: '#1f1f1f' }}
        prefix={
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              borderRadius: 10,
              marginRight: 10,
              color,
              background: `${color}14`,
              fontSize: 16,
            }}
          >
            {icon}
          </span>
        }
      />
    </SoftCard>
  );
}

// ── 재사용 가로 막대 (그라데이션) ──────────────────────────────────
function HBar({ data, nameKey, valueKey, valueName, gid = 'gbar' }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36 + 16)}>
      <BarChart layout="vertical" data={data} margin={{ top: 4, right: 56, bottom: 4, left: 8 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={C.bar} />
            <stop offset="100%" stopColor={C.barTo} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={C.grid} horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey={nameKey}
          width={128}
          tick={{ fill: '#595959', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
        <Bar dataKey={valueKey} name={valueName} radius={[0, 6, 6, 0]} maxBarSize={20} fill={`url(#${gid})`}>
          <LabelList dataKey={valueKey} position="right" formatter={fmt} style={{ fill: C.axis, fontSize: 12, fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const renderInsidePct = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.07) return null;
  const RAD = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);
  return (
    <text x={x} y={y} fill="#fff" fontSize={12} fontWeight={700} textAnchor="middle" dominantBaseline="central">
      {Math.round(percent * 100)}%
    </text>
  );
};

// ── 도넛 (구성 비율 + 중앙 합계) ───────────────────────────────────
function Donut({ data, nameKey, valueKey, centerLabel }) {
  const total = data.reduce((a, d) => a + (Number(d[valueKey]) || 0), 0);
  return (
    <div style={{ position: 'relative' }}>
      <ResponsiveContainer width="100%" height={264}>
        <PieChart>
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={nameKey}
            innerRadius={64}
            outerRadius={94}
            paddingAngle={2}
            stroke="#fff"
            strokeWidth={2}
            label={renderInsidePct}
            labelLine={false}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CAT[i % CAT.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fmt(v), n]} />
          <Legend wrapperStyle={{ fontSize: 13 }} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
      <div
        style={{
          position: 'absolute',
          top: '44%',
          left: 0,
          right: 0,
          transform: 'translateY(-50%)',
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 700, color: '#1f1f1f' }}>{fmt(total)}</div>
        <div style={{ fontSize: 12, color: '#8c8c8c' }}>{centerLabel || '합계'}</div>
      </div>
    </div>
  );
}

// ── B그룹(맞춤차원) 패널 — bar | donut ─────────────────────────────
function DimPanel({ title, result, valueName = '건수', paramHint, chart = 'bar', gid }) {
  const rows = result?.rows || [];
  const pending = !!result?.error;
  return (
    <SoftCard title={title} size="small">
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
      ) : chart === 'donut' ? (
        <Donut data={rows} nameKey="name" valueKey="count" centerLabel={valueName} />
      ) : (
        <HBar data={rows} nameKey="name" valueKey="count" valueName={valueName} gid={gid} />
      )}
    </SoftCard>
  );
}

const EmptyCard = ({ children }) => <Empty description={children || '데이터 없음'} image={Empty.PRESENTED_IMAGE_SIMPLE} />;

// ── 인사이트: 계측 대기 안내 ───────────────────────────────────────
function PendingPanel({ hint }) {
  return (
    <>
      <Alert
        style={{ marginBottom: 12 }}
        type="warning"
        showIcon
        message="아직 데이터 없음 (앱 이벤트 계측 후 표시)"
        description={hint ? `필요 계측: ${hint}` : undefined}
      />
      <Empty description="계측 대기 — 목업 토글로 목표 화면 미리보기" image={Empty.PRESENTED_IMAGE_SIMPLE} />
    </>
  );
}

// ── 전환 퍼널 (단계별 감소 막대 + 단계 전환율) ─────────────────────
function Funnel({ data }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const first = data[0]?.value || 0;
  return (
    <div>
      {data.map((d, i) => {
        const ofFirst = first ? Math.round((d.value / first) * 100) : 0;
        const step = i > 0 && data[i - 1].value ? Math.round((d.value / data[i - 1].value) * 100) : null;
        return (
          <div key={d.stage} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
              <span style={{ color: '#595959' }}>{d.stage}</span>
              <span style={{ fontWeight: 700 }}>
                {fmt(d.value)} <span style={{ color: '#8c8c8c', fontWeight: 400 }}>({ofFirst}%)</span>
              </span>
            </div>
            <div style={{ height: 22, background: '#f0f2f5', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(3, (d.value / max) * 100)}%`, height: '100%', background: `linear-gradient(90deg, ${C.bar}, ${C.barTo})`, borderRadius: 6 }} />
            </div>
            {step != null && (
              <div style={{ fontSize: 12, color: step < 50 ? '#eb6834' : '#8c8c8c', marginTop: 3 }}>
                ↳ 직전 단계 대비 <b>{step}%</b> 전환
              </div>
            )}
          </div>
        );
      })}
      <Text type="secondary" style={{ fontSize: 12 }}>* 각 단계를 1회 이상 거친 사용자(기기) 수. 설치는 기간 내 새로 설치한 기기만 잡히므로 기존 사용자가 많으면 다음 단계가 더 클 수 있습니다.</Text>
    </div>
  );
}

// ── WoW 증감 카드 ──────────────────────────────────────────────────
function WowCard({ m }) {
  const up = m.deltaPct >= 0;
  return (
    <SoftCard>
      <Statistic title={m.metric} value={m.current} groupSeparator="," valueStyle={{ fontWeight: 700 }} />
      <div style={{ marginTop: 4, fontSize: 13, color: up ? '#0ca30c' : '#d03b3b' }}>
        {up ? '▲' : '▼'} {Math.abs(m.deltaPct)}%{' '}
        <span style={{ color: '#8c8c8c' }}>vs 전기간 {fmt(m.prev)}</span>
      </div>
    </SoftCard>
  );
}

export default function Analytics() {
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');
  const [mock, setMock] = useState(false); // [MOCK] 데모 데이터 토글
  const [userStats, setUserStats] = useState({ data: null, error: null });

  const load = useCallback(async (r) => {
    setLoading(true);
    setError(null);
    try {
      const [start, end] = r || [];
      const params = {
        startDate: start ? start.format(DATE_FMT) : undefined,
        endDate: end ? end.format(DATE_FMT) : undefined,
      };
      // DB 가입자 통계는 GA 와 독립. GA 가 실패해도 가입자 카드는 보여 준다.
      fetchUserStats(params)
        .then((s) => setUserStats({ data: s, error: null }))
        .catch((e) => setUserStats({ data: null, error: e.response?.data?.message || e.message }));
      const overview = await fetchGaOverview(params);
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

  // [MOCK] 실데이터/목업 분기. 롤백 시 refresh 를 load 직접호출로 되돌리면 됨.
  const refresh = useCallback(
    (r, useMock) => {
      if (useMock) {
        setError(null);
        setLoading(false);
        const mockData = buildMockOverview(r);
        setData(mockData);
        setUserStats({ data: mockData.mockUserStats, error: null });
      } else {
        load(r);
      }
    },
    [load]
  );

  useEffect(() => {
    refresh(DEFAULT_RANGE, false);
  }, [refresh]);

  const totals = data?.userTotals || {};
  const keyEvents = data?.keyEventCounts || {};
  const retention = data?.retention || {};
  const dailyUsers = error ? [] : data?.dailyUsers || [];
  const topEvents = error ? [] : data?.topEvents || [];
  const topScreens = error ? [] : data?.topScreens || [];
  const platforms = error ? [] : data?.platforms || [];
  const searchTerms = error ? [] : data?.searchTerms || [];
  const channels = error ? [] : data?.channels || [];
  const rolling = error ? null : data?.activeUsersRolling;
  const db = userStats.data;

  const isNotConfigured = error?.code === 'GA_NOT_CONFIGURED';
  const stat = (v) => (error ? '-' : v ?? 0);
  const pctVal = (v) => (error || v == null ? '-' : v);
  const pctSuffix = (v) => (error || v == null ? '' : '%');

  // ── 개요 탭 ──
  const signUpDelta = db ? db.newUsers - db.previousNewUsers : 0;
  const OverviewTab = (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <SoftCard title="가입자 (DB 기준 · 계정 단위)" size="small" extra={<Tag color="green">디스코드 주간 리포트와 같은 기준</Tag>}>
        {userStats.error ? (
          <Alert type="error" showIcon message="가입자 통계 조회 실패" description={userStats.error} />
        ) : (
          <Row gutter={[16, 16]}>
            <Col xs={12} md={6}><Statistic title="전체 가입자 (탈퇴·탈퇴 대기 제외)" value={db?.activeUsers ?? '-'} groupSeparator="," valueStyle={{ fontWeight: 700 }} /></Col>
            <Col xs={12} md={6}>
              <Statistic title="기간 내 신규 가입" value={db?.newUsers ?? '-'} groupSeparator="," valueStyle={{ fontWeight: 700 }} />
              {db && (
                <div style={{ fontSize: 13, color: signUpDelta >= 0 ? '#0ca30c' : '#d03b3b' }}>
                  {signUpDelta >= 0 ? '▲' : '▼'} {Math.abs(signUpDelta)} <span style={{ color: '#8c8c8c' }}>vs 직전 기간 {fmt(db.previousNewUsers)}</span>
                </div>
              )}
            </Col>
            <Col xs={12} md={6}><Statistic title="기간 내 탈퇴 요청" value={db?.withdrawnUsers ?? '-'} groupSeparator="," valueStyle={{ fontWeight: 700 }} /></Col>
            <Col xs={12} md={6}>
              <Statistic title="가입 경로" value={db ? db.signUpMethods.map((m) => `${m.provider} ${m.count}`).join(' · ') || '-' : '-'} valueStyle={{ fontSize: 16, fontWeight: 600 }} />
            </Col>
          </Row>
        )}
      </SoftCard>

      <Alert
        type="info"
        showIcon
        message="아래 GA 지표는 '사람'이 아니라 '기기(브라우저·앱 설치본)' 단위입니다"
        description="로그인·가입 여부와 무관하게 접속한 기기를 셉니다. 한 사람이 웹과 앱으로 들어오면 2로 잡히고, 둘러보기만 한 방문자도 포함되므로 위 가입자 수보다 큰 게 정상입니다."
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}><StatCard title="활성 사용자" value={stat(totals.activeUsers)} icon={<UserOutlined />} color={CAT[0]} /></Col>
        <Col xs={24} sm={8}><StatCard title="신규 사용자" value={stat(totals.newUsers)} icon={<UsergroupAddOutlined />} color={CAT[1]} /></Col>
        <Col xs={24} sm={8}><StatCard title="세션" value={stat(totals.sessions)} icon={<ThunderboltOutlined />} color="#4a3aa7" /></Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <SoftCard title="일별 사용자 추이" size="small">
            {dailyUsers.length === 0 ? (
              <EmptyCard />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={dailyUsers} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
                  <defs>
                    <linearGradient id="gActive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.active} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={C.active} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gNew" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.new} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={C.new} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={C.grid} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fill: C.axis, fontSize: 12 }} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={24} />
                  <YAxis tick={{ fill: C.axis, fontSize: 12 }} tickLine={false} axisLine={false} width={48} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
                  <Legend iconType="plainline" wrapperStyle={{ fontSize: 13 }} />
                  <Area type="monotone" dataKey="activeUsers" name="활성 사용자" stroke={C.active} strokeWidth={2.5} fill="url(#gActive)" activeDot={{ r: 4 }} />
                  <Area type="monotone" dataKey="newUsers" name="신규 사용자" stroke={C.new} strokeWidth={2.5} fill="url(#gNew)" activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </SoftCard>
        </Col>
        <Col xs={24} lg={8}>
          <SoftCard title="플랫폼별 활성 사용자" size="small">
            {platforms.length === 0 ? <EmptyCard /> : <Donut data={platforms} nameKey="platform" valueKey="activeUsers" centerLabel="활성 사용자" />}
          </SoftCard>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <SoftCard title="DAU · WAU · MAU" size="small" extra={rolling?.asOf && <Text type="secondary">{rolling.asOf} 기준</Text>}>
            {!rolling || rolling.daily?.length === 0 ? (
              <EmptyCard />
            ) : (
              <>
                <Row gutter={[16, 16]}>
                  <Col span={6}><Statistic title="DAU" value={rolling.dau} groupSeparator="," valueStyle={{ fontWeight: 700 }} /></Col>
                  <Col span={6}><Statistic title="WAU" value={rolling.wau} groupSeparator="," valueStyle={{ fontWeight: 700 }} /></Col>
                  <Col span={6}><Statistic title="MAU" value={rolling.mau} groupSeparator="," valueStyle={{ fontWeight: 700 }} /></Col>
                  <Col span={6}><Statistic title="고착도 (DAU/MAU)" value={rolling.stickiness ?? '-'} suffix={rolling.stickiness != null ? '%' : ''} valueStyle={{ fontWeight: 700, color: CAT[0] }} /></Col>
                </Row>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={rolling.daily} margin={{ top: 12, right: 16, bottom: 4, left: -8 }}>
                    <CartesianGrid stroke={C.grid} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fill: C.axis, fontSize: 12 }} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={24} />
                    <YAxis tick={{ fill: C.axis, fontSize: 12 }} tickLine={false} axisLine={false} width={48} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
                    <Legend iconType="plainline" wrapperStyle={{ fontSize: 13 }} />
                    <Area type="monotone" dataKey="mau" name="MAU" stroke={CAT[2]} strokeWidth={2} fillOpacity={0} />
                    <Area type="monotone" dataKey="wau" name="WAU" stroke={CAT[1]} strokeWidth={2} fillOpacity={0} />
                    <Area type="monotone" dataKey="dau" name="DAU" stroke={CAT[0]} strokeWidth={2} fillOpacity={0} />
                  </AreaChart>
                </ResponsiveContainer>
              </>
            )}
          </SoftCard>
        </Col>
        <Col xs={24} lg={12}>
          <SoftCard title="유입 채널 (세션 기준)" size="small">
            {channels.length === 0 ? (
              <EmptyCard />
            ) : (
              <HBar data={channels} nameKey="channel" valueKey="sessions" valueName="세션" gid="gCh" />
            )}
          </SoftCard>
        </Col>
      </Row>

      {db?.dailySignUps?.length > 0 && (
        <SoftCard title="일별 신규 가입 (DB) vs 신규 사용자 (GA)" size="small">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={db.dailySignUps.map((d) => ({
                date: d.date,
                signUps: d.count,
                gaNew: dailyUsers.find((u) => u.date === d.date)?.newUsers ?? null,
              }))}
              margin={{ top: 8, right: 16, bottom: 4, left: -8 }}
            >
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fill: C.axis, fontSize: 12 }} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={24} />
              <YAxis tick={{ fill: C.axis, fontSize: 12 }} tickLine={false} axisLine={false} width={48} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Bar dataKey="gaNew" name="신규 사용자 (GA·기기)" fill={C.barTo} radius={[4, 4, 0, 0]} maxBarSize={14} />
              <Bar dataKey="signUps" name="신규 가입 (DB·계정)" fill={CAT[1]} radius={[4, 4, 0, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </SoftCard>
      )}

      <SoftCard title="재방문율 (선택 기간 코호트)" size="small">
        {retention?.error && !error && <Alert style={{ marginBottom: 12 }} type="warning" showIcon message="재방문율을 계산할 데이터가 부족합니다" />}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}><Statistic title="D1 재방문율" value={pctVal(retention.d1)} suffix={pctSuffix(retention.d1)} valueStyle={{ color: CAT[0], fontWeight: 700 }} /></Col>
          <Col xs={24} sm={8}><Statistic title="D7 재방문율" value={pctVal(retention.d7)} suffix={pctSuffix(retention.d7)} valueStyle={{ color: '#256abf', fontWeight: 700 }} /></Col>
          <Col xs={24} sm={8}><Statistic title="D30 재방문율" value={pctVal(retention.d30)} suffix={pctSuffix(retention.d30)} valueStyle={{ color: '#184f95', fontWeight: 700 }} /></Col>
        </Row>
        <Text type="secondary" style={{ fontSize: 12 }}>
          코호트 기준 인원 {error ? '-' : (retention.totalUsers ?? 0).toLocaleString()}명 · 최근 가입자는 아직 D30에 도달하지 않아 과소집계될 수 있습니다.
        </Text>
      </SoftCard>
    </Space>
  );

  // ── 이벤트 탭 ──
  const app = error ? {} : data?.appEventCounts || {};
  const appCards = [
    { title: '설치 (first_open)', value: app.firstOpen, icon: <AppstoreOutlined />, color: CAT[0] },
    { title: '탐색 화면 진입', value: app.explorationViews, icon: <EyeOutlined />, color: CAT[4] },
    { title: '매장 상세 조회', value: app.storeDetailViews, icon: <EyeOutlined />, color: CAT[0] },
    { title: '검색 (search)', value: app.search, icon: <SearchOutlined />, color: CAT[3] },
    { title: '검색 결과 탭', value: app.searchResultTaps, icon: <SearchOutlined />, color: CAT[2], dim: true },
    { title: '공유 버튼 탭', value: app.shareTaps, icon: <ShareAltOutlined />, color: CAT[1], dim: true },
  ];
  const pendingCards = [
    { title: 'sign_up (가입)', value: keyEvents.sign_up, icon: <UserAddOutlined /> },
    { title: 'login (로그인)', value: keyEvents.login, icon: <LoginOutlined /> },
    { title: 'guest_login (둘러보기)', value: keyEvents.guest_login, icon: <IdcardOutlined /> },
    { title: 'add_bookmark (찜)', value: keyEvents.add_bookmark, icon: <StarOutlined /> },
    { title: 'review_submit (후기)', value: keyEvents.review_submit, icon: <CommentOutlined /> },
    { title: 'push_open (푸시 열람)', value: keyEvents.push_open, icon: <BellOutlined /> },
  ];
  const EventsTab = (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <SoftCard title="앱에서 수집 중인 이벤트" size="small" extra={<Tag color="green">iOS · Android 공통</Tag>}>
        <Row gutter={[16, 16]}>
          {appCards.map((c) => (
            <Col xs={24} sm={12} lg={8} key={c.title}>
              <StatCard title={c.title} value={c.value == null && !error ? '등록 대기' : stat(c.value)} icon={c.icon} color={c.color} />
            </Col>
          ))}
        </Row>
        <Text type="secondary" style={{ fontSize: 12 }}>
          탭 수치는 GA4 맞춤 측정기준 element_name 등록 후 표시됩니다.
        </Text>
      </SoftCard>
      <SoftCard title="앱 계측 대기 이벤트" size="small" extra={<Tag color="orange">앱 작업 필요</Tag>}>
        <Row gutter={[16, 16]}>
          {pendingCards.map((c) => (
            <Col xs={24} sm={12} lg={8} key={c.title}>
              <StatCard title={c.title} value={stat(c.value)} icon={c.icon} color="#8c8c8c" />
            </Col>
          ))}
        </Row>
      </SoftCard>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <SoftCard title="Top 이벤트" size="small">
            {topEvents.length === 0 ? <EmptyCard /> : <HBar data={topEvents} nameKey="eventName" valueKey="eventCount" valueName="발생 수" gid="gEv" />}
          </SoftCard>
        </Col>
        <Col xs={24} lg={12}>
          <SoftCard title="화면별 조회 TOP (screen_view)" size="small">
            {topScreens.length === 0 ? <EmptyCard /> : <HBar data={topScreens} nameKey="screenName" valueKey="views" valueName="조회 수" gid="gScr" />}
          </SoftCard>
        </Col>
      </Row>
    </Space>
  );

  // ── 매장·검색 탭 (B그룹) ──
  const ContentTab = (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <Alert
        type="info"
        showIcon
        message="이 탭 지표는 GA4 맞춤 측정기준 등록 후 채워집니다"
        description="필요한 측정기준(이벤트 범위): store_name, status, element_name, search_term, has_result. 앱은 이미 이 값을 보내고 있어 등록만 하면 그 이후 데이터부터 표시됩니다."
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <SoftCard title="검색어 TOP" size="small">
            {data?.searchTermsError && !error && (
              <Alert style={{ marginBottom: 12 }} type="warning" showIcon message="아직 데이터 없음" description="GA4 맞춤 측정기준(search_term) 등록 후 표시됩니다." />
            )}
            {searchTerms.length === 0 ? (
              <EmptyCard>{data?.searchTermsError ? '등록 대기' : '데이터 없음'}</EmptyCard>
            ) : (
              <HBar data={searchTerms} nameKey="searchTerm" valueKey="eventCount" valueName="검색 수" gid="gSch" />
            )}
          </SoftCard>
        </Col>
        <Col xs={24} lg={12}>
          <DimPanel
            title="매장 상세 조회 TOP"
            result={error ? null : data?.byStore && { ...data.byStore, rows: data.byStore.rows.slice(0, 10) }}
            valueName="조회 수"
            paramHint="store_name · screen_view(store_detail)"
            gid="gStore"
          />
        </Col>
        <Col xs={24} lg={12}>
          <DimPanel
            title="조회 시점 매장 상태"
            result={error ? null : withLabels(data?.byStatus, STATUS_LABEL)}
            valueName="조회 수"
            paramHint="status · screen_view(store_detail)"
            chart="donut"
          />
        </Col>
        <Col xs={24} lg={12}>
          <DimPanel
            title="탭 요소별"
            result={error ? null : withLabels(data?.byElement, ELEMENT_LABEL)}
            valueName="탭 수"
            paramHint="element_name · tap"
            gid="gEl"
          />
        </Col>
      </Row>
    </Space>
  );

  // ── 인사이트 탭 ──
  const insights = error ? null : data?.insights;
  const funnelData =
    insights?.funnel?.some((f) => f.value > 0) ? insights.funnel : [
      { stage: '설치 (first_open)', value: app.firstOpen || 0 },
      { stage: '탐색 화면 진입', value: app.explorationViews || 0 },
      { stage: '매장 상세 조회', value: app.storeDetailViews || 0 },
    ];
  const InsightsTab = (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      {!insights && (
        <Alert
          type="info"
          showIcon
          message="인사이트 지표는 앱 이벤트 계측 후 채워집니다"
          description="GA4 맞춤 측정기준 등록과 앱 이벤트 계측이 끝난 항목부터 자동으로 채워집니다. 명세는 docs/GA-계측-우선순위.md 참고."
        />
      )}

      <SoftCard title="전기간 대비 증감 (WoW)" size="small">
        {insights?.wow ? (
          <Row gutter={[16, 16]}>
            {insights.wow.map((m) => (
              <Col xs={24} sm={12} lg={6} key={m.metric}>
                <WowCard m={m} />
              </Col>
            ))}
          </Row>
        ) : (
          <PendingPanel hint="핵심 지표 전기간 대비 (자동수집 지표는 후속으로 실데이터 연결 가능)" />
        )}
      </SoftCard>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <SoftCard title="탐색 퍼널 (설치 → 탐색 → 매장 상세 → 공유)" size="small" extra={<Tag color="orange">가입 퍼널은 sign_up 계측 후</Tag>}>
            <Funnel data={funnelData} />
          </SoftCard>
        </Col>
        <Col xs={24} lg={12}>
          <SoftCard title="검색 실패율 (콘텐츠 소싱 우선순위)" size="small">
            {insights?.searchFail ? (
              <Row gutter={16} align="middle">
                <Col xs={24} sm={8}>
                  <Statistic title="검색 실패율" value={insights.searchFail.failRate} suffix="%" valueStyle={{ color: '#eb6834', fontWeight: 700 }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    실패 {fmt(insights.searchFail.failed)} / 전체 {fmt(insights.searchFail.total)}
                  </Text>
                  {insights.searchFail.resultClickRate != null && (
                    <Statistic
                      style={{ marginTop: 12 }}
                      title="결과 있는 검색 → 결과 탭"
                      value={insights.searchFail.resultClickRate}
                      suffix="%"
                      valueStyle={{ color: CAT[0], fontWeight: 700 }}
                    />
                  )}
                </Col>
                <Col xs={24} sm={16}>
                  <Text type="secondary" style={{ fontSize: 12 }}>결과 없는 검색어 (= 없는 매장)</Text>
                  <HBar data={insights.searchFail.terms} nameKey="name" valueKey="count" valueName="실패 검색" gid="gFail" />
                </Col>
              </Row>
            ) : (
              <PendingPanel hint="search + has_result + search_term" />
            )}
          </SoftCard>
        </Col>
      </Row>

      <SoftCard title="매장 조회 → 공유 전환" size="small">
        {insights?.contentConversion ? (
          <Table
            size="small"
            rowKey="name"
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            dataSource={insights.contentConversion.map((r) => ({
              ...r,
              shareRate: r.views ? Number(((r.shares / r.views) * 100).toFixed(1)) : 0,
            }))}
            columns={[
              { title: '매장', dataIndex: 'name' },
              { title: '상세 조회', dataIndex: 'views', align: 'right', render: fmt, defaultSortOrder: 'descend', sorter: (a, b) => a.views - b.views },
              { title: '공유 탭', dataIndex: 'shares', align: 'right', render: fmt, sorter: (a, b) => a.shares - b.shares },
              {
                title: '공유율',
                dataIndex: 'shareRate',
                align: 'right',
                sorter: (a, b) => a.shareRate - b.shareRate,
                render: (v) => <b style={{ color: v >= 10 ? '#0ca30c' : '#595959' }}>{v}%</b>,
              },
            ]}
          />
        ) : (
          <PendingPanel hint="store_name · element_name 맞춤 측정기준 등록" />
        )}
        <Text type="secondary" style={{ fontSize: 12 }}>찜·발도장 전환은 앱 이벤트가 없어 DB 기준(랭킹 페이지)으로 볼 예정</Text>
      </SoftCard>

      <SoftCard title="랜딩 → 다운로드 클릭" size="small">
        {insights && data?.landing ? (
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Statistic title="랜딩 방문 (landing_view)" value={data.landing.views} groupSeparator="," valueStyle={{ fontWeight: 700 }} />
              <Statistic style={{ marginTop: 12 }} title="다운로드 클릭 (click_download)" value={data.landing.downloads} groupSeparator="," valueStyle={{ fontWeight: 700 }} />
              <Statistic
                style={{ marginTop: 12 }}
                title="클릭률 (사용자 기준)"
                value={data.landing.viewUsers ? Number(((data.landing.downloadUsers / data.landing.viewUsers) * 100).toFixed(1)) : 0}
                suffix="%"
                valueStyle={{ fontWeight: 700, color: CAT[0] }}
              />
            </Col>
            <Col xs={24} md={16}>
              <Table
                size="small"
                rowKey="source"
                pagination={false}
                dataSource={data.landing.bySource.map((r) => ({ ...r, rate: r.views ? Number(((r.downloads / r.views) * 100).toFixed(1)) : 0 }))}
                columns={[
                  { title: '유입 (source / medium)', dataIndex: 'source' },
                  { title: '방문', dataIndex: 'views', align: 'right', render: fmt },
                  { title: '다운로드 클릭', dataIndex: 'downloads', align: 'right', render: fmt },
                  { title: '클릭률', dataIndex: 'rate', align: 'right', render: (v) => `${v}%` },
                ]}
              />
            </Col>
          </Row>
        ) : (
          <PendingPanel hint="랜딩(moree-landing) Firebase 가 같은 GA4 속성인지 확인" />
        )}
      </SoftCard>

      <SoftCard title="푸시 효과 (알림 유형별 열람)" size="small">
        {insights?.pushOpen?.byType?.length > 0 ? (
          <Row gutter={16} align="middle">
            <Col xs={24} sm={8}>
              <Statistic title="푸시 열람" value={insights.pushOpen.total} groupSeparator="," valueStyle={{ fontWeight: 700 }} />
            </Col>
            <Col xs={24} sm={16}>
              <HBar data={insights.pushOpen.byType} nameKey="name" valueKey="count" valueName="열람" gid="gPush" />
            </Col>
          </Row>
        ) : (
          <PendingPanel hint="push_open + notification_type" />
        )}
      </SoftCard>

      <SoftCard title="플랫폼별 재방문율" size="small">
        {insights?.segmentRetention ? (
          <Table
            size="small"
            rowKey="name"
            pagination={false}
            dataSource={insights.segmentRetention}
            columns={[
              { title: '세그먼트', dataIndex: 'name' },
              { title: 'D1', dataIndex: 'd1', align: 'right', render: (v) => `${v}%` },
              { title: 'D7', dataIndex: 'd7', align: 'right', render: (v) => `${v}%` },
              { title: 'D30', dataIndex: 'd30', align: 'right', render: (v) => `${v}%` },
            ]}
          />
        ) : (
          <PendingPanel hint="자동 수집 (데이터가 쌓이면 표시)" />
        )}
      </SoftCard>
    </Space>
  );

  return (
    <div>
      <PageTitle>GA 분석</PageTitle>
      <SubText>Firebase(GA4) 이벤트 기반 지표. 서버리스 함수(/api/ga)가 GA4 Data API 로 집계합니다.</SubText>

      <Space style={{ marginBottom: 16 }} wrap>
        <RangePicker value={range} allowClear={false} onChange={(r) => r && setRange(r)} disabledDate={(d) => d && d > dayjs().endOf('day')} />
        <Button type="primary" icon={<ReloadOutlined />} loading={loading} onClick={() => refresh(range, mock)}>조회</Button>
        {/* [MOCK] 데모 토글 */}
        <Segmented
          value={mock ? 'mock' : 'real'}
          onChange={(v) => {
            const m = v === 'mock';
            setMock(m);
            refresh(range, m);
          }}
          options={[
            { label: '실데이터', value: 'real' },
            { label: '목업', value: 'mock' },
          ]}
        />
        {mock && <Tag color="orange">목업 데이터</Tag>}
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
            { key: 'content', label: '매장·검색', children: ContentTab },
            { key: 'insights', label: '인사이트', children: InsightsTab },
          ]}
        />
      </Spin>
    </div>
  );
}
