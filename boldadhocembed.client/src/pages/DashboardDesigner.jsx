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
      // Fetch embed settings for a generic/new dashboard from the backend
      const data = await dashboardsAPI.getEmbedConfig('new');
      if (!data) {
        throw new Error('Could not retrieve embed details from server.');
      }
      setConfig(data);

      const serverUrl = `${data.serverUrl}/site/${data.siteIdentifier}`;
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
      const authorizationUrl = `${API_BASE_URL}/dashboards/authorize`;

      // Create and load the Bold BI designer
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

      // Hide loader after designer loads/initializes
      setTimeout(() => {
        setLoading(false);
      }, 2000);
    } catch (err) {
      console.error('Dashboard designer initialize error:', err);
      setError('Failed to load the dashboard designer. Please check that the backend server is running and configured correctly.');
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

  const rootStyle = { display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', boxSizing: 'border-box', background: '#f8fafc' };
  const toolbarStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 };
  const infoStyle = { display: 'flex', flexDirection: 'column' };
  const titleStyle = { margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' };
  const subStyle = { margin: '2px 0 0 0', fontSize: 12, color: '#64748b' };
  const actionsStyle = { display: 'flex', gap: 12 };
  const btnStyle = { padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#334155', cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s' };
  const btnPrimaryStyle = { ...btnStyle, background: '#4f46e5', borderColor: '#4f46e5', color: '#fff' };
  const canvasContainerStyle = { flexGrow: 1, width: '100%', position: 'relative', background: '#f1f5f9', overflow: 'hidden' };
  const canvasStyle = { height: '100%', width: '100%' };

  return (
    <div style={rootStyle}>
      <div style={toolbarStyle}>
        <div style={infoStyle}>
          <h2 style={titleStyle}>Dashboard Designer</h2>
        </div>
        <div style={actionsStyle}>
          <button style={btnStyle} onClick={() => navigate('/dashboards')}>
            Back to Dashboards
          </button>
        </div>
      </div>

      <div style={canvasContainerStyle}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justify: 'center', zIndex: 10, backdropFilter: 'blur(4px)' }}>
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-indigo-600"></div>
            <p style={{ marginTop: 16, fontSize: 14, fontWeight: 500, color: '#334155' }}>Loading BoldBI Designer Interface...</p>
          </div>
        )}

        {error && (
          <div style={{ position: 'absolute', inset: 0, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, padding: 24 }}>
            <div style={{ maxWidth: 460, textAlign: 'center', border: '1px solid #fee2e2', borderRadius: 12, padding: 32, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', background: '#fff' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: 18, color: '#ef4444' }}>Configuration Required</h3>
              <p style={{ margin: '0 0 20px 0', fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>{error}</p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button style={btnPrimaryStyle} onClick={initDesigner}>Try Again</button>
                <button style={btnStyle} onClick={() => navigate('/dashboards')}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        <div id="dashboard-designer-container" ref={containerRef} style={canvasStyle} />
      </div>
    </div>
  );
}
