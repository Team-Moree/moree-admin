import { useCallback, useEffect, useState } from 'react';
import { Table, Tag, Typography, Result, Button, App, Select, Space, Modal, Descriptions, Image, Spin, Popconfirm, Alert, Input, Form, DatePicker, Upload, Switch } from 'antd';
import { EditOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
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
const STORE_CREATE_ENDPOINT = '/store';
const DAUM_POSTCODE_SCRIPT_URL = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
const NAVER_MAPS_SERVICE_WAIT_MS = 5000;
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
const TIME_PATTERN = /^([01][0-9]|2[0-4]):[0-5][0-9]$/;
const LINK_TYPE_OPTIONS = [
  { value: 'HOMEPAGE', label: '홈페이지' },
  { value: 'PRE_RESERVATION', label: '사전예약' },
  { value: 'INSTAGRAM', label: '인스타그램' },
  { value: 'TWITTER', label: '트위터' },
  { value: 'COMMUNITY', label: '커뮤니티' },
  { value: 'OPEN_CHAT', label: '오픈채팅' },
];
const LINK_TYPE_LABEL_MAP = Object.fromEntries(LINK_TYPE_OPTIONS.map((option) => [option.value, option.label]));
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
  if (values.useCustomOperationHours) {
    return WEEKDAYS.map((day, index) => ({
      day,
      open: normalizeText(values.operationHours?.[index]?.open),
      close: normalizeText(values.operationHours?.[index]?.close),
    }));
  }

  return WEEKDAYS.map((day) => ({
    day,
    open: normalizeText(values.commonOpen),
    close: normalizeText(values.commonClose),
  }));
};

const buildStoreCreateRequest = (values, imageUrls) => {
  const request = {
    title: normalizeText(values.title),
    fandomCategoryIds: values.fandomCategoryIds,
    imageUrls,
    description: normalizeText(values.description),
    keywords: compactList(values.keywords).map(normalizeText).filter(Boolean),
    operationHours: buildOperationHours(values),
    location: {
      latitude: Number(values.latitude),
      longitude: Number(values.longitude),
      zip: normalizeText(values.zip),
      address: normalizeText(values.address),
      addressDetail: normalizeText(values.addressDetail),
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

const buildStoreEditRequest = (values) => ({
  title: normalizeText(values.title),
  description: normalizeText(values.description),
  address: normalizeText(values.address),
  addressDetail: normalizeOptionalText(values.addressDetail),
  zip: normalizeText(values.zip),
  latitude: Number(values.latitude),
  longitude: Number(values.longitude),
  phoneNumber: normalizeOptionalText(values.phoneNumber),
  startDate: values.period?.[0] ? dayjs(values.period[0]).format('YYYY-MM-DD') : null,
  finishDate: values.period?.[1] ? dayjs(values.period[1]).format('YYYY-MM-DD') : null,
  operationHours: buildOperationHours(values),
  links: compactList(values.links)
    .filter((item) => item?.type || item?.link)
    .map((item) => ({
      type: normalizeText(item.type),
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
    period: store?.startDate && store?.finishDate
      ? [dayjs(store.startDate), dayjs(store.finishDate)]
      : null,
    useCustomOperationHours,
    commonOpen: firstHour.open || '10:00',
    commonClose: firstHour.close || '20:00',
    operationHours: WEEKDAYS.map((day) => ({
      open: operationHourByDay.get(day)?.open || firstHour.open || '10:00',
      close: operationHourByDay.get(day)?.close || firstHour.close || '20:00',
    })),
    links: Array.isArray(store?.links)
      ? store.links.map((item) => ({
        type: item.type || item.title || '',
        link: item.link || '',
      }))
      : [],
  };
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
  const [pendingNextStatus, setPendingNextStatus] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createFileList, setCreateFileList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [addressSearching, setAddressSearching] = useState(false);
  const [useCustomOperationHours, setUseCustomOperationHours] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editAddressSearching, setEditAddressSearching] = useState(false);
  const [useCustomEditOperationHours, setUseCustomEditOperationHours] = useState(false);
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

  const handleOpenEdit = () => {
    if (!detail) return;
    setEditOpen(true);
  };

  const handleCloseEdit = () => {
    setEditOpen(false);
    setEditSaving(false);
    setEditAddressSearching(false);
    setUseCustomEditOperationHours(false);
    editForm.resetFields();
  };

  useEffect(() => {
    if (!editOpen || !detail) return;

    const formValues = getStoreEditFormValues(detail);
    editForm.resetFields();
    editForm.setFieldsValue(formValues);
    setUseCustomEditOperationHours(formValues.useCustomOperationHours);
  }, [detail, editForm, editOpen]);

  const handleCloseCreate = () => {
    setCreateOpen(false);
    createForm.resetFields();
    setCreateFileList([]);
    setAddressSearching(false);
    setUseCustomOperationHours(false);
  };

  const handleOpenCreate = () => {
    createForm.resetFields();
    setUseCustomOperationHours(false);
    createForm.setFieldsValue({
      useCustomOperationHours: false,
      commonOpen: '10:00',
      commonClose: '20:00',
      operationHours: WEEKDAYS.map(() => ({ open: '10:00', close: '20:00' })),
      keywords: [],
      links: [],
    });
    setCreateFileList([]);
    setCreateOpen(true);
  };

  const handleAddressSearch = async () => {
    const naverMapKey = import.meta.env.VITE_NAVER_MAP_KEY;

    if (!naverMapKey) {
      notification.error({
        message: '주소 검색 설정 필요',
        description: 'VITE_NAVER_MAP_KEY를 설정해야 주소 좌표를 확정할 수 있습니다.',
      });
      return;
    }

    setAddressSearching(true);
    try {
      await loadDaumPostcode();
      new window.daum.Postcode({
        oncomplete: async (data) => {
          setAddressSearching(true);
          const selectedAddress = data.roadAddress || data.jibunAddress || data.address;
          if (!selectedAddress) {
            notification.error({ message: '주소 선택 실패', description: '선택한 주소를 읽을 수 없습니다.' });
            setAddressSearching(false);
            return;
          }

          try {
            const coordinates = await geocodeAddress(selectedAddress, naverMapKey);
            createForm.setFieldsValue({
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
            setAddressSearching(false);
          }
        },
        onclose: () => {
          setAddressSearching(false);
        },
      }).open();
    } catch (err) {
      notification.error({
        message: '주소 검색 실패',
        description: err.message || '주소 검색 스크립트를 불러오지 못했습니다.',
      });
      setAddressSearching(false);
    }
  };

  const handleEditAddressSearch = async () => {
    const naverMapKey = import.meta.env.VITE_NAVER_MAP_KEY;

    if (!naverMapKey) {
      notification.error({
        message: '주소 검색 설정 필요',
        description: 'VITE_NAVER_MAP_KEY를 설정해야 주소 좌표를 확정할 수 있습니다.',
      });
      return;
    }

    setEditAddressSearching(true);
    try {
      await loadDaumPostcode();
      new window.daum.Postcode({
        oncomplete: async (data) => {
          setEditAddressSearching(true);
          const selectedAddress = data.roadAddress || data.jibunAddress || data.address;
          if (!selectedAddress) {
            notification.error({ message: '주소 선택 실패', description: '선택한 주소를 읽을 수 없습니다.' });
            setEditAddressSearching(false);
            return;
          }

          try {
            const coordinates = await geocodeAddress(selectedAddress, naverMapKey);
            editForm.setFieldsValue({
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
            setEditAddressSearching(false);
          }
        },
        onclose: () => {
          setEditAddressSearching(false);
        },
      }).open();
    } catch (err) {
      notification.error({
        message: '주소 검색 실패',
        description: err.message || '주소 검색 스크립트를 불러오지 못했습니다.',
      });
      setEditAddressSearching(false);
    }
  };

  const handleOperationModeChange = (checked) => {
    const commonOpen = createForm.getFieldValue('commonOpen') || '10:00';
    const commonClose = createForm.getFieldValue('commonClose') || '20:00';

    setUseCustomOperationHours(checked);
    createForm.setFieldsValue({
      useCustomOperationHours: checked,
      operationHours: WEEKDAYS.map((_, index) => {
        const currentValue = createForm.getFieldValue(['operationHours', index]) || {};
        return {
          open: currentValue.open || commonOpen,
          close: currentValue.close || commonClose,
        };
      }),
    });
  };

  const handleEditOperationModeChange = (checked) => {
    const commonOpen = editForm.getFieldValue('commonOpen') || '10:00';
    const commonClose = editForm.getFieldValue('commonClose') || '20:00';

    setUseCustomEditOperationHours(checked);
    editForm.setFieldsValue({
      useCustomOperationHours: checked,
      operationHours: WEEKDAYS.map((_, index) => {
        const currentValue = editForm.getFieldValue(['operationHours', index]) || {};
        return {
          open: currentValue.open || commonOpen,
          close: currentValue.close || commonClose,
        };
      }),
    });
  };

  const uploadStoreImages = async () => {
    const imageUrls = [];

    for (const file of createFileList) {
      const formData = new FormData();
      formData.append('image', file.originFileObj);

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
      if (err?.errorFields) return;
      throw err;
    }

    if (createFileList.length < 1 || createFileList.length > 5) {
      notification.error({
        message: '이미지 확인 필요',
        description: '스토어 이미지는 1개 이상 5개 이하로 등록해주세요.',
      });
      return;
    }

    setCreating(true);
    try {
      const imageUrls = await uploadStoreImages();
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
      if (err?.errorFields) return;
      throw err;
    }

    setEditSaving(true);
    try {
      await client.patch(`/admin/store/${detail.storeId}`, buildStoreEditRequest(values));
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
                        {LINK_TYPE_LABEL_MAP[item.type] || item.title || item.type || item.link}
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

          <Typography.Title className="store-form-section-title" level={5}>위치</Typography.Title>
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
            rules={[{ required: true, message: '상세 주소를 입력해주세요.' }]}
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
                  {WEEKDAYS.map((day, index) => (
                    <Space key={day} wrap align="baseline">
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
                    </Space>
                  ))}
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
            extra="스토어 이미지는 1개 이상 5개 이하로 업로드합니다."
          >
            <Upload
              accept="image/*"
              maxCount={5}
              multiple
              fileList={createFileList}
              beforeUpload={() => false}
              onChange={({ fileList }) => setCreateFileList(fileList.slice(-5))}
              listType="picture"
            >
              {createFileList.length < 5 && (
                <Button icon={<UploadOutlined />}>이미지 선택</Button>
              )}
            </Upload>
          </Form.Item>

          <Typography.Title className="store-form-section-title" level={5}>위치</Typography.Title>
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
            rules={[{ required: true, message: '상세 주소를 입력해주세요.' }]}
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
                  checked={useCustomOperationHours}
                  checkedChildren="요일별"
                  unCheckedChildren="매일 동일"
                  onChange={handleOperationModeChange}
                />
              </Space>
              {useCustomOperationHours && (
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  {WEEKDAYS.map((day, index) => (
                    <Space key={day} wrap align="baseline">
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
                    </Space>
                  ))}
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
    </div>
  );
}
