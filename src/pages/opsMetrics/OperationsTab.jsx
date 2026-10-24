import { useCallback, useEffect, useMemo, useState } from 'react';
import { Row, Col, Table, Typography, Drawer, Segmented, Tag, Avatar, Input } from 'antd';
import dayjs from 'dayjs';
import { fetchOperationsMetrics, fetchStoresByRequests, fetchFandomTargetRequests } from '../../api/dashboard';
import SupplyMap from './SupplyMap';
import { MemberDrawer, StoreDrawer } from './InsightDrawers';
import { SoftCard, Toolbar, HintText, ClickText, COLORS, ErrorAlert, ReloadButton, formatNumber, useRemote } from './ui';

const { Text } = Typography;

const num = (title, dataIndex) => ({ title, dataIndex, align: 'right', render: formatNumber });

const storeColumns = (openStore) => [
  {
    title: '매장',
    dataIndex: 'title',
    render: (title, r) => (
      <div>
        <ClickText onClick={() => openStore(r)}>{title}</ClickText>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.address}
          </Text>
        </div>
      </div>
    ),
  },
  num('수정 요청', 'editRequests'),
  num('신고', 'reports'),
  num('미처리', 'pending'),
  num('합계', 'total'),
];

const fandomColumns = [
  { title: '분야', dataIndex: 'category' },
  num('대기', 'pending'),
  num('승인', 'approved'),
  num('반려', 'rejected'),
];

const submissionColumns = [
  { title: '국가', dataIndex: 'country', width: 70 },
  { title: '지역', dataIndex: 'region' },
  num('대기', 'pending'),
  num('승인', 'approved'),
  num('반려', 'rejected'),
  num('숨김', 'hidden'),
];

const STORE_PAGE_SIZE = 10;
const DETAIL_PAGE_SIZE = 10;
const COUNTRIES = ['한국', '일본', '해외'];

const STATUS = {
  PENDING: { label: '대기', tag: 'orange', color: COLORS.orange },
  APPROVED: { label: '승인', tag: 'green', color: COLORS.green },
  REJECTED: { label: '반려', tag: 'red', color: COLORS.red },
  HIDDEN: { label: '숨김', tag: 'default', color: COLORS.gray },
};
const statusTag = (status) => <Tag color={STATUS[status]?.tag}>{STATUS[status]?.label || status}</Tag>;
const statusOptions = (statuses) => [
  { label: '전체', value: 'ALL' },
  ...statuses.map((s) => ({ label: STATUS[s].label, value: s })),
];
const formatDateTime = (d) => (d ? dayjs(d).format('YYYY.MM.DD HH:mm') : '-');
const submissionColorOf = (p) => STATUS[p.status]?.color || COLORS.gray;
const submissionLabelOf = (p) => `${STATUS[p.status]?.label || p.status} · ${p.creatorNickname || `회원 ${p.creatorId}`}`;

function FandomRequestList({ category }) {
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(0);
  const fetcher = useCallback(
    () =>
      fetchFandomTargetRequests({
        categoryId: category.categoryId ?? undefined,
        status: status === 'ALL' ? undefined : status,
        page,
        size: DETAIL_PAGE_SIZE,
      }),
    [category, status, page],
  );
  const { data, loading, error } = useRemote(fetcher);

  const columns = [
    {
      title: '덕질 대상',
      dataIndex: 'name',
      render: (name, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar size={28} src={r.imageUrl || undefined}>
            {name?.[0]}
          </Avatar>
          {name}
        </div>
      ),
    },
    { title: '상태', dataIndex: 'status', width: 70, render: statusTag },
    { title: '등록일', dataIndex: 'createdAt', width: 140, render: formatDateTime },
  ];

  return (
    <>
      <Segmented
        options={statusOptions(['PENDING', 'APPROVED', 'REJECTED'])}
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(0);
        }}
        style={{ marginBottom: 12 }}
      />
      <ErrorAlert title="덕질 대상 요청 조회 실패" error={error} />
      <Table
        columns={columns}
        dataSource={data?.items || []}
        rowKey="fandomTargetId"
        loading={loading}
        pagination={{
          current: page + 1,
          pageSize: DETAIL_PAGE_SIZE,
          total: data?.total || 0,
          showSizeChanger: false,
          onChange: (p) => setPage(p - 1),
        }}
        size="small"
      />
    </>
  );
}

function FandomRequestDrawer({ category, onClose }) {
  return (
    <Drawer title={`${category?.category} 덕질 대상 요청`} open={!!category} onClose={onClose} size={600} destroyOnHidden>
      {category && <FandomRequestList category={category} />}
    </Drawer>
  );
}

function SubmittedStores({ stores, region, onRegionChange }) {
  const [country, setCountry] = useState('한국');
  const [status, setStatus] = useState('ALL');
  const [keyword, setKeyword] = useState('');
  const [store, setStore] = useState(null);
  const [member, setMember] = useState(null);
  const openStore = useCallback((p) => setStore({ id: p.storeId, title: p.title }), []);

  useEffect(() => {
    const picked = region && stores.find((s) => s.region === region);
    if (picked) setCountry(picked.country);
  }, [region, stores]);

  const countryOptions = useMemo(
    () =>
      COUNTRIES.map((c) => ({
        label: `${c} ${formatNumber(stores.filter((s) => s.country === c).length)}`,
        value: c,
      })),
    [stores],
  );
  const points = useMemo(
    () =>
      stores.filter(
        (s) =>
          s.country === country && (!region || s.region === region) && (status === 'ALL' || s.status === status),
      ),
    [stores, country, region, status],
  );
  const listed = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return points;
    return points.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.address || '').toLowerCase().includes(q) ||
        (s.creatorNickname || '').toLowerCase().includes(q),
    );
  }, [points, keyword]);

  const columns = [
    {
      title: '매장',
      dataIndex: 'title',
      render: (title, r) => (
        <div>
          <ClickText onClick={() => setStore({ id: r.storeId, title })}>{title}</ClickText>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {r.address || '-'}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: '구분',
      dataIndex: 'isPopup',
      width: 70,
      render: (isPopup) => (isPopup ? <Tag color="magenta">팝업</Tag> : <Tag>상설</Tag>),
    },
    { title: '상태', dataIndex: 'status', width: 70, render: statusTag },
    { title: '지역', dataIndex: 'region', width: 90 },
    {
      title: '제보자',
      dataIndex: 'creatorNickname',
      width: 140,
      render: (n, r) => (
        <ClickText onClick={() => setMember({ id: r.creatorId, nickname: n })}>{n || `회원 ${r.creatorId}`}</ClickText>
      ),
    },
    { title: '제보일', dataIndex: 'createdAt', width: 140, render: formatDateTime },
  ];

  return (
    <SoftCard
      title={`제보 매장 ${region ? `· ${region}` : ''}`}
      extra={region && <ClickText onClick={() => onRegionChange(null)}>지역 선택 해제</ClickText>}
      style={{ height: 'auto' }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        <Segmented
          options={countryOptions}
          value={country}
          onChange={(c) => {
            setCountry(c);
            onRegionChange(null);
          }}
        />
        <Segmented options={statusOptions(['PENDING', 'APPROVED', 'REJECTED', 'HIDDEN'])} value={status} onChange={setStatus} />
      </div>
      <SupplyMap
        points={points}
        country={country}
        height={420}
        colorOf={submissionColorOf}
        labelOf={submissionLabelOf}
        fit
        onSelect={openStore}
      />
      <HintText>
        주황 = 대기 · 초록 = 승인 · 빨강 = 반려 · 회색 = 숨김 · 위 지역별 표에서 지역을 누르면 그 지역만 보여줌
      </HintText>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 8px' }}>
        <Text strong>목록 {formatNumber(listed.length)}개</Text>
        <Input.Search
          allowClear
          placeholder="매장명·주소·제보자 검색"
          onSearch={setKeyword}
          onChange={(e) => !e.target.value && setKeyword('')}
          style={{ width: 240 }}
        />
      </div>
      <Table
        columns={columns}
        dataSource={listed}
        rowKey="storeId"
        size="small"
        pagination={{ pageSize: DETAIL_PAGE_SIZE, showSizeChanger: false }}
      />
      <StoreDrawer store={store} onClose={() => setStore(null)} />
      <MemberDrawer member={member} onClose={() => setMember(null)} />
    </SoftCard>
  );
}

function StoresByRequests({ reloadKey }) {
  const [page, setPage] = useState(0);
  const fetcher = useCallback(() => fetchStoresByRequests({ page, size: STORE_PAGE_SIZE }), [page]);
  const { data, loading, error, load } = useRemote(fetcher);
  const [store, setStore] = useState(null);

  useEffect(() => {
    if (reloadKey) load();
  }, [reloadKey, load]);

  return (
    <SoftCard title="수정 요청·신고 많은 매장" extra={<Text type="secondary">총 {formatNumber(data?.totalStores)}곳</Text>}>
      <ErrorAlert title="매장 목록 조회 실패" error={error} />
      <Table
        columns={storeColumns((r) => setStore({ id: r.storeId, title: r.title }))}
        dataSource={data?.stores || []}
        rowKey="storeId"
        loading={loading}
        pagination={{
          current: page + 1,
          pageSize: STORE_PAGE_SIZE,
          total: data?.totalStores || 0,
          showSizeChanger: false,
          onChange: (p) => setPage(p - 1),
        }}
        size="small"
      />
      <StoreDrawer store={store} onClose={() => setStore(null)} />
    </SoftCard>
  );
}

export default function OperationsTab() {
  const { data, loading, error, load } = useRemote(fetchOperationsMetrics);
  const [reloadKey, setReloadKey] = useState(0);
  const [fandomCategory, setFandomCategory] = useState(null);
  const [region, setRegion] = useState(null);
  const clickableRow = (onClick) => (r) => ({ onClick: () => onClick(r), style: { cursor: 'pointer' } });

  return (
    <div>
      <Toolbar>
        <Text type="secondary">요청·제보 처리 현황</Text>
        <ReloadButton
          onClick={() => {
            load();
            setReloadKey((k) => k + 1);
          }}
          loading={loading}
        />
      </Toolbar>
      <ErrorAlert title="운영 지표 조회 실패" error={error} />
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <StoresByRequests reloadKey={reloadKey} />
        </Col>
        <Col xs={24} lg={12}>
          <SoftCard title="덕질 대상 등록 요청 (분야별)">
            <Table
              columns={fandomColumns}
              dataSource={data?.fandomTargetRequests || []}
              rowKey={(r) => r.categoryId ?? 'none'}
              loading={loading}
              pagination={false}
              size="small"
              onRow={clickableRow(setFandomCategory)}
            />
            <HintText>분야를 누르면 요청된 덕질 대상 목록을 보여줌</HintText>
          </SoftCard>
        </Col>
        <Col xs={24} lg={12}>
          <SoftCard title="매장 제보 (지역별)">
            <Table
              columns={submissionColumns}
              dataSource={data?.storeSubmissions || []}
              rowKey="region"
              loading={loading}
              pagination={false}
              size="small"
              onRow={clickableRow((r) => setRegion(r.region === region ? null : r.region))}
              rowClassName={(r) => (r.region === region ? 'ant-table-row-selected' : '')}
            />
            <HintText>앱에서 회원이 등록 요청한 매장 · 승인 상태별 · 지역을 누르면 아래 지도·목록에 반영</HintText>
          </SoftCard>
        </Col>
        {data && (
          <Col span={24}>
            <SubmittedStores stores={data.submittedStores || []} region={region} onRegionChange={setRegion} />
          </Col>
        )}
      </Row>
      <FandomRequestDrawer category={fandomCategory} onClose={() => setFandomCategory(null)} />
    </div>
  );
}
