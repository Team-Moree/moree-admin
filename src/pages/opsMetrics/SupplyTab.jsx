import { useCallback, useMemo, useState } from 'react';
import { Row, Col, Statistic, Table, Spin, Typography, Segmented, Input, Tag } from 'antd';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { fetchSupplyMetrics } from '../../api/dashboard';
import SupplyMap from './SupplyMap';
import { StoreDrawer } from './InsightDrawers';
import { SoftCard, Toolbar, ClickText, COLORS, ErrorAlert, ReloadButton, formatDate, formatNumber, useRemote } from './ui';

const { Text } = Typography;

const COUNTRIES = ['한국', '일본', '해외'];

const TYPES = [
  { label: '전체', value: 'ALL' },
  { label: '팝업', value: 'POPUP' },
  { label: '상설', value: 'STORE' },
];

const countOf = (r, type) => (type === 'POPUP' ? r.popups : type === 'STORE' ? r.stores : r.popups + r.stores);
const matchesType = (p, type) => type === 'ALL' || (type === 'POPUP') === p.isPopup;

const regionColumns = (type) =>
  [
    { title: '지역', dataIndex: 'region' },
    type !== 'STORE' && { title: '팝업', dataIndex: 'popups', align: 'right', render: formatNumber },
    type !== 'POPUP' && { title: '상설 매장', dataIndex: 'stores', align: 'right', render: formatNumber },
    type === 'ALL' && { title: '합계', key: 'total', align: 'right', render: (_, r) => formatNumber(r.popups + r.stores) },
  ].filter(Boolean);

const formatPeriod = (p) => (p.isPopup ? `${formatDate(p.startDate)} ~ ${formatDate(p.finishDate)}` : '-');

export default function SupplyTab() {
  const { data, loading, error, load } = useRemote(fetchSupplyMetrics);
  const [country, setCountry] = useState('한국');
  const [type, setType] = useState('ALL');
  const [keyword, setKeyword] = useState('');
  const [store, setStore] = useState(null);
  const openStore = useCallback((p) => setStore({ id: p.storeId, title: p.title }), []);

  const countryOptions = useMemo(
    () =>
      COUNTRIES.map((c) => {
        const count = (data?.regions || []).filter((r) => r.country === c).reduce((sum, r) => sum + countOf(r, type), 0);
        return { label: `${c} ${formatNumber(count)}`, value: c };
      }),
    [data, type],
  );
  const regions = useMemo(
    () =>
      (data?.regions || [])
        .filter((r) => r.country === country && countOf(r, type) > 0)
        .sort((a, b) => countOf(b, type) - countOf(a, type)),
    [data, country, type],
  );
  const points = useMemo(
    () => (data?.points || []).filter((p) => p.country === country && matchesType(p, type)),
    [data, country, type],
  );
  const listed = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return points;
    return points.filter((p) => p.title.toLowerCase().includes(q) || (p.address || '').toLowerCase().includes(q));
  }, [points, keyword]);

  const storeColumns = [
    {
      title: '매장',
      dataIndex: 'title',
      render: (title, r) => <ClickText onClick={() => setStore({ id: r.storeId, title })}>{title}</ClickText>,
    },
    {
      title: '구분',
      dataIndex: 'isPopup',
      width: 80,
      render: (isPopup) => (isPopup ? <Tag color="magenta">팝업</Tag> : <Tag>상설</Tag>),
    },
    { title: '지역', dataIndex: 'region', width: 100 },
    { title: '주소', dataIndex: 'address', ellipsis: true, render: (a) => a || '-' },
    {
      title: '기간',
      key: 'period',
      width: 200,
      render: (_, r) => formatPeriod(r),
      sorter: (a, b) => (a.finishDate || '9999').localeCompare(b.finishDate || '9999'),
    },
  ];
  const typeLabel = TYPES.find((t) => t.value === type).label;

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
            <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <Segmented options={countryOptions} value={country} onChange={setCountry} />
              <Segmented options={TYPES} value={type} onChange={setType} />
            </div>
            <SoftCard title={`${country} ${type === 'ALL' ? '매장' : typeLabel} 분포`} style={{ marginTop: 16, height: 'auto' }}>
              <SupplyMap points={points} country={country} onSelect={openStore} />
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
                      {type !== 'STORE' && <Bar dataKey="popups" name="팝업" stackId="a" fill={COLORS.pink} />}
                      {type !== 'POPUP' && <Bar dataKey="stores" name="상설 매장" stackId="a" fill={COLORS.blue} />}
                    </BarChart>
                  </ResponsiveContainer>
                </SoftCard>
              </Col>
              <Col xs={24} lg={10}>
                <SoftCard title="지역별 표">
                  <Table columns={regionColumns(type)} dataSource={regions} rowKey="region" pagination={false} size="small" />
                </SoftCard>
              </Col>
            </Row>
            <SoftCard
              title={`${country} ${type === 'ALL' ? '매장' : typeLabel} 목록 ${formatNumber(listed.length)}개`}
              extra={
                <Input.Search
                  allowClear
                  placeholder="매장명·주소 검색"
                  onSearch={setKeyword}
                  onChange={(e) => !e.target.value && setKeyword('')}
                  style={{ width: 220 }}
                />
              }
              style={{ marginTop: 16, height: 'auto' }}
            >
              <Table
                columns={storeColumns}
                dataSource={listed}
                rowKey="storeId"
                size="small"
                pagination={{ pageSize: 20, showSizeChanger: false }}
              />
            </SoftCard>
          </>
        )}
      </Spin>
      <StoreDrawer store={store} onClose={() => setStore(null)} />
    </div>
  );
}
