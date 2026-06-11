import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BoldBI } from '@boldbi/boldbi-embedded-sdk';
import dashboardsAPI from '../services/dashboardService';
import { useData } from '../context/DataContext';

import { motion } from 'framer-motion';
import { ChevronRightIcon, ChevronLeftIcon, ChartBarIcon, ChevronDownIcon, FolderIcon } from '@heroicons/react/24/outline';
import { useLocation } from 'react-router-dom';
import '../styles/Dashboards.css'; // keep if you have custom overrides
import '../styles/reports.css';           // main shared styles

const Dashboards = () => {
  const { getDashboards, dashboardsSidebarCollapsed, setDashboardsSidebarCollapsed } = useData();
  const location = useLocation();
  

  const [dashboards, setDashboards] = useState([]);
  const [selectedDashboard, setSelectedDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardInstance, setDashboardInstance] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const isResizingRef = useRef(false);
  const mainRef = useRef(null);
  const [expandedCategories, setExpandedCategories] = useState(new Set());

  // Normalize dashboard props
  const normalizeDashboard = (d) => ({
    id: d.Id || d.id,
    name: String(d.Name || d.name || 'Untitled Dashboard'),
    description: String(d.Description || d.description || ''),
    category: String(d.CategoryName || d.category || d.Category || 'Uncategorized'),
    ...d,
  });

  useEffect(() => {
    loadDashboards();
  }, []);

  // Load viewer when dashboard selected
  useEffect(() => {
    if (selectedDashboard) {
      loadDashboardViewer();
    }
    return () => {
      // Cleanup on unmount / change
      if (dashboardInstance) {
        try {
          dashboardInstance.dispose();
        } catch (e) {
          console.warn('Dispose failed:', e);
        }
        setDashboardInstance(null);
      }
    };
  }, [selectedDashboard]);

  // Deep link support ?dashboardId=...
  useEffect(() => {
    if (!dashboards.length) return;
    const params = new URLSearchParams(location.search);
    const qId = params.get('dashboardId');
    if (!qId) return;
    const match = dashboards.find(d => String(d.id || d.Id) === String(qId));
    if (match) setSelectedDashboard(match);
  }, [dashboards, location.search]);

  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(h);
  }, [searchTerm]);

  // Resizer handlers: track pointer moves globally and update sidebar width
  useEffect(() => {
    const onMove = (e) => {
      if (!isResizingRef.current) return;
      const clientX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX);
      if (!clientX || !mainRef.current) return;
      const rect = mainRef.current.getBoundingClientRect();
      const newWidth = Math.max(180, Math.min(600, clientX - rect.left));
      setSidebarWidth(newWidth);
    };

    const onUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.cursor = '';
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchend', onUp);

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchend', onUp);
    };
  }, []);

  const nodeTemplate = (data, onDashboardClick) => {
    if (!data.isDashboard) {
      return (
        <div className="rich-card flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-[var(--brand-100)] transition-colors group cursor-pointer">
          <div className="flex items-center gap-3">
            <FolderIcon className="w-5 h-5 text-[var(--accent)] flex-shrink-0" />
            <span className="font-medium text-sm text-[var(--text-strong)] truncate max-w-[180px]">
              {data.text}
            </span>
          </div>
          <span className="text-xs font-medium text-[var(--text-muted)] bg-[var(--neutral-100)] px-2.5 py-1 rounded-full group-hover:bg-[var(--neutral-200)] transition-colors">
            {data.subChild?.length || 0}
          </span>
        </div>
      );
    }

    return (
      <div
        className="rich-card flex flex-col py-2 px-3 rounded-lg hover:bg-[var(--brand-100)] transition-colors group cursor-pointer"
        onClick={(e) => { if (onDashboardClick) onDashboardClick(data.dashboardRef); }}
      >
        <div className="flex items-center gap-3 mb-1">
          <ChartBarIcon className="w-5 h-5 text-[var(--info)] flex-shrink-0" />
          <span className="font-medium text-sm text-[var(--text-strong)] truncate max-w-[160px]">
            {data.text}
          </span>
        </div>
      </div>
    );
  };

  const filteredDashboards = useMemo(() => {
    const term = debouncedSearchTerm.toLowerCase().trim();
    if (!term) return dashboards;
    return dashboards.filter(d => {
      const n = (d.name || '').toLowerCase();
      const c = (d.category || '').toLowerCase();
      const desc = (d.description || '').toLowerCase();
      return n.includes(term) || c.includes(term) || desc.includes(term);
    });
  }, [dashboards, debouncedSearchTerm]);

  const treeViewData = useMemo(() => {
    const byCat = new Map();
    filteredDashboards.forEach(d => {
      const cat = d.category || 'Uncategorized';
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat).push({
        id: `db_${d.id}`,
        text: String(d.name || 'Untitled Dashboard'),
        isDashboard: true,
        dashboardRef: d,
        categoryName: cat,
      });
    });
    return Array.from(byCat.entries()).map(([cat, items]) => ({
      id: `cat_${cat}`,
      text: cat,
      expanded: true,
      subChild: items,
    }));
  }, [filteredDashboards]);

  // Initialize expanded categories on first load
  useEffect(() => {
    if (treeViewData.length > 0 && expandedCategories.size === 0) {
      const catIds = treeViewData.map(cat => cat.id);
      setExpandedCategories(new Set(catIds));
    }
  }, [treeViewData.length]);

  const loadDashboards = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await getDashboards();
      setDashboards((list || []).map(normalizeDashboard));
    } catch (err) {
      console.error('Dashboards load error:', err);
      setError('Failed to load dashboards');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardViewer = async () => {
    if (!selectedDashboard) return;
    try {
      setError(null);
      const dashboardId = selectedDashboard.id || selectedDashboard.Id;
      const config = await dashboardsAPI.getEmbedConfig(dashboardId);

      if (!config) throw new Error('No embed config');

      const serverUrl = `${config.serverUrl}/site/${config.siteIdentifier}`;
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
      const authorizationUrl = `${API_BASE_URL}/dashboards/authorize`;

      const dashboard = BoldBI.create({
        serverUrl,
        dashboardId,
        embedContainerId: 'dashboard-container',
        width: '100%',
        height: '100%',
        embedType: config.embedType || BoldBI.EmbedType.Component,
        environment: config.environment || BoldBI.Environment.Enterprise,
        mode: BoldBI.Mode.View,
        authorizationServer: { url: authorizationUrl },
        expirationTime: 100000,
      });

      dashboard.loadDashboard();
      setDashboardInstance(dashboard);
    } catch (err) {
      console.error('Dashboard viewer error:', err);
      setError(err.message || 'Failed to load dashboard');
    }
  };

  const handleSelectDashboard = (dashboard) => {
    setSelectedDashboard(dashboard);
    // Always collapse after selection
    setDashboardsSidebarCollapsed(true);
  };

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => {
      const updated = new Set(prev);
      if (updated.has(categoryId)) {
        updated.delete(categoryId);
      } else {
        updated.add(categoryId);
      }
      return updated;
    });
  };

  return (
    <div className="reports-page font-inter">
      {/* Topbar – same as Reports */}
      <div className="reports-topbar">
        <div className="flex items-center gap-4">
          <h1 className="reports-topbar-title">Dashboards</h1>
          <p className="reports-topbar-sub">Browse, preview & manage your dashboards</p>
        </div>
        <div className="flex gap-3">
          <button className="px-3 py-2 border rounded hover:bg-gray-50" onClick={loadDashboards}>
            Refresh
          </button>
          {/* Optional: Add create if your app supports it */}
          {/* <ButtonComponent cssClass="e-primary modern-btn">
            <PlusIcon className="w-5 h-5 mr-1.5" />
            New Dashboard
          </ButtonComponent> */}
        </div>
      </div>

      {/* Main layout */}
      <div className="reports-main" ref={mainRef}>
        {/* Sidebar */}
        <div
          className={`reports-sidebar ${dashboardsSidebarCollapsed ? 'collapsed' : ''}`}
          style={{ width: dashboardsSidebarCollapsed ? 0 : sidebarWidth }}
        >
          {!dashboardsSidebarCollapsed && (
            <div className="reports-search">
              <input
                value={searchTerm}
                placeholder="Search dashboards..."
                onChange={(e) => setSearchTerm(e.target.value)}
                className="modern-input w-full border rounded px-3 py-2"
              />
            </div>
          )}

          <div className="reports-tree">
            {loading ? (
              <div className="reports-tree-loading">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-3"></div>
                <p>Loading dashboards...</p>
              </div>
            ) : treeViewData.length === 0 ? (
              <div className="reports-tree-empty">
                <ChartBarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p>No dashboards found</p>
                {searchTerm && <p className="text-sm mt-1">Try adjusting your search</p>}
              </div>
            ) : (
              <div className="modern-tree">
                {treeViewData.map((node) => (
                  <div key={node.id} className="mb-2">
                    <div onClick={() => toggleCategory(node.id)}>
                      {nodeTemplate(node)}
                    </div>

                    {expandedCategories.has(node.id) && node.subChild?.map((child) => (
                      <div key={child.id} className="ml-4">
                        {nodeTemplate(child, handleSelectDashboard)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {!dashboardsSidebarCollapsed && (
          <div
            className="sidebar-resizer"
            onMouseDown={(e) => { isResizingRef.current = true; document.body.style.cursor = 'col-resize'; e.preventDefault(); }}
            onTouchStart={(e) => { isResizingRef.current = true; document.body.style.cursor = 'col-resize'; e.preventDefault(); }}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
          />
        )}

        {/* Viewer area */}
        <div className="reports-view">

          {selectedDashboard ? (
            <>
              <motion.div
                key={selectedDashboard.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="reports-viewer-container"
              >
                {error ? (
                  <div className="reports-viewer-error">
                    <p>{error}</p>
                    <p className="text-sm mt-2 opacity-80">Please try refreshing or contact support.</p>
                  </div>
                ) : (
                  <div id="dashboard-container" style={{ height: '100%', width: '100%' }} />
                )}
              </motion.div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Dashboards;