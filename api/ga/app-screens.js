import {
  assertAuthorized,
  readGaConfig,
  getClient,
  resolveRange,
  perUnit,
  ratio,
  inList,
  exact,
  beginsWith,
  report,
  optionalReport,
  sendError,
  cacheControl,
  streamScope,
  perEntrance,
  isV140OrLater,
  v140SecondsByScreen,
} from './_lib.js';

const ENTRANCE_VALUES = ['1', 'true'];
const RETURN_VALUES = ['0', 'false'];
const STORE_LIMIT = 30;

export const FUNNELS = [
  {
    key: 'signup',
    title: '가입',
    steps: [
      { label: '로그인 화면', screens: ['login'] },
      { label: '약관 동의', screens: ['sign_up_agree_terms', 'signup'], paged: [['terms', 'sign_up']] },
      { label: '프로필', screens: ['sign_up_profile'], paged: [['profile', 'sign_up']] },
      { label: '덕질 카테고리', screens: ['sign_up_fandom_category'], paged: [['fandom_category', 'sign_up']] },
      { label: '덕질 대상', screens: ['sign_up_fandom_target'], paged: [['fandom_target', 'sign_up']] },
      { label: '가입 처리', screens: ['sign_up_complete', 'sign_up_loading'], paged: [['loading', 'sign_up']] },
    ],
  },
  {
    key: 'onboarding',
    title: '온보딩',
    steps: [
      { label: '아이템 뽑기 시작 팝업', screens: ['onboarding_welcome'] },
      { label: '탐험 탭 뽑기 버튼 안내', screens: ['onboarding_gacha_guide', 'gacha_onboarding'] },
      { label: '행사 리스트 뽑기 버튼 안내', screens: ['onboarding_gacha_list_guide'] },
      { label: '첫 뽑기', screens: ['onboarding_gacha_draw'], paged: [['gacha_draw', 'onboarding']] },
      { label: '첫 뽑기 결과', screens: ['onboarding_gacha_result'], paged: [['gacha_draw_result', 'onboarding']] },
    ],
  },
  {
    key: 'store_registration',
    title: '행사 등록',
    steps: [
      { label: '기본 정보', screens: ['store_registration_1'] },
      { label: '운영 시간', screens: ['store_registration_2'] },
      { label: '장소', screens: ['store_registration_3'] },
      { label: '연락처', screens: ['store_registration_4'] },
    ],
  },
];

export const EXPLORATION_SHEETS = ['store_list', 'store_search', 'gacha_list', 'store_detail'];
export const WEBVIEW_SCREENS = [
  'webview_instagram',
  'webview_x',
  'webview_homepage',
  'webview_pre_reservation',
  'webview_community',
  'webview_open_chat',
  'webview_other',
  'webview',
];
const RETURN_RATE_LIMIT = 20;

const isEntrance = (v) => ENTRANCE_VALUES.includes(String(v).toLowerCase());
const isReturn = (v) => RETURN_VALUES.includes(String(v).toLowerCase());

function screenIndex(rows) {
  return new Map(rows.map((r) => [r.unifiedScreenName, r]));
}

function entranceIndex(rows) {
  if (!rows) return null;
  const out = new Map();
  for (const r of rows) {
    const cur = out.get(r.unifiedScreenName) || { entrances: 0, returns: 0 };
    if (isEntrance(r['customEvent:is_entrance'])) cur.entrances += r.eventCount;
    else if (isReturn(r['customEvent:is_entrance'])) cur.returns += r.eventCount;
    else continue;
    out.set(r.unifiedScreenName, cur);
  }
  return out;
}

const pageKey = (screen, page) => `${screen}|${page}`;

export function buildFunnels(screenRows, pageRows) {
  const byScreen = screenIndex(screenRows);
  const byPage = new Map((pageRows || []).map((r) => [pageKey(r.unifiedScreenName, r['customEvent:page_name']), r]));
  return FUNNELS.map((funnel) => {
    const steps = funnel.steps.map((step) => {
      const hits = [
        ...step.screens.map((s) => byScreen.get(s)),
        ...(step.paged || []).map(([screen, page]) => byPage.get(pageKey(screen, page))),
      ].filter(Boolean);
      const users = hits.reduce((sum, r) => sum + r.activeUsers, 0);
      const views = hits.reduce((sum, r) => sum + r.screenPageViews, 0);
      const seconds = hits.reduce((sum, r) => sum + r.userEngagementDuration, 0);
      return { label: step.label, screens: step.screens, users, views, secondsPerUser: perUnit(seconds, users) };
    });
    const first = steps[0]?.users || 0;
    return {
      key: funnel.key,
      title: funnel.title,
      steps: steps.map((s, i) => ({
        ...s,
        rateFromFirst: ratio(s.users, first),
        rateFromPrev: i === 0 ? null : ratio(s.users, steps[i - 1].users),
      })),
    };
  });
}

export function buildExplorationSheets(screenRows, entranceRows, v140Seconds = null) {
  const byScreen = screenIndex(screenRows);
  const entrances = entranceIndex(entranceRows);
  return EXPLORATION_SHEETS.map((name) => {
    const r = byScreen.get(name);
    const e = entrances?.get(name);
    return {
      screenName: name,
      views: r?.screenPageViews || 0,
      entrances: entrances ? e?.entrances || 0 : null,
      users: r?.activeUsers || 0,
      secondsPerView: perUnit(r?.userEngagementDuration || 0, r?.screenPageViews || 0),
      secondsPerEntrance: perEntrance(v140Seconds?.get(name), e?.entrances),
      secondsPerUser: perUnit(r?.userEngagementDuration || 0, r?.activeUsers || 0),
    };
  });
}

export function buildReturnRates(entranceRows) {
  const entrances = entranceIndex(entranceRows);
  if (!entrances) return null;
  return [...entrances.entries()]
    .filter(([name, v]) => name && name !== '(not set)' && v.entrances + v.returns > 0)
    .map(([screenName, { entrances: e, returns }]) => ({
      screenName,
      views: e + returns,
      entrances: e,
      returns,
      returnRate: ratio(returns, e + returns),
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, RETURN_RATE_LIMIT);
}

export function buildStores(storeRows, storeEntranceRows) {
  if (!storeRows) return null;
  const key = (r) => `${r['customEvent:store_id']}|${r['customEvent:store_name']}`;
  const entrances = storeEntranceRows && new Map(storeEntranceRows.map((r) => [key(r), r.eventCount]));
  return storeRows
    .filter((r) => r['customEvent:store_id'] && r['customEvent:store_id'] !== '(not set)')
    .map((r) => ({
      storeId: r['customEvent:store_id'],
      storeName: r['customEvent:store_name'] === '(not set)' ? '' : r['customEvent:store_name'],
      views: r.eventCount,
      users: r.totalUsers,
      entrances: entrances ? entrances.get(key(r)) || 0 : null,
    }));
}

export function buildWebview(screenRows, storeRows) {
  const byScreen = screenIndex(screenRows);
  const byType = WEBVIEW_SCREENS.map((name) => {
    const r = byScreen.get(name);
    return {
      screenName: name,
      views: r?.screenPageViews || 0,
      users: r?.activeUsers || 0,
      secondsPerView: perUnit(r?.userEngagementDuration || 0, r?.screenPageViews || 0),
    };
  });
  let byStore = null;
  if (storeRows) {
    const stores = new Map();
    for (const r of storeRows) {
      const name = r['customEvent:store_name'];
      if (!name || name === '(not set)') continue;
      const cur = stores.get(name) || { storeName: name, total: 0, byType: {} };
      cur.total += r.eventCount;
      cur.byType[r.unifiedScreenName] = (cur.byType[r.unifiedScreenName] || 0) + r.eventCount;
      stores.set(name, cur);
    }
    byStore = [...stores.values()].sort((a, b) => b.total - a.total).slice(0, STORE_LIMIT);
  }
  return { byType, byStore };
}

const toIsoDate = (d) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;

export function buildLoadStatus(rows) {
  if (!rows) return null;
  const days = new Map();
  for (const r of rows) {
    const status = String(r['customEvent:load_status']).toLowerCase();
    if (status !== 'success' && status !== 'fail') continue;
    const date = toIsoDate(r.date);
    const cur = days.get(date) || { date, success: 0, fail: 0 };
    cur[status] += r.eventCount;
    days.set(date, cur);
  }
  const daily = [...days.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ ...d, failRate: ratio(d.fail, d.success + d.fail) }));
  const success = daily.reduce((s, d) => s + d.success, 0);
  const fail = daily.reduce((s, d) => s + d.fail, 0);
  return { daily, total: { success, fail, failRate: ratio(fail, success + fail) } };
}

const countOf = (rows) => ({ count: rows[0]?.eventCount || 0, users: rows[0]?.totalUsers || 0 });

export function buildSearch(searchRows, resultTapRows) {
  const executions = countOf(searchRows);
  const resultTaps = resultTapRows && countOf(resultTapRows);
  return {
    executions,
    resultTaps,
    tapsPerSearch: resultTaps ? ratio(resultTaps.count, executions.count) : null,
  };
}

export function buildVersions(rows) {
  const versions = rows
    .filter((r) => r.appVersion && r.appVersion !== '(not set)')
    .map((r) => ({
      appVersion: r.appVersion,
      platform: r.platform,
      v140: isV140OrLater(r.appVersion),
      activeUsers: r.activeUsers,
      views: r.screenPageViews,
      secondsPerUser: perUnit(r.userEngagementDuration, r.activeUsers),
    }))
    .sort((a, b) => b.activeUsers - a.activeUsers);
  const total = versions.reduce((s, v) => s + v.activeUsers, 0);
  const v140Users = versions.filter((v) => v.v140).reduce((s, v) => s + v.activeUsers, 0);
  return { rows: versions, v140UserShare: ratio(v140Users, total) };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'GET 만 허용됩니다.' });
  }
  try {
    assertAuthorized(req);
    const range = resolveRange(req.query);
    const config = readGaConfig();
    const client = getClient(config);
    const property = `properties/${config.propertyId}`;
    const dateRanges = [{ startDate: range.from, endDate: range.to }];
    const screenViewOf = (name) => [exact('eventName', 'screen_view'), exact('unifiedScreenName', name)];

    const countMetrics = [{ name: 'eventCount' }, { name: 'totalUsers' }];

    const [
      screenRows,
      pageRows,
      versionRows,
      entranceRows,
      storeRows,
      storeEntranceRows,
      webviewStoreRows,
      loadRows,
      v140Seconds,
      searchRows,
      resultTapRows,
    ] = await Promise.all([
        report(client, property, {
          dateRanges,
          dimensions: [{ name: 'unifiedScreenName' }],
          metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }, { name: 'userEngagementDuration' }],
          limit: 250,
        }),
        optionalReport(
          client,
          property,
          {
            dateRanges,
            dimensions: [{ name: 'unifiedScreenName' }, { name: 'customEvent:page_name' }],
            metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }, { name: 'userEngagementDuration' }],
            filters: [exact('eventName', 'screen_view'), inList('customEvent:page_name', ['sign_up', 'onboarding'])],
            limit: 250,
          },
          'page_name'
        ),
        report(client, property, {
          dateRanges,
          dimensions: [{ name: 'appVersion' }, { name: 'platform' }],
          metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }, { name: 'userEngagementDuration' }],
          limit: 100,
        }),
        optionalReport(
          client,
          property,
          {
            dateRanges,
            dimensions: [{ name: 'unifiedScreenName' }, { name: 'customEvent:is_entrance' }],
            metrics: [{ name: 'eventCount' }],
            filters: [exact('eventName', 'screen_view')],
            limit: 500,
          },
          'is_entrance'
        ),
        optionalReport(
          client,
          property,
          {
            dateRanges,
            dimensions: [{ name: 'customEvent:store_id' }, { name: 'customEvent:store_name' }],
            metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
            filters: screenViewOf('store_detail'),
            orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
            limit: STORE_LIMIT,
          },
          'store_id'
        ),
        optionalReport(
          client,
          property,
          {
            dateRanges,
            dimensions: [{ name: 'customEvent:store_id' }, { name: 'customEvent:store_name' }],
            metrics: [{ name: 'eventCount' }],
            filters: [...screenViewOf('store_detail'), inList('customEvent:is_entrance', ENTRANCE_VALUES)],
            limit: 500,
          },
          'store_id + is_entrance'
        ),
        optionalReport(
          client,
          property,
          {
            dateRanges,
            dimensions: [{ name: 'customEvent:store_name' }, { name: 'unifiedScreenName' }],
            metrics: [{ name: 'eventCount' }],
            filters: [exact('eventName', 'screen_view'), beginsWith('unifiedScreenName', 'webview')],
            limit: 500,
          },
          'webview store_name'
        ),
        optionalReport(
          client,
          property,
          {
            dateRanges,
            dimensions: [{ name: 'date' }, { name: 'customEvent:load_status' }],
            metrics: [{ name: 'eventCount' }],
            filters: screenViewOf('store_detail'),
            limit: 500,
          },
          'load_status'
        ),
        v140SecondsByScreen(client, property, dateRanges),
        report(client, property, { dateRanges, metrics: countMetrics, filters: [exact('eventName', 'search')] }),
        optionalReport(
          client,
          property,
          { dateRanges, metrics: countMetrics, filters: [exact('customEvent:element_name', 'search_result_item')] },
          'element_name'
        ),
      ]);

    res.setHeader('Cache-Control', cacheControl());
    return res.status(200).json({
      from: range.from,
      to: range.to,
      scope: streamScope(),
      available: {
        pageName: pageRows !== null,
        entrance: entranceRows !== null,
        store: storeRows !== null,
        storeEntrance: storeEntranceRows !== null,
        webviewStore: webviewStoreRows !== null,
        loadStatus: loadRows !== null,
        searchResultTap: resultTapRows !== null,
      },
      versions: buildVersions(versionRows),
      funnels: buildFunnels(screenRows, pageRows),
      exploration: buildExplorationSheets(screenRows, entranceRows, v140Seconds),
      search: buildSearch(searchRows, resultTapRows),
      stores: buildStores(storeRows, storeEntranceRows),
      webview: buildWebview(screenRows, webviewStoreRows),
      loadStatus: buildLoadStatus(loadRows),
      returnRates: buildReturnRates(entranceRows),
    });
  } catch (e) {
    return sendError(res, e, 'app-screens');
  }
}
