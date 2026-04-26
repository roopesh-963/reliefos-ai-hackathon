import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const container = document.getElementById('root')!;

// Use a more robust way to prevent double roots
if (!(container as any)._reactRootContainer) {
  const root = createRoot(container);
  (container as any)._reactRootContainer = root;
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} else {
  (container as any)._reactRootContainer.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
