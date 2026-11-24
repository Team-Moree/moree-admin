import { useCallback, useState } from 'react';
import { Row, Col, Statistic, Table, Spin, Typography, DatePicker, Alert, Progress, Tag } from 'antd';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import dayjs from 'dayjs';
import { fetchAppScreens } from '../../api/ga';
import {
  SoftCard,
  Toolbar,
  HintText,
  SectionTitle,
  COLORS,
  ErrorAlert,
  ReloadButton,
  formatDate,
  formatShort,
  formatNumber,
  formatRate,
  useRemote,
} from './ui';
import { formatDuration, SCREEN_LABELS } from './UsageTab';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const MAX_DAYS = 92;
const PLATFORM_LABELS = { iOS: 'iOS', IOS: 'iOS', Android: 'Android', ANDROID: 'Android' };
const WEBVIEW_SHORT = {
  webview_instagram: '인스타',
  webview_x: 'X',
  webview_homepage: '홈페이지',
  webview_reservation: '예약',
  webview_ticket: '티켓',
  webview_other: '기타',
  webview: '미상',
};

const screenLabel = (n) => (SCREEN_LABELS[n] ? `${SCREEN_LABELS[n]} (${n})` : n);
const countOrDash = (v) => (v == null ? '-' : formatNumber(v));

function defaultRange() {
  const to = dayjs().subtract(1, 'day');
  return [to.subtract(27, 'day'), to];
}

function Needs({ what }) {
  return (
    <Alert
      type="info"
      showIcon
      title={`GA4 맞춤 측정기준 ${what} 등록 후 표시`}
      description="관리 → 맞춤 정의 → 맞춤 측정기준(범위: 이벤트). 등록 이후 데이터부터 쌓임"
    />
  );
}

function Empty({ children = '기간 내 데이터 없음 (앱 1.4.0 배포 후 쌓임)' }) {
  return <Text type="secondary">{children}</Text>;
}

function FunnelCard({ funnel }) {
  const hasData = funnel.steps.some((s) => s.users > 0);
  const columns = [
    { title: '단계', dataIndex: 'label', render: (v, r) => <span title={r.screens.join(', ')}>{v}</span> },
    { title: '사용자', dataIndex: 'users', align: 'right', render: formatNumber },
    {
      title: '첫 단계 대비',
      dataIndex: 'rateFromFirst',
      width: 160,
      render: (v) => (v == null ? '-' : <Progress percent={Math.min(v, 100)} size="small" format={() => `${v}%`} />),
    },
    { title: '이전 단계 대비', dataIndex: 'rateFromPrev', align: 'right', render: formatRate },
    { title: '사용자당 체류', dataIndex: 'secondsPerUser', align: 'right', render: formatDuration },
  ];
  return (
    <SoftCard title={`${funnel.title} 단계별 도달`} size="small" style={{ height: 'auto' }}>
      {hasData ? (
        <Table columns={columns} dataSource={funnel.steps} rowKey="label" pagination={false} size="small" />
      ) : (
        <Empty />
      )}
    </SoftCard>
  );
}

export default function AppScreensTab() {
  const [range, setRange] = useState(defaultRange);
  const from = range[0].format('YYYY-MM-DD');
  const to = range[1].format('YYYY-MM-DD');
  const fetcher = useCallback(() => fetchAppScreens({ from, to }), [from, to]);
  const { data, loading, error, load } = useRemote(fetcher);
  const available = data?.available || {};

  const versionColumns = [
    { title: '버전', dataIndex: 'appVersion', render: (v, r) => (r.v140 ? <Tag color="blue">{v}</Tag> : v) },
    { title: '플랫폼', dataIndex: 'platform', render: (p) => PLATFORM_LABELS[p] || p },
    { title: '사용자', dataIndex: 'activeUsers', align: 'right', render: formatNumber },
    { title: '화면 조회', dataIndex: 'views', align: 'right', render: formatNumber },
    { title: '사용자당 이용', dataIndex: 'secondsPerUser', align: 'right', render: formatDuration },
  ];

  const explorationColumns = [
    { title: '시트', dataIndex: 'screenName', render: screenLabel },
    { title: '조회수', dataIndex: 'views', align: 'right', render: formatNumber },
    ...(available.entrance ? [{ title: '진입 수', dataIndex: 'entrances', align: 'right', render: countOrDash }] : []),
    { title: '사용자', dataIndex: 'users', align: 'right', render: formatNumber },
    { title: '조회당 체류', dataIndex: 'secondsPerView', align: 'right', render: formatDuration },
    { title: '사용자당 체류', dataIndex: 'secondsPerUser', align: 'right', render: formatDuration },
  ];

  const storeColumns = [
    { title: '#', key: 'rank', width: 48, render: (_, __, i) => i + 1 },
    { title: '행사', dataIndex: 'storeName', render: (v, r) => v || <Text type="secondary">store_id {r.storeId}</Text> },
    { title: 'store_id', dataIndex: 'storeId', width: 90 },
    { title: '조회수', dataIndex: 'views', align: 'right', render: formatNumber },
    ...(available.storeEntrance ? [{ title: '진입 수', dataIndex: 'entrances', align: 'right', render: countOrDash }] : []),
    { title: '사용자', dataIndex: 'users', align: 'right', render: formatNumber },
  ];

  const webviewTypeColumns = [
    { title: '링크 종류', dataIndex: 'screenName', render: screenLabel },
    { title: '진입', dataIndex: 'views', align: 'right', render: formatNumber },
    { title: '사용자', dataIndex: 'users', align: 'right', render: formatNumber },
    { title: '조회당 체류', dataIndex: 'secondsPerView', align: 'right', render: formatDuration },
  ];

  const webviewStoreColumns = [
    { title: '행사', dataIndex: 'storeName' },
    { title: '합계', dataIndex: 'total', align: 'right', render: formatNumber },
    {
      title: '종류별',
      dataIndex: 'byType',
      render: (byType) =>
        Object.entries(byType)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => (
            <Tag key={k}>
              {WEBVIEW_SHORT[k] || k} {formatNumber(v)}
            </Tag>
          )),
    },
  ];

  const returnColumns = [
    { title: '화면', dataIndex: 'screenName', render: screenLabel },
    { title: '전체 조회', dataIndex: 'views', align: 'right', render: formatNumber },
    { title: '진입', dataIndex: 'entrances', align: 'right', render: formatNumber },
    { title: '복귀', dataIndex: 'returns', align: 'right', render: formatNumber },
    { title: '복귀율', dataIndex: 'returnRate', align: 'right', render: formatRate },
  ];

  const loadDaily = (data?.loadStatus?.daily || []).map((d) => ({ ...d, label: formatShort(d.date) }));
  const webviewHasData = data?.webview?.byType?.some((r) => r.views > 0);

  return (
    <div>
      <Toolbar>
        <RangePicker
          value={range}
          allowClear={false}
          disabledDate={(d) => !d.isBefore(dayjs(), 'day')}
          onChange={(v) => {
            if (!v) return;
            const [start, end] = v;
            setRange(end.diff(start, 'day') + 1 > MAX_DAYS ? [end.subtract(MAX_DAYS - 1, 'day'), end] : v);
          }}
        />
        <ReloadButton onClick={load} loading={loading} />
      </Toolbar>
      <ErrorAlert title="앱 화면 지표 조회 실패" error={error} />
      <Spin spinning={loading}>
        {data && (
          <>
            <SectionTitle style={{ marginTop: 0 }}>앱 버전</SectionTitle>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={6}>
                <SoftCard>
                  <Statistic
                    title="1.4.0 이상 사용자 비율"
                    value={data.versions.v140UserShare ?? '-'}
                    suffix={data.versions.v140UserShare == null ? '' : '%'}
                  />
                  <HintText>1.4.0 부터 screen_view 기준이 바뀌어, 비율이 낮을 땐 아래 지표가 일부 사용자만 반영</HintText>
                </SoftCard>
              </Col>
              <Col xs={24} md={18}>
                <SoftCard size="small" style={{ height: 'auto' }}>
                  <Table
                    columns={versionColumns}
                    dataSource={data.versions.rows}
                    rowKey={(r) => `${r.appVersion}-${r.platform}`}
                    pagination={{ pageSize: 6, hideOnSinglePage: true }}
                    size="small"
                  />
                </SoftCard>
              </Col>
            </Row>

            <SectionTitle>단계별 이탈</SectionTitle>
            <Row gutter={[16, 16]}>
              {data.funnels.map((f) => (
                <Col xs={24} xl={f.key === 'store_registration' ? 24 : 12} key={f.key}>
                  <FunnelCard funnel={f} />
                </Col>
              ))}
            </Row>
            <HintText>
              단계 화면을 한 번이라도 본 사용자 수(순서 무관) · 화면명은 iOS·Android 명세 별칭을 합산(단계에 마우스를 올리면 화면명)
            </HintText>

            <SectionTitle>탐험 시트</SectionTitle>
            <SoftCard size="small" style={{ height: 'auto' }}>
              <Table columns={explorationColumns} dataSource={data.exploration} rowKey="screenName" pagination={false} size="small" />
              <HintText>
                1.4.0 시트별 화면 · store_detail 은 탐험 안 상세와 단독 상세를 합친 값 · 조회수는 복귀 포함
                {available.entrance ? '' : ' · 진입 수는 is_entrance 등록 후 표시'}
              </HintText>
            </SoftCard>

            <SectionTitle>행사별 상세 조회 TOP {data.stores?.length || ''}</SectionTitle>
            <SoftCard size="small" style={{ height: 'auto' }}>
              {!available.store ? (
                <Needs what="store_id · store_name" />
              ) : data.stores.length === 0 ? (
                <Empty />
              ) : (
                <Table columns={storeColumns} dataSource={data.stores} rowKey="storeId" pagination={{ pageSize: 10 }} size="small" />
              )}
              <HintText>행사별 체류 시간은 GA Data API 로는 나눌 수 없음(BigQuery export 필요)</HintText>
            </SoftCard>

            <SectionTitle>외부 링크 웹뷰</SectionTitle>
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={10}>
                <SoftCard title="링크 종류별" size="small" style={{ height: 'auto' }}>
                  {webviewHasData ? (
                    <Table columns={webviewTypeColumns} dataSource={data.webview.byType} rowKey="screenName" pagination={false} size="small" />
                  ) : (
                    <Empty>기간 내 데이터 없음 (앱 웹뷰 구현·1.4.0 배포 후 쌓임)</Empty>
                  )}
                </SoftCard>
              </Col>
              <Col xs={24} lg={14}>
                <SoftCard title="행사별" size="small" style={{ height: 'auto' }}>
                  {!available.webviewStore ? (
                    <Needs what="store_name" />
                  ) : data.webview.byStore.length === 0 ? (
                    <Empty>기간 내 데이터 없음</Empty>
                  ) : (
                    <Table columns={webviewStoreColumns} dataSource={data.webview.byStore} rowKey="storeName" pagination={{ pageSize: 10 }} size="small" />
                  )}
                </SoftCard>
              </Col>
            </Row>
            <HintText>webview_ticket 은 서버가 티켓 링크를 사전예약으로 저장해 당분간 webview_reservation 에 포함</HintText>

            <SectionTitle>행사 상세 로드 실패</SectionTitle>
            {!data.loadStatus ? (
              <Needs what="load_status" />
            ) : data.loadStatus.daily.length === 0 ? (
              <Empty />
            ) : (
              <Row gutter={[16, 16]}>
                <Col xs={24} md={6}>
                  <SoftCard>
                    <Statistic
                      title="상세 로드 실패율"
                      value={data.loadStatus.total.failRate ?? '-'}
                      suffix={data.loadStatus.total.failRate == null ? '' : '%'}
                      styles={{ content: { color: (data.loadStatus.total.failRate || 0) >= 1 ? COLORS.red : undefined } }}
                    />
                    <HintText>
                      실패 {formatNumber(data.loadStatus.total.fail)} / 전체 {formatNumber(data.loadStatus.total.success + data.loadStatus.total.fail)}
                    </HintText>
                  </SoftCard>
                </Col>
                <Col xs={24} md={18}>
                  <SoftCard title="일별 실패율 (%)" size="small" style={{ height: 'auto' }}>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={loadDaily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip
                          labelFormatter={(_, payload) => formatDate(payload?.[0]?.payload?.date)}
                          formatter={(v, name, item) => [`${v}% (실패 ${item.payload.fail})`, name]}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="failRate" name="실패율" stroke={COLORS.red} dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </SoftCard>
                </Col>
              </Row>
            )}

            <SectionTitle>화면별 복귀율</SectionTitle>
            <SoftCard size="small" style={{ height: 'auto' }}>
              {!data.returnRates ? (
                <Needs what="is_entrance" />
              ) : data.returnRates.length === 0 ? (
                <Empty />
              ) : (
                <Table columns={returnColumns} dataSource={data.returnRates} rowKey="screenName" pagination={false} size="small" />
              )}
              <HintText>복귀 = 위 화면을 닫고 돌아와 다시 보인 경우(is_entrance=0) · 높을수록 그 화면을 거점으로 오가는 화면</HintText>
            </SoftCard>

            <HintText style={{ marginTop: 16 }}>GA4 기준 · 운영 앱(iOS·Android)만, 랜딩 웹·dev·stg·prd(QA) 앱 제외</HintText>
          </>
        )}
        {!data && !error && <Text type="secondary">불러오는 중…</Text>}
      </Spin>
    </div>
  );
}
