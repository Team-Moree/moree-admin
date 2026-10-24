import { useCallback, useState } from 'react';
import { Row, Col, Segmented, Table, Spin, Button, Tag, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { fetchAppOpenHours, fetchPushTargets } from '../../api/dashboard';
import { SoftCard, Toolbar, HintText, COLORS, ErrorAlert, ReloadButton, ClickText, formatDate, formatNumber, useRemote } from './ui';
import { MemberDrawer } from './InsightDrawers';

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
        회원별 하루 첫 접속 시각 기준 (같은 날 여러 번 열어도 1번만 셈) · {formatDate(data?.from)} ~ {formatDate(data?.to)}
      </HintText>
    </SoftCard>
  );
}

const targetColumns = (openMember) => [
  { title: 'userId', dataIndex: 'userId', width: 90 },
  {
    title: '닉네임',
    dataIndex: 'nickname',
    width: 160,
    render: (n, r) => <ClickText onClick={() => openMember({ id: r.userId, nickname: n })}>{n}</ClickText>,
  },
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
  const [member, setMember] = useState(null);
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
        columns={targetColumns(setMember)}
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
      <MemberDrawer member={member} onClose={() => setMember(null)} />
    </SoftCard>
  );
}

export default function PushTab() {
  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <AppOpenHours />
      </Col>
      <Col span={24}>
        <PushTargets />
      </Col>
    </Row>
  );
}
