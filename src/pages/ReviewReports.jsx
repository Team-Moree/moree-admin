import { useEffect, useState } from 'react';
import { Table, Tag, Typography, Result, Button, App } from 'antd';
import styled from 'styled-components';
import client from '../api/client';

const PageTitle = styled(Typography.Title)`
  margin-bottom: 16px !important;
`;

const REPORT_TYPE_MAP = {
  SPAM: { color: 'orange', label: '스팸' },
  INAPPROPRIATE: { color: 'red', label: '부적절' },
  FALSE_INFO: { color: 'volcano', label: '허위 정보' },
  COPYRIGHT: { color: 'purple', label: '저작권' },
  HARASSMENT: { color: 'magenta', label: '괴롭힘' },
  OTHER: { color: 'default', label: '기타' },
};

const columns = [
  {
    title: 'ID',
    dataIndex: 'id',
    key: 'id',
    width: 80,
  },
  {
    title: '리뷰 ID',
    dataIndex: 'reviewId',
    key: 'reviewId',
    width: 100,
  },
  {
    title: '신고 유형',
    dataIndex: 'type',
    key: 'type',
    render: (type) => {
      const t = REPORT_TYPE_MAP[type] || { color: 'default', label: type };
      return <Tag color={t.color}>{t.label}</Tag>;
    },
  },
  {
    title: '내용',
    dataIndex: 'content',
    key: 'content',
    ellipsis: true,
  },
  {
    title: '신고자 ID',
    dataIndex: 'reporterUserId',
    key: 'reporterUserId',
    width: 100,
  },
  {
    title: '피신고자 ID',
    dataIndex: 'reportedUserId',
    key: 'reportedUserId',
    width: 110,
  },
  {
    title: '신고일',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 180,
    render: (val) => val ? new Date(val).toLocaleString('ko-KR') : '-',
  },
];

export default function ReviewReports() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { notification } = App.useApp();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get('/review/report-category');
      const list = Array.isArray(res.data?.results) ? res.data.results : Array.isArray(res.data) ? res.data : [];
      setData(list);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '리뷰 신고 조회 실패';
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
        <PageTitle level={4}>리뷰 신고</PageTitle>
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
      <PageTitle level={4}>리뷰 신고</PageTitle>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `총 ${t}건` }}
        size="middle"
      />
    </div>
  );
}
