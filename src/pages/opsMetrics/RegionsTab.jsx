import { useCallback, useState } from 'react';
import { Row, Col, Table, Segmented, Spin, Typography } from 'antd';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { fetchRegionMetrics } from '../../api/dashboard';
import { SoftCard, Toolbar, HintText, COLORS, ErrorAlert, ReloadButton, formatDate, formatNumber, useRemote } from './ui';

const { Text } = Typography;

const DAY_OPTIONS = [
  { label: '30일', value: 30 },
  { label: '90일', value: 90 },
  { label: '365일', value: 365 },
];

const num = (title, dataIndex) => ({ title, dataIndex, align: 'right', render: formatNumber });

const columns = [
  { title: '국가', dataIndex: 'country', width: 70 },
  { title: '시·군·구', dataIndex: 'district' },
  num('발도장', 'stamps'),
  num('뽑기', 'gachas'),
  num('회원', 'users'),
];

export default function RegionsTab() {
  const [days, setDays] = useState(30);
  const fetcher = useCallback(() => fetchRegionMetrics({ days }), [days]);
  const { data, loading, error, load } = useRemote(fetcher);
  const top = (data?.districts || []).slice(0, 15);

  return (
    <div>
      <Toolbar>
        <Text type="secondary">
          {formatDate(data?.from)} ~ {formatDate(data?.to)} 발도장·뽑기 매장 주소 기준
        </Text>
        <div style={{ display: 'flex', gap: 8 }}>
          <Segmented options={DAY_OPTIONS} value={days} onChange={setDays} />
          <ReloadButton onClick={load} loading={loading} />
        </div>
      </Toolbar>
      <ErrorAlert title="지역 지표 조회 실패" error={error} />
      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <SoftCard title="활동 많은 지역 (상위 15)">
              <ResponsiveContainer width="100%" height={Math.max(240, top.length * 28)}>
                <BarChart data={top} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="district" width={150} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="stamps" name="발도장" stackId="a" fill={COLORS.green} />
                  <Bar dataKey="gachas" name="뽑기" stackId="a" fill={COLORS.orange} />
                </BarChart>
              </ResponsiveContainer>
            </SoftCard>
          </Col>
          <Col xs={24} lg={10}>
            <SoftCard title="요일별 발도장">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data?.weekdays || []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [formatNumber(v), '발도장']} />
                  <Bar dataKey="stamps" fill={COLORS.green} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <HintText>방문일(visited_date) 기준</HintText>
            </SoftCard>
          </Col>
          <Col span={24}>
            <SoftCard title="지역별 표 (상위 30)">
              <Table columns={columns} dataSource={data?.districts || []} rowKey="district" pagination={false} size="small" />
              <HintText>회원 = 그 지역에서 발도장·뽑기 한 회원 수 (중복 제외)</HintText>
            </SoftCard>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}
