import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Result, Button, App, Modal, Form, Input, Card, Empty, Popconfirm, Spin,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
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

const IconGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px;
`;

const IconCard = styled(Card)`
  text-align: center;
  .ant-card-body {
    padding: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
`;

const IconImage = styled.img`
  width: 64px;
  height: 64px;
  object-fit: contain;
  border-radius: 8px;
  background: #fafafa;
`;

const IconId = styled(Typography.Text)`
  font-size: 12px;
`;

const PAGE_SIZE = 40;

export default function BookmarkIcons() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  // 생성 모달
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [creating, setCreating] = useState(false);

  const { notification } = App.useApp();

  const fetchData = useCallback(async (cursor = '') => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get('/bookmark/icon', { params: { next: cursor, size: PAGE_SIZE } });
      const list = Array.isArray(res.data?.results) ? res.data.results : [];
      if (cursor) {
        setData((prev) => [...prev, ...list]);
      } else {
        setData(list);
      }
      setNextCursor(res.data?.next || null);
      setHasMore(!!res.data?.next);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '북마크 아이콘 목록 조회 실패';
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
      setCreating(true);

      await client.post('/admin/bookmark-icon', { iconUrl: values.iconUrl });

      notification.success({ message: '아이콘 추가 완료', description: '새 북마크 아이콘이 등록되었습니다.' });
      setCreateOpen(false);
      createForm.resetFields();
      fetchData();
    } catch (err) {
      if (err.errorFields) return;
      const msg = err.response?.data?.message || err.message || '아이콘 추가 실패';
      notification.error({ message: '추가 실패', description: msg });
    } finally {
      setCreating(false);
    }
  };

  // 삭제
  const handleDelete = async (id) => {
    try {
      await client.delete(`/admin/bookmark-icon/${id}`);
      notification.success({ message: '삭제 완료', description: '아이콘이 삭제되었습니다.' });
      setData((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '삭제 실패';
      notification.error({ message: '삭제 실패', description: msg });
    }
  };

  if (error && data.length === 0) {
    return (
      <div>
        <Header>
          <Typography.Title level={4} style={{ margin: 0 }}>북마크 아이콘 관리</Typography.Title>
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

  return (
    <div>
      <Header>
        <Typography.Title level={4} style={{ margin: 0 }}>북마크 아이콘 관리</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          아이콘 추가
        </Button>
      </Header>

      {data.length === 0 && !loading ? (
        <Empty description="등록된 아이콘이 없습니다" />
      ) : (
        <IconGrid>
          {data.map((icon) => (
            <IconCard key={icon.id} hoverable>
              <IconImage src={icon.iconUrl} alt={`icon-${icon.id}`} />
              <IconId type="secondary">ID: {icon.id}</IconId>
              <Popconfirm
                title="아이콘 삭제"
                description="이 아이콘을 삭제하시겠습니까?"
                onConfirm={() => handleDelete(icon.id)}
                okText="삭제"
                cancelText="취소"
              >
                <Button type="text" danger size="small" icon={<DeleteOutlined />}>
                  삭제
                </Button>
              </Popconfirm>
            </IconCard>
          ))}
        </IconGrid>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Spin />
        </div>
      )}

      {hasMore && !loading && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button onClick={handleLoadMore}>더 보기</Button>
        </div>
      )}

      {/* 생성 모달 */}
      <Modal
        title="북마크 아이콘 추가"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); createForm.resetFields(); }}
        onOk={handleCreate}
        confirmLoading={creating}
        okText="추가"
        cancelText="취소"
        width={480}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            label="아이콘 URL"
            name="iconUrl"
            rules={[
              { required: true, message: '아이콘 URL을 입력해주세요' },
              { type: 'url', message: '올바른 URL 형식을 입력해주세요' },
            ]}
          >
            <Input placeholder="https://example.com/icon.png" />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.iconUrl !== cur.iconUrl}>
            {({ getFieldValue }) => {
              const url = getFieldValue('iconUrl');
              return url ? (
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
                    미리보기
                  </Typography.Text>
                  <img
                    src={url}
                    alt="preview"
                    style={{
                      width: 64,
                      height: 64,
                      objectFit: 'contain',
                      borderRadius: 8,
                      background: '#fafafa',
                      border: '1px solid #f0f0f0',
                    }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                    onLoad={(e) => { e.target.style.display = 'inline-block'; }}
                  />
                </div>
              ) : null;
            }}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
