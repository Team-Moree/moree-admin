import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Table, Tag, Input, Avatar, Typography, Result, Button, App,
  Select, Space, Modal, Form, Descriptions, Checkbox,
} from 'antd';
import { SearchOutlined, EditOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import client from '../api/client';

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
`;

const STATUS_MAP = {
  APPROVED: { color: 'green', label: '승인' },
  PENDING: { color: 'orange', label: '대기' },
  REJECTED: { color: 'red', label: '거절' },
};

// 덕질 대상 유형. WORK(작품)는 작품 그 자체가 하나의 덕질 대상인 것이고,
// CHARACTER는 작품에 속한 개별 대상(캐릭터·인물)이다. 유형은 저장할 때 명시적으로 지정한다.
const TYPE_MAP = {
  WORK: { color: 'geekblue', label: '작품' },
  CHARACTER: { color: 'default', label: '캐릭터' },
};

// 구버전 응답(type 미포함) 호환: 값이 없으면 개별 대상(CHARACTER)으로 간주한다.
const targetTypeOf = (record) => record?.type || 'CHARACTER';

// 한 번에 받는 건수. 예전에는 100건씩 끝까지(5천 건 = 50여 번) 순차 호출해 화면이 몇 초씩 멈췄다.
// 스토어 화면과 같이 첫 페이지만 받고, 필요할 때 "더 불러오기"로 이어 받는다.
const PAGE_SIZE = 50;

const CATEGORY_COLORS = {
  CHARACTER: 'magenta',
  IDOL: 'purple',
  COMIC_ANIME: 'blue',
  GAME: 'green',
  WEBTOON_WEBNOVEL: 'cyan',
  BIRTHDAY_CAFE: 'orange',
  GACHA_SHOP: 'gold',
  DRAMA_MOVIE: 'red',
  ETC: 'default',
};

export default function FandomTargets() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(''); // 입력 중인 검색어
  const [searchKeyword, setSearchKeyword] = useState(undefined); // 서버에 적용된 검색어
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [typeFilter, setTypeFilter] = useState(undefined);
  const [noWorkOnly, setNoWorkOnly] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);

  // 수정 모달
  const [editTarget, setEditTarget] = useState(null);
  const [editName, setEditName] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editStatus, setEditStatus] = useState(null);
  const [editType, setEditType] = useState('CHARACTER');
  const [editCategoryIds, setEditCategoryIds] = useState([]);
  const [saving, setSaving] = useState(false);

  // 카테고리 목록
  const [categories, setCategories] = useState([]);

  const { notification } = App.useApp();

  const fetchCategories = async () => {
    try {
      const res = await client.get('/shared/fandom-category');
      const list = Array.isArray(res.data?.results) ? res.data.results : Array.isArray(res.data) ? res.data : [];
      setCategories(list);
    } catch {
      // 카테고리 로드 실패시 무시
    }
  };

  // 서버 커서 페이지네이션. 상태·유형·작품없음·검색은 모두 서버가 거르고,
  // 작품(WORK)을 앞에, 그 뒤로 id 오름차순으로 돌려주므로 그 순서를 그대로 보여준다.
  // append 가 true 면 "더 불러오기"로 다음 페이지를 이어 붙인다.
  const fetchData = useCallback(async ({
    cursor = '', status, type, noWork, search: keyword, append = false,
  } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = { next: cursor, size: PAGE_SIZE };
      if (status) params.status = status;
      if (type) params.type = type;
      // 소속 작품이 없는 대상만 보기 — 미분류 정리용이라 어드민 조회에만 있는 필터다.
      if (noWork) params.noWork = true;
      if (keyword) params.search = keyword;
      const res = await client.get('/admin/fandom-target', { params });
      const list = Array.isArray(res.data?.results) ? res.data.results : [];
      setData((prev) => (append ? [...prev, ...list] : list));
      setNextCursor(res.data?.next || null);
      setHasMore(!!res.data?.next);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '덕질 대상 조회 실패';
      setError(msg);
      notification.error({ message: '조회 실패', description: msg });
    } finally {
      setLoading(false);
    }
  }, [notification]);

  useEffect(() => {
    fetchData();
    fetchCategories();
  }, []);

  // 필터·검색어가 바뀌면 첫 페이지부터 다시 받아온다. setState 는 비동기라 바뀐 값을 직접 넘긴다.
  const reload = (override = {}) => fetchData({
    status: statusFilter,
    type: typeFilter,
    noWork: noWorkOnly,
    search: searchKeyword,
    ...override,
  });

  const handleStatusFilter = (value) => {
    setStatusFilter(value);
    reload({ status: value });
  };

  const handleTypeFilter = (value) => {
    setTypeFilter(value);
    reload({ type: value });
  };

  const handleNoWorkOnly = (checked) => {
    setNoWorkOnly(checked);
    reload({ noWork: checked });
  };

  // 검색은 서버가 이름·소스 부분 일치(대소문자 무시)로 처리한다. Enter/검색 버튼/지우기에서 적용된다.
  const handleSearch = (value) => {
    const trimmed = (value || '').trim();
    setSearch(trimmed);
    setSearchKeyword(trimmed || undefined);
    reload({ search: trimmed || undefined });
  };

  const handleLoadMore = () => {
    if (!nextCursor || loading) return;
    fetchData({
      cursor: nextCursor,
      status: statusFilter,
      type: typeFilter,
      noWork: noWorkOnly,
      search: searchKeyword,
      append: true,
    });
  };

  // 불러온 범위의 유형별 건수 (작품 승격으로 늘어난 대상 규모를 헤더에서 바로 확인)
  const typeCounts = useMemo(
    () => data.reduce((acc, item) => {
      const type = targetTypeOf(item);
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {}),
    [data],
  );

  const openEditModal = (record) => {
    setEditTarget(record);
    setEditName(record.name || '');
    setEditImageUrl(record.imageUrl || '');
    setEditSource(record.source || '');
    setEditStatus(record.status);
    setEditType(targetTypeOf(record));
    setEditCategoryIds(record.fandomCategories?.map((c) => c.fandomCategoryId) || []);
  };

  const handleSave = async () => {
    if (!editTarget) return;
    // 작품(WORK)은 그 자체가 소스라 소스를 갖지 않는다.
    const isWork = editType === 'WORK';
    setSaving(true);
    try {
      // 변경된 필드만 전송한다. 유형(type)은 서버가 자동으로 정하지 않으므로 여기서 명시적으로 보낸다.
      const patchBody = {};
      if (editName !== editTarget.name) patchBody.name = editName;
      if (editImageUrl !== (editTarget.imageUrl || '')) patchBody.imageUrl = editImageUrl;
      if (editType !== targetTypeOf(editTarget)) patchBody.type = editType;
      if (isWork) {
        // 캐릭터를 작품으로 바꾸면 남아 있던 소스를 비운다.
        if (editTarget.source) patchBody.source = '';
      } else if (editSource !== (editTarget.source || '')) {
        patchBody.source = editSource;
      }
      if (editStatus !== editTarget.status) patchBody.status = editStatus;

      if (Object.keys(patchBody).length > 0) {
        await client.patch(`/admin/fandom-target/${editTarget.fandomTargetId}`, patchBody);
      }

      // 카테고리 변경
      const originalIds = (editTarget.fandomCategories?.map((c) => c.fandomCategoryId) || []).sort().join(',');
      const newIds = [...editCategoryIds].sort().join(',');
      if (originalIds !== newIds) {
        await client.put(`/admin/fandom-target/${editTarget.fandomTargetId}/categories`, {
          fandomCategoryIds: editCategoryIds,
        });
      }
      notification.success({
        message: '수정 완료',
        description: '덕질 대상이 수정되었습니다.',
      });
      setEditTarget(null);
      reload();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '수정 실패';
      notification.error({ message: '수정 실패', description: msg });
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'fandomTargetId',
      key: 'fandomTargetId',
      width: 80,
      // 기본 정렬은 서버 순서(작품 우선)라서, ID 순으로 보고 싶을 때 직접 정렬할 수 있게 한다.
      sorter: (a, b) => a.fandomTargetId - b.fandomTargetId,
    },
    {
      title: '유형',
      dataIndex: 'type',
      key: 'type',
      width: 90,
      render: (_, record) => {
        const type = targetTypeOf(record);
        const t = TYPE_MAP[type] || { color: 'default', label: type };
        return <Tag color={t.color}>{t.label}</Tag>;
      },
    },
    {
      title: '이미지',
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: 64,
      render: (url) => <Avatar src={url} shape="square" size={40} />,
    },
    {
      title: '이름',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '카테고리',
      dataIndex: 'fandomCategories',
      key: 'fandomCategories',
      render: (cats) =>
        cats?.map((c) => (
          <Tag key={c.fandomCategoryId} color={CATEGORY_COLORS[c.category] || 'default'}>
            {c.displayName}
          </Tag>
        )),
    },
    {
      title: '소스',
      dataIndex: 'source',
      key: 'source',
      width: 220,
      ellipsis: true,
      render: (src, record) => {
        // 작품(WORK)은 스스로가 소스라서 소스 값을 갖지 않는다.
        if (!src) {
          return (
            <Typography.Text type="secondary">
              {targetTypeOf(record) === 'WORK' ? '작품 자체' : '-'}
            </Typography.Text>
          );
        }
        const isUrl = /^https?:\/\//i.test(src);
        return isUrl ? (
          <Typography.Link href={src} target="_blank" rel="noreferrer" ellipsis>
            {src}
          </Typography.Link>
        ) : (
          <Typography.Text ellipsis={{ tooltip: src }}>{src}</Typography.Text>
        );
      },
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const s = STATUS_MAP[status] || { color: 'default', label: status };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '관리',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EditOutlined />}
          onClick={() => openEditModal(record)}
        >
          수정
        </Button>
      ),
    },
  ];

  if (error && data.length === 0) {
    return (
      <div>
        <Header>
          <Typography.Title level={4} style={{ margin: 0 }}>덕질 대상 관리</Typography.Title>
        </Header>
        <Result
          status="warning"
          title="데이터를 불러올 수 없습니다"
          subTitle={error}
          extra={<Button type="primary" onClick={() => reload()}>다시 시도</Button>}
        />
      </div>
    );
  }

  // 화면 표시는 '편집 중인 유형' 기준이다. 유형을 바꾸면 소스 입력 가능 여부도 즉시 따라간다.
  const editingIsWork = editType === 'WORK';

  return (
    <div>
      <Header>
        <Space align="baseline" wrap>
          <Typography.Title level={4} style={{ margin: 0 }}>덕질 대상 관리</Typography.Title>
          <Typography.Text type="secondary">
            {`불러온 ${data.length}건${hasMore ? '+' : ''} — 작품 ${typeCounts.WORK || 0} · 캐릭터 ${typeCounts.CHARACTER || 0}`}
          </Typography.Text>
        </Space>
        <Space wrap>
          <Select
            placeholder="유형 필터"
            allowClear
            value={typeFilter}
            onChange={handleTypeFilter}
            style={{ width: 140 }}
            options={[
              { value: 'WORK', label: '작품' },
              { value: 'CHARACTER', label: '캐릭터' },
            ]}
          />
          <Checkbox
            checked={noWorkOnly}
            onChange={(e) => handleNoWorkOnly(e.target.checked)}
          >
            작품 없는 대상만
          </Checkbox>
          <Select
            placeholder="상태 필터"
            allowClear
            value={statusFilter}
            onChange={handleStatusFilter}
            style={{ width: 140 }}
            options={[
              { value: 'APPROVED', label: '승인' },
              { value: 'PENDING', label: '대기' },
              { value: 'REJECTED', label: '거절' },
            ]}
          />
          <Input.Search
            placeholder="이름·소스 검색..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={handleSearch}
            style={{ width: 300 }}
            allowClear
          />
        </Space>
      </Header>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="fandomTargetId"
        loading={loading}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (t) => `불러온 ${t}건${hasMore ? ' (더 있음)' : ''}`,
        }}
        size="middle"
        footer={() =>
          hasMore ? (
            <Button type="link" onClick={handleLoadMore} loading={loading}>
              더 불러오기
            </Button>
          ) : null
        }
      />

      {/* 수정 모달 */}
      <Modal
        title="덕질 대상 수정"
        open={!!editTarget}
        onCancel={() => setEditTarget(null)}
        onOk={handleSave}
        confirmLoading={saving}
        okText="저장"
        cancelText="취소"
        width={560}
      >
        {editTarget && (
          <div>
            <Descriptions bordered column={1} size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="ID">{editTarget.fandomTargetId}</Descriptions.Item>
              <Descriptions.Item label="현재 이미지">
                {editTarget.imageUrl ? (
                  <Avatar src={editTarget.imageUrl} shape="square" size={64} />
                ) : (
                  <Typography.Text type="secondary">없음</Typography.Text>
                )}
              </Descriptions.Item>
            </Descriptions>

            <Form layout="vertical">
              <Form.Item
                label="유형"
                extra="작품은 자동으로 만들어지지 않습니다. 작품으로 지정하면 소스는 비워집니다."
              >
                <Select
                  value={editType}
                  onChange={setEditType}
                  style={{ width: '100%' }}
                  options={Object.entries(TYPE_MAP).map(([value, { color, label }]) => ({
                    value,
                    label: <Tag color={color}>{label}</Tag>,
                  }))}
                />
              </Form.Item>
              <Form.Item label="이름">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="덕질 대상 이름"
                />
              </Form.Item>
              <Form.Item label="이미지 URL">
                <Input
                  value={editImageUrl}
                  onChange={(e) => setEditImageUrl(e.target.value)}
                  placeholder="https://..."
                />
              </Form.Item>
              <Form.Item
                label="소스"
                extra={editingIsWork
                  ? '작품은 그 자체가 소스이므로 소스를 지정하지 않습니다.'
                  : '소속 작품 이름. 여기에 적어도 그 이름의 작품 대상이 따로 생기지는 않습니다.'}
              >
                <Input.TextArea
                  value={editingIsWork ? '' : editSource}
                  onChange={(e) => setEditSource(e.target.value)}
                  disabled={editingIsWork}
                  placeholder={editingIsWork ? '작품에는 소스를 지정하지 않습니다' : '출처(원작/URL 등)'}
                  maxLength={500}
                  showCount={!editingIsWork}
                  autoSize={{ minRows: 1, maxRows: 4 }}
                />
              </Form.Item>
              <Form.Item label="상태">
                <Select
                  value={editStatus}
                  onChange={setEditStatus}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'APPROVED', label: '승인' },
                    { value: 'PENDING', label: '대기' },
                    { value: 'REJECTED', label: '거절' },
                  ]}
                />
              </Form.Item>
              <Form.Item label="카테고리">
                <Checkbox.Group
                  value={editCategoryIds}
                  onChange={setEditCategoryIds}
                  style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  {categories.map((cat) => (
                    <Checkbox key={cat.fandomCategoryId} value={cat.fandomCategoryId}>
                      <Tag color={CATEGORY_COLORS[cat.category] || 'default'}>{cat.displayName}</Tag>
                    </Checkbox>
                  ))}
                </Checkbox.Group>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
}
