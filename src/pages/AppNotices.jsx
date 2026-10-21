import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Typography, Result, Button, App, Form, Input, Card, Spin, Alert, Space, Divider,
} from 'antd';
import { ReloadOutlined, CopyOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import client from '../api/client';

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
  gap: 16px;
`;

const PLATFORMS = [
  { key: 'IOS', label: 'iOS' },
  { key: 'ANDROID', label: 'Android' },
];

const VERSION_PATTERN = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
const TITLE_MAX = 50;
const MESSAGE_MAX = 200;

const SECTIONS = [
  { name: 'optional', label: '일반 업데이트', description: '현재 버전 < 기준 버전이면 닫을 수 있는 팝업' },
  { name: 'required', label: '강제 업데이트', description: '현재 버전 < 기준 버전이면 닫을 수 없는 팝업' },
];

function formatDateTime(value) {
  if (!value) return '-';
  return value.replace('T', ' ').slice(0, 19);
}

function NoticeSection({ name, label, description }) {
  return (
    <>
      <Divider titlePlacement="start" plain>
        <Typography.Text strong>{label}</Typography.Text>
        <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>{description}</Typography.Text>
      </Divider>
      <Form.Item
        name={[name, 'version']}
        label="기준 버전"
        rules={[
          { required: true, message: '버전을 입력해주세요' },
          { pattern: VERSION_PATTERN, message: '1.2.3 형식으로 입력해주세요' },
        ]}
      >
        <Input placeholder="1.3.0" style={{ maxWidth: 160 }} />
      </Form.Item>
      <Form.Item
        name={[name, 'title']}
        label="제목"
        rules={[
          { required: true, whitespace: true, message: '제목을 입력해주세요' },
          { max: TITLE_MAX, message: `최대 ${TITLE_MAX}자까지 입력 가능합니다` },
        ]}
      >
        <Input showCount maxLength={TITLE_MAX} />
      </Form.Item>
      <Form.Item
        name={[name, 'message']}
        label="내용"
        extra="줄바꿈은 앱 팝업에 그대로 반영됩니다"
        rules={[
          { required: true, whitespace: true, message: '내용을 입력해주세요' },
          { max: MESSAGE_MAX, message: `최대 ${MESSAGE_MAX}자까지 입력 가능합니다` },
        ]}
      >
        <Input.TextArea showCount maxLength={MESSAGE_MAX} autoSize={{ minRows: 2, maxRows: 5 }} />
      </Form.Item>
    </>
  );
}

function PlatformCard({ platform, label, notice, otherNotice, otherLabel, onSaved }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const { notification, modal } = App.useApp();

  const markDirty = (value) => {
    dirtyRef.current = value;
    setDirty(value);
  };

  const reset = useCallback(() => {
    form.setFieldsValue({ optional: notice?.optional, required: notice?.required });
    dirtyRef.current = false;
    setDirty(false);
  }, [form, notice]);

  useEffect(() => {
    if (!dirtyRef.current) reset();
  }, [reset]);

  const copyFromOther = () => {
    if (!otherNotice) return;
    form.setFieldsValue({ optional: otherNotice.optional, required: otherNotice.required });
    markDirty(true);
  };

  const save = async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    modal.confirm({
      title: `${label} 업데이트 팝업을 저장할까요?`,
      content: `일반 ${values.optional.version} · 강제 ${values.required.version} 기준으로 앱에 바로 반영됩니다.`,
      okText: '저장',
      cancelText: '취소',
      onOk: async () => {
        setSaving(true);
        try {
          const res = await client.put(`/admin/app-notice/${platform}`, values);
          notification.success({ title: `${label} 저장 완료` });
          markDirty(false);
          onSaved(res.data);
        } catch (err) {
          const msg = err.response?.data?.message || err.message || '저장 실패';
          notification.error({ title: '저장 실패', description: msg });
        } finally {
          setSaving(false);
        }
      },
    });
  };

  return (
    <Card
      title={label}
      extra={(
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          최종 수정 {formatDateTime(notice?.updatedAt)}
        </Typography.Text>
      )}
    >
      <Form form={form} layout="vertical" onValuesChange={() => markDirty(true)}>
        {SECTIONS.map((section) => (
          <NoticeSection key={section.name} {...section} />
        ))}
      </Form>
      <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
        <Button icon={<CopyOutlined />} onClick={copyFromOther} disabled={!otherNotice}>
          {otherLabel} 값 가져오기
        </Button>
        <Space>
          <Button onClick={reset} disabled={!dirty || saving}>되돌리기</Button>
          <Button type="primary" onClick={save} loading={saving} disabled={!dirty}>저장</Button>
        </Space>
      </Space>
    </Card>
  );
}

export default function AppNotices() {
  const [notices, setNotices] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { notification } = App.useApp();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get('/admin/app-notice');
      const list = Array.isArray(res.data?.results) ? res.data.results : [];
      setNotices(Object.fromEntries(list.map((item) => [item.platform, item])));
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '앱 업데이트 팝업 조회 실패';
      setError(msg);
      notification.error({ title: '조회 실패', description: msg });
    } finally {
      setLoading(false);
    }
  }, [notification]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaved = (item) => {
    setNotices((prev) => ({ ...prev, [item.platform]: item }));
  };

  if (error && Object.keys(notices).length === 0) {
    return (
      <Result
        status="error"
        title="앱 업데이트 팝업을 불러오지 못했습니다"
        subTitle={error}
        extra={<Button onClick={fetchData}>다시 시도</Button>}
      />
    );
  }

  return (
    <>
      <Header>
        <Typography.Title level={4} style={{ margin: 0 }}>앱 업데이트 팝업</Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>새로고침</Button>
      </Header>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title="앱 실행 시 현재 앱 버전을 기준 버전과 비교해 팝업을 띄웁니다. 강제 업데이트 기준 버전을 올리면 그보다 낮은 버전 사용자는 앱을 쓸 수 없으니 스토어 배포가 끝난 뒤에 올려주세요."
      />
      <Spin spinning={loading && Object.keys(notices).length === 0}>
        <Grid>
          {PLATFORMS.map(({ key, label }) => {
            const other = PLATFORMS.find((p) => p.key !== key);
            return (
              <PlatformCard
                key={key}
                platform={key}
                label={label}
                notice={notices[key]}
                otherNotice={notices[other.key]}
                otherLabel={other.label}
                onSaved={handleSaved}
              />
            );
          })}
        </Grid>
      </Spin>
    </>
  );
}
