/**
 * Google Maps JavaScript API 로더.
 *
 * Maps JS API 는 한 페이지에서 스크립트를 두 번 로드하면 에러가 나므로,
 * 주소 검색(places)과 지도 표시(maps/marker)가 이 모듈의 단일 Promise 를 공유한다.
 */

// places: 주소 검색 Autocomplete, marker: AdvancedMarkerElement/PinElement
const GOOGLE_MAPS_LIBRARIES = 'places,marker';

let googleMapsScriptPromise;

export const getGoogleMapsApiKey = () => import.meta.env.VITE_GOOGLE_MAPS_KEY;

/**
 * AdvancedMarkerElement 는 Map ID 가 있어야 렌더링된다.
 * 자체 Map ID(Cloud Console → Map management)가 없으면 구글이 문서/샘플용으로 공개한
 * DEMO_MAP_ID 로 폴백한다. 지도와 마커는 정상 동작하고 클라우드 스타일링만 적용되지 않는다.
 */
export const getGoogleMapId = () => import.meta.env.VITE_GOOGLE_MAPS_ID || 'DEMO_MAP_ID';

export const loadGoogleMaps = (apiKey) => {
  if (window.google?.maps?.importLibrary) return Promise.resolve();

  if (!googleMapsScriptPromise) {
    googleMapsScriptPromise = new Promise((resolve, reject) => {
      window.__initGoogleMaps = resolve;
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=${GOOGLE_MAPS_LIBRARIES}&loading=async&callback=__initGoogleMaps`;
      script.async = true;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  return googleMapsScriptPromise;
};

/**
 * 지도 렌더링에 필요한 클래스들을 한 번에 가져온다.
 * script 태그에 libraries 를 명시했더라도 importLibrary 로 받아야 로드 완료가 보장된다.
 */
export const importGoogleMapsLibraries = async (apiKey) => {
  await loadGoogleMaps(apiKey);

  const [{ Map, InfoWindow }, { AdvancedMarkerElement, PinElement }] = await Promise.all([
    window.google.maps.importLibrary('maps'),
    window.google.maps.importLibrary('marker'),
  ]);

  return { Map, InfoWindow, AdvancedMarkerElement, PinElement };
};
