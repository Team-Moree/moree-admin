import { useEffect, useMemo, useState } from 'react';
import {
  Table, Tag, Typography, Result, Button, App, Modal, Form, Input, InputNumber, Select, Space, Popconfirm, Segmented, Card,
} from 'antd';
import { PlusOutlined, EnvironmentOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import client from '../api/client';
import GoogleAddressSearchModal from '../components/GoogleAddressSearchModal';
import PopularChipEditor from '../components/PopularChipEditor';
import RegionMapPreview from '../components/RegionMapPreview';

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 12px;
  flex-wrap: wrap;
`;

const COUNTRY_LABEL = { KR: '한국', JP: '일본', CN: '중국', ETC: '기타' };
const TYPE_LABEL = { PROVINCE: '광역', CITY: '도시', NEIGHBORHOOD: '상권' };
const TYPE_COLOR = { PROVINCE: 'purple', CITY: 'blue', NEIGHBORHOOD: 'green' };
const DEFAULT_RADIUS = { PROVINCE: 27000, CITY: 10000, NEIGHBORHOOD: 1500 };
const MAX_RADIUS = 27000;
const KEYWORD_PREVIEW_COUNT = 6;

const toFormValues = (region) => ({
  country: region.country,
  name: region.name,
  regionType: region.regionType,
  latitude: region.latitude,
  longitude: region.longitude,
  radiusMeters: region.radiusMeters,
  keywords: region.keywords,
});

export default function Regions() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [country, setCountry] = useState('ALL');
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState(null); // null: 닫힘, {}: 등록, region: 수정
  const [saving, setSaving] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [form] = Form.useForm();
  const latitude = Form.useWatch('latitude', form);
  const longitude = Form.useWatch('longitude', form);
  const radiusMeters = Form.useWatch('radiusMeters', form);

  const { notification } = App.useApp();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get('/admin/regions');
      setData(Array.isArray(res.data?.results) ? res.data.results : []);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '지역 조회 실패';
      setError(msg);
      notification.error({ message: '조회 실패', description: msg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    const q = search.replace(/\s+/g, '').toLowerCase();
    return [...data].sort((a, b) => b.id - a.id).filter((r) => (country === 'ALL' || r.country === country)
      && (!q || [r.name, ...r.keywords].some((v) => v.replace(/\s+/g, '').toLowerCase().includes(q))));
  }, [data, country, search]);

  const openCreate = () => {
    form.resetFields();
    form.setFieldsValue({ country: 'KR', regionType: 'NEIGHBORHOOD', radiusMeters: DEFAULT_RADIUS.NEIGHBORHOOD, keywords: [] });
    setEditing({});
  };

  const openEdit = (region) => {
    form.setFieldsValue(toFormValues(region));
    setEditing(region);
  };

  const closeModal = () => {
    setEditing(null);
    form.resetFields();
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const body = { ...values, keywords: values.keywords || [] };
      if (editing.id) {
        await client.put(`/admin/regions/${editing.id}`, body);
      } else {
        await client.post('/admin/regions', body);
      }
      notification.success({ message: '저장 완료', description: '앱 지역 검색에 바로 반영됩니다.' });
      closeModal();
      fetchData();
    } catch (err) {
      if (err.errorFields) return;
      const msg = err.response?.data?.message || err.message || '저장 실패';
      notification.error({ message: '저장 실패', description: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (region) => {
    try {
      await client.delete(`/admin/regions/${region.id}`);
      notification.success({ message: '삭제 완료', description: `${region.name} 지역을 삭제했습니다.` });
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '삭제 실패';
      notification.error({ message: '삭제 실패', description: msg });
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    { title: '국가', dataIndex: 'country', key: 'country', width: 70, render: (v) => COUNTRY_LABEL[v] || v },
    { title: '지역 이름', dataIndex: 'name', key: 'name', width: 160 },
    {
      title: '범위',
      dataIndex: 'regionType',
      key: 'regionType',
      width: 80,
      render: (v) => <Tag color={TYPE_COLOR[v]}>{TYPE_LABEL[v] || v}</Tag>,
    },
    { title: '반경(m)', dataIndex: 'radiusMeters', key: 'radiusMeters', width: 90, render: (v) => v.toLocaleString() },
    {
      title: '검색 키워드',
      dataIndex: 'keywords',
      key: 'keywords',
      render: (keywords) => (
        <Space size={[4, 4]} wrap>
          {keywords.slice(0, KEYWORD_PREVIEW_COUNT).map((k) => <Tag key={k}>{k}</Tag>)}
          {keywords.length > KEYWORD_PREVIEW_COUNT && (
            <Typography.Text type="secondary">+{keywords.length - KEYWORD_PREVIEW_COUNT}</Typography.Text>
          )}
        </Space>
      ),
    },
    {
      title: '인기 칩',
      key: 'chip',
      width: 120,
      render: (_, r) => (r.popularOrder ? <Tag color="gold">{r.popularOrder}. {r.chipLabel}</Tag> : '-'),
    },
    {
      title: '관리',
      key: 'action',
      width: 150,
      render: (_, r) => (
        <Space size={0} onClick={(e) => e.stopPropagation()}>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(r)}>수정</Button>
          <Popconfirm
            title="지역 삭제"
            description={`'${r.name}' 지역을 삭제합니다. 되돌릴 수 없습니다.`}
            okText="삭제"
            cancelText="취소"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(r)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>삭제</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (error && data.length === 0) {
    return (
      <div>
        <Typography.Title level={4}>탐험 지역</Typography.Title>
        <Result
          status="warning"
          title="데이터를 불러올 수 없습니다"
          subTitle={error}
          extra={<Button type="primary" onClick={fetchData}>다시 시도</Button>}
        />
      </div>
    );
  }

  return (
    <div>
      <Header>
        <Typography.Title level={4} style={{ margin: 0 }}>탐험 지역</Typography.Title>
        <Space wrap>
          <Segmented
            value={country}
            onChange={setCountry}
            options={[{ label: '전체', value: 'ALL' }, ...Object.entries(COUNTRY_LABEL).map(([value, label]) => ({ label, value }))]}
          />
          <Input.Search allowClear placeholder="이름·키워드 검색" onChange={(e) => setSearch(e.target.value)} style={{ width: 200 }} />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>지역 추가</Button>
        </Space>
      </Header>

      <Card size="small" title="인기 지역 칩 (앱 노출 순서)" style={{ marginBottom: 16 }}>
        {Object.entries(COUNTRY_LABEL).map(([code, label]) => (
          <PopularChipEditor
            key={code}
            country={code}
            countryLabel={label}
            regions={data.filter((r) => r.country === code)}
            onSaved={fetchData}
          />
        ))}
        <Typography.Text type="secondary">드래그로 순서 변경 · 국가별 저장</Typography.Text>
      </Card>

      <Table
        columns={columns}
        dataSource={filtered}
        rowKey="id"
        loading={loading}
        onRow={(r) => ({ onClick: () => openEdit(r), style: { cursor: 'pointer' } })}
        pagination={{ pageSize: 50, showSizeChanger: false }}
        scroll={{ x: 1100 }}
        size="middle"
        footer={() => (
          <Typography.Text type="secondary">
            검색은 이름·키워드 정확 일치 (띄어쓰기·대소문자 무시)
          </Typography.Text>
        )}
      />

      <Modal
        title={editing?.id ? `지역 수정 — ${editing.name}` : '지역 추가'}
        open={editing !== null}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={saving}
        okText="저장"
        cancelText="취소"
        width={640}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Space size="middle" style={{ display: 'flex' }} align="start">
            <Form.Item name="country" label="국가" rules={[{ required: true }]}>
              <Select style={{ width: 100 }} options={Object.entries(COUNTRY_LABEL).map(([value, label]) => ({ value, label }))} />
            </Form.Item>
            <Form.Item name="name" label="지역 이름" rules={[{ required: true, message: '지역 이름을 입력해주세요' }, { max: 50 }]} style={{ flex: 1 }}>
              <Input placeholder="예: 홍대/신촌" />
            </Form.Item>
          </Space>

          <Form.Item label="위치 (지도 중심)" required style={{ marginBottom: 8 }}>
            <Space style={{ marginBottom: 8 }} wrap>
              <Button icon={<EnvironmentOutlined />} onClick={() => setAddressOpen(true)}>장소로 찾기</Button>
              <Typography.Text type="secondary">마커를 끌어 조정</Typography.Text>
            </Space>
            <RegionMapPreview
              latitude={latitude}
              longitude={longitude}
              radiusMeters={radiusMeters}
              onMove={(lat, lng) => form.setFieldsValue({ latitude: lat, longitude: lng })}
            />
          </Form.Item>
          <Space size="small" style={{ display: 'flex' }} align="start">
            <Form.Item name="latitude" label="위도" rules={[{ required: true, message: '장소를 찾아주세요' }]}>
              <InputNumber size="small" min={-90} max={90} step={0.0001} style={{ width: 130 }} />
            </Form.Item>
            <Form.Item name="longitude" label="경도" rules={[{ required: true, message: '장소를 찾아주세요' }]}>
              <InputNumber size="small" min={-180} max={180} step={0.0001} style={{ width: 130 }} />
            </Form.Item>
          </Space>

          <Space size="small" style={{ display: 'flex' }} align="start">
            <Form.Item name="regionType" label="범위" rules={[{ required: true }]}>
              <Select
                style={{ width: 100 }}
                options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))}
                onChange={(type) => form.setFieldValue('radiusMeters', DEFAULT_RADIUS[type])}
              />
            </Form.Item>
            <Form.Item
              name="radiusMeters"
              label="반경(m)"
              extra="범위를 고르면 기본값 입력"
              rules={[{ required: true, message: '반경을 입력해주세요' }]}
            >
              <InputNumber min={1} max={MAX_RADIUS} step={500} style={{ width: 150 }} />
            </Form.Item>
          </Space>

          <Form.Item name="keywords" label="검색 키워드" extra="Enter 또는 쉼표로 구분">
            <Select mode="tags" tokenSeparators={[',']} open={false} placeholder="예: 홍대, 홍대입구역, 연남동" />
          </Form.Item>

        </Form>
      </Modal>

      <GoogleAddressSearchModal
        open={addressOpen}
        onClose={() => setAddressOpen(false)}
        onSelect={({ latitude, longitude }) => form.setFieldsValue({
          latitude: Number(latitude.toFixed(6)),
          longitude: Number(longitude.toFixed(6)),
        })}
      />
    </div>
  );
}
