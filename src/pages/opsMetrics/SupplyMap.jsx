import { useEffect, useRef, useState } from 'react';
import { Alert, Spin } from 'antd';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { getGoogleMapId, getGoogleMapsApiKey, importGoogleMapsLibraries } from '../../utils/googleMaps';
import { COLORS } from './ui';

const COUNTRY_VIEW = {
  한국: { center: { lat: 37.5563, lng: 126.9236 }, zoom: 15 },
  일본: { center: { lat: 36.2, lng: 138.3 }, zoom: 5 },
  해외: { center: { lat: 30, lng: 0 }, zoom: 2 },
};

const defaultColorOf = (p) => (p.isPopup ? COLORS.pink : COLORS.blue);
const defaultLabelOf = (p) => (p.isPopup ? '팝업' : '상설 매장');

export default function SupplyMap({ points, country, height = 480, colorOf = defaultColorOf, labelOf = defaultLabelOf, fit = false, onSelect }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const clustererRef = useRef(null);
  const librariesRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    const apiKey = getGoogleMapsApiKey();
    if (!apiKey) {
      setLoadError('VITE_GOOGLE_MAPS_KEY를 설정해야 지도를 사용할 수 있습니다.');
      return;
    }
    let cancelled = false;
    importGoogleMapsLibraries(apiKey)
      .then((libs) => {
        if (cancelled || !containerRef.current) return;
        librariesRef.current = libs;
        mapRef.current = new libs.Map(containerRef.current, {
          ...COUNTRY_VIEW.한국,
          mapId: getGoogleMapId(),
          streetViewControl: false,
          mapTypeControl: false,
        });
        clustererRef.current = new MarkerClusterer({ map: mapRef.current });
        setReady(true);
      })
      .catch(() => !cancelled && setLoadError('Google 지도를 불러오지 못했습니다.'));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const { AdvancedMarkerElement, PinElement, InfoWindow } = librariesRef.current;
    const map = mapRef.current;
    const infoWindow = new InfoWindow();
    const markers = points.map((p) => {
      const color = colorOf(p);
      const pin = new PinElement({ background: color, borderColor: color, glyphColor: '#fff', scale: 0.8 });
      const marker = new AdvancedMarkerElement({
        position: { lat: p.latitude, lng: p.longitude },
        content: pin,
        title: p.title,
        gmpClickable: true,
      });
      marker.addEventListener('gmp-click', () => {
        infoWindow.setContent(infoContent(p, labelOf(p), onSelect));
        infoWindow.open({ map, anchor: marker });
      });
      return marker;
    });
    clustererRef.current.clearMarkers();
    clustererRef.current.addMarkers(markers);

    const view = COUNTRY_VIEW[country] || COUNTRY_VIEW.한국;
    if (points.length > 1 && (fit || country === '일본')) {
      const bounds = new window.google.maps.LatLngBounds();
      points.forEach((p) => bounds.extend({ lat: p.latitude, lng: p.longitude }));
      map.fitBounds(bounds, 40);
    } else {
      map.setCenter(points.length === 1 ? { lat: points[0].latitude, lng: points[0].longitude } : view.center);
      map.setZoom(points.length === 1 ? 16 : view.zoom);
    }
    return () => infoWindow.close();
  }, [ready, points, country, colorOf, labelOf, fit, onSelect]);

  if (loadError) return <Alert type="warning" showIcon title={loadError} />;

  return (
    <Spin spinning={!ready}>
      <div ref={containerRef} style={{ width: '100%', height, borderRadius: 8, overflow: 'hidden', background: '#fafafa' }} />
    </Spin>
  );
}

function infoContent(p, label, onSelect) {
  const root = document.createElement('div');
  root.style.fontSize = '13px';
  const title = document.createElement(onSelect ? 'a' : 'b');
  title.textContent = p.title;
  if (onSelect) {
    title.style.fontWeight = '600';
    title.style.cursor = 'pointer';
    title.addEventListener('click', () => onSelect(p));
  }
  const sub = document.createElement('div');
  sub.textContent = onSelect ? `${label} · 눌러서 상세 보기` : label;
  sub.style.color = '#8c8c8c';
  root.append(title, sub);
  return root;
}
