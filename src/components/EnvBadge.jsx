import { Tag } from 'antd';
import { ENV_BADGE_COLOR, ENV_BADGE_TEXT } from '../config/env';

// 현재 환경(REAL/BETA)을 표시하는 배지. 헤더/로그인 등 공통 위치에서 사용.
export default function EnvBadge({ style }) {
  return (
    <Tag
      color={ENV_BADGE_COLOR}
      style={{
        margin: 0,
        fontWeight: 700,
        letterSpacing: '0.5px',
        padding: '2px 10px',
        borderRadius: 6,
        ...style,
      }}
    >
      {ENV_BADGE_TEXT}
    </Tag>
  );
}
