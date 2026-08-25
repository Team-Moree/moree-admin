import { useCallback, useEffect, useRef, useState } from 'react';
import { Table, Tag, Typography, Result, Button, App, Select, Space, Modal, Image, Spin, Popconfirm, Alert, Input, Form, DatePicker, Upload, Switch, Segmented } from 'antd';
import { CloseOutlined, DeleteOutlined, EditOutlined, HolderOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import dayjs from 'dayjs';
import client from '../api/client';
import GoogleAddressSearchModal from '../components/GoogleAddressSearchModal';

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

  .hidden-store-row > td {
    opacity: 0.5;
  }

  .hidden-store-row:hover > td {
    opacity: 0.75;
  }
`;

const StoreForm = styled(Form)`
  .store-form-section-title {
    margin: 24px 0 12px !important;
    padding-top: 18px;
    border-top: 1px solid #f0f0f0;
  }

  .store-form-section-title:first-child {
    margin-top: 0 !important;
    padding-top: 0;
    border-top: 0;
  }

  .store-link-row {
    display: grid !important;
    grid-template-columns: 180px minmax(280px, 1fr) auto;
    gap: 8px;
    align-items: start;
    width: 100%;
  }

  .store-link-row .ant-form-item {
    margin-bottom: 8px;
  }

  @media (max-width: 720px) {
    .store-link-row {
      grid-template-columns: 1fr;
    }
  }

  .store-form-upload-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    cursor: grab;
  }

  .store-form-upload-item:active {
    cursor: grabbing;
  }

  .store-form-upload-item-content {
    flex: 1;
    min-width: 0;
  }

  .store-form-upload-item-handle {
    flex-shrink: 0;
    color: rgba(0, 0, 0, 0.45);
    font-size: 16px;
  }
`;

const DetailView = styled.div`
  .store-detail-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 8px;
  }

  .store-detail-title {
    margin: 0 0 8px;
    color: rgba(0, 0, 0, 0.88);
    font-size: 20px;
    font-weight: 700;
    line-height: 1.45;
  }

  .store-detail-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    color: rgba(0, 0, 0, 0.45);
    font-size: 13px;
    white-space: nowrap;
  }

  .store-detail-section-title {
    margin: 20px 0 12px !important;
    padding-top: 16px;
    border-top: 1px solid #f0f0f0;
  }

  .store-detail-section-title:first-child {
    margin-top: 0 !important;
    padding-top: 0;
    border-top: 0;
  }

  .store-detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px 16px;
  }

  .store-detail-item-full {
    grid-column: 1 / -1;
  }

  .store-detail-label {
    margin-bottom: 6px;
    color: rgba(0, 0, 0, 0.55);
    font-size: 13px;
    font-weight: 600;
  }

  .store-detail-value {
    color: rgba(0, 0, 0, 0.88);
    font-size: 15px;
    line-height: 1.55;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .store-detail-value-box {
    min-height: 40px;
    padding: 8px 11px;
    border: 1px solid #d9d9d9;
    border-radius: 6px;
    background: #fff;
  }

  .store-detail-description {
    max-height: 156px;
    overflow: auto;
  }

  .store-detail-tag-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .store-detail-hours {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .store-detail-image-list {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  @media (max-width: 720px) {
    .store-detail-header {
      display: block;
    }

    .store-detail-meta {
      margin-top: 8px;
    }

    .store-detail-grid {
      grid-template-columns: 1fr;
    }
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
const STORE_CREATE_ENDPOINT = '/admin/store';
const DAUM_POSTCODE_SCRIPT_URL = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
const NAVER_MAPS_SERVICE_WAIT_MS = 5000;
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
const KOREAN_WEEKDAYS_BY_DAY_INDEX = ['일', '월', '화', '수', '목', '금', '토'];
const dateToKoreanWeekday = (date) => KOREAN_WEEKDAYS_BY_DAY_INDEX[dayjs(date).day()];
const TIME_PATTERN = /^([01][0-9]|2[0-4]):[0-5][0-9]$/;
const LINK_TYPE_OPTIONS = [
  { value: 'HOMEPAGE', label: '홈페이지' },
  { value: 'PRE_RESERVATION', label: '사전예약' },
  { value: 'INSTAGRAM', label: '인스타그램' },
  { value: 'X', label: 'X' },
  { value: 'COMMUNITY', label: '커뮤니티' },
  { value: 'OPEN_CHAT', label: '오픈채팅' },
];
const LINK_TYPE_LABEL_MAP = Object.fromEntries(LINK_TYPE_OPTIONS.map((option) => [option.value, option.label]));
const LINK_TYPE_BY_LABEL = Object.fromEntries(LINK_TYPE_OPTIONS.map((option) => [option.label, option.value]));
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

let daumPostcodeScriptPromise;
let naverMapsScriptPromise;

const loadExternalScript = (src) => new Promise((resolve, reject) => {
  const existingScript = document.querySelector(`script[src="${src}"]`);
  if (existingScript) {
    existingScript.addEventListener('load', resolve, { once: true });
    existingScript.addEventListener('error', reject, { once: true });
    if (existingScript.dataset.loaded === 'true') resolve();
    return;
  }

  const script = document.createElement('script');
  script.src = src;
  script.async = true;
  script.onload = () => {
    script.dataset.loaded = 'true';
    resolve();
  };
  script.onerror = reject;
  document.head.appendChild(script);
});

const loadDaumPostcode = async () => {
  if (window.daum?.Postcode) return;
  daumPostcodeScriptPromise ||= loadExternalScript(DAUM_POSTCODE_SCRIPT_URL);
  await daumPostcodeScriptPromise;
};

const getNaverMapsScriptUrl = (clientId) =>
  `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}&submodules=geocoder`;

const waitForNaverMapsService = () => new Promise((resolve, reject) => {
  const startedAt = Date.now();

  const checkService = () => {
    if (window.naver?.maps?.Service) {
      resolve();
      return;
    }

    if (Date.now() - startedAt >= NAVER_MAPS_SERVICE_WAIT_MS) {
      reject(new Error('NAVER Maps Geocoder를 사용할 수 없습니다. 키, 허용 도메인, Geocoding API 설정을 확인하세요.'));
      return;
    }

    window.setTimeout(checkService, 100);
  };

  checkService();
});

const loadNaverMaps = async (clientId) => {
  if (window.naver?.maps?.Service) return;
  naverMapsScriptPromise ||= loadExternalScript(getNaverMapsScriptUrl(clientId));
  await naverMapsScriptPromise;
  await waitForNaverMapsService();
};

const geocodeAddress = async (address, clientId) => {
  await loadNaverMaps(clientId);

  return new Promise((resolve, reject) => {
    window.naver.maps.Service.geocode({ query: address }, (status, response) => {
      const addressResult = response?.v2?.addresses?.[0];

      if (status !== window.naver.maps.Service.Status.OK || !addressResult) {
        reject(new Error('주소 좌표를 찾을 수 없습니다.'));
        return;
      }

      resolve({
        latitude: Number(addressResult.y),
        longitude: Number(addressResult.x),
      });
    });
  });
};

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : value);

const normalizeOptionalText = (value) => {
  const normalizedValue = normalizeText(value);
  return normalizedValue || null;
};

const compactList = (items) => (Array.isArray(items) ? items.filter(Boolean) : []);

const HiddenBooleanField = () => null;

const isOperationDayActive = (hour) => hour?.isActive !== false && hour?.isActive !== 'false';

const getUploadedImageUrl = (data) => (
  data?.imageUrl
  || data?.url
  || data?.result?.imageUrl
  || data?.result?.url
  || data?.results?.[0]?.imageUrl
  || data?.results?.[0]?.url
  || data?.imageUrls?.[0]
);

const buildOperationHours = (values) => {
  if (values.useDateOperationHours) {
    return compactList(values.operationDates)
      .filter((item) => item?.date && item?.open && item?.close)
      .map((item) => ({
        day: dateToKoreanWeekday(item.date),
        open: normalizeText(item.open),
        close: normalizeText(item.close),
      }));
  }

  if (values.useCustomOperationHours) {
    return WEEKDAYS
      .map((day, index) => ({
        day,
        isActive: isOperationDayActive(values.operationHours?.[index]),
        open: normalizeText(values.operationHours?.[index]?.open),
        close: normalizeText(values.operationHours?.[index]?.close),
      }))
      .filter((item) => item.isActive && item.open && item.close)
      .map(({ isActive, ...item }) => item);
  }

  return WEEKDAYS.map((day) => ({
    day,
    open: normalizeText(values.commonOpen),
    close: normalizeText(values.commonClose),
  }));
};

const hasOperationHours = (values) => buildOperationHours(values).length > 0;

const buildStoreCreateRequest = (values, imageUrls) => {
  const request = {
    title: normalizeText(values.title),
    fandomCategoryIds: values.fandomCategoryIds,
    imageUrls,
    description: normalizeText(values.description),
    hasGacha: values.hasGacha === true,
    keywords: compactList(values.keywords).map(normalizeText).filter(Boolean),
    operationHours: buildOperationHours(values),
    location: {
      latitude: Number(values.latitude),
      longitude: Number(values.longitude),
      zip: normalizeText(values.zip),
      address: normalizeText(values.address),
      addressDetail: normalizeOptionalText(values.addressDetail),
    },
    phoneNumber: normalizeOptionalText(values.phoneNumber),
    links: compactList(values.links)
      .filter((item) => item?.type || item?.link)
      .map((item) => ({
        type: normalizeText(item.type),
        link: normalizeText(item.link),
      })),
  };

  if (values.period?.[0] && values.period?.[1]) {
    request.period = {
      start: dayjs(values.period[0]).format('YYYY-MM-DD'),
      finish: dayjs(values.period[1]).format('YYYY-MM-DD'),
    };
  }

  return request;
};

const buildStoreEditRequest = (values, imageUrls) => ({
  title: normalizeText(values.title),
  fandomCategoryIds: Array.isArray(values.fandomCategoryIds) ? values.fandomCategoryIds : [],
  imageUrls,
  description: normalizeText(values.description),
  address: normalizeText(values.address),
  addressDetail: normalizeOptionalText(values.addressDetail),
  zip: normalizeText(values.zip),
  latitude: Number(values.latitude),
  longitude: Number(values.longitude),
  phoneNumber: normalizeOptionalText(values.phoneNumber),
  startDate: values.period?.[0] ? dayjs(values.period[0]).format('YYYY-MM-DD') : null,
  finishDate: values.period?.[1] ? dayjs(values.period[1]).format('YYYY-MM-DD') : null,
  hasGacha: values.hasGacha === true,
  keywords: compactList(values.keywords).map(normalizeText).filter(Boolean),
  operationHours: buildOperationHours(values),
  links: compactList(values.links)
    .filter((item) => item?.type || item?.link)
    .map((item) => ({
      title: LINK_TYPE_LABEL_MAP[item.type] || normalizeText(item.type),
      link: normalizeText(item.link),
    })),
});

const getStoreEditFormValues = (store) => {
  const operationHours = Array.isArray(store?.operationHours) ? store.operationHours : [];
  const firstHour = operationHours[0] || {};
  const hasSameHours = operationHours.length === WEEKDAYS.length
    && operationHours.every((item) => item?.open === firstHour.open && item?.close === firstHour.close);
  const operationHourByDay = new Map(operationHours.map((item) => [item.day, item]));
  const useCustomOperationHours = operationHours.length > 0 && !hasSameHours;

  return {
    title: store?.title || '',
    description: store?.description || '',
    address: store?.address || '',
    addressDetail: store?.addressDetail || '',
    zip: store?.zip || '',
    latitude: store?.latitude ?? '',
    longitude: store?.longitude ?? '',
    phoneNumber: store?.phoneNumber || '',
    hasGacha: !!store?.hasGacha,
    period: store?.startDate && store?.finishDate
      ? [dayjs(store.startDate), dayjs(store.finishDate)]
      : null,
    fandomCategoryIds: Array.isArray(store?.fandomCategories)
      ? store.fandomCategories.map((item) => item.fandomCategoryId)
      : [],
    keywords: Array.isArray(store?.keywords) ? store.keywords : [],
    useCustomOperationHours,
    commonOpen: firstHour.open || '10:00',
    commonClose: firstHour.close || '20:00',
    operationHours: WEEKDAYS.map((day) => ({
      isActive: operationHourByDay.has(day),
      open: operationHourByDay.get(day)?.open || firstHour.open || '10:00',
      close: operationHourByDay.get(day)?.close || firstHour.close || '20:00',
    })),
    links: Array.isArray(store?.links)
      ? store.links.map((item) => ({
        type: item.type || LINK_TYPE_BY_LABEL[item.title] || '',
        link: item.link || '',
      }))
      : [],
  };
};

const getExistingImageFileList = (imageUrls) => (
  Array.isArray(imageUrls)
    ? imageUrls.map((imageUrl, index) => ({
      uid: `existing-${index}-${imageUrl}`,
      name: `image-${index + 1}`,
      status: 'done',
      url: imageUrl,
    }))
    : []
);

const moveFileListItem = (fileList, fromIndex, toIndex) => {
  if (fromIndex < 0 || toIndex < 0 || toIndex >= fileList.length) {
    return fileList;
  }
  const next = [...fileList];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};

const renderReorderableUploadItem = (fileList, setFileList, dragIndexRef) => (originNode, file) => {
  const index = fileList.findIndex((item) => item.uid === file.uid);

  const handleDragStart = (event) => {
    dragIndexRef.current = index;
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const fromIndex = dragIndexRef.current;
    dragIndexRef.current = null;
    if (fromIndex === null || fromIndex === index) {
      return;
    }
    setFileList((prev) => moveFileListItem(prev, fromIndex, index));
  };

  return (
    <div
      className="store-form-upload-item"
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <HolderOutlined className="store-form-upload-item-handle" />
      <div className="store-form-upload-item-content">{originNode}</div>
    </div>
  );
};

export default function Stores() {
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
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
  const [deletingId, setDeletingId] = useState(null);
  const [pendingNextStatus, setPendingNextStatus] = useState(null);
  const [pendingHasGacha, setPendingHasGacha] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createFileList, setCreateFileList] = useState([]);
  const [editFileList, setEditFileList] = useState([]);
  const createDragIndexRef = useRef(null);
  const editDragIndexRef = useRef(null);
  const [categories, setCategories] = useState([]);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [addressSearching, setAddressSearching] = useState(false);
  const [createAddressCountry, setCreateAddressCountry] = useState('domestic');
  const [useCustomOperationHours, setUseCustomOperationHours] = useState(false);
  const [createExcludedOperationDays, setCreateExcludedOperationDays] = useState([]);
  const [createOperationMode, setCreateOperationMode] = useState('common');
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editAddressModalOpen, setEditAddressModalOpen] = useState(false);
  const [editAddressSearching, setEditAddressSearching] = useState(false);
  const [editAddressCountry, setEditAddressCountry] = useState('domestic');
  const [useCustomEditOperationHours, setUseCustomEditOperationHours] = useState(false);
  const [editExcludedOperationDays, setEditExcludedOperationDays] = useState([]);
  const { notification } = App.useApp();
  const isAllStatusView = !statusFilter || statusFilter === ALL_STATUS;
  const isPendingDetail = detail?.approvalStatus === 'PENDING';
  const modalTitle = isPendingDetail ? '스토어 검토' : '스토어 상세';

  const editButton = (
    <Button
      key="edit"
      icon={<EditOutlined />}
      onClick={() => handleOpenEdit()}
      disabled={!detail}
    >
      정보 수정
    </Button>
  );

  const modalFooter = isPendingDetail ? (
    <ModalFooter>
      <Space>
        <Button key="cancel" onClick={() => setDetail(null)}>
          닫기
        </Button>
        {editButton}
      </Space>
      <Space>
        <Popconfirm
          key="reject"
          title="이 스토어를 거절할까요?"
          okText="거절"
          cancelText="취소"
          onConfirm={() => handleStatusChange(detail.storeId, 'REJECTED', !!detail?.hasGacha)}
        >
          <Button danger loading={statusUpdatingId === detail?.storeId}>
            거절
          </Button>
        </Popconfirm>
        <Popconfirm
          key="approve"
          title={(
            <Space direction="vertical" size={8}>
              <span>이 스토어를 승인할까요?</span>
              <Space size={6} onClick={(event) => event.stopPropagation()}>
                <Typography.Text>아이템 뽑기</Typography.Text>
                <Switch
                  size="small"
                  checked={pendingHasGacha}
                  onChange={setPendingHasGacha}
                  checkedChildren="ON"
                  unCheckedChildren="OFF"
                />
              </Space>
            </Space>
          )}
          okText="승인"
          cancelText="취소"
          onConfirm={() => handleStatusChange(detail.storeId, 'APPROVED', pendingHasGacha)}
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
        {editButton}
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
          onConfirm={() => handleStatusChange(detail.storeId, pendingNextStatus, !!detail?.hasGacha)}
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
      <Space>
        <Popconfirm
          key="delete"
          title="이 스토어를 삭제할까요?"
          description="사용자 앱에서 사라집니다. 완전 삭제는 아니라 되돌릴 수 있어요."
          okText="삭제"
          okButtonProps={{ danger: true }}
          cancelText="취소"
          onConfirm={() => handleDelete(detail.storeId)}
        >
          <Button
            danger
            icon={<DeleteOutlined />}
            disabled={detail?.approvalStatus === 'HIDDEN'}
            loading={deletingId === detail?.storeId}
          >
            삭제
          </Button>
        </Popconfirm>
        <Button
          key="close"
          onClick={() => {
            setDetail(null);
            setPendingNextStatus(null);
          }}
        >
          닫기
        </Button>
      </Space>
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
    setPendingHasGacha(false);
    setDetailLoading(true);
    try {
      const res = await client.get(`/admin/store/${storeId}`);
      setDetail(res.data);
      setPendingHasGacha(!!res.data?.hasGacha);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '스토어 상세 조회 실패';
      notification.error({ message: '상세 조회 실패', description: msg });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenEdit = () => {
    if (!detail) return;
    setEditOpen(true);
  };

  const handleCloseEdit = () => {
    setEditOpen(false);
    setEditSaving(false);
    setEditAddressSearching(false);
    setUseCustomEditOperationHours(false);
    setEditExcludedOperationDays([]);
    setEditFileList([]);
    editForm.resetFields();
  };

  useEffect(() => {
    if (!editOpen || !detail) return;

    const formValues = getStoreEditFormValues(detail);
    editForm.resetFields();
    editForm.setFieldsValue(formValues);
    setEditFileList(getExistingImageFileList(detail.imageUrls));
    setUseCustomEditOperationHours(formValues.useCustomOperationHours);
    setEditExcludedOperationDays(
      formValues.operationHours
        .map((hour, index) => (isOperationDayActive(hour) ? null : index))
        .filter((index) => index !== null),
    );
  }, [detail, editForm, editOpen]);

  const handleCloseCreate = () => {
    setCreateOpen(false);
    createForm.resetFields();
    setCreateFileList([]);
    setAddressSearching(false);
    setUseCustomOperationHours(false);
    setCreateExcludedOperationDays([]);
    setCreateOperationMode('common');
  };

  const handleOpenCreate = () => {
    createForm.resetFields();
    setUseCustomOperationHours(false);
    setCreateExcludedOperationDays([]);
    setCreateOperationMode('common');
    createForm.setFieldsValue({
      useCustomOperationHours: false,
      useDateOperationHours: false,
      commonOpen: '10:00',
      commonClose: '20:00',
      operationHours: WEEKDAYS.map(() => ({ isActive: true, open: '10:00', close: '20:00' })),
      operationDates: [],
      hasGacha: false,
      keywords: [],
      links: [],
    });
    setCreateFileList([]);
    setCreateOpen(true);
  };

  const handleDomesticAddressSearch = async (form, setSearching) => {
    const naverMapKey = import.meta.env.VITE_NAVER_MAP_KEY;

    if (!naverMapKey) {
      notification.error({
        message: '주소 검색 설정 필요',
        description: 'VITE_NAVER_MAP_KEY를 설정해야 주소 좌표를 확정할 수 있습니다.',
      });
      return;
    }

    setSearching(true);
    try {
      await loadDaumPostcode();
      new window.daum.Postcode({
        oncomplete: async (data) => {
          setSearching(true);
          const selectedAddress = data.roadAddress || data.jibunAddress || data.address;
          if (!selectedAddress) {
            notification.error({ message: '주소 선택 실패', description: '선택한 주소를 읽을 수 없습니다.' });
            setSearching(false);
            return;
          }

          try {
            const coordinates = await geocodeAddress(selectedAddress, naverMapKey);
            form.setFieldsValue({
              address: selectedAddress,
              addressDetail: '',
              zip: data.zonecode || '',
              latitude: coordinates.latitude,
              longitude: coordinates.longitude,
            });
            notification.success({ message: '주소 반영 완료', description: '주소와 좌표가 함께 반영되었습니다.' });
          } catch (err) {
            notification.error({
              message: '좌표 조회 실패',
              description: err.message || '선택한 주소의 좌표를 찾을 수 없습니다.',
            });
          } finally {
            setSearching(false);
          }
        },
        onclose: () => {
          setSearching(false);
        },
      }).open();
    } catch (err) {
      notification.error({
        message: '주소 검색 실패',
        description: err.message || '주소 검색 스크립트를 불러오지 못했습니다.',
      });
      setSearching(false);
    }
  };

  const handleAddressSearch = () => {
    if (createAddressCountry === 'overseas') {
      setAddressModalOpen(true);
      return;
    }
    handleDomesticAddressSearch(createForm, setAddressSearching);
  };

  const handleAddressSelect = ({ address, zip, latitude, longitude }) => {
    createForm.setFieldsValue({ address, addressDetail: '', zip, latitude, longitude });
    notification.success({ message: '주소 반영 완료', description: '주소와 좌표가 함께 반영되었습니다.' });
  };

  const handleEditAddressSearch = () => {
    if (editAddressCountry === 'overseas') {
      setEditAddressModalOpen(true);
      return;
    }
    handleDomesticAddressSearch(editForm, setEditAddressSearching);
  };

  const handleEditAddressSelect = ({ address, zip, latitude, longitude }) => {
    editForm.setFieldsValue({ address, addressDetail: '', zip, latitude, longitude });
    notification.success({ message: '주소 반영 완료', description: '주소와 좌표가 함께 반영되었습니다.' });
  };

  const handleOperationModeChange = (checked) => {
    const commonOpen = createForm.getFieldValue('commonOpen') || '10:00';
    const commonClose = createForm.getFieldValue('commonClose') || '20:00';

    setUseCustomOperationHours(checked);
    if (!checked) setCreateExcludedOperationDays([]);
    createForm.setFieldsValue({
      useCustomOperationHours: checked,
      operationHours: WEEKDAYS.map((_, index) => {
        const currentValue = createForm.getFieldValue(['operationHours', index]) || {};
        return {
          isActive: isOperationDayActive(currentValue),
          open: currentValue.open || commonOpen,
          close: currentValue.close || commonClose,
        };
      }),
    });
  };

  const handleCreateOperationModeChange = (mode) => {
    setCreateOperationMode(mode);
    handleOperationModeChange(mode === 'weekday');
    createForm.setFieldsValue({
      useDateOperationHours: mode === 'date',
      operationDates: mode === 'date' && !createForm.getFieldValue('operationDates')?.length
        ? [{ date: null, open: '10:00', close: '20:00' }]
        : createForm.getFieldValue('operationDates'),
    });
  };

  const handleEditOperationModeChange = (checked) => {
    const commonOpen = editForm.getFieldValue('commonOpen') || '10:00';
    const commonClose = editForm.getFieldValue('commonClose') || '20:00';

    setUseCustomEditOperationHours(checked);
    if (!checked) setEditExcludedOperationDays([]);
    editForm.setFieldsValue({
      useCustomOperationHours: checked,
      operationHours: WEEKDAYS.map((_, index) => {
        const currentValue = editForm.getFieldValue(['operationHours', index]) || {};
        return {
          isActive: isOperationDayActive(currentValue),
          open: currentValue.open || commonOpen,
          close: currentValue.close || commonClose,
        };
      }),
    });
  };

  const setOperationDayActive = (form, index, isActive, setExcludedDays) => {
    const currentHours = form.getFieldValue('operationHours') || [];
    const commonOpen = form.getFieldValue('commonOpen') || '10:00';
    const commonClose = form.getFieldValue('commonClose') || '20:00';

    setExcludedDays((days) => (
      isActive
        ? days.filter((dayIndex) => dayIndex !== index)
        : Array.from(new Set([...days, index])).sort((a, b) => a - b)
    ));

    form.setFieldsValue({
      operationHours: WEEKDAYS.map((_, currentIndex) => {
        const currentValue = currentHours[currentIndex] || {};
        if (currentIndex !== index) return currentValue;

        return {
          ...currentValue,
          isActive,
          open: isActive ? currentValue.open || commonOpen : null,
          close: isActive ? currentValue.close || commonClose : null,
        };
      }),
    });
  };

  const uploadStoreImages = async (fileList) => {
    const imageUrls = [];

    for (const file of fileList) {
      if (file.url) {
        imageUrls.push(file.url);
        continue;
      }

      const formData = new FormData();
      formData.append('images', file.originFileObj);

      const res = await client.post('/shared/upload-image', formData, {
        params: { imageType: 'STORE' },
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const imageUrl = getUploadedImageUrl(res.data);

      if (!imageUrl) {
        throw new Error('이미지 업로드 응답에서 URL을 찾을 수 없습니다.');
      }
      imageUrls.push(imageUrl);
    }

    return imageUrls;
  };

  const handleCreateSubmit = async () => {
    let values;
    try {
      values = await createForm.validateFields();
    } catch (err) {
      if (err?.errorFields) {
        notification.error({
          message: '입력 확인 필요',
          description: err.errorFields[0]?.errors?.[0] || '필수 항목을 확인해주세요.',
        });
        return;
      }
      throw err;
    }

    if (createFileList.length < 1 || createFileList.length > 5) {
      notification.error({
        message: '이미지 확인 필요',
        description: '스토어 이미지는 1개 이상 5개 이하로 등록해주세요.',
      });
      return;
    }

    if (!hasOperationHours(values)) {
      notification.error({
        message: '운영 시간 확인 필요',
        description: '운영 요일을 하나 이상 남겨주세요.',
      });
      return;
    }

    setCreating(true);
    try {
      const imageUrls = await uploadStoreImages(createFileList);
      await client.post(STORE_CREATE_ENDPOINT, buildStoreCreateRequest(values, imageUrls));
      notification.success({ message: '스토어 추가 완료', description: '새 스토어가 등록되었습니다.' });
      handleCloseCreate();
      fetchData({ status: statusFilter, search: searchKeyword });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '스토어 추가 실패';
      notification.error({ message: '추가 실패', description: msg });
    } finally {
      setCreating(false);
    }
  };

  const handleEditSubmit = async () => {
    if (!detail) return;

    let values;
    try {
      values = await editForm.validateFields();
    } catch (err) {
      if (err?.errorFields) {
        notification.error({
          message: '입력 확인 필요',
          description: err.errorFields[0]?.errors?.[0] || '필수 항목을 확인해주세요.',
        });
        return;
      }
      throw err;
    }

    if (editFileList.length < 1 || editFileList.length > 5) {
      notification.error({
        message: '이미지 확인 필요',
        description: '스토어 이미지는 1개 이상 5개 이하로 등록해주세요.',
      });
      return;
    }

    if (!hasOperationHours(values)) {
      notification.error({
        message: '운영 시간 확인 필요',
        description: '운영 요일을 하나 이상 남겨주세요.',
      });
      return;
    }

    setEditSaving(true);
    try {
      const imageUrls = await uploadStoreImages(editFileList);
      await client.put(`/admin/store/${detail.storeId}`, buildStoreEditRequest(values, imageUrls));
      notification.success({ message: '수정 완료', description: '스토어 정보가 수정되었습니다.' });
      handleCloseEdit();

      try {
        const res = await client.get(`/admin/store/${detail.storeId}`);
        setDetail(res.data);
      } catch {
        // 상세 재조회 실패는 목록 갱신으로 보완
      }

      fetchData({ status: statusFilter, search: searchKeyword });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '스토어 수정 실패';
      notification.error({ message: '수정 실패', description: msg });
    } finally {
      setEditSaving(false);
    }
  };

  const handleStatusChange = async (storeId, nextStatus, hasGacha) => {
    setStatusUpdatingId(storeId);
    try {
      await client.post(`/admin/store/${storeId}/status`, { status: nextStatus, hasGacha });

      const successLabel = STATUS_MAP[nextStatus]?.label || nextStatus;
      notification.success({
        message: '상태 변경 완료',
        description: `스토어 상태가 ${successLabel}(으)로 변경되었습니다.`,
      });

      setData((prev) => prev.map((item) => (
        item.storeId === storeId ? { ...item, approvalStatus: nextStatus } : item
      )));

      setDetail((prev) => (prev && prev.storeId === storeId
        ? { ...prev, approvalStatus: nextStatus, hasGacha }
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

  const handleDelete = async (storeId) => {
    setDeletingId(storeId);
    try {
      await client.delete(`/admin/store/${storeId}`);

      notification.success({
        message: '삭제 완료',
        description: '스토어가 삭제(숨김) 처리되었습니다.',
      });

      setData((prev) => prev.map((item) => (
        item.storeId === storeId ? { ...item, approvalStatus: 'HIDDEN' } : item
      )));

      setDetail((prev) => (prev && prev.storeId === storeId
        ? { ...prev, approvalStatus: 'HIDDEN' }
        : prev));

      setPendingNextStatus(null);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '스토어 삭제 실패';
      notification.error({ message: '삭제 실패', description: msg });
    } finally {
      setDeletingId(null);
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
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            스토어 추가
          </Button>
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
        rowClassName={(record) => {
          if (!isAllStatusView) return '';
          if (record.approvalStatus === 'PENDING') return 'pending-review-row';
          if (record.approvalStatus === 'HIDDEN') return 'hidden-store-row';
          return '';
        }}
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
          setPendingHasGacha(false);
        }}
        footer={modalFooter}
        width={900}
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
            <DetailView>
              <div className="store-detail-header">
                <div>
                  <div className="store-detail-title">{detail.title || '-'}</div>
                  <div className="store-detail-meta">
                    <span>ID {detail.storeId}</span>
                    <span>·</span>
                    <span>{detail.createdAt ? new Date(detail.createdAt).toLocaleString('ko-KR') : '-'}</span>
                  </div>
                </div>
                <Tag color={(STATUS_MAP[detail.approvalStatus] || { color: 'default' }).color}>
                  {(STATUS_MAP[detail.approvalStatus] || { label: detail.approvalStatus }).label}
                </Tag>
              </div>

              <Typography.Title className="store-detail-section-title" level={5}>기본 정보</Typography.Title>
              <div className="store-detail-grid">
                <div className="store-detail-item-full">
                  <div className="store-detail-label">설명</div>
                  <div className="store-detail-value store-detail-value-box store-detail-description">
                    {detail.description || '-'}
                  </div>
                </div>
                <div>
                  <div className="store-detail-label">카테고리</div>
                  <div className="store-detail-value store-detail-value-box">
                    {detail.fandomCategories?.length
                      ? (
                        <div className="store-detail-tag-row">
                          {detail.fandomCategories.map((category) => (
                            <Tag
                              key={category.fandomCategoryId}
                              color={CATEGORY_COLORS[category.category] || 'default'}
                              style={{ marginInlineEnd: 0 }}
                            >
                              {category.displayName}
                            </Tag>
                          ))}
                        </div>
                      )
                      : '-'}
                  </div>
                </div>
                <div>
                  <div className="store-detail-label">키워드</div>
                  <div className="store-detail-value store-detail-value-box">
                    {normalizeKeywords(detail.keywords).length
                      ? (
                        <div className="store-detail-tag-row">
                          {normalizeKeywords(detail.keywords).map((keyword) => (
                            <Tag key={keyword} style={KEYWORD_TAG_STYLE}>
                              {keyword}
                            </Tag>
                          ))}
                        </div>
                      )
                      : '-'}
                  </div>
                </div>
                <div>
                  <div className="store-detail-label">아이템 뽑기</div>
                  <div className="store-detail-value store-detail-value-box">
                    <Tag color={detail.hasGacha ? 'blue' : 'default'} style={{ marginInlineEnd: 0 }}>
                      {detail.hasGacha ? 'ON' : 'OFF'}
                    </Tag>
                  </div>
                </div>
              </div>

              <Typography.Title className="store-detail-section-title" level={5}>위치</Typography.Title>
              <div className="store-detail-grid">
                <div className="store-detail-item-full">
                  <div className="store-detail-label">주소</div>
                  <div className="store-detail-value store-detail-value-box">
                    {[detail.address, detail.addressDetail].filter(Boolean).join(' ') || '-'}
                  </div>
                </div>
                <div>
                  <div className="store-detail-label">우편번호</div>
                  <div className="store-detail-value store-detail-value-box">{detail.zip || '-'}</div>
                </div>
                <div>
                  <div className="store-detail-label">전화번호</div>
                  <div className="store-detail-value store-detail-value-box">{detail.phoneNumber || '-'}</div>
                </div>
              </div>

              <Typography.Title className="store-detail-section-title" level={5}>기간 및 운영 시간</Typography.Title>
              <div className="store-detail-grid">
                <div>
                  <div className="store-detail-label">기간</div>
                  <div className="store-detail-value store-detail-value-box">
                    {detail.startDate || '-'} ~ {detail.finishDate || '-'}
                  </div>
                </div>
                <div className="store-detail-item-full">
                  <div className="store-detail-label">운영 시간</div>
                  <div className="store-detail-value store-detail-value-box">
                    {detail.operationHours?.length
                      ? (
                        <div className="store-detail-hours">
                          {detail.operationHours.map((item) => (
                            <div key={`${item.day}-${item.open}-${item.close}`}>
                              {item.day}: {item.open || '-'} - {item.close || '-'}
                            </div>
                          ))}
                        </div>
                      )
                      : '-'}
                  </div>
                </div>
              </div>

              <Typography.Title className="store-detail-section-title" level={5}>링크</Typography.Title>
              <div className="store-detail-value store-detail-value-box">
                {detail.links?.length
                  ? detail.links.map((item, index) => (
                    <div key={`${item.link}-${index}`}>
                      <a href={item.link} target="_blank" rel="noreferrer">
                        {LINK_TYPE_LABEL_MAP[item.type] || item.title || item.type || item.link}
                      </a>
                    </div>
                  ))
                  : '-'}
              </div>

              <Typography.Title className="store-detail-section-title" level={5}>이미지</Typography.Title>
              {detail.imageUrls?.length
                ? (
                  <div className="store-detail-image-list">
                    {detail.imageUrls.map((imageUrl, index) => (
                      <Image key={`${imageUrl}-${index}`} src={imageUrl} width={128} />
                    ))}
                  </div>
                )
                : <div className="store-detail-value store-detail-value-box">-</div>}
            </DetailView>
          </Space>
        )}
      </Modal>
      <Modal
        title="스토어 정보 수정"
        open={editOpen}
        onCancel={handleCloseEdit}
        onOk={handleEditSubmit}
        confirmLoading={editSaving}
        okText="저장"
        cancelText="취소"
        width={900}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="요청 없이 바로 반영"
          description="스토어 신고/수정 요청과 무관하게 현재 스토어 정보를 직접 수정합니다. 좌표는 주소 검색으로 함께 갱신됩니다."
        />
        <StoreForm form={editForm} layout="vertical">
          <Typography.Title className="store-form-section-title" level={5}>기본 정보</Typography.Title>
          <Form.Item
            label="제목"
            name="title"
            rules={[
              { required: true, message: '제목을 입력해주세요.' },
              { max: 50, message: '제목은 50자 이하로 입력해주세요.' },
            ]}
          >
            <Input maxLength={50} showCount />
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
          <Form.Item
            label="설명"
            name="description"
            rules={[
              { required: true, message: '설명을 입력해주세요.' },
              { min: 10, message: '설명은 10자 이상 입력해주세요.' },
              { max: 1000, message: '설명은 1000자 이하로 입력해주세요.' },
            ]}
          >
            <Input.TextArea rows={4} maxLength={1000} showCount />
          </Form.Item>
          <Form.Item label="아이템 뽑기" name="hasGacha" valuePropName="checked">
            <Switch checkedChildren="ON" unCheckedChildren="OFF" />
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
          <Form.Item
            label="이미지"
            required
            extra={(
              <>
                기존 이미지를 유지하거나 삭제하고, 새 이미지를 추가할 수 있습니다. 총 1개 이상 5개 이하로 저장됩니다.
                <br />
                맨 위 이미지가 대표 이미지로 노출되며, 드래그로 순서를 바꿀 수 있습니다.
              </>
            )}
          >
            <Upload
              accept="image/*"
              maxCount={5}
              multiple
              fileList={editFileList}
              beforeUpload={() => false}
              onChange={({ fileList }) => setEditFileList(fileList.slice(-5))}
              listType="picture"
              itemRender={renderReorderableUploadItem(editFileList, setEditFileList, editDragIndexRef)}
            >
              {editFileList.length < 5 && (
                <Button icon={<UploadOutlined />}>이미지 선택</Button>
              )}
            </Upload>
          </Form.Item>

          <Typography.Title className="store-form-section-title" level={5}>위치</Typography.Title>
          <Form.Item label="주소 검색 대상">
            <Segmented
              options={[{ label: '국내', value: 'domestic' }, { label: '해외', value: 'overseas' }]}
              value={editAddressCountry}
              onChange={setEditAddressCountry}
            />
          </Form.Item>
          <Form.Item
            label="주소"
            name="address"
            rules={[{ required: true, message: '주소 검색으로 주소를 선택해주세요.' }]}
          >
            <Input
              readOnly
              addonAfter={(
                <Button type="link" size="small" loading={editAddressSearching} onClick={handleEditAddressSearch}>
                  주소 검색
                </Button>
              )}
            />
          </Form.Item>
          <Form.Item
            label="상세 주소"
            name="addressDetail"
          >
            <Input placeholder="예: 2층, 101호, 팝업존 내부" />
          </Form.Item>
          <Form.Item
            label="우편번호"
            name="zip"
            rules={[{ required: true, message: '주소 검색으로 우편번호를 입력해주세요.' }]}
          >
            <Input readOnly />
          </Form.Item>
          <Form.Item name="latitude" hidden rules={[{ required: true, message: '주소 검색으로 좌표를 확정해주세요.' }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="longitude" hidden rules={[{ required: true, message: '주소 검색으로 좌표를 확정해주세요.' }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item label="전화번호" name="phoneNumber">
            <Input />
          </Form.Item>

          <Typography.Title className="store-form-section-title" level={5}>기간 및 운영 시간</Typography.Title>
          <Form.Item
            label="기간"
            name="period"
            extra="상시 운영이면 비워두세요."
          >
            <DatePicker.RangePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="useCustomOperationHours" hidden>
            <Input type="hidden" />
          </Form.Item>
          <Form.Item label="운영 시간" required>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Space wrap align="baseline">
                <Form.Item
                  name="commonOpen"
                  noStyle
                  rules={[
                    { required: true, message: '오픈 시간을 입력해주세요.' },
                    { pattern: TIME_PATTERN, message: 'HH:mm 형식으로 입력해주세요.' },
                  ]}
                >
                  <Input placeholder="10:00" style={{ width: 140 }} />
                </Form.Item>
                <Typography.Text>부터</Typography.Text>
                <Form.Item
                  name="commonClose"
                  noStyle
                  rules={[
                    { required: true, message: '마감 시간을 입력해주세요.' },
                    { pattern: TIME_PATTERN, message: 'HH:mm 형식으로 입력해주세요.' },
                  ]}
                >
                  <Input placeholder="20:00" style={{ width: 140 }} />
                </Form.Item>
                <Typography.Text>까지</Typography.Text>
                <Switch
                  checked={useCustomEditOperationHours}
                  checkedChildren="요일별"
                  unCheckedChildren="매일 동일"
                  onChange={handleEditOperationModeChange}
                />
              </Space>
              {useCustomEditOperationHours && (
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Form.Item noStyle shouldUpdate>
                    {({ getFieldValue }) => {
                      const operationHours = getFieldValue('operationHours') || [];
                      const activeDays = WEEKDAYS
                        .map((day, index) => ({
                          day,
                          index,
                          isActive: !editExcludedOperationDays.includes(index),
                        }))
                        .filter((item) => item.isActive);
                      const inactiveDays = WEEKDAYS
                        .map((day, index) => ({
                          day,
                          index,
                          isActive: !editExcludedOperationDays.includes(index),
                        }))
                        .filter((item) => !item.isActive);

                      return (
                        <Space direction="vertical" size={8} style={{ width: '100%' }}>
                          {activeDays.map(({ day, index }) => (
                            <Space key={day} wrap align="baseline">
                              <Form.Item name={['operationHours', index, 'isActive']} hidden>
                                <HiddenBooleanField />
                              </Form.Item>
                              <Typography.Text strong style={{ width: 32 }}>
                                {day}
                              </Typography.Text>
                              <Form.Item
                                name={['operationHours', index, 'open']}
                                noStyle
                                rules={[
                                  { required: true, message: `${day}요일 오픈 시간` },
                                  { pattern: TIME_PATTERN, message: 'HH:mm 형식' },
                                ]}
                              >
                                <Input placeholder="10:00" style={{ width: 140 }} />
                              </Form.Item>
                              <Typography.Text>부터</Typography.Text>
                              <Form.Item
                                name={['operationHours', index, 'close']}
                                noStyle
                                rules={[
                                  { required: true, message: `${day}요일 마감 시간` },
                                  { pattern: TIME_PATTERN, message: 'HH:mm 형식' },
                                ]}
                              >
                                <Input placeholder="20:00" style={{ width: 140 }} />
                              </Form.Item>
                              <Typography.Text>까지</Typography.Text>
                              <Button
                                aria-label={`${day}요일 제외`}
                                htmlType="button"
                                icon={<CloseOutlined />}
                                size="small"
                                type="text"
                                onClick={() => setOperationDayActive(editForm, index, false, setEditExcludedOperationDays)}
                              />
                            </Space>
                          ))}
                          {inactiveDays.length > 0 && (
                            <Space wrap>
                              <Typography.Text type="secondary">제외한 요일</Typography.Text>
                              {inactiveDays.map(({ day, index }) => (
                                <Button
                                  key={day}
                                  htmlType="button"
                                  size="small"
                                  onClick={() => setOperationDayActive(editForm, index, true, setEditExcludedOperationDays)}
                                >
                                  {day} 추가
                                </Button>
                              ))}
                            </Space>
                          )}
                        </Space>
                      );
                    }}
                  </Form.Item>
                </Space>
              )}
            </Space>
          </Form.Item>

          <Typography.Title className="store-form-section-title" level={5}>링크</Typography.Title>
          <Form.List name="links">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: '100%' }}>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} className="store-link-row">
                    <Form.Item
                      {...restField}
                      name={[name, 'type']}
                      rules={[{ required: true, message: '링크 유형 선택' }]}
                    >
                      <Select
                        placeholder="링크 유형"
                        options={LINK_TYPE_OPTIONS}
                        style={{ width: 180 }}
                      />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'link']}
                      rules={[
                        { required: true, message: 'URL 입력' },
                        { type: 'url', message: '올바른 URL을 입력해주세요.' },
                      ]}
                    >
                      <Input placeholder="https://example.com" style={{ width: 360 }} />
                    </Form.Item>
                    <Button danger type="link" onClick={() => remove(name)}>
                      삭제
                    </Button>
                  </Space>
                ))}
                <Button onClick={() => add({ type: '', link: '' })}>
                  링크 추가
                </Button>
              </Space>
            )}
          </Form.List>
        </StoreForm>
      </Modal>
      <Modal
        title="스토어 추가"
        open={createOpen}
        onCancel={handleCloseCreate}
        onOk={handleCreateSubmit}
        confirmLoading={creating}
        okText="추가"
        cancelText="취소"
        width={960}
        destroyOnClose
      >
        <StoreForm form={createForm} layout="vertical" preserve={false}>
          <Typography.Title className="store-form-section-title" level={5}>기본 정보</Typography.Title>
          <Form.Item
            label="제목"
            name="title"
            rules={[
              { required: true, message: '제목을 입력해주세요.' },
              { max: 50, message: '제목은 50자 이하로 입력해주세요.' },
            ]}
          >
            <Input maxLength={50} showCount />
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
          <Form.Item
            label="설명"
            name="description"
            rules={[
              { required: true, message: '설명을 입력해주세요.' },
              { min: 10, message: '설명은 10자 이상 입력해주세요.' },
              { max: 1000, message: '설명은 1000자 이하로 입력해주세요.' },
            ]}
          >
            <Input.TextArea rows={4} maxLength={1000} showCount />
          </Form.Item>
          <Form.Item label="아이템 뽑기" name="hasGacha" valuePropName="checked">
            <Switch checkedChildren="ON" unCheckedChildren="OFF" />
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
          <Form.Item
            label="이미지"
            required
            extra={(
              <>
                스토어 이미지는 1개 이상 5개 이하로 업로드합니다.
                <br />
                맨 위 이미지가 대표 이미지로 노출되며, 드래그로 순서를 바꿀 수 있습니다.
              </>
            )}
          >
            <Upload
              accept="image/*"
              maxCount={5}
              multiple
              fileList={createFileList}
              beforeUpload={() => false}
              onChange={({ fileList }) => setCreateFileList(fileList.slice(-5))}
              listType="picture"
              itemRender={renderReorderableUploadItem(createFileList, setCreateFileList, createDragIndexRef)}
            >
              {createFileList.length < 5 && (
                <Button icon={<UploadOutlined />}>이미지 선택</Button>
              )}
            </Upload>
          </Form.Item>

          <Typography.Title className="store-form-section-title" level={5}>위치</Typography.Title>
          <Form.Item label="주소 검색 대상">
            <Segmented
              options={[{ label: '국내', value: 'domestic' }, { label: '해외', value: 'overseas' }]}
              value={createAddressCountry}
              onChange={setCreateAddressCountry}
            />
          </Form.Item>
          <Form.Item
            label="주소"
            name="address"
            rules={[{ required: true, message: '주소 검색으로 주소를 선택해주세요.' }]}
          >
            <Input
              readOnly
              addonAfter={(
                <Button type="link" size="small" loading={addressSearching} onClick={handleAddressSearch}>
                  주소 검색
                </Button>
              )}
            />
          </Form.Item>
          <Form.Item
            label="상세 주소"
            name="addressDetail"
          >
            <Input placeholder="예: 2층, 101호, 팝업존 내부" />
          </Form.Item>
          <Form.Item
            label="우편번호"
            name="zip"
            rules={[{ required: true, message: '주소 검색으로 우편번호를 입력해주세요.' }]}
          >
            <Input readOnly />
          </Form.Item>
          <Form.Item name="latitude" hidden rules={[{ required: true, message: '주소 검색으로 좌표를 확정해주세요.' }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="longitude" hidden rules={[{ required: true, message: '주소 검색으로 좌표를 확정해주세요.' }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item label="전화번호" name="phoneNumber">
            <Input />
          </Form.Item>

          <Typography.Title className="store-form-section-title" level={5}>기간 및 운영 시간</Typography.Title>
          <Form.Item
            label="기간"
            name="period"
            extra="상시 운영이면 비워두세요."
          >
            <DatePicker.RangePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="useCustomOperationHours" hidden>
            <Input type="hidden" />
          </Form.Item>
          <Form.Item label="운영 시간" required>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Form.Item name="useDateOperationHours" hidden>
                <Input type="hidden" />
              </Form.Item>
              <Segmented
                value={createOperationMode}
                onChange={handleCreateOperationModeChange}
                options={[
                  { label: '매일 동일', value: 'common' },
                  { label: '요일별', value: 'weekday' },
                  { label: '날짜 지정', value: 'date' },
                ]}
              />
              {createOperationMode === 'common' && (
                <Space wrap align="baseline">
                  <Form.Item
                    name="commonOpen"
                    noStyle
                    rules={[
                      { required: true, message: '오픈 시간을 입력해주세요.' },
                      { pattern: TIME_PATTERN, message: 'HH:mm 형식으로 입력해주세요.' },
                    ]}
                  >
                    <Input placeholder="10:00" style={{ width: 140 }} />
                  </Form.Item>
                  <Typography.Text>부터</Typography.Text>
                  <Form.Item
                    name="commonClose"
                    noStyle
                    rules={[
                      { required: true, message: '마감 시간을 입력해주세요.' },
                      { pattern: TIME_PATTERN, message: 'HH:mm 형식으로 입력해주세요.' },
                    ]}
                  >
                    <Input placeholder="20:00" style={{ width: 140 }} />
                  </Form.Item>
                  <Typography.Text>까지</Typography.Text>
                </Space>
              )}
              {createOperationMode === 'weekday' && (
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Form.Item noStyle shouldUpdate>
                    {({ getFieldValue }) => {
                      const operationHours = getFieldValue('operationHours') || [];
                      const activeDays = WEEKDAYS
                        .map((day, index) => ({
                          day,
                          index,
                          isActive: !createExcludedOperationDays.includes(index),
                        }))
                        .filter((item) => item.isActive);
                      const inactiveDays = WEEKDAYS
                        .map((day, index) => ({
                          day,
                          index,
                          isActive: !createExcludedOperationDays.includes(index),
                        }))
                        .filter((item) => !item.isActive);

                      return (
                        <Space direction="vertical" size={8} style={{ width: '100%' }}>
                          {activeDays.map(({ day, index }) => (
                            <Space key={day} wrap align="baseline">
                              <Form.Item name={['operationHours', index, 'isActive']} hidden>
                                <HiddenBooleanField />
                              </Form.Item>
                              <Typography.Text strong style={{ width: 32 }}>
                                {day}
                              </Typography.Text>
                              <Form.Item
                                name={['operationHours', index, 'open']}
                                noStyle
                                rules={[
                                  { required: true, message: `${day}요일 오픈 시간` },
                                  { pattern: TIME_PATTERN, message: 'HH:mm 형식' },
                                ]}
                              >
                                <Input placeholder="10:00" style={{ width: 140 }} />
                              </Form.Item>
                              <Typography.Text>부터</Typography.Text>
                              <Form.Item
                                name={['operationHours', index, 'close']}
                                noStyle
                                rules={[
                                  { required: true, message: `${day}요일 마감 시간` },
                                  { pattern: TIME_PATTERN, message: 'HH:mm 형식' },
                                ]}
                              >
                                <Input placeholder="20:00" style={{ width: 140 }} />
                              </Form.Item>
                              <Typography.Text>까지</Typography.Text>
                              <Button
                                aria-label={`${day}요일 제외`}
                                htmlType="button"
                                icon={<CloseOutlined />}
                                size="small"
                                type="text"
                                onClick={() => setOperationDayActive(createForm, index, false, setCreateExcludedOperationDays)}
                              />
                            </Space>
                          ))}
                          {inactiveDays.length > 0 && (
                            <Space wrap>
                              <Typography.Text type="secondary">제외한 요일</Typography.Text>
                              {inactiveDays.map(({ day, index }) => (
                                <Button
                                  key={day}
                                  htmlType="button"
                                  size="small"
                                  onClick={() => setOperationDayActive(createForm, index, true, setCreateExcludedOperationDays)}
                                >
                                  {day} 추가
                                </Button>
                              ))}
                            </Space>
                          )}
                        </Space>
                      );
                    }}
                  </Form.Item>
                </Space>
              )}
              {createOperationMode === 'date' && (
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    선택한 날짜의 요일 기준으로 자동 변환되어 저장됩니다.
                  </Typography.Text>
                  <Form.List name="operationDates">
                    {(fields, { add, remove }) => (
                      <Form.Item noStyle shouldUpdate>
                        {({ getFieldValue }) => {
                          const operationDates = getFieldValue('operationDates') || [];
                          const weekdayByRow = operationDates.map((item) => (
                            item?.date ? dateToKoreanWeekday(item.date) : null
                          ));
                          const period = getFieldValue('period') || [];
                          const [periodStart, periodFinish] = period;

                          return (
                            <Space direction="vertical" size={8} style={{ width: '100%' }}>
                              {fields.map(({ key, name, ...restField }) => {
                                const usedWeekdays = new Set(
                                  weekdayByRow.filter((_, index) => index !== name),
                                );

                                return (
                                  <Space key={key} wrap align="baseline">
                                    <Form.Item
                                      {...restField}
                                      name={[name, 'date']}
                                      noStyle
                                      rules={[{ required: true, message: '날짜를 선택해주세요.' }]}
                                    >
                                      <DatePicker
                                        format="YYYY-MM-DD"
                                        placeholder="날짜 선택"
                                        style={{ width: 160 }}
                                        disabledDate={(current) => (
                                          usedWeekdays.has(dateToKoreanWeekday(current))
                                          || (periodStart && current.isBefore(periodStart, 'day'))
                                          || (periodFinish && current.isAfter(periodFinish, 'day'))
                                        )}
                                      />
                                    </Form.Item>
                                    <Form.Item
                                      {...restField}
                                      name={[name, 'open']}
                                      noStyle
                                      rules={[
                                        { required: true, message: '오픈 시간을 입력해주세요.' },
                                        { pattern: TIME_PATTERN, message: 'HH:mm 형식' },
                                      ]}
                                    >
                                      <Input placeholder="10:00" style={{ width: 140 }} />
                                    </Form.Item>
                                    <Typography.Text>부터</Typography.Text>
                                    <Form.Item
                                      {...restField}
                                      name={[name, 'close']}
                                      noStyle
                                      rules={[
                                        { required: true, message: '마감 시간을 입력해주세요.' },
                                        { pattern: TIME_PATTERN, message: 'HH:mm 형식' },
                                      ]}
                                    >
                                      <Input placeholder="20:00" style={{ width: 140 }} />
                                    </Form.Item>
                                    <Typography.Text>까지</Typography.Text>
                                    <Button danger type="link" onClick={() => remove(name)}>
                                      삭제
                                    </Button>
                                  </Space>
                                );
                              })}
                              <Button onClick={() => add({ date: null, open: '10:00', close: '20:00' })}>
                                날짜 추가
                              </Button>
                            </Space>
                          );
                        }}
                      </Form.Item>
                    )}
                  </Form.List>
                </Space>
              )}
            </Space>
          </Form.Item>

          <Typography.Title className="store-form-section-title" level={5}>링크</Typography.Title>
          <Form.List name="links">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: '100%' }}>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} className="store-link-row">
                    <Form.Item
                      {...restField}
                      name={[name, 'type']}
                      rules={[{ required: true, message: '링크 유형 선택' }]}
                    >
                      <Select
                        placeholder="링크 유형"
                        options={LINK_TYPE_OPTIONS}
                        style={{ width: 180 }}
                      />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'link']}
                      rules={[
                        { required: true, message: 'URL 입력' },
                        { type: 'url', message: '올바른 URL을 입력해주세요.' },
                      ]}
                    >
                      <Input placeholder="https://example.com" style={{ width: 360 }} />
                    </Form.Item>
                    <Button danger type="link" onClick={() => remove(name)}>
                      삭제
                    </Button>
                  </Space>
                ))}
                <Button onClick={() => add({ type: '', link: '' })}>
                  링크 추가
                </Button>
              </Space>
            )}
          </Form.List>
        </StoreForm>
      </Modal>
      <GoogleAddressSearchModal
        open={addressModalOpen}
        onClose={() => setAddressModalOpen(false)}
        onSelect={handleAddressSelect}
      />
      <GoogleAddressSearchModal
        open={editAddressModalOpen}
        onClose={() => setEditAddressModalOpen(false)}
        onSelect={handleEditAddressSelect}
      />
    </div>
  );
}
