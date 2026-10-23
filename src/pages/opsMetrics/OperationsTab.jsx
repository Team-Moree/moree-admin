import { Row, Col, Table, Typography } from 'antd';
import { fetchOperationsMetrics } from '../../api/dashboard';
import { SoftCard, Toolbar, HintText, ErrorAlert, ReloadButton, formatNumber, useRemote } from './ui';

const { Text } = Typography;

const num = (title, dataIndex) => ({ title, dataIndex, align: 'right', render: formatNumber });

const storeColumns = [
  {
    title: '매장',
    dataIndex: 'title',
    render: (title, r) => (
      <div>
        <div>{title}</div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {r.address}
        </Text>
      </div>
    ),
  },
  num('수정 요청', 'editRequests'),
  num('신고', 'reports'),
  num('미처리', 'pending'),
  num('합계', 'total'),
];

const fandomColumns = [
  { title: '분야', dataIndex: 'category' },
  num('대기', 'pending'),
  num('승인', 'approved'),
  num('반려', 'rejected'),
];

const submissionColumns = [
  { title: '국가', dataIndex: 'country', width: 70 },
  { title: '지역', dataIndex: 'region' },
  num('대기', 'pending'),
  num('승인', 'approved'),
  num('반려', 'rejected'),
  num('숨김', 'hidden'),
];

export default function OperationsTab() {
  const { data, loading, error, load } = useRemote(fetchOperationsMetrics);

  return (
    <div>
      <Toolbar>
        <Text type="secondary">요청·제보 처리 현황</Text>
        <ReloadButton onClick={load} loading={loading} />
      </Toolbar>
      <ErrorAlert title="운영 지표 조회 실패" error={error} />
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <SoftCard title="수정 요청·신고 많은 매장">
            <Table
              columns={storeColumns}
              dataSource={data?.storesByRequests || []}
              rowKey="storeId"
              loading={loading}
              pagination={false}
              size="small"
            />
          </SoftCard>
        </Col>
        <Col xs={24} lg={12}>
          <SoftCard title="덕질 대상 등록 요청 (분야별)">
            <Table
              columns={fandomColumns}
              dataSource={data?.fandomTargetRequests || []}
              rowKey={(r) => r.categoryId ?? 'none'}
              loading={loading}
              pagination={false}
              size="small"
            />
          </SoftCard>
        </Col>
        <Col xs={24} lg={12}>
          <SoftCard title="매장 제보 (지역별)">
            <Table
              columns={submissionColumns}
              dataSource={data?.storeSubmissions || []}
              rowKey="region"
              loading={loading}
              pagination={false}
              size="small"
            />
            <HintText>앱에서 회원이 등록 요청한 매장 · 승인 상태별</HintText>
          </SoftCard>
        </Col>
      </Row>
    </div>
  );
}
