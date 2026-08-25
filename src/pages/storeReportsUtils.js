export const FEEDBACK_TABS = {
  REPORT: 'REPORT',
  EDIT_REQUEST: 'EDIT_REQUEST',
};

export const getStoreFeedbackListEndpoint = (feedbackType) => (
  feedbackType === FEEDBACK_TABS.EDIT_REQUEST
    ? '/admin/store/edit-request/list'
    : '/admin/store/report/list'
);

export const normalizeStoreFeedbackItems = (items, feedbackType) => items.map((item) => ({
  ...item,
  feedbackType,
}));

export const getNaverMapsScriptUrl = (clientId) =>
  `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}&submodules=geocoder`;

export const hasValidCoordinates = ({ latitude, longitude }) => (
  latitude !== ''
  && longitude !== ''
  && Number.isFinite(Number(latitude))
  && Number.isFinite(Number(longitude))
);

const trimTextValue = (value) => (typeof value === 'string' ? value.trim() : value);

const normalizeOptionalTextValue = (value) => {
  if (typeof value !== 'string') return value ?? null;
  const trimmedValue = value.trim();
  return trimmedValue || null;
};

const normalizeRequiredTextValue = (value) => {
  if (typeof value !== 'string') return value ?? '';
  return value.trim();
};

export const buildStoreApplyRequest = (values) => ({
  title: normalizeRequiredTextValue(values.title),
  fandomCategoryIds: values.fandomCategoryIds,
  description: normalizeRequiredTextValue(values.description),
  address: normalizeRequiredTextValue(values.address),
  addressDetail: normalizeOptionalTextValue(values.addressDetail),
  zip: normalizeRequiredTextValue(values.zip),
  latitude: Number(values.latitude),
  longitude: Number(values.longitude),
  phoneNumber: normalizeOptionalTextValue(values.phoneNumber),
  startDate: normalizeOptionalTextValue(values.startDate),
  finishDate: normalizeOptionalTextValue(values.finishDate),
  keywords: Array.isArray(values.keywords)
    ? values.keywords.filter(Boolean).map((item) => normalizeRequiredTextValue(item)).filter(Boolean)
    : [],
  operationHours: Array.isArray(values.operationHours)
    ? values.operationHours
      .filter((item) => item?.day || item?.open || item?.close)
      .map((item) => ({
        day: normalizeRequiredTextValue(item.day),
        open: normalizeRequiredTextValue(item.open),
        close: normalizeRequiredTextValue(item.close),
      }))
    : [],
  links: Array.isArray(values.links)
    ? values.links
      .filter((item) => item?.title || item?.link)
      .map((item) => ({
        title: normalizeRequiredTextValue(item.title),
        link: trimTextValue(item.link) || '',
      }))
    : [],
});

const toTimestamp = (value) => {
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const getStoreId = (item) => item?.storeId ?? item?.store?.storeId ?? '';

const compareProcessStatus = (a, b) => Number(a.isProcessed === true) - Number(b.isProcessed === true);

const countUnprocessedReportsByStore = (items) => items.reduce((counts, item) => {
  if (item.feedbackType !== FEEDBACK_TABS.REPORT || item.isProcessed === true) return counts;

  const storeId = getStoreId(item);
  counts.set(storeId, (counts.get(storeId) || 0) + 1);
  return counts;
}, new Map());

export const sortStoreFeedbackItems = (items, feedbackType) => {
  const unprocessedReportCounts = countUnprocessedReportsByStore(items);

  return [...items].sort((a, b) => {
    const processStatusDiff = compareProcessStatus(a, b);
    if (processStatusDiff !== 0) return processStatusDiff;

    if (feedbackType === FEEDBACK_TABS.REPORT) {
      const reportCountDiff = (unprocessedReportCounts.get(getStoreId(b)) || 0)
        - (unprocessedReportCounts.get(getStoreId(a)) || 0);
      if (reportCountDiff !== 0) return reportCountDiff;

      return toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
    }

    if (feedbackType === FEEDBACK_TABS.EDIT_REQUEST) {
      return toTimestamp(a.createdAt) - toTimestamp(b.createdAt);
    }

    return toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
  });
};
