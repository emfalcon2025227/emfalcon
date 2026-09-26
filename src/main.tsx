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

