import { useEffect, useState } from 'react';
import { Table, Tag, Typography, Result, Button, App } from 'antd';
import styled from 'styled-components';
import client from '../api/client';

const PageTitle = styled(Typography.Title)`
  margin-bottom: 16px !important;
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
    title: '카테고리',
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

  if (error && data.length === 0) {
    return (
      <div>
        <PageTitle level={4}>팬덤 카테고리</PageTitle>
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
      <PageTitle level={4}>팬덤 카테고리</PageTitle>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="fandomCategoryId"
        loading={loading}
        pagination={false}
        size="middle"
      />
    </div>
  );
}
