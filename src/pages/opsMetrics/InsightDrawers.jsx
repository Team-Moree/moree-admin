import { useCallback, useMemo } from 'react';
import { Drawer, Row, Col, Statistic, Table, Spin, Typography, Tag, Avatar, Descriptions, Image } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import {
  fetchFandomTargetInsights,
  fetchFolderDetail,
  fetchMemberDetail,
  fetchStoreDetail,
  fetchStoreInsights,
} from '../../api/dashboard';
import SupplyMap from './SupplyMap';
import { SoftCard, HintText, COLORS, ErrorAlert, formatDate, formatShort, formatNumber, formatRate, useRemote } from './ui';

const { Text } = Typography;

function FandomTargetInsights({ id }) {
  const fetcher = useCallback(() => fetchFandomTargetInsights(id), [id]);
  const { data, loading, error } = useRemote(fetcher);

  return (
    <Spin spinning={loading}>
      <ErrorAlert title="덕질 대상 인사이트 조회 실패" error={error} />
      {data && (
        <>
          <Statistic title="이 대상을 고른 회원" value={data.fans} suffix="명" />
          <SoftCard title="팬들이 발도장 찍은 매장" size="small" style={{ marginTop: 16, height: 'auto' }}>
            <Table
              dataSource={data.topStores || []}
              rowKey="storeId"
              pagination={false}
              size="small"
              columns={[
                { title: '매장', dataIndex: 'title' },
                { title: '방문 팬', dataIndex: 'fanVisitors', align: 'right', render: formatNumber },
              ]}
            />
          </SoftCard>
          <SoftCard title="같이 고른 덕질 대상" size="small" style={{ marginTop: 16, height: 'auto' }}>
            <Table
              dataSource={data.coLikedTargets || []}
              rowKey="fandomTargetId"
              pagination={false}
              size="small"
              columns={[
                { title: '덕질 대상', dataIndex: 'name' },
                { title: '겹치는 팬', dataIndex: 'sharedFans', align: 'right', render: formatNumber },
                { title: '비율', dataIndex: 'rate', align: 'right', render: formatRate },
              ]}
            />
            <HintText>비율 = 겹치는 팬 ÷ 이 대상 팬 수</HintText>
          </SoftCard>
        </>
      )}
    </Spin>
  );
}

const TOTALS = [
  { key: 'bookmarks', label: '북마크' },
  { key: 'stamps', label: '발도장' },
  { key: 'gachas', label: '뽑기' },
  { key: 'reviews', label: '리뷰' },
];

function StoreLocation({ id, title }) {
  const fetcher = useCallback(() => fetchStoreDetail(id), [id]);
  const { data } = useRemote(fetcher);
  const points = useMemo(
    () =>
      data?.latitude != null && data?.longitude != null
        ? [{ storeId: id, title, latitude: data.latitude, longitude: data.longitude, isPopup: !!data.startDate }]
        : [],
    [data, id, title],
  );
  const images = data?.imageUrls || [];
  if (!data) return null;
  return (
    <>
      {images.length > 0 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 12 }}>
          <Image.PreviewGroup>
            {images.map((url, i) => (
              <Image
                key={`${url}-${i}`}
                src={url}
                width={120}
                height={120}
                style={{ objectFit: 'cover', borderRadius: 8 }}
              />
            ))}
          </Image.PreviewGroup>
        </div>
      )}
      {points.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <SupplyMap points={points} country="한국" height={220} />
        </div>
      )}
    </>
  );
}

function StoreInsights({ id }) {
  const fetcher = useCallback(() => fetchStoreInsights(id, { weeks: 12 }), [id]);
  const { data, loading, error } = useRemote(fetcher);
  const weekly = (data?.weekly || []).map((w) => ({ ...w, label: formatShort(w.weekStart) }));

  return (
    <Spin spinning={loading}>
      <ErrorAlert title="매장 인사이트 조회 실패" error={error} />
      {data && (
        <>
          <Text type="secondary">{data.address}</Text>
          <StoreLocation id={id} title={data.title} />
          <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
            {TOTALS.map((t) => (
              <Col span={6} key={t.key}>
                <Statistic title={t.label} value={data.totals?.[t.key] ?? '-'} />
              </Col>
            ))}
          </Row>
          <SoftCard title="주별 추이 (최근 12주)" size="small" style={{ marginTop: 16, height: 'auto' }}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weekly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip labelFormatter={(_, payload) => `${formatDate(payload?.[0]?.payload?.weekStart)} 주`} />
                <Legend />
                <Line type="monotone" dataKey="bookmarks" name="북마크" stroke={COLORS.blue} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="stamps" name="발도장" stroke={COLORS.green} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="gachas" name="뽑기" stroke={COLORS.orange} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </SoftCard>
          <SoftCard title="방문 회원의 덕질 대상" size="small" style={{ marginTop: 16, height: 'auto' }}>
            <Table
              dataSource={data.visitorFandoms || []}
              rowKey="fandomTargetId"
              pagination={false}
              size="small"
              columns={[
                { title: '덕질 대상', dataIndex: 'name' },
                { title: '방문 회원', dataIndex: 'visitors', align: 'right', render: formatNumber },
                { title: '비율', dataIndex: 'rate', align: 'right', render: formatRate },
              ]}
            />
            <HintText>발도장·뽑기 한 회원 중 그 대상을 고른 비율</HintText>
          </SoftCard>
        </>
      )}
    </Spin>
  );
}

export function FandomTargetDrawer({ target, onClose }) {
  return (
    <Drawer title={target?.name} open={!!target} onClose={onClose} size={560} destroyOnHidden>
      {target && <FandomTargetInsights id={target.id} />}
    </Drawer>
  );
}

export function StoreDrawer({ store, onClose }) {
  return (
    <Drawer title={store?.title} open={!!store} onClose={onClose} size={640} destroyOnHidden>
      {store && <StoreInsights id={store.id} />}
    </Drawer>
  );
}

const formatDateTime = (d) => (d ? dayjs(d).format('YYYY.MM.DD HH:mm') : '-');
const popupTag = (isPopup) => (isPopup ? <Tag color="magenta">팝업</Tag> : <Tag>상설</Tag>);
const STATUS_LABEL = { ACTIVE: '회원', WITHDRAWAL_PENDING: '탈퇴 대기', WITHDRAWN: '탈퇴' };
const ACTIVITY_LABEL = { STAMP: '발도장', GACHA: '뽑기', REVIEW: '리뷰' };

function FolderDetail({ id }) {
  const fetcher = useCallback(() => fetchFolderDetail(id), [id]);
  const { data, loading, error } = useRemote(fetcher);

  return (
    <Spin spinning={loading}>
      <ErrorAlert title="폴더 조회 실패" error={error} />
      {data && (
        <>
          <Text type="secondary">
            {data.ownerNickname} · {data.isPublic ? '공개' : '비공개'} · 복사 {formatNumber(data.copyCount)}회
          </Text>
          {data.description && <div style={{ marginTop: 4 }}>{data.description}</div>}
          <SoftCard title={`담긴 매장 ${formatNumber(data.stores?.length)}곳`} size="small" style={{ marginTop: 16, height: 'auto' }}>
            <Table
              dataSource={data.stores || []}
              rowKey="storeId"
              pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: false }}
              size="small"
              columns={[
                {
                  title: '매장',
                  dataIndex: 'title',
                  render: (title, r) => (
                    <div>
                      <div>
                        {title} {r.approvalStatus !== 'APPROVED' && <Tag color="default">{r.approvalStatus}</Tag>}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {r.address}
                      </Text>
                    </div>
                  ),
                },
                { title: '유형', dataIndex: 'isPopup', width: 70, render: popupTag },
                { title: '담은 날', dataIndex: 'addedAt', width: 110, render: formatDate },
              ]}
            />
            <HintText>최근 담은 순</HintText>
          </SoftCard>
        </>
      )}
    </Spin>
  );
}

const MEMBER_COUNTS = [
  { key: 'stamps', label: '발도장' },
  { key: 'gachas', label: '뽑기' },
  { key: 'reviews', label: '리뷰' },
  { key: 'bookmarks', label: '북마크' },
  { key: 'followers', label: '팔로워' },
  { key: 'followings', label: '팔로잉' },
  { key: 'openAlarms', label: '오픈 알림' },
  { key: 'activeDays', label: '접속일' },
];

function MemberDetail({ id }) {
  const fetcher = useCallback(() => fetchMemberDetail(id), [id]);
  const { data, loading, error } = useRemote(fetcher);

  return (
    <Spin spinning={loading}>
      <ErrorAlert title="회원 조회 실패" error={error} />
      {data && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar size={48} src={data.profileImageUrl || undefined} icon={<UserOutlined />} />
            <div>
              <div style={{ fontWeight: 600 }}>
                {data.nickname} <Text type="secondary">({data.userId})</Text>{' '}
                <Tag color={data.status === 'ACTIVE' ? 'green' : 'red'}>{STATUS_LABEL[data.status] || data.status}</Tag>
              </div>
              {data.description && <Text type="secondary">{data.description}</Text>}
            </div>
          </div>
          <Descriptions bordered column={1} size="small" style={{ marginTop: 16 }}>
            <Descriptions.Item label="이메일">
              {(data.socialAccounts || []).length
                ? data.socialAccounts.map((a) => (
                    <div key={`${a.provider}-${a.linkedAt}`}>
                      <Tag>{a.provider}</Tag>
                      {a.email || <Text type="secondary">-</Text>}
                    </div>
                  ))
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="가입">{formatDateTime(data.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="마지막 접속">{formatDate(data.lastActiveDate)}</Descriptions.Item>
            {data.withdrawnAt && <Descriptions.Item label="탈퇴 요청">{formatDateTime(data.withdrawnAt)}</Descriptions.Item>}
            <Descriptions.Item label="성별 · 생일">
              {data.gender} · {formatDate(data.birthday)}
            </Descriptions.Item>
            <Descriptions.Item label="덕질 대상">
              {(data.fandomTargets || []).length ? data.fandomTargets.map((t) => <Tag key={t}>{t}</Tag>) : '-'}
            </Descriptions.Item>
          </Descriptions>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            {MEMBER_COUNTS.map((c) => (
              <Col span={6} key={c.key}>
                <Statistic title={c.label} value={data.counts?.[c.key] ?? '-'} />
              </Col>
            ))}
          </Row>
          <SoftCard title="최근 활동" size="small" style={{ marginTop: 16, height: 'auto' }}>
            <Table
              dataSource={data.recentActivities || []}
              rowKey={(r) => `${r.kind}-${r.storeId}-${r.at}`}
              pagination={false}
              size="small"
              columns={[
                { title: '날짜', dataIndex: 'at', width: 110, render: formatDate },
                { title: '활동', dataIndex: 'kind', width: 80, render: (k) => <Tag>{ACTIVITY_LABEL[k] || k}</Tag> },
                { title: '매장', dataIndex: 'title' },
              ]}
            />
            <HintText>발도장·뽑기·리뷰 최근 20건 · 접속일은 2026.10.06 부터 기록</HintText>
          </SoftCard>
          <SoftCard title="북마크 폴더" size="small" style={{ marginTop: 16, height: 'auto' }}>
            <Table
              dataSource={data.folders || []}
              rowKey="folderId"
              pagination={false}
              size="small"
              columns={[
                { title: '폴더', dataIndex: 'title' },
                { title: '공개', dataIndex: 'isPublic', width: 60, render: (v) => (v ? '공개' : '비공개') },
                { title: '매장', dataIndex: 'storeCount', align: 'right', width: 60, render: formatNumber },
                { title: '복사', dataIndex: 'copyCount', align: 'right', width: 60, render: formatNumber },
              ]}
            />
          </SoftCard>
        </>
      )}
    </Spin>
  );
}

export function FolderDrawer({ folder, onClose }) {
  return (
    <Drawer title={folder?.title} open={!!folder} onClose={onClose} size={600} destroyOnHidden>
      {folder && <FolderDetail id={folder.id} />}
    </Drawer>
  );
}

export function MemberDrawer({ member, onClose }) {
  return (
    <Drawer title={member?.nickname || '회원 상세'} open={!!member} onClose={onClose} size={640} destroyOnHidden>
      {member && <MemberDetail id={member.id} />}
    </Drawer>
  );
}
