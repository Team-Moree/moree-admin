import { useEffect, useRef, useState } from 'react';
import { Modal, App } from 'antd';

let googleMapsScriptPromise;

const loadGoogleMaps = (apiKey) => {
  if (window.google?.maps?.importLibrary) return Promise.resolve();

  if (!googleMapsScriptPromise) {
    googleMapsScriptPromise = new Promise((resolve, reject) => {
      window.__initGoogleMaps = resolve;
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async&callback=__initGoogleMaps`;
      script.async = true;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  return googleMapsScriptPromise;
};

const extractZip = (addressComponents = []) => {
  const postal = addressComponents.find((component) => component.types?.includes('postal_code'));
  return postal?.longText || '';
};

/**
 * Google Places Autocomplete 기반 해외 주소 검색 모달.
 * 국내 주소는 카카오 우편번호 + 네이버 지오코딩을 쓴다.
 */
export default function GoogleAddressSearchModal({ open, onClose, onSelect }) {
  const containerRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  const onCloseRef = useRef(onClose);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const { notification } = App.useApp();

  onSelectRef.current = onSelect;
  onCloseRef.current = onClose;

  useEffect(() => {
    // ready는 모달의 열림 애니메이션(transform)이 완전히 끝난 뒤 true가 된다.
    // 애니메이션 중에 위젯을 생성하면 내부 position:fixed 드롭다운이
    // 아직 남아있는 transform 조상 기준으로 위치를 고정해버려 화면 뒤로 밀리는 문제가 있다.
    if (!ready) return undefined;

    let cancelled = false;
    setLoading(true);

    const setup = async () => {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
      if (!apiKey) {
        notification.error({
          message: '주소 검색 설정 필요',
          description: 'VITE_GOOGLE_MAPS_KEY를 설정해야 주소 검색을 사용할 수 있습니다.',
        });
        setLoading(false);
        return;
      }

      try {
        await loadGoogleMaps(apiKey);
        if (cancelled) return;

        const { PlaceAutocompleteElement } = await window.google.maps.importLibrary('places');
        const element = new PlaceAutocompleteElement();
        containerRef.current?.replaceChildren(element);

        element.addEventListener('gmp-select', async ({ placePrediction }) => {
          try {
            const place = placePrediction.toPlace();
            await place.fetchFields({ fields: ['formattedAddress', 'location', 'addressComponents'] });
            onSelectRef.current({
              address: place.formattedAddress || '',
              zip: extractZip(place.addressComponents),
              latitude: place.location?.lat(),
              longitude: place.location?.lng(),
            });
            onCloseRef.current();
          } catch (err) {
            notification.error({
              message: '주소 선택 실패',
              description: err.message || '선택한 주소 정보를 가져오지 못했습니다.',
            });
          }
        });
      } catch (err) {
        notification.error({
          message: '주소 검색 실패',
          description: err.message || 'Google 주소 검색을 불러오지 못했습니다.',
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setup();

    return () => {
      cancelled = true;
      containerRef.current?.replaceChildren();
    };
  }, [ready, notification]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      afterOpenChange={setReady}
      footer={null}
      title="주소 검색"
    >
      <div ref={containerRef} style={{ minHeight: 48 }} />
      {loading && <div style={{ marginTop: 8, color: '#999' }}>불러오는 중...</div>}
    </Modal>
  );
}
