import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { SettingsApp } from './SettingsApp';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root is missing from index.html');

// One bundle, two windows: the overlay, and the settings panel docked beside it.
const Root = window.location.hash === '#settings' ? SettingsApp : App;

createRoot(container).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
