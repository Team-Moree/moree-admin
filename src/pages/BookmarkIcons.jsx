import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Result, Button, App, Modal, Form, InputNumber, Card, Empty, Popconfirm, Spin, Upload,
} from 'antd';
import { PlusOutlined, DeleteOutlined, InboxOutlined } from '@ant-design/icons';
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
  const [fileList, setFileList] = useState([]);

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
      await createForm.validateFields();
      if (fileList.length === 0) {
        notification.warning({ message: '이미지를 선택해주세요' });
        return;
      }
      setCreating(true);

      const formData = new FormData();
      formData.append('image', fileList[0].originFileObj);

      const width = createForm.getFieldValue('width');
      if (width) {
        formData.append('width', width);
      }

      await client.post('/admin/bookmark/icon', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      notification.success({ message: '아이콘 추가 완료', description: '새 북마크 아이콘이 등록되었습니다.' });
      setCreateOpen(false);
      createForm.resetFields();
      setFileList([]);
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
      await client.delete(`/admin/bookmark/icon/${id}`);
      notification.success({ message: '삭제 완료', description: '아이콘이 삭제되었습니다.' });
      setData((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '삭제 실패';
      notification.error({ message: '삭제 실패', description: msg });
    }
  };

  const handleCloseModal = () => {
    setCreateOpen(false);
    createForm.resetFields();
    setFileList([]);
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
                description="사용 중인 아이콘일 경우 개발자에게 문의해주세요. 삭제하시겠습니까?"
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
        onCancel={handleCloseModal}
        onOk={handleCreate}
        confirmLoading={creating}
        okText="추가"
        cancelText="취소"
        width={480}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            label="아이콘 이미지"
            required
          >
            <Upload.Dragger
              accept="image/*"
              maxCount={1}
              fileList={fileList}
              beforeUpload={() => false}
              onChange={({ fileList: newFileList }) => setFileList(newFileList)}
              listType="picture"
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">클릭하거나 이미지를 드래그하여 업로드</p>
              <p className="ant-upload-hint">PNG, JPG, SVG 등 이미지 파일을 지원합니다</p>
            </Upload.Dragger>
          </Form.Item>
          <Form.Item
            label="아이콘 너비 (px)"
            name="width"
            extra="미입력시 기본값 96px로 리사이즈됩니다"
          >
            <InputNumber min={1} max={512} placeholder="96" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
