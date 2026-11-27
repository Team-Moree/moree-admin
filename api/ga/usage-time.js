// Vercel Serverless Function — GA4 체류 시간·미복귀율
//
// 서비스 계정 자격증명을 브라우저에 노출하지 않으려고 서버리스 함수가 GA4 Data API 를 대신 호출한다.
// 실제 함수 파일이 있는 경로는 vercel.json 의 `/api/:path*` 백엔드 rewrite 보다 우선한다.
//
// 필요한 서버 env: GA4_PROPERTY_ID, GA_CLIENT_EMAIL, GA_PRIVATE_KEY (.env.ga.example 참고)
//
// 지표 기준
//   - 이용 시간: userEngagementDuration (앱이 포그라운드였던 시간). averageSessionDuration 은 쓰지 않는다.
//   - 랜딩 웹과 앱 dev·stg·prd(QA) 빌드가 같은 GA 속성에 섞여 있어 운영 배포는 운영 앱만 집계한다
//     (platform != web, 스트림 이름이 -dev·-stg·-prd 로 끝나는 것 제외). 그 외 배포는 -dev 스트림만 집계한다.
//   - 미복귀율: 기간 안에 첫 방문한 사용자 중 N일째 다시 오지 않은 비율. N일이 지나지 않은 첫 방문일은 뺀다.
//     코호트를 한 요청에 여러 개 넣으면 GA 가 두 번째 코호트를 비워서 돌려주므로 하나씩 요청한다.

import {
  assertAuthorized,
  readGaConfig,
  getClient,
  resolveRange,
  addDays,
  perUnit,
  round1,
  inList,
  exact,
  anyOf,
  report,
  optionalReport,
  sendError,
  streamScope,
  perEntrance,
  v140SecondsByScreen,
  entrancesByScreen,
  entranceDateRanges,
  isV140OrLater,
  screenClassRows,
  EXPLORATION_CLASS,
} from './_lib.js';
import { buildFunnels, buildVersions, buildWebview, EXPLORATION_SHEETS } from './app-screens.js';

export { resolveRange };

const RETURN_DAYS = [7, 30];
const SCREEN_LIMIT = 50;
const SCREEN_QUERY_LIMIT = 250;
const EXPLORATION_SCREENS = ['exploration', 'store_list', 'store_search', 'gacha_list'];

export function buildDaily(rows, from, to) {
  const byDate = new Map(rows.map((r) => [`${r.date.slice(0, 4)}-${r.date.slice(4, 6)}-${r.date.slice(6, 8)}`, r]));
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const r = byDate.get(d) || {};
    const seconds = r.userEngagementDuration || 0;
    const users = r.activeUsers || 0;
    const sessions = r.sessions || 0;
    out.push({
      date: d,
      activeUsers: users,
      sessions,
      engagementSeconds: Math.round(seconds),
      secondsPerUser: perUnit(seconds, users),
      secondsPerSession: perUnit(seconds, sessions),
    });
  }
  return out;
}

export function buildSummary(total, daily) {
  const seconds = total?.userEngagementDuration || 0;
  const sessions = total?.sessions || 0;
  const userDays = daily.reduce((sum, d) => sum + d.activeUsers, 0);
  return {
    activeUsers: total?.activeUsers || 0,
    sessions,
    engagementSeconds: Math.round(seconds),
    avgDailySecondsPerUser: perUnit(seconds, userDays),
    avgSecondsPerSession: perUnit(seconds, sessions),
  };
}

function screenStats(r, entrances, v140Seconds) {
  return {
    views: r?.screenPageViews || 0,
    entrances,
    users: r?.activeUsers || 0,
    engagementSeconds: Math.round(r?.userEngagementDuration || 0),
    secondsPerView: perUnit(r?.userEngagementDuration || 0, r?.screenPageViews || 0),
    secondsPerEntrance: perEntrance(v140Seconds, entrances),
    secondsPerUser: perUnit(r?.userEngagementDuration || 0, r?.activeUsers || 0),
  };
}

export function buildScreens(rows, entranceRows = null, v140Seconds = null) {
  const entrances = entranceRows && new Map(entranceRows.map((r) => [r.unifiedScreenName, r.entrances]));
  return rows
    .filter((r) => r.unifiedScreenName && r.unifiedScreenName !== '(not set)')
    .map((r) => ({
      screenName: r.unifiedScreenName,
      ...screenStats(r, entrances ? entrances.get(r.unifiedScreenName) || 0 : null, v140Seconds?.get(r.unifiedScreenName)),
    }));
}

export function buildExplorationSheets(screens) {
  const byName = new Map(screens.map((s) => [s.screenName, s]));
  return EXPLORATION_SHEETS.map((name) => byName.get(name) || { screenName: name, ...screenStats(null, null, null) });
}

export function buildExploration(total, entranceRows = null, versionRows = [], classRows = []) {
  const entrances = entranceRows
    ? entranceRows.filter((r) => EXPLORATION_SCREENS.includes(r.unifiedScreenName)).reduce((sum, r) => sum + r.entrances, 0)
    : null;
  const seconds = versionRows
    .filter((r) => isV140OrLater(r.appVersion))
    .reduce((sum, r) => sum + r.userEngagementDuration, 0);
  const classScreens = classRows.filter((r) => r.unifiedScreenClass === EXPLORATION_CLASS).map((r) => r.unifiedScreenName);
  return {
    screenNames: [...new Set([...EXPLORATION_SCREENS, ...classScreens])],
    byScreenClass: classScreens.length > 0,
    ...screenStats(total, entrances, seconds),
  };
}

export function buildNonReturn(rows, day, cohortFrom, cohortTo) {
  const users = rows.reduce((max, r) => Math.max(max, r.cohortTotalUsers || 0), 0);
  const returned = rows.find((r) => Number(r.cohortNthDay) === day)?.cohortActiveUsers || 0;
  return {
    day,
    cohortFrom,
    cohortTo,
    users,
    returned,
    nonReturnRate: users === 0 ? null : round1(100 - (returned / users) * 100),
  };
}

async function nonReturn(client, property, { from, to, today }) {
  const windows = RETURN_DAYS.map((day) => {
    const latest = addDays(today, -(day + 1));
    return { day, cohortFrom: from, cohortTo: to < latest ? to : latest };
  }).filter((w) => w.cohortTo >= w.cohortFrom);
  return Promise.all(
    windows.map(async ({ day, cohortFrom, cohortTo }) => {
      const rows = await report(client, property, {
        dimensions: [{ name: 'cohort' }, { name: 'cohortNthDay' }],
        metrics: [{ name: 'cohortActiveUsers' }, { name: 'cohortTotalUsers' }],
        cohortSpec: {
          cohorts: [{ name: `d${day}`, dimension: 'firstSessionDate', dateRange: { startDate: cohortFrom, endDate: cohortTo } }],
          cohortsRange: { granularity: 'DAILY', startOffset: 0, endOffset: day },
        },
      });
      return buildNonReturn(rows, day, cohortFrom, cohortTo);
    })
  );
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
    const entranceRanges = entranceDateRanges(range);
    const usageMetrics = [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'userEngagementDuration' }];

    const screenMetrics = [{ name: 'screenPageViews' }, { name: 'activeUsers' }, { name: 'userEngagementDuration' }];
    const explorationFilter = anyOf(inList('unifiedScreenName', EXPLORATION_SCREENS), exact('unifiedScreenClass', EXPLORATION_CLASS));
    const [
      totalRows,
      dailyRows,
      screenRows,
      explorationRows,
      explorationVersionRows,
      classRows,
      entranceRows,
      nonReturnRates,
      v140Seconds,
      pageRows,
      versionRows,
    ] = await Promise.all([
      report(client, property, { dateRanges, metrics: usageMetrics }),
      report(client, property, { dateRanges, metrics: usageMetrics, dimensions: [{ name: 'date' }] }),
      report(client, property, {
        dateRanges,
        dimensions: [{ name: 'unifiedScreenName' }],
        metrics: screenMetrics,
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: SCREEN_QUERY_LIMIT,
      }),
      report(client, property, {
        dateRanges,
        metrics: screenMetrics,
        filters: [explorationFilter],
      }),
      entranceRanges
        ? report(client, property, {
            dateRanges: entranceRanges,
            dimensions: [{ name: 'appVersion' }],
            metrics: [{ name: 'userEngagementDuration' }],
            filters: [explorationFilter],
            limit: 500,
          })
        : [],
      screenClassRows(client, property, dateRanges),
      entrancesByScreen(client, property, entranceRanges),
      nonReturn(client, property, range),
      v140SecondsByScreen(client, property, entranceRanges),
      optionalReport(
        client,
        property,
        {
          dateRanges,
          dimensions: [{ name: 'unifiedScreenName' }, { name: 'customEvent:page_name' }],
          metrics: screenMetrics,
          filters: [exact('eventName', 'screen_view'), inList('customEvent:page_name', ['sign_up', 'onboarding'])],
          limit: SCREEN_QUERY_LIMIT,
        },
        'page_name'
      ),
      report(client, property, {
        dateRanges,
        dimensions: [{ name: 'appVersion' }, { name: 'platform' }],
        metrics: screenMetrics,
        limit: 100,
      }),
    ]);

    const screens = buildScreens(screenRows, entranceRows, v140Seconds);

    const daily = buildDaily(dailyRows, range.from, range.to);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(200).json({
      from: range.from,
      to: range.to,
      scope: streamScope(),
      summary: buildSummary(totalRows[0], daily),
      daily,
      screens: screens.slice(0, SCREEN_LIMIT),
      exploration: buildExploration(explorationRows[0], entranceRows, explorationVersionRows, classRows),
      explorationSheets: buildExplorationSheets(screens),
      funnels: buildFunnels(screenRows, pageRows, classRows),
      webview: buildWebview(screenRows, null).byType,
      versions: buildVersions(versionRows).rows,
      entranceAvailable: entranceRows !== null,
      pageNameAvailable: pageRows !== null || classRows.length > 0,
      nonReturn: nonReturnRates,
    });
  } catch (e) {
    return sendError(res, e, 'usage-time');
  }
}
