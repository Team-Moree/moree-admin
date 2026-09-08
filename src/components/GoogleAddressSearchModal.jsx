import { useEffect, useRef, useState } from 'react';
import { Modal, App } from 'antd';

let googleMapsScriptPromise;

const loadGoogleMaps = (apiKey) => {
  if (window.google?.maps?.places?.Autocomplete) return Promise.resolve();

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
  if (postal?.long_name) return postal.long_name;

  // 일본 등 일부 국가는 우편번호가 postal_code 대신 prefix/suffix로 쪼개져 내려온다.
  const prefix = addressComponents.find((component) => component.types?.includes('postal_code_prefix'));
  const suffix = addressComponents.find((component) => component.types?.includes('postal_code_suffix'));
  if (prefix?.long_name && suffix?.long_name) return `${prefix.long_name}-${suffix.long_name}`;
  return prefix?.long_name || '';
};

/**
 * Google Places Autocomplete(레거시) 기반 해외 주소 검색 모달.
 * 국내 주소는 카카오 우편번호 + 네이버 지오코딩을 쓴다.
 *
 * 신형 PlaceAutocompleteElement(웹 컴포넌트)는 아직 alpha/beta 채널에만 있는
 * 불안정한 컴포넌트라 모달 안에서 재사용 시 간헐적으로 드롭다운이 아예
 * 생성되지 않는 문제가 있었다. 레거시 Autocomplete는 일반 input에 바인딩되고
 * 드롭다운도 shadow DOM 없이 document.body에 붙는 방식이라 이런 문제가 없다.
 */
export default function GoogleAddressSearchModal({ open, onClose, onSelect }) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
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
        if (cancelled || !inputRef.current) return;

        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          fields: ['formatted_address', 'geometry', 'address_components'],
        });
        autocompleteRef.current = autocomplete;

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (!place?.geometry?.location) {
            notification.error({
              message: '주소 선택 실패',
              description: '선택한 주소 정보를 가져오지 못했습니다.',
            });
            return;
          }

          onSelectRef.current({
            address: place.formatted_address || '',
            zip: extractZip(place.address_components),
            latitude: place.geometry.location.lat(),
            longitude: place.geometry.location.lng(),
          });
          onCloseRef.current();
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
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
      if (inputRef.current) inputRef.current.value = '';
    };
  }, [open, notification]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title="주소 검색"
      // antd Modal의 zoom 애니메이션(transform) 중에는 렌더 크기가 순간적으로
      // 작게 잡힐 수 있어(레거시 Autocomplete와는 무관한 antd 자체 이슈), 꺼둔다.
      transitionName=""
      maskTransitionName=""
      // 이 모달은 상점 등록/수정 모달의 React 자식이 아니라 형제로 렌더링되어
      // antd의 중첩 모달 자동 z-index 감지가 매번 정확하게 동작하지 않는다.
      // 상점 모달(기본 zIndex 1000)보다 항상 위에 오도록 고정값을 준다.
      zIndex={1050}
    >
      {/* .pac-container는 이 모달의 자식이 아니라 document.body에 별도로 붙는 구글의
          전역 드롭다운이라, 구글이 매기는 기본 z-index(1000)만으로는 위 모달(1050)이나
          상점 모달의 마스크에 가려질 수 있다. 항상 최상단에 오도록 강제한다. */}
      <style>{'.pac-container { z-index: 1060 !important; }'}</style>
      <input
        ref={inputRef}
        className="ant-input"
        placeholder="주소를 검색하세요"
        disabled={loading}
        style={{ width: '100%' }}
      />
      {loading && <div style={{ marginTop: 8, color: '#999' }}>불러오는 중...</div>}
    </Modal>
  );
}
