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
  const { notification } = App.useApp();

  onSelectRef.current = onSelect;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

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
  }, [open, notification]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title="주소 검색"
      // 위젯이 열리자마자(애니메이션 없이) 렌더링되도록 zoom 트랜지션을 끈다.
      // Modal에 transform이 걸려있는 동안 PlaceAutocompleteElement가 초기화되면
      // 내부 position:fixed 드롭다운이 그 transform을 containing block으로 잡아버려
      // 화면 뒤로 밀리는 문제가 있었다. afterOpenChange로 애니메이션 종료를 기다리는
      // 방식은 이 환경에서 콜백이 누락되는 경우가 있어(재오픈 시 위젯 자체가 생성되지 않음)
      // 애니메이션을 아예 없애는 방식으로 대체한다.
      transitionName=""
      maskTransitionName=""
    >
      <div ref={containerRef} style={{ minHeight: 48 }} />
      {loading && <div style={{ marginTop: 8, color: '#999' }}>불러오는 중...</div>}
    </Modal>
  );
}
