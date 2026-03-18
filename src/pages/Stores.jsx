import { useEffect, useState } from 'react';
import { Table, Tag, Typography, Input, Result, Button, App } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import client from '../api/client';

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const columns = [
  {
    title: 'ID',
    dataIndex: 'storeId',
    key: 'storeId',
    width: 80,
  },
  {
    title: '제목',
    dataIndex: 'title',
    key: 'title',
    ellipsis: true,
  },
  {
    title: '카테고리',
    dataIndex: 'categories',
    key: 'categories',
    render: (cats) => cats?.map((c, i) => <Tag key={i}>{c.displayName || c}</Tag>),
  },
  {
    title: '키워드',
    dataIndex: 'keywords',
    key: 'keywords',
    render: (kws) => kws?.map((k, i) => <Tag key={i} color="blue">{k}</Tag>),
  },
  {
    title: '기간',
    key: 'period',
    render: (_, r) => `${r.startDate || '-'} ~ ${r.finishDate || '-'}`,
    width: 220,
  },
  {
    title: '조회수',
    dataIndex: 'viewCount',
    key: 'viewCount',
    width: 80,
    sorter: (a, b) => (a.viewCount || 0) - (b.viewCount || 0),
  },
];

export default function Stores() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);
  const { notification } = App.useApp();

  const fetchData = async (keyword = '') => {
    setLoading(true);
    setError(null);
    try {
      let res;
      if (keyword) {
        res = await client.get('/store/search', { params: { search: keyword } });
      } else {
        res = await client.get('/store/list', { params: { ordering: 'LATEST' } });
      }
      const list = Array.isArray(res.data?.results) ? res.data.results : Array.isArray(res.data) ? res.data : [];
      setData(list);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '스토어 조회 실패';
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
          <Typography.Title level={4} style={{ margin: 0 }}>스토어</Typography.Title>
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
        <Typography.Title level={4} style={{ margin: 0 }}>스토어</Typography.Title>
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
        rowKey="storeId"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `총 ${t}건` }}
        size="middle"
      />
    </div>
  );
}
