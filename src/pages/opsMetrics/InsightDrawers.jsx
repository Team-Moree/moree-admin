import { useCallback } from 'react';
import { Drawer, Row, Col, Statistic, Table, Spin, Typography } from 'antd';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { fetchFandomTargetInsights, fetchStoreInsights } from '../../api/dashboard';
import { SoftCard, HintText, COLORS, ErrorAlert, formatDate, formatShort, formatNumber, formatRate, useRemote } from './ui';

const { Text } = Typography;

function FandomTargetInsights({ id }) {
  const fetcher = useCallback(() => fetchFandomTargetInsights(id), [id]);
  const { data, loading, error } = useRemote(fetcher);

  return (
    <Spin spinning={loading}>
      <ErrorAlert title="덕질 대상 인사이트 조회 실패" error={error} />
      {data && (
        <>
          <Statistic title="이 대상을 고른 회원" value={data.fans} suffix="명" />
          <SoftCard title="팬들이 발도장 찍은 매장" size="small" style={{ marginTop: 16, height: 'auto' }}>
            <Table
              dataSource={data.topStores || []}
              rowKey="storeId"
              pagination={false}
              size="small"
              columns={[
                { title: '매장', dataIndex: 'title' },
                { title: '방문 팬', dataIndex: 'fanVisitors', align: 'right', render: formatNumber },
              ]}
            />
          </SoftCard>
          <SoftCard title="같이 고른 덕질 대상" size="small" style={{ marginTop: 16, height: 'auto' }}>
            <Table
              dataSource={data.coLikedTargets || []}
              rowKey="fandomTargetId"
              pagination={false}
              size="small"
              columns={[
                { title: '덕질 대상', dataIndex: 'name' },
                { title: '겹치는 팬', dataIndex: 'sharedFans', align: 'right', render: formatNumber },
                { title: '비율', dataIndex: 'rate', align: 'right', render: formatRate },
              ]}
            />
            <HintText>비율 = 겹치는 팬 ÷ 이 대상 팬 수</HintText>
          </SoftCard>
        </>
      )}
    </Spin>
  );
}

const TOTALS = [
  { key: 'bookmarks', label: '북마크' },
  { key: 'stamps', label: '발도장' },
  { key: 'gachas', label: '뽑기' },
  { key: 'reviews', label: '리뷰' },
];

function StoreInsights({ id }) {
  const fetcher = useCallback(() => fetchStoreInsights(id, { weeks: 12 }), [id]);
  const { data, loading, error } = useRemote(fetcher);
  const weekly = (data?.weekly || []).map((w) => ({ ...w, label: formatShort(w.weekStart) }));

  return (
    <Spin spinning={loading}>
      <ErrorAlert title="매장 인사이트 조회 실패" error={error} />
      {data && (
        <>
          <Text type="secondary">{data.address}</Text>
          <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
            {TOTALS.map((t) => (
              <Col span={6} key={t.key}>
                <Statistic title={t.label} value={data.totals?.[t.key] ?? '-'} />
              </Col>
            ))}
          </Row>
          <SoftCard title="주별 추이 (최근 12주)" size="small" style={{ marginTop: 16, height: 'auto' }}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weekly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip labelFormatter={(_, payload) => `${formatDate(payload?.[0]?.payload?.weekStart)} 주`} />
                <Legend />
                <Line type="monotone" dataKey="bookmarks" name="북마크" stroke={COLORS.blue} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="stamps" name="발도장" stroke={COLORS.green} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="gachas" name="뽑기" stroke={COLORS.orange} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </SoftCard>
          <SoftCard title="방문 회원의 덕질 대상" size="small" style={{ marginTop: 16, height: 'auto' }}>
            <Table
              dataSource={data.visitorFandoms || []}
              rowKey="fandomTargetId"
              pagination={false}
              size="small"
              columns={[
                { title: '덕질 대상', dataIndex: 'name' },
                { title: '방문 회원', dataIndex: 'visitors', align: 'right', render: formatNumber },
                { title: '비율', dataIndex: 'rate', align: 'right', render: formatRate },
              ]}
            />
            <HintText>발도장·뽑기 한 회원 중 그 대상을 고른 비율</HintText>
          </SoftCard>
        </>
      )}
    </Spin>
  );
}

export function FandomTargetDrawer({ target, onClose }) {
  return (
    <Drawer title={target?.name} open={!!target} onClose={onClose} size={560} destroyOnHidden>
      {target && <FandomTargetInsights id={target.id} />}
    </Drawer>
  );
}

export function StoreDrawer({ store, onClose }) {
  return (
    <Drawer title={store?.title} open={!!store} onClose={onClose} size={640} destroyOnHidden>
      {store && <StoreInsights id={store.id} />}
    </Drawer>
  );
}
