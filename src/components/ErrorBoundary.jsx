import { Component } from 'react';
import { Result, Button } from 'antd';

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="오류가 발생했습니다"
          subTitle={this.state.error?.message || '알 수 없는 오류'}
          extra={
            <Button type="primary" onClick={() => this.setState({ hasError: false, error: null })}>
              다시 시도
            </Button>
          }
        />
      );
    }
    return this.props.children;
  }
}
