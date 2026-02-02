import React from 'react';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null, info: null };
    }

    componentDidCatch(error, info) {
        console.error('ErrorBoundary caught', error, info);
        this.setState({ error, info });
    }

    render() {
        if (this.state.error) {
            return (
                <div style={{ padding: 20, color: '#fff', background: '#b91c1c' }}>
                    <h2>Something went wrong</h2>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.toString()}</pre>
                    <details style={{ whiteSpace: 'pre-wrap' }}>{this.state.info?.componentStack}</details>
                </div>
            );
        }
        return this.props.children;
    }
}