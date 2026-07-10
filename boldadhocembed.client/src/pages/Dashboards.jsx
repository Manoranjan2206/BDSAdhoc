import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BoldBI } from '@boldbi/boldbi-embedded-sdk';
import dashboardsAPI from '../services/dashboardService';
import { useData } from '../context/DataContext';
import { authService } from '../services/authService';

import { motion } from 'framer-motion';
import { ChevronRightIcon, ChevronLeftIcon, ChartBarIcon, ChevronDownIcon, FolderIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useLocation, Link } from 'react-router-dom';
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
  const [activeTab, setActiveTab] = useState('default'); // own | shared | default

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
        <div 
          className="rich-card flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-[var(--brand-100)] transition-colors group cursor-pointer"
          title={data.text}
        >
          <div className="flex items-center gap-3">
            <FolderIcon className="w-5 h-5 text-[var(--accent)] flex-shrink-0" />
            <span 
              className="font-medium text-sm text-[var(--text-strong)] truncate max-w-[180px]"
              title={data.text}
            >
              {data.text}
            </span>
          </div>
          <span className="text-xs font-medium text-[var(--text-muted)] bg-[var(--neutral-100)] px-2.5 py-1 rounded-full group-hover:bg-[var(--neutral-200)] transition-colors">
            {data.subChild?.length || 0}
          </span>
        </div>
      );
    }

    const isSelected = selectedDashboard && (selectedDashboard.id === data.dashboardRef?.id || selectedDashboard.Id === data.dashboardRef?.Id);

    return (
      <div
        className={`rich-card flex flex-col py-2 px-3 rounded-lg transition-colors group cursor-pointer ${
          isSelected 
            ? 'bg-[#E5F3FF] text-[#2563EB] border-l-[3px] border-[#2563EB] font-semibold dark:bg-[rgba(37,99,235,0.15)] dark:text-[#60A5FA] dark:border-l-[3px] dark:border-[#3B82F6]' 
            : 'bg-white dark:bg-transparent text-[#2D343D] dark:text-gray-300 hover:bg-[#F5F7FA] dark:hover:bg-slate-800/50'
        }`}
        title={data.dashboardRef?.description ? `${data.text}\n${data.dashboardRef.description}` : data.text}
        onClick={(e) => { if (onDashboardClick) onDashboardClick(data.dashboardRef); }}
      >
        <div className="flex items-center gap-3 mb-1">
          <ChartBarIcon className={`w-5 h-5 flex-shrink-0 ${isSelected ? 'text-[#2563EB] dark:text-[#60A5FA]' : 'text-[#6B7280] dark:text-gray-400'}`} />
          <span 
            className="font-medium text-sm truncate max-w-[160px]"
            title={data.text}
          >
            {data.text}
          </span>
        </div>
      </div>
    );
  };

  const filteredDashboards = useMemo(() => {
    const term = debouncedSearchTerm.toLowerCase().trim();

    const currentUser = authService.getUser()?.user || authService.getUser();
    const currentUserId = currentUser?.id || currentUser?.userId;

    return dashboards.filter(d => {
      // Tab filtering
      const isOwn = String(d.ownerId || d.OwnerId) === String(currentUserId);
      const isPublic = d.isPublic || d.IsPublic;

      if (activeTab === 'default' && !isPublic) return false;
      if (activeTab === 'shared' && (isPublic || isOwn)) return false;
      if (activeTab === 'own' && !isOwn) return false;

      // Search term filtering
      if (!term) return true;
      const n = (d.name || '').toLowerCase();
      const c = (d.category || '').toLowerCase();
      const desc = (d.description || '').toLowerCase();
      return n.includes(term) || c.includes(term) || desc.includes(term);
    });
  }, [dashboards, debouncedSearchTerm, activeTab]);

  const treeViewData = useMemo(() => {
    const byCat = new Map();
    
    // 1. Initialize all categories from the unfiltered dashboards list to show empty folders
    dashboards.forEach(d => {
      const cat = d.category || 'Uncategorized';
      if (!byCat.has(cat)) {
        byCat.set(cat, []);
      }
    });

    // 2. Populate the categories with their matching filtered dashboards
    filteredDashboards.forEach(d => {
      const cat = d.category || 'Uncategorized';
      byCat.get(cat).push({
        id: `db_${d.id}`,
        text: String(d.name || 'Untitled Dashboard'),
        isDashboard: true,
        dashboardRef: d,
        categoryName: cat,
      });
    });

    // 3. Only keep folders that have matching dashboards
    return Array.from(byCat.entries())
      .map(([cat, items]) => ({
        id: `cat_${cat}`,
        text: cat,
        expanded: true,
        subChild: items,
      }))
      .filter(node => node.subChild.length > 0);
  }, [dashboards, filteredDashboards]);

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
    // Keep sidebar visible - user can collapse manually if needed
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
        <div className="flex gap-3 items-center">
          {selectedDashboard && (
            <button
              onClick={() => { setSelectedDashboard(null); setDashboardsSidebarCollapsed(false); }}
              className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors"
            >
              ← Back to list
            </button>
          )}
          <button
            className="e-primary modern-btn flex items-center gap-2"
            onClick={() => { window.location.href = '/dashboards/designer'; }}
          >
            <PlusIcon className="w-5 h-5" />
            New Dashboard
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="reports-main" ref={mainRef}>
        {/* Sidebar Toggle Button */}
        <button
          onClick={() => setDashboardsSidebarCollapsed(!dashboardsSidebarCollapsed)}
          className={`absolute top-4 z-50 flex items-center justify-center w-7 h-7 rounded-full border border-[var(--brand-200)] bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all duration-200 ${
            dashboardsSidebarCollapsed ? 'left-4' : 'left-[calc(var(--tree-width,260px)+20px)]'
          }`}
          style={dashboardsSidebarCollapsed ? {} : { left: sidebarWidth + 20 }}
          title={dashboardsSidebarCollapsed ? 'Show dashboard list' : 'Hide dashboard list'}
        >
          <ChevronRightIcon className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-200 ${dashboardsSidebarCollapsed ? '' : 'rotate-180'}`} />
        </button>

        {/* Sidebar */}
        <div
          className={`reports-sidebar ${dashboardsSidebarCollapsed ? 'collapsed' : ''}`}
          style={{ width: dashboardsSidebarCollapsed ? 0 : sidebarWidth }}
        >
          {/* Tab Filters */}
          {!dashboardsSidebarCollapsed && (
            <div className="reports-sidebar-tabs">
              <button
                onClick={() => setActiveTab('own')}
                className={`reports-sidebar-tab-btn ${activeTab === 'own' ? 'active' : ''}`}
              >
                Own
              </button>
              <button
                onClick={() => setActiveTab('shared')}
                className={`reports-sidebar-tab-btn ${activeTab === 'shared' ? 'active' : ''}`}
              >
                Shared
              </button>
              <button
                onClick={() => setActiveTab('default')}
                className={`reports-sidebar-tab-btn ${activeTab === 'default' ? 'active' : ''}`}
              >
                Public
              </button>
            </div>
          )}

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

          {!dashboardsSidebarCollapsed && (
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
          )}
        </div>

        {/* Viewer area */}
        <div className="reports-view">
          {selectedDashboard ? (
            <motion.div
              key={selectedDashboard.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="reports-viewer-container flex flex-col"
            >
              {/* Dashboard Info Bar */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-[var(--surface)] flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <ChartBarIcon className="w-4 h-4 text-[var(--info)] flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-strong)] truncate">{selectedDashboard.name}</p>
                    {selectedDashboard.category && <p className="text-xs text-[var(--text-muted)] truncate">{selectedDashboard.category}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => { setSelectedDashboard(null); setDashboardsSidebarCollapsed(false); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] border border-[var(--brand-200)] rounded-lg hover:bg-[var(--brand-100)] transition-colors"
                    title="Close viewer"
                  >
                    <ChevronLeftIcon className="w-3.5 h-3.5" />
                    Close
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 relative">
              {error ? (
                <div className="reports-viewer-error h-full flex flex-col items-center justify-center">
                  <p>{error}</p>
                  <p className="text-sm mt-2 opacity-80">Please try refreshing or contact support.</p>
                  <button
                    onClick={() => { setError(null); loadDashboardViewer(); }}
                    className="mt-4 px-4 py-2 bg-[var(--info)] text-white text-sm font-semibold rounded-lg hover:opacity-90 transition"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <div id="dashboard-container" style={{ height: '100%', width: '100%' }} />
              )}
              </div>
            </motion.div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md text-center p-8 bg-white dark:bg-[#181c2c] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800"
              >
                <div className="w-16 h-16 bg-[var(--brand-100)] dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6 text-[var(--brand-500)]">
                  <ChartBarIcon className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold mb-2 text-[var(--text-strong)]">Select a Dashboard</h2>
                <p className="text-sm text-[var(--text-muted)] mb-6">
                  {dashboardsSidebarCollapsed
                    ? 'Click the arrow button to open the dashboard list.'
                    : 'Select a dashboard from the panel on the left to view live data.'}
                </p>
                {dashboardsSidebarCollapsed && (
                  <button
                    onClick={() => setDashboardsSidebarCollapsed(false)}
                    className="px-4 py-2 bg-[var(--info)] text-white text-sm font-semibold rounded-lg hover:opacity-90 transition"
                  >
                    Open Dashboard List
                  </button>
                )}
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboards;