import client from '../api/client';

const DEFAULT_MAX_WIDTH = 1080;
const IMAGE_QUALITY = 0.8;

const toBlob = (canvas, type) => new Promise((resolve) => canvas.toBlob(resolve, type, IMAGE_QUALITY));

// webp 인코딩 미지원 브라우저(구형 Safari)는 png로 떨어지므로 대체 — 투명 배경(png 원본)은 png 유지
const resizeToWebp = async (file, maxWidth) => {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const webp = await toBlob(canvas, 'image/webp');
  if (webp?.type === 'image/webp') return webp;
  return toBlob(canvas, file.type === 'image/png' ? 'image/png' : 'image/jpeg');
};

// 반환된 imageUrl은 등록·수정 API에 넘겨야 확정됨 — 안 넘기면 1일 뒤 S3에서 자동 삭제
// maxWidth는 숫자 하나 또는 파일별 배열 (같은 원본을 크기별로 올릴 때)
export const uploadImages = async (files, imageType, { maxWidth = DEFAULT_MAX_WIDTH } = {}) => {
  if (files.length === 0) return [];
  if (Array.isArray(maxWidth) && maxWidth.length !== files.length) {
    throw new Error('maxWidth 배열 길이가 파일 수와 다릅니다.');
  }

  const blobs = await Promise.all(files.map((file, i) => resizeToWebp(file, Array.isArray(maxWidth) ? maxWidth[i] : maxWidth)));
  const { data } = await client.post('/shared/presigned-url', {
    imageType,
    files: blobs.map((blob) => ({ contentType: blob.type, contentLength: blob.size })),
  });

  await Promise.all(data.results.map(async (item, i) => {
    const res = await fetch(item.uploadUrl, { method: 'PUT', headers: item.uploadHeaders, body: blobs[i] });
    if (!res.ok) throw new Error(`이미지 업로드에 실패했습니다. (${res.status})`);
  }));

  return data.results.map((item) => item.imageUrl);
};
