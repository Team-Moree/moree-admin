import { useMemo, useState } from 'react';
import { Row, Col, Statistic, Table, Spin, Typography, Segmented } from 'antd';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { fetchSupplyMetrics } from '../../api/dashboard';
import SupplyMap from './SupplyMap';
import { SoftCard, Toolbar, COLORS, ErrorAlert, ReloadButton, formatDate, formatNumber, useRemote } from './ui';

const { Text } = Typography;

const COUNTRIES = ['한국', '일본', '해외'];

const columns = [
  { title: '지역', dataIndex: 'region' },
  { title: '팝업', dataIndex: 'popups', align: 'right', render: formatNumber },
  { title: '상설 매장', dataIndex: 'stores', align: 'right', render: formatNumber },
  { title: '합계', key: 'total', align: 'right', render: (_, r) => formatNumber(r.popups + r.stores) },
];

export default function SupplyTab() {
  const { data, loading, error, load } = useRemote(fetchSupplyMetrics);
  const [country, setCountry] = useState('한국');

  const countryOptions = useMemo(
    () =>
      COUNTRIES.map((c) => {
        const count = (data?.regions || []).filter((r) => r.country === c).reduce((sum, r) => sum + r.popups + r.stores, 0);
        return { label: `${c} ${formatNumber(count)}`, value: c };
      }),
    [data],
  );
  const regions = useMemo(() => (data?.regions || []).filter((r) => r.country === country), [data, country]);
  const points = useMemo(() => (data?.points || []).filter((p) => p.country === country), [data, country]);

  return (
    <div>
      <Toolbar>
        <Text type="secondary">
          이번 주 {formatDate(data?.from)} ~ {formatDate(data?.to)} 운영 중인 노출 매장
        </Text>
        <ReloadButton onClick={load} loading={loading} />
      </Toolbar>
      <ErrorAlert title="공급 지표 조회 실패" error={error} />
      <Spin spinning={loading && !data}>
        {data && (
          <>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={6}>
                <SoftCard>
                  <Statistic title="진행 중 팝업" value={data.totals?.popups} suffix="개" />
                </SoftCard>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <SoftCard>
                  <Statistic title="상설 매장" value={data.totals?.stores} suffix="개" />
                </SoftCard>
              </Col>
            </Row>
            <div style={{ marginTop: 16 }}>
              <Segmented options={countryOptions} value={country} onChange={setCountry} />
            </div>
            <SoftCard title={`${country} 매장 분포`} style={{ marginTop: 16, height: 'auto' }}>
              <SupplyMap points={points} country={country} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                분홍 = 팝업 · 파랑 = 상설 매장 · 국가는 매장 좌표 기준
              </Text>
            </SoftCard>
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col xs={24} lg={14}>
                <SoftCard title="지역별">
                  <ResponsiveContainer width="100%" height={Math.max(240, regions.length * 28)}>
                    <BarChart data={regions} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="region" width={110} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="popups" name="팝업" stackId="a" fill={COLORS.pink} />
                      <Bar dataKey="stores" name="상설 매장" stackId="a" fill={COLORS.blue} />
                    </BarChart>
                  </ResponsiveContainer>
                </SoftCard>
              </Col>
              <Col xs={24} lg={10}>
                <SoftCard title="지역별 표">
                  <Table columns={columns} dataSource={regions} rowKey="region" pagination={false} size="small" />
                </SoftCard>
              </Col>
            </Row>
          </>
        )}
      </Spin>
    </div>
  );
}
