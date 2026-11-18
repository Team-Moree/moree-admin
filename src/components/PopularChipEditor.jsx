import { useEffect, useMemo, useState } from 'react';
import { App, Button, Input, Select, Space, Typography } from 'antd';
import { CloseOutlined, HolderOutlined, PlusOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import client from '../api/client';

const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
`;

const Chip = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px 2px 6px;
  border: 1px solid ${({ $over }) => ($over ? '#fa8c16' : '#ffd591')};
  border-radius: 16px;
  background: #fff7e6;
  cursor: grab;
  opacity: ${({ $dragging }) => ($dragging ? 0.4 : 1)};
`;

const CHIP_LABEL_MAX = 20;

const defaultChipLabel = (regionName) => regionName.split('/')[0].trim().slice(0, CHIP_LABEL_MAX);

const toItems = (regions) => regions
  .filter((r) => r.popularOrder)
  .sort((a, b) => a.popularOrder - b.popularOrder)
  .map((r) => ({ regionId: r.id, chipLabel: r.chipLabel, name: r.name }));

export default function PopularChipEditor({ country, countryLabel, regions, onSaved }) {
  // 부모가 렌더마다 새 배열을 넘기므로 내용이 바뀔 때만 편집 상태를 되돌림
  const originalKey = JSON.stringify(toItems(regions));
  const original = useMemo(() => JSON.parse(originalKey), [originalKey]);
  const [items, setItems] = useState(original);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const [saving, setSaving] = useState(false);
  const { notification } = App.useApp();

  useEffect(() => { setItems(original); }, [original]);

  const dirty = JSON.stringify(items.map(({ regionId, chipLabel }) => [regionId, chipLabel]))
    !== JSON.stringify(original.map(({ regionId, chipLabel }) => [regionId, chipLabel]));

  const addOptions = regions
    .filter((r) => !items.some((item) => item.regionId === r.id))
    .map((r) => ({ value: r.id, label: r.name }));

  const handleDrop = (targetIndex) => {
    if (dragIndex === null || dragIndex === targetIndex) return;
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    setItems(next);
  };

  const handleAdd = (regionId) => {
    const region = regions.find((r) => r.id === regionId);
    setItems([...items, { regionId, chipLabel: defaultChipLabel(region.name), name: region.name }]);
  };

  const handleSave = async () => {
    if (items.some((item) => !item.chipLabel.trim())) {
      notification.error({ message: '저장 실패', description: '칩 문구가 비어 있어요.' });
      return;
    }
    setSaving(true);
    try {
      await client.put(`/admin/regions/popular/${country}`, {
        items: items.map(({ regionId, chipLabel }) => ({ regionId, chipLabel: chipLabel.trim() })),
      });
      notification.success({ message: '저장 완료', description: `${countryLabel} 인기 지역 칩이 앱에 바로 반영됩니다.` });
      onSaved();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '저장 실패';
      notification.error({ message: '저장 실패', description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
      <Typography.Text strong style={{ width: 36, lineHeight: '30px', flexShrink: 0 }}>{countryLabel}</Typography.Text>
      <div style={{ flex: 1 }}>
        <ChipRow>
          {items.map((item, index) => (
            <Chip
              key={item.regionId}
              draggable
              $dragging={dragIndex === index}
              $over={overIndex === index && dragIndex !== index}
              title={item.name}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => { e.preventDefault(); setOverIndex(index); }}
              onDragLeave={() => setOverIndex(null)}
              onDrop={() => handleDrop(index)}
              onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
            >
              <HolderOutlined style={{ color: '#d48806' }} />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{index + 1}</Typography.Text>
              <Input
                size="small"
                variant="borderless"
                value={item.chipLabel}
                maxLength={CHIP_LABEL_MAX}
                onChange={(e) => setItems(items.map((it) => (it.regionId === item.regionId ? { ...it, chipLabel: e.target.value } : it)))}
                style={{ width: `${Math.max(item.chipLabel.length, 2) + 2}em`, padding: 0 }}
              />
              <Button
                size="small"
                type="text"
                icon={<CloseOutlined style={{ fontSize: 10 }} />}
                onClick={() => setItems(items.filter((it) => it.regionId !== item.regionId))}
              />
            </Chip>
          ))}
          <Select
            size="small"
            showSearch
            value={null}
            placeholder={<span><PlusOutlined /> 칩 추가</span>}
            options={addOptions}
            optionFilterProp="label"
            onChange={handleAdd}
            style={{ width: 150 }}
          />
        </ChipRow>
      </div>
      {dirty && (
        <Space>
          <Button size="small" onClick={() => setItems(original)}>되돌리기</Button>
          <Button size="small" type="primary" loading={saving} onClick={handleSave}>저장</Button>
        </Space>
      )}
    </div>
  );
}
