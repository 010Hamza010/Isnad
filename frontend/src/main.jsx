import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { UIProvider } from './components/ui/UIProvider';
import './styles/globals.css';

try {
  const theme = localStorage.getItem('theme');
  if (theme) document.documentElement.dataset.theme = theme;
} catch { /* storage unavailable */ }

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter><UIProvider><App /></UIProvider></BrowserRouter>
);
