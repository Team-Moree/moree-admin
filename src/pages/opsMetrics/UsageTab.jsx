import { useCallback, useState } from 'react';
import { Row, Col, Statistic, Table, Spin, Typography, DatePicker } from 'antd';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import dayjs from 'dayjs';
import { fetchUsageTime } from '../../api/ga';
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

const { Text } = Typography;
const { RangePicker } = DatePicker;

const MAX_DAYS = 92;
const SCREEN_LABELS = { exploration: '탐색(홈)', store_detail: '행사 상세' };

export function formatDuration(seconds) {
  if (seconds == null) return '-';
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}초`;
  return s === 0 ? `${m}분` : `${m}분 ${s}초`;
}

function defaultRange() {
  const to = dayjs().subtract(1, 'day');
  return [to.subtract(27, 'day'), to];
}

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

  const columns = [
    {
      title: '화면',
      dataIndex: 'screenName',
      render: (n) => (SCREEN_LABELS[n] ? `${SCREEN_LABELS[n]} (${n})` : n),
    },
    { title: '조회수', dataIndex: 'views', align: 'right', render: formatNumber },
    { title: '사용자', dataIndex: 'users', align: 'right', render: formatNumber },
    { title: '조회당 평균', dataIndex: 'secondsPerView', align: 'right', render: formatDuration },
    { title: '사용자당 평균', dataIndex: 'secondsPerUser', align: 'right', render: formatDuration },
  ];

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
              <Table columns={columns} dataSource={data.screens} rowKey="screenName" pagination={false} size="small" />
              <HintText>행사별 상세 체류 시간은 앱이 screen_view 에 store_id 를 보내야 볼 수 있음</HintText>
            </SoftCard>

            <HintText style={{ marginTop: 16 }}>
              GA4 기준 · 앱(iOS·Android)만, 랜딩 웹 제외 · 이용 시간은 앱이 화면에 떠 있던 시간(백그라운드 제외) ·
              미복귀율은 첫 방문 후 N일째 날 다시 오지 않은 비율
            </HintText>
          </>
        )}
        {!data && !error && <Text type="secondary">불러오는 중…</Text>}
      </Spin>
    </div>
  );
}
