import { Tabs } from 'antd';
import { PageTitle, SubText } from './opsMetrics/ui';
import SupplyTab from './opsMetrics/SupplyTab';
import PushTab from './opsMetrics/PushTab';
import OperationsTab from './opsMetrics/OperationsTab';
import ExploreTab from './opsMetrics/ExploreTab';
import RegionsTab from './opsMetrics/RegionsTab';
import EngagementTab from './opsMetrics/EngagementTab';

const TABS = [
  { key: 'supply', label: '공급', children: <SupplyTab /> },
  { key: 'push', label: '푸시', children: <PushTab /> },
  { key: 'operations', label: '운영', children: <OperationsTab /> },
  { key: 'explore', label: '탐색', children: <ExploreTab /> },
  { key: 'regions', label: '지역', children: <RegionsTab /> },
  { key: 'engagement', label: '참여', children: <EngagementTab /> },
];

export default function OpsMetrics() {
  return (
    <div>
      <PageTitle>운영 지표</PageTitle>
      <SubText>회원(탈퇴 제외)·노출 매장 기준 · 한국 시간 기준 · 탭을 처음 열 때 불러옴</SubText>
      <Tabs items={TABS} />
    </div>
  );
}
