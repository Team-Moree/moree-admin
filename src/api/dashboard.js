import client from './client';

const get = (path, params) => client.get(`/admin/dashboard${path}`, { params }).then((res) => res.data);

export const fetchUserMetrics = ({ days } = {}) => get('/users', { days });

export const fetchSupplyMetrics = () => get('/supply');

export const fetchPushMetrics = ({ days } = {}) => get('/pushes', { days });

export const fetchAppOpenHours = ({ days } = {}) => get('/app-open-hours', { days });

export const fetchPushTargets = ({ type, page, size } = {}) => get('/push-targets', { type, page, size });

export const fetchOperationsMetrics = () => get('/operations');

export const fetchStoresByRequests = ({ page, size } = {}) => get('/operations/stores-by-requests', { page, size });

export const fetchExploreFandomTargets = ({ categoryId, page, size } = {}) =>
  get('/explore/fandom-targets', { categoryId, page, size });

export const fetchExploreStores = ({ sort, page, size } = {}) => get('/explore/stores', { sort, page, size });

export const fetchExploreBookmarkFolders = ({ page, size } = {}) => get('/explore/bookmark-folders', { page, size });

export const fetchExploreNewStores = ({ page, size } = {}) => get('/explore/new-stores', { page, size });

export const fetchExploreOpenAlarms = ({ limit } = {}) => get('/explore/open-alarms', { limit });

export const searchFandomTargets = (search) =>
  client
    .get('/admin/fandom-target', { params: { search, status: 'APPROVED', next: '', size: 20 } })
    .then((res) => res.data.results || []);

export const searchStores = (search) =>
  client
    .get('/admin/store/list', { params: { search, status: 'APPROVED', page: 1, size: 20 } })
    .then((res) => res.data.results || []);

export const fetchFandomTargetInsights = (id, { limit } = {}) => get(`/fandom-targets/${id}/insights`, { limit });

export const fetchStoreInsights = (id, { weeks } = {}) => get(`/stores/${id}/insights`, { weeks });

export const fetchRegionMetrics = ({ days } = {}) => get('/regions', { days });

export const fetchEngagementMetrics = ({ weeks } = {}) => get('/engagement', { weeks });

export const fetchTopUsers = ({ type, page, size } = {}) => get('/engagement/top-users', { type, page, size });

export function fetchFandomCategories() {
  return client.get('/shared/fandom-category').then((res) => {
    const d = res.data;
    return Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
  });
}
