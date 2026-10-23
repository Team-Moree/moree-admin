import { useCallback, useState } from 'react';
import { Row, Col, Segmented, Table, Spin, Button, Tag, Typography, Statistic, Alert } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ComposedChart, Line, Legend } from 'recharts';
import { fetchAppOpenHours, fetchPushMetrics, fetchPushTargets } from '../../api/dashboard';
import dayjs from 'dayjs';
import { SoftCard, Toolbar, HintText, COLORS, ErrorAlert, ReloadButton, formatDate, formatNumber, useRemote } from './ui';

const { Text } = Typography;

const DAY_OPTIONS = [
  { label: '7일', value: 7 },
  { label: '30일', value: 30 },
  { label: '90일', value: 90 },
];
const TARGET_TYPES = [
  { label: '북마크만 하고 안 간 매장 있음', value: 'BOOKMARKED_NOT_VISITED' },
  { label: '북마크한 매장이 종료됨', value: 'BOOKMARKED_CLOSED' },
];
const PAGE_SIZE = 50;

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename, rows) {
  const text = rows.map((r) => r.map(csvCell).join(',')).join('\n');
  const blob = new Blob([`﻿${text}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const PUSH_DAY_OPTIONS = [
  { label: '이번 주', value: 'week' },
  { label: '7일', value: 7 },
  { label: '30일', value: 30 },
];

const rateText = (rate, opened) => `${rate ?? 0}% (${formatNumber(opened)})`;

const pushColumns = [
  {
    title: '발송',
    dataIndex: 'firstSentAt',
    width: 120,
    render: (v, r) =>
      dayjs(v).format('M/D HH:mm') + (dayjs(r.lastSentAt).diff(dayjs(v), 'minute') >= 1 ? ` ~ ${dayjs(r.lastSentAt).format('HH:mm')}` : ''),
  },
  { title: '종류', dataIndex: 'typeLabel', width: 130, render: (v) => <Tag>{v}</Tag> },
  { title: '제목', dataIndex: 'title' },
  { title: '대상', dataIndex: 'sent', align: 'right', width: 70, render: formatNumber },
  { title: '도달', dataIndex: 'delivered', align: 'right', width: 70, render: formatNumber },
  { title: '클릭률', key: 'rate', align: 'right', width: 110, render: (_, r) => rateText(r.openRate, r.opened) },
];

function weekDays() {
  const dow = dayjs().day();
  return dow === 0 ? 7 : dow;
}

function SentPushes() {
  const [range, setRange] = useState('week');
  const days = range === 'week' ? weekDays() : range;
  const fetcher = useCallback(() => fetchPushMetrics({ days }), [days]);
  const { data, loading, error, load } = useRemote(fetcher);
  const hours = (data?.hours || []).map((h) => ({ ...h, label: `${h.hour}시` }));
  const noOpens = data && data.totals.delivered > 0 && data.totals.opened === 0;

  return (
    <SoftCard
      title="보낸 푸시"
      extra={
        <div style={{ display: 'flex', gap: 8 }}>
          <Segmented options={PUSH_DAY_OPTIONS} value={range} onChange={setRange} />
          <ReloadButton onClick={load} loading={loading} />
        </div>
      }
    >
      <ErrorAlert title="푸시 조회 실패" error={error} />
      {noOpens && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title="아직 클릭이 0건"
          description="앱이 푸시를 열 때 서버에 열림 기록을 보내야 클릭률이 잡힘. 앱 업데이트 전에는 0% 로 나옴."
        />
      )}
      <Spin spinning={loading}>
        {data && (
          <>
            <Row gutter={[16, 16]}>
              <Col xs={12} md={6}>
                <Statistic title="보낸 푸시" value={data.totals.sent} suffix="건" />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="도달" value={data.totals.delivered} suffix="건" />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="클릭" value={data.totals.opened} suffix="건" />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="클릭률" value={data.totals.openRate} precision={1} suffix="%" />
              </Col>
            </Row>
            <Table
              style={{ marginTop: 16 }}
              columns={pushColumns}
              dataSource={data.pushes}
              rowKey={(r) => `${r.pushType}-${r.title}-${r.firstSentAt}`}
              pagination={{ pageSize: 20, hideOnSinglePage: true }}
              size="small"
            />
            <SectionLabel>발송 시간대별 클릭률</SectionLabel>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={hours} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={1} />
                <YAxis yAxisId="count" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis yAxisId="rate" orientation="right" unit="%" domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v, name) => (name === '클릭률' ? [`${v}%`, name] : [`${formatNumber(v)}건`, name])}
                />
                <Legend />
                <Bar yAxisId="count" dataKey="delivered" name="도달" fill={COLORS.gray} radius={[3, 3, 0, 0]} />
                <Line yAxisId="rate" dataKey="openRate" name="클릭률" stroke={COLORS.purple} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        )}
      </Spin>
      <HintText>
        {formatDate(data?.from)} ~ {formatDate(data?.to)} · 같은 종류·제목·날짜로 묶음 · 클릭률 = 클릭 ÷ 도달 · 도달 = FCM 발송 성공
      </HintText>
    </SoftCard>
  );
}

function SectionLabel({ children }) {
  return <div style={{ margin: '20px 0 8px', fontWeight: 600 }}>{children}</div>;
}

function AppOpenHours() {
  const [days, setDays] = useState(30);
  const fetcher = useCallback(() => fetchAppOpenHours({ days }), [days]);
  const { data, loading, error, load } = useRemote(fetcher);
  const chartData = (data?.hours || []).map((h) => ({ ...h, label: `${h.hour}시` }));

  return (
    <SoftCard
      title="앱 접속 시간대"
      extra={
        <div style={{ display: 'flex', gap: 8 }}>
          <Segmented options={DAY_OPTIONS} value={days} onChange={setDays} />
          <ReloadButton onClick={load} loading={loading} />
        </div>
      }
    >
      <ErrorAlert title="접속 시간대 조회 실패" error={error} />
      <Spin spinning={loading}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={1} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => [`${formatNumber(v)}명`, '첫 접속']} />
            <Bar dataKey="count" fill={COLORS.blue} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Spin>
      <HintText>
        하루 첫 접속 시각 기준 (오픈 횟수 전체 아님) · {formatDate(data?.from)} ~ {formatDate(data?.to)}
      </HintText>
    </SoftCard>
  );
}

const targetColumns = [
  { title: 'userId', dataIndex: 'userId', width: 90 },
  { title: '닉네임', dataIndex: 'nickname', width: 160 },
  { title: '매장 수', dataIndex: 'storeCount', align: 'right', width: 90, render: formatNumber },
  {
    title: '매장 (최근 북마크 5개)',
    dataIndex: 'stores',
    render: (stores) => (stores || []).map((s) => <Tag key={s.storeId}>{s.title}</Tag>),
  },
];

function PushTargets() {
  const [type, setType] = useState(TARGET_TYPES[0].value);
  const [page, setPage] = useState(0);
  const fetcher = useCallback(() => fetchPushTargets({ type, page, size: PAGE_SIZE }), [type, page]);
  const { data, loading, error, load } = useRemote(fetcher);
  const users = data?.users || [];

  const handleDownload = () => {
    downloadCsv(`push-targets-${type}-p${page + 1}.csv`, [
      ['userId', 'nickname', 'storeCount'],
      ...users.map((u) => [u.userId, u.nickname, u.storeCount]),
    ]);
  };

  return (
    <SoftCard
      title="푸시 대상"
      extra={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<DownloadOutlined />} onClick={handleDownload} disabled={!users.length}>
            이 페이지 CSV
          </Button>
          <ReloadButton onClick={load} loading={loading} />
        </div>
      }
    >
      <Toolbar>
        <Segmented
          options={TARGET_TYPES}
          value={type}
          onChange={(v) => {
            setType(v);
            setPage(0);
          }}
        />
        <Text type="secondary">총 {formatNumber(data?.totalUsers)}명</Text>
      </Toolbar>
      <ErrorAlert title="푸시 대상 조회 실패" error={error} />
      <Table
        columns={targetColumns}
        dataSource={users}
        rowKey="userId"
        loading={loading}
        size="small"
        pagination={{
          current: page + 1,
          pageSize: PAGE_SIZE,
          total: data?.totalUsers || 0,
          showSizeChanger: false,
          onChange: (p) => setPage(p - 1),
        }}
      />
      <HintText>회원만 · 매장 수 많은 순 · CSV 는 지금 보는 페이지 유저만 (userId, nickname, storeCount)</HintText>
    </SoftCard>
  );
}

export default function PushTab() {
  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <SentPushes />
      </Col>
      <Col span={24}>
        <AppOpenHours />
      </Col>
      <Col span={24}>
        <PushTargets />
      </Col>
    </Row>
  );
}
