import React from 'react';
import ReactDOM from 'react-dom/client';
import { Ancient } from './Ancient';
import './index.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);
root.render(
  <React.StrictMode>
    <Ancient />
  </React.StrictMode>,
);
