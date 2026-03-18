import { useState } from 'react';
import { Table, Input, Avatar, Tag, Typography, Descriptions, Modal, notification } from 'antd';
import { SearchOutlined, UserOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import client from '../api/client';

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

export default function Users() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState('');
  const [detail, setDetail] = useState(null);

  const fetchUser = async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await client.get(`/user/${id}/profile`);
      setData([res.data]);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '유저 조회 실패';
      notification.error({ message: '조회 실패', description: msg });
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'userId',
      key: 'userId',
      width: 80,
    },
    {
      title: '프로필',
      dataIndex: 'profileImageUrl',
      key: 'profileImageUrl',
      width: 64,
      render: (url) => <Avatar src={url} icon={<UserOutlined />} />,
    },
    {
      title: '닉네임',
      dataIndex: 'nickname',
      key: 'nickname',
    },
    {
      title: '성별',
      dataIndex: 'gender',
      key: 'gender',
      width: 80,
    },
    {
      title: '팔로워',
      dataIndex: 'followerCount',
      key: 'followerCount',
      width: 80,
    },
    {
      title: '팔로잉',
      dataIndex: 'followingCount',
      key: 'followingCount',
      width: 80,
    },
    {
      title: '팬덤',
      dataIndex: 'fandomCategories',
      key: 'fandomCategories',
      render: (cats) => cats?.map((c, i) => <Tag key={i}>{c.displayName || c.category}</Tag>),
    },
    {
      title: '상세',
      key: 'action',
      width: 80,
      render: (_, record) => <a onClick={() => setDetail(record)}>보기</a>,
    },
  ];

  return (
    <div>
      <Header>
        <Typography.Title level={4} style={{ margin: 0 }}>유저</Typography.Title>
        <Input.Search
          placeholder="유저 ID 입력"
          prefix={<SearchOutlined />}
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          onSearch={fetchUser}
          style={{ width: 300 }}
          enterButton="조회"
        />
      </Header>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="userId"
        loading={loading}
        pagination={false}
        size="middle"
      />
      <Modal
        title="유저 상세"
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={null}
        width={600}
      >
        {detail && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="ID">{detail.userId}</Descriptions.Item>
            <Descriptions.Item label="닉네임">{detail.nickname}</Descriptions.Item>
            <Descriptions.Item label="소개">{detail.description || '-'}</Descriptions.Item>
            <Descriptions.Item label="성별">{detail.gender || '-'}</Descriptions.Item>
            <Descriptions.Item label="생일">{detail.birthday || '-'}</Descriptions.Item>
            <Descriptions.Item label="팔로워">{detail.followerCount}</Descriptions.Item>
            <Descriptions.Item label="팔로잉">{detail.followingCount}</Descriptions.Item>
            <Descriptions.Item label="팬덤 카테고리">
              {detail.fandomCategories?.map((c, i) => <Tag key={i}>{c.displayName || c.category}</Tag>)}
            </Descriptions.Item>
            <Descriptions.Item label="팬덤 타겟">
              {detail.fandomTargets?.map((t, i) => <Tag key={i}>{t.name}</Tag>)}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
