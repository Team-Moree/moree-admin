import { useCallback, useEffect, useRef, useState } from 'react';
import { Row, Col, Table, Segmented, Select, Tag, Avatar, Typography } from 'antd';
import dayjs from 'dayjs';
import {
  fetchExploreFandomTargets,
  fetchExploreStores,
  fetchExploreBookmarkFolders,
  fetchExploreNewStores,
  fetchExploreOpenAlarms,
  fetchFandomCategories,
  searchFandomTargets,
  searchStores,
} from '../../api/dashboard';
import { SoftCard, Toolbar, HintText, ClickText, ErrorAlert, ReloadButton, formatDate, formatNumber, useRemote } from './ui';
import { FandomTargetDrawer, StoreDrawer } from './InsightDrawers';

const { Text } = Typography;

const PAGE_SIZE = 10;
const STORE_SORTS = [
  { label: '발도장', value: 'STAMP' },
  { label: '뽑기', value: 'GACHA' },
  { label: '북마크', value: 'BOOKMARK' },
  { label: '리뷰', value: 'REVIEW' },
];

const num = (title, dataIndex) => ({ title, dataIndex, align: 'right', render: formatNumber });
const popupTag = (isPopup) => (isPopup ? <Tag color="magenta">팝업</Tag> : <Tag>상설</Tag>);

function usePaged(fetchPage, deps, reloadKey) {
  const [page, setPage] = useState(0);
  useEffect(() => {
    setPage(0);
  }, deps);
  const fetcher = useCallback(() => fetchPage(page), [fetchPage, page]);
  const remote = useRemote(fetcher);
  const { load } = remote;
  useEffect(() => {
    if (reloadKey) load();
  }, [reloadKey, load]);
  const pagination = {
    current: page + 1,
    pageSize: PAGE_SIZE,
    total: remote.data?.total || 0,
    showSizeChanger: false,
    hideOnSinglePage: true,
    onChange: (p) => setPage(p - 1),
  };
  return { ...remote, pagination };
}

function PagedTable({ columns, rowKey, paged }) {
  return (
    <>
      <ErrorAlert title="조회 실패" error={paged.error} />
      <Table
        columns={columns}
        dataSource={paged.data?.items || []}
        rowKey={rowKey}
        loading={paged.loading}
        pagination={paged.pagination}
        size="small"
      />
    </>
  );
}

function SearchSelect({ placeholder, search, toOption, onPick }) {
  const [options, setOptions] = useState([]);
  const [fetching, setFetching] = useState(false);
  const timer = useRef();
  const onSearch = (text) => {
    clearTimeout(timer.current);
    if (!text.trim()) {
      setOptions([]);
      return;
    }
    timer.current = setTimeout(() => {
      setFetching(true);
      search(text.trim())
        .then((rows) => setOptions(rows.map(toOption)))
        .catch(() => setOptions([]))
        .finally(() => setFetching(false));
    }, 300);
  };
  return (
    <Select
      showSearch
      filterOption={false}
      placeholder={placeholder}
      style={{ width: '100%' }}
      value={null}
      options={options}
      loading={fetching}
      notFoundContent={fetching ? '검색 중…' : null}
      onSearch={onSearch}
      onSelect={(_, option) => onPick(option.item)}
    />
  );
}

export default function ExploreTab() {
  const [storeSort, setStoreSort] = useState('STAMP');
  const [categoryId, setCategoryId] = useState();
  const [categories, setCategories] = useState([]);
  const [fandomTarget, setFandomTarget] = useState(null);
  const [store, setStore] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    fetchFandomCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const fandomPage = useCallback(
    (page) => fetchExploreFandomTargets({ categoryId, page, size: PAGE_SIZE }),
    [categoryId],
  );
  const storePage = useCallback((page) => fetchExploreStores({ sort: storeSort, page, size: PAGE_SIZE }), [storeSort]);
  const folderPage = useCallback((page) => fetchExploreBookmarkFolders({ page, size: PAGE_SIZE }), []);
  const newStorePage = useCallback((page) => fetchExploreNewStores({ page, size: PAGE_SIZE }), []);

  const fandoms = usePaged(fandomPage, [categoryId], reloadKey);
  const stores = usePaged(storePage, [storeSort], reloadKey);
  const folders = usePaged(folderPage, [], reloadKey);
  const newStores = usePaged(newStorePage, [], reloadKey);
  const alarmsFetcher = useCallback(() => fetchExploreOpenAlarms({ limit: 20 }), []);
  const alarms = useRemote(alarmsFetcher);

  const reload = () => {
    setReloadKey((k) => k + 1);
    alarms.load();
  };
  const anyLoading = fandoms.loading || stores.loading || folders.loading || newStores.loading || alarms.loading;

  const openStore = (r) => setStore({ id: r.storeId, title: r.title });
  const openFandom = (r) => setFandomTarget({ id: r.fandomTargetId, name: r.name });
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
          <ClickText onClick={() => openFandom(r)}>{name}</ClickText>
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

  return (
    <div>
      <Toolbar>
        <Text type="secondary">이름을 누르거나 검색하면 상세가 열림</Text>
        <ReloadButton onClick={reload} loading={anyLoading} />
      </Toolbar>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <SoftCard title="덕질 대상 분석" style={{ height: 'auto' }}>
            <SearchSelect
              placeholder="덕질 대상 이름 검색"
              search={searchFandomTargets}
              toOption={(t) => ({ value: t.fandomTargetId, label: t.name, item: t })}
              onPick={openFandom}
            />
            <HintText>이 대상 팬이 많이 간 매장, 팬이 같이 고른 덕질 대상</HintText>
          </SoftCard>
        </Col>
        <Col xs={24} xl={12}>
          <SoftCard title="매장 분석" style={{ height: 'auto' }}>
            <SearchSelect
              placeholder="매장 이름·주소 검색"
              search={searchStores}
              toOption={(s) => ({ value: s.storeId, label: `${s.title} · ${s.address}`, item: s })}
              onPick={openStore}
            />
            <HintText>방문 팬 구성, 주별 북마크·발도장·뽑기 추이 (영업 자료)</HintText>
          </SoftCard>
        </Col>
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
            <PagedTable columns={fandomColumns} rowKey="fandomTargetId" paged={fandoms} />
            <HintText>팬 = 이 대상을 고른 회원 수</HintText>
          </SoftCard>
        </Col>
        <Col xs={24} xl={12}>
          <SoftCard
            title="매장 랭킹"
            extra={<Segmented size="small" options={STORE_SORTS} value={storeSort} onChange={setStoreSort} />}
          >
            <PagedTable columns={storeColumns} rowKey="storeId" paged={stores} />
          </SoftCard>
        </Col>
        <Col xs={24} xl={12}>
          <SoftCard title="많이 복사된 공개 폴더">
            <PagedTable columns={folderColumns} rowKey="folderId" paged={folders} />
          </SoftCard>
        </Col>
        <Col xs={24} xl={12}>
          <SoftCard title="오픈 알림 신청 많은 매장">
            <ErrorAlert title="조회 실패" error={alarms.error} />
            <Table
              columns={alarmColumns}
              dataSource={alarms.data || []}
              rowKey="storeId"
              loading={alarms.loading}
              pagination={false}
              size="small"
            />
          </SoftCard>
        </Col>
        <Col span={24}>
          <SoftCard title="신규 매장 반응 (최근 30일 등록)">
            <PagedTable columns={newStoreColumns} rowKey="storeId" paged={newStores} />
            <HintText>등록 후 7일 동안 쌓인 북마크·발도장</HintText>
          </SoftCard>
        </Col>
      </Row>
      <FandomTargetDrawer target={fandomTarget} onClose={() => setFandomTarget(null)} />
      <StoreDrawer store={store} onClose={() => setStore(null)} />
    </div>
  );
}
