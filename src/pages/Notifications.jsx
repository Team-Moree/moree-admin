import { useState } from 'react';
import {
  Typography,
  Card,
  Form,
  InputNumber,
  Input,
  Radio,
  Button,
  Space,
  App,
  Alert,
} from 'antd';
import { SendOutlined, BellOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import client from '../api/client';

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 24px;
`;

const VARIANT_OPTIONS = [
  { value: 'D_BEFORE', label: 'D-1 (전날)' },
  { value: 'SAME_DAY', label: '당일' },
];

export default function Notifications() {
  const [storeOpenForm] = Form.useForm();
  const [testForm] = Form.useForm();
  const [storeOpenLoading, setStoreOpenLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const { notification } = App.useApp();

  const handleSendStoreOpen = async () => {
    let values;
    try {
      values = await storeOpenForm.validateFields();
    } catch (err) {
      if (err?.errorFields) return;
      throw err;
    }

    setStoreOpenLoading(true);
    try {
      await client.post('/admin/notification/store-open', {
        userId: values.userId,
        storeId: values.storeId,
        variant: values.variant,
      });
      notification.success({
        message: '발송 완료',
        description: '행사 오픈 알림이 발송되었습니다.',
      });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '알림 발송 실패';
      notification.error({ message: '발송 실패', description: msg });
    } finally {
      setStoreOpenLoading(false);
    }
  };

  const handleSendTest = async () => {
    let values;
    try {
      values = await testForm.validateFields();
    } catch (err) {
      if (err?.errorFields) return;
      throw err;
    }

    const payload = {
      userId: values.userId,
      title: values.title,
      body: values.body,
    };
    const trimmedDeepLink = values.deepLink?.trim();
    if (trimmedDeepLink) {
      payload.deepLink = trimmedDeepLink;
    }

    setTestLoading(true);
    try {
      await client.post('/admin/notification/test', payload);
      notification.success({
        message: '발송 완료',
        description: '테스트 푸시 알림이 발송되었습니다.',
      });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '알림 발송 실패';
      notification.error({ message: '발송 실패', description: msg });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div>
      <Header>
        <Typography.Title level={4} style={{ margin: 0 }}>
          푸시 알림 (QA/개발용)
        </Typography.Title>
      </Header>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
        message="실제 사용자에게 푸시가 발송됩니다"
        description="userId와 페이로드를 확인한 뒤 발송하세요. 잘못된 userId 입력 시 무관한 사용자에게 알림이 전송될 수 있습니다."
      />

      <Grid>
        <Card
          title={(
            <Space>
              <BellOutlined />
              <span>행사 오픈 알림</span>
            </Space>
          )}
          extra={<Typography.Text type="secondary">POST /admin/notification/store-open</Typography.Text>}
        >
          <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
            스케줄러와 동일한 페이로드(제목/본문/딥링크)로 D-1 또는 당일 행사 오픈 알림을 즉시 발송합니다.
            상점 PRE_OPEN 여부와 무관하게 발송되며 실재하는 storeId가 필요합니다.
          </Typography.Paragraph>
          <Form
            form={storeOpenForm}
            layout="vertical"
            initialValues={{ variant: 'D_BEFORE' }}
          >
            <Form.Item
              name="userId"
              label="수신자 userId"
              rules={[{ required: true, message: 'userId를 입력해주세요' }]}
            >
              <InputNumber min={1} style={{ width: '100%' }} placeholder="예: 123" />
            </Form.Item>
            <Form.Item
              name="storeId"
              label="대상 storeId"
              rules={[{ required: true, message: 'storeId를 입력해주세요' }]}
            >
              <InputNumber min={1} style={{ width: '100%' }} placeholder="예: 456" />
            </Form.Item>
            <Form.Item
              name="variant"
              label="알림 종류"
              rules={[{ required: true, message: '알림 종류를 선택해주세요' }]}
            >
              <Radio.Group options={VARIANT_OPTIONS} optionType="button" buttonStyle="solid" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={storeOpenLoading}
                onClick={handleSendStoreOpen}
                block
              >
                발송
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <Card
          title={(
            <Space>
              <SendOutlined />
              <span>임의 푸시 알림</span>
            </Space>
          )}
          extra={<Typography.Text type="secondary">POST /admin/notification/test</Typography.Text>}
        >
          <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
            임의의 title/body/deepLink로 지정 사용자에게 푸시를 발송합니다. 딥링크 동작과 페이로드 검증용입니다.
          </Typography.Paragraph>
          <Form form={testForm} layout="vertical">
            <Form.Item
              name="userId"
              label="수신자 userId"
              rules={[{ required: true, message: 'userId를 입력해주세요' }]}
            >
              <InputNumber min={1} style={{ width: '100%' }} placeholder="예: 123" />
            </Form.Item>
            <Form.Item
              name="title"
              label="title"
              rules={[{ required: true, message: '제목을 입력해주세요' }]}
            >
              <Input placeholder="예: 알림 제목" maxLength={200} />
            </Form.Item>
            <Form.Item
              name="body"
              label="body"
              rules={[{ required: true, message: '본문을 입력해주세요' }]}
            >
              <Input.TextArea
                placeholder="예: 알림 본문"
                autoSize={{ minRows: 2, maxRows: 6 }}
                maxLength={500}
              />
            </Form.Item>
            <Form.Item name="deepLink" label="deepLink (선택)">
              <Input placeholder="예: moree://store/123" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={testLoading}
                onClick={handleSendTest}
                block
              >
                발송
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Grid>
    </div>
  );
}
