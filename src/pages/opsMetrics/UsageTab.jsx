import { useCallback, useState } from 'react';
import { Row, Col, Statistic, Spin, Typography, DatePicker } from 'antd';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import dayjs from 'dayjs';
import { fetchUsageTime } from '../../api/ga';
import { IS_REAL } from '../../config/env';
import {
  SoftCard,
  Toolbar,
  HintText,
  COLORS,
  ErrorAlert,
  ReloadButton,
  formatDate,
  formatShort,
  formatNumber,
  useRemote,
} from './ui';
import { HBarChart, ChartOrTable, SERIES_COLORS } from './charts';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const MAX_DAYS = 92;
const EXPLORATION_ROW_KEY = '__exploration__';
export const SCREEN_LABELS = {
  exploration: '탐험 탭 (1.3.x 이하)',
  store_list: '탐험 행사 목록',
  store_search: '탐험 검색',
  gacha_list: '탐험 가챠 목록',
  store_detail: '행사 상세',
  gacha_draw: '가챠 뽑기',
  gacha_draw_result: '가챠 뽑기 결과',
  webview: '웹뷰 (종류 미상)',
  webview_instagram: '웹뷰 인스타그램',
  webview_x: '웹뷰 X',
  webview_homepage: '웹뷰 홈페이지',
  webview_pre_reservation: '웹뷰 사전예약',
  webview_community: '웹뷰 커뮤니티',
  webview_open_chat: '웹뷰 오픈채팅',
  webview_other: '웹뷰 기타',
  splash: '스플래시',
  intro: '인트로',
  login: '로그인',
  moree_pedia: '도감',
  my_home: '마이홈',
  user_home: '타인 홈',
  follow: '팔로우',
  stamp: '발도장',
  profile_edit: '프로필 수정',
  image_viewer: '이미지 뷰어',
  review: '리뷰 작성',
  bookmark: '북마크 폴더 선택',
  bookmark_folder: '북마크 폴더',
  bookmark_folder_form: '북마크 폴더 편집',
  settings: '설정',
};

export const SCOPE_HINTS = {
  production: '운영 앱(iOS·Android)만, 랜딩 웹·dev·stg·prd(QA) 앱 제외',
  dev: 'dev 앱(iOS·Android)만, 운영·stg·prd(QA) 앱·랜딩 웹 제외 · 오늘 데이터는 GA 반영이 몇 시간 늦음',
};

export function formatDuration(seconds) {
  if (seconds == null) return '-';
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}초`;
  return s === 0 ? `${m}분` : `${m}분 ${s}초`;
}

const durationLabel = (key) => ({ key, format: (v) => (v == null ? '' : formatDuration(v)) });

export function durationSeries(withEntrance) {
  return [
    { key: 'secondsPerView', name: '조회당', color: SERIES_COLORS[3], label: durationLabel('secondsPerView') },
    ...(withEntrance
      ? [{ key: 'secondsPerEntrance', name: '진입당', color: SERIES_COLORS[0], label: durationLabel('secondsPerEntrance') }]
      : []),
  ];
}

const lastSelectableDay = () => dayjs().subtract(IS_REAL ? 1 : 0, 'day');

export function defaultRange() {
  const to = lastSelectableDay();
  return [to.subtract(27, 'day'), to];
}

export const isAfterLastDay = (d) => d.isAfter(lastSelectableDay(), 'day');

function DurationCard({ title, seconds, hint }) {
  return (
    <SoftCard>
      <Statistic title={title} value={formatDuration(seconds)} />
      <HintText>{hint}</HintText>
    </SoftCard>
  );
}

function NonReturnCard({ day, rate }) {
  return (
    <SoftCard>
      <Statistic
        title={`D${day} 미복귀율`}
        value={rate?.nonReturnRate ?? '-'}
        precision={rate?.nonReturnRate == null ? undefined : 1}
        suffix={rate?.nonReturnRate == null ? '' : '%'}
      />
      <HintText>
        {rate
          ? `${formatDate(rate.cohortFrom)}~${formatDate(rate.cohortTo)} 첫 방문 ${formatNumber(rate.users)}명 중 ${day}일째 재방문 ${formatNumber(rate.returned)}명`
          : `기간이 짧아 ${day}일이 지난 첫 방문자가 없음`}
      </HintText>
    </SoftCard>
  );
}

export default function UsageTab() {
  const [range, setRange] = useState(defaultRange);
  const from = range[0].format('YYYY-MM-DD');
  const to = range[1].format('YYYY-MM-DD');
  const fetcher = useCallback(() => fetchUsageTime({ from, to }), [from, to]);
  const { data, loading, error, load } = useRemote(fetcher);

  const nonReturn = (day) => data?.nonReturn?.find((n) => n.day === day);
  const daily = (data?.daily || []).map((d) => ({
    ...d,
    label: formatShort(d.date),
    perUserMin: Math.round((d.secondsPerUser / 60) * 10) / 10,
    perSessionMin: Math.round((d.secondsPerSession / 60) * 10) / 10,
  }));

  const entranceAvailable = Boolean(data?.entranceAvailable);
  const screenRows = data
    ? [
        ...(data.exploration?.views ? [{ ...data.exploration, screenName: EXPLORATION_ROW_KEY }] : []),
        ...data.screens,
      ]
    : [];

  const SCREEN_CHART_LIMIT = 15;
  const screenChart = screenRows.slice(0, SCREEN_CHART_LIMIT).map((r) => ({
    ...r,
    name: r.screenName === EXPLORATION_ROW_KEY ? '탐험 탭 합계' : SCREEN_LABELS[r.screenName] || r.screenName,
  }));
  const hasPerEntrance = screenChart.some((r) => r.secondsPerEntrance != null);
  const viewSeries = [
    { key: 'views', name: '조회(복귀 포함)', color: SERIES_COLORS[2] },
    ...(entranceAvailable ? [{ key: 'entrances', name: '진입', color: SERIES_COLORS[0] }] : []),
  ];

  const columns = [
    {
      title: '화면',
      dataIndex: 'screenName',
      render: (n) => {
        if (n === EXPLORATION_ROW_KEY) return <Text strong>탐험 탭 합계 (상세 제외)</Text>;
        return SCREEN_LABELS[n] ? `${SCREEN_LABELS[n]} (${n})` : n;
      },
    },
    { title: '조회수', dataIndex: 'views', align: 'right', render: formatNumber },
    ...(entranceAvailable
      ? [{ title: '진입 수', dataIndex: 'entrances', align: 'right', render: (v) => (v == null ? '-' : formatNumber(v)) }]
      : []),
    { title: '사용자', dataIndex: 'users', align: 'right', render: formatNumber },
    { title: '조회당 평균', dataIndex: 'secondsPerView', align: 'right', render: formatDuration },
    ...(entranceAvailable
      ? [{ title: '진입당 평균', dataIndex: 'secondsPerEntrance', align: 'right', render: formatDuration }]
      : []),
    { title: '사용자당 평균', dataIndex: 'secondsPerUser', align: 'right', render: formatDuration },
  ];

  return (
    <div>
      <Toolbar>
        <RangePicker
          value={range}
          allowClear={false}
          disabledDate={isAfterLastDay}
          onChange={(v) => {
            if (!v) return;
            const [start, end] = v;
            setRange(end.diff(start, 'day') + 1 > MAX_DAYS ? [end.subtract(MAX_DAYS - 1, 'day'), end] : v);
          }}
        />
        <ReloadButton onClick={load} loading={loading} />
      </Toolbar>
      <ErrorAlert title="체류 시간 조회 실패" error={error} />
      <Spin spinning={loading}>
        {data && (
          <>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={6}>
                <DurationCard
                  title="1인당 일평균 이용 시간"
                  seconds={data.summary.avgDailySecondsPerUser}
                  hint={`하루 단위 활성 사용자 합 기준 · 기간 내 사용자 ${formatNumber(data.summary.activeUsers)}명`}
                />
              </Col>
              <Col xs={24} md={6}>
                <DurationCard
                  title="평균 세션 시간"
                  seconds={data.summary.avgSecondsPerSession}
                  hint={`세션 ${formatNumber(data.summary.sessions)}회`}
                />
              </Col>
              <Col xs={24} md={6}>
                <NonReturnCard day={7} rate={nonReturn(7)} />
              </Col>
              <Col xs={24} md={6}>
                <NonReturnCard day={30} rate={nonReturn(30)} />
              </Col>
            </Row>

            <SoftCard title="일별 이용 시간 (분)" style={{ marginTop: 16, height: 'auto' }}>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    labelFormatter={(_, payload) => formatDate(payload?.[0]?.payload?.date)}
                    formatter={(v, name) => [`${v}분`, name]}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="perUserMin" name="1인당" stroke={COLORS.blue} dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="perSessionMin" name="세션당" stroke={COLORS.green} dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </SoftCard>

            <SoftCard title="화면별 체류 시간" style={{ marginTop: 16, height: 'auto' }}>
              <ChartOrTable
                columns={columns}
                dataSource={screenRows}
                rowKey="screenName"
                chart={
                  <Row gutter={[16, 16]}>
                    <Col xs={24} lg={13}>
                      <Text strong>조회 수 TOP {SCREEN_CHART_LIMIT}</Text>
                      <HBarChart data={screenChart} categoryKey="name" series={viewSeries} formatValue={formatNumber} />
                    </Col>
                    <Col xs={24} lg={11}>
                      <Text strong>{hasPerEntrance ? '조회당·진입당 평균 체류' : '조회당 평균 체류'}</Text>
                      <HBarChart
                        data={screenChart}
                        categoryKey="name"
                        series={durationSeries(hasPerEntrance)}
                        formatValue={formatDuration}
                        tooltipExtra={(r) => `사용자당 ${formatDuration(r.secondsPerUser)}`}
                        categoryWidth={120}
                      />
                    </Col>
                  </Row>
                }
              />
              <HintText>
                조회수는 다른 화면을 닫고 돌아온 복귀까지 포함(앱 1.4.0~) ·{' '}
                {entranceAvailable
                  ? '진입 수는 새로 연 경우(is_entrance=1)만, 1.4.0 이전 데이터는 0 · 진입당 평균은 1.4.0 이상 체류 시간 ÷ 진입 수'
                  : '진입 수는 GA4 맞춤 측정기준 is_entrance 등록 후 표시'}{' '}
                · 탐험 탭 합계는 exploration(1.3.x)과 store_list·store_search·gacha_list(1.4.0~)를 합친 값
              </HintText>
            </SoftCard>

            <HintText style={{ marginTop: 16 }}>
              GA4 기준 · {SCOPE_HINTS[data.scope] || SCOPE_HINTS.production} · 이용 시간은 앱이 화면에 떠 있던 시간(백그라운드 제외) ·
              미복귀율은 첫 방문 후 N일째 날 다시 오지 않은 비율
            </HintText>
          </>
        )}
        {!data && !error && <Text type="secondary">불러오는 중…</Text>}
      </Spin>
    </div>
  );
}
