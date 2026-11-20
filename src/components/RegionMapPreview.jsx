import { useEffect, useRef, useState } from 'react';
import { Typography } from 'antd';
import { getGoogleMapId, getGoogleMapsApiKey, importGoogleMapsLibraries } from '../utils/googleMaps';

export default function RegionMapPreview({ latitude, longitude, radiusMeters, onMove }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const onMoveRef = useRef(onMove);
  const [error, setError] = useState(null);
  onMoveRef.current = onMove;

  const hasCenter = Number.isFinite(latitude) && Number.isFinite(longitude);

  useEffect(() => {
    if (!hasCenter || mapRef.current) return undefined;
    let cancelled = false;
    importGoogleMapsLibraries(getGoogleMapsApiKey())
      .then(({ Map, AdvancedMarkerElement }) => {
        if (cancelled) return;
        const center = { lat: latitude, lng: longitude };
        const map = new Map(containerRef.current, {
          center,
          zoom: 13,
          mapId: getGoogleMapId(),
          disableDefaultUI: true,
          zoomControl: true,
        });
        const marker = new AdvancedMarkerElement({ map, position: center, gmpDraggable: true });
        marker.addListener('dragend', () => {
          const position = marker.position;
          const lat = typeof position.lat === 'function' ? position.lat() : position.lat;
          const lng = typeof position.lng === 'function' ? position.lng() : position.lng;
          onMoveRef.current(Number(lat.toFixed(6)), Number(lng.toFixed(6)));
        });
        circleRef.current = new window.google.maps.Circle({
          map,
          center,
          radius: radiusMeters || 0,
          strokeColor: '#fa8c16',
          strokeWeight: 1,
          fillColor: '#fa8c16',
          fillOpacity: 0.12,
          clickable: false,
        });
        mapRef.current = map;
        markerRef.current = marker;
        map.fitBounds(circleRef.current.getBounds());
      })
      .catch((err) => setError(err?.message || '지도를 불러오지 못했습니다.'));
    return () => { cancelled = true; };
  }, [hasCenter]);

  useEffect(() => {
    if (!mapRef.current || !hasCenter) return;
    const center = { lat: latitude, lng: longitude };
    markerRef.current.position = center;
    circleRef.current.setCenter(center);
    circleRef.current.setRadius(radiusMeters || 0);
    mapRef.current.fitBounds(circleRef.current.getBounds());
  }, [latitude, longitude, radiusMeters, hasCenter]);

  if (!hasCenter) {
    return <Typography.Text type="secondary">장소를 찾으면 지도에 위치와 반경이 표시됩니다.</Typography.Text>;
  }
  if (error) return <Typography.Text type="danger">{error}</Typography.Text>;
  return <div ref={containerRef} style={{ width: '100%', height: 240, borderRadius: 8 }} />;
}
