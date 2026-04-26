import { useCallback, useEffect, useState } from 'react';
import {
  App,
  Button,
  Descriptions,
  Image,
  Popconfirm,
  Result,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  Modal,
} from 'antd';
import { EditOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import client from '../api/client';

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 4px;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
`;

const DetailSection = styled.div`
  margin-top: 16px;
`;

const SectionTitle = styled(Typography.Title)`
  margin: 0 0 12px !important;
`;

const ModalFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`;

const StyledTable = styled(Table)`
  .ant-table-thead > tr > th {
    white-space: nowrap;
    word-break: keep-all;
  }

  .unprocessed-report-row > td {
    background: #fff8e8 !important;
  }

  .unprocessed-report-row:hover > td {
    background: #fff1cc !important;
  }

  .unprocessed-report-row > td:first-child {
    box-shadow: inset 4px 0 0 #faad14;
  }
`;

const DetailDescriptions = styled(Descriptions)`
  .ant-descriptions-item-label {
    width: 160px;
    min-width: 160px;
  }
`;

const ReviewSummary = styled.div`
  min-width: 0;
`;

const ReviewMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  min-width: 0;
`;

const ReviewContent = styled(Typography.Text)`
  display: block;
  max-width: 420px;
  margin-top: 2px;
`;

const PAGE_SIZE = 50;
const ALL_FILTER = 'ALL';
const UNPROCESSED_FILTER = 'UNPROCESSED';
const PROCESSED_FILTER = 'PROCESSED';

const PROCESSED_FILTER_OPTIONS = [
  { value: ALL_FILTER, label: '전체 상태' },
  { value: UNPROCESSED_FILTER, label: '처리 필요' },
  { value: PROCESSED_FILTER, label: '처리 완료' },
];

const PROCESS_STATUS_MAP = {
  true: { color: 'green', label: '처리 완료' },
  false: { color: 'orange', label: '처리 필요' },
};

const REPORT_TYPE_MAP = {
  HARASSMENT: { color: 'magenta', label: '욕설 및 비속어 사용' },
  FALSE_INFO: { color: 'volcano', label: '허위 정보 또는 사실과 다른 내용' },
  SPAM: { color: 'orange', label: '광고 또는 홍보 목적의 글' },
  COPYRIGHT: { color: 'geekblue', label: '개인 정보 노출' },
  INAPPROPRIATE: { color: 'red', label: '음란/선정적인 내용' },
  OTHER: { color: 'default', label: '기타' },
  '욕설 및 비속어 사용': { color: 'magenta', label: '욕설 및 비속어 사용' },
  '허위 정보 또는 사실과 다른 내용': { color: 'volcano', label: '허위 정보 또는 사실과 다른 내용' },
  '광고 또는 홍보 목적의 글': { color: 'orange', label: '광고 또는 홍보 목적의 글' },
  '개인 정보 노출': { color: 'geekblue', label: '개인 정보 노출' },
  '음란/선정적인 내용': { color: 'red', label: '음란/선정적인 내용' },
  기타: { color: 'default', label: '기타' },
};

const PROCESS_ACTIONS = [
  {
    value: 'DISMISS',
    label: '기각',
    danger: false,
    confirmTitle: '신고를 기각할까요?',
  },
  {
    value: 'HIDE_REVIEW',
    label: '후기 숨김',
    danger: true,
    confirmTitle: '후기를 숨기고 관련 미처리 신고를 함께 처리할까요?',
  },
];

const PROCESS_ACTION_LABELS = {
  REJECT: '기각',
  DISMISS: '기각',
  HIDE_REVIEW: '후기 숨김',
};

const PROCESS_MODE_LABELS = {
  DIRECT: '직접 처리',
  CASCADE: '함께 처리',
};

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ko-KR');
}

function getProcessedParam(filter) {
  if (filter === PROCESSED_FILTER) return true;
  if (filter === UNPROCESSED_FILTER) return false;
  return undefined;
}

function getProcessStatus(isProcessed) {
  return isProcessed === true ? PROCESS_STATUS_MAP.true : PROCESS_STATUS_MAP.false;
}

function renderReportTypes(types) {
  if (!Array.isArray(types) || types.length === 0) return '-';

  return (
    <Space wrap size={[4, 4]}>
      {types.map((type) => {
        const meta = REPORT_TYPE_MAP[type] || { color: 'default', label: type };
        return (
          <Tag key={type} color={meta.color} style={{ marginInlineEnd: 0 }}>
            {meta.label}
          </Tag>
        );
      })}
    </Space>
  );
}

function renderContent(content) {
  return content || <Typography.Text type="secondary">-</Typography.Text>;
}

function getReviewImageUrls(review) {
  const candidates = [
    review?.imageUrls,
    review?.images,
    review?.photoUrls,
    review?.photos,
  ];

  const values = candidates.find((candidate) => Array.isArray(candidate)) || [];

  return values
    .map((item) => (typeof item === 'string' ? item : item?.imageUrl || item?.url))
    .filter(Boolean);
}

function getStoreLabel(review) {
  return review?.storeTitle || review?.storeName || review?.store?.title || null;
}

function renderReporter(record) {
  if (!record.reporterUserEmail) {
    return (
      <Typography.Text type="secondary">
        ID {record.reporterUserId || '-'}
      </Typography.Text>
    );
  }

  return (
    <Space direction="vertical" size={0}>
      <span>{record.reporterUserEmail}</span>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        ID {record.reporterUserId || '-'}
      </Typography.Text>
    </Space>
  );
}

function renderStoreInfo(review) {
  const storeTitle = getStoreLabel(review);

  return (
    <Space direction="vertical" size={0}>
      <span>{storeTitle || '상점명 없음'}</span>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        ID {review?.storeId || '-'}
      </Typography.Text>
    </Space>
  );
}

function renderReviewAuthor(review) {
  if (!review?.authorUserEmail) {
    return (
      <Typography.Text type="secondary">
        ID {review?.authorUserId || '-'}
      </Typography.Text>
    );
  }

  return (
    <Space direction="vertical" size={0}>
      <span>{review.authorUserEmail}</span>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        ID {review.authorUserId || '-'}
      </Typography.Text>
    </Space>
  );
}

function renderReviewImages(review) {
  const imageUrls = getReviewImageUrls(review);

  if (!imageUrls.length) return '-';

  return (
    <Space wrap>
      {imageUrls.map((imageUrl, index) => (
        <Image key={`${imageUrl}-${index}`} src={imageUrl} width={120} />
      ))}
    </Space>
  );
}

export default function ReviewReports() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [processedFilter, setProcessedFilter] = useState(UNPROCESSED_FILTER);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const { notification } = App.useApp();

  const fetchData = useCallback(async (cursor = '') => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get('/admin/review/report/list', {
        params: {
          isProcessed: getProcessedParam(processedFilter),
          next: cursor,
          size: PAGE_SIZE,
        },
      });
      const list = Array.isArray(res.data?.results) ? res.data.results : [];
      setData((prev) => (cursor ? [...prev, ...list] : list));
      setNextCursor(res.data?.next || null);
      setHasMore(!!res.data?.next);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '리뷰 신고 조회 실패';
      setError(msg);
      notification.error({ message: '조회 실패', description: msg });
    } finally {
      setLoading(false);
    }
  }, [notification, processedFilter]);

  const fetchDetail = useCallback(async (reportId) => {
    setDetailLoading(true);
    try {
      const res = await client.get(`/admin/review/report/${reportId}`);
      setDetail(res.data);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '리뷰 신고 상세 조회 실패';
      notification.error({ message: '상세 조회 실패', description: msg });
    } finally {
      setDetailLoading(false);
    }
  }, [notification]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openDetail = (record) => {
    setDetail(record);
    setDetailOpen(true);
    fetchDetail(record.id);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetail(null);
  };

  const handleLoadMore = () => {
    if (!nextCursor || loading) return;
    fetchData(nextCursor);
  };

  const handleProcess = async (record, action) => {
    const actionMeta = PROCESS_ACTIONS.find((item) => item.value === action);
    if (!record || !actionMeta) return;

    setProcessingId(`${record.id}-${action}`);
    try {
      await client.post(`/admin/review/report/${record.id}/process`, { action });
      notification.success({
        message: '처리 완료',
        description: `리뷰 신고가 ${actionMeta.label}(으)로 처리되었습니다.`,
      });
      closeDetail();
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '리뷰 신고 처리 실패';
      notification.error({ message: '처리 실패', description: msg });
    } finally {
      setProcessingId(null);
    }
  };

  const renderModalFooter = () => {
    if (!detail) return null;

    if (detail.isProcessed) {
      return (
        <Button onClick={closeDetail}>
          닫기
        </Button>
      );
    }

    return (
      <ModalFooter>
        <Button onClick={closeDetail}>
          닫기
        </Button>
        <Space>
          {PROCESS_ACTIONS.map((action) => (
            <Popconfirm
              key={action.value}
              title={action.confirmTitle}
              okText={action.label}
              cancelText="취소"
              onConfirm={() => handleProcess(detail, action.value)}
            >
              <Button
                danger={action.danger}
                type={action.danger ? 'primary' : 'default'}
                loading={processingId === `${detail.id}-${action.value}`}
                disabled={detailLoading}
              >
                {action.label}
              </Button>
            </Popconfirm>
          ))}
        </Space>
      </ModalFooter>
    );
  };

  const renderReviewSummary = (review) => (
    <ReviewSummary>
      <ReviewContent ellipsis>
        {review?.content || '리뷰 내용 없음'}
      </ReviewContent>
      <ReviewMeta>
        <Typography.Text type="secondary">{getStoreLabel(review) || '상점명 없음'}</Typography.Text>
        {!getStoreLabel(review) && review?.storeId && (
          <Typography.Text type="secondary">ID {review.storeId}</Typography.Text>
        )}
        {review?.isHidden && <Tag color="red" style={{ marginInlineEnd: 0 }}>숨김</Tag>}
      </ReviewMeta>
    </ReviewSummary>
  );

  const renderDetailContent = () => {
    if (!detail) return null;

    const processStatus = getProcessStatus(detail.isProcessed);

    return (
      <>
        {detailLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
            <Spin />
          </div>
        )}
        <Spin spinning={detailLoading}>
          <SectionTitle level={5}>신고 정보</SectionTitle>
          <DetailDescriptions bordered column={1} size="small">
            <Descriptions.Item label="신고 ID">{detail.id}</Descriptions.Item>
            <Descriptions.Item label="처리 상태">
              <Tag color={processStatus.color}>{processStatus.label}</Tag>
            </Descriptions.Item>
            {detail.isProcessed && (
              <Descriptions.Item label="처리일">{formatDate(detail.processedAt)}</Descriptions.Item>
            )}
            {detail.isProcessed && (
              <Descriptions.Item label="처리 방식">
                {PROCESS_ACTION_LABELS[detail.processedAction] || String(detail.processedAction || '-').replaceAll('_', ' ')}
              </Descriptions.Item>
            )}
            {detail.isProcessed && (
              <Descriptions.Item label="처리 구분">
                {PROCESS_MODE_LABELS[detail.processedMode] || '-'}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="신고 사유">
              {renderReportTypes(detail.types)}
            </Descriptions.Item>
            <Descriptions.Item label="신고 내용">{detail.content || '-'}</Descriptions.Item>
            <Descriptions.Item label="신고자">{renderReporter(detail)}</Descriptions.Item>
            <Descriptions.Item label="접수일">{formatDate(detail.createdAt)}</Descriptions.Item>
          </DetailDescriptions>

          <DetailSection>
            <SectionTitle level={5}>신고 대상 리뷰</SectionTitle>
            {detail.review ? (
              <DetailDescriptions bordered column={1} size="small">
                <Descriptions.Item label="리뷰 ID">{detail.review.reviewId}</Descriptions.Item>
                <Descriptions.Item label="내용">
                  <Typography.Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {detail.review.content || '-'}
                  </Typography.Paragraph>
                </Descriptions.Item>
                <Descriptions.Item label="사진">{renderReviewImages(detail.review)}</Descriptions.Item>
                <Descriptions.Item label="대상 스토어">{renderStoreInfo(detail.review)}</Descriptions.Item>
                <Descriptions.Item label="작성자">{renderReviewAuthor(detail.review)}</Descriptions.Item>
                <Descriptions.Item label="노출 상태">
                  <Tag color={detail.review.isHidden ? 'red' : 'green'}>
                    {detail.review.isHidden ? '숨김' : '노출'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="작성일">{formatDate(detail.review.createdAt)}</Descriptions.Item>
              </DetailDescriptions>
            ) : (
              <Result
                status="info"
                title="대상 리뷰 정보가 없습니다"
                subTitle="리뷰가 삭제되었거나 서버에서 상세 정보를 내려주지 않았습니다."
              />
            )}
          </DetailSection>
        </Spin>
      </>
    );
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 90,
    },
    {
      title: '리뷰',
      key: 'review',
      ellipsis: true,
      render: (_, record) => renderReviewSummary(record.review),
    },
    {
      title: '신고 사유',
      dataIndex: 'types',
      key: 'types',
      render: renderReportTypes,
    },
    {
      title: '신고 내용',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: renderContent,
    },
    {
      title: '신고자 ID',
      key: 'reporter',
      width: 100,
      render: (_, record) => renderReporter(record),
    },
    {
      title: '처리 상태',
      dataIndex: 'isProcessed',
      key: 'isProcessed',
      width: 110,
      render: (isProcessed) => (
        <Tag color={getProcessStatus(isProcessed).color}>
          {getProcessStatus(isProcessed).label}
        </Tag>
      ),
    },
    {
      title: '접수일',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: formatDate,
    },
    {
      title: '관리',
      key: 'action',
      width: 90,
      render: (_, record) => (
        <Button
          type="link"
          icon={!record.isProcessed ? <EditOutlined /> : null}
          onClick={() => openDetail(record)}
        >
          {record.isProcessed ? '보기' : '처리'}
        </Button>
      ),
    },
  ];

  if (error && data.length === 0) {
    return (
      <div>
        <Header>
          <Typography.Title level={4} style={{ margin: 0 }}>리뷰 신고</Typography.Title>
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
        <Typography.Title level={4} style={{ margin: 0 }}>리뷰 신고</Typography.Title>
        <Select
          value={processedFilter}
          options={PROCESSED_FILTER_OPTIONS}
          onChange={setProcessedFilter}
          style={{ width: 140 }}
        />
      </Header>

      <StyledTable
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        rowClassName={(record) => (!record.isProcessed ? 'unprocessed-report-row' : '')}
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
        title="리뷰 신고 관리"
        open={detailOpen}
        onCancel={closeDetail}
        footer={renderModalFooter()}
        width={760}
      >
        {renderDetailContent()}
      </Modal>
    </div>
  );
}
