import React, { useState, useEffect, useMemo } from 'react';
import { BoldBI } from '@boldbi/boldbi-embedded-sdk';
import dashboardsAPI from '../services/dashboardService';
import { useData } from '../context/DataContext';

import { motion } from 'framer-motion';
import { ChevronRightIcon, ChevronLeftIcon, ChartBarIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { useLocation } from 'react-router-dom';
import '../styles/Dashboards.css'; // keep if you have custom overrides
import '../styles/reports.css';           // main shared styles

const Dashboards = () => {
  const { getDashboards } = useData();
  const location = useLocation();
  

  const [dashboards, setDashboards] = useState([]);
  const [selectedDashboard, setSelectedDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardInstance, setDashboardInstance] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
    setSidebarCollapsed(true);
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
      <div className="reports-main">
        {/* Sidebar */}
        <div className={`reports-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          {!sidebarCollapsed && (
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
              <div className="p-2 space-y-2">
                {treeViewData.map(category => {
                  const isExpanded = expandedCategories.has(category.id);
                  const itemCount = category.subChild?.length || 0;

                  return (
                    <div key={category.id} className="category-group">
                      {/* Category Header */}
                      <button
                        onClick={() => toggleCategory(category.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition font-medium text-sm text-indigo-900"
                      >
                        <ChevronDownIcon
                          className={`w-4 h-4 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                        />
                        <span className="flex-1 text-left">{category.text}</span>
                        <span className="text-xs bg-indigo-200 text-indigo-700 px-2 py-0.5 rounded">
                          {itemCount}
                        </span>
                      </button>

                      {/* Category Items */}
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="mt-2 ml-4 space-y-2"
                        >
                          {category.subChild?.map(dashboard => (
                            <button
                              key={dashboard.id}
                              className="w-full text-left rounded-lg border border-indigo-100/60 bg-white hover:bg-indigo-50/60 transition shadow-sm hover:shadow px-3 py-2 flex items-center gap-3"
                              onClick={() => handleSelectDashboard(dashboard.dashboardRef)}
                            >
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex-shrink-0">
                                <ChartBarIcon className="w-4 h-4" />
                              </span>
                              <span className="text-sm font-medium truncate text-gray-800">{dashboard.text}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Viewer area */}
        <div className="reports-view">
          <div className="reports-toggle">
            <button
              className="e-outline e-small modern-toggle-btn px-2 py-1 border rounded"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? <ChevronRightIcon className="w-5 h-5" /> : <ChevronLeftIcon className="w-5 h-5" />}
            </button>
          </div>

          {selectedDashboard ? (
            <>
              <motion.div
                key={selectedDashboard.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
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