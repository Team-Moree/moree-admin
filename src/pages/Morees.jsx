import { useEffect, useState, useCallback } from 'react';
import {
  Table, Tag, Input, Avatar, Typography, Result, Button, App,
  Select, Space, Modal, Form, Upload,
} from 'antd';
import { EditOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
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

const CATEGORY_OPTIONS = [
  { value: 'GACHA_SHOP', label: '가챠샵' },
  { value: 'COMICS_ANIME', label: '만화/애니' },
  { value: 'IDOL', label: '아이돌' },
  { value: 'WEBTOON_WEB_NOVEL', label: '웹툰/웹소설' },
  { value: 'CHARACTER', label: '캐릭터' },
  { value: 'GAME', label: '게임' },
  { value: 'VTUBER', label: '버튜버' },
  { value: 'BIRTHDAY_CAFE', label: '생일카페' },
  { value: 'MOVIE_DRAMA', label: '영화/드라마' },
];

const CATEGORY_COLORS = {
  GACHA_SHOP: 'gold',
  COMICS_ANIME: 'blue',
  IDOL: 'purple',
  WEBTOON_WEB_NOVEL: 'cyan',
  CHARACTER: 'magenta',
  GAME: 'green',
  VTUBER: 'geekblue',
  BIRTHDAY_CAFE: 'orange',
  MOVIE_DRAMA: 'red',
};

const CATEGORY_LABEL = Object.fromEntries(CATEGORY_OPTIONS.map((o) => [o.value, o.label]));

const PAGE_SIZE = 20;

export default function Morees() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  // 생성 모달
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [createFileList, setCreateFileList] = useState([]);
  const [creating, setCreating] = useState(false);

  // 수정 모달
  const [editTarget, setEditTarget] = useState(null);
  const [editForm] = Form.useForm();
  const [editFileList, setEditFileList] = useState([]);
  const [saving, setSaving] = useState(false);

  const { notification } = App.useApp();

  const fetchData = useCallback(async (cursor = '') => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get('/admin/moree', { params: { next: cursor, size: PAGE_SIZE } });
      const list = Array.isArray(res.data?.results) ? res.data.results : [];
      if (cursor) {
        setData((prev) => [...prev, ...list]);
      } else {
        setData(list);
      }
      setNextCursor(res.data?.next || null);
      setHasMore(!!res.data?.next);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '모리 목록 조회 실패';
      setError(msg);
      notification.error({ message: '조회 실패', description: msg });
    } finally {
      setLoading(false);
    }
  }, [notification]);

  useEffect(() => {
    fetchData();
  }, []);

  const handleLoadMore = () => {
    if (nextCursor) fetchData(nextCursor);
  };

  // 생성
  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      if (createFileList.length === 0) {
        notification.warning({ message: '이미지 필요', description: '이미지를 선택해주세요.' });
        return;
      }
      setCreating(true);

      const formData = new FormData();
      formData.append('image', createFileList[0].originFileObj);
      formData.append('request', new Blob([JSON.stringify({
        name: values.name,
        acquireMessage: values.acquireMessage,
        speechMessage: values.speechMessage,
        category: values.category,
      })], { type: 'application/json' }));

      await client.post('/admin/moree', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      notification.success({ message: '모리 추가 완료', description: '새 모리가 등록되었습니다.' });
      setCreateOpen(false);
      createForm.resetFields();
      setCreateFileList([]);
      fetchData();
    } catch (err) {
      if (err.errorFields) return;
      const msg = err.response?.data?.message || err.message || '모리 추가 실패';
      notification.error({ message: '추가 실패', description: msg });
    } finally {
      setCreating(false);
    }
  };

  // 수정
  const openEditModal = (record) => {
    setEditTarget(record);
    setEditFileList([]);
    editForm.setFieldsValue({
      name: record.name,
      acquireMessage: record.acquireMessage,
      speechMessage: record.speechMessage,
      category: record.category,
    });
  };

  const handleSave = async () => {
    if (!editTarget) return;
    try {
      const values = await editForm.validateFields();
      setSaving(true);

      const requestBody = {};
      if (values.name !== editTarget.name) requestBody.name = values.name;
      if (values.acquireMessage !== editTarget.acquireMessage) requestBody.acquireMessage = values.acquireMessage;
      if (values.speechMessage !== editTarget.speechMessage) requestBody.speechMessage = values.speechMessage;
      if (values.category !== editTarget.category) requestBody.category = values.category;

      const hasNewImage = editFileList.length > 0;
      const hasFieldChanges = Object.keys(requestBody).length > 0;

      if (!hasNewImage && !hasFieldChanges) {
        notification.info({ message: '변경 없음', description: '수정된 항목이 없습니다.' });
        setEditTarget(null);
        return;
      }

      const formData = new FormData();
      if (hasNewImage) {
        formData.append('image', editFileList[0].originFileObj);
      }
      formData.append('request', new Blob([JSON.stringify(requestBody)], { type: 'application/json' }));

      await client.patch(`/admin/moree/${editTarget.moreeId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      notification.success({ message: '수정 완료', description: '모리 정보가 수정되었습니다.' });
      setEditTarget(null);
      setEditFileList([]);
      fetchData();
    } catch (err) {
      if (err.errorFields) return;
      const msg = err.response?.data?.message || err.message || '수정 실패';
      notification.error({ message: '수정 실패', description: msg });
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'moreeId',
      key: 'moreeId',
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
      title: '미니 이미지',
      dataIndex: 'miniImageUrl',
      key: 'miniImageUrl',
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
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (cat) => (
        <Tag color={CATEGORY_COLORS[cat] || 'default'}>{CATEGORY_LABEL[cat] || cat}</Tag>
      ),
    },
    {
      title: '획득 메시지',
      dataIndex: 'acquireMessage',
      key: 'acquireMessage',
      ellipsis: true,
    },
    {
      title: '대사',
      dataIndex: 'speechMessage',
      key: 'speechMessage',
      ellipsis: true,
    },
    {
      title: '생성일',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (val) => val?.slice(0, 10),
    },
    {
      title: '관리',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button type="link" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
          수정
        </Button>
      ),
    },
  ];

  if (error && data.length === 0) {
    return (
      <div>
        <Header>
          <Typography.Title level={4} style={{ margin: 0 }}>모리 관리</Typography.Title>
        </Header>
        <Result
          status="warning"
          title="데이터를 불러올 수 없습니다"
          subTitle={error}
          extra={<Button type="primary" onClick={() => fetchData()}>다시 시도</Button>}
        />
      </div>
    );
  }

  const uploadProps = {
    beforeUpload: () => false, // 자동 업로드 방지
    maxCount: 1,
    accept: 'image/*',
    listType: 'picture',
  };

  return (
    <div>
      <Header>
        <Typography.Title level={4} style={{ margin: 0 }}>모리 관리</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          모리 추가
        </Button>
      </Header>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="moreeId"
        loading={loading}
        pagination={false}
        size="middle"
        footer={() =>
          hasMore ? (
            <div style={{ textAlign: 'center' }}>
              <Button onClick={handleLoadMore} loading={loading}>더 보기</Button>
            </div>
          ) : null
        }
      />

      {/* 생성 모달 */}
      <Modal
        title="모리 추가"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); createForm.resetFields(); setCreateFileList([]); }}
        onOk={handleCreate}
        confirmLoading={creating}
        okText="추가"
        cancelText="취소"
        width={560}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item label="이름" name="name" rules={[{ required: true, message: '이름을 입력해주세요' }]}>
            <Input placeholder="모리 이름" />
          </Form.Item>
          <Form.Item label="이미지" required>
            <Upload
              {...uploadProps}
              fileList={createFileList}
              onChange={({ fileList }) => setCreateFileList(fileList.slice(-1))}
            >
              {createFileList.length === 0 && (
                <Button icon={<UploadOutlined />}>이미지 선택</Button>
              )}
            </Upload>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              jpg, png, gif, webp 지원. 서버에서 자동으로 리사이즈 및 미니 이미지가 생성됩니다.
            </Typography.Text>
          </Form.Item>
          <Form.Item label="획득 메시지" name="acquireMessage" rules={[{ required: true, message: '획득 메시지를 입력해주세요' }]}>
            <Input.TextArea rows={2} placeholder="모리 획득 시 표시되는 메시지" />
          </Form.Item>
          <Form.Item label="대사" name="speechMessage" rules={[{ required: true, message: '대사를 입력해주세요' }]}>
            <Input.TextArea rows={2} placeholder="모리의 대사" />
          </Form.Item>
          <Form.Item label="카테고리" name="category" rules={[{ required: true, message: '카테고리를 선택해주세요' }]}>
            <Select placeholder="카테고리 선택" options={CATEGORY_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 수정 모달 */}
      <Modal
        title="모리 수정"
        open={!!editTarget}
        onCancel={() => { setEditTarget(null); setEditFileList([]); }}
        onOk={handleSave}
        confirmLoading={saving}
        okText="저장"
        cancelText="취소"
        width={560}
      >
        {editTarget && (
          <Form form={editForm} layout="vertical">
            <Form.Item label="이름" name="name" rules={[{ required: true, message: '이름을 입력해주세요' }]}>
              <Input placeholder="모리 이름" />
            </Form.Item>
            <Form.Item label="이미지 변경">
              <div style={{ marginBottom: 8 }}>
                <Space>
                  <Avatar src={editTarget.imageUrl} shape="square" size={48} />
                  <Avatar src={editTarget.miniImageUrl} shape="square" size={32} />
                  <Typography.Text type="secondary">현재 이미지</Typography.Text>
                </Space>
              </div>
              <Upload
                {...uploadProps}
                fileList={editFileList}
                onChange={({ fileList }) => setEditFileList(fileList.slice(-1))}
              >
                {editFileList.length === 0 && (
                  <Button icon={<UploadOutlined />}>새 이미지 선택 (선택사항)</Button>
                )}
              </Upload>
            </Form.Item>
            <Form.Item label="획득 메시지" name="acquireMessage" rules={[{ required: true, message: '획득 메시지를 입력해주세요' }]}>
              <Input.TextArea rows={2} placeholder="모리 획득 시 표시되는 메시지" />
            </Form.Item>
            <Form.Item label="대사" name="speechMessage" rules={[{ required: true, message: '대사를 입력해주세요' }]}>
              <Input.TextArea rows={2} placeholder="모리의 대사" />
            </Form.Item>
            <Form.Item label="카테고리" name="category" rules={[{ required: true, message: '카테고리를 선택해주세요' }]}>
              <Select placeholder="카테고리 선택" options={CATEGORY_OPTIONS} />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
}
