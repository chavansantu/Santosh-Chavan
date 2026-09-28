import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// AI Studio preview environment: HMR is disabled. Ignore and suppress WebSocket connection errors.
if (typeof window !== 'undefined') {
  const isWsError = (err: any) => {
    if (!err) return false;
    const msg = (typeof err === 'string' ? err : (err?.message || err?.reason || '')) + '';
    return msg.includes('WebSocket') || msg.includes('websocket') || msg.includes('vite-hmr');
  };

  window.addEventListener('error', (event) => {
    if (isWsError(event.error) || isWsError(event.message)) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    if (isWsError(event.reason)) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
