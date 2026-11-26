import { useCallback, useState } from 'react';
import { Row, Col, Statistic, Spin, Typography, DatePicker, Alert } from 'antd';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
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
import { formatDuration, durationSeries, defaultRange, isAfterToday, SCREEN_LABELS, SCOPE_HINTS } from './UsageTab';
import { HBarChart, ChartOrTable, SERIES_COLORS, NEUTRAL } from './charts';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const MAX_DAYS = 92;
const STORE_CHART_LIMIT = 15;
const PLATFORM_LABELS = { iOS: 'iOS', IOS: 'iOS', Android: 'Android', ANDROID: 'Android' };
const WEBVIEW_TYPES = [
  { key: 'webview_instagram', name: '인스타그램', color: SERIES_COLORS[0] },
  { key: 'webview_x', name: 'X', color: SERIES_COLORS[1] },
  { key: 'webview_homepage', name: '홈페이지', color: SERIES_COLORS[2] },
  { key: 'webview_pre_reservation', name: '사전예약', color: SERIES_COLORS[3] },
  { key: 'webview_community', name: '커뮤니티', color: SERIES_COLORS[4] },
  { key: 'webview_open_chat', name: '오픈채팅', color: SERIES_COLORS[5] },
  { key: 'webview_other', name: '기타', color: NEUTRAL },
  { key: 'webview', name: '미상', color: NEUTRAL },
];
const WEBVIEW_BY_KEY = Object.fromEntries(WEBVIEW_TYPES.map((t) => [t.key, t]));
const ENTRANCE_SERIES = { key: 'entrances', name: '진입', color: SERIES_COLORS[0] };

const screenLabel = (n) => SCREEN_LABELS[n] || n;
const screenLabelFull = (n) => (SCREEN_LABELS[n] ? `${SCREEN_LABELS[n]} (${n})` : n);
const truncate = (s, max = 14) => (s && s.length > max ? `${s.slice(0, max)}…` : s);
const pctLabel = (v) => (v == null ? '' : `${v}%`);
const countOrDash = (v) => (v == null ? '-' : formatNumber(v));

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

function Dot({ color, children }) {
  return (
    <span style={{ marginRight: 12, whiteSpace: 'nowrap' }}>
      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: color, marginRight: 4 }} />
      {children}
    </span>
  );
}

function FunnelCard({ funnel }) {
  const hasData = funnel.steps.some((s) => s.users > 0);
  const columns = [
    { title: '단계', dataIndex: 'label' },
    { title: '사용자', dataIndex: 'users', align: 'right', render: formatNumber },
    { title: '첫 단계 대비', dataIndex: 'rateFromFirst', align: 'right', render: formatRate },
    { title: '이전 단계 대비', dataIndex: 'rateFromPrev', align: 'right', render: formatRate },
    { title: '사용자당 체류', dataIndex: 'secondsPerUser', align: 'right', render: formatDuration },
  ];
  return (
    <SoftCard title={`${funnel.title} 단계별 도달 사용자`} size="small" style={{ height: 'auto' }}>
      {hasData ? (
        <ChartOrTable
          columns={columns}
          dataSource={funnel.steps}
          rowKey="label"
          chart={
            <HBarChart
              data={funnel.steps}
              categoryKey="label"
              series={[{ key: 'users', name: '사용자', color: SERIES_COLORS[0] }]}
              formatValue={formatNumber}
              label={{ key: 'rateFromFirst', format: pctLabel }}
              tooltipExtra={(s) => `이전 단계 대비 ${s.rateFromPrev ?? '-'}% · 사용자당 ${formatDuration(s.secondsPerUser)}`}
            />
          }
        />
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

  const versions = (data?.versions?.rows || []).slice(0, 12).map((v) => ({
    ...v,
    name: `${v.appVersion} · ${PLATFORM_LABELS[v.platform] || v.platform}`,
  }));

  const exploration = (data?.exploration || []).map((r) => ({ ...r, name: screenLabel(r.screenName) }));
  const explorationHasData = exploration.some((r) => r.views > 0);
  const explorationHasPerEntrance = exploration.some((r) => r.secondsPerEntrance != null);
  const explorationSeries = [
    { key: 'views', name: '조회(복귀 포함)', color: SERIES_COLORS[2] },
    ...(available.entrance ? [ENTRANCE_SERIES] : []),
  ];

  const stores = (data?.stores || []).map((s) => ({ ...s, name: truncate(s.storeName || `store_id ${s.storeId}`) }));
  const storeSeries = [
    { key: 'views', name: '조회(복귀 포함)', color: SERIES_COLORS[2] },
    ...(available.storeEntrance ? [ENTRANCE_SERIES] : []),
  ];

  const webviewTypes = (data?.webview?.byType || []).map((r) => ({
    ...r,
    name: WEBVIEW_BY_KEY[r.screenName]?.name || r.screenName,
  }));
  const webviewHasData = webviewTypes.some((r) => r.views > 0);
  const webviewStores = (data?.webview?.byStore || []).map((s) => ({
    name: truncate(s.storeName),
    storeName: s.storeName,
    total: s.total,
    ...s.byType,
  }));
  const webviewStoreSeries = WEBVIEW_TYPES.filter((t) => webviewStores.some((s) => s[t.key]));

  const returnRates = (data?.returnRates || []).map((r) => ({ ...r, name: screenLabel(r.screenName) }));
  const loadDaily = (data?.loadStatus?.daily || []).map((d) => ({ ...d, label: formatShort(d.date) }));

  return (
    <div>
      <Toolbar>
        <RangePicker
          value={range}
          allowClear={false}
          disabledDate={isAfterToday}
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
                <SoftCard title="버전·플랫폼별 사용자" size="small" style={{ height: 'auto' }}>
                  <ChartOrTable
                    rowKey="name"
                    dataSource={versions}
                    columns={[
                      { title: '버전 · 플랫폼', dataIndex: 'name' },
                      { title: '사용자', dataIndex: 'activeUsers', align: 'right', render: formatNumber },
                      { title: '화면 조회', dataIndex: 'views', align: 'right', render: formatNumber },
                      { title: '사용자당 이용', dataIndex: 'secondsPerUser', align: 'right', render: formatDuration },
                    ]}
                    chart={
                      <HBarChart
                        data={versions}
                        categoryKey="name"
                        series={[{ key: 'activeUsers', name: '사용자', color: SERIES_COLORS[0] }]}
                        colorOf={(v) => (v.v140 ? SERIES_COLORS[0] : NEUTRAL)}
                        formatValue={formatNumber}
                        label={{ key: 'activeUsers', format: formatNumber }}
                        tooltipExtra={(v) => `사용자당 ${formatDuration(v.secondsPerUser)}`}
                      />
                    }
                  />
                  <HintText>
                    <Dot color={SERIES_COLORS[0]}>1.4.0 이상</Dot>
                    <Dot color={NEUTRAL}>1.3.x 이하</Dot>
                  </HintText>
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
              막대 끝 % 는 첫 단계 대비 · 단계 화면을 한 번이라도 본 사용자 수(순서 무관) · 화면명은 iOS·Android 명세 별칭을 합산
              {available.pageName ? '' : ' · 1.4.0 가입·온보딩 단계는 page_name 등록 후 표시'}
            </HintText>

            <SectionTitle>탐험 시트</SectionTitle>
            {explorationHasData ? (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={14}>
                  <SoftCard title="조회·진입" size="small" style={{ height: 'auto' }}>
                    <ChartOrTable
                      rowKey="screenName"
                      dataSource={exploration}
                      columns={[
                        { title: '시트', dataIndex: 'screenName', render: screenLabelFull },
                        { title: '조회수', dataIndex: 'views', align: 'right', render: formatNumber },
                        { title: '진입 수', dataIndex: 'entrances', align: 'right', render: countOrDash },
                        { title: '사용자', dataIndex: 'users', align: 'right', render: formatNumber },
                      ]}
                      chart={
                        <HBarChart data={exploration} categoryKey="name" series={explorationSeries} formatValue={formatNumber} />
                      }
                    />
                  </SoftCard>
                </Col>
                <Col xs={24} lg={10}>
                  <SoftCard
                    title={explorationHasPerEntrance ? '조회당·진입당 평균 체류' : '조회당 평균 체류'}
                    size="small"
                    style={{ height: 'auto' }}
                  >
                    <HBarChart
                      data={exploration}
                      categoryKey="name"
                      series={durationSeries(explorationHasPerEntrance)}
                      formatValue={formatDuration}
                      tooltipExtra={(r) => `사용자당 ${formatDuration(r.secondsPerUser)}`}
                      categoryWidth={110}
                    />
                  </SoftCard>
                </Col>
              </Row>
            ) : (
              <Empty />
            )}
            <HintText>
              행사 상세는 탐험 안 상세와 단독 상세를 합친 값
              {available.entrance ? ' · 진입당 평균은 1.4.0 이상 체류 시간 ÷ 진입 수' : ' · 진입 수는 is_entrance 등록 후 표시'}
            </HintText>

            <SectionTitle>탐험 검색</SectionTitle>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <SoftCard>
                  <Statistic title="검색 실행" value={formatNumber(data.search.executions.count)} suffix="회" />
                  <HintText>사용자 {formatNumber(data.search.executions.users)}명 · search 이벤트 전체</HintText>
                </SoftCard>
              </Col>
              <Col xs={24} md={8}>
                <SoftCard>
                  {data.search.resultTaps ? (
                    <>
                      <Statistic title="검색 결과 탭" value={formatNumber(data.search.resultTaps.count)} suffix="회" />
                      <HintText>
                        사용자 {formatNumber(data.search.resultTaps.users)}명 · 검색 실행 대비 {formatRate(data.search.tapsPerSearch)}
                      </HintText>
                    </>
                  ) : (
                    <Needs what="element_name" />
                  )}
                </SoftCard>
              </Col>
            </Row>
            <HintText>검색 결과 탭은 element_name=search_result_item · 맞춤 측정기준 등록 이후 데이터부터 집계</HintText>

            <SectionTitle>행사별 상세 조회 TOP {STORE_CHART_LIMIT}</SectionTitle>
            <SoftCard size="small" style={{ height: 'auto' }}>
              {!available.store ? (
                <Needs what="store_id · store_name" />
              ) : stores.length === 0 ? (
                <Empty />
              ) : (
                <ChartOrTable
                  rowKey="storeId"
                  dataSource={stores}
                  columns={[
                    { title: '행사', dataIndex: 'storeName' },
                    { title: 'store_id', dataIndex: 'storeId' },
                    { title: '조회수', dataIndex: 'views', align: 'right', render: formatNumber },
                    { title: '진입 수', dataIndex: 'entrances', align: 'right', render: countOrDash },
                    { title: '사용자', dataIndex: 'users', align: 'right', render: formatNumber },
                  ]}
                  chart={
                    <HBarChart
                      data={stores.slice(0, STORE_CHART_LIMIT)}
                      categoryKey="name"
                      series={storeSeries}
                      formatValue={formatNumber}
                      tooltipExtra={(s) => `store_id ${s.storeId} · 사용자 ${formatNumber(s.users)}`}
                      categoryWidth={180}
                    />
                  }
                />
              )}
              <HintText>행사별 체류 시간은 GA Data API 로는 나눌 수 없음(BigQuery export 필요)</HintText>
            </SoftCard>

            <SectionTitle>외부 링크 웹뷰</SectionTitle>
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={10}>
                <SoftCard title="링크 종류별 진입" size="small" style={{ height: 'auto' }}>
                  {webviewHasData ? (
                    <ChartOrTable
                      rowKey="screenName"
                      dataSource={webviewTypes}
                      columns={[
                        { title: '링크 종류', dataIndex: 'screenName', render: screenLabelFull },
                        { title: '진입', dataIndex: 'views', align: 'right', render: formatNumber },
                        { title: '사용자', dataIndex: 'users', align: 'right', render: formatNumber },
                        { title: '조회당 체류', dataIndex: 'secondsPerView', align: 'right', render: formatDuration },
                      ]}
                      chart={
                        <HBarChart
                          data={webviewTypes}
                          categoryKey="name"
                          series={[{ key: 'views', name: '진입', color: SERIES_COLORS[0] }]}
                          colorOf={(r) => WEBVIEW_BY_KEY[r.screenName]?.color || NEUTRAL}
                          formatValue={formatNumber}
                          label={{ key: 'views', format: formatNumber }}
                          tooltipExtra={(r) => `조회당 ${formatDuration(r.secondsPerView)}`}
                          categoryWidth={90}
                        />
                      }
                    />
                  ) : (
                    <Empty>기간 내 데이터 없음 (앱 웹뷰 구현·1.4.0 배포 후 쌓임)</Empty>
                  )}
                </SoftCard>
              </Col>
              <Col xs={24} lg={14}>
                <SoftCard title="행사별 진입 (종류 누적)" size="small" style={{ height: 'auto' }}>
                  {!available.webviewStore ? (
                    <Needs what="store_name" />
                  ) : webviewStores.length === 0 ? (
                    <Empty>기간 내 데이터 없음</Empty>
                  ) : (
                    <ChartOrTable
                      rowKey="storeName"
                      dataSource={webviewStores}
                      columns={[
                        { title: '행사', dataIndex: 'storeName' },
                        { title: '합계', dataIndex: 'total', align: 'right', render: formatNumber },
                        ...webviewStoreSeries.map((t) => ({ title: t.name, dataIndex: t.key, align: 'right', render: countOrDash })),
                      ]}
                      chart={
                        <HBarChart
                          data={webviewStores.slice(0, STORE_CHART_LIMIT)}
                          categoryKey="name"
                          series={webviewStoreSeries}
                          stacked
                          formatValue={formatNumber}
                          label={{ key: 'total', format: formatNumber }}
                          categoryWidth={150}
                        />
                      }
                    />
                  )}
                </SoftCard>
              </Col>
            </Row>
            <HintText>webview_ticket 은 서버가 티켓 링크를 사전예약으로 저장해 당분간 예약에 포함</HintText>

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

            <SectionTitle>화면별 진입·복귀</SectionTitle>
            <SoftCard size="small" style={{ height: 'auto' }}>
              {!data.returnRates ? (
                <Needs what="is_entrance" />
              ) : returnRates.length === 0 ? (
                <Empty />
              ) : (
                <ChartOrTable
                  rowKey="screenName"
                  dataSource={returnRates}
                  columns={[
                    { title: '화면', dataIndex: 'screenName', render: screenLabelFull },
                    { title: '전체 조회', dataIndex: 'views', align: 'right', render: formatNumber },
                    { title: '진입', dataIndex: 'entrances', align: 'right', render: formatNumber },
                    { title: '복귀', dataIndex: 'returns', align: 'right', render: formatNumber },
                    { title: '복귀율', dataIndex: 'returnRate', align: 'right', render: formatRate },
                  ]}
                  chart={
                    <HBarChart
                      data={returnRates}
                      categoryKey="name"
                      series={[ENTRANCE_SERIES, { key: 'returns', name: '복귀', color: SERIES_COLORS[1] }]}
                      stacked
                      formatValue={formatNumber}
                      label={{ key: 'returnRate', format: pctLabel }}
                    />
                  }
                />
              )}
              <HintText>막대 끝 % 는 복귀율 · 복귀 = 위 화면을 닫고 돌아와 다시 보인 경우(is_entrance=0) · 복귀율이 높을수록 그 화면을 거점으로 오가는 화면</HintText>
            </SoftCard>

            <HintText style={{ marginTop: 16 }}>GA4 기준 · {SCOPE_HINTS[data.scope] || SCOPE_HINTS.production}</HintText>
          </>
        )}
        {!data && !error && <Text type="secondary">불러오는 중…</Text>}
      </Spin>
    </div>
  );
}
