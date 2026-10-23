import client from './client';

const get = (path, params) => client.get(`/admin/dashboard${path}`, { params }).then((res) => res.data);

export const fetchUserMetrics = ({ days } = {}) => get('/users', { days });

export const fetchSupplyMetrics = () => get('/supply');

export const fetchAppOpenHours = ({ days } = {}) => get('/app-open-hours', { days });

export const fetchPushTargets = ({ type, page, size } = {}) => get('/push-targets', { type, page, size });

export const fetchOperationsMetrics = () => get('/operations');

export const fetchStoresByRequests = ({ page, size } = {}) => get('/operations/stores-by-requests', { page, size });

export const fetchExploreMetrics = ({ limit, storeSort, categoryId } = {}) =>
  get('/explore', { limit, storeSort, categoryId });

export const fetchFandomTargetInsights = (id, { limit } = {}) => get(`/fandom-targets/${id}/insights`, { limit });

export const fetchStoreInsights = (id, { weeks } = {}) => get(`/stores/${id}/insights`, { weeks });

export const fetchRegionMetrics = ({ days } = {}) => get('/regions', { days });

export const fetchEngagementMetrics = ({ weeks, limit } = {}) => get('/engagement', { weeks, limit });

export function fetchFandomCategories() {
  return client.get('/shared/fandom-category').then((res) => {
    const d = res.data;
    return Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
  });
}
