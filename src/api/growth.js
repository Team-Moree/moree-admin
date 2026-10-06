import client from './client';

export function fetchGrowthMetrics({ baseDate, days } = {}) {
  return client
    .get('/admin/dashboard/growth', { params: { baseDate, days } })
    .then((res) => res.data);
}
