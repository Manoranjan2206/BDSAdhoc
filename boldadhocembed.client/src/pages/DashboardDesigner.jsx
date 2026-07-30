import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BoldBI } from '@boldbi/boldbi-embedded-sdk';
import dashboardsAPI from '../services/dashboardService';

export default function DashboardDesigner() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [config, setConfig] = useState(null);
  const [dashboardInstance, setDashboardInstance] = useState(null);
  const containerRef = useRef(null);

  const initDesigner = async () => {
    setLoading(true);
    setError(null);
    destroyDashboard();

    try {
      const data = await dashboardsAPI.getEmbedConfig('new');
      if (!data) {
        throw new Error('Could not retrieve embed details from server.');
      }
      setConfig(data);

      const serverUrl = `${data.serverUrl}/site/${data.siteIdentifier}`;
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
      const authorizationUrl = `${API_BASE_URL}/dashboards/authorize`;

      const dashboard = BoldBI.create({
        serverUrl: serverUrl,
        embedContainerId: 'dashboard-designer-container',
        width: '100%',
        height: '100%',
        embedType: data.embedType || BoldBI.EmbedType.Component,
        environment: data.environment || BoldBI.Environment.Enterprise,
        mode: BoldBI.Mode.Design,
        authorizationServer: { url: authorizationUrl },
        expirationTime: data.expirationTime || 10000,
      });

      dashboard.loadDesigner();
      setDashboardInstance(dashboard);

      setTimeout(() => {
        setLoading(false);
      }, 2000);
    } catch (err) {
      console.error('Dashboard designer initialize error:', err);
      setError('Failed to load the dashboard designer. Please check that the backend server is running.');
      setLoading(false);
    }
  };

  const destroyDashboard = () => {
    try {
      const instance = BoldBI.getInstance('dashboard-designer-container');
      if (instance) {
        instance.destroy();
      }
    } catch (e) {
      console.warn('Dashboard destroy warning:', e);
    }

    const el = document.getElementById('dashboard-designer-container');
    if (el) {
      el.innerHTML = '';
    }
  };

  useEffect(() => {
    initDesigner();
    return () => {
      destroyDashboard();
    };
  }, []);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-slate-50 dark:bg-[#111422]">
      {/* Sleek Compact Sub-Header */}
      <div className="h-12 px-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181c2c] flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-slate-400">Dashboards /</span>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
            Dashboard Designer
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/dashboards')}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            ← Back to Dashboards
          </button>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div className="flex-1 w-full relative overflow-hidden" style={{ height: 'calc(100vh - 112px)' }}>
        {loading && (
          <div className="absolute inset-0 bg-white/90 dark:bg-[#181c2c]/90 flex flex-col items-center justify-center z-10">
            <div className="w-9 h-9 border-3 border-slate-200 border-t-[#FF4800] rounded-full animate-spin" />
            <p className="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-300">Loading Dashboard Designer Interface...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 bg-white dark:bg-[#181c2c] flex items-center justify-center z-20 p-6">
            <div className="max-w-md text-center border border-red-200 dark:border-red-900/40 rounded-2xl p-8 bg-white dark:bg-slate-900 shadow-md">
              <h3 className="text-base font-bold text-red-600 mb-2">Configuration Required</h3>
              <p className="text-xs text-slate-500 mb-4">{error}</p>
              <div className="flex gap-2 justify-center">
                <button onClick={initDesigner} className="px-4 py-1.5 bg-[#FF4800] text-white text-xs font-semibold rounded-xl">Try Again</button>
                <button onClick={() => navigate('/dashboards')} className="px-4 py-1.5 border border-slate-200 text-xs font-semibold rounded-xl">Cancel</button>
              </div>
            </div>
          </div>
        )}

        <div id="dashboard-designer-container" ref={containerRef} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  );
}
