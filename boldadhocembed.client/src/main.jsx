import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './globals'
import './styles/index.css'

// Ensure jQuery is available globally before Bold Reports scripts
import $ from 'jquery';
if (typeof window !== 'undefined') {
  window.$ = window.jQuery = $;
}

import '@boldreports/javascript-reporting-controls/Content/v2.0/tailwind-light/bold.report-designer.min.css';
//Report Designer component dependent scripts
import '@boldreports/javascript-reporting-controls/Scripts/v2.0/common/bold.reports.common.min';
import '@boldreports/javascript-reporting-controls/Scripts/v2.0/common/bold.reports.widgets.min';
//Report Viewer and Designer component scripts
import '@boldreports/javascript-reporting-controls/Scripts/v2.0/bold.report-designer.min';
import '@boldreports/javascript-reporting-controls/Scripts/v2.0/bold.report-viewer.min';
//Reports react base
import '@boldreports/react-reporting-components/Scripts/bold.reports.react.min';

import App from './App.jsx'


createRoot(document.getElementById('root')).render(
 
    <App />
 
)
