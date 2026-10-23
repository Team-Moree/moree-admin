import { useCallback, useEffect, useState } from 'react';
import { Row, Col, Table, Segmented, Select, Tag, Avatar, Typography } from 'antd';
import dayjs from 'dayjs';
import { fetchExploreMetrics, fetchFandomCategories } from '../../api/dashboard';
import { SoftCard, Toolbar, HintText, ClickText, ErrorAlert, ReloadButton, formatDate, formatNumber, useRemote } from './ui';
import { FandomTargetDrawer, StoreDrawer } from './InsightDrawers';

const { Text } = Typography;

const STORE_SORTS = [
  { label: '발도장', value: 'STAMP' },
  { label: '뽑기', value: 'GACHA' },
  { label: '북마크', value: 'BOOKMARK' },
  { label: '리뷰', value: 'REVIEW' },
];

const num = (title, dataIndex) => ({ title, dataIndex, align: 'right', render: formatNumber });
const popupTag = (isPopup) => (isPopup ? <Tag color="magenta">팝업</Tag> : <Tag>상설</Tag>);

export default function ExploreTab() {
  const [storeSort, setStoreSort] = useState('STAMP');
  const [categoryId, setCategoryId] = useState();
  const [categories, setCategories] = useState([]);
  const [fandomTarget, setFandomTarget] = useState(null);
  const [store, setStore] = useState(null);

  const fetcher = useCallback(() => fetchExploreMetrics({ storeSort, categoryId }), [storeSort, categoryId]);
  const { data, loading, error, load } = useRemote(fetcher);

  useEffect(() => {
    fetchFandomCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const openStore = (r) => setStore({ id: r.storeId, title: r.title });
  const storeTitle = (title, r) => <ClickText onClick={() => openStore(r)}>{title}</ClickText>;

  const fandomColumns = [
    {
      title: '덕질 대상',
      dataIndex: 'name',
      render: (name, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar size={28} src={r.imageUrl || undefined}>
            {name?.[0]}
          </Avatar>
          <ClickText onClick={() => setFandomTarget({ id: r.fandomTargetId, name })}>{name}</ClickText>
        </div>
      ),
    },
    {
      title: '분야',
      dataIndex: 'categories',
      render: (cats) => (cats || []).map((c) => <Tag key={c}>{c}</Tag>),
    },
    num('팬', 'fans'),
  ];

  const storeColumns = [
    { title: '매장', dataIndex: 'title', render: storeTitle },
    { title: '유형', dataIndex: 'isPopup', render: popupTag, width: 70 },
    num('발도장', 'stamps'),
    num('뽑기', 'gachas'),
    num('북마크', 'bookmarks'),
    num('리뷰', 'reviews'),
  ];

  const folderColumns = [
    { title: '폴더', dataIndex: 'title' },
    { title: '만든 사람', dataIndex: 'ownerNickname' },
    num('복사', 'copyCount'),
    num('매장', 'storeCount'),
  ];

  const alarmColumns = [
    { title: '매장', dataIndex: 'title', render: storeTitle },
    { title: '오픈일', dataIndex: 'startDate', render: formatDate },
    num('알림 신청', 'alarms'),
  ];

  const newStoreColumns = [
    { title: '매장', dataIndex: 'title', render: storeTitle },
    { title: '유형', dataIndex: 'isPopup', render: popupTag, width: 70 },
    { title: '등록일', dataIndex: 'createdAt', render: (d) => (d ? dayjs(d).format('YYYY.MM.DD') : '-') },
    num('7일 북마크', 'bookmarks7d'),
    num('7일 발도장', 'stamps7d'),
  ];

  const table = (columns, rows, rowKey) => (
    <Table columns={columns} dataSource={rows || []} rowKey={rowKey} loading={loading} pagination={false} size="small" />
  );

  return (
    <div>
      <Toolbar>
        <Text type="secondary">이름을 누르면 상세가 열림</Text>
        <ReloadButton onClick={load} loading={loading} />
      </Toolbar>
      <ErrorAlert title="탐색 지표 조회 실패" error={error} />
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <SoftCard
            title="인기 덕질 대상"
            extra={
              <Select
                allowClear
                placeholder="전체 분야"
                style={{ width: 160 }}
                value={categoryId}
                onChange={setCategoryId}
                options={categories.map((c) => ({ value: c.fandomCategoryId, label: c.displayName }))}
              />
            }
          >
            {table(fandomColumns, data?.fandomTargets, 'fandomTargetId')}
            <HintText>팬 = 이 대상을 고른 회원 수</HintText>
          </SoftCard>
        </Col>
        <Col xs={24} xl={12}>
          <SoftCard
            title="인기 매장"
            extra={<Segmented size="small" options={STORE_SORTS} value={storeSort} onChange={setStoreSort} />}
          >
            {table(storeColumns, data?.stores, 'storeId')}
          </SoftCard>
        </Col>
        <Col xs={24} xl={12}>
          <SoftCard title="많이 복사된 공개 폴더">{table(folderColumns, data?.bookmarkFolders, 'folderId')}</SoftCard>
        </Col>
        <Col xs={24} xl={12}>
          <SoftCard title="오픈 알림 신청 많은 매장">{table(alarmColumns, data?.openAlarms, 'storeId')}</SoftCard>
        </Col>
        <Col span={24}>
          <SoftCard title="신규 매장 반응 (최근 30일 등록)">
            {table(newStoreColumns, data?.newStores, 'storeId')}
            <HintText>등록 후 7일 동안 쌓인 북마크·발도장</HintText>
          </SoftCard>
        </Col>
      </Row>
      <FandomTargetDrawer target={fandomTarget} onClose={() => setFandomTarget(null)} />
      <StoreDrawer store={store} onClose={() => setStore(null)} />
    </div>
  );
}
