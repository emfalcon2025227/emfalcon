// Polyfill crypto.randomUUID for non-secure contexts / embedded environments
if (typeof window !== 'undefined') {
  if (!window.crypto) {
    (window as any).crypto = {} as Crypto;
  }
  if (typeof window.crypto.randomUUID !== 'function') {
    (window.crypto as any).randomUUID = function randomUUID() {
      if (typeof window.crypto.getRandomValues === 'function') {
        return ([1e7] as any + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: number) =>
          (c ^ window.crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };
  }
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initInputLanguageManager } from './services/inputLanguageManager';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { CloudConnectivityProvider } from './context/CloudConnectivityContext';
import { registerGlobalTests } from './utils/registerGlobalTests';

// Initialize centralized automatic input language manager
initInputLanguageManager();
registerGlobalTests();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <CloudConnectivityProvider>
        <App />
      </CloudConnectivityProvider>
    </ErrorBoundary>
  </StrictMode>,
);

