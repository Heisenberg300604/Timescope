import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Popup } from './Popup';
import { applyStoredThemeEarly } from '../shared/theme';
import '../styles/theme.css';

applyStoredThemeEarly();

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <Popup />
    </StrictMode>,
  );
}
