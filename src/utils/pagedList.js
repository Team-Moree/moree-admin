// 어드민 page+total 목록 API(res.data = { results, total }) 공통 파싱.
export function parsePagedResponse(res) {
  const results = Array.isArray(res.data?.results) ? res.data.results : [];
  const total = res.data?.total ?? results.length;
  return { results, total };
}
