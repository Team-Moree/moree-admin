import { useEffect, useState } from 'react';
import { Table, Tag, Typography, Result, Button, App } from 'antd';
import styled from 'styled-components';
import client from '../api/client';

const PageTitle = styled(Typography.Title)`
  margin-bottom: 16px !important;
`;

const REPORT_TYPE_MAP = {
  INAPPROPRIATE_EVENT: { color: 'red', label: '부적절한 이벤트' },
  FALSE_REGISTERED_EVENT: { color: 'orange', label: '허위 등록' },
  ILLEGAL_OR_POLICY_VIOLATION_EVENT: { color: 'volcano', label: '불법/정책 위반' },
  INACCESSIBLE_LOCATION: { color: 'gold', label: '접근 불가 위치' },
  ETC: { color: 'default', label: '기타' },
};

const columns = [
  {
    title: 'ID',
    dataIndex: 'id',
    key: 'id',
    width: 80,
  },
  {
    title: '스토어 ID',
    dataIndex: 'storeId',
    key: 'storeId',
    width: 100,
  },
  {
    title: '신고 유형',
    dataIndex: 'reportType',
    key: 'reportType',
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
    dataIndex: 'userId',
    key: 'userId',
    width: 100,
  },
  {
    title: '신고일',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 180,
    render: (val) => val ? new Date(val).toLocaleString('ko-KR') : '-',
  },
];

export default function StoreReports() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { notification } = App.useApp();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get('/store/report');
      const list = Array.isArray(res.data?.results) ? res.data.results : Array.isArray(res.data) ? res.data : [];
      setData(list);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '스토어 신고 조회 실패';
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
        <PageTitle level={4}>스토어 신고</PageTitle>
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
      <PageTitle level={4}>스토어 신고</PageTitle>
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
