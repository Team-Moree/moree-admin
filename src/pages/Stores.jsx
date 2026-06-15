import { useCallback, useEffect, useState } from 'react';
import { Table, Tag, Typography, Result, Button, App, Select, Space, Modal, Descriptions, Image, Spin, Popconfirm, Alert, Input, Form, InputNumber, DatePicker } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import dayjs from 'dayjs';
import client from '../api/client';

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
`;

const ModalFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`;

const StyledTable = styled(Table)`
  .pending-review-row > td {
    background: #fff8e8 !important;
  }

  .pending-review-row:hover > td {
    background: #fff1cc !important;
  }

  .pending-review-row > td:first-child {
    box-shadow: inset 4px 0 0 #faad14;
  }
`;

const STATUS_MAP = {
  APPROVED: { color: 'green', label: '승인' },
  PENDING: { color: 'orange', label: '대기' },
  REJECTED: { color: 'red', label: '거절' },
  HIDDEN: { color: 'default', label: '숨김' },
};

const STATUS_CHANGE_OPTIONS = [
  { value: 'PENDING', label: '대기 (PENDING)' },
  { value: 'APPROVED', label: '승인 (APPROVED)' },
  { value: 'REJECTED', label: '거절 (REJECTED)' },
  { value: 'HIDDEN', label: '숨김 (HIDDEN)' },
];

const CATEGORY_COLORS = {
  CHARACTER: 'magenta',
  IDOL: 'purple',
  COMIC_ANIME: 'blue',
  COMICS_ANIME: 'blue',
  GAME: 'green',
  WEBTOON_WEBNOVEL: 'cyan',
  WEBTOON_WEB_NOVEL: 'cyan',
  BIRTHDAY_CAFE: 'orange',
  GACHA_SHOP: 'gold',
  DRAMA_MOVIE: 'red',
  MOVIE_DRAMA: 'red',
  ETC: 'default',
};

const PAGE_SIZE = 50;
const ALL_STATUS = 'ALL';
const KEYWORD_TAG_STYLE = {
  marginInlineEnd: 0,
  color: '#44546f',
  backgroundColor: '#f6f8fb',
  borderColor: '#d7deea',
};

const normalizeKeywords = (keywords) => {
  if (Array.isArray(keywords)) {
    return keywords.filter(Boolean);
  }

  if (typeof keywords === 'string') {
    return keywords
      .split(',')
      .map((keyword) => keyword.trim())
      .filter(Boolean);
  }

  return [];
};

export default function Stores() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [searchInput, setSearchInput] = useState('');
  const [searchKeyword, setSearchKeyword] = useState(undefined);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [patchOpen, setPatchOpen] = useState(false);
  const [patchLoading, setPatchLoading] = useState(false);
  const [pendingNextStatus, setPendingNextStatus] = useState(null);
  const [patchForm] = Form.useForm();
  const { notification } = App.useApp();
  const isAllStatusView = !statusFilter || statusFilter === ALL_STATUS;
  const isPendingDetail = detail?.approvalStatus === 'PENDING';
  const modalTitle = isPendingDetail ? '스토어 검토' : '스토어 상세';

  const handleOpenPatch = () => {
    if (!detail) return;
    patchForm.resetFields();
    patchForm.setFieldsValue({
      startDate: detail.startDate ? dayjs(detail.startDate) : null,
      finishDate: detail.finishDate ? dayjs(detail.finishDate) : null,
    });
    setPatchOpen(true);
  };

  const patchButton = (
    <Button
      key="patch"
      icon={<EditOutlined />}
      onClick={handleOpenPatch}
      disabled={!detail}
    >
      수동 수정
    </Button>
  );

  const modalFooter = isPendingDetail ? (
    <ModalFooter>
      <Space>
        <Button key="cancel" onClick={() => setDetail(null)}>
          닫기
        </Button>
        {patchButton}
      </Space>
      <Space>
        <Popconfirm
          key="reject"
          title="이 스토어를 거절할까요?"
          okText="거절"
          cancelText="취소"
          onConfirm={() => handleStatusChange(detail.storeId, 'REJECTED')}
        >
          <Button danger loading={statusUpdatingId === detail?.storeId}>
            거절
          </Button>
        </Popconfirm>
        <Popconfirm
          key="approve"
          title="이 스토어를 승인할까요?"
          okText="승인"
          cancelText="취소"
          onConfirm={() => handleStatusChange(detail.storeId, 'APPROVED')}
        >
          <Button type="primary" loading={statusUpdatingId === detail?.storeId}>
            승인
          </Button>
        </Popconfirm>
      </Space>
    </ModalFooter>
  ) : (
    <ModalFooter>
      <Space>
        {patchButton}
        <Select
          placeholder="상태 변경"
          style={{ width: 160 }}
          value={pendingNextStatus}
          onChange={setPendingNextStatus}
          options={STATUS_CHANGE_OPTIONS.filter((opt) => opt.value !== detail?.approvalStatus)}
        />
        <Popconfirm
          key="change-status"
          title={pendingNextStatus
            ? `스토어 상태를 ${STATUS_MAP[pendingNextStatus]?.label || pendingNextStatus}(으)로 변경할까요?`
            : '변경할 상태를 선택해주세요.'}
          okText="변경"
          cancelText="취소"
          disabled={!pendingNextStatus}
          onConfirm={() => handleStatusChange(detail.storeId, pendingNextStatus)}
        >
          <Button
            type="primary"
            disabled={!pendingNextStatus}
            loading={statusUpdatingId === detail?.storeId}
          >
            변경
          </Button>
        </Popconfirm>
      </Space>
      <Button
        key="close"
        onClick={() => {
          setDetail(null);
          setPendingNextStatus(null);
        }}
      >
        닫기
      </Button>
    </ModalFooter>
  );

  const fetchData = useCallback(async ({ cursor = '', status, search, append = false } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = { next: cursor, size: PAGE_SIZE };
      if (status && status !== ALL_STATUS) params.status = status;
      if (search) params.search = search;

      const res = await client.get('/admin/store/list', { params });
      const list = Array.isArray(res.data?.results) ? res.data.results : [];

      setData((prev) => (append ? [...prev, ...list] : list));
      setNextCursor(res.data?.next || null);
      setHasMore(!!res.data?.next);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '스토어 조회 실패';
      setError(msg);
      notification.error({ message: '조회 실패', description: msg });
    } finally {
      setLoading(false);
    }
  }, [notification]);

  useEffect(() => {
    fetchData({ status: statusFilter, search: searchKeyword });
  }, [fetchData, searchKeyword, statusFilter]);

  const handleStatusFilter = (value) => {
    setStatusFilter(value);
  };

  const handleSearch = (value) => {
    const trimmedValue = value.trim();
    setSearchKeyword(trimmedValue || undefined);
  };

  const handleLoadMore = () => {
    if (!nextCursor || loading) return;
    fetchData({ cursor: nextCursor, status: statusFilter, search: searchKeyword, append: true });
  };

  const handleOpenDetail = async (storeId) => {
    setDetail(null);
    setPendingNextStatus(null);
    setDetailLoading(true);
    try {
      const res = await client.get(`/admin/store/${storeId}`);
      setDetail(res.data);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '스토어 상세 조회 실패';
      notification.error({ message: '상세 조회 실패', description: msg });
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePatchSubmit = async () => {
    if (!detail) return;
    let values;
    try {
      values = await patchForm.validateFields();
    } catch (err) {
      if (err?.errorFields) return;
      throw err;
    }

    const { latitude, longitude, startDate, finishDate } = values;
    const hasLat = latitude !== undefined && latitude !== null;
    const hasLon = longitude !== undefined && longitude !== null;
    if (hasLat !== hasLon) {
      notification.error({
        message: '입력 오류',
        description: '위도/경도는 둘 다 함께 입력해야 합니다.',
      });
      return;
    }

    const payload = {};
    if (hasLat && hasLon) {
      payload.latitude = latitude;
      payload.longitude = longitude;
    }
    if (startDate) payload.startDate = dayjs(startDate).format('YYYY-MM-DD');
    if (finishDate) payload.finishDate = dayjs(finishDate).format('YYYY-MM-DD');

    if (Object.keys(payload).length === 0) {
      notification.warning({
        message: '변경할 항목이 없습니다',
        description: '변경하려는 필드를 하나 이상 입력해주세요.',
      });
      return;
    }

    setPatchLoading(true);
    try {
      await client.patch(`/admin/store/${detail.storeId}`, payload);
      notification.success({
        message: '수정 완료',
        description: '스토어 정보가 수정되었습니다.',
      });
      setPatchOpen(false);
      patchForm.resetFields();

      try {
        const res = await client.get(`/admin/store/${detail.storeId}`);
        setDetail(res.data);
      } catch {
        // detail 재조회 실패는 무시 (목록만 갱신)
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '스토어 수정 실패';
      notification.error({ message: '수정 실패', description: msg });
    } finally {
      setPatchLoading(false);
    }
  };

  const handleStatusChange = async (storeId, nextStatus) => {
    setStatusUpdatingId(storeId);
    try {
      await client.post(`/admin/store/${storeId}/status`, { status: nextStatus });

      const successLabel = STATUS_MAP[nextStatus]?.label || nextStatus;
      notification.success({
        message: '상태 변경 완료',
        description: `스토어 상태가 ${successLabel}(으)로 변경되었습니다.`,
      });

      setData((prev) => prev.map((item) => (
        item.storeId === storeId ? { ...item, approvalStatus: nextStatus } : item
      )));

      setDetail((prev) => (prev && prev.storeId === storeId
        ? { ...prev, approvalStatus: nextStatus }
        : prev));

      setPendingNextStatus(null);

      if (statusFilter === 'PENDING') {
        fetchData({ status: statusFilter, search: searchKeyword });
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '스토어 상태 변경 실패';
      notification.error({ message: '상태 변경 실패', description: msg });
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'storeId',
      key: 'storeId',
      width: 100,
    },
    {
      title: '제목',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '카테고리',
      dataIndex: 'fandomCategories',
      key: 'fandomCategories',
      render: (categories) =>
        categories?.map((category) => (
          <Tag
            key={category.fandomCategoryId}
            color={CATEGORY_COLORS[category.category] || 'default'}
          >
            {category.displayName}
          </Tag>
        )),
    },
    {
      title: '승인 상태',
      dataIndex: 'approvalStatus',
      key: 'approvalStatus',
      width: 120,
      render: (status) => {
        const mappedStatus = STATUS_MAP[status] || { color: 'default', label: status };
        return <Tag color={mappedStatus.color}>{mappedStatus.label}</Tag>;
      },
    },
    {
      title: '요청일',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (value) => (value ? new Date(value).toLocaleString('ko-KR') : '-'),
    },
    {
      title: '상세',
      key: 'action',
      width: 90,
      render: (_, record) => (
        <Button type="link" onClick={() => handleOpenDetail(record.storeId)}>
          {record.approvalStatus === 'PENDING' ? '검토' : '보기'}
        </Button>
      ),
    },
  ];

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
          extra={<Button type="primary" onClick={() => fetchData({ status: statusFilter, search: searchKeyword })}>다시 시도</Button>}
        />
      </div>
    );
  }

  return (
    <div>
      <Header>
        <Typography.Title level={4} style={{ margin: 0 }}>스토어</Typography.Title>
        <Space wrap>
          <Select
            placeholder="승인 상태"
            allowClear
            value={statusFilter}
            onChange={handleStatusFilter}
            style={{ width: 140 }}
            options={[
              { value: ALL_STATUS, label: '전체' },
              { value: 'APPROVED', label: '승인' },
              { value: 'PENDING', label: '대기' },
              { value: 'REJECTED', label: '거절' },
            ]}
          />
          <Input.Search
            allowClear
            placeholder="상점명, 주소, ID 검색"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
            }}
            onSearch={handleSearch}
            style={{ width: 260 }}
          />
        </Space>
      </Header>
      <StyledTable
        columns={columns}
        dataSource={data}
        rowKey="storeId"
        loading={loading}
        rowClassName={(record) => (
          isAllStatusView && record.approvalStatus === 'PENDING' ? 'pending-review-row' : ''
        )}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `총 ${total}건` }}
        size="middle"
        footer={() =>
          hasMore ? (
            <Button type="link" onClick={handleLoadMore} loading={loading}>
              더 불러오기
            </Button>
          ) : null
        }
      />
      <Modal
        title={modalTitle}
        open={detailLoading || !!detail}
        onCancel={() => {
          setDetail(null);
          setDetailLoading(false);
          setPendingNextStatus(null);
        }}
        footer={modalFooter}
        width={820}
      >
        {detailLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <Spin />
          </div>
        )}
        {detail && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {isPendingDetail && (
              <Alert
                type="warning"
                showIcon
                message="검토 필요"
                description="스토어 정보를 확인한 뒤 승인 또는 거절을 선택하세요."
              />
            )}
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="ID">{detail.storeId}</Descriptions.Item>
              <Descriptions.Item label="제목">{detail.title || '-'}</Descriptions.Item>
              <Descriptions.Item label="설명">{detail.description || '-'}</Descriptions.Item>
              <Descriptions.Item label="승인 상태">
                <Tag color={(STATUS_MAP[detail.approvalStatus] || { color: 'default' }).color}>
                  {(STATUS_MAP[detail.approvalStatus] || { label: detail.approvalStatus }).label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="주소">
                {[detail.address, detail.addressDetail].filter(Boolean).join(' ') || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="우편번호">{detail.zip || '-'}</Descriptions.Item>
              <Descriptions.Item label="전화번호">{detail.phoneNumber || '-'}</Descriptions.Item>
              <Descriptions.Item label="기간">
                {detail.startDate || '-'} ~ {detail.finishDate || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="키워드">
                {normalizeKeywords(detail.keywords).length
                  ? (
                    <Space wrap size={[8, 8]}>
                      {normalizeKeywords(detail.keywords).map((keyword) => (
                        <Tag key={keyword} style={KEYWORD_TAG_STYLE}>
                          {keyword}
                        </Tag>
                      ))}
                    </Space>
                  )
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="카테고리">
                {detail.fandomCategories?.length
                  ? detail.fandomCategories.map((category) => (
                    <Tag
                      key={category.fandomCategoryId}
                      color={CATEGORY_COLORS[category.category] || 'default'}
                    >
                      {category.displayName}
                    </Tag>
                  ))
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="운영 시간">
                {detail.operationHours?.length
                  ? detail.operationHours.map((item) => (
                    <div key={`${item.day}-${item.open}-${item.close}`}>
                      {item.day}: {item.open || '-'} - {item.close || '-'}
                    </div>
                  ))
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="링크">
                {detail.links?.length
                  ? detail.links.map((item, index) => (
                    <div key={`${item.link}-${index}`}>
                      <a href={item.link} target="_blank" rel="noreferrer">
                        {item.title || item.link}
                      </a>
                    </div>
                  ))
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="이미지">
                {detail.imageUrls?.length
                  ? (
                    <Space wrap>
                      {detail.imageUrls.map((imageUrl, index) => (
                        <Image key={`${imageUrl}-${index}`} src={imageUrl} width={120} />
                      ))}
                    </Space>
                  )
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="요청일">
                {detail.createdAt ? new Date(detail.createdAt).toLocaleString('ko-KR') : '-'}
              </Descriptions.Item>
            </Descriptions>
          </Space>
        )}
      </Modal>
      <Modal
        title="스토어 직접 수정"
        open={patchOpen}
        onCancel={() => {
          setPatchOpen(false);
          patchForm.resetFields();
        }}
        onOk={handlePatchSubmit}
        confirmLoading={patchLoading}
        okText="수정"
        cancelText="취소"
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="빈 칸은 변경하지 않음"
          description="좌표는 위도/경도를 함께 입력해야 합니다. 승인 상태는 본 화면에서 변경할 수 없으며, 상세 화면의 승인/거절 버튼을 사용해주세요."
        />
        <Form form={patchForm} layout="vertical" preserve={false}>
          <Form.Item label="좌표" style={{ marginBottom: 0 }}>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item
                name="latitude"
                noStyle
                rules={[
                  { type: 'number', min: -90, max: 90, message: '-90 ~ 90 범위' },
                ]}
              >
                <InputNumber
                  placeholder="위도 (latitude)"
                  step={0.000001}
                  style={{ width: '50%' }}
                />
              </Form.Item>
              <Form.Item
                name="longitude"
                noStyle
                rules={[
                  { type: 'number', min: -180, max: 180, message: '-180 ~ 180 범위' },
                ]}
              >
                <InputNumber
                  placeholder="경도 (longitude)"
                  step={0.000001}
                  style={{ width: '50%' }}
                />
              </Form.Item>
            </Space.Compact>
          </Form.Item>
          <Form.Item name="startDate" label="시작일">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="finishDate" label="종료일">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
