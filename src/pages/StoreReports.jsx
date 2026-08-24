import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Table, Tag, Typography, Result, Button, App, Select, Space, Modal,
  Descriptions, Popconfirm, Form, Input, Spin, Alert, Tabs,
} from 'antd';
import { EditOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import client from '../api/client';
import GoogleAddressSearchModal from '../components/GoogleAddressSearchModal';
import {
  FEEDBACK_TABS,
  buildStoreApplyRequest,
  getStoreFeedbackListEndpoint,
  hasValidCoordinates,
  normalizeStoreFeedbackItems,
  sortStoreFeedbackItems,
} from './storeReportsUtils';

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
  .unprocessed-feedback-row > td {
    background: #fff8e8 !important;
  }

  .unprocessed-feedback-row:hover > td {
    background: #fff1cc !important;
  }

  .unprocessed-feedback-row > td:first-child {
    box-shadow: inset 4px 0 0 #faad14;
  }
`;

const PAGE_SIZE = 50;
const ALL_FILTER = 'ALL';
const UNPROCESSED_FILTER = 'UNPROCESSED';
const PROCESSED_FILTER = 'PROCESSED';

const FEEDBACK_TYPE_MAP = {
  EDIT_REQUEST: { color: 'blue', label: '수정 요청' },
  REPORT: { color: 'red', label: '신고' },
};

const FEEDBACK_TAB_ITEMS = [
  { key: FEEDBACK_TABS.REPORT, label: FEEDBACK_TYPE_MAP.REPORT.label },
  { key: FEEDBACK_TABS.EDIT_REQUEST, label: FEEDBACK_TYPE_MAP.EDIT_REQUEST.label },
];

const PROCESS_STATUS_MAP = {
  true: { color: 'green', label: '처리 완료' },
  false: { color: 'orange', label: '처리 필요' },
};

const PROCESS_ACTION_MAP = {
  DISMISS: '기각',
  HIDE_STORE: '상점 숨김',
};

const TYPE_LABEL_MAP = {
  INAPPROPRIATE_EVENT: '부적절한 이벤트',
  FALSE_REGISTERED_EVENT: '허위 등록',
  ILLEGAL_OR_POLICY_VIOLATION_EVENT: '불법/정책 위반',
  INACCESSIBLE_LOCATION: '접근 불가 위치',
  ETC: '기타',
};

const getProcessedParam = (filter) => {
  if (filter === PROCESSED_FILTER) return true;
  if (filter === UNPROCESSED_FILTER) return false;
  return undefined;
};

const getRowKey = (record) => `${record.feedbackType}-${record.id}`;

const getProcessStatus = (isProcessed) => (isProcessed === true
  ? PROCESS_STATUS_MAP.true
  : PROCESS_STATUS_MAP.false);

const formatDateTime = (value) => (value ? new Date(value).toLocaleString('ko-KR') : '-');

const formatProcessAction = (action) => PROCESS_ACTION_MAP[action] || String(action || '-').replaceAll('_', ' ');

const formatTypeLabel = (type) => TYPE_LABEL_MAP[type] || String(type || '-').replaceAll('_', ' ');

const getStoreInfo = (item) => item?.store || {
  storeId: item?.storeId,
  title: item?.storeTitle,
};

const toDateInputValue = (value) => (value ? String(value).slice(0, 10) : '');

const buildStoreFormValues = (store) => ({
  title: store?.title || '',
  fandomCategoryIds: Array.isArray(store?.fandomCategories)
    ? store.fandomCategories.map((item) => item.fandomCategoryId)
    : [],
  description: store?.description || '',
  address: store?.address || '',
  addressDetail: store?.addressDetail || '',
  zip: store?.zip || '',
  latitude: store?.latitude ?? '',
  longitude: store?.longitude ?? '',
  phoneNumber: store?.phoneNumber || '',
  startDate: toDateInputValue(store?.startDate),
  finishDate: toDateInputValue(store?.finishDate),
  keywords: Array.isArray(store?.keywords) ? store.keywords : [],
  operationHours: Array.isArray(store?.operationHours)
    ? store.operationHours.map((item) => ({
      day: item.day || '',
      open: item.open || '',
      close: item.close || '',
    }))
    : [],
  links: Array.isArray(store?.links)
    ? store.links.map((item) => ({
      title: item.title || '',
      link: item.link || '',
    }))
    : [],
});

export default function StoreReports() {
  const [form] = Form.useForm();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeFeedbackType, setActiveFeedbackType] = useState(FEEDBACK_TABS.REPORT);
  const [processedFilter, setProcessedFilter] = useState(UNPROCESSED_FILTER);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [detail, setDetail] = useState(null);
  const [storeDetailLoading, setStoreDetailLoading] = useState(false);
  const [storeDetailLoaded, setStoreDetailLoaded] = useState(false);
  const [processingKey, setProcessingKey] = useState(null);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const { notification } = App.useApp();

  const fetchCategories = useCallback(async () => {
    try {
      const res = await client.get('/shared/fandom-category');
      const list = Array.isArray(res.data?.results) ? res.data.results : Array.isArray(res.data) ? res.data : [];
      setCategories(list);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '팬덤 카테고리 조회 실패';
      notification.error({ message: '카테고리 조회 실패', description: msg });
    }
  }, [notification]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const fetchData = useCallback(async ({
    cursor = '',
    type = activeFeedbackType,
    processed = processedFilter,
    append = false,
  } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = { next: cursor, size: PAGE_SIZE };
      const isProcessed = getProcessedParam(processed);

      if (isProcessed !== undefined) params.isProcessed = isProcessed;

      const res = await client.get(getStoreFeedbackListEndpoint(type), { params });
      const results = Array.isArray(res.data?.results) ? res.data.results : [];
      const list = normalizeStoreFeedbackItems(results, type);

      setData((prev) => (append ? [...prev, ...list] : list));
      setNextCursor(res.data?.next || null);
      setHasMore(!!res.data?.next);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '스토어 신고/수정 조회 실패';
      setError(msg);
      notification.error({ message: '조회 실패', description: msg });
    } finally {
      setLoading(false);
    }
  }, [activeFeedbackType, notification, processedFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sortedData = useMemo(
    () => sortStoreFeedbackItems(data, activeFeedbackType),
    [activeFeedbackType, data],
  );

  const handleLoadMore = () => {
    if (!nextCursor || loading) return;
    fetchData({ cursor: nextCursor, append: true });
  };

  const handleCloseDetail = () => {
    setDetail(null);
    setStoreDetailLoading(false);
    setStoreDetailLoaded(false);
    form.resetFields();
  };

  const handleTabChange = (nextType) => {
    handleCloseDetail();
    setData([]);
    setNextCursor(null);
    setHasMore(false);
    setActiveFeedbackType(nextType);
  };

  const handleOpenDetail = async (record) => {
    setDetail(record);
    setStoreDetailLoaded(false);
    form.resetFields();

    setStoreDetailLoading(true);
    try {
      const endpoint = record.feedbackType === 'EDIT_REQUEST'
        ? `/admin/store/edit-request/${record.id}`
        : `/admin/store/report/${record.id}`;
      const res = await client.get(endpoint);
      const nextDetail = {
        ...record,
        ...res.data,
        feedbackType: record.feedbackType,
        types: res.data?.types?.length ? res.data.types : record.types,
        content: res.data?.content ?? record.content,
      };

      setDetail(nextDetail);

      if (record.feedbackType === 'EDIT_REQUEST' && !nextDetail.isProcessed) {
        form.setFieldsValue(buildStoreFormValues(nextDetail.store));
        setStoreDetailLoaded(true);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '스토어 신고/수정 상세 조회 실패';
      notification.error({ message: '상세 조회 실패', description: msg });
    } finally {
      setStoreDetailLoading(false);
    }
  };

  const handleProcessReport = async (id, action) => {
    const key = `REPORT-${id}-${action}`;
    setProcessingKey(key);
    try {
      await client.post(`/admin/store/report/${id}/process`, { action });
      const actionLabel = action === 'HIDE_STORE' ? '상점 숨김' : '기각';
      notification.success({ message: '처리 완료', description: `신고가 ${actionLabel}(으)로 처리되었습니다.` });
      handleCloseDetail();
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '신고 처리 실패';
      notification.error({ message: '처리 실패', description: msg });
    } finally {
      setProcessingKey(null);
    }
  };

  const handleApplyEditRequest = async (values) => {
    if (!detail) return;

    if (values.startDate && values.finishDate && values.finishDate < values.startDate) {
      notification.error({
        message: '날짜 확인 필요',
        description: '종료일은 시작일보다 빠를 수 없습니다.',
      });
      return;
    }

    if (!hasValidCoordinates(values)) {
      notification.error({
        message: '좌표 확인 필요',
        description: '주소 검색으로 스토어 좌표를 먼저 확정해야 합니다.',
      });
      return;
    }

    const key = `${getRowKey(detail)}-APPLY`;
    setProcessingKey(key);
    try {
      await client.post(`/admin/store/edit-request/${detail.id}/apply`, buildStoreApplyRequest(values));
      notification.success({ message: '반영 완료', description: '수정 요청이 스토어에 반영되었습니다.' });
      handleCloseDetail();
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '수정 요청 반영 실패';
      notification.error({ message: '반영 실패', description: msg });
    } finally {
      setProcessingKey(null);
    }
  };

  const renderTypeTags = (types) => {
    if (!types?.length) return '-';

    return (
      <Space wrap size={[4, 4]}>
        {types.map((type) => (
          <Tag key={type} style={{ marginInlineEnd: 0 }}>
            {formatTypeLabel(type)}
          </Tag>
        ))}
      </Space>
    );
  };

  const handleAddressSearch = () => {
    setAddressModalOpen(true);
  };

  const handleAddressSelect = ({ address, zip, latitude, longitude }) => {
    form.setFieldsValue({ address, addressDetail: '', zip, latitude, longitude });
    notification.success({ message: '주소 반영 완료', description: '주소와 좌표가 함께 반영되었습니다.' });
  };

  const renderModalFooter = () => {
    if (!detail) return null;

    if (detail.isProcessed) {
      return (
        <Button onClick={handleCloseDetail}>
          닫기
        </Button>
      );
    }

    if (detail.feedbackType === 'EDIT_REQUEST') {
      return (
        <ModalFooter>
          <Button onClick={handleCloseDetail}>
            닫기
          </Button>
          <Button
            type="primary"
            loading={processingKey === `${getRowKey(detail)}-APPLY`}
            disabled={storeDetailLoading || !storeDetailLoaded}
            onClick={() => form.submit()}
          >
            수정 반영
          </Button>
        </ModalFooter>
      );
    }

    return (
      <ModalFooter>
        <Button onClick={handleCloseDetail}>
          닫기
        </Button>
        <Space>
          <Popconfirm
            title="신고를 기각할까요?"
            okText="기각"
            cancelText="취소"
            onConfirm={() => handleProcessReport(detail.id, 'DISMISS')}
          >
            <Button loading={processingKey === `${getRowKey(detail)}-DISMISS`} disabled={storeDetailLoading}>
              기각
            </Button>
          </Popconfirm>
          <Popconfirm
            title="상점을 숨기고 관련 미처리 신고를 함께 처리할까요?"
            okText="상점 숨김"
            cancelText="취소"
            onConfirm={() => handleProcessReport(detail.id, 'HIDE_STORE')}
          >
            <Button
              danger
              type="primary"
              loading={processingKey === `${getRowKey(detail)}-HIDE_STORE`}
              disabled={storeDetailLoading}
            >
              상점 숨김
            </Button>
          </Popconfirm>
        </Space>
      </ModalFooter>
    );
  };

  const renderEditRequestForm = () => {
    if (!detail || detail.feedbackType !== 'EDIT_REQUEST' || detail.isProcessed) return null;

    if (storeDetailLoading) return null;

    if (!storeDetailLoaded) {
      return (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
          message="상점 정보를 불러오지 못했습니다"
          description="수정 반영을 하려면 상세를 다시 열어 현재 상점 정보를 먼저 불러와야 합니다."
        />
      );
    }

    return (
      <Space direction="vertical" size={16} style={{ width: '100%', marginTop: 16 }}>
        <Alert
          type="info"
          showIcon
          message="수정 내용 반영"
          description="요청 내용을 확인하고 필요한 항목만 수정해 반영하세요."
        />
        <Form form={form} layout="vertical" onFinish={handleApplyEditRequest}>
          <Typography.Title level={5}>기본 정보</Typography.Title>
          <Form.Item label="제목" name="title">
            <Input />
          </Form.Item>
          <Form.Item
            label="카테고리"
            name="fandomCategoryIds"
            rules={[{ required: true, message: '카테고리를 하나 이상 선택해주세요.' }]}
            extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>처음 선택한 카테고리가 대표 카테고리로 지정됩니다.</Typography.Text>}
          >
            <Select
              mode="multiple"
              placeholder="카테고리 선택"
              options={categories.map((category) => ({
                value: category.fandomCategoryId,
                label: category.displayName,
              }))}
            />
          </Form.Item>
          <Form.Item label="설명" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="키워드">
            <Form.List name="keywords">
              {(fields, { add, remove }) => (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} align="baseline">
                      <Form.Item
                        {...restField}
                        name={name}
                        rules={[{ whitespace: true, message: '빈 키워드는 등록할 수 없습니다.' }]}
                      >
                        <Input placeholder="키워드" style={{ width: 240 }} />
                      </Form.Item>
                      <Button danger type="link" onClick={() => remove(name)}>
                        삭제
                      </Button>
                    </Space>
                  ))}
                  <Button disabled={fields.length >= 5} onClick={() => add('')}>
                    키워드 추가
                  </Button>
                </Space>
              )}
            </Form.List>
          </Form.Item>
          <Form.Item label="주소" name="address">
            <Input
              readOnly
              addonAfter={(
                <Button type="link" size="small" onClick={handleAddressSearch}>
                  주소 검색
                </Button>
              )}
            />
          </Form.Item>
          <Form.Item label="상세 주소" name="addressDetail">
            <Input placeholder="예: 2층, 101호, 팝업존 내부" />
          </Form.Item>
          <Form.Item label="우편번호" name="zip">
            <Input readOnly />
          </Form.Item>
          <Form.Item name="latitude" hidden>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="longitude" hidden>
            <Input type="number" />
          </Form.Item>
          <Form.Item label="전화번호" name="phoneNumber">
            <Input />
          </Form.Item>
          <Space wrap size={16}>
            <Form.Item label="시작일" name="startDate">
              <Input type="date" style={{ width: 180 }} />
            </Form.Item>
            <Form.Item label="종료일" name="finishDate">
              <Input type="date" style={{ width: 180 }} />
            </Form.Item>
          </Space>

          <Typography.Title level={5}>운영 시간</Typography.Title>
          <Form.List name="operationHours">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: '100%' }}>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} wrap align="baseline">
                    <Form.Item {...restField} name={[name, 'day']}>
                      <Input placeholder="요일" style={{ width: 120 }} />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'open']}>
                      <Input placeholder="오픈" style={{ width: 120 }} />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'close']}>
                      <Input placeholder="마감" style={{ width: 120 }} />
                    </Form.Item>
                    <Button danger type="link" onClick={() => remove(name)}>
                      삭제
                    </Button>
                  </Space>
                ))}
                <Button onClick={() => add({ day: '', open: '', close: '' })}>
                  운영 시간 추가
                </Button>
              </Space>
            )}
          </Form.List>

          <Typography.Title level={5} style={{ marginTop: 16 }}>링크</Typography.Title>
          <Form.List name="links">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: '100%' }}>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} wrap align="baseline">
                    <Form.Item {...restField} name={[name, 'title']}>
                      <Input placeholder="제목" style={{ width: 180 }} />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'link']}>
                      <Input placeholder="URL" style={{ width: 360 }} />
                    </Form.Item>
                    <Button danger type="link" onClick={() => remove(name)}>
                      삭제
                    </Button>
                  </Space>
                ))}
                <Button onClick={() => add({ title: '', link: '' })}>
                  링크 추가
                </Button>
              </Space>
            )}
          </Form.List>
        </Form>
      </Space>
    );
  };

  const renderDetailContent = () => {
    if (!detail) return null;

    const store = getStoreInfo(detail);
    const storeAddress = [store.address, store.addressDetail].filter(Boolean).join(' ');
    return (
      <>
        {storeDetailLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
            <Spin />
          </div>
        )}
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="ID">{detail.id}</Descriptions.Item>
          <Descriptions.Item label="유형">
            <Tag color={(FEEDBACK_TYPE_MAP[detail.feedbackType] || { color: 'default' }).color}>
              {(FEEDBACK_TYPE_MAP[detail.feedbackType] || { label: detail.feedbackType }).label}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="처리 상태">
            <Tag color={getProcessStatus(detail.isProcessed).color}>
              {getProcessStatus(detail.isProcessed).label}
            </Tag>
          </Descriptions.Item>
          {detail.isProcessed && (
            <Descriptions.Item label="처리일">{formatDateTime(detail.processedAt)}</Descriptions.Item>
          )}
          {detail.feedbackType === 'REPORT' && detail.isProcessed && (
            <Descriptions.Item label="처리 방식">{formatProcessAction(detail.processedAction)}</Descriptions.Item>
          )}
          <Descriptions.Item label="항목/사유">{renderTypeTags(detail.types)}</Descriptions.Item>
          <Descriptions.Item label="내용">{detail.content || '-'}</Descriptions.Item>
          <Descriptions.Item label={detail.feedbackType === 'REPORT' ? '대상 스토어' : '스토어'}>
            <Space direction="vertical" size={0}>
              <span>{store.title || '-'}</span>
              <Typography.Text type="secondary">스토어 ID {store.storeId || '-'}</Typography.Text>
            </Space>
          </Descriptions.Item>
          {detail.feedbackType === 'REPORT' && (
            <>
              <Descriptions.Item label="주소">{storeAddress || '-'}</Descriptions.Item>
              <Descriptions.Item label="전화번호">{store.phoneNumber || '-'}</Descriptions.Item>
              <Descriptions.Item label="기간">
                {store.startDate || '-'} ~ {store.finishDate || '-'}
              </Descriptions.Item>
            </>
          )}
          <Descriptions.Item label="제보자 ID">{detail.userId}</Descriptions.Item>
          <Descriptions.Item label="제보자 이메일">{detail.userEmail || '-'}</Descriptions.Item>
          <Descriptions.Item label="접수일">
            {formatDateTime(detail.createdAt)}
          </Descriptions.Item>
        </Descriptions>
        {renderEditRequestForm()}
      </>
    );
  };
  const displayIdColumn = {
    title: 'ID',
    dataIndex: 'id',
    key: 'id',
    width: 90,
  };

  const storeColumn = {
    title: '스토어',
    dataIndex: 'storeTitle',
    key: 'storeTitle',
    ellipsis: true,
    render: (title, record) => (
      <Space direction="vertical" size={0}>
        <span>{title || '-'}</span>
        <Typography.Text type="secondary">
          스토어 ID {record.storeId}
        </Typography.Text>
      </Space>
    ),
  };

  const statusColumn = {
    title: '처리 상태',
    dataIndex: 'isProcessed',
    key: 'isProcessed',
    width: 110,
    render: (isProcessed) => {
      const mappedStatus = getProcessStatus(isProcessed);
      return <Tag color={mappedStatus.color}>{mappedStatus.label}</Tag>;
    },
  };

  const createdAtColumn = {
    title: '접수일',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 180,
    render: formatDateTime,
  };

  const actionColumn = {
    title: '관리',
    key: 'action',
    width: 90,
    render: (_, record) => (
      <Button
        type="link"
        icon={!record.isProcessed ? <EditOutlined /> : null}
        onClick={() => handleOpenDetail(record)}
      >
        {record.isProcessed ? '보기' : '처리'}
      </Button>
    ),
  };

  const reportColumns = [
    displayIdColumn,
    storeColumn,
    {
      title: '신고 사유',
      dataIndex: 'types',
      key: 'types',
      render: renderTypeTags,
    },
    {
      title: '신고 내용',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (content) => content || '-',
    },
    {
      title: '신고자 ID',
      dataIndex: 'userId',
      key: 'userId',
      width: 100,
      render: (userId) => userId || '-',
    },
    statusColumn,
    createdAtColumn,
    actionColumn,
  ];

  const editRequestColumns = [
    displayIdColumn,
    storeColumn,
    {
      title: '요청 항목',
      dataIndex: 'types',
      key: 'types',
      render: renderTypeTags,
    },
    {
      title: '요청 내용',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (content) => content || '-',
    },
    {
      title: '요청자 ID',
      dataIndex: 'userId',
      key: 'userId',
      width: 100,
      render: (userId) => userId || '-',
    },
    statusColumn,
    createdAtColumn,
    actionColumn,
  ];

  const columns = activeFeedbackType === FEEDBACK_TABS.REPORT ? reportColumns : editRequestColumns;

  if (error && data.length === 0) {
    return (
      <div>
        <Header>
          <Typography.Title level={4} style={{ margin: 0 }}>스토어 신고/수정</Typography.Title>
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
        <Typography.Title level={4} style={{ margin: 0 }}>스토어 신고/수정</Typography.Title>
        <Space wrap>
          <Select
            value={processedFilter}
            onChange={setProcessedFilter}
            style={{ width: 140 }}
            options={[
              { value: ALL_FILTER, label: '전체 상태' },
              { value: UNPROCESSED_FILTER, label: '처리 필요' },
              { value: PROCESSED_FILTER, label: '처리 완료' },
            ]}
          />
        </Space>
      </Header>
      <Tabs
        activeKey={activeFeedbackType}
        items={FEEDBACK_TAB_ITEMS}
        onChange={handleTabChange}
      />
      <StyledTable
        columns={columns}
        dataSource={sortedData}
        rowKey={getRowKey}
        loading={loading}
        rowClassName={(record) => (!record.isProcessed ? 'unprocessed-feedback-row' : '')}
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
        title={detail?.feedbackType === 'REPORT' ? '스토어 신고 관리' : '스토어 수정 요청 관리'}
        open={!!detail}
        onCancel={handleCloseDetail}
        footer={renderModalFooter()}
        width={detail?.feedbackType === 'EDIT_REQUEST' && !detail?.isProcessed ? 960 : 760}
      >
        {renderDetailContent()}
      </Modal>
      <GoogleAddressSearchModal
        open={addressModalOpen}
        onClose={() => setAddressModalOpen(false)}
        onSelect={handleAddressSelect}
      />
    </div>
  );
}
