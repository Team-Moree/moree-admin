import { useEffect, useRef, useState } from 'react';
import { Button, Empty, Spin, Typography } from 'antd';
import styled from 'styled-components';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { getGoogleMapId, getGoogleMapsApiKey, importGoogleMapsLibraries } from '../utils/googleMaps';

const MapWrapper = styled.div`
  position: relative;
  width: 100%;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  overflow: hidden;
  background: #fafafa;

  .store-map-canvas {
    width: 100%;
    height: 100%;
  }

  .store-map-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px;
    text-align: center;
    background: rgba(255, 255, 255, 0.72);
    /* 조회 결과가 없어도 지도는 계속 움직일 수 있어야 다른 지역을 찾아볼 수 있다. */
    pointer-events: none;
  }

  .store-map-search-here {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2;
  }

  .store-map-infowindow {
    max-width: 240px;
    font-size: 13px;
    line-height: 1.5;
  }

  .store-map-infowindow-title {
    font-weight: 600;
    margin-bottom: 2px;
  }

  .store-map-infowindow-meta {
    color: rgba(0, 0, 0, 0.45);
  }
`;

// 승인 상태별 핀 색상. 지도만 봐도 검토 대기 스토어가 눈에 띄도록 구분한다.
const MARKER_COLOR_MAP = {
  APPROVED: { background: '#1677ff', borderColor: '#0958d9' },
  PENDING: { background: '#faad14', borderColor: '#d48806' },
  REJECTED: { background: '#ff4d4f', borderColor: '#cf1322' },
  HIDDEN: { background: '#bfbfbf', borderColor: '#8c8c8c' },
};
const DEFAULT_MARKER_COLOR = { background: '#1677ff', borderColor: '#0958d9' };

// 좌표가 하나뿐이면 fitBounds 가 과도하게 확대되므로 고정 줌을 쓴다.
const SINGLE_POINT_ZOOM = 16;
const FALLBACK_CENTER = { lat: 37.5665, lng: 126.978 }; // 서울시청

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char]));

const hasValidPosition = (store) =>
  Number.isFinite(Number(store?.latitude)) && Number.isFinite(Number(store?.longitude));

/**
 * 스토어 좌표를 구글 지도 위에 마커로 표시한다.
 * 목록(다중 마커)과 상세(단일 마커) 양쪽에서 함께 쓴다.
 *
 * @param stores [{ storeId, title, latitude, longitude, approvalStatus, statusLabel, address }]
 * @param onMarkerClick 마커 클릭 시 storeId 전달 (없으면 InfoWindow 만 띄운다)
 */
export default function StoreMap({
  stores = [],
  onMarkerClick,
  height = 480,
  loading = false,
  emptyText = '표시할 좌표가 없습니다.',
  // { center: { lat, lng }, zoom } 을 주면 마커 전체에 맞추는 대신 이 시야로 고정한다.
  initialView = null,
  // 지도가 멈출 때마다 현재 보이는 영역을 { swLat, swLng, neLat, neLng, wrapped } 로 알려준다.
  onBoundsChange = null,
  // 참이면 지도 위에 '이 지역에서 재조회' 버튼을 띄운다.
  searchHereVisible = false,
  onSearchHere = null,
  searchHereLoading = false,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const clustererRef = useRef(null);
  const librariesRef = useRef(null);
  const onMarkerClickRef = useRef(onMarkerClick);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const storesRef = useRef(stores);
  const initialViewRef = useRef(initialView);
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState(null);

  onMarkerClickRef.current = onMarkerClick;
  onBoundsChangeRef.current = onBoundsChange;
  storesRef.current = stores;

  const validStores = stores.filter(hasValidPosition);
  // 좌표/상태가 그대로면 마커를 다시 만들지 않도록 렌더마다 바뀌는 배열 대신 시그니처를 의존성으로 쓴다.
  const storesKey = validStores
    .map((store) => `${store.storeId}:${store.latitude}:${store.longitude}:${store.approvalStatus || ''}`)
    .join('|');

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      const apiKey = getGoogleMapsApiKey();
      if (!apiKey) {
        setLoadError('VITE_GOOGLE_MAPS_KEY를 설정해야 지도를 사용할 수 있습니다.');
        return;
      }

      try {
        const libraries = await importGoogleMapsLibraries(apiKey);
        if (cancelled || !containerRef.current) return;

        librariesRef.current = libraries;
        mapRef.current = new libraries.Map(containerRef.current, {
          center: initialViewRef.current?.center || FALLBACK_CENTER,
          zoom: initialViewRef.current?.zoom ?? 11,
          mapId: getGoogleMapId(),
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        infoWindowRef.current = new libraries.InfoWindow();
        // 지도가 멈출 때(초기 표시 포함)마다 보이는 영역을 부모에 알린다.
        // 부모는 이 영역으로 스토어를 조회하므로, 첫 조회도 이 이벤트가 시작시킨다.
        mapRef.current.addListener('idle', () => {
          const bounds = mapRef.current?.getBounds();
          if (!bounds || !onBoundsChangeRef.current) return;
          const sw = bounds.getSouthWest();
          const ne = bounds.getNorthEast();
          onBoundsChangeRef.current({
            swLat: sw.lat(),
            swLng: sw.lng(),
            neLat: ne.lat(),
            neLng: ne.lng(),
            // 날짜변경선을 걸친 시야는 경도 범위가 뒤집힌다. 이 경우 영역 조회를 쓸 수 없다.
            wrapped: sw.lng() > ne.lng(),
          });
        });
        // 스토어가 홍대 등 특정 상권에 밀집해 마커가 서로 가려지므로 줌 레벨별로 묶어준다.
        // 클러스터를 클릭하면 기본 핸들러가 해당 묶음 범위로 확대한다.
        clustererRef.current = new MarkerClusterer({ map: mapRef.current });
        setMapReady(true);
      } catch (err) {
        if (!cancelled) setLoadError(err.message || '구글 지도를 불러오지 못했습니다.');
      }
    };

    setup();

    return () => {
      cancelled = true;
      clustererRef.current?.clearMarkers();
      clustererRef.current?.setMap(null);
      clustererRef.current = null;
      markersRef.current = [];
      infoWindowRef.current?.close();
      infoWindowRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !librariesRef.current) return;

    const map = mapRef.current;
    const { AdvancedMarkerElement, PinElement } = librariesRef.current;

    clustererRef.current?.clearMarkers();
    markersRef.current = [];
    infoWindowRef.current?.close();

    const targets = storesRef.current.filter(hasValidPosition);
    if (targets.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();

    targets.forEach((store) => {
      const position = { lat: Number(store.latitude), lng: Number(store.longitude) };
      const color = MARKER_COLOR_MAP[store.approvalStatus] || DEFAULT_MARKER_COLOR;
      const pin = new PinElement({ ...color, glyphColor: '#ffffff' });

      // map 은 넘기지 않는다. 클러스터러가 줌 레벨에 따라 붙였다 뗐다 하며 관리한다.
      const marker = new AdvancedMarkerElement({
        position,
        title: store.title || '',
        content: pin,
        gmpClickable: true,
      });

      marker.addListener('click', () => {
        // 클릭 핸들러가 있으면(목록 지도) 상세 모달이 뜨므로 InfoWindow 는 띄우지 않는다.
        if (onMarkerClickRef.current) {
          onMarkerClickRef.current(store.storeId);
          return;
        }

        const metaLines = [store.statusLabel, store.address].filter(Boolean);
        infoWindowRef.current?.setContent(`
          <div class="store-map-infowindow">
            <div class="store-map-infowindow-title">${escapeHtml(store.title || '-')}</div>
            <div class="store-map-infowindow-meta">${escapeHtml(metaLines.join(' · '))}</div>
          </div>
        `);
        infoWindowRef.current?.open({ map, anchor: marker });
      });

      markersRef.current.push(marker);
      bounds.extend(position);
    });

    clustererRef.current?.addMarkers(markersRef.current);

    // 초기 시야가 지정된 지도는 사용자가 보던 영역이 마커 갱신마다 튀지 않도록 그대로 둔다.
    if (initialViewRef.current) return;

    if (targets.length === 1) {
      map.setCenter(bounds.getCenter());
      map.setZoom(SINGLE_POINT_ZOOM);
    } else {
      map.fitBounds(bounds, 48);
    }
  }, [mapReady, storesKey]);

  const showOverlay = !!loadError || loading || !mapReady || validStores.length === 0;

  return (
    <MapWrapper style={{ height }}>
      <div ref={containerRef} className="store-map-canvas" />
      {searchHereVisible && mapReady && !loadError && (
        <Button
          className="store-map-search-here"
          type="primary"
          size="small"
          loading={searchHereLoading}
          onClick={onSearchHere}
        >
          이 지역에서 재조회
        </Button>
      )}
      {showOverlay && (
        <div className="store-map-overlay">
          {loadError
            ? <Typography.Text type="danger">{loadError}</Typography.Text>
            : (loading || !mapReady)
              ? (
                <>
                  <Spin />
                  <Typography.Text type="secondary">
                    {loading ? '좌표를 불러오는 중입니다...' : '지도를 불러오는 중입니다...'}
                  </Typography.Text>
                </>
              )
              : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />}
        </div>
      )}
    </MapWrapper>
  );
}
