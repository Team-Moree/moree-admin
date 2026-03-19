import { useEffect, useState } from 'react';
import { Table, Tag, Typography, Result, Button, App, Modal, Form, Input } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import client from '../api/client';

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

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

const columns = [
  {
    title: 'ID',
    dataIndex: 'fandomCategoryId',
    key: 'fandomCategoryId',
    width: 80,
  },
  {
    title: '카테고리 코드',
    dataIndex: 'category',
    key: 'category',
    render: (val) => <Tag color={CATEGORY_COLORS[val] || 'default'}>{val}</Tag>,
  },
  {
    title: '표시 이름',
    dataIndex: 'displayName',
    key: 'displayName',
  },
];

export default function FandomCategories() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 추가 모달
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [form] = Form.useForm();

  const { notification } = App.useApp();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get('/shared/fandom-category');
      const list = Array.isArray(res.data?.results) ? res.data.results : Array.isArray(res.data) ? res.data : [];
      setData(list);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '팬덤 카테고리 조회 실패';
      setError(msg);
      notification.error({ message: '조회 실패', description: msg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      setAddLoading(true);
      await client.post('/admin/fandom-target/fandom-category', {
        name: values.name,
        enName: values.enName,
      });
      notification.success({ message: '추가 완료', description: '팬덤 카테고리가 추가되었습니다.' });
      setAddOpen(false);
      form.resetFields();
      fetchData();
    } catch (err) {
      if (err.errorFields) return; // validation error
      const msg = err.response?.data?.message || err.message || '추가 실패';
      notification.error({ message: '추가 실패', description: msg });
    } finally {
      setAddLoading(false);
    }
  };

  if (error && data.length === 0) {
    return (
      <div>
        <Header>
          <Typography.Title level={4} style={{ margin: 0 }}>팬덤 카테고리</Typography.Title>
        </Header>
        <Result
          status="warning"
          title="데이터를 불러올 수 없습니다"
          subTitle={error}
          extra={<Button type="primary" onClick={fetchData}>다시 시도</Button>}
        />
      </div>
    );
  }

  return (
    <div>
      <Header>
        <Typography.Title level={4} style={{ margin: 0 }}>팬덤 카테고리</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
          카테고리 추가
        </Button>
      </Header>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="fandomCategoryId"
        loading={loading}
        pagination={false}
        size="middle"
        footer={() => (
          <Typography.Text type="secondary">
            팬덤 카테고리 삭제는 개발자에게 문의하세요.
          </Typography.Text>
        )}
      />

      <Modal
        title="팬덤 카테고리 추가"
        open={addOpen}
        onCancel={() => { setAddOpen(false); form.resetFields(); }}
        onOk={handleAdd}
        confirmLoading={addLoading}
        okText="추가"
        cancelText="취소"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="표시 이름"
            rules={[{ required: true, message: '표시 이름을 입력해주세요' }]}
          >
            <Input placeholder="예: 아이돌" />
          </Form.Item>
          <Form.Item
            name="enName"
            label="카테고리 코드 (영문)"
            rules={[{ required: true, message: '영문 코드를 입력해주세요' }]}
          >
            <Input placeholder="예: IDOL" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
