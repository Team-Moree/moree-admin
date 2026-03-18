import { useEffect, useState } from 'react';
import { Table, Tag, Input, Avatar, Typography, Result, Button, notification } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import client from '../api/client';

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const STATUS_MAP = {
  APPROVED: { color: 'green', label: '승인' },
  PENDING: { color: 'orange', label: '대기' },
  REJECTED: { color: 'red', label: '거절' },
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
      cats?.map((c) => <Tag key={c.fandomCategoryId}>{c.displayName}</Tag>),
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
];

export default function FandomTargets() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);

  const fetchData = async (keyword = '') => {
    setLoading(true);
    setError(null);
    try {
      const params = { size: 100 };
      if (keyword) params.search = keyword;
      const res = await client.get('/shared/fandom-target', { params });
      const list = Array.isArray(res.data?.results) ? res.data.results : Array.isArray(res.data) ? res.data : [];
      setData(list);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '팬덤 타겟 조회 실패';
      setError(msg);
      notification.error({ message: '조회 실패', description: msg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSearch = (value) => {
    setSearch(value);
    fetchData(value);
  };

  if (error && data.length === 0) {
    return (
      <div>
        <Header>
          <Typography.Title level={4} style={{ margin: 0 }}>팬덤 타겟</Typography.Title>
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
        <Typography.Title level={4} style={{ margin: 0 }}>팬덤 타겟</Typography.Title>
        <Input.Search
          placeholder="검색..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onSearch={handleSearch}
          style={{ width: 300 }}
          allowClear
        />
      </Header>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="fandomTargetId"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `총 ${t}건` }}
        size="middle"
      />
    </div>
  );
}
