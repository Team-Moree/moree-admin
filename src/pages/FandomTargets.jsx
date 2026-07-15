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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [error, setError] = useState(null);

  // 수정 모달
  const [editTarget, setEditTarget] = useState(null);
  const [editName, setEditName] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editStatus, setEditStatus] = useState(null);
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

  // 커서 페이지네이션으로 전체 목록을 끝까지 조회한다.
  // (어드민 조회 API는 next 커서만 지원하고 search 파라미터는 서버에서 무시하므로,
  //  이름 검색은 전체 조회 후 클라이언트에서 필터링한다.)
  const fetchData = useCallback(async (status = undefined) => {
    setLoading(true);
    setError(null);
    try {
      const PAGE_SIZE = 100;
      const MAX_PAGES = 1000; // 무한루프 방지 안전장치 (최대 10만 건)
      const all = [];
      let next = '';
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const params = { next, size: PAGE_SIZE };
        if (status) params.status = status;
        const res = await client.get('/admin/fandom-target', { params });
        const list = Array.isArray(res.data?.results)
          ? res.data.results
          : Array.isArray(res.data) ? res.data : [];
        all.push(...list);
        const nextCursor = res.data?.next;
        if (!nextCursor || list.length === 0) break;
        next = nextCursor;
      }
      setData(all);
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

  const handleStatusFilter = (value) => {
    setStatusFilter(value);
    fetchData(value);
  };

  // 이름 검색은 전체 조회된 데이터에 대해 클라이언트에서 필터링
  const filteredData = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return data;
    return data.filter((item) => (item.name || '').toLowerCase().includes(keyword));
  }, [data, search]);

  const openEditModal = (record) => {
    setEditTarget(record);
    setEditName(record.name || '');
    setEditImageUrl(record.imageUrl || '');
    setEditSource(record.source || '');
    setEditStatus(record.status);
    setEditCategoryIds(record.fandomCategories?.map((c) => c.fandomCategoryId) || []);
  };

  const handleSave = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      // 이름/이미지/상태 변경 (변경된 필드만 전송)
      const patchBody = {};
      if (editName !== editTarget.name) patchBody.name = editName;
      if (editImageUrl !== (editTarget.imageUrl || '')) patchBody.imageUrl = editImageUrl;
      if (editSource !== (editTarget.source || '')) patchBody.source = editSource;
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
      notification.success({ message: '수정 완료', description: '덕질 대상이 수정되었습니다.' });
      setEditTarget(null);
      fetchData(statusFilter);
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
      render: (src) => {
        if (!src) return <Typography.Text type="secondary">-</Typography.Text>;
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
          extra={<Button type="primary" onClick={() => fetchData(statusFilter)}>다시 시도</Button>}
        />
      </div>
    );
  }

  return (
    <div>
      <Header>
        <Typography.Title level={4} style={{ margin: 0 }}>덕질 대상 관리</Typography.Title>
        <Space wrap>
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
            placeholder="이름 검색..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={setSearch}
            style={{ width: 300 }}
            allowClear
          />
        </Space>
      </Header>

      <Table
        columns={columns}
        dataSource={filteredData}
        rowKey="fandomTargetId"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `총 ${t}건` }}
        size="middle"
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
              <Form.Item label="소스">
                <Input.TextArea
                  value={editSource}
                  onChange={(e) => setEditSource(e.target.value)}
                  placeholder="출처(원작/URL 등)"
                  maxLength={500}
                  showCount
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
